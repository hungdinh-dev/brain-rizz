import { useEffect } from "react";
import { useGame } from "../../store/game";

export function Toast() {
  const toast = useGame((s) => s.toast);
  const setToast = useGame((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="rounded-2xl bg-pink px-4 py-3 font-semibold text-ink shadow-lg">{toast}</div>
    </div>
  );
}

export function ConnectionBanner() {
  const connection = useGame((s) => s.connection);
  const inParty = useGame((s) => s.party !== null);
  if (!inParty || connection !== "reconnecting") return null;
  return (
    <div className="mb-3 rounded-2xl bg-sun px-4 py-2 text-center font-semibold text-ink">
      Mất kết nối, đang nối lại…
    </div>
  );
}
