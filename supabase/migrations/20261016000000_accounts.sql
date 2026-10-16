-- Tài khoản, lịch sử điểm và bảng xếp hạng (CR-009, ADR 0011).
--
-- Ai ghi gì:
--   - Client (khoá publishable + phiên người chơi): chỉ `profiles` của mình, và `practice_bests`
--     qua RPC `submit_practice_result`.
--   - Game server (khoá secret, bỏ qua RLS): `brain_tests`, `brain_test_games`, `match_results`.
-- Bảng xếp hạng đọc qua RPC `security definer`, chỉ lộ user_id (định danh giả, để web tô dòng của
-- mình) + tên + nhân vật, không lộ email. Bảng `profiles` không đọc công khai được.
--
-- Chạy một lần trên project mới: SQL Editor (dán cả file) hoặc `supabase db push`.
-- Xem docs/03-guides/supabase-setup.md.

-- =====================================================================================
-- Bảng
-- =====================================================================================

-- Hồ sơ hiển thị trên bảng xếp hạng (qua RPC). Client tự đồng bộ tên + nhân vật.
-- Mọi bảng đều `on delete cascade` theo auth.users: xoá tài khoản Auth là xoá sạch dữ liệu.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 16 and btrim(display_name) <> ''),
  avatar text not null default 'khoi' check (char_length(avatar) between 1 and 32),
  updated_at timestamptz not null default now()
);

-- Một lượt Kiểm tra não (server ghi).
create table public.brain_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brain_score integer not null check (brain_score >= 0),
  difficulty smallint not null check (difficulty between 0 and 3),
  -- BRAIN_TEST_RULES_VERSION: bảng xếp hạng chỉ so các lượt cùng phiên bản luật.
  rules_version smallint not null check (rules_version >= 1),
  -- Category → điểm kỹ năng (5 nhóm).
  skills jsonb not null default '{}'::jsonb check (jsonb_typeof(skills) = 'object'),
  created_at timestamptz not null default now()
);

-- Điểm từng game trong một lượt Kiểm tra não (server ghi).
create table public.brain_test_games (
  id uuid primary key default gen_random_uuid(),
  brain_test_id uuid not null references public.brain_tests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 40),
  category text not null check (char_length(category) between 1 and 20),
  score integer not null check (score >= 0),
  correct integer not null check (correct >= 0),
  created_at timestamptz not null default now()
);

-- Kết quả trận party, mỗi người đã xác thực một dòng (server ghi khi trận vào podium).
create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  room_code text not null check (char_length(room_code) between 1 and 16),
  placement smallint not null check (placement >= 0), -- 0 = nhất
  players smallint not null check (players >= 1),
  match_points integer not null check (match_points >= 0),
  total_score integer not null check (total_score >= 0),
  rounds smallint not null check (rounds >= 1),
  games text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Kỷ lục luyện tập (client ghi qua RPC; không lên bảng xếp hạng).
create table public.practice_bests (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 40),
  difficulty smallint not null check (difficulty between 0 and 3),
  best_score integer not null default 0 check (best_score >= 0),
  best_correct integer not null default 0 check (best_correct >= 0),
  plays integer not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, difficulty)
);

-- =====================================================================================
-- Index
-- =====================================================================================

-- Lịch sử của mình (mới nhất trước).
create index brain_tests_user_created_idx on public.brain_tests (user_id, created_at desc);
create index brain_test_games_test_idx on public.brain_test_games (brain_test_id);
create index match_results_user_created_idx on public.match_results (user_id, created_at desc);

-- Bảng xếp hạng Điểm Não: lọc theo phiên bản luật + kỳ, lấy điểm cao nhất mỗi người.
create index brain_tests_rank_idx
  on public.brain_tests (rules_version, user_id, brain_score desc, created_at);
create index brain_tests_period_idx on public.brain_tests (rules_version, created_at);

-- Bảng xếp hạng từng game (lọc phiên bản luật qua brain_test_id → brain_tests).
create index brain_test_games_rank_idx
  on public.brain_test_games (game_id, user_id, score desc, created_at);
create index brain_test_games_period_idx on public.brain_test_games (game_id, created_at);

-- =====================================================================================
-- RLS
-- =====================================================================================

alter table public.profiles enable row level security;
alter table public.brain_tests enable row level security;
alter table public.brain_test_games enable row level security;
alter table public.match_results enable row level security;
alter table public.practice_bests enable row level security;

-- profiles: chỉ chủ đọc/ghi dòng của mình. Tên + nhân vật của người khác chỉ lộ qua RPC bảng xếp hạng.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Lịch sử: chỉ chủ đọc; không có policy ghi → client không ghi được (server dùng khoá secret).
create policy brain_tests_select_own on public.brain_tests
  for select to authenticated using (user_id = (select auth.uid()));
create policy brain_test_games_select_own on public.brain_test_games
  for select to authenticated using (user_id = (select auth.uid()));
create policy match_results_select_own on public.match_results
  for select to authenticated using (user_id = (select auth.uid()));
create policy practice_bests_select_own on public.practice_bests
  for select to authenticated using (user_id = (select auth.uid()));

-- Chặn thêm một lớp ở mức quyền bảng (Supabase mặc định cấp mọi quyền cho anon/authenticated).
revoke insert, update, delete, truncate on public.brain_tests from anon, authenticated;
revoke insert, update, delete, truncate on public.brain_test_games from anon, authenticated;
revoke insert, update, delete, truncate on public.match_results from anon, authenticated;
revoke insert, update, delete, truncate on public.practice_bests from anon, authenticated;
revoke delete, truncate on public.profiles from anon, authenticated;
revoke select, insert, update on public.profiles from anon;

-- =====================================================================================
-- Hàm nội bộ
-- =====================================================================================

-- Tự đặt updated_at khi sửa hồ sơ.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Mốc bắt đầu kỳ xếp hạng: 'week' = thứ Hai 00:00 giờ Việt Nam tuần này, 'all' = từ đầu.
create or replace function public.leaderboard_since(p_period text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_period = 'all' then
    return '-infinity'::timestamptz;
  elsif p_period = 'week' then
    return date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  end if;
  raise exception 'p_period phải là week hoặc all' using errcode = '22023';
end;
$$;

-- Kẹp số dòng trả về: mặc định 50, tối đa 100.
create or replace function public.leaderboard_limit(p_limit int)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- Điểm cao nhất mỗi người trong kỳ (Điểm Não), kèm hạng. Dùng chung cho leaderboard_brain/my_rank_brain.
create or replace function public.brain_best(p_period text, p_rules_version int)
returns table (rank int, user_id uuid, score int, achieved_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (b.user_id) b.user_id, b.brain_score as score, b.created_at as achieved_at
    from public.brain_tests b
    where b.rules_version = p_rules_version
      and b.created_at >= public.leaderboard_since(p_period)
    order by b.user_id, b.brain_score desc, b.created_at asc
  )
  select (rank() over (order by best.score desc))::int, best.user_id, best.score, best.achieved_at
  from best;
$$;

-- Như trên cho một game, trong các lượt Kiểm tra não cùng phiên bản luật.
create or replace function public.game_best(p_game_id text, p_period text, p_rules_version int)
returns table (rank int, user_id uuid, score int, achieved_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.score, g.created_at as achieved_at
    from public.brain_test_games g
    join public.brain_tests b on b.id = g.brain_test_id
    where g.game_id = p_game_id
      and b.rules_version = p_rules_version
      and g.created_at >= public.leaderboard_since(p_period)
    order by g.user_id, g.score desc, g.created_at asc
  )
  select (rank() over (order by best.score desc))::int, best.user_id, best.score, best.achieved_at
  from best;
$$;

-- Hàm nội bộ: không ai gọi trực tiếp qua API (Supabase mặc định cấp EXECUTE cho anon/authenticated).
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.leaderboard_since(text) from public, anon, authenticated;
revoke execute on function public.leaderboard_limit(int) from public, anon, authenticated;
revoke execute on function public.brain_best(text, int) from public, anon, authenticated;
revoke execute on function public.game_best(text, text, int) from public, anon, authenticated;

-- =====================================================================================
-- RPC (gọi bằng supabase.rpc)
-- =====================================================================================

-- Kỷ lục luyện tập: giữ điểm cao nhất (kèm số câu đúng của lượt đó), plays + 1.
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

  return v_row;
end;
$$;

-- Bảng xếp hạng Điểm Não: điểm cao nhất mỗi người trong kỳ, bằng điểm cùng hạng.
create or replace function public.leaderboard_brain(
  p_period text,
  p_limit int,
  p_rules_version int
)
returns table (
  rank int,
  user_id uuid,
  display_name text,
  avatar text,
  score int,
  achieved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank, r.user_id, p.display_name, p.avatar, r.score, r.achieved_at
  from public.brain_best(p_period, p_rules_version) r
  left join public.profiles p on p.id = r.user_id
  order by r.rank, r.achieved_at, r.user_id
  limit public.leaderboard_limit(p_limit);
$$;

-- Bảng xếp hạng một minigame (điểm game đó trong các lượt Kiểm tra não).
create or replace function public.leaderboard_game(
  p_game_id text,
  p_period text,
  p_limit int,
  p_rules_version int
)
returns table (
  rank int,
  user_id uuid,
  display_name text,
  avatar text,
  score int,
  achieved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank, r.user_id, p.display_name, p.avatar, r.score, r.achieved_at
  from public.game_best(p_game_id, p_period, p_rules_version) r
  left join public.profiles p on p.id = r.user_id
  order by r.rank, r.achieved_at, r.user_id
  limit public.leaderboard_limit(p_limit);
$$;

-- Hạng Điểm Não của mình trong kỳ; rỗng nếu chưa có lượt nào.
create or replace function public.my_rank_brain(p_period text, p_rules_version int)
returns table (rank int, score int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank, r.score
  from public.brain_best(p_period, p_rules_version) r
  where r.user_id = auth.uid();
$$;

-- Hạng của mình ở một minigame trong kỳ; rỗng nếu chưa có.
create or replace function public.my_rank_game(p_game_id text, p_period text, p_rules_version int)
returns table (rank int, score int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank, r.score
  from public.game_best(p_game_id, p_period, p_rules_version) r
  where r.user_id = auth.uid();
$$;

-- "Xoá dữ liệu của tôi": xoá luôn tài khoản Auth của người gọi; 5 bảng xoá theo cascade (FK
-- `on delete cascade`). Phiên trên máy không còn dùng được: client tự signOut (scope local) sau đó.
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- Quyền gọi RPC: bảng xếp hạng ai cũng xem được; còn lại cần phiên (khách ẩn danh cũng là
-- role authenticated).
revoke execute on function public.submit_practice_result(text, int, int, int) from public, anon;
revoke execute on function public.leaderboard_brain(text, int, int) from public;
revoke execute on function public.leaderboard_game(text, text, int, int) from public;
revoke execute on function public.my_rank_brain(text, int) from public, anon;
revoke execute on function public.my_rank_game(text, text, int) from public, anon;
revoke execute on function public.delete_my_data() from public, anon;

grant execute on function public.submit_practice_result(text, int, int, int) to authenticated;
grant execute on function public.leaderboard_brain(text, int, int) to anon, authenticated;
grant execute on function public.leaderboard_game(text, text, int, int) to anon, authenticated;
grant execute on function public.my_rank_brain(text, int) to authenticated;
grant execute on function public.my_rank_game(text, text, int) to authenticated;
grant execute on function public.delete_my_data() to authenticated;
