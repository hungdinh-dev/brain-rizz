import { type Route, useNav } from "@/stores/nav.store";
import type { PetGoal } from "./unlock-text";

/** Màn giúp đạt điều kiện của một thú khoá (bản đồ URL CR-022, practice-favorites-howto-routes 3.4). */
export function petGoalRoute(goal: PetGoal): Route {
  switch (goal.kind) {
    case "brain":
      return { screen: "brain-test" };
    case "party":
      return { screen: "menu" };
    case "practice":
      // Một game: `/practice/<game>?d=<mức tối thiểu>` — màn hướng dẫn chọn sẵn mức đó lần này,
      // không ghi gì vào kỷ lục / "mức lần trước" (Mầm = không cần mức, bỏ `?d=`).
      if (goal.gameId) {
        return goal.minDifficulty > 0
          ? { screen: "practice", gameId: goal.gameId, level: goal.minDifficulty }
          : { screen: "practice", gameId: goal.gameId };
      }
      // Trung bình một nhóm: `/practice?cat=<nhóm>` — lưới chọn game lọc sẵn nhóm đó.
      return goal.category ? { screen: "practice", filter: goal.category } : { screen: "practice" };
  }
}

/**
 * Nút "Luyện ngay" / "Chơi party" / "Kiểm tra não" của thú khoá: đi tới `/practice/<game>?d=…`,
 * `/practice?cat=…`, `/brain-test`, hoặc menu (tạo phòng / chơi với máy). Chỉ đổi URL, không ghi gì.
 */
export function openPetGoal(goal: PetGoal) {
  useNav.getState().go(petGoalRoute(goal));
}
