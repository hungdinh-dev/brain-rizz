import { useEffect } from "react";
import { unlockAudio } from "@/lib/audio-context";
import { useGame } from "@/stores/game.store";
import { resolveSfxKind, type SfxKind } from "./kinds";
import { playSfx, preloadSfx } from "./player";
import { useSfx } from "./sfx.store";

/** Phần tử bấm được có tiếng (đặt `data-sfx` lên chính phần tử đó để đổi tiếng). */
const CLICKABLE =
  "button, a[href], [role=button], [role=switch], [role=tab], [role=radio], [data-sfx]";

/** Sự kiện được trình duyệt tính là thao tác người dùng (mở khoá âm thanh) trên cả chuột lẫn chạm. */
const UNLOCK_EVENTS = ["pointerup", "keydown"] as const;

function kindForClick(target: EventTarget | null): SfxKind | null {
  if (!(target instanceof Element)) return null;
  // Bấm trong canvas Phaser: tiếng do kết quả câu trả lời lo (correct/wrong).
  if (target.closest("canvas")) return null;
  const el = target.closest(CLICKABLE);
  if (!el) return null;
  return resolveSfxKind({
    attr: el.getAttribute("data-sfx"),
    role: el.getAttribute("role"),
    pressed: el.hasAttribute("aria-pressed"),
    disabled: el.matches(":disabled") || el.getAttribute("aria-disabled") === "true",
  });
}

/**
 * Gắn một lần ở App:
 * - mọi cú bấm nút (một listener uỷ quyền trên document, không phải sửa từng nút) → click/toggle/confirm/back;
 * - lỗi server báo về (toast theo mã lỗi, FR-GD-09) → error;
 * - kết quả câu trả lời của chính mình (`answerResult`) → correct/wrong.
 * Tiếng đếm ngược do CountdownScreen gọi `playSfx("tick")`.
 */
export function useSfxEffects() {
  useEffect(() => {
    const unlock = () => {
      if (!useSfx.getState().enabled) return;
      // Mở khoá lần đầu → tải trước file sfx (các lần sau preloadSfx không làm gì).
      void unlockAudio().then((ok) => {
        if (ok) preloadSfx();
      });
    };
    // Bubble trên document → chạy sau handler React của nút (vd. vừa bật âm thanh thì kêu luôn).
    const onClick = (e: MouseEvent) => {
      if (!useSfx.getState().enabled) return;
      const kind = kindForClick(e.target);
      if (!kind) return;
      // Cú bấm là thao tác người dùng: mở khoá (nếu cần) rồi mới phát.
      void unlockAudio().then((ok) => {
        if (ok) playSfx(kind);
      });
    };
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
    document.addEventListener("click", onClick);

    const unsubscribe = useGame.subscribe((s, prev) => {
      if (s.errorSeq > prev.errorSeq) playSfx("error");
      if (s.lastAnswer && s.lastAnswer !== prev.lastAnswer) {
        playSfx(s.lastAnswer.correct ? "correct" : "wrong");
      }
    });

    return () => {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
      document.removeEventListener("click", onClick);
      unsubscribe();
    };
  }, []);
}
