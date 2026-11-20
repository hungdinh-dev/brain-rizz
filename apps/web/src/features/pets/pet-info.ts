import { type PetId, UNLOCK_RULES, type UnlockProgress, unlockRatio } from "@brain-rizz/shared";
import {
  type PartLine,
  type PetGoal,
  partLines,
  petGoal,
  progressHint,
  progressLabel,
  ruleCondition,
  ruleSentence,
  type UnlockTextDeps,
} from "./unlock-text";

/** Mọi chữ + số của một thú khoá để vẽ thẻ / sheet / hộp chúc mừng. */
export interface PetInfo {
  id: PetId;
  name: string;
  species: string;
  /** Điều kiện đủ câu có dấu chấm. */
  sentence: string;
  /** Điều kiện viết hoa đầu, không dấu chấm ("Đã đạt: …"). */
  condition: string;
  /** `null` = chưa có số liệu. */
  progress: UnlockProgress | null;
  /** 0…1 cho thanh tiến độ (0 khi chưa có số liệu). */
  ratio: number;
  /** "3/10 trận" hoặc "Chưa có dữ liệu". */
  label: string;
  hint: string | null;
  parts: PartLine[];
  goal: PetGoal;
  cta: string;
}

export function petInfo(
  pet: PetId,
  progress: UnlockProgress | null,
  deps: UnlockTextDeps,
): PetInfo {
  const { t } = deps;
  const rule = UNLOCK_RULES[pet];
  const goal = petGoal(rule);
  return {
    id: pet,
    name: t(`characters.${pet}.name`),
    species: t(`characters.${pet}.species`),
    sentence: ruleSentence(rule, deps),
    condition: ruleCondition(rule, deps),
    progress,
    ratio: progress ? unlockRatio(progress) : 0,
    label: progress ? progressLabel(rule, progress, deps) : t("pets.noData"),
    hint: progress ? progressHint(rule, progress, deps) : t("pets.noDataHint"),
    parts: progress ? partLines(rule, progress, deps) : [],
    goal,
    cta: t(`pets.cta.${goal.kind}`),
  };
}
