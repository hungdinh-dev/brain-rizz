import {
  emptyUnlockStats,
  PET_CHARACTER_IDS,
  type PetId,
  petProgress,
  type UnlockStats,
} from "@brain-rizz/shared";
import { create } from "zustand";
import { fetchUnlockStats } from "@/net/unlocks-api";
import { useAuth } from "@/stores/auth.store";
import { useGame } from "@/stores/game.store";
import { useNav } from "@/stores/nav.store";
import { loadSeenPets, loadSeenRecord, normalizeSeen, saveSeenPets } from "./seen";

/**
 * Tiến độ mở khoá bạn đồng hành (CR-024) dùng chung cho Hồ sơ, phòng chờ, Tủ đồ, hộp chúc mừng.
 * Tải một lần mỗi phiên (lần đầu có màn cần), làm mới khi về menu từ màn khác, khi rời phòng,
 * khi nhận phấn sau trận / Kiểm tra não đã lưu, khi đổi tài khoản.
 *
 * - `idle`: chưa tải. `loading`: đang tải lần đầu (đang làm mới thì giữ số cũ, không về `loading`).
 * - `ready`: có số liệu — từ máy chủ (`fromServer`), hoặc chưa có phiên (= chưa chơi gì, số 0).
 * - `unavailable`: chưa cấu hình / lỗi / DB chưa có `my_unlock_stats` → thú khoá hiện "chưa có
 *   dữ liệu", không báo lỗi.
 */
export type UnlockLoad = "idle" | "loading" | "ready" | "unavailable";

interface PetUnlockStore {
  load: UnlockLoad;
  stats: UnlockStats;
  /** Số liệu đọc từ máy chủ bằng phiên đang có: chỉ khi đó mới ghi / so danh sách đã thấy. */
  fromServer: boolean;
  /**
   * Thú đã thấy mở trên máy này của người `seenUser` (`null` = chưa từng ghi cho người này, hoặc chưa
   * biết số liệu là của ai). Trước lần tải đầu: bản lưu trên máy (để hiện tạm thú đã mở).
   */
  seen: PetId[] | null;
  /** Người dùng của `seen` (id Supabase; khách chưa có phiên = `null`); `undefined` = chưa biết. */
  seenUser: string | null | undefined;
  refresh(): Promise<void>;
  /** Đã xem hộp chúc mừng (chọn hoặc "Để sau") → thêm vào danh sách đã thấy. */
  markSeen(ids: readonly PetId[]): void;
}

/** Thú đã đạt luật, theo thứ tự `PET_CHARACTER_IDS`. */
export function unlockedPetsOf(stats: UnlockStats): PetId[] {
  return PET_CHARACTER_IDS.filter((pet) => petProgress(pet, stats).unlocked);
}

/**
 * Danh sách đã thấy của người đang đăng nhập (đọc lại từ máy khi đổi người: người khác → `null`).
 * Chưa đọc xong phiên (`unknown`) → `undefined`: chưa biết số liệu vừa tải là của ai.
 */
function currentSeen(s: PetUnlockStore): Pick<PetUnlockStore, "seen" | "seenUser"> | undefined {
  const auth = useAuth.getState();
  if (auth.status === "unknown") return undefined;
  const user = auth.userId;
  return { seenUser: user, seen: s.seenUser === user ? s.seen : loadSeenPets(user) };
}

let inflight: Promise<void> | null = null;
/** Có yêu cầu làm mới trong lúc đang tải (vd. vừa nhận phấn): tải lại một lần nữa sau đó. */
let again = false;

const stored = loadSeenRecord();

export const usePetUnlockStore = create<PetUnlockStore>((set, get) => ({
  load: "idle",
  stats: emptyUnlockStats(),
  fromServer: false,
  seen: stored?.ids ?? null,
  seenUser: stored ? stored.user : undefined,

  refresh() {
    if (inflight) {
      again = true;
      return inflight;
    }
    if (get().load === "idle") set({ load: "loading" });
    inflight = (async () => {
      do {
        again = false;
        const res = await fetchUnlockStats();
        const s = get();
        if (res.ok) {
          // Chưa biết số liệu của ai (hiếm: tải xong trước khi đọc xong phiên) → chưa so, chưa ghi;
          // đọc xong phiên thì `userId` đổi → tải lại.
          const mine = currentSeen(s) ?? { seen: null, seenUser: undefined };
          // Lần đầu có số liệu thật của người này trên máy này (kể cả vừa đổi tài khoản): ghi thú
          // đang mở là đã thấy, không chúc mừng dồn các thú đã mở sẵn.
          if (mine.seenUser !== undefined && mine.seen === null) {
            mine.seen = unlockedPetsOf(res.data);
            saveSeenPets(mine.seenUser, mine.seen);
          }
          set({ load: "ready", stats: res.data, fromServer: true, ...mine });
        } else if (res.reason === "no-session") {
          set({ load: "ready", stats: emptyUnlockStats(), fromServer: false });
        } else if (!(s.load === "ready" && s.fromServer)) {
          // Lỗi lúc làm mới thì giữ số cũ; chưa có số thì "chưa có dữ liệu" (thú đã thấy mở trên
          // máy này của đúng người đang dùng vẫn hiện mở).
          set({ load: "unavailable", ...currentSeen(s) });
        }
      } while (again);
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  },

  markSeen(ids) {
    const { seen, seenUser } = get();
    const next = normalizeSeen([...(seen ?? []), ...ids]);
    // Ghi cho đúng người của danh sách (chưa biết là ai thì chỉ nhớ trong phiên này).
    if (seenUser !== undefined) saveSeenPets(seenUser, next);
    set({ seen: next });
  },
}));

let wired = false;

/** Nghe các mốc cần làm mới (một lần). */
function wire() {
  if (wired) return;
  wired = true;
  const refresh = () => void usePetUnlockStore.getState().refresh();
  useNav.subscribe((s, prev) => {
    // Về menu từ một màn khác (Luyện tập, Kiểm tra não, Tủ đồ…); hồ sơ ⇄ menu thì khỏi.
    if (s.screen === "menu" && prev.screen !== "menu" && prev.screen !== "profile") refresh();
  });
  useGame.subscribe((s, prev) => {
    const left = (prev.party !== null && s.party === null) || (prev.brain !== null && !s.brain);
    const brainSaved = s.brain?.saveStatus === "saved" && prev.brain?.saveStatus !== "saved";
    const rewarded = s.reward !== null && s.reward !== prev.reward;
    if (left || brainSaved || rewarded) refresh();
  });
  useAuth.subscribe((s, prev) => {
    if (s.userId !== prev.userId) refresh();
  });
}

/** Tải lần đầu (nếu chưa) và bắt đầu nghe các mốc làm mới. */
export function ensurePetUnlocks() {
  wire();
  if (usePetUnlockStore.getState().load === "idle") void usePetUnlockStore.getState().refresh();
}
