import { GAMES, type GameId } from "@brain-rizz/shared";
import { Component, type ReactNode, Suspense } from "react";
import { CATEGORY_ICON } from "@/components/common/MatchChips";
import { DemoStill } from "@/games/_shared/demo/DemoStage";
import { GAME_CLIENTS } from "@/games/registry";
import type { DemoProps } from "@/games/types";
import { cn } from "@/lib/utils";

/** Tải `Demo` lỗi (mất mạng giữa chừng…): giữ hình tĩnh, không làm hỏng cả màn. */
class DemoBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Hình minh hoạ của màn Hướng dẫn: `Demo` (động, tải lười) nếu game có; đang tải, lỗi hoặc chưa có
 * `Demo` thì `Illustration` tĩnh trong cùng khung (không vòng xoay, không nhảy bố cục); chưa có cả
 * `Illustration` thì biểu tượng nhóm kỹ năng.
 */
export function GameDemo({ gameId, className, ...demo }: DemoProps & { gameId: GameId }) {
  const { Demo, Illustration } = GAME_CLIENTS[gameId];
  const CategoryIcon = CATEGORY_ICON[GAMES[gameId].category];
  const still = Illustration ? (
    <DemoStill still={Illustration} className={className} />
  ) : (
    <div className={cn("grid place-items-center", className)}>
      <CategoryIcon aria-hidden className="size-1/2 text-chalk" strokeWidth={2.2} />
    </div>
  );
  if (!Demo) return still;
  return (
    <DemoBoundary fallback={still}>
      <Suspense fallback={still}>
        <Demo className={className} {...demo} />
      </Suspense>
    </DemoBoundary>
  );
}
