import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

/** Nội dung màn hướng dẫn theo mục "Màn hướng dẫn" của docs/04-minigames/circuit-link.md. */
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "Nối mạch",
    howTo: "Chọn mảnh dây lấp ô trống để điện chạy từ pin tới bóng đèn. Dây cụt không dẫn điện.",
    summary: "Chọn mảnh dây cho bóng đèn sáng",
    steps: ["Tìm ô dây còn trống", "Chọn mảnh nối pin tới bóng đèn", "Dây cụt không dẫn điện đâu!"],
    controls: { touch: "Chạm vào thẻ mảnh dây", mouse: "Click chuột vào thẻ mảnh dây" },
    hint: { touch: "Nối dây cho đèn sáng!", mouse: "Nối dây cho đèn sáng!" },
    levels: [
      "Lưới 3×3 · 3 thẻ · dây gần thẳng",
      "Lưới 4×4 · chọn đúng hướng rẽ",
      "Lưới 5×5 · có dây cụt, dây mồi",
      "Hai ô trống · chọn cặp mảnh",
    ],
    levelHints: {
      2: {
        touch: "Lần dây từ pin, coi chừng dây cụt!",
        mouse: "Lần dây từ pin, coi chừng dây cụt!",
      },
      3: { touch: "Hai ô trống, chọn đúng cặp mảnh!", mouse: "Hai ô trống, chọn đúng cặp mảnh!" },
    },
  },
  en: {
    title: "Circuit Link",
    howTo:
      "Pick the wire piece that fills the gap so power runs from the battery to the bulb. Dead ends carry no power.",
    summary: "Pick the wire piece that lights the bulb",
    steps: [
      "Find the empty wire spot",
      "Pick the piece linking battery to bulb",
      "Dead ends carry no power!",
    ],
    controls: { touch: "Tap a wire piece card", mouse: "Click a wire piece card" },
    hint: {
      touch: "Connect the wires to light the bulb!",
      mouse: "Connect the wires to light the bulb!",
    },
    levels: [
      "3×3 grid · 3 cards · almost straight",
      "4×4 grid · pick the right turn",
      "5×5 grid · dead ends and decoys",
      "Two gaps · pick the right pair",
    ],
    levelHints: {
      2: {
        touch: "Trace from the battery, watch for dead ends!",
        mouse: "Trace from the battery, watch for dead ends!",
      },
      3: { touch: "Two gaps, pick the right pair!", mouse: "Two gaps, pick the right pair!" },
    },
  },
};
