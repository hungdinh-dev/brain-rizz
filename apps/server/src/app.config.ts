import { BRAIN_TEST_ROOM_NAME, ROOM_NAME } from "@brain-rizz/shared";
import { defineRoom, defineServer, monitor, playground, WebSocketTransport } from "colyseus";
import { adminRouter } from "./admin/routes";
import { BrainTestRoom } from "./rooms/BrainTestRoom";
import { PartyRoom } from "./rooms/PartyRoom";

const isProd = process.env.NODE_ENV === "production";

/**
 * Nhịp ping WebSocket (ms) server gửi cho mọi máy. Qua Render/Cloudflare, khung đóng WebSocket bị
 * nuốt: máy đóng tab hay mất sóng thì server không nhận được khung đóng, chỉ biết người chơi rớt khi
 * máy đó thôi trả lời ping. Mặc định của `@colyseus/ws-transport` (3000 ms, 2 lần) để khoảng 10 s
 * mới thấy rớt (`connected = false`) và nối lại cũng chậm theo; 1500 ms còn khoảng 3–4,5 s.
 */
export const TRANSPORT_PING_INTERVAL_MS = 1_500;

/**
 * Số ping liên tiếp không có pong thì nhịp kế tiếp cắt kết nối (thành rớt mạng → giữ chỗ).
 * Rớt mạng → bị cắt sau 2–3 nhịp (3–4,5 s). Máy còn sống có tới 2 nhịp (3 s) để trả pong (khứ hồi
 * trên Render ~75 ms), nên mạng chập chờn ngắn không bị cắt oan.
 */
export const TRANSPORT_PING_MAX_RETRIES = 2;

const server = defineServer({
  // Truyền transport tự dựng thay cho mặc định (`new WebSocketTransport(serverOptions)` trong
  // `Server.attach`) chỉ để đổi nhịp ping; các tuỳ chọn khác giữ mặc định của transport.
  transport: new WebSocketTransport({
    pingInterval: TRANSPORT_PING_INTERVAL_MS,
    pingMaxRetries: TRANSPORT_PING_MAX_RETRIES,
  }),

  rooms: {
    [ROOM_NAME]: defineRoom(PartyRoom),
    [BRAIN_TEST_ROOM_NAME]: defineRoom(BrainTestRoom),
  },

  express: (app) => {
    // Health check cho Fly.io / Render / uptime monitor.
    app.get("/healthz", (_req, res) => {
      res.json({ ok: true, uptime: process.uptime() });
    });

    // Trang quản trị (CR-019): phòng đang mở, nạp lại cấu hình party. Chỉ quản trị viên (bảng admins).
    app.use("/admin", adminRouter());

    // Công cụ dev: bảng theo dõi phòng và playground thử tin nhắn.
    // Không bật ở production (hoặc phải đặt mật khẩu trước khi bật).
    if (!isProd) {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;
