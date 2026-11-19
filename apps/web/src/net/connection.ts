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
  type CreateOptions,
  type ErrorPayload,
  estimateClock,
  isChatPhase,
  type JoinOptions,
  type NudgePayload,
  type PartyStateView,
  type PongPayload,
  ROOM_NAME,
  type RoomBotsOption,
  ServerMessage,
} from "@brain-rizz/shared";
import { Client, type Room } from "@colyseus/sdk";
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

/** Chờ tạo phiên Supabase tối đa ngần này ms rồi vào phòng không token (Supabase tạm dừng, mạng chậm). */
const ACCESS_TOKEN_WAIT_MS = 4_000;

const client = new Client(SERVER_URL);
let room: Room | null = null;

/** Id toast lỗi server (`ServerMessage.Error`): gọi `toast.error(…, { id })` để thay câu chung. */
export const SERVER_ERROR_TOAST_ID = "server-error";

/**
 * Token phiên Supabase để server ghi kết quả vào tài khoản (FR-MR-10). Tạo phiên khách lười nếu
 * chưa có; lỗi, chưa cấu hình hoặc quá lâu → vào phòng không token (vẫn chơi được).
 */
async function accessToken(profile: { name: string; avatar?: JoinOptions["avatar"] }) {
  const ensure = useAuth
    .getState()
    .ensureSession({ name: profile.name, avatar: profile.avatar ?? "khoi" })
    .catch(() => null);
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), ACCESS_TOKEN_WAIT_MS),
  );
  return (await Promise.race([ensure, timeout])) ?? undefined;
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
  const r = await client.create(ROOM_NAME, { ...options, ...create, accessToken: token });
  if (extra.signal?.aborted) {
    // Không còn người thật nào trong phòng nên server đóng phòng (kể cả bot).
    void r.leave().catch(() => {});
    return;
  }
  attachParty(r);
}

export async function joinParty(code: string, options: JoinOptions) {
  const token = await accessToken(options);
  attachParty(await client.joinById(code, { ...options, accessToken: token }));
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
      void r.leave().catch(() => {});
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

export async function leaveParty() {
  safeSession.remove(TOKEN_KEY);
  await room?.leave();
  room = null;
  useGame.getState().reset();
  useChat.getState().reset();
  // Thay mục `/r/<mã>` bằng menu `/` (không để lại mục phòng trong lịch sử).
  useNav.getState().go("menu", { replace: true });
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
export async function leaveBrainTest() {
  const r = room;
  room = null;
  useGame.getState().reset();
  try {
    await r?.leave();
  } catch {
    /* phòng đã đóng */
  }
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
  r.onReconnect(whileCurrent(r, () => safeSession.set(TOKEN_KEY, r.reconnectionToken)));
}

function attachBrain(r: Room) {
  attachCommon(r);
  r.onStateChange(
    whileCurrent(r, (state: { toJSON(): unknown }) => {
      useGame.getState().setBrain(state.toJSON() as BrainStateView);
    }),
  );
  // Server huỷ lượt vì chờ Sẵn sàng quá lâu (close code riêng, SDK không tự nối lại): bỏ phòng,
  // về màn giới thiệu Kiểm tra não (brain = null) và báo cho người chơi.
  r.onLeave(
    whileCurrent(r, (code: number) => {
      if (brainLeaveAction(code) !== "idle") return;
      room = null;
      useGame.getState().reset();
      toast(i18n.t("brainTest.idleCancelled"), { duration: 8_000 });
    }),
  );
}

/** Phần chung của hai loại phòng: kết quả câu, lỗi, đồng bộ giờ, trạng thái kết nối. */
function attachCommon(r: Room) {
  room = r;
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
