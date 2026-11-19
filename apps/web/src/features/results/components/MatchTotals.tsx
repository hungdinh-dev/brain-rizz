import { type PlayerView, placementPoints } from "@brain-rizz/shared";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BotBadge, PlayerName } from "@/components/characters";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { RankBadge } from "@/components/common/RankBadge";
import { ReactionBubble } from "@/features/chat";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { MatchRow } from "../standings";

/**
 * Cách tính điểm trận theo hạng cho dòng chú thích, co giãn theo số ghế (CR-018):
 * 12 người "nhất +15 · nhì +13 · ba +11 · tư +9". `topBonus` là thưởng top của trận (CR-019).
 */
export function usePlacementLegend(playerCount: number, topBonus?: readonly number[]) {
  const { t } = useTranslation();
  return [0, 1, 2, 3]
    .filter((rank) => rank < playerCount)
    .map(
      (rank) =>
        `${t(`ordinal.${rank as 0 | 1 | 2 | 3}`)} +${placementPoints(rank, playerCount, topBonus)}`,
    )
    .join(" · ");
}

interface MatchTotalsProps {
  rows: MatchRow[];
  sessionId: string;
  /** Vòng đầu: chưa có hạng trước đó nên ẩn mũi tên lên/xuống */
  showMovement: boolean;
  /** Phòng đông (9–12 người, ui-ux 6.8): máy tính dùng hàng gọn 36 px. Điện thoại giữ hàng cũ. */
  compact?: boolean;
}

/**
 * Bảng tổng điểm (khu 10): thanh xanh trời = điểm trước vòng, phần xanh lá = vừa cộng,
 * nhãn "+N" bay vào; mũi tên lên/xuống hạng so với trước vòng.
 */
export function MatchTotals({ rows, sessionId, showMovement, compact }: MatchTotalsProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Chừa chỗ bên phải thanh cho nhãn "+N".
  const scale = Math.max(1, ...rows.map((r) => r.player.matchPoints)) * 1.2;

  if (compact && desktop) {
    return (
      <ol className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <CompactTotalRow
            key={row.player.id}
            row={row}
            isMe={row.player.id === sessionId}
            scale={scale}
            showMovement={showMovement}
            delay={i * 60}
          />
        ))}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col gap-3 lg:gap-3.5">
      {rows.map((row, i) => (
        <TotalRow
          key={row.player.id}
          row={row}
          isMe={row.player.id === sessionId}
          scale={scale}
          showMovement={showMovement}
          delay={i * 120}
        />
      ))}
    </ol>
  );
}

/**
 * Hàng gọn 36 px (máy tính, 9–12 người): hạng 26 · chip lên/xuống 40×20 · avatar 28 · tên 132 px ·
 * thanh 20 px + nhãn "+điểm" · tổng 24 px. 12 hàng vừa một màn không cuộn.
 */
function CompactTotalRow({
  row,
  isMe,
  scale,
  showMovement,
  delay,
}: {
  row: MatchRow;
  isMe: boolean;
  scale: number;
  showMovement: boolean;
  delay: number;
}) {
  const { t } = useTranslation();
  const p: PlayerView = row.player;
  const before = Math.max(0, p.matchPoints - p.lastPoints);
  const beforePct = (before / scale) * 100;
  const gainPct = (p.lastPoints / scale) * 100;

  return (
    <li
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-xl border-[2.5px] border-sticker pr-2.5 pl-1.5 text-card-foreground",
        isMe ? "bg-primary/30" : "bg-card",
      )}
    >
      <RankBadge rank={row.rank + 1} size="sm" className="size-6.5 text-sm" />
      <span className="flex w-10 shrink-0 justify-center">
        {showMovement && <Movement prevRank={row.prevRank} rank={row.rank} compact />}
      </span>
      <span className="relative flex shrink-0">
        <PlayerAvatar
          avatar={p.avatar}
          accessories={p.accessories}
          colorIndex={p.colorIndex}
          size="sm"
          className="size-7"
        />
        {p.isBot && <BotBadge size="xs" />}
        <ReactionBubble playerId={p.id} placement="corner" />
      </span>
      <span className="flex w-33 min-w-0 shrink-0 items-baseline gap-1 overflow-x-clip">
        <PlayerName
          player={p}
          className="truncate font-display text-[17px] leading-none font-extrabold"
          suffixClassName="text-[11px] text-muted-foreground"
        />
        {isMe && (
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
            {t("lobby.you")}
          </span>
        )}
      </span>
      <span className="relative flex h-5 min-w-0 flex-1 rounded-[10px] border-[2.5px] border-sticker bg-muted">
        <span
          className="h-full rounded-l-[7px] bg-sky transition-[width] duration-700"
          style={{ width: `${beforePct}%` }}
        />
        {p.lastPoints > 0 && (
          <span
            className={cn(
              "h-full rounded-r-[7px] border-l-[2.5px] border-sticker bg-mint motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 motion-safe:duration-700",
              before === 0 && "rounded-l-[7px] border-l-0",
            )}
            style={{ width: `${gainPct}%`, animationDelay: `${delay}ms` }}
          />
        )}
        {p.lastPoints > 0 && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -rotate-4 rounded-lg border-[2.5px] border-sticker bg-primary px-1.5 font-display text-[13px] leading-[1.3] font-extrabold whitespace-nowrap text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-150 motion-safe:duration-700"
            style={{
              left: `calc(${beforePct + gainPct}% + 6px)`,
              animationDelay: `${delay + 200}ms`,
            }}
          >
            +{p.lastPoints}
          </span>
        )}
      </span>
      <span className="w-11 shrink-0 text-right font-display text-2xl leading-none font-extrabold tabular-nums">
        {p.matchPoints}
      </span>
    </li>
  );
}

function TotalRow({
  row,
  isMe,
  scale,
  showMovement,
  delay,
}: {
  row: MatchRow;
  isMe: boolean;
  scale: number;
  showMovement: boolean;
  delay: number;
}) {
  const { t } = useTranslation();
  const p: PlayerView = row.player;
  const before = Math.max(0, p.matchPoints - p.lastPoints);
  const beforePct = (before / scale) * 100;
  const gainPct = (p.lastPoints / scale) * 100;

  const name = (
    <span className="flex min-w-0 items-baseline gap-1 overflow-x-clip">
      <PlayerName
        player={p}
        className="truncate font-display text-lg font-extrabold lg:text-2xl"
        suffixClassName="text-[11.5px] opacity-80 lg:text-sm"
      />
      {isMe && (
        <span className="shrink-0 text-[11.5px] font-semibold opacity-80 lg:text-xs">
          {t("lobby.you")}
        </span>
      )}
    </span>
  );

  const bar = (
    <span className="relative flex h-6 min-w-0 flex-1 rounded-xl border-[3px] border-sticker bg-muted lg:h-8.5">
      <span
        className="h-full rounded-l-lg bg-sky transition-[width] duration-700"
        style={{ width: `${beforePct}%` }}
      />
      {p.lastPoints > 0 && (
        <span
          className={cn(
            "h-full border-l-[3px] border-sticker bg-mint motion-safe:animate-in motion-safe:slide-in-from-left-4 motion-safe:fade-in motion-safe:duration-700",
            before === 0 && "rounded-l-lg border-l-0",
            "rounded-r-lg",
          )}
          style={{ width: `${gainPct}%`, animationDelay: `${delay}ms` }}
        />
      )}
      {p.lastPoints > 0 && (
        <span
          className="absolute top-1/2 -translate-y-1/2 -rotate-6 rounded-[10px] border-[3px] border-sticker bg-primary px-2 font-display text-[15px] leading-[1.3] font-extrabold whitespace-nowrap text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-150 motion-safe:slide-in-from-right-20 motion-safe:duration-900 lg:text-xl"
          style={{
            left: `calc(${beforePct + gainPct}% + 8px)`,
            animationDelay: `${delay + 300}ms`,
          }}
        >
          +{p.lastPoints}
        </span>
      )}
    </span>
  );

  const total = (
    <span className="w-11 shrink-0 text-right font-display text-[26px] leading-none font-extrabold tabular-nums lg:w-24 lg:text-[34px]">
      {p.matchPoints}
    </span>
  );

  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border-[3.5px] border-sticker px-2.5 pt-2 pb-2.5 shadow-sticker lg:min-h-20.5 lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-[20px] lg:border-4 lg:py-0 lg:pr-5.5 lg:pl-3.5",
        isMe ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
      )}
    >
      <span className="flex items-center gap-2 lg:contents">
        <RankBadge rank={row.rank + 1} size="md" className="lg:size-12 lg:text-2xl" />
        <span className="order-last flex lg:order-none lg:w-13.5 lg:justify-center">
          {showMovement && <Movement prevRank={row.prevRank} rank={row.rank} />}
        </span>
        <span className="relative flex shrink-0">
          <PlayerAvatar
            avatar={p.avatar}
            accessories={p.accessories}
            colorIndex={p.colorIndex}
            size="md"
            className="size-9 lg:size-13.5"
          />
          {p.isBot && <BotBadge size="sm" />}
          <ReactionBubble playerId={p.id} placement="corner" />
        </span>
        <span className="flex min-w-0 flex-1 lg:w-32.5 lg:flex-none">{name}</span>
        <span className="order-last lg:hidden">{total}</span>
      </span>
      <span className="flex pr-12 lg:contents">{bar}</span>
      <span className="hidden lg:block">{total}</span>
    </li>
  );
}

/** Nhãn "=", "↑2", "↓1" so với hạng trước vòng. `compact`: chip 40×20 của hàng gọn. */
function Movement({
  prevRank,
  rank,
  compact,
}: {
  prevRank: number;
  rank: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const diff = prevRank - rank;
  const chip = compact
    ? "inline-flex h-5 w-10 items-center justify-center gap-0.5 rounded-full border-2 text-[11px] font-extrabold [&_svg]:size-3"
    : "inline-flex h-6 min-w-8.5 items-center justify-center gap-0.5 rounded-full border-[2.5px] px-2 text-xs font-extrabold lg:h-6.5 lg:text-sm";
  if (diff === 0) {
    return (
      <span
        role="img"
        aria-label={t("results.same")}
        className={cn(chip, "border-dashed border-current opacity-70")}
      >
        =
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      role="img"
      aria-label={up ? t("results.up", { n: diff }) : t("results.down", { n: -diff })}
      className={cn(chip, "border-sticker text-ink", up ? "bg-compute" : "bg-pink")}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={3} />
      {Math.abs(diff)}
    </span>
  );
}
