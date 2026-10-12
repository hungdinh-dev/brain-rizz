import { CATEGORIES, type Category } from "@brain-rizz/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const DOT: Record<Category, string> = {
  identify: "bg-identify",
  memorize: "bg-memorize",
  analyze: "bg-analyze",
  compute: "bg-compute",
  visualize: "bg-visualize",
};

/** 5 nhóm kỹ năng dạng nhãn phấn — giới thiệu nhanh nội dung game. */
export function SkillChips({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ul className={cn("flex flex-wrap justify-center gap-1.5 md:gap-2", className)}>
      {CATEGORIES.map((c) => (
        <li
          key={c}
          className="flex items-center gap-1.5 rounded-full bg-board-shade px-3 py-1 text-[13px] font-semibold text-chalk md:text-sm"
        >
          <span aria-hidden className={cn("size-2.5 rounded-full ring-2 ring-chalk/60", DOT[c])} />
          {t(`category.${c}`)}
        </li>
      ))}
    </ul>
  );
}
