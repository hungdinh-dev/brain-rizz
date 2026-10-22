import { type KeyboardEvent, useEffect, useRef } from "react";

/**
 * Bảng chọn mở ngay trong một ô ở phòng chờ (thêm bot, đổi mức bot; CR-016, ui-ux 6.6):
 * - mở thì focus vào `focusRef` (ô chọn mặc định);
 * - Esc hoặc nút × (`close`) thì đóng và trả focus về `triggerRef` (ô / nhãn mức vừa bấm);
 * - bấm ra ngoài ô thì đóng, không kéo focus về.
 * Mỗi lúc chỉ một ô mở: trạng thái mở nằm ở LobbyScreen.
 */
export function useInlinePanel(open: boolean, onOpenChange: (open: boolean) => void) {
  const panelRef = useRef<HTMLFieldSetElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (open) {
      focusRef.current?.focus();
      return;
    }
    if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && !panel.contains(e.target)) {
        onOpenChangeRef.current(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    restoreFocus.current = true;
    onOpenChangeRef.current(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  }

  return { panelRef, triggerRef, focusRef, close, onKeyDown };
}
