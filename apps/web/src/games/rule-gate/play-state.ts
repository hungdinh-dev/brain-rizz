import {
  type Difficulty,
  type RuleGateAnswer,
  type RuleGateBuddy,
  type RuleGateRule,
  ruleGate,
} from "@brain-rizz/shared";

/*
 * Phần thuần của scene Cổng luật (không Phaser): nhận vuốt / phím, sổ cổng, đếm sai liền cho gợi
 * ý Siêu khó, bố cục vé. Tách riêng để test. Không ảnh hưởng chấm: server chấm lại mọi câu.
 */

// ─── Nhập ───────────────────────────────────────────────────────────────────────────────────────

/** Ngưỡng vuốt: quãng ngang ≥ 40 px thiết kế và ≥ 1,3 lần quãng dọc (đặc tả, mục Nhập). */
export const SWIPE_MIN = 40;
export const SWIPE_RATIO = 1.3;

export type Gesture = { kind: "tap" } | { kind: "swipe"; side: RuleGateAnswer } | { kind: "none" };

/** Vuốt trái = cho vào, vuốt phải = mời về; quãng ngắn = chạm; dọc hoặc chéo không rõ = bỏ qua. */
export function classifyGesture(dx: number, dy: number): Gesture {
  if (Math.hypot(dx, dy) < SWIPE_MIN) return { kind: "tap" };
  const ax = Math.abs(dx);
  if (ax >= SWIPE_MIN && ax >= SWIPE_RATIO * Math.abs(dy)) {
    return { kind: "swipe", side: dx < 0 ? "in" : "out" };
  }
  return { kind: "none" };
}

/** Mã phím (không phụ thuộc bố cục bàn phím) trước, rồi tên phím. ← / A = vào, → / D = về. */
const KEY_SIDES: Readonly<Record<string, RuleGateAnswer>> = {
  ArrowLeft: "in",
  KeyA: "in",
  ArrowRight: "out",
  KeyD: "out",
};

export function keySide(code: string, key: string): RuleGateAnswer | undefined {
  return KEY_SIDES[code] ?? KEY_SIDES[key];
}

export function isArrowKey(code: string, key: string): boolean {
  return (
    code === "ArrowLeft" || code === "ArrowRight" || key === "ArrowLeft" || key === "ArrowRight"
  );
}

// ─── Sổ cổng (Siêu khó) ─────────────────────────────────────────────────────────────────────────

/** Sổ cổng giữ 4 bạn gần nhất (đúng bằng cửa sổ của mô hình người chơi trong đặc tả). */
export const LOG_SIZE = 4;

export interface LogEntry {
  buddy: RuleGateBuddy;
  /** Đáp án ĐÚNG của câu đó (cả khi người chơi trả lời sai). */
  side: RuleGateAnswer;
}

export function pushLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  return [...log, entry].slice(-LOG_SIZE);
}

/**
 * Sổ lúc vào vòng giữa chừng (nối lại): dựng lại từ các câu trước bằng chính `generate`, nên sổ
 * giống hệt lúc chưa rớt mạng. Câu 0 thì sổ trống.
 */
export function seedLog(seed: number, startIndex: number, difficulty: Difficulty): LogEntry[] {
  const log: LogEntry[] = [];
  for (let i = Math.max(0, startIndex - LOG_SIZE); i < startIndex; i++) {
    const puzzle = ruleGate.generate(seed, i, difficulty);
    log.push({ buddy: puzzle.buddy, side: puzzle.answer });
  }
  return log;
}

export interface LogSlot {
  entry: LogEntry;
  /** Thứ tự trong cột, 0 = mới nhất. */
  slot: number;
}

/** Xếp sổ vào hai cột theo đáp án đúng, mới nhất đứng đầu mỗi cột. */
export function logColumns(log: readonly LogEntry[]): Record<RuleGateAnswer, LogSlot[]> {
  const columns: Record<RuleGateAnswer, LogSlot[]> = { in: [], out: [] };
  for (let k = log.length - 1; k >= 0; k--) {
    const entry = log[k] as LogEntry;
    const column = columns[entry.side];
    column.push({ entry, slot: column.length });
  }
  return columns;
}

// ─── Gợi ý Siêu khó ─────────────────────────────────────────────────────────────────────────────

/** Sai liền bấy nhiêu câu thì lật vé cho xem luật (hệ số 2,4 đã tính có gợi ý này). */
export const HINT_AFTER_MISSES = 2;

/** Đếm sai liền: về 0 sau câu đúng và sau mỗi lần gợi ý. */
export function afterAnswer(streak: number, correct: boolean): { streak: number; hint: boolean } {
  if (correct) return { streak: 0, hint: false };
  const next = streak + 1;
  return next >= HINT_AFTER_MISSES ? { streak: 0, hint: true } : { streak: next, hint: false };
}

// ─── Vé ─────────────────────────────────────────────────────────────────────────────────────────

/** Khoá so sánh luật đang vẽ trên bảng với luật của câu mới. */
export function ruleKey(rule: RuleGateRule): string {
  return `${rule.op}:${rule.terms.map((t) => `${t.negated ? "!" : ""}${t.feature}`).join(",")}`;
}

export interface TicketSlot {
  /** Tâm ngang và bề rộng của vé (px khung). */
  cx: number;
  w: number;
  /** Biểu tượng trên vé: tâm ngang và chỉ số vế trong `rule.terms`. */
  icons: { x: number; term: 0 | 1 }[];
}

export interface TicketLayout {
  tickets: TicketSlot[];
  /** "+" giữa hai biểu tượng chung một vé (VÀ), "/" giữa hai vé riêng (HOẶC). */
  joiner?: { kind: "plus" | "slash"; x: number };
}

export const TICKET_SINGLE_W = 210;
export const TICKET_AND_W = 400;
export const TICKET_OR_W = 176;
/** Khoảng từ tâm cụm vé tới tâm mỗi biểu tượng (VÀ) / mỗi vé (HOẶC). */
const AND_SPREAD = 100;
const OR_SPREAD = 112;

/**
 * Bố cục vé theo đặc tả: một vế = một vé một biểu tượng; VÀ = một vé hai biểu tượng nối "+";
 * HOẶC = hai vé riêng cạnh nhau, giữa có "/".
 */
export function ticketLayout(
  rule: RuleGateRule,
  center: number,
  singleWidth = TICKET_SINGLE_W,
): TicketLayout {
  if (rule.op === "single") {
    return { tickets: [{ cx: center, w: singleWidth, icons: [{ x: center, term: 0 }] }] };
  }
  if (rule.op === "and") {
    return {
      tickets: [
        {
          cx: center,
          w: TICKET_AND_W,
          icons: [
            { x: center - AND_SPREAD, term: 0 },
            { x: center + AND_SPREAD, term: 1 },
          ],
        },
      ],
      joiner: { kind: "plus", x: center },
    };
  }
  const left = center - OR_SPREAD;
  const right = center + OR_SPREAD;
  return {
    tickets: [
      { cx: left, w: TICKET_OR_W, icons: [{ x: left, term: 0 }] },
      { cx: right, w: TICKET_OR_W, icons: [{ x: right, term: 1 }] },
    ],
    joiner: { kind: "slash", x: center },
  };
}
