import { BRAIN_TEST_ROOM_NAME, ROOM_NAME } from "@brain-rizz/shared";
import { defineRoom, defineServer, monitor, playground } from "colyseus";
import { BrainTestRoom } from "./rooms/BrainTestRoom";
import { PartyRoom } from "./rooms/PartyRoom";

const isProd = process.env.NODE_ENV === "production";

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(PartyRoom),
    [BRAIN_TEST_ROOM_NAME]: defineRoom(BrainTestRoom),
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
