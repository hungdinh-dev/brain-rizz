import type { GameId } from "@brain-rizz/shared";
import { useEffect, useRef } from "react";
import { SCENES } from "./registry";
import { DESIGN_HEIGHT, DESIGN_WIDTH, type MinigameBridge } from "./types";

/**
 * Gắn một game Phaser vào DOM và huỷ hẳn khi rời màn hình.
 * Quy tắc hiệu năng: mỗi lúc chỉ có MỘT canvas WebGL (lobby 3D đã bị gỡ khi vào đây).
 */
export function PhaserHost({ gameId, bridge }: { gameId: GameId; bridge: MinigameBridge }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;

    void (async () => {
      const [{ default: Phaser }, { default: SceneClass }] = await Promise.all([
        import("phaser"),
        SCENES[gameId](),
      ]);
      if (cancelled || !ref.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: ref.current,
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transparent: true,
        banner: false,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        // Giới hạn độ phân giải để máy yếu vẫn mượt.
        render: { antialias: true, powerPreference: "high-performance" },
      });
      game.scene.add(gameId, SceneClass, true, { bridge });
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [gameId, bridge]);

  return <div ref={ref} className="absolute inset-0" />;
}
