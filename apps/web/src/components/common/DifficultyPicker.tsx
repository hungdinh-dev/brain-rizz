import { DIFFICULTIES, type Difficulty, isDifficulty } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DifficultyPickerProps {
  value: Difficulty;
  onChange(value: Difficulty): void;
  "aria-label"?: string;
}

/** Chọn 1 trong 4 mức độ khó (dùng ở trang chủ và sảnh). */
export function DifficultyPicker({ value, onChange, ...props }: DifficultyPickerProps) {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={String(value)}
      // Bấm lại mục đang chọn sẽ ra "" — bỏ qua để luôn có một mức được chọn.
      onValueChange={(v) => {
        const d = Number(v);
        if (v && isDifficulty(d)) onChange(d);
      }}
      className="grid w-full grid-cols-4"
      aria-label={props["aria-label"]}
    >
      {DIFFICULTIES.map((d) => (
        <ToggleGroupItem key={d} value={String(d)} className="px-2">
          {t(`difficulty.${d}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
