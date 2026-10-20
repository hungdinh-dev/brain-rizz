/**
 * Lọc từ tục trong tin chat (CR-011): hàm thuần, server gọi trước khi phát tin.
 *
 * Cách so khớp:
 *  - Chuẩn hoá NFC, viết thường, đổi leet cơ bản (0→o, 1→i, 3→e, 4→a, @→a, $→s).
 *  - Hai danh sách: `ACCENTED_WORDS` so khớp CÓ dấu (bỏ dấu sẽ trùng từ thường: cặc/các, lồn/lon,
 *    buồi/buổi, đĩ/đi…); `PLAIN_WORDS` so khớp sau khi bỏ dấu (đ→d) vì không nhập nhằng.
 *  - Bỏ ký tự lách giữa các chữ: `. _ - *` nối hai mảnh thành một từ ("đ.m", "f-u-c-k");
 *    khoảng trắng chỉ nối khi hai bên đều là chữ đơn ("f u c k", "đ m"), để "đc m" không thành "dcm".
 *  - Khớp NGUYÊN từ (không khớp giữa từ) để tránh dương tính giả kiểu Scunthorpe: "class",
 *    "assess", "cocktail" không bị che. Mục có đuôi `*` khớp mọi từ bắt đầu bằng gốc đó.
 *  - Đoạn bị che (kể cả dấu lách ở giữa) được thay bằng `***` ngay trên chuỗi gốc.
 */

export const PROFANITY_MASK = "***";

/** Chỉ khớp khi viết đúng dấu. Cụm nhiều từ khớp cả khi viết liền hoặc cách bằng khoảng trắng. */
const ACCENTED_WORDS = [
  "cặc",
  "lồn",
  "lìn",
  "buồi",
  "đéo",
  "địt",
  "đụ",
  "đĩ",
  "cứt",
  "nứng",
  "đù má",
  "chó đẻ",
  "mả mẹ",
];

/** Khớp sau khi bỏ dấu (viết tắt tiếng Việt, tiếng Anh). */
const PLAIN_WORDS = [
  // Tiếng Việt viết tắt / không dấu.
  "vcl",
  "vkl",
  "vl",
  "vcc",
  "dm",
  "dmm",
  "dcm",
  "dkm",
  "clm",
  "cmm",
  "loz",
  "dit me",
  "dit con me",
  // Tiếng Anh.
  "fuck*",
  "motherfuck*",
  "fck",
  "shit",
  "shits",
  "shitty",
  "bullshit",
  "bitch",
  "bitches",
  "ass",
  "asshole",
  "assholes",
  "cunt",
  "cunts",
  "dick",
  "dicks",
  "pussy",
  "bastard",
  "bastards",
  "slut",
  "sluts",
  "whore",
  "whores",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "wtf",
  "stfu",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s" };

/** Ký tự tạo nên từ (gồm cả ký tự leet). */
const LETTER = /^[\p{L}\p{N}@$]$/u;
/** Dấu kết hợp / ký tự định dạng vô hình (ZWJ, zero-width…): bỏ qua, không cắt từ. */
const IGNORABLE = /^[\p{M}\p{Cf}]$/u;
/** Ký tự lách nối hai mảnh chữ thành một từ. */
const JOINER = /^[._\-*]$/u;
const SPACE = /^\s$/u;

/** Bỏ dấu tiếng Việt: NFD rồi xoá dấu kết hợp, đ → d. */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

interface Pattern {
  /** Các từ của mục, đã chuẩn hoá theo đúng dạng so khớp. */
  tokens: string[];
  /** Từ cuối chỉ cần là tiền tố. */
  prefix: boolean;
  /** So với dạng có dấu (true) hay dạng bỏ dấu (false). */
  accented: boolean;
}

function compile(entries: readonly string[], accented: boolean): Pattern[] {
  const out: Pattern[] = [];
  for (const entry of entries) {
    const prefix = entry.endsWith("*");
    const base = entry.replace(/\*$/, "").normalize("NFC").toLowerCase().trim();
    const tokens = base.split(/\s+/).map((t) => (accented ? t : stripAccents(t)));
    out.push({ tokens, prefix, accented });
    // Cụm nhiều từ viết liền ("chóđẻ", "ditme") cũng bị che.
    if (tokens.length > 1) out.push({ tokens: [tokens.join("")], prefix, accented });
  }
  return out;
}

const PATTERNS: Pattern[] = [...compile(ACCENTED_WORDS, true), ...compile(PLAIN_WORDS, false)];

/** Một mảnh chữ liền nhau trong chuỗi gốc. */
interface Piece {
  start: number;
  end: number;
  /** Dạng có dấu (viết thường + leet). */
  acc: string;
  /** Dạng bỏ dấu (viết thường + leet + bỏ dấu). */
  plain: string;
  /** Số ký tự chữ. */
  letters: number;
}

/** Thứ ngăn giữa hai mảnh: chỉ ký tự lách, có khoảng trắng, hoặc có ký tự khác (ranh giới cứng). */
type Gap = "join" | "space" | "hard";

interface Word {
  start: number;
  end: number;
  acc: string;
  plain: string;
  /** Cách từ trước chỉ bằng khoảng trắng (được ghép vào cụm nhiều từ). */
  linked: boolean;
}

function splitPieces(text: string): { pieces: Piece[]; gaps: Gap[] } {
  const pieces: Piece[] = [];
  /** gaps[k] là thứ ngăn giữa pieces[k] và pieces[k + 1]. */
  const gaps: Gap[] = [];
  let cur: Piece | null = null;
  let gap: Gap = "join";
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 0);
    const next = i + ch.length;
    if (LETTER.test(ch)) {
      if (!cur) {
        if (pieces.length > 0) gaps.push(gap);
        cur = { start: i, end: next, acc: "", plain: "", letters: 0 };
      }
      const lower = ch.toLowerCase();
      cur.acc += LEET[lower] ?? lower;
      cur.plain += LEET[lower] ?? stripAccents(lower);
      cur.letters += 1;
      cur.end = next;
    } else if (!IGNORABLE.test(ch)) {
      if (cur) {
        pieces.push(cur);
        cur = null;
        gap = "join";
      }
      if (SPACE.test(ch)) {
        if (gap === "join") gap = "space";
      } else if (!JOINER.test(ch)) {
        gap = "hard";
      }
    }
    i = next;
  }
  if (cur) pieces.push(cur);
  return { pieces, gaps };
}

function toWords(text: string): Word[] {
  const { pieces, gaps } = splitPieces(text);
  const words: Word[] = [];
  for (const [k, p] of pieces.entries()) {
    const gap = k === 0 ? "hard" : (gaps[k - 1] ?? "hard");
    const prev = pieces[k - 1];
    const last = words.at(-1);
    const glue =
      gap === "join" ||
      (gap === "space" && p.letters === 1 && prev !== undefined && prev.letters === 1);
    if (last && glue) {
      last.acc += p.acc;
      last.plain += p.plain;
      last.end = p.end;
    } else {
      words.push({
        start: p.start,
        end: p.end,
        acc: p.acc,
        plain: p.plain,
        linked: gap === "space",
      });
    }
  }
  return words;
}

/** Chỉ số từ cuối của mục tục dài nhất bắt đầu ở từ `i`, hoặc -1. */
function matchAt(words: Word[], i: number): number {
  let best = -1;
  for (const pat of PATTERNS) {
    const end = i + pat.tokens.length - 1;
    if (end >= words.length || end <= best) continue;
    const ok = pat.tokens.every((token, t) => {
      const w = words[i + t];
      if (!w || (t > 0 && !w.linked)) return false;
      const form = pat.accented ? w.acc : w.plain;
      return pat.prefix && t === pat.tokens.length - 1 ? form.startsWith(token) : form === token;
    });
    if (ok) best = end;
  }
  return best;
}

/**
 * Thay mọi đoạn tục trong `text` bằng `***`. Trả chuỗi đã chuẩn hoá NFC
 * (không có từ tục thì nội dung giữ nguyên).
 */
export function filterProfanity(text: string): string {
  const src = text.normalize("NFC");
  const words = toWords(src);
  const ranges: [number, number][] = [];
  for (let i = 0; i < words.length; ) {
    const end = matchAt(words, i);
    const first = words[i];
    const last = words[end];
    if (end >= 0 && first && last) {
      ranges.push([first.start, last.end]);
      i = end + 1;
    } else {
      i += 1;
    }
  }
  if (ranges.length === 0) return src;
  let out = "";
  let pos = 0;
  for (const [start, end] of ranges) {
    out += src.slice(pos, start) + PROFANITY_MASK;
    pos = end;
  }
  return out + src.slice(pos);
}

/** Có đoạn tục nào trong `text` không. */
export function hasProfanity(text: string): boolean {
  return filterProfanity(text) !== text.normalize("NFC");
}
