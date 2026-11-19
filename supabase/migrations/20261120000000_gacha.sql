-- CR-023, CR-024: phấn, máy quay phụ kiện, tủ đồ, số liệu mở khoá bạn đồng hành
-- (docs/01-product/gacha-pets-unlocks.md mục 4 và 5.3; ADR 0016).
--
-- Ai ghi gì:
--   - Client (mọi phiên, kể cả khách ẩn danh): chỉ qua RPC `my_wallet`, `claim_daily_chalk`,
--     `gacha_pull`, `my_items`, `gacha_history`, `my_unlock_stats`, và `submit_practice_result`
--     (thay hàm cũ, giữ chữ ký, thêm cộng phấn luyện tập). Luôn trên dữ liệu của chính mình (auth.uid()).
--   - Game server (khoá secret = role service_role): `grant_chalk` (thưởng trận party / Kiểm tra não,
--     số tính bằng `partyChalkReward` / `brainChalkReward` của shared) và `unlock_stats_for` (kiểm
--     nhân vật khoá + phụ kiện khi vào phòng). Hai hàm này anon/authenticated không gọi được.
-- 5 bảng mới bật RLS và KHÔNG có policy: client không đọc/ghi thẳng được, chỉ qua RPC `security definer`.
--
-- Số dư = tổng `chalk_ledger.amount` của người đó (sổ chỉ thêm dòng, không sửa). Mọi hàm làm thay
-- đổi số dư theo trần / đủ tiền (`gacha_pull`, `grant_chalk`, `submit_practice_result`) khoá theo
-- người (advisory lock trong transaction, cùng một khoá `chalk:<user_id>`): hai yêu cầu cùng lúc
-- của một người chạy lần lượt, nên không tiêu quá số dư và không vượt trần ngày. Quà mỗi ngày dựa
-- vào ràng buộc unique `(user_id, source, ref)` (ref = ngày) nên không cần khoá.
-- "Hôm nay" tính theo giờ Việt Nam (`public.chalk_today()`), cột `chalk_ledger.day` ghi sẵn ngày đó.
--
-- Hằng số kinh tế phải khớp packages/shared/src/cosmetics/economy.ts: mỗi số / chuỗi dùng hằng số
-- có comment khối đánh dấu ngay sau (quy ước ở kế hoạch mục 5.3), test shared
-- `cosmetics/migration.test.ts` đọc file này và so từng giá trị. Seed `cosmetic_items` phải khớp
-- `COSMETIC_ITEMS` (catalog.ts). Đổi số → sửa economy.ts trước, rồi viết migration MỚI (không sửa
-- file đã chạy) và chuyển dấu đánh dấu sang file mới.
--
-- Thuật toán quay (`gacha_pull`) làm y hệt bản tham chiếu `rollGachaBatch` + `pickGachaItem` của
-- shared, RNG = random() của Postgres (server quyết, client chỉ hiển thị).
--
-- Lỗi trả về (supabase-js: error.code / error.message): chưa có phiên → 28000; tham số sai → 22023;
-- không đủ phấn → 'insufficient' (P0001); danh mục không còn món đang bật của độ hiếm vừa ra →
-- 'unavailable' (P0001, không trừ gì vì cả lượt bị huỷ).
--
-- Thứ tự triển khai: chạy file này TRƯỚC khi deploy game server mới (server gọi `grant_chalk`,
-- `unlock_stats_for`; gặp DB chưa có hàm thì không cộng phấn / coi như chưa mở thú, trận vẫn chạy)
-- và TRƯỚC khi deploy web mới (web gọi các RPC trên). Server và web cũ chạy bình thường trên DB đã
-- chạy file này (`submit_practice_result` giữ nguyên chữ ký và kết quả trả về).
-- Chạy như các file trước: SQL Editor (dán cả file) hoặc `supabase db push`.
-- "Xoá dữ liệu của tôi" xoá theo cascade (FK auth.users), không cần sửa `delete_my_data`.

-- =====================================================================================
-- Hàm nội bộ dùng trong định nghĩa bảng
-- =====================================================================================

-- Ngày hiện tại theo giờ Việt Nam: tính trần ngày và quà mỗi ngày. now() là giờ bắt đầu
-- transaction, nên mọi chỗ trong một lần gọi RPC thấy cùng một ngày.
create or replace function public.chalk_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh' /* @economy CHALK_DAY_TIMEZONE */)::date;
$$;

-- =====================================================================================
-- Bảng
-- =====================================================================================

-- Sổ phấn: mỗi lần cộng / trừ một dòng, không bao giờ sửa hay xoá (trừ khi xoá tài khoản).
-- `ref` là khoá chống ghi trùng của nguồn: party = do game server đặt (vd `room_code:thời điểm`),
-- brain = id lượt Kiểm tra não, daily = ngày (YYYY-MM-DD), gacha / refund = id lượt quay
-- (`gacha_pulls.batch_id` = mã yêu cầu `p_request_id` của web nếu có), practice = null (mỗi lượt
-- luyện tập một dòng). Unique bỏ qua ref null.
-- Dòng `amount = 0` là lần thưởng đã bị trần ngày kẹp hết (giữ lại để `grant_chalk` idempotent).
create table public.chalk_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null
    check (source in ('party', 'brain', 'practice', 'daily', 'gacha', 'refund', 'admin')),
  ref text check (ref is null or char_length(ref) between 1 and 100),
  amount integer not null check (amount between -1000000 and 1000000),
  day date not null default public.chalk_today(),
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);

-- Danh mục phụ kiện (khớp COSMETIC_ITEMS ở packages/shared/src/cosmetics/catalog.ts).
-- `active = false`: máy quay không bốc ra nữa, người đã có vẫn giữ.
create table public.cosmetic_items (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{0,39}$'),
  slot text not null check (slot in ('head', 'face', 'neck')),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  active boolean not null default true
);

-- Món đã sở hữu. `pulls` = số lần quay ra món này (lần đầu 1, mỗi lần trùng + 1).
create table public.user_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.cosmetic_items (id),
  obtained_at timestamptz not null default now(),
  pulls integer not null default 1 check (pulls >= 1),
  primary key (user_id, item_id)
);

-- Bộ đếm bảo hiểm của mỗi người (`GachaPityState` của shared): số lần đã quay kể từ món Sử thi
-- trở lên / Huyền thoại gần nhất. Chưa có dòng = chưa quay lần nào (mọi số là 0).
create table public.gacha_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  since_epic integer not null default 0 check (since_epic >= 0),
  since_legendary integer not null default 0 check (since_legendary >= 0),
  total_pulls integer not null default 0 check (total_pulls >= 0),
  updated_at timestamptz not null default now()
);

-- Lịch sử quay: mỗi lần quay một dòng; các lần của cùng một lượt (1 hoặc 10) chung `batch_id`.
create table public.gacha_pulls (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  batch_id uuid not null,
  item_id text not null references public.cosmetic_items (id),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  duplicate boolean not null,
  refund integer not null default 0 check (refund >= 0),
  created_at timestamptz not null default now()
);

comment on table public.chalk_ledger is
  'Sổ phấn (CR-023): số dư = tổng amount. Chỉ ghi qua RPC / game server, không sửa dòng cũ.';
comment on table public.cosmetic_items is
  'Danh mục 24 phụ kiện (CR-023), khớp COSMETIC_ITEMS của shared. active = false: không bốc ra nữa.';
comment on table public.user_items is
  'Phụ kiện đã sở hữu (CR-023). pulls = số lần quay ra món này.';
comment on table public.gacha_state is
  'Bộ đếm bảo hiểm máy quay (CR-023): số lần quay kể từ Sử thi+ / Huyền thoại gần nhất.';
comment on table public.gacha_pulls is
  'Lịch sử quay (CR-023); các lần trong một lượt chung batch_id.';

-- =====================================================================================
-- Seed danh mục (thứ tự theo chỗ rồi độ hiếm, như catalog.ts)
-- =====================================================================================

insert into public.cosmetic_items (id, slot, rarity) values
  -- Đầu
  ('beanie', 'head', 'common'),
  ('bow', 'head', 'common'),
  ('cap', 'head', 'common'),
  ('flower-crown', 'head', 'rare'),
  ('witch-hat', 'head', 'rare'),
  ('grad-cap', 'head', 'rare'),
  ('headphones', 'head', 'rare'),
  ('crown', 'head', 'epic'),
  ('cowboy', 'head', 'epic'),
  ('halo', 'head', 'legendary'),
  -- Mặt
  ('round-glasses', 'face', 'common'),
  ('sunglasses', 'face', 'common'),
  ('bandage', 'face', 'common'),
  ('heart-glasses', 'face', 'rare'),
  ('hero-mask', 'face', 'rare'),
  ('monocle', 'face', 'epic'),
  ('star-glasses', 'face', 'legendary'),
  -- Cổ
  ('scarf', 'neck', 'common'),
  ('bowtie', 'neck', 'common'),
  ('bell', 'neck', 'common'),
  ('cape', 'neck', 'rare'),
  ('lei', 'neck', 'rare'),
  ('pearls', 'neck', 'epic'),
  ('royal-cape', 'neck', 'legendary');

-- =====================================================================================
-- Index
-- =====================================================================================

-- Trần ngày: tổng / số lần cộng của một nguồn trong ngày. (Số dư dùng index của unique
-- (user_id, source, ref), cột đầu là user_id.)
create index chalk_ledger_user_source_day_idx on public.chalk_ledger (user_id, source, day);
-- Lịch sử quay của mình, mới nhất trước.
create index gacha_pulls_user_created_idx on public.gacha_pulls (user_id, created_at desc, id desc);

-- =====================================================================================
-- RLS
-- =====================================================================================

-- Bật RLS, không tạo policy: anon/authenticated không đọc/ghi thẳng được bảng nào.
alter table public.chalk_ledger enable row level security;
alter table public.cosmetic_items enable row level security;
alter table public.user_items enable row level security;
alter table public.gacha_state enable row level security;
alter table public.gacha_pulls enable row level security;

-- Chặn thêm một lớp ở mức quyền bảng (Supabase mặc định cấp mọi quyền cho anon/authenticated).
revoke all on table public.chalk_ledger from anon, authenticated;
revoke all on table public.cosmetic_items from anon, authenticated;
revoke all on table public.user_items from anon, authenticated;
revoke all on table public.gacha_state from anon, authenticated;
revoke all on table public.gacha_pulls from anon, authenticated;
revoke all on sequence public.chalk_ledger_id_seq from anon, authenticated;
revoke all on sequence public.gacha_pulls_id_seq from anon, authenticated;

-- =====================================================================================
-- Hàm nội bộ (không gọi được qua API)
-- =====================================================================================

-- Trọng số bốc độ hiếm (GACHA_RATES, số nguyên phần trăm).
create or replace function public.gacha_rate(p_rarity text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_rarity
    when 'common' then 60 /* @economy GACHA_RATES.common */
    when 'rare' then 30 /* @economy GACHA_RATES.rare */
    when 'epic' then 8 /* @economy GACHA_RATES.epic */
    when 'legendary' then 2 /* @economy GACHA_RATES.legendary */
    else 0
  end;
$$;

-- Phấn đổi lại khi quay trùng món (DUPLICATE_REFUND).
create or replace function public.gacha_refund(p_rarity text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_rarity
    when 'common' then 10 /* @economy DUPLICATE_REFUND.common */
    when 'rare' then 30 /* @economy DUPLICATE_REFUND.rare */
    when 'epic' then 80 /* @economy DUPLICATE_REFUND.epic */
    when 'legendary' then 200 /* @economy DUPLICATE_REFUND.legendary */
    else 0
  end;
$$;

-- Số phấn thực cộng sau khi kẹp trần ngày của nguồn — làm y hệt `capChalkGrant` của shared:
-- nguồn có trần số lần (brain, practice) đã đủ số lần hôm nay → 0; nguồn có trần phấn (party) →
-- min(p_amount, trần − đã cộng hôm nay), không âm; p_amount ≤ 0 → 0; nguồn khác → không kẹp.
-- "Số lần" chỉ đếm lần cộng được > 0. Người gọi phải giữ khoá `chalk:<user_id>` (chống đua).
create or replace function public.chalk_capped(p_user uuid, p_source text, p_amount int)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_want int := greatest(coalesce(p_amount, 0), 0);
  v_chalk bigint;
  v_grants bigint;
begin
  if v_want = 0 then
    return 0;
  end if;

  select coalesce(sum(l.amount), 0), count(*)
    into v_chalk, v_grants
  from public.chalk_ledger l
  where l.user_id = p_user
    and l.source = p_source
    and l.day = public.chalk_today()
    and l.amount > 0;

  if p_source = 'party' then
    return greatest(0, least(v_want, 300 /* @economy CHALK_DAILY_CAPS.party.maxChalk */ - v_chalk))::int;
  elsif p_source = 'brain' then
    return case when v_grants >= 3 /* @economy CHALK_DAILY_CAPS.brain.maxGrants */ then 0 else v_want end;
  elsif p_source = 'practice' then
    return case when v_grants >= 10 /* @economy CHALK_DAILY_CAPS.practice.maxGrants */ then 0 else v_want end;
  end if;
  return v_want;
end;
$$;

revoke execute on function public.chalk_today() from public, anon, authenticated;
revoke execute on function public.gacha_rate(text) from public, anon, authenticated;
revoke execute on function public.gacha_refund(text) from public, anon, authenticated;
revoke execute on function public.chalk_capped(uuid, text, int) from public, anon, authenticated;

-- =====================================================================================
-- RPC cho game server (chỉ service_role)
-- =====================================================================================

-- Cộng phấn cho một người (thưởng trận party / Kiểm tra não; `admin` = chỉnh tay, không kẹp trần,
-- được âm). Idempotent theo (p_user, p_source, p_ref): gọi lại cùng bộ ba thì không cộng thêm và
-- trả đúng số đã cộng lần đầu (server gọi lại sau lỗi mạng vẫn báo đúng "+N phấn").
-- Trả số phấn thực cộng sau khi kẹp trần ngày (`chalk_capped`); bị kẹp hết vẫn ghi dòng 0 để giữ
-- idempotent. Người dùng không còn (đã xoá tài khoản) → 0, không ghi gì.
create or replace function public.grant_chalk(
  p_user uuid,
  p_source text,
  p_ref text,
  p_amount int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing int;
  v_actual int;
begin
  if p_user is null then
    raise exception 'p_user không hợp lệ' using errcode = '22023';
  end if;
  if p_source is null or p_source not in ('party', 'brain', 'practice', 'admin') then
    raise exception 'p_source phải là party, brain, practice hoặc admin' using errcode = '22023';
  end if;
  if p_ref is null or char_length(p_ref) not between 1 and 100 then
    raise exception 'p_ref không hợp lệ' using errcode = '22023';
  end if;
  if p_amount is null or p_amount not between -100000 and 100000 then
    raise exception 'p_amount không hợp lệ' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('chalk:' || p_user::text, 0));

  select l.amount into v_existing
  from public.chalk_ledger l
  where l.user_id = p_user and l.source = p_source and l.ref = p_ref;
  if found then
    return v_existing;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user) then
    return 0;
  end if;

  v_actual := case
    when p_source = 'admin' then p_amount
    else public.chalk_capped(p_user, p_source, p_amount)
  end;

  insert into public.chalk_ledger (user_id, source, ref, amount)
  values (p_user, p_source, p_ref, v_actual)
  on conflict (user_id, source, ref) do nothing;

  return v_actual;
end;
$$;

-- Số liệu xét mở khoá bạn đồng hành của một người, JSON snake_case mà `parseUnlockStats` (shared)
-- đọc: { party_matches, party_wins, brain_best,
--        practice_best: { <game>: { <độ khó 0..3>: kỷ lục } },
--        party_category: { <nhóm>: { sum, matches } } }.
-- party_* đếm mọi dòng `match_results` (kể cả trận có bot); party_wins = placement 0;
-- brain_best = Điểm Não cao nhất mọi phiên bản luật; practice_best bỏ kỷ lục 0;
-- party_category cộng `category_scores` mọi trận, matches = số trận có khoá của nhóm đó.
create or replace function public.unlock_stats_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'party_matches', (
      select count(*) from public.match_results m where m.user_id = p_user
    ),
    'party_wins', (
      select count(*) from public.match_results m where m.user_id = p_user and m.placement = 0
    ),
    'brain_best', (
      select coalesce(max(b.brain_score), 0) from public.brain_tests b where b.user_id = p_user
    ),
    'practice_best', coalesce((
      select jsonb_object_agg(g.game_id, g.by_difficulty)
      from (
        select pb.game_id, jsonb_object_agg(pb.difficulty::text, pb.best_score) as by_difficulty
        from public.practice_bests pb
        where pb.user_id = p_user and pb.best_score > 0
        group by pb.game_id
      ) g
    ), '{}'::jsonb),
    'party_category', coalesce((
      select jsonb_object_agg(c.category, jsonb_build_object('sum', c.total, 'matches', c.matches))
      from (
        select e.key as category,
               sum(greatest(floor(e.value::numeric), 0))::bigint as total,
               count(*) as matches
        from public.match_results m
        cross join lateral jsonb_each(m.category_scores) as e (key, value)
        where m.user_id = p_user and jsonb_typeof(e.value) = 'number'
        group by e.key
      ) c
    ), '{}'::jsonb)
  );
$$;

-- =====================================================================================
-- RPC cho người chơi (gọi bằng supabase.rpc). Cần phiên: khách ẩn danh cũng là role authenticated.
-- =====================================================================================

-- Ví của mình:
-- { balance, since_epic, since_legendary, total_pulls, daily_claimed,
--   today: { party, brain, practice } }.
-- `today` tính theo đơn vị của trần từng nguồn: party = số phấn đã cộng hôm nay (trần 300),
-- brain / practice = số lần đã được cộng hôm nay (trần 3 / 10). `daily_claimed` = đã nhận quà hôm nay.
create or replace function public.my_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.chalk_today();
  v_balance bigint;
  v_state public.gacha_state;
  v_party bigint;
  v_brain bigint;
  v_practice bigint;
  v_daily boolean;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  select coalesce(sum(l.amount), 0) into v_balance
  from public.chalk_ledger l
  where l.user_id = v_uid;

  select * into v_state from public.gacha_state s where s.user_id = v_uid;

  select coalesce(sum(l.amount) filter (where l.source = 'party'), 0),
         count(*) filter (where l.source = 'brain'),
         count(*) filter (where l.source = 'practice'),
         coalesce(bool_or(l.source = 'daily'), false)
    into v_party, v_brain, v_practice, v_daily
  from public.chalk_ledger l
  where l.user_id = v_uid
    and l.day = v_today
    and l.amount > 0
    and l.source in ('party', 'brain', 'practice', 'daily');

  return jsonb_build_object(
    'balance', v_balance,
    'since_epic', coalesce(v_state.since_epic, 0),
    'since_legendary', coalesce(v_state.since_legendary, 0),
    'total_pulls', coalesce(v_state.total_pulls, 0),
    'daily_claimed', v_daily,
    'today', jsonb_build_object('party', v_party, 'brain', v_brain, 'practice', v_practice)
  );
end;
$$;

-- Quà mỗi ngày: cộng một lần mỗi ngày giờ VN (ref = ngày), trả số phấn vừa cộng; đã nhận → 0.
-- Hai máy bấm cùng lúc: ràng buộc unique chặn dòng thứ hai (máy sau nhận 0).
create or replace function public.claim_daily_chalk()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount int;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  insert into public.chalk_ledger (user_id, source, ref, amount)
  values (v_uid, 'daily', to_char(public.chalk_today(), 'YYYY-MM-DD'), 20 /* @economy DAILY_BONUS */)
  on conflict (user_id, source, ref) do nothing
  returning amount into v_amount;

  return coalesce(v_amount, 0);
end;
$$;

-- Quay máy p_count lần (1 hoặc 10). Thuật toán = `rollGachaBatch` + `pickGachaItem` của shared
-- (kế hoạch mục 5.3):
--   1. Tập độ hiếm được phép, theo ưu tiên: tới hạn Huyền thoại → chỉ Huyền thoại; tới hạn Sử thi →
--      Sử thi, Huyền thoại; lần cuối của gói 10 mà các lần trước toàn Thường → Hiếm trở lên; còn lại
--      → cả bốn.
--   2. r = floor(random() × tổng trọng số của tập); đi common → legendary, dừng ở độ hiếm đầu tiên
--      có r < trọng số.
--   3. Bộ đếm: Huyền thoại → cả hai về 0; Sử thi → since_epic về 0, since_legendary + 1; còn lại →
--      cả hai + 1. total_pulls + 1.
--   4. Chọn món đều nhau trong các món `active` của độ hiếm; riêng Huyền thoại chỉ bốc trong các món
--      Huyền thoại CHƯA CÓ, đủ cả rồi mới bốc đều. Đã có → trùng: `pulls` + 1, đổi lại phấn.
-- Trừ giá một dòng `gacha`, cộng tổng phấn trùng một dòng `refund` (ref = batch_id).
-- Trả { results: [{ item_id, rarity, duplicate, refund }], balance, since_epic, since_legendary,
--       replayed: false }.
--
-- Idempotent theo mã yêu cầu `p_request_id` (web tạo một uuid mỗi lần bấm quay, giữ nguyên khi
-- "Thử lại" sau hết giờ chờ): batch_id = p_request_id. Người này đã có lượt quay với mã đó → trả
-- lại đúng kết quả đã lưu (`results` như lần đầu, kể cả `duplicate`; `balance` / bảo hiểm lấy theo
-- hiện tại) kèm `replayed: true`, không trừ phấn, không quay (bỏ qua `p_count`). Lượt đầu lỗi
-- (`insufficient`, `unavailable`) thì transaction huỷ hết, không lưu mã → gọi lại quay như mới.
-- Không có mã (null) → hành vi cũ, mỗi lần gọi một lượt mới. Chỉ có MỘT bản hàm (2 tham số, mã
-- mặc định null): file này chưa chạy ở đâu nên không có bản `gacha_pull(int)` cũ cần drop, và
-- `rpc('gacha_pull', { p_count })` vẫn gọi đúng bản này.
create or replace function public.gacha_pull(p_count int, p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid := coalesce(p_request_id, gen_random_uuid());
  v_price int;
  v_balance bigint;
  v_since_epic int;
  v_since_legendary int;
  v_total_pulls int;
  v_any_rare boolean := false;
  v_pool text[];
  v_weight_sum int;
  v_r int;
  v_rarity text;
  v_item text;
  v_duplicate boolean;
  v_refund int;
  v_refund_sum int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  if p_count is null or p_count not in (1, 10 /* @economy GACHA_TEN_COUNT */) then
    raise exception 'p_count phải là 1 hoặc 10' using errcode = '22023';
  end if;

  v_price := case
    when p_count = 10 /* @economy GACHA_TEN_COUNT */ then 900 /* @economy GACHA_PRICE_TEN */
    else 100 /* @economy GACHA_PRICE_SINGLE */
  end;

  -- Khoá theo người: hai lượt quay cùng lúc (hai tab, bấm đúp) chạy lần lượt.
  perform pg_advisory_xact_lock(hashtextextended('chalk:' || v_uid::text, 0));

  select coalesce(sum(l.amount), 0) into v_balance
  from public.chalk_ledger l
  where l.user_id = v_uid;

  -- Gọi lại cùng mã: kiểm SAU khoá (hai yêu cầu cùng mã đồng thời → yêu cầu sau chờ yêu cầu đầu
  -- commit, rồi câu lệnh này thấy dòng sổ của nó; unique (user_id, source, ref) chặn thêm một lớp)
  -- và TRƯỚC khi kiểm đủ phấn / trừ phấn (lượt đầu đã tiêu phấn thì gọi lại không được báo
  -- `insufficient` hay trừ lần hai).
  if p_request_id is not null and exists (
    select 1
    from public.chalk_ledger l
    where l.user_id = v_uid and l.source = 'gacha' and l.ref = p_request_id::text
  ) then
    select s.since_epic, s.since_legendary
      into v_since_epic, v_since_legendary
    from public.gacha_state s
    where s.user_id = v_uid;

    return jsonb_build_object(
      'results', coalesce((
        select jsonb_agg(jsonb_build_object(
          'item_id', g.item_id,
          'rarity', g.rarity,
          'duplicate', g.duplicate,
          'refund', g.refund
        ) order by g.id)
        from public.gacha_pulls g
        where g.user_id = v_uid and g.batch_id = p_request_id
      ), '[]'::jsonb),
      'balance', v_balance,
      'since_epic', coalesce(v_since_epic, 0),
      'since_legendary', coalesce(v_since_legendary, 0),
      'replayed', true
    );
  end if;

  if v_balance < v_price then
    raise exception 'insufficient' using errcode = 'P0001';
  end if;

  insert into public.gacha_state (user_id) values (v_uid)
  on conflict (user_id) do nothing;
  select s.since_epic, s.since_legendary, s.total_pulls
    into v_since_epic, v_since_legendary, v_total_pulls
  from public.gacha_state s
  where s.user_id = v_uid
  for update;

  insert into public.chalk_ledger (user_id, source, ref, amount)
  values (v_uid, 'gacha', v_batch::text, -v_price);

  for i in 1 .. p_count loop
    -- 1. Tập độ hiếm được phép.
    if v_since_legendary + 1 >= 60 /* @economy GACHA_PITY.legendary */ then
      v_pool := array['legendary'];
    elsif v_since_epic + 1 >= 15 /* @economy GACHA_PITY.epic */ then
      v_pool := array['epic', 'legendary'];
    elsif p_count = 10 /* @economy GACHA_TEN_COUNT */ and i = p_count and not v_any_rare then
      v_pool := array['rare', 'epic', 'legendary'];
    else
      v_pool := array['common', 'rare', 'epic', 'legendary'];
    end if;

    -- 2. Bốc độ hiếm theo trọng số. Vòng không thoát sớm (không xảy ra) thì giữ phần tử cuối,
    --    như bản tham chiếu.
    v_weight_sum := 0;
    foreach v_rarity in array v_pool loop
      v_weight_sum := v_weight_sum + public.gacha_rate(v_rarity);
    end loop;
    v_r := floor(random() * v_weight_sum)::int;
    foreach v_rarity in array v_pool loop
      exit when v_r < public.gacha_rate(v_rarity);
      v_r := v_r - public.gacha_rate(v_rarity);
    end loop;

    -- 3. Bộ đếm bảo hiểm.
    if v_rarity = 'legendary' then
      v_since_epic := 0;
      v_since_legendary := 0;
    elsif v_rarity = 'epic' then
      v_since_epic := 0;
      v_since_legendary := v_since_legendary + 1;
    else
      v_since_epic := v_since_epic + 1;
      v_since_legendary := v_since_legendary + 1;
    end if;
    v_total_pulls := v_total_pulls + 1;
    if v_rarity <> 'common' then
      v_any_rare := true;
    end if;

    -- 4. Chọn món. Huyền thoại: ưu tiên món chưa có (kể cả món vừa ra ở lần trước của gói này).
    v_item := null;
    if v_rarity = 'legendary' then
      select c.id into v_item
      from public.cosmetic_items c
      where c.rarity = 'legendary'
        and c.active
        and not exists (
          select 1 from public.user_items u where u.user_id = v_uid and u.item_id = c.id
        )
      order by random()
      limit 1;
    end if;
    if v_item is null then
      select c.id into v_item
      from public.cosmetic_items c
      where c.rarity = v_rarity and c.active
      order by random()
      limit 1;
    end if;
    if v_item is null then
      raise exception 'unavailable' using errcode = 'P0001';
    end if;

    v_duplicate := exists (
      select 1 from public.user_items u where u.user_id = v_uid and u.item_id = v_item
    );
    if v_duplicate then
      update public.user_items u
      set pulls = u.pulls + 1
      where u.user_id = v_uid and u.item_id = v_item;
      v_refund := public.gacha_refund(v_rarity);
    else
      insert into public.user_items (user_id, item_id) values (v_uid, v_item);
      v_refund := 0;
    end if;
    v_refund_sum := v_refund_sum + v_refund;

    insert into public.gacha_pulls (user_id, batch_id, item_id, rarity, duplicate, refund)
    values (v_uid, v_batch, v_item, v_rarity, v_duplicate, v_refund);

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'item_id', v_item,
      'rarity', v_rarity,
      'duplicate', v_duplicate,
      'refund', v_refund
    ));
  end loop;

  if v_refund_sum > 0 then
    insert into public.chalk_ledger (user_id, source, ref, amount)
    values (v_uid, 'refund', v_batch::text, v_refund_sum);
  end if;

  update public.gacha_state s
  set since_epic = v_since_epic,
      since_legendary = v_since_legendary,
      total_pulls = v_total_pulls,
      updated_at = now()
  where s.user_id = v_uid;

  return jsonb_build_object(
    'results', v_results,
    'balance', v_balance - v_price + v_refund_sum,
    'since_epic', v_since_epic,
    'since_legendary', v_since_legendary,
    'replayed', false
  );
end;
$$;

-- Món đã có, theo thứ tự nhận được. Chưa có gì → mảng rỗng (không phải null).
create or replace function public.my_items()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  return array(
    select u.item_id
    from public.user_items u
    where u.user_id = v_uid
    order by u.obtained_at, u.item_id
  );
end;
$$;

-- Lịch sử quay của mình, mới nhất trước. p_limit kẹp 1–100 (mặc định 30).
create or replace function public.gacha_history(p_limit int default 30)
returns table (
  id bigint,
  batch_id uuid,
  item_id text,
  rarity text,
  duplicate boolean,
  refund int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  return query
  select g.id, g.batch_id, g.item_id, g.rarity, g.duplicate, g.refund, g.created_at
  from public.gacha_pulls g
  where g.user_id = v_uid
  order by g.created_at desc, g.id desc
  limit v_limit;
end;
$$;

-- Số liệu mở khoá của mình (cùng JSON với `unlock_stats_for`).
create or replace function public.my_unlock_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  return public.unlock_stats_for(v_uid);
end;
$$;

-- Kỷ lục luyện tập (thay hàm ở 20261016000000_accounts.sql, giữ nguyên chữ ký, kiểm tra và kết quả
-- trả về): thêm cộng phấn luyện tập (PRACTICE_CHALK mỗi lượt, trần số lượt mỗi ngày như
-- `capChalkGrant('practice', …)`). Điểm chấm trên máy nên phấn thấp và trần thấp nhất.
create or replace function public.submit_practice_result(
  p_game_id text,
  p_difficulty int,
  p_score int,
  p_correct int
)
returns public.practice_bests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.practice_bests;
  v_chalk int;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'p_game_id không hợp lệ' using errcode = '22023';
  end if;
  if p_difficulty is null or p_difficulty not between 0 and 3 then
    raise exception 'p_difficulty phải từ 0 tới 3' using errcode = '22023';
  end if;
  if p_score is null or p_score not between 0 and 1000000
     or p_correct is null or p_correct not between 0 and 10000 then
    raise exception 'p_score / p_correct không hợp lệ' using errcode = '22023';
  end if;

  insert into public.practice_bests as pb
    (user_id, game_id, difficulty, best_score, best_correct, plays, updated_at)
  values (v_uid, p_game_id, p_difficulty, p_score, p_correct, 1, now())
  on conflict (user_id, game_id, difficulty) do update set
    best_correct = case
      when excluded.best_score > pb.best_score then excluded.best_correct
      when excluded.best_score = pb.best_score then greatest(pb.best_correct, excluded.best_correct)
      else pb.best_correct
    end,
    best_score = greatest(pb.best_score, excluded.best_score),
    plays = pb.plays + 1,
    updated_at = now()
  returning * into v_row;

  -- Phấn luyện tập (CR-023): khoá theo người như grant_chalk để hai lượt cùng lúc không vượt trần.
  perform pg_advisory_xact_lock(hashtextextended('chalk:' || v_uid::text, 0));
  v_chalk := public.chalk_capped(v_uid, 'practice', 5 /* @economy PRACTICE_CHALK */);
  if v_chalk > 0 then
    insert into public.chalk_ledger (user_id, source, ref, amount)
    values (v_uid, 'practice', null, v_chalk);
  end if;

  return v_row;
end;
$$;

-- =====================================================================================
-- Quyền gọi RPC. Supabase mặc định cấp EXECUTE cho anon/authenticated (và PUBLIC) nên phải
-- revoke riêng.
-- =====================================================================================

-- Chỉ game server (khoá secret).
revoke execute on function public.grant_chalk(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.unlock_stats_for(uuid) from public, anon, authenticated;
grant execute on function public.grant_chalk(uuid, text, text, int) to service_role;
grant execute on function public.unlock_stats_for(uuid) to service_role;

-- Mọi phiên (kể cả khách ẩn danh), không cho anon.
revoke execute on function public.my_wallet() from public, anon;
revoke execute on function public.claim_daily_chalk() from public, anon;
revoke execute on function public.gacha_pull(int, uuid) from public, anon;
revoke execute on function public.my_items() from public, anon;
revoke execute on function public.gacha_history(int) from public, anon;
revoke execute on function public.my_unlock_stats() from public, anon;
revoke execute on function public.submit_practice_result(text, int, int, int) from public, anon;

grant execute on function public.my_wallet() to authenticated;
grant execute on function public.claim_daily_chalk() to authenticated;
grant execute on function public.gacha_pull(int, uuid) to authenticated;
grant execute on function public.my_items() to authenticated;
grant execute on function public.gacha_history(int) to authenticated;
grant execute on function public.my_unlock_stats() to authenticated;
grant execute on function public.submit_practice_result(text, int, int, int) to authenticated;
