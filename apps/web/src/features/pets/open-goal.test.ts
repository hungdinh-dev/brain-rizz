import { UNLOCK_RULES } from "@brain-rizz/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pathForScreen } from "@/stores/nav.store";
import { openPetGoal, petGoalRoute } from "./open-goal";
import { petGoal } from "./unlock-text";

/**
 * Nút "Luyện ngay" / "Chơi party" / "Kiểm tra não" của thú khoá (ui-ux 6.12): đi đúng màn theo URL
 * CR-022. Mức tối thiểu và nhóm nằm trên URL (`?d=`, `?cat=`), không ghi gì vào kỷ lục trên máy.
 */

const { go } = vi.hoisted(() => ({ go: vi.fn() }));
vi.mock("@/stores/nav.store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/nav.store")>()),
  useNav: { getState: () => ({ go }) },
}));

beforeEach(() => {
  go.mockClear();
});

describe("đi tới màn giúp mở thú", () => {
  it("Kiểm tra não → /brain-test; điều kiện party → menu", () => {
    openPetGoal(petGoal(UNLOCK_RULES.may));
    expect(go).toHaveBeenLastCalledWith({ screen: "brain-test" });
    openPetGoal(petGoal(UNLOCK_RULES.pin));
    expect(go).toHaveBeenLastCalledWith({ screen: "menu" });
    openPetGoal(petGoal(UNLOCK_RULES.lua));
    expect(go).toHaveBeenLastCalledWith({ screen: "menu" });
  });

  it("Ộp: mở /practice/<game>?d=<mức tối thiểu>, không đụng kỷ lục trên máy", () => {
    const rule = UNLOCK_RULES.op;
    if (rule.kind !== "practice-best") throw new Error("luật Ộp đổi loại: sửa test");
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    try {
      openPetGoal(petGoal(rule));
    } finally {
      vi.unstubAllGlobals();
    }
    const route = { screen: "practice", gameId: rule.game, level: rule.minDifficulty };
    expect(go).toHaveBeenLastCalledWith(route);
    expect(pathForScreen(petGoalRoute(petGoal(rule)))).toBe(
      `/practice/${rule.game}?d=${rule.minDifficulty}`,
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("không có mức tối thiểu (Mầm) → mở game, không kèm ?d=", () => {
    openPetGoal({ kind: "practice", gameId: "balance", minDifficulty: 0 });
    expect(go).toHaveBeenLastCalledWith({ screen: "practice", gameId: "balance" });
  });

  it("Thông: mở /practice?cat=<nhóm> lọc sẵn nhóm của luật", () => {
    const rule = UNLOCK_RULES.thong;
    if (rule.kind !== "practice-category-avg") throw new Error("luật Thông đổi loại: sửa test");
    openPetGoal(petGoal(rule));
    expect(go).toHaveBeenLastCalledWith({ screen: "practice", filter: rule.category });
    expect(pathForScreen(petGoalRoute(petGoal(rule)))).toBe(`/practice?cat=${rule.category}`);
  });

  it("luyện tập không rõ game / nhóm → lưới Luyện tập", () => {
    openPetGoal({ kind: "practice", minDifficulty: 0 });
    expect(go).toHaveBeenLastCalledWith({ screen: "practice" });
  });
});
