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
}

/** Hộp "Bỏ lượt này?" (khu 17): nút Chơi tiếp được focus trước. */
export function QuitDialog({ open, onOpenChange, description, onConfirm }: QuitDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.quitTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.keepPlaying")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" data-sfx="back" onClick={onConfirm}>
            {t("common.quitConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
