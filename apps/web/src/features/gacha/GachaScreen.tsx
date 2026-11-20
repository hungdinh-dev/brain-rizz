import { GACHA_PRICE_SINGLE, GACHA_TEN_COUNT } from "@brain-rizz/shared";
import { PercentIcon, ShirtIcon } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChalkChip } from "@/components/common/ChalkChip";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadProfile } from "@/features/home";
import { useReducedMotion } from "@/features/motion";
import { useClaimDaily } from "@/hooks/use-claim-daily";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useNumberFormat } from "@/hooks/use-number-format";
import { cn } from "@/lib/utils";
import {
  gachaPull,
  newPullRequestId,
  type PullBatch,
  type PullCount,
  type PullResult,
  retryUnavailable,
  type Wallet,
} from "@/net/gacha-api";
import { useAuth } from "@/stores/auth.store";
import { useNav } from "@/stores/nav.store";
import { useWallet, type WalletStatus } from "@/stores/wallet.store";
import { GachaMachine } from "./components/GachaMachine";
import { OddsPanel, RatesList } from "./components/OddsPanel";
import { Reveal } from "./components/Reveal";
import {
  EarnCard,
  GachaCard,
  OfflineCard,
  PityCard,
  PullErrorCard,
} from "./components/WalletCards";
import {
  focusFirst,
  type PendingPull,
  PULL_PRICE,
  rarestPull,
  retryPlan,
  walletOnScreen,
} from "./pulls";
import "./gacha.css";

/** Máy quay chạy tối thiểu ngần này (tay quay 900 ms + viên nang rơi) rồi mới mở quà. */
const SPIN_MS = 1_000;

type Phase = "idle" | "spinning" | "reveal";

/**
 * Máy quay phụ kiện `/gacha` (S19, CR-023, ui-ux 6.12): số dư, máy quay, Quay 1 (nút chính) /
 * Quay 10 (nút phụ), bảo hiểm thường trực, Tỉ lệ & 24 món, mở quà, thiếu phấn → cách kiếm. Kết quả
 * quay do Postgres quyết (`gacha_pull`); màn chỉ diễn lại. Không đồng hồ, không mời quay tiếp.
 *
 * Mỗi lần bấm Quay một mã yêu cầu; lỗi mạng / hết giờ chờ thì giữ mã, "Thử lại" đọc lại ví rồi gửi
 * lại đúng mã đó (máy chủ trả kết quả cũ, không trừ phấn lần hai). Kết quả chỉ áp vào ví khi bắt đầu
 * mở quà; bảo hiểm trên màn giữ số lúc bấm tới khi mở hết (không lộ độ hiếm trước).
 */
export function GachaScreen() {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reduced = useReducedMotion();
  const go = useNav((s) => s.go);
  const goBack = useNav((s) => s.goBack);
  const authStatus = useAuth((s) => s.status);
  const status = useWallet((s) => s.status);
  const storeWallet = useWallet((s) => s.wallet);
  const items = useWallet((s) => s.items);
  const profile = useMemo(() => loadProfile(), []);
  const { claim, claiming } = useClaimDaily(profile);

  const [phase, setPhase] = useState<Phase>("idle");
  const [batch, setBatch] = useState<PullBatch | null>(null);
  const [openedAll, setOpenedAll] = useState(false);
  /** Lượt quay chưa rõ kết quả: thẻ "Chưa nhận được kết quả" + Thử lại. */
  const [pullError, setPullError] = useState(false);
  /** Thử lại đang đọc lại ví (nút Thử lại tắt). */
  const [retrying, setRetrying] = useState(false);
  /** Ví lúc bấm Quay, hiện thay ví thật tới khi mở hết quà (`walletOnScreen`). */
  const [frozen, setFrozen] = useState<Wallet | null>(null);
  const [oddsOpen, setOddsOpen] = useState(false);
  const pending = useRef<PendingPull | null>(null);
  /** Đang chờ máy chủ hoặc đang diễn máy quay (chưa tới màn mở quà). */
  const inFlight = useRef(false);
  const lastCount = useRef<PullCount>(1);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const pullRefs = useRef<Partial<Record<PullCount, HTMLButtonElement | null>>>({});
  const oddsRef = useRef<HTMLButtonElement>(null);
  const oddsOpener = useRef<HTMLElement | null>(null);
  /** Vừa đóng màn mở quà: đưa tiêu điểm về nút quay khi nút hiện lại. */
  const focusPullOnIdle = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  /** Bỏ lượt chưa rõ kết quả: thẻ lỗi quay mất, màn hiện lại ví thật. */
  const dropPending = useCallback(() => {
    pending.current = null;
    setPullError(false);
    setFrozen(null);
  }, []);

  /** Đọc lại ví + món; trả trạng thái ví sau khi đọc. */
  const reloadWallet = useCallback(async (): Promise<WalletStatus> => {
    const { load, loadItems } = useWallet.getState();
    await Promise.all([load({ probe: true }), loadItems()]);
    return useWallet.getState().status;
  }, []);

  const reload = useCallback(() => {
    const seen = pending.current;
    void reloadWallet().then((next) => {
      // Ví đã đúng theo máy chủ (kể cả lượt quay chưa nhận kết quả): thẻ lỗi quay hết hiệu lực. Chỉ
      // bỏ lượt đã chờ từ trước lần đọc này (lượt bấm sau đó, hay màn mở quà đang diễn, giữ nguyên).
      if (!alive.current || inFlight.current || !seen || pending.current !== seen) return;
      if (next !== "error" && next !== "loading") dropPending();
    });
  }, [dropPending, reloadWallet]);

  // Phiên đọc xong / đổi (đăng nhập, đăng xuất ở màn khác) → đọc lại ví và món.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy lại khi trạng thái phiên đổi
  useEffect(() => reload(), [authStatus]);

  const offline = status === "offline";
  const loading = status === "loading";
  const hasWallet = !!storeWallet && (status === "ok" || status === "no-session");
  const shown = walletOnScreen({ wallet: storeWallet, frozen, batch, openedAll });
  const balance = shown.wallet?.balance ?? 0;
  const poor = hasWallet && balance < GACHA_PRICE_SINGLE;
  const busy = phase !== "idle" || retrying;
  const canPull = (n: PullCount) => hasWallet && !busy && balance >= PULL_PRICE[n];

  /** Gửi lượt quay `req` (mã mới khi bấm Quay, mã cũ khi Thử lại) rồi diễn máy quay. */
  const send = async (req: PendingPull) => {
    pending.current = req;
    lastCount.current = req.count;
    inFlight.current = true;
    setPullError(false);
    setPhase("spinning");
    const started = performance.now();
    const res = await gachaPull(req.count, req.id);
    if (!alive.current) return;
    if (!res.ok) {
      inFlight.current = false;
      setPhase("idle");
      if (res.reason === "error") {
        // Lỗi mạng / hết giờ chờ: máy chủ có thể đã quay xong → giữ mã để Thử lại xem kết quả.
        setPullError(true);
        return;
      }
      dropPending();
      // Số dư đổi ở máy khác: đọc lại ví → về trạng thái thiếu phấn.
      if (res.reason === "insufficient") toast(t("gacha.insufficient"));
      reload();
      return;
    }
    pending.current = null;
    const data = res.data;
    if (data.results.length === 0) {
      // Không còn món nào hiện được (món đã gỡ khỏi code): cập nhật ví, không mở quà.
      inFlight.current = false;
      useWallet.getState().applyPull(data);
      dropPending();
      setPhase("idle");
      reload();
      return;
    }
    const wait = reduced ? 0 : Math.max(0, SPIN_MS - (performance.now() - started));
    timer.current = window.setTimeout(() => {
      inFlight.current = false;
      // Áp vào ví khi bắt đầu mở quà, không trong lúc máy quay; bảo hiểm trên màn vẫn giữ số lúc bấm
      // (`frozen`) tới khi mở hết.
      useWallet.getState().applyPull(data);
      setBatch(data);
      setOpenedAll(reduced);
      if (reduced) setFrozen(null);
      setPhase("reveal");
    }, wait);
  };

  /** Bấm Quay: lượt mới, mã mới (lượt cũ chưa rõ kết quả, nếu có, bị bỏ — vẫn có ở lịch sử quay). */
  const pull = (n: PullCount) => {
    if (inFlight.current || !canPull(n)) return;
    setFrozen(useWallet.getState().wallet);
    void send({ id: newPullRequestId(), count: n });
  };

  /** Thử lại sau lỗi quay: đọc lại ví trước, rồi gửi lại đúng mã cũ (hoặc lượt mới nếu đủ phấn). */
  const retry = async () => {
    if (inFlight.current || retrying) return;
    setRetrying(true);
    const next = await reloadWallet();
    if (!alive.current) return;
    setRetrying(false);
    // Chưa đọc được ví: giữ thẻ (và mã) để Thử lại lần nữa.
    if (next === "error") return;
    // Hết phiên / chưa kết nối máy chủ: thẻ trạng thái của ví lo phần còn lại.
    if (next !== "ok") {
      dropPending();
      return;
    }
    setPullError(false);
    const latest = useWallet.getState().wallet;
    const plan = retryPlan(pending.current, lastCount.current, latest?.balance ?? 0);
    if (plan.kind === "replay") void send(plan.pull);
    else if (plan.kind === "fresh") {
      setFrozen(latest);
      void send({ id: newPullRequestId(), count: plan.count });
    } else {
      dropPending();
      toast(t("gacha.insufficient"));
    }
  };

  const focusPull = useCallback(
    () => focusFirst([pullRefs.current[lastCount.current], pullRefs.current[1], oddsRef.current]),
    [],
  );

  const finish = useCallback(() => {
    focusPullOnIdle.current = true;
    setPhase("idle");
    setBatch(null);
    setOpenedAll(false);
    setFrozen(null);
  }, []);
  const onOpenedAll = useCallback(() => {
    setOpenedAll(true);
    setFrozen(null);
  }, []);
  const tryOn = (item: PullResult) => go({ screen: "wardrobe", tryOn: item.itemId });

  // Đóng màn mở quà (điện thoại: nội dung màn đổi lại; máy tính: hộp thoại đóng) → tiêu điểm về
  // nút quay đã mở nó, không rơi về <body>.
  useEffect(() => {
    if (phase !== "idle" || !focusPullOnIdle.current) return;
    focusPullOnIdle.current = false;
    focusPull();
  }, [phase, focusPull]);

  /** Hộp thoại mở quà (máy tính) đóng: Radix không có nút mở để trả tiêu điểm → tự trả. */
  const onRevealCloseFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      focusPull();
    },
    [focusPull],
  );

  const openOdds = (event: MouseEvent<HTMLElement>) => {
    oddsOpener.current = event.currentTarget;
    setOddsOpen(true);
  };
  const onOddsCloseFocus = useCallback((event: Event) => {
    if (focusFirst([oddsOpener.current, oddsRef.current])) event.preventDefault();
  }, []);

  const machine = (width: number) => (
    <MachineStage
      width={width}
      spinning={phase === "spinning" && !reduced}
      dim={offline}
      label={t("gacha.title")}
    />
  );
  const balanceChip = (
    <BalanceChip status={status} hasWallet={hasWallet} value={fmt(shown.balance)} />
  );
  const oddsButton = (label: string) => (
    <Button
      ref={oddsRef}
      variant="chalk"
      aria-haspopup="dialog"
      className="h-11 gap-1.5 px-3.5 text-[15px]"
      onClick={openOdds}
    >
      <PercentIcon aria-hidden className="size-4.5" />
      {label}
    </Button>
  );
  const wardrobeButton = (
    <Button
      variant="chalk"
      className="h-11 gap-1.5 px-3.5 text-[15px]"
      onClick={() => go("wardrobe")}
    >
      <ShirtIcon aria-hidden className="size-4.5" />
      {t("gacha.wardrobe")}
    </Button>
  );
  const statusCard = offline ? (
    <OfflineCard
      onRetry={() => {
        retryUnavailable();
        reload();
      }}
    />
  ) : status === "error" && !pullError ? (
    // Đang có lượt chưa rõ kết quả: Thử lại của thẻ đó đọc lại ví luôn, không hiện thêm thẻ thứ hai.
    <PullErrorCard message={t("gacha.walletError")} onRetry={reload} />
  ) : null;
  const earnCard = poor ? (
    <EarnCard
      balance={balance}
      dailyClaimed={shown.wallet?.dailyClaimed ?? false}
      claiming={claiming}
      onClaim={() => void claim()}
      onParty={() => goBack("menu")}
      onPractice={() => go("practice")}
    />
  ) : null;
  const errorCard = pullError && (
    <PullErrorCard message={t("gacha.pullError")} busy={retrying} onRetry={() => void retry()} />
  );
  const buttons = (
    <PullButtons
      tall={desktop}
      canPull={canPull}
      onPull={pull}
      price={(n) => fmt(PULL_PRICE[n])}
      buttonRef={(n, el) => {
        pullRefs.current[n] = el;
      }}
    />
  );
  const noRealMoney = (
    <p className="text-center text-[13px] text-chalk-muted">{t("gacha.noRealMoney")}</p>
  );
  const reveal = phase === "reveal" && batch && (
    <Reveal
      batch={batch}
      desktop={desktop}
      reduced={reduced}
      onOpenedAll={onOpenedAll}
      onTryOn={tryOn}
      onDone={finish}
      onCloseAutoFocus={onRevealCloseFocus}
      tryOnItem={rarestPull(batch.results)}
    />
  );

  return (
    <main className="flex flex-1 flex-col gap-3.5 lg:gap-5">
      <ScreenHeader
        title={t("gacha.title")}
        subtitle={desktop ? t("gacha.subtitle") : undefined}
        onBack={() => goBack("menu")}
      />

      {desktop ? (
        <div className="grid flex-1 grid-cols-[minmax(0,560fr)_minmax(0,600fr)] gap-8">
          <section aria-label={t("gacha.title")} className="flex flex-col gap-4">
            <div className="flex min-h-[420px] flex-1 items-center justify-center">
              {machine(330)}
            </div>
            {errorCard}
            {buttons}
            {noRealMoney}
          </section>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-chalk-muted">
                  {t("gacha.balanceLabel")}
                </span>
                {balanceChip}
              </div>
              <span className="flex-1" />
              {oddsButton(t("gacha.oddsAll"))}
              {wardrobeButton}
            </div>
            {statusCard ?? <PityCard wallet={shown.wallet} loading={loading} />}
            {earnCard}
            {!poor && !offline && (
              <GachaCard aria-labelledby="gacha-rates-title">
                <div className="flex items-center justify-between gap-2">
                  <h2
                    id="gacha-rates-title"
                    className="font-display text-lg leading-none font-extrabold"
                  >
                    {t("gacha.rates.perPull")}
                  </h2>
                  <Button
                    variant="link"
                    className="min-h-11 px-1 text-sm"
                    aria-haspopup="dialog"
                    onClick={openOdds}
                  >
                    {t("gacha.rates.seeAll")}
                  </Button>
                </div>
                <RatesList compact />
              </GachaCard>
            )}
          </div>
        </div>
      ) : reveal ? null : (
        <>
          <div className="flex items-center gap-2">
            {balanceChip}
            <span className="flex-1" />
            {oddsButton(t("gacha.odds"))}
            {wardrobeButton}
          </div>
          <section
            aria-label={t("gacha.title")}
            className={cn(
              "flex flex-1 items-center justify-center",
              poor ? "min-h-[160px]" : "min-h-[280px]",
            )}
          >
            {machine(poor ? 124 : 224)}
          </section>
          {statusCard ?? earnCard ?? <PityCard wallet={shown.wallet} loading={loading} />}
          {errorCard}
          {buttons}
          {/* Thiếu phấn: thẻ Cách kiếm phấn đã có câu "Không mua phấn bằng tiền". */}
          {!poor && noRealMoney}
        </>
      )}

      {reveal}

      <OddsPanel
        open={oddsOpen}
        onOpenChange={setOddsOpen}
        onCloseAutoFocus={onOddsCloseFocus}
        desktop={desktop}
        owned={hasWallet ? items : null}
        showHistory={status === "ok"}
      />
    </main>
  );
}

/** Máy quay giữa vùng trống, kèm nét phấn dưới chân và vài hạt lấp lánh (trang trí). */
function MachineStage({
  width,
  spinning,
  dim,
  label,
}: {
  width: number;
  spinning: boolean;
  dim: boolean;
  label: string;
}) {
  return (
    <div className="relative flex items-end justify-center px-6 pb-2">
      <svg
        aria-hidden
        viewBox="0 0 300 40"
        className="absolute bottom-0 left-1/2 w-[min(300px,100%)] -translate-x-1/2 stroke-chalk opacity-45"
      >
        <path d="M20 30 C80 22 220 22 280 30" fill="none" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 320 60"
        className="absolute -top-1 left-1/2 w-[min(320px,100%)] -translate-x-1/2 stroke-sun"
      >
        <path
          d="M24 30 L28 22 L32 30 L28 38 Z M290 18 L293 12 L296 18 L293 24 Z M270 44 L272 40 L274 44 L272 48 Z"
          fill="none"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <GachaMachine
        width={width}
        spinning={spinning}
        dim={dim}
        label={label}
        className="relative"
      />
    </div>
  );
}

/** Số dư viết trên bảng (chỉ hiển thị). Đang tải: khung xương; chưa kết nối: "—". */
function BalanceChip({
  status,
  hasWallet,
  value,
}: {
  status: WalletStatus;
  hasWallet: boolean;
  value: string;
}) {
  const { t } = useTranslation();
  if (status === "loading") {
    return <Skeleton className="h-11 w-26 rounded-full bg-board-shade" />;
  }
  return (
    <ChalkChip tone="board" size="lg" srLabel={t("gacha.chalk")}>
      {hasWallet ? value : t("common.none")}
    </ChalkChip>
  );
}

/** Quay 1 (nút chính, vàng) và Quay 10 (nút phụ, thẻ) kèm chip giá; thiếu phấn thì tắt riêng từng nút. */
function PullButtons({
  tall,
  canPull,
  onPull,
  price,
  buttonRef,
}: {
  tall: boolean;
  canPull(n: PullCount): boolean;
  onPull(n: PullCount): void;
  price(n: PullCount): string;
  /** Giữ tham chiếu từng nút để trả tiêu điểm khi đóng màn mở quà. */
  buttonRef(n: PullCount, el: HTMLButtonElement | null): void;
}) {
  const { t } = useTranslation();
  const counts: PullCount[] = [1, GACHA_TEN_COUNT];
  return (
    <div className="grid grid-cols-2 gap-3">
      {counts.map((n) => (
        <Button
          key={n}
          ref={(el) => buttonRef(n, el)}
          variant={n === 1 ? "default" : "outline"}
          data-sfx="confirm"
          disabled={!canPull(n)}
          aria-label={t(n === 1 ? "gacha.pull1Aria" : "gacha.pull10Aria", { price: price(n) })}
          onClick={() => onPull(n)}
          className={cn(
            "gap-2.5 px-3 text-[22px] disabled:opacity-50 disabled:shadow-[0_2px_0_var(--color-sticker)]",
            tall ? "h-18 text-2xl" : "h-16",
          )}
        >
          {t(n === 1 ? "gacha.pull1" : "gacha.pull10")}
          <ChalkChip tone="card" size="sm">
            {price(n)}
          </ChalkChip>
        </Button>
      ))}
    </div>
  );
}
