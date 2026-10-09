import { ROOM_NAME } from "@brain-rizz/shared";
import { defineRoom, defineServer, monitor, playground } from "colyseus";
import { PartyRoom } from "./rooms/PartyRoom";

const isProd = process.env.NODE_ENV === "production";

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(PartyRoom),
  },

  express: (app) => {
    // Health check cho Fly.io / Render / uptime monitor.
    app.get("/healthz", (_req, res) => {
      res.json({ ok: true, uptime: process.uptime() });
    });

    // Công cụ dev: bảng theo dõi phòng và playground thử tin nhắn.
    // Không bật ở production (hoặc phải đặt mật khẩu trước khi bật).
    if (!isProd) {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;
