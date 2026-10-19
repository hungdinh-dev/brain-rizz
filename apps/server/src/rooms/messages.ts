import { type ErrorPayload, PingSchema, type PongPayload, ServerMessage } from "@brain-rizz/shared";
import type { Client } from "colyseus";
import type { z } from "zod";

/** Tiện ích tin nhắn dùng chung cho các phòng (bất biến 3: mọi tin C → S đi qua schema zod). */

export function sendError(client: Client, error: ErrorPayload) {
  client.send(ServerMessage.Error, error);
}

/** Validate tin nhắn; sai schema thì trả lỗi `invalid` cho người gửi và trả `null`. */
export function parseMessage<S extends z.ZodType>(client: Client, schema: S, raw: unknown) {
  const result = schema.safeParse(raw);
  if (result.success) return result.data as z.infer<S>;
  sendError(client, { code: "invalid", message: "Dữ liệu không hợp lệ." });
  return null;
}

/** Trả lời `ping` để client đồng bộ giờ; sai schema thì im lặng bỏ qua. */
export function replyPong(client: Client, raw: unknown) {
  const msg = PingSchema.safeParse(raw);
  if (!msg.success) return;
  const pong: PongPayload = { clientTime: msg.data.clientTime, serverTime: Date.now() };
  client.send(ServerMessage.Pong, pong);
}
