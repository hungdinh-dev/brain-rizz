import {
  type AdminRoomsResponse,
  type AdminRoomView,
  ClientMessage,
  MAX_ACCESS_TOKEN_LENGTH,
  ROOM_NAME,
} from "@brain-rizz/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyRoom } from "../src/rooms/PartyRoom";
import { MemoryResultStore, NoopResultStore, setResultStore } from "../src/store/ResultStore";
import { bootOnFreePort, connectTo, type TestServer, until } from "./helpers";

/** HTTP cho trang quản trị (CR-019, docs/01-product/admin-console.md mục 4.2). */

const ADMIN_TOKEN = "jwt-admin";
const PLAYER_TOKEN = "jwt-player";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const PLAYER = "00000000-0000-0000-0000-0000000000b1";

let colyseus: TestServer;
/** Địa chỉ HTTP của server test (cổng do `boot` chọn). */
let BASE = "";

function call(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, headers, ...rest } = init;
  return fetch(`${BASE}${path}`, {
    ...rest,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  });
}

function useAdminStore() {
  const store = new MemoryResultStore(
    new Map([
      [ADMIN_TOKEN, ADMIN],
      [PLAYER_TOKEN, PLAYER],
    ]),
  );
  store.admins.add(ADMIN);
  setResultStore(store);
  return store;
}

const ROOM_VIEW_KEYS: Record<keyof AdminRoomView, true> = {
  roomId: true,
  code: true,
  phase: true,
  round: true,
  totalRounds: true,
  gameId: true,
  humans: true,
  bots: true,
  connected: true,
  configVersion: true,
  createdAt: true,
};

describe("HTTP /admin (CR-019)", () => {
  beforeAll(async () => {
    colyseus = await bootOnFreePort();
    BASE = `http://127.0.0.1:${(colyseus.server as unknown as { port: number }).port}`;
  });
  afterAll(async () => {
    setResultStore(new NoopResultStore());
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    setResultStore(new NoopResultStore());
    await colyseus.cleanup();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chưa cấu hình Supabase → 503 cho mọi endpoint, kể cả có token", async () => {
    for (const [path, method] of [
      ["/admin/rooms", "GET"],
      ["/admin/config/reload", "POST"],
    ] as const) {
      const res = await call(path, { method, token: ADMIN_TOKEN });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "unavailable" });
    }
  });

  it("thiếu, sai dạng, sai hoặc quá dài token → 401; không phải admin → 403", async () => {
    const store = useAdminStore();
    const cases: [Record<string, string>, number][] = [
      [{}, 401],
      [{ Authorization: "Bearer" }, 401],
      [{ Authorization: `Basic ${ADMIN_TOKEN}` }, 401],
      [{ Authorization: "Bearer token-sai" }, 401],
      [{ Authorization: `Bearer ${"x".repeat(MAX_ACCESS_TOKEN_LENGTH + 1)}` }, 401],
      [{ Authorization: `Bearer ${PLAYER_TOKEN}` }, 403],
    ];
    for (const [headers, status] of cases) {
      for (const [path, method] of [
        ["/admin/rooms", "GET"],
        ["/admin/config/reload", "POST"],
      ] as const) {
        const res = await call(path, { method, headers });
        expect(res.status, `${method} ${path} ${JSON.stringify(headers).slice(0, 40)}`).toBe(
          status,
        );
        expect(await res.json()).toEqual({
          error: status === 401 ? "unauthorized" : "forbidden",
        });
        expect(res.headers.get("access-control-allow-origin")).toBe("*");
      }
    }
    // Bị từ chối thì không nạp lại cấu hình.
    expect(store.partyConfigLoads).toBe(0);
  });

  it("OPTIONS → 204, cho phép header Authorization từ mọi origin", async () => {
    const res = await fetch(`${BASE}/admin/rooms`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://brain-rizz.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      "authorization",
    );
    expect(res.headers.get("access-control-allow-origin")).toMatch(
      /^(\*|https:\/\/brain-rizz\.example)$/,
    );
  });

  it("GET /admin/rooms: phòng party đang mở, mới tạo trước, không lộ tên người chơi", async () => {
    const store = useAdminStore();
    store.partyConfig = { version: 6, scoring: {}, disabledGames: [] };
    const first = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    const an = await connectTo(colyseus, first, { name: "AnBíMật" });
    const binh = await connectTo(colyseus, first, { name: "BìnhBíMật" });
    // Phòng sau: 1 người + 2 bot; Kiểm tra não không được liệt kê.
    await new Promise((r) => setTimeout(r, 5));
    const second = (await colyseus.createRoom(ROOM_NAME, {
      bots: { count: 2, level: 1 },
    })) as PartyRoom;
    await connectTo(colyseus, second, { name: "CúcBíMật" });
    await colyseus.createRoom("brain-test", {});

    // Bình rớt mạng (đang giữ chỗ): còn là người của phòng nhưng không kết nối.
    binh.reconnection.enabled = false;
    await binh.leave(false);
    await until(() => [...first.state.players.values()].some((p) => !p.connected));
    // Người chơi bấm Sẵn sàng: vẫn ở phòng chờ.
    an.send(ClientMessage.Ready, { ready: true });
    await until(() => [...first.state.players.values()].some((p) => p.ready));

    const res = await call("/admin/rooms", { token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    for (const secret of ["AnBíMật", "BìnhBíMật", "CúcBíMật", ADMIN_TOKEN, ADMIN]) {
      expect(text).not.toContain(secret);
    }
    const body = JSON.parse(text) as AdminRoomsResponse;
    expect(Math.abs(body.serverTime - Date.now())).toBeLessThan(5_000);
    expect(body.uptimeS).toBeGreaterThanOrEqual(0);
    expect(body.rooms.map((r) => r.roomId)).toEqual([second.roomId, first.roomId]);
    for (const view of body.rooms) {
      expect(Object.keys(view).sort()).toEqual(Object.keys(ROOM_VIEW_KEYS).sort());
      expect(new Date(view.createdAt).toISOString()).toBe(view.createdAt);
    }
    expect(body.rooms[0]).toMatchObject({
      code: second.roomId,
      phase: "lobby",
      round: 0,
      totalRounds: 3,
      gameId: "",
      humans: 1,
      bots: 2,
      connected: 1,
      configVersion: 6,
    });
    expect(body.rooms[1]).toMatchObject({ code: first.roomId, humans: 2, bots: 0, connected: 1 });
  });

  it("store ném lỗi khi xác thực hoặc kiểm quyền → 500 internal, server không sập", async () => {
    const store = useAdminStore();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(store, "verifyToken").mockRejectedValueOnce(new Error("auth hỏng"));
    vi.spyOn(store, "isAdmin").mockRejectedValueOnce(new Error("db hỏng"));
    for (let i = 0; i < 2; i++) {
      const res = await call("/admin/rooms", { token: ADMIN_TOKEN });
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: "internal" });
      // Không lộ chi tiết lỗi ra ngoài; vẫn có CORS để web đọc được mã lỗi.
      expect(text).not.toContain("hỏng");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    }
    expect(logged).toHaveBeenCalled();
    // Lần sau vẫn phục vụ bình thường.
    const ok = await call("/admin/rooms", { token: ADMIN_TOKEN });
    expect(ok.status).toBe(200);
  });

  it("gỡ quyền có hiệu lực ngay (không đệm isAdmin); không gửi cờ credentials", async () => {
    const store = useAdminStore();
    const first = await call("/admin/rooms", { token: ADMIN_TOKEN });
    expect(first.status).toBe(200);
    expect(first.headers.get("access-control-allow-credentials")).toBeNull();
    store.admins.delete(ADMIN);
    const res = await call("/admin/config/reload", { method: "POST", token: ADMIN_TOKEN });
    expect(res.status).toBe(403);
    expect(store.partyConfigLoads).toBe(0);
  });

  it("phòng đã khoá (đủ người) vẫn được liệt kê", async () => {
    useAdminStore();
    const room = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    await connectTo(colyseus, room, { name: "An" });
    await room.lock();
    const res = await call("/admin/rooms", { token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AdminRoomsResponse;
    expect(body.rooms.map((r) => r.roomId)).toEqual([room.roomId]);
  });

  it("POST /admin/config/reload: bỏ đệm, nạp lại, trả version; phòng tạo sau đó dùng bản mới", async () => {
    const store = useAdminStore();
    store.partyConfig = { version: 1, scoring: {}, disabledGames: [] };
    const a = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    expect(a.state.configVersion).toBe(1);

    // Admin lưu bản 2: còn trong 30 giây đệm thì phòng mới vẫn dùng bản 1.
    store.partyConfig = { version: 2, scoring: {}, disabledGames: ["balance"] };
    const b = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    expect(b.state.configVersion).toBe(1);

    const loads = store.partyConfigLoads;
    const res = await call("/admin/config/reload", { method: "POST", token: ADMIN_TOKEN });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 2 });
    expect(store.partyConfigLoads).toBe(loads + 1);

    const c = (await colyseus.createRoom(ROOM_NAME, {})) as PartyRoom;
    expect(c.state.configVersion).toBe(2);
    expect([...c.state.disabledGames]).toEqual(["balance"]);
    // Không đọc lại DB: bản vừa nạp còn trong đệm.
    expect(store.partyConfigLoads).toBe(loads + 1);
  });
});
