import { PauseIcon, PlayIcon, SkipForwardIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useMusic } from "../music.store";
import { TRACKS } from "../track-list";

/** Thanh trượt viết phấn: rãnh tối, phần đã kéo và núm màu phấn. */
const CHALK_SLIDER =
  "w-24 [&_[data-slot=slider-range]]:bg-chalk [&_[data-slot=slider-thumb]]:border-chalk [&_[data-slot=slider-thumb]]:bg-chalk [&_[data-slot=slider-track]]:bg-board-shade";

/**
 * Thanh nhạc nền đặt cạnh nút ngôn ngữ/theme. Máy tính: phát/dừng, tên bài, bài kế, âm lượng;
 * điện thoại: chỉ phát/dừng + bài kế. Chưa có file nhạc nào thì không hiện gì.
 */
export function MusicBar() {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const playing = useMusic((s) => s.playing);
  const index = useMusic((s) => s.index);
  const volume = useMusic((s) => s.volume);
  const toggle = useMusic((s) => s.toggle);
  const next = useMusic((s) => s.next);
  const setVolume = useMusic((s) => s.setVolume);
  const commitVolume = useMusic((s) => s.commitVolume);

  const track = TRACKS[index];
  if (!track) return null;

  const toggleLabel = playing ? t("music.pause") : t("music.play");

  return (
    // fieldset = nhóm điều khiển có nhãn (role="group"); preflight của Tailwind đã bỏ viền/lề mặc định
    <fieldset
      aria-label={t("music.label")}
      data-music-control=""
      className="flex min-w-0 items-center gap-2"
    >
      <Button
        variant="chalk"
        size="icon-chalk"
        aria-label={toggleLabel}
        data-sfx="toggle"
        title={toggleLabel}
        onClick={toggle}
      >
        {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
      </Button>
      {desktop && (
        <span
          title={track.title}
          className="max-w-36 truncate font-display text-sm font-bold text-chalk-muted"
        >
          {track.title}
        </span>
      )}
      <Button
        variant="chalk"
        size="icon-chalk"
        aria-label={t("music.next")}
        title={t("music.next")}
        onClick={next}
      >
        <SkipForwardIcon className="fill-current" />
      </Button>
      {desktop && (
        <Slider
          aria-label={t("music.volume")}
          title={t("music.volume")}
          className={CHALK_SLIDER}
          min={0}
          max={100}
          step={5}
          value={[Math.round(volume * 100)]}
          onValueChange={([v]) => setVolume((v ?? 0) / 100)}
          onValueCommit={commitVolume}
        />
      )}
    </fieldset>
  );
}
