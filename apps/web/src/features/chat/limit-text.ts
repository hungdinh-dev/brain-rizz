/**
 * Giới hạn bản nháp chat theo số code point (cùng cách đếm với bộ đếm và server), không cắt đôi
 * emoji: `maxLength` của `<input>` đếm UTF-16 nên emoji tính 2 và có thể bị cắt giữa cặp surrogate.
 * Có `Intl.Segmenter` thì cắt theo cụm ký tự (emoji ghép bằng ZWJ, dấu tổ hợp giữ nguyên cụm);
 * không có thì cắt theo code point.
 */
export function limitChatText(text: string, max: number): string {
  const points = Array.from(text);
  if (points.length <= max) return text;
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    // Fallback cho trình duyệt chưa có Intl.Segmenter (Firefox < 125, Safari < 14.1, Chrome < 87):
    // cắt theo code point nên có thể tách cụm ZWJ (emoji ghép còn dở dang ở cuối), nhưng không
    // bao giờ để lại nửa cặp surrogate. Chấp nhận được: hiếm gặp, chỉ ảnh hưởng cụm cuối.
    return points.slice(0, max).join("");
  }
  let out = "";
  let count = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    const size = Array.from(segment).length;
    if (count + size > max) break;
    out += segment;
    count += size;
  }
  return out;
}
