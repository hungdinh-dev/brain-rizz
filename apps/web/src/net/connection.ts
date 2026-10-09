import {
  ClientMessage,
  type ErrorPayload,
  estimateClock,
  type JoinOptions,
  type PartyStateView,
  type PongPayload,
  ROOM_NAME,
  type RoundStartPayload,
  ServerMessage,
} from "@brain-rizz/shared";
import { Client, type Room } from "@colyseus/sdk";
import { useGame } from "../store/game";

/**
 * Lớp kết nối duy nhất tới game server. UI và Phaser không gọi Colyseus trực tiếp,
 * chỉ gọi các hàm ở đây và đọc state từ store.
 */

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:2567`;

const TOKEN_KEY = "brain-rizz:reconnect";

const client = new Client(SERVER_URL);
let room: Room | null = null;

export async function createParty(options: JoinOptions) {
  attach(await client.create(ROOM_NAME, options));
}

export async function joinParty(code: string, options: JoinOptions) {
  attach(await client.joinById(code, options));
}

/** Thử nối lại phòng cũ sau khi tải lại trang (token lưu trong sessionStorage). */
export async function resumeParty(): Promise<boolean> {
  const token = safeSession.get(TOKEN_KEY);
  if (!token) return false;
  try {
    attach(await client.reconnect(token));
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

function attach(r: Room) {
  room = r;
  safeSession.set(TOKEN_KEY, r.reconnectionToken);
  const store = useGame.getState();
  store.setSession(r.sessionId);

  r.onStateChange((state) => {
    useGame.getState().setParty(state.toJSON() as PartyStateView);
  });
  r.onMessage(ServerMessage.RoundStart, (msg: RoundStartPayload) => {
    useGame.getState().setRound(msg);
  });
  r.onMessage(ServerMessage.AnswerResult, (msg) => {
    useGame.getState().pushAnswerResult(msg);
  });
  r.onMessage(ServerMessage.Pong, onPong);
  r.onMessage(ServerMessage.Error, (msg: ErrorPayload) => {
    useGame.getState().setToast(msg.message);
  });
  r.onDrop(() => useGame.getState().setConnection("reconnecting"));
  r.onReconnect(() => {
    useGame.getState().setConnection("online");
    safeSession.set(TOKEN_KEY, r.reconnectionToken);
  });
  r.onLeave(() => {
    useGame.getState().setConnection("offline");
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

// ------------------------------------------------------------- storage an toàn

const safeSession = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* chế độ riêng tư: bỏ qua */
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* bỏ qua */
    }
  },
};
