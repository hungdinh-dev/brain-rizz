import { useEffect } from "react";
import { gestureAction } from "./gesture";
import {
  resumeMusicAfterHidden,
  resumeMusicIfEnabled,
  suspendMusic,
  useMusic,
  wakeMusicOutput,
} from "./music.store";
import { TRACKS } from "./track-list";

/** Thanh nhạc (MusicBar) tự lo việc bấm của nó — bấm vào đó không tính là "thao tác đầu tiên". */
const MUSIC_CONTROL = "[data-music-control]";

/*
 * Trình duyệt chỉ cho phát tiếng sau một thao tác của người chơi. Trên máy tính đó là pointerdown/keydown;
 * trên điện thoại chạm thì phải tới pointerup — nên nghe cả ba, phát được rồi mới gỡ.
 */
const GESTURE_EVENTS = ["pointerdown", "pointerup", "keydown"] as const;

/** Sự kiện được tính là thao tác người dùng trên cả máy tính lẫn điện thoại. */
const WAKE_EVENTS = ["pointerup", "keydown"] as const;

/**
 * Gắn một lần ở App: (1) phát nhạc ở thao tác đầu tiên nếu người chơi chưa tắt (NFR-UX-02),
 * (2) tạm dừng khi tab ẩn, phát tiếp khi hiện lại, (3) nhỏ tiếng khi `focused` (đếm ngược, đang chơi).
 */
export function useMusicAutoplay(focused: boolean) {
  const setDucked = useMusic((s) => s.setDucked);

  useEffect(() => {
    setDucked(focused);
  }, [focused, setDucked]);

  useEffect(() => {
    if (TRACKS.length === 0) return;

    let listening = true;
    const stopListening = () => {
      if (!listening) return;
      listening = false;
      for (const type of GESTURE_EVENTS) window.removeEventListener(type, onGesture, true);
    };

    function onGesture(e: Event) {
      const { enabled, playing } = useMusic.getState();
      const onControl = e.target instanceof Element && e.target.closest(MUSIC_CONTROL) !== null;
      const action = gestureAction({ enabled, playing, onControl });
      if (action === "stop") stopListening();
      if (action !== "play") return;
      void resumeMusicIfEnabled().then((ok) => {
        if (ok) stopListening();
      });
    }

    for (const type of GESTURE_EVENTS) window.addEventListener(type, onGesture, true);

    // Luôn nghe (rất nhẹ): AudioContext bị iOS ngưng giữa chừng chỉ resume được trong một thao tác.
    for (const type of WAKE_EVENTS) window.addEventListener(type, wakeMusicOutput, true);

    const onVisibility = () => {
      if (document.hidden) suspendMusic();
      else resumeMusicAfterHidden();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopListening();
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wakeMusicOutput, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
