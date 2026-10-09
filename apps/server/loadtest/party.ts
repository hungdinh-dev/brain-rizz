import { cli, type Options } from "@colyseus/loadtest";
import { Client } from "@colyseus/sdk";

/**
 * Load test: mỗi bot tạo/vào phòng và ping định kỳ.
 * Chạy: pnpm --filter @brain-rizz/server loadtest
 */
export async function main(options: Options) {
  const client = new Client(options.endpoint);
  const room = await client.create(options.roomName, {
    name: `bot-${Math.floor(Math.random() * 1000)}`,
  });

  setInterval(() => room.send("ping", { clientTime: Date.now() }), 1_000);
  room.onLeave(() => console.log("bot left", room.sessionId));
}

cli(main);
