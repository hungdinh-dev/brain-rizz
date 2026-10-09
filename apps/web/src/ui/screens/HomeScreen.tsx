import {
  AVATAR_COLORS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  isValidRoomCode,
  MAX_NAME_LENGTH,
  normalizeRoomCode,
} from "@brain-rizz/shared";
import { useState } from "react";
import { createParty, joinParty } from "../../net/connection";
import { useGame } from "../../store/game";

const PROFILE_KEY = "brain-rizz:profile";

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as { name: string; colorIndex: number; difficulty: Difficulty };
  } catch {
    /* bỏ qua */
  }
  return { name: "", colorIndex: 0, difficulty: 1 as Difficulty };
}

function codeFromUrl() {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4})/);
  return m?.[1] ? normalizeRoomCode(m[1]) : "";
}

export function HomeScreen() {
  const saved = loadProfile();
  const [name, setName] = useState(saved.name);
  const [colorIndex, setColorIndex] = useState(saved.colorIndex);
  const [difficulty, setDifficulty] = useState<Difficulty>(saved.difficulty);
  const [code, setCode] = useState(codeFromUrl);
  const [busy, setBusy] = useState(false);
  const setToast = useGame((s) => s.setToast);

  const profile = { name: name.trim(), colorIndex, difficulty };
  const canSubmit = profile.name.length > 0 && !busy;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* bỏ qua */
    }
    try {
      await action();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Không kết nối được tới server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      <header className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Brain <span className="text-mint">Rizz</span>
        </h1>
        <p className="mt-2 text-white/60">Đấu trí cùng bạn bè, ngay trên trình duyệt.</p>
      </header>

      <section className="card flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/60">Tên của bạn</span>
          <input
            className="field"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Hùng"
            autoComplete="nickname"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-white/60">Màu avatar</span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`Màu ${i + 1}`}
                onClick={() => setColorIndex(i)}
                className={`size-10 rounded-full transition ${i === colorIndex ? "ring-4 ring-white" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-white/60">Độ khó của bạn</span>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={d === difficulty ? "btn-primary px-2" : "btn-ghost px-2"}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          className="btn-primary text-lg"
          disabled={!canSubmit}
          onClick={() => run(() => createParty(profile))}
        >
          Tạo phòng mới
        </button>

        <div className="flex gap-2">
          <input
            className="field text-center font-extrabold tracking-[0.4em] uppercase"
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            placeholder="MÃ"
            inputMode="text"
            autoCapitalize="characters"
          />
          <button
            type="button"
            className="btn-ghost shrink-0"
            disabled={!canSubmit || !isValidRoomCode(code)}
            onClick={() => run(() => joinParty(code, profile))}
          >
            Vào phòng
          </button>
        </div>
      </section>
    </main>
  );
}
