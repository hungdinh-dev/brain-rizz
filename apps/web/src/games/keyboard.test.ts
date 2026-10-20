import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasOpenModal, isTyping, OPEN_MODAL_SELECTOR, shouldIgnoreGameKey } from "./keyboard";

/** `root` giả: chỉ trả phần tử khi đúng bộ chọn hộp thoại đang mở. */
const rootWith = (open: boolean) => ({
  querySelector: (selector: string) =>
    open && selector === OPEN_MODAL_SELECTOR ? ({} as Element) : null,
});

describe("hasOpenModal", () => {
  it("có hộp thoại / sheet đang mở: true", () => {
    expect(hasOpenModal(rootWith(true))).toBe(true);
  });

  it("không có hộp thoại nào mở: false", () => {
    expect(hasOpenModal(rootWith(false))).toBe(false);
  });

  it("bộ chọn bắt cả Dialog/Sheet lẫn AlertDialog, chỉ khi data-state=open", () => {
    expect(OPEN_MODAL_SELECTOR).toContain('[role="dialog"][data-state="open"]');
    expect(OPEN_MODAL_SELECTOR).toContain('[role="alertdialog"][data-state="open"]');
  });
});

describe("isTyping / shouldIgnoreGameKey — bổ sung (QA)", () => {
  // Test chạy trên node: dựng lớp DOM giả đủ cho `instanceof` và `document`.
  class FakeElement {
    isContentEditable = false;
  }
  class FakeInput extends FakeElement {}
  class FakeTextArea extends FakeElement {}
  class FakeSelect extends FakeElement {}
  let active: FakeElement | null = null;
  const el = (e: FakeElement) => e as unknown as EventTarget;
  let modalOpen = false;

  beforeEach(() => {
    active = null;
    modalOpen = false;
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
    vi.stubGlobal("HTMLSelectElement", FakeSelect);
    vi.stubGlobal("document", {
      get activeElement() {
        return active;
      },
      querySelector: (selector: string) =>
        modalOpen && selector === OPEN_MODAL_SELECTOR ? {} : null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const key = (init: Partial<KeyboardEvent> = {}) =>
    ({
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: new FakeElement(),
      ...init,
    }) as unknown as KeyboardEvent;

  it("phím thường trên game, không gõ chữ, không hộp thoại: không bỏ qua", () => {
    expect(shouldIgnoreGameKey(key())).toBe(false);
  });

  it("có Ctrl / Alt / Meta: bỏ qua (không nuốt phím tắt trình duyệt)", () => {
    expect(shouldIgnoreGameKey(key({ ctrlKey: true }))).toBe(true);
    expect(shouldIgnoreGameKey(key({ altKey: true }))).toBe(true);
    expect(shouldIgnoreGameKey(key({ metaKey: true }))).toBe(true);
  });

  it("đang gõ trong input / textarea / select / contentEditable: bỏ qua", () => {
    expect(isTyping(el(new FakeInput()))).toBe(true);
    expect(isTyping(el(new FakeTextArea()))).toBe(true);
    expect(isTyping(el(new FakeSelect()))).toBe(true);
    const editable = new FakeElement();
    editable.isContentEditable = true;
    expect(isTyping(el(editable))).toBe(true);
    expect(shouldIgnoreGameKey(key({ target: new FakeInput() as unknown as EventTarget }))).toBe(
      true,
    );
  });

  it("phím bắn từ window nhưng focus đang ở ô chữ (activeElement): bỏ qua", () => {
    active = new FakeTextArea();
    expect(isTyping(null)).toBe(true);
    expect(shouldIgnoreGameKey(key({ target: null }))).toBe(true);
  });

  it("target không phải phần tử (window) và không focus ô chữ: không phải đang gõ", () => {
    expect(isTyping({} as EventTarget)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });

  it("đang mở hộp thoại / sheet: bỏ qua; đóng rồi thì phím chạy lại", () => {
    modalOpen = true;
    expect(shouldIgnoreGameKey(key())).toBe(true);
    modalOpen = false;
    expect(shouldIgnoreGameKey(key())).toBe(false);
  });
});
