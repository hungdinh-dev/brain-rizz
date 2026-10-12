import type { GameId } from "@brain-rizz/shared";
import { useEffect, useRef } from "react";
import { GAME_CLIENTS } from "./registry";
import { DESIGN_HEIGHT, DESIGN_WIDTH, type MinigameBridge } from "./types";

export type SceneStatus = "loading" | "ready" | "error";

/**
 * Tải trước Phaser + scene của game (vd. trong lúc đếm ngược) để vào vòng là chơi được ngay.
 * Chỉ làm ấm bộ nhớ đệm, không tạo canvas; lỗi mạng thì bỏ qua — PhaserHost sẽ tự báo lỗi.
 */
export function preloadGame(gameId: GameId) {
  Promise.all([import("phaser"), GAME_CLIENTS[gameId].scene()]).catch(() => {});
}

interface PhaserHostProps {
  gameId: GameId;
  bridge: MinigameBridge;
  /** Báo khi scene đã chạy hoặc tải lỗi (vd. rớt mạng lúc tải chunk) để khung chơi hiện đúng trạng thái. */
  onStatus?(status: SceneStatus): void;
}

/**
 * Gắn một game Phaser vào DOM và huỷ hẳn khi rời màn hình.
 * Quy tắc hiệu năng: mỗi lúc chỉ có MỘT canvas WebGL — hiện chỉ Phaser dùng WebGL (ADR 0010).
 */
export function PhaserHost({ gameId, bridge, onStatus }: PhaserHostProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Giữ callback mới nhất mà không phải dựng lại game khi component cha render lại.
  const statusRef = useRef(onStatus);
  useEffect(() => {
    statusRef.current = onStatus;
  });

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;
    statusRef.current?.("loading");

    const load = () => Promise.all([import("phaser"), GAME_CLIENTS[gameId].scene()]);

    void (async () => {
      let modules: Awaited<ReturnType<typeof load>>;
      try {
        modules = await load();
      } catch {
        if (!cancelled) statusRef.current?.("error");
        return;
      }
      if (cancelled || !ref.current) return;
      const [{ default: Phaser }, { default: SceneClass }] = modules;

      const instance = new Phaser.Game({
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
      instance.scene.add(gameId, SceneClass, true, { bridge });
      game = instance;
      statusRef.current?.("ready");
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [gameId, bridge]);

  return <div ref={ref} className="absolute inset-0" />;
}
