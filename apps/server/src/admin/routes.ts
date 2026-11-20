import {
  type AdminConfigReloadResponse,
  type AdminErrorResponse,
  type AdminRoomsResponse,
  type AdminRoomView,
  MAX_ACCESS_TOKEN_LENGTH,
  ROOM_NAME,
} from "@brain-rizz/shared";
import { matchMaker } from "colyseus";
import { type NextFunction, type Request, type Response, Router } from "express";
import { PartyRoom } from "../rooms/PartyRoom";
import { partyConfigCache } from "../store/party-config-cache";
import { getResultStore } from "../store/ResultStore";

/**
 * HTTP cho trang quản trị (CR-019, docs/01-product/admin-console.md mục 4.2), gắn ở `/admin`.
 *
 * Xác thực: `Authorization: Bearer <access token Supabase>` → `verifyToken` → `isAdmin` (bảng
 * `admins`). Server chưa cấu hình Supabase → 503; thiếu/sai token → 401; không phải admin → 403.
 * CORS: `Access-Control-Allow-Origin: *`, cho header `Authorization`, `OPTIONS` → 204; không dùng
 * cookie. Kết quả không bao giờ có tên người chơi.
 *
 * - `GET /admin/rooms` → `AdminRoomsResponse`: phòng party đang mở trên tiến trình này.
 * - `POST /admin/config/reload` → `AdminConfigReloadResponse`: xoá bộ đệm cấu hình party rồi nạp
 *   lại, để trận bắt đầu sau đó áp dụng ngay (web gọi sau khi lưu cấu hình).
 */
export function adminRouter(): Router {
  const router = Router();
  router.use(cors);
  router.get("/rooms", requireAdmin, async (_req, res) => {
    const body: AdminRoomsResponse = {
      serverTime: Date.now(),
      uptimeS: Math.floor(process.uptime()),
      rooms: await listPartyRooms(),
    };
    res.json(body);
  });
  router.post("/config/reload", requireAdmin, async (_req, res) => {
    const config = await partyConfigCache().reload();
    const body: AdminConfigReloadResponse = { version: config.version };
    res.json(body);
  });
  // Lỗi bất ngờ: không lộ chi tiết ra ngoài.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[admin] Lỗi xử lý yêu cầu:", err);
    fail(res, 500, "internal");
  });
  return router;
}

/** Phòng party trên tiến trình này, mới tạo trước. */
export async function listPartyRooms(): Promise<AdminRoomView[]> {
  const listings = await matchMaker.query({ name: ROOM_NAME });
  const rooms: AdminRoomView[] = [];
  for (const { roomId } of listings) {
    const room = matchMaker.getLocalRoomById(roomId);
    if (room instanceof PartyRoom) rooms.push(room.adminView());
  }
  return rooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function cors(req: Request, res: Response, next: NextFunction) {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  });
  // Không dùng cookie: bỏ cờ credentials mà Colyseus gắn cho mọi yêu cầu HTTP.
  res.removeHeader("Access-Control-Allow-Credentials");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const store = getResultStore();
  if (!store.enabled) {
    fail(res, 503, "unavailable");
    return;
  }
  const token = bearerToken(req.get("authorization"));
  const userId = token ? await store.verifyToken(token) : null;
  if (!userId) {
    res.set("WWW-Authenticate", "Bearer");
    fail(res, 401, "unauthorized");
    return;
  }
  if (!(await store.isAdmin(userId))) {
    fail(res, 403, "forbidden");
    return;
  }
  next();
}

/** Token trong `Authorization: Bearer <token>`; sai dạng hoặc quá dài → `null`. */
function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const token = match?.[1];
  return token && token.length <= MAX_ACCESS_TOKEN_LENGTH ? token : null;
}

function fail(res: Response, status: number, error: AdminErrorResponse["error"]) {
  const body: AdminErrorResponse = { error };
  res.status(status).json(body);
}
