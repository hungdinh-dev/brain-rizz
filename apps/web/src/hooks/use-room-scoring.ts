import { parseScoringJson, type ScoringConfig } from "@brain-rizz/shared";
import { useMemo } from "react";
import { useGame } from "@/stores/game.store";

/**
 * Công thức điểm của trận party đang chơi (CR-019): server gửi `scoringJson` trong state, admin
 * chỉnh được. Chỉ để hiển thị (hệ số độ khó, điểm thứ hạng, combo) — điểm vẫn do server tính.
 * Ngoài phòng hoặc JSON hỏng → công thức chuẩn.
 */
export function useRoomScoring(): ScoringConfig {
  const json = useGame((s) => s.party?.scoringJson ?? "");
  return useMemo(() => parseScoringJson(json), [json]);
}
