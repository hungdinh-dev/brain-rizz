#!/usr/bin/env node
/**
 * Chia sẻ game cho bạn bè qua Internet bằng Cloudflare Quick Tunnel (không cần tài khoản).
 * Máy đang chạy lệnh này làm host; tắt cửa sổ là bạn bè rớt mạng.
 *
 *   pnpm share
 *
 * Các bước:
 *   1. Dò `cloudflared` (PATH, rồi các chỗ winget/brew hay cài).
 *   2. Chạy game server cổng 2567 (nạp apps/server/.env nếu có) — hoặc dùng lại server
 *      đang chạy sẵn (vd. đang `pnpm dev`).
 *   3. Mở 2 tunnel: một cho server, một cho web (cổng preview chọn trước).
 *   4. Build web với VITE_SERVER_URL = link tunnel server, ra thư mục RIÊNG apps/web/dist-share
 *      (không đụng apps/web/dist của bản deploy thật, không sửa apps/web/.env).
 *   5. Chạy `vite preview` cho bản build đó, chờ hai link trả lời rồi in link cho bạn bè.
 *   6. Ctrl+C → dọn mọi tiến trình con (Windows: taskkill /T để diệt cả tiến trình cháu).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = join(ROOT, "apps/server");
const WEB_DIR = join(ROOT, "apps/web");
const VITE_BIN = join(WEB_DIR, "node_modules/vite/bin/vite.js");
const SHARE_OUT_DIR = "dist-share"; // tương đối với apps/web, đã có trong .gitignore
const SERVER_PORT = 2567;
const PREVIEW_PORT_FROM = 4173;
const IS_WIN = process.platform === "win32";

const TUNNEL_TIMEOUT_MS = 60_000;
const SERVER_START_TIMEOUT_MS = 40_000;
const READY_TIMEOUT_MS = 60_000;

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = color("1");
const dim = color("2");
const green = color("32");
const yellow = color("33");
const red = color("31");
const cyan = color("36");

const step = (message) => console.log(`${cyan("›")} ${message}`);
const warn = (message) => console.log(`${yellow("!")} ${message}`);

// ───────────────────────── Quản lý tiến trình con ─────────────────────────

/** @type {Set<import("node:child_process").ChildProcess>} */
const children = new Set();
let shuttingDown = false;

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (IS_WIN) {
    // pnpm/.cmd/tsx có thể sinh tiến trình cháu: diệt cả cây.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM"); // cả nhóm tiến trình (spawn detached)
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
}

function cleanup() {
  shuttingDown = true;
  for (const child of children) killTree(child);
  children.clear();
}

function exit(code) {
  cleanup();
  process.exit(code);
}

function fatal(message, log = []) {
  if (shuttingDown) return;
  console.error(`\n${red("✖")} ${message}`);
  if (log.length) {
    console.error(dim("  ── log gần nhất ──"));
    for (const line of log.slice(-25)) console.error(dim(`  ${line}`));
  }
  exit(1);
}

const STOP_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", ...(IS_WIN ? ["SIGBREAK"] : [])];
for (const signal of STOP_SIGNALS) {
  process.on(signal, () => {
    if (shuttingDown) return;
    console.log(`\n${dim("Đang dừng tunnel, preview và server do lệnh này mở…")}`);
    exit(0);
  });
}
process.on("exit", cleanup);
process.on("uncaughtException", (error) => fatal(`Lỗi không mong muốn: ${error.stack ?? error}`));

/**
 * Chạy tiến trình con, giữ 60 dòng log gần nhất. `onLine` nhận từng dòng stdout/stderr.
 * Tiến trình chạy lâu (`longRunning`) mà tự thoát thì dừng cả lệnh share.
 */
function start(name, command, args, { cwd = ROOT, env = process.env, onLine, longRunning } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: !IS_WIN, // POSIX: tạo nhóm tiến trình riêng để kill(-pid) diệt cả cây
  });
  children.add(child);
  const log = [];
  let pending = "";
  const onData = (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      log.push(line);
      if (log.length > 60) log.shift();
      onLine?.(line);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  const exited = new Promise((resolve) => {
    child.on("error", (error) => {
      log.push(String(error));
      resolve(-1);
    });
    child.on("exit", (code) => resolve(code ?? -1));
  });
  exited.then((code) => {
    children.delete(child);
    if (!longRunning) return;
    // Ctrl+C trên Windows gửi tới cả tiến trình con: chờ chút để handler SIGINT chạy trước.
    setTimeout(() => {
      if (!shuttingDown) fatal(`${name} dừng bất ngờ (mã thoát ${code}).`, log);
    }, 500);
  });
  return { child, log, exited };
}

// ───────────────────────── Tiện ích ─────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isHttpOk(url, timeoutMs = 3_000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(check, timeoutMs, intervalMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(intervalMs);
  }
  return false;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

async function findFreePort(from) {
  for (let port = from; port < from + 50; port++) {
    if (await isPortFree(port)) return port;
  }
  fatal(`Không tìm được cổng trống cho web từ ${from} đến ${from + 49}.`);
}

function findCloudflared() {
  const candidates = ["cloudflared"];
  if (IS_WIN) {
    candidates.push(
      join(homedir(), "AppData/Local/Microsoft/WinGet/Links/cloudflared.exe"),
      "C:/Program Files (x86)/cloudflared/cloudflared.exe",
      "C:/Program Files/cloudflared/cloudflared.exe",
    );
  } else {
    candidates.push(
      "/opt/homebrew/bin/cloudflared",
      "/usr/local/bin/cloudflared",
      "/usr/bin/cloudflared",
    );
  }
  for (const candidate of candidates) {
    if (candidate !== "cloudflared" && !existsSync(candidate)) continue;
    const res = spawnSync(candidate, ["--version"], { stdio: "ignore", windowsHide: true });
    if (res.status === 0) return candidate;
  }
  return null;
}

/** Mở quick tunnel tới `target`, trả về link https://*.trycloudflare.com khi tunnel đã nối. */
function startTunnel(name, cloudflared, target) {
  return new Promise((resolve) => {
    let url = null;
    let done = false;
    const tunnel = start(name, cloudflared, ["tunnel", "--no-autoupdate", "--url", target], {
      longRunning: true,
      onLine(line) {
        url ??= line.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/)?.[0] ?? null;
        if (!done && url && /Registered tunnel connection/i.test(line)) {
          done = true;
          clearTimeout(timer);
          resolve(url);
        }
      },
    });
    const timer = setTimeout(() => {
      if (done) return;
      fatal(
        `${name}: quá ${TUNNEL_TIMEOUT_MS / 1000} giây chưa mở được tunnel. ` +
          "Kiểm tra mạng (có thể bị chặn UDP/QUIC — thử lại sau), hoặc tạm đổi tên " +
          "~/.cloudflared/config.yml nếu có.",
        tunnel.log,
      );
    }, TUNNEL_TIMEOUT_MS);
  });
}

// ───────────────────────── Chạy ─────────────────────────

console.log(bold("\nBrain Rizz — chia sẻ cho bạn bè qua Internet (Cloudflare Quick Tunnel)\n"));

// 1. cloudflared
const cloudflared = findCloudflared();
if (!cloudflared) {
  console.error(`${red("✖")} Chưa có cloudflared trên máy.`);
  console.error("  Cài (không cần tài khoản Cloudflare):");
  console.error(
    IS_WIN
      ? "    winget install --id Cloudflare.cloudflared"
      : "    brew install cloudflared   (macOS; Linux: xem developers.cloudflare.com)",
  );
  console.error("  Cài xong mở terminal mới rồi chạy lại: pnpm share");
  process.exit(1);
}
if (!existsSync(VITE_BIN)) {
  console.error(`${red("✖")} Không thấy Vite trong apps/web. Chạy \`pnpm install\` trước.`);
  process.exit(1);
}

// 2. Game server
const healthUrl = `http://127.0.0.1:${SERVER_PORT}/healthz`;
if (await isHttpOk(healthUrl, 1_500)) {
  step(`Dùng lại game server đang chạy ở cổng ${SERVER_PORT}.`);
  warn(
    "Server này (vd. từ `pnpm dev`) để mở /monitor và /playground — chúng cũng ra Internet qua " +
      "link server. Muốn tắt: dừng `pnpm dev` rồi chạy lại `pnpm share`.",
  );
} else {
  step(`Khởi động game server cổng ${SERVER_PORT}…`);
  const server = start(
    "Game server",
    process.execPath,
    ["--env-file-if-exists=.env", "--import", "tsx", "src/index.ts"],
    {
      cwd: SERVER_DIR,
      // production: tắt /monitor và /playground vì link server công khai trên Internet.
      // (Biến có sẵn trong env được ưu tiên hơn file .env.)
      env: { ...process.env, NODE_ENV: "production", PORT: String(SERVER_PORT) },
      longRunning: true,
      // Colyseus không tự thoát khi cổng bận: báo lỗi ngay thay vì chờ hết thời gian.
      onLine(line) {
        if (line.includes("EADDRINUSE")) {
          fatal(`Cổng ${SERVER_PORT} đang bị chương trình khác chiếm.`, server.log);
        }
      },
    },
  );
  if (!(await waitFor(() => isHttpOk(healthUrl, 1_500), SERVER_START_TIMEOUT_MS))) {
    fatal(
      `Game server không trả lời ${healthUrl} sau ${SERVER_START_TIMEOUT_MS / 1000} giây ` +
        `(cổng ${SERVER_PORT} có thể đang bị chương trình khác chiếm).`,
      server.log,
    );
  }
}

// 3. Hai tunnel mở song song (tunnel web trỏ sẵn tới cổng preview, preview lên sau cũng được).
const previewPort = await findFreePort(PREVIEW_PORT_FROM);
step("Mở 2 tunnel Cloudflare (server + web)…");
const [serverUrl, webUrl] = await Promise.all([
  startTunnel("Tunnel server", cloudflared, `http://127.0.0.1:${SERVER_PORT}`),
  startTunnel("Tunnel web", cloudflared, `http://127.0.0.1:${previewPort}`),
]);
console.log(dim(`  server: ${serverUrl}`));
console.log(dim(`  web:    ${webUrl}`));

// 4. Build web trỏ tới tunnel server, ra thư mục riêng.
step(`Build web (VITE_SERVER_URL=${serverUrl}) → apps/web/${SHARE_OUT_DIR}…`);
const build = start(
  "Build web",
  process.execPath,
  [VITE_BIN, "build", "--outDir", SHARE_OUT_DIR, "--emptyOutDir"],
  { cwd: WEB_DIR, env: { ...process.env, VITE_SERVER_URL: serverUrl } },
);
const buildCode = await build.exited;
if (buildCode !== 0) fatal(`Build web thất bại (mã thoát ${buildCode}).`, build.log);

// 5. Preview
step(`Chạy vite preview cổng ${previewPort}…`);
start(
  "Vite preview",
  process.execPath,
  [
    VITE_BIN,
    "preview",
    "--outDir",
    SHARE_OUT_DIR,
    "--host",
    "127.0.0.1",
    "--port",
    String(previewPort),
    "--strictPort",
  ],
  { cwd: WEB_DIR, longRunning: true },
);
const localWebUrl = `http://127.0.0.1:${previewPort}`;
if (!(await waitFor(() => isHttpOk(localWebUrl, 1_500), 30_000))) {
  fatal(`vite preview không trả lời ở ${localWebUrl}.`);
}

// 6. Chờ link công khai trả lời (DNS của quick tunnel đôi khi cần vài giây).
step("Chờ link công khai sẵn sàng…");
const ready = await waitFor(
  async () => (await isHttpOk(`${serverUrl}/healthz`, 5_000)) && (await isHttpOk(webUrl, 5_000)),
  READY_TIMEOUT_MS,
  2_000,
);

const line = "═".repeat(Math.max(webUrl.length + 6, 44));
console.log(`\n${green(line)}`);
console.log(`  ${bold("Gửi link này cho bạn bè:")}`);
console.log(`\n  ${bold(green(webUrl))}\n`);
console.log(green(line));
if (!ready) {
  warn(
    "Link chưa trả lời từ máy này sau 60 giây — thường chỉ là DNS chậm, thử mở sau ít phút. " +
      "Nếu máy bạn báo không tìm thấy trang: chạy `ipconfig /flushdns` (Windows).",
  );
}
console.log(`
  • Giữ cửa sổ này mở trong lúc chơi — máy bạn là host. Ctrl+C để dừng.
  • Link đổi mỗi lần chạy \`pnpm share\`.
  • Bạn chơi trên máy này: mở link trên, hoặc ${localWebUrl}
  • Đăng nhập Google qua link này cần thêm https://*.trycloudflare.com/** vào Redirect URLs
    của Supabase; chế độ khách và chơi party không bị ảnh hưởng.
`);
