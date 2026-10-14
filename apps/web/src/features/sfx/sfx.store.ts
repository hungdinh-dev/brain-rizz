import { create } from "zustand";
import { loadSfxEnabled, saveSfxEnabled } from "./settings";

/** Bật/tắt âm thanh hiệu ứng (độc lập với nhạc nền), nhớ trên máy. */
interface SfxStore {
  enabled: boolean;
  toggle(): void;
}

export const useSfx = create<SfxStore>((set, get) => ({
  enabled: loadSfxEnabled(),
  toggle() {
    const enabled = !get().enabled;
    saveSfxEnabled(enabled);
    set({ enabled });
  },
}));
