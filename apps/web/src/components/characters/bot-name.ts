import type { CharacterId, ChatMessagePayload } from "@brain-rizz/shared";

/**
 * Tên hiển thị của người chơi, gồm bot (CR-016, ui-ux 6.6). Server để `name` của bot rỗng (không
 * chứa chữ giao diện), web dịch theo nhân vật: "Fen · máy". Hai bot trùng nhân vật thì bot sau có
 * số, đánh theo thứ tự ghế trong phòng: "Fen · máy", "Fen 2 · máy". Người thật giữ tên tự đặt.
 * Hàm thuần, có test (`bot-name.test.ts`); hook dùng trong giao diện ở `PlayerName.tsx`.
 */

/** Phần cần để đặt tên: một người chơi trong phòng, hoặc người gửi một tin chat. */
export interface NameSource {
  id: string;
  name: string;
  avatar: CharacterId;
  isBot?: boolean;
}

/**
 * Người gửi một tin chat dưới dạng nguồn tên: cờ `bot` trong tin (CR-016) cho biết dịch theo nhân
 * vật, kể cả khi bot đã bị bỏ khỏi phòng (lúc đó không có số thứ tự).
 */
export function chatSender(
  msg: Pick<ChatMessagePayload, "playerId" | "name" | "avatar" | "bot">,
): NameSource {
  return { id: msg.playerId, name: msg.name, avatar: msg.avatar, isBot: msg.bot === true };
}

/** Chữ đã dịch để ghép tên bot. */
export interface BotNameLabels {
  /** Tên nhân vật, vd. "Fen". */
  character(avatar: CharacterId): string;
  /** Tên có số, vd. "Fen 2". */
  numbered(name: string, n: number): string;
  /** Hậu tố, vd. "· máy". */
  suffix: string;
}

/** Tên tách hai phần: `name` cắt được khi chật, `suffix` (chỉ bot có) luôn giữ. */
export interface NameParts {
  name: string;
  /**
   * Đuôi của `name` cần giữ khi cắt: số của bot trùng nhân vật, vd. " 2" trong "Fen 2" (cắt thành
   * "Fe… 2" chứ không thành "Fe…"). Chỉ có khi số đứng sau tên trong câu dịch `bots.numbered`.
   */
  tail?: string;
  suffix?: string;
}

/**
 * Số thứ tự của từng bot trong nhóm bot cùng nhân vật, theo thứ tự `players` (thứ tự ghế):
 * id → 1, 2, 3… Người thật không có trong kết quả.
 */
export function botNumbers(players: readonly NameSource[]): Map<string, number> {
  const seen = new Map<CharacterId, number>();
  const numbers = new Map<string, number>();
  for (const p of players) {
    if (!p.isBot) continue;
    const n = (seen.get(p.avatar) ?? 0) + 1;
    seen.set(p.avatar, n);
    numbers.set(p.id, n);
  }
  return numbers;
}

/**
 * Tên của một người chơi. Bot không có trong `numbers` (vd. tin chat của bot đã bị bỏ khỏi phòng)
 * thì không đánh số.
 */
export function nameParts(
  player: NameSource,
  numbers: ReadonlyMap<string, number>,
  labels: BotNameLabels,
): NameParts {
  if (!player.isBot) return { name: player.name };
  const base = labels.character(player.avatar);
  const n = numbers.get(player.id) ?? 1;
  if (n <= 1) return { name: base, suffix: labels.suffix };
  const name = labels.numbered(base, n);
  // Ngôn ngữ đặt số trước tên thì không tách: cả tên cắt như thường.
  return name.startsWith(base) && name.length > base.length
    ? { name, tail: name.slice(base.length), suffix: labels.suffix }
    : { name, suffix: labels.suffix };
}

/** Ghép hai phần thành một chuỗi (nhãn cho trình đọc màn hình, danh sách tên, toast…). */
export function joinName({ name, suffix }: NameParts): string {
  return suffix ? `${name} ${suffix}` : name;
}
