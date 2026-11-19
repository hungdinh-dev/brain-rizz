# Kế hoạch trang quản trị, phòng 12 người, vòng quay dọc

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế + làm: [CR-017](../00-tracking/change-requests.md#cr-017), [CR-018](../00-tracking/change-requests.md#cr-018), [CR-019](../00-tracking/change-requests.md#cr-019) duyệt 2026-11-19, nhánh `feat/admin-12-players` |
| Phiên bản tài liệu | 0.1 · 2026-11-19 · bản đầu, chốt với chủ dự án |
| Liên quan | [SRS](srs.md) (UC-20, UC-24, FR-PH-03, FR-VC-12, FR-QT-*), [GDD](game-design.md) (điểm), [CR-006](../00-tracking/change-requests.md#cr-006) (hệ số theo game), [CR-015](../00-tracking/change-requests.md#cr-015) (thay bằng CR-017), [ADR 0011](../02-architecture/decisions/) (Supabase) |
| Cập nhật khi | Đổi hợp đồng (bảng, RPC, state, endpoint) ở mục 4 → sửa ở đây trước, rồi mới sửa code |

## 1. Tóm tắt

Ba việc chủ dự án yêu cầu ngày 2026-11-19:

1. **Phòng 12 người** (CR-018): `MAX_PLAYERS` 8 → 12, bảng màu avatar 12 màu, điểm trận theo thứ hạng **co giãn theo số người** thay cho bảng cố định 8 bậc.
2. **Vòng quay dọc vô hạn** (CR-017): thay vòng quay tròn 30 lát bằng **trống quay dọc kiểu bộ chọn giờ của iPhone**, cuộn vô hạn, mỗi dòng một game có biểu tượng + tên. **Ẩn danh sách "Trong vòng quay"** ở cạnh (máy tính) và hàng chip (điện thoại). Luật không đổi: mọi game chưa chơi đều có mặt.
3. **Trang quản trị** (CR-019): quản trị viên (bảng `admins` trên Supabase) chỉnh **công thức điểm + hệ số của trận party**, bật/tắt game, xem lịch sử đăng nhập, người chơi, trận đấu, số liệu tổng quan, phòng đang mở, danh sách quản trị viên, lịch sử thay đổi cấu hình.

## 2. Quyết định của chủ dự án (2026-11-19)

| Câu hỏi | Chọn |
| --- | --- |
| Ai là admin | **Bảng `admins` trên Supabase.** Đăng nhập Google như thường; admin đầu tiên thêm bằng một câu SQL. Mọi quyền kiểm tra bằng RLS + RPC `security definer`, không lộ khoá nào ra web. |
| Cấu hình điểm áp dụng cho | **Chỉ trận party.** Luyện tập và Kiểm tra não giữ công thức chuẩn (`DEFAULT_SCORING`) để bảng xếp hạng không lệch. |
| Điểm thứ hạng | **Co giãn theo số người:** hạng `r` (0 = nhất) trong phòng `N` ghế được `max(1, N − r) + thưởng top[r]`, thưởng top mặc định 3/2/1. 12 người: 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1. 8 người: 11, 9, 7, 5, 4, 3, 2, 1. 2 người: 5, 3. |
| Mục trong trang admin | Danh sách game, Công thức điểm, Lịch sử đăng nhập, Người chơi & trận đấu, **và tự phát triển thêm**: Tổng quan, Phòng đang mở, Quản trị viên, Lịch sử thay đổi cấu hình. |
| Vòng quay | **Không duyệt CR-015 (8 lát).** Trống quay dọc vô hạn kiểu đồng hồ iPhone, mỗi game có biểu tượng, ẩn danh sách bên cạnh. |

## 3. Phạm vi

**Có:** mục 1. **Không** (để CR sau): admin đóng phòng/đuổi người chơi, sửa/xoá dữ liệu người chơi, cấu hình điểm cho Luyện tập/Kiểm tra não, ghi IP (chỉ ghi "trình duyệt · hệ điều hành" — có trẻ em chơi, giữ dữ liệu tối thiểu), bộ biểu tượng vẽ riêng cho 31 game (dòng trống quay dùng hình minh hoạ sẵn có, chừa chỗ `GameClient.Icon` để thay sau).

## 4. Hợp đồng giữa các phần

### 4.1 Shared (`packages/shared`) — backend-dev

**File mới `src/party-config.ts`:**

```ts
type Quad = [number, number, number, number]; // theo Difficulty 0..3

interface ScoringConfig {
  basePoints: number;          // 100   · số nguyên [10, 1000]
  maxSpeedBonus: number;       // 50    · số nguyên [0, 500]
  fastAnswerMs: number;        // 1500  · số nguyên [0, 10000]
  slowAnswerMs: number;        // 8000  · số nguyên (fastAnswerMs, 30000]
  streakThreshold: number;     // 3     · số nguyên [1, 10]
  streakBonusPerStep: number;  // 0.1   · [0, 1]
  maxComboMultiplier: number;  // 1.5   · [1, 5]
  difficultyMultiplier: Quad;  // [0.8, 1, 1.25, 1.5] · mỗi số (0, 5]
  gameMultipliers: Record<string, Quad>; // {} · ghi đè hệ số theo game id (chỉ id có trong GAME_IDS)
  placementTopBonus: [number, number, number]; // [3, 2, 1] · số nguyên [0, 50]
}
interface PartyConfig { version: number; scoring: ScoringConfig; disabledGames: string[] }
```

- `DEFAULT_SCORING` lấy từ các hằng số hiện có (`BASE_POINTS`, `MAX_SPEED_BONUS`… giữ nguyên tên và giá trị), `DEFAULT_PARTY_CONFIG = { version: 0, scoring: DEFAULT_SCORING, disabledGames: [] }`.
- `ScoringConfigSchema` (zod, đúng các giới hạn trên) — web dùng để kiểm form admin.
- `parseScoringConfig(raw: unknown): ScoringConfig` và `parsePartyConfig(raw: unknown): PartyConfig` **không bao giờ ném lỗi**: kiểm **từng trường riêng**, thiếu hoặc sai → giá trị mặc định của trường đó; `slowAnswerMs ≤ fastAnswerMs` → cả hai về mặc định; `gameMultipliers` bỏ id lạ và bộ số sai; `disabledGames` bỏ id lạ, bỏ trùng. Server **không tin DB** — mọi cấu hình đọc từ Supabase đi qua hàm này.
- `parseScoringJson(json: string): ScoringConfig` (JSON hỏng → mặc định) cho web đọc state.
- `enabledGameIds(disabled: readonly string[]): GameId[]` = `GAME_IDS` trừ game bị tắt; còn **ít hơn 2 game** thì trả `GAME_IDS` (không để trận kẹt).

**Sửa `scoring.ts`, `answer-judge.ts`, `match.ts`:**

- `pointsForCorrect(input, scoring = DEFAULT_SCORING)`, `comboMultiplier(streak, scoring = DEFAULT_SCORING)`.
- `gameMultiplier(game, difficulty, scoring = DEFAULT_SCORING)`: thứ tự `scoring.gameMultipliers[game.id]?.[d]` → `game.difficultyMultiplier?.[d]` (CR-006) → `scoring.difficultyMultiplier[d]`.
- `placementPoints(rank, playerCount, topBonus = DEFAULT_SCORING.placementTopBonus)` = `max(1, playerCount − rank) + (topBonus[rank] ?? 0)`; hạng bằng nhau (từ `rankByRound`) được cùng điểm.
- `judgeAnswer(…, now, scoring = DEFAULT_SCORING)` và `judgeBotAnswer(…, now, scoring = DEFAULT_SCORING)` truyền `scoring` xuống `settleAnswer`. Luyện tập, Kiểm tra não không truyền → công thức chuẩn. **Thời gian nghĩ của bot không phụ thuộc cấu hình admin** (vẫn theo hệ số game khai báo).
- `availableGames(played, all)` giữ nguyên; server truyền `all = enabledGameIds(disabled)`.

**`constants.ts`:** `MAX_PLAYERS = 12`; `AVATAR_COLORS` thêm 4 màu (12 màu, ui-designer duyệt). **`protocol.ts` — `PartyStateView` thêm:**

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `disabledGames` | `string[]` | Game admin tắt — không có trên trống quay, không chọn/bầu được ở trận này |
| `scoringJson` | `string` | `JSON.stringify(ScoringConfig)` của trận hiện tại; web đọc bằng `parseScoringJson` để hiện hệ số và điểm thứ hạng |
| `configVersion` | `number` | `party_settings.version` đang áp dụng (0 = mặc định trong code) |

Không thêm tin nhắn client → server. Seed và bộ sinh câu đố **không đổi**.

### 4.2 Game server (`apps/server`) — backend-dev

- `PartyState` thêm 3 trường trên (bất biến 5).
- **Nạp cấu hình:** `ResultStore` thêm `loadPartyConfig(): Promise<PartyConfig | null>` (Supabase: đọc `party_settings` id 1 bằng khoá secret rồi `parsePartyConfig`; bản rỗng → `null`; lỗi → `null`, không ném) và `isAdmin(userId): Promise<boolean>`. Bộ nhớ đệm 30 giây trong tiến trình; `invalidatePartyConfig()` xoá đệm. `null` → giữ cấu hình đã có, chưa có thì `DEFAULT_PARTY_CONFIG`.
- **Khi nào áp dụng:** nạp lúc tạo phòng và **mỗi lần bắt đầu trận** (`beginMatch`: bắt đầu từ phòng chờ, Chơi lại). Cả trận dùng một bản chụp; admin đổi giữa trận thì trận sau mới áp dụng.
- **Dùng cấu hình:** `AnswerJudge` truyền `scoring` cho `judgeAnswer`/`judgeBotAnswer`; chốt vòng dùng `placementPoints(rank, số ghế, scoring.placementTopBonus)`; `spinWheel`, `requireAvailable`, `enterGameSelect` dùng `availableGames(played, enabledGameIds(disabledGames))`. Chọn/bầu game bị tắt → lỗi như game đã chơi.
- **12 người:** `maxClients`, `BotDriver`, chọn màu trống — đều theo hằng số mới. Load test (`loadtest/party.ts`) và NFR-REL-02 lên 12.
- **Ghi kết quả:** `MatchResultRecord.settingsVersion` → cột `match_results.settings_version`.
- **HTTP cho admin** (`app.config.ts`, file route riêng `src/admin/routes.ts`):
  - Xác thực: header `Authorization: Bearer <access token Supabase>` → `verifyToken` → `isAdmin`. Thiếu/sai token `401`, không phải admin `403`, chưa cấu hình Supabase `503`. CORS: `Access-Control-Allow-Origin: *`, cho phép header `Authorization`, trả `OPTIONS` 204 (không dùng cookie).
  - `GET /admin/rooms` → `{ serverTime: number, uptimeS: number, rooms: AdminRoomView[] }`, `AdminRoomView = { roomId, code, phase, round, totalRounds, gameId, humans, bots, connected, configVersion, createdAt }` (`createdAt` ISO). Chỉ phòng `party`; không lộ tên người chơi.
  - `POST /admin/config/reload` → xoá bộ đệm, nạp lại, trả `{ version }`. Web gọi sau khi lưu cấu hình để trận kế tiếp áp dụng ngay.
  - Kiểu `AdminRoomView` đặt trong `packages/shared/src/admin.ts` để web dùng chung.

### 4.3 Supabase — migration `supabase/migrations/20261119000000_admin_console.sql` — backend-dev (việc SQL)

**Bảng** (bật RLS, **không** có policy đọc/ghi cho client — chỉ qua RPC):

| Bảng | Cột chính |
| --- | --- |
| `admins` | `user_id uuid pk → auth.users on delete cascade`, `note text`, `added_by uuid null`, `created_at` |
| `party_settings` | một dòng `id smallint pk default 1 check (id = 1)`, `version int not null default 0`, `scoring jsonb not null default '{}'`, `disabled_games text[] not null default '{}'`, `updated_at`, `updated_by uuid null → auth.users on delete set null`; seed dòng `(1, 0, '{}', '{}')` |
| `party_settings_history` | `id bigserial`, `version`, `scoring`, `disabled_games`, `note text` (≤ 200), `changed_by`, `changed_at` |
| `login_events` | `id bigserial`, `user_id → auth.users on delete cascade`, `event text check in ('guest_created','google_sign_in','google_linked','session_resumed','sign_out')`, `provider text check in ('anonymous','google')`, `device text` (≤ 120), `created_at`; index `(created_at desc)`, `(user_id, created_at desc)` |
| `match_results` | thêm `settings_version integer not null default 0` |

**RPC** (`security definer`, `set search_path = ''`, grant `authenticated`). Hàm `admin_*` mở đầu bằng `if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;`. Ngày tính theo giờ `Asia/Ho_Chi_Minh`.

| RPC | Trả về |
| --- | --- |
| `is_admin() → boolean` | người gọi có trong `admins` |
| `log_login(p_event text, p_device text) → void` | ghi một dòng cho `auth.uid()`; `provider` lấy từ claim `is_anonymous`; `session_resumed` bỏ qua nếu người này đã có sự kiện bất kỳ trong 30 phút |
| `admin_overview(p_days int default 14) → jsonb` | `{ totals: { users, google_users, guest_users, admins, matches, brain_tests, practice_records }, today: { logins, active_users, new_users, matches }, daily: [{ day, logins, active_users, new_users, matches, brain_tests }] }` (`matches` = số trận, đếm theo `(room_code, created_at)`) |
| `admin_login_events(p_limit int default 50, p_before timestamptz default null, p_event text default null, p_query text default null)` | bảng `id, user_id, display_name, avatar, email, provider, event, device, created_at`, mới nhất trước; `p_query` lọc tên/email (ilike) |
| `admin_users(p_limit int default 50, p_offset int default 0, p_query text default null, p_provider text default null)` | bảng `user_id, display_name, avatar, email, provider, is_admin, created_at, last_sign_in_at, last_seen_at, matches, brain_tests, practice_records, total_count` |
| `admin_matches(p_limit int default 30, p_before timestamptz default null, p_before_room text default null)` | bảng `room_code, created_at, rounds, players, bot_count, games, settings_version, results jsonb` (`results` = `[{ user_id, display_name, avatar, placement, match_points, total_score }]` theo hạng), sắp `created_at desc, room_code desc`. Trang sau: con trỏ là cặp của trận cuối trang trước, `p_before` = `created_at`, `p_before_room` = `room_code` (lọc `created_at < p_before or (created_at = p_before and room_code < p_before_room)`, nên hai phòng xong cùng lúc không bị mất trận giữa hai trang) |
| `admin_game_stats(p_days int default 30)` (`null` = mọi lúc) | bảng `game_id, party_matches, brain_plays, brain_avg_score, practice_players, practice_plays` |
| `admin_get_party_settings() → jsonb` | `{ version, scoring, disabled_games, updated_at, updated_by_name }` |
| `admin_update_party_settings(p_scoring jsonb, p_disabled_games text[], p_note text default null) → int` | `version + 1`, ghi lịch sử, trả version mới; kiểm thô (object, ≤ 64 id, id ≤ 40 ký tự, note ≤ 200) — kiểm chi tiết ở web (zod) và server (`parsePartyConfig`) |
| `admin_settings_history(p_limit int default 20)` | bảng `id, version, scoring, disabled_games, note, changed_by_name, changed_at` |
| `admin_list_admins()` | bảng `user_id, display_name, email, note, created_at` |
| `admin_add_admin(p_email text, p_note text default null) → uuid` | chỉ tài khoản Google đã có; không thấy → lỗi `not-found` |
| `admin_remove_admin(p_user_id uuid) → void` | không tự xoá mình (`self`), không xoá admin cuối (`last-admin`) |

**Số trận chỉ tính trận có người đăng nhập:** server chỉ ghi `match_results` cho người có token hợp lệ (ADR 0011), nên "số trận" ở mọi nơi — `matches` của `admin_overview` (tổng, hôm nay, theo ngày), `party_matches` của `admin_game_stats` và danh sách `admin_matches` — chỉ gồm trận có **ít nhất một** người chơi đã xác thực. Trận toàn khách không có phiên (kể cả với bot) không có dòng nào nên không được đếm.

`delete_my_data()` sửa để xoá cả `login_events` của mình; quản trị viên **duy nhất** gọi thì bị chặn (lỗi `last-admin`, P0001, không xoá gì): muốn xoá thì thêm admin khác trước. Admin đầu tiên: `insert into public.admins (user_id, note) select id, 'chủ dự án' from auth.users where email = '<email>';` (ghi trong `docs/03-guides/supabase-setup.md`). **Thứ tự triển khai:** chạy migration **trước** khi deploy server mới (server luôn ghi `settings_version`).

### 4.4 Web (`apps/web`) — frontend-dev

- **Lối vào trang admin:** đường dẫn `/admin` (SPA, `_redirects` đã có) mở màn quản trị (tải lười, không nằm trong gói đầu), và nút "Trang quản trị" ở màn Tài khoản khi `is_admin()` đúng. Chưa đăng nhập Google / không phải admin / chưa kết nối Supabase → trạng thái riêng, không lộ dữ liệu.
- **Mục:** Tổng quan · Game · Điểm & hệ số (kèm lịch sử thay đổi) · Đăng nhập · Người chơi · Trận đấu · Phòng đang mở · Quản trị viên. Máy tính: cột menu trái; điện thoại: tab cuộn ngang.
- **Điểm & hệ số:** form kiểm bằng `ScoringConfigSchema`; **xem thử** điểm một câu (mức, giây trả lời, chuỗi) và bảng điểm thứ hạng cho 2…12 người, tính bằng chính hàm shared với bản nháp; "Khôi phục mặc định"; lưu kèm ghi chú → `admin_update_party_settings` → `POST /admin/config/reload` (lỗi reload chỉ cảnh báo: trận mới vẫn nhận sau ≤ 30 giây).
- **Game:** mọi game trong `GAME_IDS`: tên, nhóm, công tắc bật/tắt (giữ ≥ 2 game bật), hệ số hiệu lực 4 mức (ghi đè được, nút về mặc định của game), số liệu `admin_game_stats`.
- **Ghi đăng nhập:** `auth.store` gọi `log_login`: tạo khách → `guest_created`; quay về từ Google → `google_sign_in` hoặc `google_linked`; mở app khi đã có phiên → `session_resumed`; trước khi đăng xuất → `sign_out`. `device` = "trình duyệt · hệ điều hành" suy từ user agent (≤ 120 ký tự). Lỗi thì bỏ qua, không chặn luồng.
- **Trận party dùng cấu hình phòng:** `RoomDifficulty`, `RoundResults` hiện hệ số bằng `gameMultiplier(game, d, parseScoringJson(party.scoringJson))`; `MatchTotals` hiện điểm thứ hạng theo số ghế và `placementTopBonus`; trống quay và màn chọn/bầu bỏ game trong `party.disabledGames`.
- **Trống quay dọc** (CR-017) và **bố cục 12 người** theo bản mẫu ui-designer.
- Chữ trang admin ở gói lười riêng (`src/i18n/locales/admin/vi.ts`, `en.ts`), giống `solo/`.

## 5. Chia việc

| Bước | Phòng | Việc | File chính | Phụ thuộc |
| --- | --- | --- | --- | --- |
| A | backend-dev | Shared + game server (4.1, 4.2) + test | `packages/shared/src/**`, `apps/server/**`, GDD (điểm), overview | — |
| B | backend-dev | Migration + RPC (4.3), hướng dẫn Supabase | `supabase/migrations/20261119000000_admin_console.sql`, `docs/03-guides/supabase-setup.md` | — |
| C | ui-designer | Bản mẫu: trống quay dọc, phòng 12 người, trang admin; duyệt 4 màu avatar | canvas, `docs/01-product/ui-ux.md` | — |
| D | frontend-dev | Trống quay dọc, bố cục 12 người, hệ số/điểm theo cấu hình phòng | `features/game-select`, `lobby`, `play`, `results`, `home` (BotDialog), `i18n/locales/vi.ts`, `en.ts` | A, C |
| E | frontend-dev | Trang admin, ghi đăng nhập | `features/admin/**`, `net/admin-api.ts`, `stores/auth.store.ts`, `app/App.tsx`, `features/account`, `i18n/locales/admin/**`, `i18n/locales/solo/**` | A, B, C |
| F | qa-tester | Soát + test bổ sung, vòng sửa | — | D, E |

A, B, C chạy song song; D, E chạy song song (không chung file).

## 6. Rủi ro

| Rủi ro | Cách giảm |
| --- | --- |
| Admin nhập cấu hình làm điểm vô lý | Giới hạn trong `ScoringConfigSchema`, xem thử trước khi lưu, lịch sử + khôi phục mặc định |
| DB có dữ liệu hỏng/độc | Server luôn `parsePartyConfig`, sai trường nào về mặc định trường đó |
| Tắt quá nhiều game | Web giữ ≥ 2 game bật; `enabledGameIds` còn < 2 thì dùng cả danh mục |
| 12 người làm chật màn chơi trên điện thoại | Bản mẫu riêng cho bảng điểm 12 dòng; NFR-REL-02 load test 12 người |
| Lộ dữ liệu người chơi | Không policy đọc trực tiếp; RPC kiểm `is_admin()`; không ghi IP; endpoint server không trả tên |

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
