import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuitDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Câu giải thích (Luyện tập: không tính kỷ lục; Kiểm tra não: huỷ, không lưu). */
  description: string;
  onConfirm(): void;
  /** Tiêu đề và nhãn hai nút; mặc định "Bỏ lượt này?" / "Chơi tiếp" / "Bỏ lượt". */
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}

/** Hộp "Bỏ lượt này?" (khu 17), cũng dùng cho "Rời phòng?" khi bấm Back trong phòng: nút ở lại được focus trước. */
export function QuitDialog({
  open,
  onOpenChange,
  description,
  onConfirm,
  title,
  cancelLabel,
  confirmLabel,
}: QuitDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("common.quitTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? t("common.keepPlaying")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" data-sfx="back" onClick={onConfirm}>
            {confirmLabel ?? t("common.quitConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
