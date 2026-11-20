import { type BotYieldedPayload, ServerMessage } from "@brain-rizz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/locales/en";
import { vi as viLocale } from "@/i18n/locales/vi";
import { BOT_YIELDED_TOAST_MS, type BotYieldedLabels, botYieldedText } from "./bot-yielded";

/**
 * Bot nhường ghế (CR-016, ui-ux 6.6): câu toast ghép từ bản dịch thật, và `connection.ts` nghe tin
 * `botYielded` để hiện toast 3 giây. Colyseus, toast, tài khoản được giả lập; `i18n.t` giả tra
 * thẳng `vi.ts` (không cần khởi tạo i18next).
 */

const { joinMock, toastMock, translate } = vi.hoisted(() => {
  /** `t()` tối giản trên bản dịch thật: tra khoá theo dấu chấm rồi thay `{{x}}`. */
  function translate(locale: object) {
    return (key: string, values: Record<string, unknown> = {}) => {
      const text = key
        .split(".")
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          locale,
        );
      if (typeof text !== "string") return key;
      return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ""));
    };
  }
  return { joinMock: vi.fn(), toastMock: Object.assign(vi.fn(), { error: vi.fn() }), translate };
});

vi.mock("@colyseus/sdk", () => ({
  Client: class {
    create = vi.fn();
    joinById = joinMock;
    reconnect = vi.fn();
  },
  CloseCode: { CONSENTED: 4000 },
}));
vi.mock("@/i18n", async () => {
  const { vi: locale } = await import("@/i18n/locales/vi");
  return { i18n: { t: translate(locale) } };
});
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/stores/auth.store", () => ({
  useAuth: { getState: () => ({ ensureSession: async () => null }) },
}));

/** Nhãn từ bản dịch thật, như `connection.ts` dựng bằng `i18n.t`. */
function labelsOf(locale: typeof viLocale): BotYieldedLabels {
  const t = translate(locale);
  return {
    character: (avatar) => t(`characters.${avatar}.name`),
    numbered: (name, n) => t("bots.numbered", { name, n }),
    suffix: t("bots.suffix"),
    sentence: (name, bot) => t("bots.yielded", { name, bot }),
  };
}

const YIELD: BotYieldedPayload = {
  botId: "bot-7",
  botAvatar: "bap",
  playerId: "s9",
  playerName: "Lan",
};

describe("câu toast bot nhường ghế (CR-016)", () => {
  it("tiếng Việt: tên người vào + tên bot dịch theo nhân vật, kèm hậu tố", () => {
    expect(botYieldedText(YIELD, labelsOf(viLocale))).toBe("Lan vào phòng · Bắp · máy nhường ghế");
  });

  it("tiếng Anh dùng tên nhân vật và hậu tố riêng", () => {
    expect(botYieldedText(YIELD, labelsOf(en))).toBe("Lan joined · Corny · bot gave up a seat");
  });

  it("bot đã rời phòng nên không đánh số, kể cả bot có id lớn", () => {
    const text = botYieldedText({ ...YIELD, botId: "bot-12", botAvatar: "bo" }, labelsOf(viLocale));
    expect(text).toBe("Lan vào phòng · Fen · máy nhường ghế");
  });
});

function fakeRoom() {
  return {
    roomId: "ABCD",
    sessionId: "s1",
    reconnectionToken: "token",
    send: vi.fn(),
    leave: vi.fn(async (_consented?: boolean) => 1000),
    connection: { isOpen: true, close: vi.fn() },
    reconnection: { enabled: true },
    onMessage: vi.fn(),
    onDrop: vi.fn(),
    onStateChange: vi.fn(),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
  };
}

const PROFILE = { name: "Minh", colorIndex: 2, avatar: "bo" as const, difficulty: 1 as const };

/** Vào một phòng party giả rồi trả hàm xử lý tin `botYielded` mà `connection.ts` đã đăng ký. */
async function joinAndGetHandler() {
  const room = fakeRoom();
  joinMock.mockResolvedValue(room);
  const { joinParty } = await import("./connection");
  await joinParty("ABCD", PROFILE);
  const entry = room.onMessage.mock.calls.find(([type]) => type === ServerMessage.BotYielded);
  return entry?.[1] as ((msg: BotYieldedPayload) => void) | undefined;
}

describe("connection nghe tin botYielded (CR-016)", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vi.stubEnv("VITE_SERVER_URL", "http://server.test");
    vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    joinMock.mockReset();
    toastMock.mockClear();
  });

  it("vào phòng party thì đăng ký tin botYielded", async () => {
    expect(await joinAndGetHandler()).toBeTypeOf("function");
  });

  it("nhận tin thì hiện toast 3 giây với câu đã dịch", async () => {
    const onYield = await joinAndGetHandler();
    onYield?.(YIELD);
    expect(BOT_YIELDED_TOAST_MS).toBe(3_000);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith("Lan vào phòng · Bắp · máy nhường ghế", {
      duration: BOT_YIELDED_TOAST_MS,
    });
  });

  it("nhiều bot nhường liền nhau thì mỗi lần một toast (không gộp bằng id)", async () => {
    const onYield = await joinAndGetHandler();
    onYield?.(YIELD);
    onYield?.({ ...YIELD, botId: "bot-6", botAvatar: "mochi", playerId: "s10", playerName: "Hà" });
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(toastMock.mock.calls[1]?.[0]).toBe("Hà vào phòng · Mochi · máy nhường ghế");
    for (const [, options] of toastMock.mock.calls) expect(options).not.toHaveProperty("id");
  });
});
