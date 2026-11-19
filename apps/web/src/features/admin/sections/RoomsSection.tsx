import { type AdminRoomView, isGameId, type Phase } from "@brain-rizz/shared";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useGameTextLookup } from "@/hooks/use-game-text";
import { fetchRooms } from "@/net/admin-api";
import { useAdminStore } from "../admin.store";
import { GameIcon } from "../components/GameIcon";
import {
  Chip,
  type ChipTone,
  EmptyPanel,
  Panel,
  RefreshButton,
  SectionHeader,
  SectionState,
} from "../components/kit";
import { useAdminFormat } from "../format";
import { useAdminData } from "../hooks/use-admin-data";

/** Tự làm mới mỗi ngần này ms (ui-ux 6.9: "Tự làm mới 10 giây"). */
const AUTO_REFRESH_MS = 10_000;

const PHASE_TONE: Record<Phase, ChipTone> = {
  lobby: "muted",
  "game-select": "sun",
  "game-intro": "grape",
  countdown: "grape",
  playing: "mint",
  "round-results": "sky",
  podium: "grape",
};

/** Phòng đang mở (game server `GET /admin/rooms`): thẻ từng phòng, không có tên người chơi. */
export function RoomsSection() {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const setRoomCount = useAdminStore((s) => s.setRoomCount);
  const [auto, setAuto] = useState(true);
  const switchId = useId();
  const { state, reload, refreshing, loadedAt } = useAdminData(fetchRooms, [], {
    keepData: true,
  });

  useEffect(() => {
    if (state.status === "ok") setRoomCount(state.data.rooms.length);
  }, [state, setRoomCount]);

  // Tự làm mới khi bật công tắc và tab đang hiện.
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, reload]);

  const rooms = state.status === "ok" ? state.data.rooms : [];
  const humans = rooms.reduce((n, r) => n + r.humans, 0);
  const bots = rooms.reduce((n, r) => n + r.bots, 0);

  return (
    <>
      <SectionHeader section="rooms">
        <span className="flex items-center gap-1.5">
          <span className="flex h-11 w-14 items-center justify-center">
            <Switch
              id={switchId}
              checked={auto}
              onCheckedChange={setAuto}
              aria-label={t("admin.rooms.autoRefresh")}
            />
          </span>
          <label htmlFor={switchId} className="cursor-pointer">
            {t("admin.rooms.autoRefreshShort")}
            {loadedAt !== null && ` · ${fmt.clock(loadedAt)}`}
          </label>
        </span>
        <RefreshButton onClick={reload} busy={refreshing} />
      </SectionHeader>
      {state.status !== "ok" ? (
        <SectionState state={state} section="rooms" server onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip tone="mint" className="h-7">
              {t("admin.rooms.summary", {
                rooms: fmt.num(rooms.length),
                humans: fmt.num(humans),
                bots: fmt.num(bots),
              })}
            </Chip>
            <Chip tone="card" className="h-7">
              {t("admin.rooms.uptime", { time: fmt.duration(state.data.uptimeS) })}
            </Chip>
          </div>
          {rooms.length === 0 ? (
            <EmptyPanel section="rooms" />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
              {rooms.map((room) => (
                <RoomCard key={room.roomId} room={room} serverTime={state.data.serverTime} />
              ))}
            </div>
          )}
          <p className="m-0 text-[12.5px] text-chalk-muted">{t("admin.rooms.footer")}</p>
        </>
      )}
    </>
  );
}

function RoomCard({ room, serverTime }: { room: AdminRoomView; serverTime: number }) {
  const { t } = useTranslation();
  const fmt = useAdminFormat();
  const gameText = useGameTextLookup();
  const settings = useAdminStore((s) => s.settings);
  const current = settings.status !== "ok" || settings.data.version === room.configVersion;
  const game = isGameId(room.gameId) ? gameText(room.gameId).title : t("admin.rooms.noGame");
  const stats = [
    { value: room.humans, label: t("admin.rooms.humans") },
    { value: room.bots, label: t("admin.rooms.bots") },
    { value: room.connected, label: t("admin.rooms.connected") },
  ];

  return (
    <Panel aria-label={room.code} className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="font-display text-[30px] leading-none font-extrabold tracking-[4px]">
          {room.code}
        </span>
        <span className="flex-1" />
        <Chip tone={PHASE_TONE[room.phase]}>{t(`admin.rooms.phases.${room.phase}`)}</Chip>
      </div>
      <div className="flex min-h-7.5 items-center gap-2.5">
        <GameIcon id={room.gameId} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{game}</span>
          {room.round > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("admin.rooms.round", { round: room.round, total: room.totalRounds })}
            </span>
          )}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {stats.map((s) => (
          <span key={s.label} className="rounded-[10px] bg-muted py-1.5">
            <b className="block font-display text-xl leading-none tabular-nums">
              {fmt.num(s.value)}
            </b>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <Chip tone={current ? "sky" : "dashed"} className="h-5.5">
          {current
            ? t("admin.rooms.config", { version: room.configVersion })
            : t("admin.rooms.configOld", { version: room.configVersion })}
        </Chip>
        <span className="text-muted-foreground">
          {t("admin.rooms.age", { time: fmt.ago(room.createdAt, serverTime || Date.now()) })}
        </span>
      </div>
    </Panel>
  );
}
