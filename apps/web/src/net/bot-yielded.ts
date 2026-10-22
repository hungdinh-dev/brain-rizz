import type { BotYieldedPayload } from "@brain-rizz/shared";
import { type BotNameLabels, joinName, nameParts } from "@/components/characters/bot-name";

/**
 * Bot nhường ghế (CR-016, ui-ux 6.6): người thật vào phòng đủ 8 ghế ở phòng chờ nên bot thêm gần
 * nhất rời phòng; những người đã ở trong phòng thấy toast 3 giây
 * "Lan vào phòng · Bắp · máy nhường ghế". Nhiều bot nhường liền nhau thì mỗi lần một toast.
 * Hàm thuần, có test (`bot-yielded.test.ts`); `connection.ts` nghe tin và hiện toast.
 */

/** Toast hiện ngần này ms. */
export const BOT_YIELDED_TOAST_MS = 3_000;

/** Chữ đã dịch để ghép câu toast: tên bot (như mọi nơi khác) và câu báo. */
export interface BotYieldedLabels extends BotNameLabels {
  /** Câu toast, vd. "Lan vào phòng · Bắp · máy nhường ghế". */
  sentence(name: string, bot: string): string;
}

/**
 * Câu toast của một tin `botYielded`. Bot đã rời state lúc tin tới nên không tra lại được trong
 * phòng: tên dịch theo `botAvatar`, không đánh số ("Bắp · máy").
 */
export function botYieldedText(msg: BotYieldedPayload, labels: BotYieldedLabels): string {
  const bot = joinName(
    nameParts({ id: msg.botId, name: "", avatar: msg.botAvatar, isBot: true }, new Map(), labels),
  );
  return labels.sentence(msg.playerName, bot);
}
