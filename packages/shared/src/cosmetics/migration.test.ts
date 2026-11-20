import { describe, expect, it } from "vitest";
import { COSMETIC_ITEMS } from "./catalog";
import { CHALK_SOURCES, ECONOMY_SQL_CONSTANTS } from "./economy";

/**
 * Đối chiếu migration Supabase với `catalog.ts` / `economy.ts` (kế hoạch gacha-pets-unlocks.md mục
 * 5.1 và 5.3) để số trong Postgres không lệch số trong shared.
 *
 * Quy ước đánh dấu trong SQL (mục 5.3):
 * - Hằng số: ngay sau chữ số hoặc chuỗi đặt comment khối `/* @economy <TÊN> *\/`, vd
 *   `v_price := 100 /* @economy GACHA_PRICE_SINGLE *\/;`. Tên là khoá của `ECONOMY_SQL_CONSTANTS`
 *   (`GACHA_RATES.common`, `CHALK_DAILY_CAPS.party.maxChalk`…). Mỗi tên phải xuất hiện ít nhất một
 *   lần, mọi lần đều đúng giá trị; tên lạ là lỗi.
 * - Seed `cosmetic_items`: mỗi món một bộ `('<id>', '<slot>', '<rarity>'` theo đúng thứ tự cột
 *   (id, slot, rarity), có thể thêm cột sau; đúng 24 món của `COSMETIC_ITEMS`.
 */

const MIGRATION = "../../../../supabase/migrations/20261120000000_gacha.sql";

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { query: "?raw"; import: "default"; eager: true },
    ): Record<string, string>;
  }
}

// import.meta.glob (vitest/vite): trả {} khi không có file — test dưới coi đó là lỗi (không skip),
// để đổi tên / xoá migration không làm phần đối chiếu im lặng bỏ qua.
const files = import.meta.glob("../../../../supabase/migrations/20261120000000_gacha.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});
const sql: string | undefined = files[MIGRATION];

/** Bỏ comment dòng `-- …` (giữ comment khối `/* … *\/` vì dấu hiệu nằm ở đó). */
function stripLineComments(text: string): string {
  return text.replace(/--[^\n]*/g, "");
}

/** Mọi lần đánh dấu `<giá trị> /* @economy <TÊN> *\/` trong SQL, theo thứ tự xuất hiện. */
function economyMarkers(text: string): { name: string; value: number | string }[] {
  const out: { name: string; value: number | string }[] = [];
  const re = /(-?\d+(?:\.\d+)?|'(?:[^']|'')*')\s*\/\*\s*@economy\s+([A-Za-z_][\w.]*)\s*\*\//g;
  for (const m of stripLineComments(text).matchAll(re)) {
    const raw = m[1] ?? "";
    const value = raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : Number(raw);
    out.push({ name: m[2] ?? "", value });
  }
  return out;
}

/** Các bộ seed `('<id>', '<slot>', '<rarity>'` trong SQL. */
function cosmeticSeedRows(text: string): { id: string; slot: string; rarity: string }[] {
  const re =
    /\(\s*'([a-z][a-z0-9-]*)'\s*,\s*'(head|face|neck)'\s*,\s*'(common|rare|epic|legendary)'\s*[,)]/g;
  return [...stripLineComments(text).matchAll(re)].map((m) => ({
    id: m[1] ?? "",
    slot: m[2] ?? "",
    rarity: m[3] ?? "",
  }));
}

describe("quy ước đánh dấu SQL (chạy cả khi chưa có migration)", () => {
  const sample = `
    -- 999 /* @economy GACHA_PRICE_SINGLE */  (comment dòng: bị bỏ qua)
    v_price := case when p_count = 10 then 900 /* @economy GACHA_PRICE_TEN */
                    else 100 /*@economy GACHA_PRICE_SINGLE*/ end;
    v_tz text := 'Asia/Ho_Chi_Minh' /* @economy CHALK_DAY_TIMEZONE */;
    insert into public.cosmetic_items (id, slot, rarity) values
      ('beanie', 'head', 'common'),
      ( 'halo','head','legendary', true);
  `;

  it("đọc được giá trị số, chuỗi và bỏ comment dòng", () => {
    expect(economyMarkers(sample)).toEqual([
      { name: "GACHA_PRICE_TEN", value: 900 },
      { name: "GACHA_PRICE_SINGLE", value: 100 },
      { name: "CHALK_DAY_TIMEZONE", value: "Asia/Ho_Chi_Minh" },
    ]);
  });

  it("đọc được bộ seed phụ kiện", () => {
    expect(cosmeticSeedRows(sample)).toEqual([
      { id: "beanie", slot: "head", rarity: "common" },
      { id: "halo", slot: "head", rarity: "legendary" },
    ]);
  });
});

describe("migration gacha khớp shared", () => {
  const text = sql ?? "";

  it("có file supabase/migrations/20261120000000_gacha.sql (không im lặng bỏ qua phần đối chiếu)", () => {
    expect(sql, "không đọc được migration gacha — đổi tên file thì sửa đường dẫn ở đây").toBeTypeOf(
      "string",
    );
    expect(text.length).toBeGreaterThan(0);
  });

  it("seed cosmetic_items đúng 24 món của COSMETIC_ITEMS", () => {
    const rows = cosmeticSeedRows(text);
    const key = (r: { id: string; slot: string; rarity: string }) =>
      `${r.id}|${r.slot}|${r.rarity}`;
    expect(new Set(rows.map(key))).toEqual(new Set(COSMETIC_ITEMS.map(key)));
    expect(new Set(rows.map((r) => r.id)).size).toBe(COSMETIC_ITEMS.length);
  });

  it("mọi hằng số kinh tế có đánh dấu @economy và đúng giá trị", () => {
    const markers = economyMarkers(text);
    const unknown = markers.filter((m) => !Object.hasOwn(ECONOMY_SQL_CONSTANTS, m.name));
    expect(unknown, "tên @economy lạ").toEqual([]);
    const wrong = markers.filter((m) => ECONOMY_SQL_CONSTANTS[m.name] !== m.value);
    expect(wrong, "giá trị lệch economy.ts").toEqual([]);
    const seen = new Set(markers.map((m) => m.name));
    const missing = Object.keys(ECONOMY_SQL_CONSTANTS).filter((name) => !seen.has(name));
    expect(missing, "hằng số chưa đánh dấu trong SQL").toEqual([]);
  });

  it("chalk_ledger nhận đúng các nguồn CHALK_SOURCES", () => {
    const body = stripLineComments(text);
    for (const source of CHALK_SOURCES) expect(body).toContain(`'${source}'`);
  });
});

/** Các hàm `create or replace function public.<tên>(…) … as $$ <thân> $$;` trong SQL. */
function sqlFunctions(text: string): { name: string; header: string; body: string }[] {
  const re =
    /create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;/gi;
  return [...stripLineComments(text).matchAll(re)].map((m) => ({
    name: m[1] ?? "",
    header: (m[2] ?? "").toLowerCase(),
    body: m[3] ?? "",
  }));
}

/** Gộp khoảng trắng, chữ thường: so câu lệnh không phụ thuộc xuống dòng. */
function normalize(text: string): string {
  return stripLineComments(text).replace(/\s+/g, " ").toLowerCase();
}

/** Các vai bị revoke EXECUTE của hàm `name` (gộp mọi câu `revoke execute on function public.<name>(…) from …;`). */
function revokedFrom(text: string, name: string): Set<string> {
  const re = new RegExp(
    `revoke execute on function public\\.${name}\\s*\\([^)]*\\) from ([^;]+);`,
    "g",
  );
  const roles = new Set<string>();
  for (const m of normalize(text).matchAll(re)) {
    for (const role of (m[1] ?? "").split(",")) roles.add(role.trim());
  }
  return roles;
}

/** Các vai được grant EXECUTE của hàm `name`. */
function grantedTo(text: string, name: string): Set<string> {
  const re = new RegExp(
    `grant execute on function public\\.${name}\\s*\\([^)]*\\) to ([^;]+);`,
    "g",
  );
  const roles = new Set<string>();
  for (const m of normalize(text).matchAll(re)) {
    for (const role of (m[1] ?? "").split(",")) roles.add(role.trim());
  }
  return roles;
}

/**
 * Hợp đồng bảo mật / đồng thời của migration (kế hoạch mục 5.3, ADR 0016), đọc tĩnh file SQL: chặn
 * lỗi hồi quy khi ai đó sửa migration (chưa có Postgres trong CI để chạy thật).
 */
describe("migration gacha: quyền, RLS, khoá theo người (đọc tĩnh)", () => {
  const text = sql ?? "";
  const fns = sqlFunctions(text);
  const fn = (name: string) => fns.find((f) => f.name === name);

  it("đọc được đủ các hàm của hợp đồng", () => {
    const names = new Set(fns.map((f) => f.name));
    for (const name of [
      "grant_chalk",
      "unlock_stats_for",
      "my_wallet",
      "claim_daily_chalk",
      "gacha_pull",
      "my_items",
      "gacha_history",
      "my_unlock_stats",
      "submit_practice_result",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("mọi hàm security definer đặt search_path = '' và bị revoke khỏi public + anon", () => {
    const definers = fns.filter((f) => /\bsecurity\s+definer\b/.test(f.header));
    expect(definers.length).toBeGreaterThanOrEqual(9);
    for (const f of definers) {
      expect(f.header, `${f.name}: thiếu set search_path = ''`).toMatch(
        /set\s+search_path\s*=\s*''/,
      );
      const revoked = revokedFrom(text, f.name);
      expect([...revoked], `${f.name}: chưa revoke public/anon`).toEqual(
        expect.arrayContaining(["public", "anon"]),
      );
    }
  });

  it("grant_chalk / unlock_stats_for chỉ cho service_role (revoke public, anon, authenticated)", () => {
    for (const name of ["grant_chalk", "unlock_stats_for"]) {
      expect([...revokedFrom(text, name)], name).toEqual(
        expect.arrayContaining(["public", "anon", "authenticated"]),
      );
      const granted = grantedTo(text, name);
      expect(
        granted.has("anon") || granted.has("authenticated") || granted.has("public"),
        name,
      ).toBe(false);
    }
  });

  it("hàm của người chơi chỉ cấp cho authenticated, không cấp anon", () => {
    for (const name of [
      "my_wallet",
      "claim_daily_chalk",
      "gacha_pull",
      "my_items",
      "gacha_history",
      "my_unlock_stats",
      "submit_practice_result",
    ]) {
      const granted = grantedTo(text, name);
      expect(granted.has("authenticated"), name).toBe(true);
      expect(granted.has("anon") || granted.has("public"), name).toBe(false);
    }
  });

  it("5 bảng mới bật RLS, không có policy, revoke khỏi anon + authenticated; bảng theo người cascade theo auth.users", () => {
    const sqlText = normalize(text);
    for (const table of [
      "chalk_ledger",
      "cosmetic_items",
      "user_items",
      "gacha_state",
      "gacha_pulls",
    ]) {
      expect(sqlText).toContain(`alter table public.${table} enable row level security`);
      expect(sqlText).toContain(`revoke all on table public.${table} from anon, authenticated`);
    }
    expect(sqlText).not.toMatch(/create policy/);
    // "Xoá dữ liệu của tôi" (delete_my_data xoá auth.users) dọn sạch nhờ cascade.
    for (const table of ["chalk_ledger", "user_items", "gacha_state", "gacha_pulls"]) {
      const def =
        new RegExp(`create table public\\.${table} \\(([^;]*)\\);`).exec(sqlText)?.[1] ?? "";
      expect(def, table).toMatch(
        /user_id uuid [^,]*references auth\.users \(id\) on delete cascade/,
      );
    }
  });

  it("mọi hàm đổi số dư theo trần / đủ tiền khoá theo người trước khi đọc sổ hoặc ghi sổ", () => {
    for (const name of ["gacha_pull", "grant_chalk", "submit_practice_result"]) {
      const body = normalize(fn(name)?.body ?? "");
      const lock = body.indexOf("pg_advisory_xact_lock(hashtextextended('chalk:' ||");
      expect(lock, `${name}: thiếu advisory lock chalk:<user>`).toBeGreaterThanOrEqual(0);
      const firstLedger = Math.min(
        ...["from public.chalk_ledger", "insert into public.chalk_ledger", "public.chalk_capped("]
          .map((s) => body.indexOf(s))
          .filter((i) => i >= 0),
      );
      expect(lock, `${name}: khoá phải đứng trước lần đọc / ghi sổ đầu tiên`).toBeLessThan(
        firstLedger,
      );
    }
  });

  it("gacha_pull: kiểm đủ phấn (insufficient) trước khi trừ; trừ giá bằng số âm", () => {
    const body = normalize(fn("gacha_pull")?.body ?? "");
    const check = body.indexOf("raise exception 'insufficient'");
    const charge = body.indexOf("insert into public.chalk_ledger");
    expect(check).toBeGreaterThanOrEqual(0);
    expect(charge).toBeGreaterThan(check);
    expect(body).toContain("'gacha', v_batch::text, -v_price");
  });

  it("gacha_pull idempotent theo p_request_id: kiểm mã sau khoá, trước khi kiểm đủ phấn / trừ phấn", () => {
    const f = fn("gacha_pull");
    expect(
      f?.header ?? "",
      "chữ ký gacha_pull(p_count int, p_request_id uuid default null)",
    ).toMatch(/^\s*p_count int,\s*p_request_id uuid default null\s*\)/);
    const body = normalize(f?.body ?? "");
    // Lượt mới có mã thì batch_id (= ref dòng gacha / refund) chính là mã đó.
    expect(body).toContain("v_batch uuid := coalesce(p_request_id, gen_random_uuid())");
    const lock = body.indexOf("pg_advisory_xact_lock(hashtextextended('chalk:' ||");
    const replay = body.indexOf("l.source = 'gacha' and l.ref = p_request_id::text");
    const check = body.indexOf("raise exception 'insufficient'");
    const charge = body.indexOf("insert into public.chalk_ledger");
    expect(replay, "thiếu kiểm mã yêu cầu trong sổ").toBeGreaterThanOrEqual(0);
    expect(replay, "kiểm mã phải đứng sau khoá theo người").toBeGreaterThan(lock);
    expect(check, "kiểm mã phải đứng trước kiểm đủ phấn").toBeGreaterThan(replay);
    expect(charge, "kiểm mã phải đứng trước lần trừ phấn").toBeGreaterThan(replay);
    // Nhánh gọi lại trả kết quả đã lưu, đánh dấu replayed, không ghi gì.
    const replayed = body.indexOf("'replayed', true", replay);
    expect(replayed).toBeGreaterThan(replay);
    expect(replayed).toBeLessThan(check);
    expect(body.slice(replay, replayed)).not.toMatch(/\b(insert|update|delete)\b/);
    expect(body).toContain("'replayed', false");
  });

  it("gacha_pull chỉ có một bản (int, uuid); revoke / grant đúng chữ ký đó", () => {
    expect(fns.filter((f) => f.name === "gacha_pull")).toHaveLength(1);
    const sqlText = normalize(text);
    expect(sqlText).toContain(
      "revoke execute on function public.gacha_pull(int, uuid) from public, anon;",
    );
    expect(sqlText).toContain(
      "grant execute on function public.gacha_pull(int, uuid) to authenticated;",
    );
    expect(sqlText).not.toMatch(/function public\.gacha_pull\s*\(int\)/);
  });
});
