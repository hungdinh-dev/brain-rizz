/**
 * Lọc phím cho scene bắt phím trên `window` (vd. Phấn trượt): không trả lời câu khi người chơi
 * đang gõ chữ hoặc đang mở hộp thoại / sheet đè lên game (hộp Thoát, sheet chat…).
 */

/** Hộp thoại Radix đang mở (Dialog, Sheet, AlertDialog đều gắn `role` + `data-state` này). */
export const OPEN_MODAL_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/** Có hộp thoại / sheet nào đang mở trong `root` không. Nhận `root` để test không cần DOM thật. */
export function hasOpenModal(root: Pick<ParentNode, "querySelector"> = document): boolean {
  return root.querySelector(OPEN_MODAL_SELECTOR) !== null;
}

/** Đang gõ chữ (ô chat, ô nhập tên…): không bắt phím để không nuốt chữ. */
export function isTyping(target: EventTarget | null): boolean {
  for (const el of [target, document.activeElement]) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLSelectElement) return true;
  }
  return false;
}

/** Scene nên bỏ qua phím này: có phím bổ trợ, đang gõ chữ, hoặc đang mở hộp thoại. */
export function shouldIgnoreGameKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  return isTyping(event.target) || hasOpenModal();
}
