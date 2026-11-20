import {
  type AnswerResultPayload,
  type BotYieldedPayload,
  BRAIN_TEST_ROOM_NAME,
  type BrainClientMessage,
  type BrainJoinOptions,
  type BrainStateView,
  type ChatHistoryPayload,
  type ChatMessagePayload,
  type ChatSendPayload,
  ClientMessage,
  type ClosingPayload,
  type CreateOptions,
  type ErrorPayload,
  estimateClock,
  isChatPhase,
  type JoinOptions,
  type NudgePayload,
  type PartyStateView,
  type PongPayload,
  type RewardPayload,
  ROOM_NAME,
  type RoomBotsOption,
  ServerMessage,
  sanitizeLoadout,
} from "@brain-rizz/shared";
import { Client, CloseCode, type Room } from "@colyseus/sdk";
import { toast } from "sonner";
import { i18n } from "@/i18n";
import { STORAGE_KEYS, safeSession } from "@/lib/storage";
import { useAuth } from "@/stores/auth.store";
import { routeServerError, useChat } from "@/stores/chat.store";
import { useGame } from "@/stores/game.store";
import { useNav } from "@/stores/nav.store";
import { BOT_YIELDED_TOAST_MS, botYieldedText } from "./bot-yielded";
import { brainLeaveAction } from "./brain-leave";
import { SERVER_URL } from "./server-url";

/**
 * Lớp kết nối duy nhất tới game server. UI và Phaser không gọi Colyseus trực tiếp,
 * chỉ gọi các hàm ở đây và đọc state từ store.
 *
 * Mỗi lúc chỉ một phòng: party (`ROOM_NAME`) hoặc Kiểm tra não (`BRAIN_TEST_ROOM_NAME`, UC-14).
 */

const TOKEN_KEY = STORAGE_KEYS.reconnect;

/**
 * Chờ tạo phiên Supabase (phiên khách nếu chưa có) tối đa ngần này ms rồi vào phòng không token
 * (Supabase tạm dừng, mạng chậm). Có phiên thì ai cũng nhận phấn sau trận (CR-023, kế hoạch 5.4).
 */
export const ACCESS_TOKEN_WAIT_MS = 3_000;

const client = new Client(SERVER_URL);
let room: Room | null = null;

/** Id toast lỗi server (`ServerMessage.Error`): gọi `toast.error(…, { id })` để thay câu chung. */
export const SERVER_ERROR_TOAST_ID = "server-error";

/** Id toast "mất kết nối với phòng": phòng đóng ngoài ý muốn nhiều lần liền thì chỉ hiện một toast. */
const ROOM_LOST_TOAST_ID = "room-lost";

/** Toast báo phòng đóng (huỷ lượt vì chờ lâu, mất phòng party) hiện lâu hơn toast thường. */
const ROOM_CLOSED_TOAST_MS = 8_000;

/**
 * Mã đóng server báo trước bằng tin `closing`, theo từng phòng. Qua Render/Cloudflare khung đóng của
 * server không tới trình duyệt, nên `onLeave` thường chỉ thấy 1006 (hoặc mã client tự đóng): handler
 * đọc mã ở đây trước, rồi mới tới mã của sự kiện đóng.
 */
const announcedCloseCodes = new WeakMap<Room, number>();

function leaveCode(r: Room, code: number) {
  return announcedCloseCodes.get(r) ?? code;
}

/**
 * Token phiên Supabase để server ghi kết quả vào tài khoản (FR-MR-10). Tạo phiên khách lười nếu
 * chưa có; lỗi, chưa cấu hình hoặc quá lâu → vào phòng không token (vẫn chơi được).
 */
async function accessToken(profile: { name: string; avatar?: JoinOptions["avatar"] }) {
  const ensure = useAuth
    .getState()
    .ensureSession({ name: profile.name, avatar: profile.avatar ?? "khoi" })
    .catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ACCESS_TOKEN_WAIT_MS);
  });
  try {
    return (await Promise.race([ensure, timeout])) ?? undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hồ sơ gửi khi vào phòng party: đúng các trường của `JoinOptions` (không kéo theo trường lạ của
 * hồ sơ trên máy), phụ kiện đã làm sạch (`sanitizeLoadout`); server lọc lại theo món đã sở hữu.
 */
function partyJoinOptions(options: JoinOptions): JoinOptions {
  const { name, colorIndex, difficulty, avatar, accessories } = options;
  return {
    name,
    ...(colorIndex === undefined ? {} : { colorIndex }),
    ...(difficulty === undefined ? {} : { difficulty }),
    ...(avatar === undefined ? {} : { avatar }),
    accessories: sanitizeLoadout(accessories ?? []),
  };
}

interface CreatePartyExtra {
  /** "Chơi với máy" (CR-016): tạo phòng kèm sẵn bot; server đọc ở `onCreate` (`CreateOptions`). */
  bots?: RoomBotsOption;
  /** Người chơi huỷ giữa chừng (đóng hộp thoại): phòng tạo xong thì rời ngay, không vào phòng chờ. */
  signal?: AbortSignal;
}

export async function createParty(options: JoinOptions, extra: CreatePartyExtra = {}) {
  const token = await accessToken(options);
  if (extra.signal?.aborted) return;
  const create: CreateOptions = extra.bots ? { bots: extra.bots } : {};
  const r = await client.create(ROOM_NAME, {
    ...partyJoinOptions(options),
    ...create,
    accessToken: token,
  });
  if (extra.signal?.aborted) {
    // Không còn người thật nào trong phòng nên server đóng phòng (kể cả bot).
    closeRoom(r);
    return;
  }
  attachParty(r);
}

export async function joinParty(code: string, options: JoinOptions) {
  const token = await accessToken(options);
  attachParty(await client.joinById(code, { ...partyJoinOptions(options), accessToken: token }));
}

let resuming: Promise<boolean> | null = null;

/**
 * Thử nối lại phòng cũ sau khi tải lại trang (token lưu trong sessionStorage).
 *
 * Gọi lại khi lần trước chưa xong (StrictMode chạy effect hai lần) thì dùng chung lời gọi đó: token
 * nối lại chỉ dùng được một lần, gửi hai lần thì lần thua bị từ chối (4003) và không được xoá mất
 * token mới mà lần thắng vừa lưu.
 */
export function resumeParty(): Promise<boolean> {
  resuming ??= reconnectStored().finally(() => {
    resuming = null;
  });
  return resuming;
}

async function reconnectStored(): Promise<boolean> {
  const token = safeSession.get(TOKEN_KEY);
  if (!token) return false;
  try {
    const r = await client.reconnect(token);
    if (room) {
      // Trong lúc chờ đã vào phòng khác: bỏ ghế cũ, không giành lại màn hình.
      closeRoom(r);
      return false;
    }
    attachParty(r);
    return true;
  } catch {
    // Chỉ xoá khi trong máy vẫn là token vừa dùng (không xoá token của phòng vừa vào/nối lại).
    if (safeSession.get(TOKEN_KEY) === token) safeSession.remove(TOKEN_KEY);
    return false;
  }
}

/**
 * Rời phòng party và về menu ngay, không chờ mạng. Bỏ `room` trước để `onDrop` / state muộn của
 * phòng cũ bị `whileCurrent` bỏ qua. Vẫn trả Promise để UI `await` / `.finally` như cũ.
 */
export async function leaveParty(): Promise<void> {
  const r = room;
  room = null;
  safeSession.remove(TOKEN_KEY);
  if (r) closeRoom(r);
  useGame.getState().reset();
  useChat.getState().reset();
  // Thay mục `/r/<mã>` bằng menu `/` (không để lại mục phòng trong lịch sử).
  useNav.getState().go("menu", { replace: true });
}

/**
 * Rời phòng `r` mà không chờ server đóng kết nối: gửi LEAVE_ROOM (server dọn ghế ngay) rồi trình
 * duyệt tự đóng bằng mã CONSENTED. Lý do: qua Render/Cloudflare, khung đóng do server gửi bị giữ lại
 * nên `room.leave()` chờ mãi, 20 giây sau thành 1006 và SDK tưởng rớt mạng, cố nối lại vào phòng đã
 * rời. Khung đóng do client gửi thì đi qua ngay.
 */
function closeRoom(r: Room) {
  // Rớt mạng sau khi đã rời thì không nối lại (SDK gọi thẳng `onLeave`).
  r.reconnection.enabled = false;
  // SDK có thể đã hẹn một lần nối lại trước đó (lần này vẫn chạy dù đã tắt): nối được thì rời + đóng
  // ngay, để server không giữ "người chơi ma" trong phòng.
  r.onReconnect(() => sendLeaveAndClose(r));
  sendLeaveAndClose(r);
}

function sendLeaveAndClose(r: Room) {
  try {
    // Đang giữa lúc nối lại: socket chưa mở, hoặc đã mở nhưng server chưa gửi JOIN_ROOM (server chưa
    // nghe tin nên LEAVE bị mất). Chờ `onReconnect` ở trên (SDK đã đặt `isReconnecting = false`), hoặc
    // nối lại thất bại thì SDK tự gọi `onLeave` vì đã tắt nối lại.
    if (!r.connection?.isOpen || r.reconnection.isReconnecting) return;
    // Không chờ promise: nó chỉ xong khi kết nối đóng.
    void r.leave(true).catch(() => {});
    // Thứ tự khung trên một socket được giữ nên server nhận LEAVE trước khung đóng.
    r.connection.close(CloseCode.CONSENTED);
  } catch {
    /* kết nối đã đóng */
  }
}

export function send(type: (typeof ClientMessage)[keyof typeof ClientMessage], payload?: unknown) {
  room?.send(type, payload);
}

/**
 * Gửi một tin chat (CR-011). Giới hạn tần suất phía client theo cùng luật server: gửi nhanh quá
 * thì không gửi, khung chat hiện dòng nhắc. Trả `false` khi không gửi (giữ bản nháp).
 */
export function sendChat(payload: ChatSendPayload): boolean {
  if (!room || !useChat.getState().allowSend(Date.now())) return false;
  room.send(ClientMessage.Chat, payload);
  return true;
}

// ------------------------------------------------------------- Kiểm tra não (UC-14)

/**
 * Tạo phòng Kiểm tra não riêng (mỗi lượt một phòng; "Làm lại" = rời rồi tạo phòng mới).
 * Không lưu token nối lại: tải lại trang là bỏ lượt (rớt mạng thì SDK vẫn tự nối lại như party).
 */
export async function startBrainTest(options: BrainJoinOptions) {
  const token = await accessToken(options);
  if (room) await leaveBrainTest();
  attachBrain(await client.create(BRAIN_TEST_ROOM_NAME, { ...options, accessToken: token }));
}

/** Rời phòng Kiểm tra não (thoát giữa lượt = huỷ, server không lưu). */
export async function leaveBrainTest(): Promise<void> {
  const r = room;
  room = null;
  useGame.getState().reset();
  if (r) closeRoom(r);
}

export function sendBrain(
  type: (typeof BrainClientMessage)[keyof typeof BrainClientMessage],
  payload?: unknown,
) {
  room?.send(type, payload);
}

// ------------------------------------------------------------- gắn phòng

/**
 * Bọc handler của phòng `r`: chỉ chạy khi `r` vẫn là phòng hiện tại. Phòng cũ (đã rời, bị thay khi
 * nối lại) còn gửi state / tin muộn thì bỏ qua, không ghi đè màn hình của phòng đang chơi.
 */
function whileCurrent<A extends unknown[]>(r: Room, handler: (...args: A) => void) {
  return (...args: A) => {
    if (room === r) handler(...args);
  };
}

function attachParty(r: Room) {
  safeSession.set(TOKEN_KEY, r.reconnectionToken);
  // Đăng ký tin chat ngay sau khi vào phòng: server gửi lịch sử ngay sau state đầu tiên.
  useChat.getState().attach(r.roomId);
  attachCommon(r);
  r.onMessage(
    ServerMessage.Chat,
    whileCurrent(r, (msg: ChatMessagePayload) => {
      const { sessionId, party } = useGame.getState();
      // Bong bóng biểu cảm chỉ ở các pha có khung chat; lúc đếm ngược / đang chơi chỉ đếm chưa đọc.
      useChat.getState().receive(msg, sessionId, !!party && isChatPhase(party.phase));
    }),
  );
  r.onMessage(
    ServerMessage.ChatHistory,
    whileCurrent(r, (msg: ChatHistoryPayload) => {
      useChat.getState().receiveHistory(msg.messages, useGame.getState().sessionId);
    }),
  );
  r.onDrop(whileCurrent(r, () => useChat.getState().markStale()));
  r.onStateChange(
    whileCurrent(r, (state: { toJSON(): unknown }) => {
      useGame.getState().setParty(state.toJSON() as PartyStateView);
    }),
  );
  // Chủ phòng nhắc độ khó (màn Hướng dẫn): thẻ nổi có nút đóng, không chặn thao tác.
  r.onMessage(
    ServerMessage.Nudge,
    whileCurrent(r, (msg: NudgePayload) => {
      toast(i18n.t("intro.nudgeTitle"), {
        description: i18n.t("intro.nudgeBody", { level: i18n.t(`difficulty.${msg.difficulty}`) }),
        closeButton: true,
        position: "top-center",
      });
    }),
  );
  // Bot nhường ghế cho người vừa vào (CR-016): server chỉ gửi những người đã ở trong phòng.
  // Không đặt id toast: nhiều bot nhường liền nhau thì mỗi lần một toast.
  r.onMessage(
    ServerMessage.BotYielded,
    whileCurrent(r, (msg: BotYieldedPayload) => {
      const text = botYieldedText(msg, {
        character: (avatar) => i18n.t(`characters.${avatar}.name`),
        numbered: (name, n) => i18n.t("bots.numbered", { name, n }),
        suffix: i18n.t("bots.suffix"),
        sentence: (name, bot) => i18n.t("bots.yielded", { name, bot }),
      });
      toast(text, { duration: BOT_YIELDED_TOAST_MS });
    }),
  );
  // Phấn vừa nhận sau trận (CR-023): màn vinh danh hiện "+N phấn" ở chỗ của mình (0 thì ẩn).
  r.onMessage(
    ServerMessage.Reward,
    whileCurrent(r, (msg: RewardPayload) => {
      const chalk = typeof msg?.chalk === "number" ? msg.chalk : 0;
      useGame.getState().setReward(chalk);
    }),
  );
  r.onReconnect(whileCurrent(r, () => safeSession.set(TOKEN_KEY, r.reconnectionToken)));
  // Phòng đóng ngoài ý muốn (server khởi động lại, nối lại thất bại, server báo đóng). `leaveParty`
  // bỏ `room` trước nên tự rời không tới đây. Không về menu thì phòng chờ / màn chơi đứng yên, mọi
  // nút không còn tác dụng mà không có lời nào báo.
  r.onLeave(whileCurrent(r, onPartyLost));
}

/** Mất phòng party: bỏ phòng như `leaveParty` (không gửi gì, kết nối đã đóng) rồi báo người chơi. */
function onPartyLost() {
  room = null;
  safeSession.remove(TOKEN_KEY);
  useGame.getState().reset();
  useChat.getState().reset();
  useNav.getState().go("menu", { replace: true });
  toast(i18n.t("connection.roomLost"), { id: ROOM_LOST_TOAST_ID, duration: ROOM_CLOSED_TOAST_MS });
}

function attachBrain(r: Room) {
  attachCommon(r);
  r.onStateChange(
    whileCurrent(r, (state: { toJSON(): unknown }) => {
      useGame.getState().setBrain(state.toJSON() as BrainStateView);
    }),
  );
  // Server huỷ lượt vì chờ Sẵn sàng quá lâu (close code riêng, SDK không tự nối lại): bỏ phòng,
  // về màn giới thiệu Kiểm tra não (brain = null) và báo cho người chơi. Mã lấy từ tin `closing` nếu
  // có, vì khung đóng mang mã này có thể không tới (sự kiện đóng chỉ còn 1006).
  r.onLeave(
    whileCurrent(r, (code: number) => {
      if (brainLeaveAction(leaveCode(r, code)) !== "idle") return;
      room = null;
      useGame.getState().reset();
      toast(i18n.t("brainTest.idleCancelled"), { duration: ROOM_CLOSED_TOAST_MS });
    }),
  );
}

/** Mã client được gửi khi tự đóng WebSocket: 1000 hoặc 3000–4999. */
function isClientCloseCode(code: number) {
  return Number.isInteger(code) && (code === 1000 || (code >= 3000 && code <= 4999));
}

/** Đóng kết nối phía client, bỏ qua lỗi khi socket đã đóng / chưa mở. */
function closeConnection(r: Room, code: number) {
  try {
    r.connection.close(code);
  } catch {
    /* kết nối đã đóng */
  }
}

/**
 * Tin `closing`: server sắp chủ động đóng với `code`. Khung đóng của server không tới (Render nuốt),
 * nên ghi nhớ mã cho `onLeave`, tắt nối lại và tự đóng: SDK gọi `onLeave` ngay thay vì chờ 20 giây
 * rồi tưởng rớt mạng.
 */
function onServerClosing(r: Room, msg: ClosingPayload) {
  const code = msg?.code;
  const known = typeof code === "number" && Number.isInteger(code);
  if (known) announcedCloseCodes.set(r, code);
  r.reconnection.enabled = false;
  closeConnection(r, known && isClientCloseCode(code) ? code : CloseCode.CONSENTED);
}

/**
 * Lỗi của phòng `r`. Lần nối lại bị server từ chối (phòng không còn, token hết hạn): server gửi
 * Protocol.ERROR (tới được) rồi đóng 4003, nhưng khung đóng bị Render nuốt nên mỗi lần thử treo 20 giây
 * rồi thành 1006, SDK thử lại tới 15 lần. Lỗi có mã số khi đang nối lại → thôi nối lại, tự đóng 4003
 * để `onLeave` chạy ngay. Lỗi socket (sự kiện `error`, không có mã, vd. mất mạng giữa lần thử) để SDK
 * thử tiếp như rớt mạng thường; lỗi khi không nối lại thì bỏ qua như cũ.
 */
function onRoomError(r: Room, code: number | undefined) {
  if (typeof code !== "number" || !r.reconnection.isReconnecting) return;
  r.reconnection.enabled = false;
  closeConnection(r, CloseCode.FAILED_TO_RECONNECT);
}

/** Phần chung của hai loại phòng: kết quả câu, lỗi, đồng bộ giờ, trạng thái kết nối. */
function attachCommon(r: Room) {
  room = r;
  // Không bọc `whileCurrent`: phòng cũ (đã rời) cũng nên đóng ngay thay vì treo chờ khung đóng.
  r.onMessage(ServerMessage.Closing, (msg: ClosingPayload) => onServerClosing(r, msg));
  r.onError((code: number | undefined) => onRoomError(r, code));
  useGame.getState().setSession(r.sessionId);
  // Vòng, seed, đồng hồ đọc từ state; tin này chỉ để bỏ kết quả câu cũ sớm (và SDK không cảnh báo
  // tin chưa đăng ký).
  r.onMessage(
    ServerMessage.RoundStart,
    whileCurrent(r, () => useGame.getState().onRoundStart()),
  );
  r.onMessage(
    ServerMessage.AnswerResult,
    whileCurrent(r, (msg: AnswerResultPayload) => useGame.getState().pushAnswerResult(msg)),
  );
  r.onMessage(ServerMessage.Pong, whileCurrent(r, onPong));
  r.onMessage(
    ServerMessage.Error,
    whileCurrent(r, (msg: ErrorPayload) => {
      // Lỗi chat (server gắn `source: "chat"`): gửi nhanh quá → dòng nhắc trong khung chat;
      // sai pha / tin rỗng → bỏ qua; chat bị tắt / không phải chủ phòng → chỉ toast.
      // Chỉ lỗi không có nguồn mới mở khoá nút đang chờ phản hồi (lệnh vừa gửi bị từ chối).
      routeServerError(msg, {
        pushError: () => useGame.getState().pushError(),
        // Dịch theo mã lỗi; server cũ gửi mã lạ thì hiện nguyên câu server gửi. Cùng một id toast
        // để màn hình thay bằng câu rõ hơn khi biết lệnh nào bị từ chối (vd. thêm bot khi vừa đủ người).
        showError: () =>
          toast.error(i18n.t(`errors.${msg.code}`, { defaultValue: msg.message }), {
            id: SERVER_ERROR_TOAST_ID,
          }),
      });
    }),
  );
  r.onDrop(whileCurrent(r, () => useGame.getState().setConnection("reconnecting")));
  r.onReconnect(whileCurrent(r, () => useGame.getState().setConnection("online")));
  r.onLeave(whileCurrent(r, () => useGame.getState().setConnection("offline")));

  useGame.getState().setConnection("online");
  syncClock();
}

// ------------------------------------------------------------- đồng bộ giờ

const samples: { t0: number; t1: number; serverTime: number }[] = [];

function syncClock(count = 5) {
  samples.length = 0;
  for (let i = 0; i < count; i++) {
    setTimeout(() => room?.send(ClientMessage.Ping, { clientTime: Date.now() }), i * 150);
  }
}

function onPong(msg: PongPayload) {
  samples.push({ t0: msg.clientTime, t1: Date.now(), serverTime: msg.serverTime });
  useGame.getState().setClockOffset(estimateClock(samples).offset);
}

// Tab bị ẩn rồi hiện lại (điện thoại chuyển app) → đo lại độ lệch giờ.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && room) syncClock(3);
});
