import {
  BRAIN_TEST_ROOM_NAME,
  type BrainClientMessage,
  type BrainJoinOptions,
  type BrainStateView,
  ClientMessage,
  type ErrorPayload,
  estimateClock,
  type JoinOptions,
  type NudgePayload,
  type PartyStateView,
  type PongPayload,
  ROOM_NAME,
  ServerMessage,
} from "@brain-rizz/shared";
import { Client, type Room } from "@colyseus/sdk";
import { toast } from "sonner";
import { i18n } from "@/i18n";
import { STORAGE_KEYS, safeSession } from "@/lib/storage";
import { useAuth } from "@/stores/auth.store";
import { useGame } from "@/stores/game.store";
import { brainLeaveAction } from "./brain-leave";

/**
 * Lớp kết nối duy nhất tới game server. UI và Phaser không gọi Colyseus trực tiếp,
 * chỉ gọi các hàm ở đây và đọc state từ store.
 *
 * Mỗi lúc chỉ một phòng: party (`ROOM_NAME`) hoặc Kiểm tra não (`BRAIN_TEST_ROOM_NAME`, UC-14).
 */

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:2567`;

const TOKEN_KEY = STORAGE_KEYS.reconnect;

/** Chờ tạo phiên Supabase tối đa ngần này ms rồi vào phòng không token (Supabase tạm dừng, mạng chậm). */
const ACCESS_TOKEN_WAIT_MS = 4_000;

const client = new Client(SERVER_URL);
let room: Room | null = null;

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

export async function createParty(options: JoinOptions) {
  const token = await accessToken(options);
  attachParty(await client.create(ROOM_NAME, { ...options, accessToken: token }));
}

export async function joinParty(code: string, options: JoinOptions) {
  const token = await accessToken(options);
  attachParty(await client.joinById(code, { ...options, accessToken: token }));
}

/** Thử nối lại phòng cũ sau khi tải lại trang (token lưu trong sessionStorage). */
export async function resumeParty(): Promise<boolean> {
  const token = safeSession.get(TOKEN_KEY);
  if (!token) return false;
  try {
    attachParty(await client.reconnect(token));
    return true;
  } catch {
    safeSession.remove(TOKEN_KEY);
    return false;
  }
}

export async function leaveParty() {
  safeSession.remove(TOKEN_KEY);
  await room?.leave();
  room = null;
  useGame.getState().reset();
  history.replaceState(null, "", "/");
}

export function send(type: (typeof ClientMessage)[keyof typeof ClientMessage], payload?: unknown) {
  room?.send(type, payload);
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

function attachParty(r: Room) {
  safeSession.set(TOKEN_KEY, r.reconnectionToken);
  attachCommon(r);
  r.onStateChange((state) => {
    useGame.getState().setParty(state.toJSON() as PartyStateView);
  });
  // Chủ phòng nhắc độ khó (màn Hướng dẫn): thẻ nổi có nút đóng, không chặn thao tác.
  r.onMessage(ServerMessage.Nudge, (msg: NudgePayload) => {
    toast(i18n.t("intro.nudgeTitle"), {
      description: i18n.t("intro.nudgeBody", { level: i18n.t(`difficulty.${msg.difficulty}`) }),
      closeButton: true,
      position: "top-center",
    });
  });
  r.onReconnect(() => safeSession.set(TOKEN_KEY, r.reconnectionToken));
}

function attachBrain(r: Room) {
  attachCommon(r);
  r.onStateChange((state) => {
    useGame.getState().setBrain(state.toJSON() as BrainStateView);
  });
  // Server huỷ lượt vì chờ Sẵn sàng quá lâu (close code riêng, SDK không tự nối lại): bỏ phòng,
  // về màn giới thiệu Kiểm tra não (brain = null) và báo cho người chơi.
  r.onLeave((code) => {
    if (room !== r || brainLeaveAction(code) !== "idle") return;
    room = null;
    useGame.getState().reset();
    toast(i18n.t("brainTest.idleCancelled"), { duration: 8_000 });
  });
}

/** Phần chung của hai loại phòng: kết quả câu, lỗi, đồng bộ giờ, trạng thái kết nối. */
function attachCommon(r: Room) {
  room = r;
  useGame.getState().setSession(r.sessionId);
  // Vòng, seed, đồng hồ đọc từ state; tin này chỉ để bỏ kết quả câu cũ sớm (và SDK không cảnh báo
  // tin chưa đăng ký).
  r.onMessage(ServerMessage.RoundStart, () => {
    useGame.getState().onRoundStart();
  });
  r.onMessage(ServerMessage.AnswerResult, (msg) => {
    useGame.getState().pushAnswerResult(msg);
  });
  r.onMessage(ServerMessage.Pong, onPong);
  r.onMessage(ServerMessage.Error, (msg: ErrorPayload) => {
    // Lệnh vừa gửi bị từ chối → mở khoá nút đang chờ phản hồi.
    useGame.getState().pushError();
    // Dịch theo mã lỗi; server cũ gửi mã lạ thì hiện nguyên câu server gửi.
    toast.error(i18n.t(`errors.${msg.code}`, { defaultValue: msg.message }));
  });
  r.onDrop(() => {
    if (room === r) useGame.getState().setConnection("reconnecting");
  });
  r.onReconnect(() => {
    if (room === r) useGame.getState().setConnection("online");
  });
  r.onLeave(() => {
    if (room === r) useGame.getState().setConnection("offline");
  });

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
