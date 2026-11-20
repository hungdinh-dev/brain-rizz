import {
  type AnimationEvent,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useReducedMotion } from "@/features/motion";
import { cn } from "@/lib/utils";
import type { DemoProps } from "../../types";
import { type DemoScript, scriptCss } from "./timeline";

/*
 * Luật chung của khung diễn: một đồng hồ (mọi `.dk` cùng thời lượng T, bắt đầu cùng lúc khi gắn
 * vào DOM), linear giữa các khung (đường cong ghi trong từng khung), giữ khung cuối khi hết vòng.
 * Vật SVG xoay/phóng quanh gốc 0,0 của chính nó (`transform-box: view-box; transform-origin: 0 0`).
 * Dừng = `animation-play-state: paused` trên gốc (`data-paused`).
 */
const BASE_CSS = [
  ".demo .dk{animation-timing-function:linear;animation-iteration-count:var(--demo-loops,infinite);animation-fill-mode:both;transform-box:view-box;transform-origin:0 0}",
  ".demo[data-paused] .dk{animation-play-state:paused}",
].join("\n");

/** Tab đang hiện (`visibilitychange`). */
function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

/** Phần tử còn trên màn (IntersectionObserver, ngưỡng 0). */
function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

interface DemoStageProps extends DemoProps {
  script: DemoScript;
  /** Khung tĩnh: `Illustration` sẵn có của game (giảm chuyển động, hết vòng). */
  still: ComponentType<{ className?: string }>;
  /** Lớp tĩnh: lưới, khung, đế cân… Được dùng filter phấn `#chalk`, không bao giờ chuyển động. */
  backdrop?: ReactNode;
  /** Lớp động: mọi thứ có keyframe (lớp `dk dk-<làn>`), nét trơn, KHÔNG filter. */
  children: ReactNode;
}

/**
 * Sân khấu 640 × 360 của khung diễn (UI-UX 6.11): ba lớp (div mờ vào/ra · SVG tĩnh · SVG động),
 * co giữa khung cha (`preserveAspectRatio` meet). Dừng khi `playing = false`, tab ẩn hoặc ra khỏi
 * màn; giảm chuyển động hoặc chạy đủ `loops` vòng thì hiện khung tĩnh (`still`).
 */
export function DemoStage({
  script,
  still,
  backdrop,
  children,
  className,
  playing = true,
  loops,
  onEnd,
}: DemoStageProps) {
  const reduced = useReducedMotion();
  const [ended, setEnded] = useState(false);
  if (reduced || ended) return <DemoStill still={still} className={className} fadeIn={ended} />;
  return (
    <RunningStage
      script={script}
      backdrop={backdrop}
      className={className}
      playing={playing}
      loops={loops}
      onEnd={() => {
        setEnded(true);
        onEnd?.();
      }}
    >
      {children}
    </RunningStage>
  );
}

function RunningStage({
  script,
  backdrop,
  children,
  className,
  playing,
  loops,
  onEnd,
}: Omit<DemoStageProps, "still"> & { onEnd(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const pageVisible = usePageVisible();
  const css = useMemo(() => scriptCss(script), [script]);
  const paused = !playing || !inView || !pageVisible;
  const sceneName = `dk-${script.id}-scene`;

  // Số vòng là giá trị lúc chạy (prop) nên đặt qua biến CSS trên gốc.
  const style = { "--demo-loops": loops ?? "infinite" } as CSSProperties;

  function handleEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName === sceneName) onEnd();
  }

  return (
    <div
      ref={ref}
      aria-hidden
      data-paused={paused || undefined}
      style={style}
      className={cn("demo relative overflow-hidden", `demo-${script.id}`, className)}
    >
      <style href="demo-base" precedence="default">
        {BASE_CSS}
      </style>
      <style href={`demo-${script.id}`} precedence="default">
        {css}
      </style>
      <div
        className="dk dk-scene absolute inset-0 will-change-[opacity]"
        onAnimationEnd={handleEnd}
      >
        {backdrop && (
          <svg viewBox="0 0 640 360" aria-hidden className="absolute inset-0 size-full">
            {backdrop}
          </svg>
        )}
        <svg viewBox="0 0 640 360" aria-hidden className="absolute inset-0 size-full">
          {children}
        </svg>
      </div>
    </div>
  );
}

/** Khung tĩnh trong cùng khung: `Illustration` của game, co giữa (hai bên là màu bảng). */
export function DemoStill({
  still: Still,
  className,
  fadeIn,
}: {
  still: ComponentType<{ className?: string }>;
  className?: string;
  /** Hết vòng: hiện dần (chỉ độ mờ). */
  fadeIn?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        // flex (không phải grid) để `size-full` của SVG lấy theo chiều cao khung, co giữa khung.
        "flex items-center justify-center p-[3%]",
        fadeIn && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300",
        className,
      )}
    >
      <Still className="size-full min-h-0 min-w-0" />
    </div>
  );
}
