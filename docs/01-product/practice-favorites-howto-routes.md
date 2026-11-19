# Kế hoạch game yêu thích, hướng dẫn động, tách URL

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế + làm: [CR-020](../00-tracking/change-requests.md#cr-020), [CR-021](../00-tracking/change-requests.md#cr-021), [CR-022](../00-tracking/change-requests.md#cr-022) duyệt 2026-11-19, nhánh `feat/admin-12-players` (làm tiếp sau commit `3c557d3`) |
| Phiên bản tài liệu | 0.2 · 2026-11-19 · điều phối chốt 5 điểm của ui-designer (UI-UX 6.10–6.11): nhãn ⭐ cố định "Yêu thích: {tên}" + `aria-pressed`; `Demo` có `loops`/`onEnd`; điện thoại đưa nút chính lên dưới ô độ khó; thẻ điện thoại gọn 1 dòng, đủ thông tin trong Phóng to; biểu tượng kỷ lục ⭐ → cúp (0.1: bản đầu) |
| Liên quan | [SRS](srs.md) (UC-13, UC-21, FR-MR-17, FR-GD-13, FR-GD-14), [UI-UX](ui-ux.md), [admin-console.md](admin-console.md) (`/admin`), ADR 0010 (không 3D), ADR 0011 (Supabase) |
| Cập nhật khi | Đổi hợp đồng ở mục 3 (bảng/RPC, khoá localStorage, bản đồ URL, kiểu `GameClient`) → sửa ở đây trước |

## 1. Tóm tắt

1. **Game yêu thích** (CR-020): ⭐ trên thẻ game ở Luyện tập; mục **Yêu thích** đứng đầu danh sách. Lưu trên máy ngay, đồng bộ lên tài khoản khi có phiên.
2. **Hướng dẫn to và động** (CR-021): khung hướng dẫn lớn hơn + nút **Phóng to** toàn màn; hình minh hoạ chuyển động (SVG + CSS) diễn cách chơi, dùng chung một "khung diễn". Đợt này: 5 game MVP (Kẻ lạc đàn, Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình); 25 game còn lại làm sau khi chủ dự án duyệt.
3. **Tách URL** (CR-022): mỗi màn ngoài phòng có đường dẫn riêng; Back/Forward/F5 giữ đúng màn; trong phòng giữ `/r/<mã>`.

## 2. Quyết định (chủ dự án duyệt 2026-11-19)

| Câu hỏi | Chọn | Lý do |
| --- | --- | --- |
| Yêu thích lưu ở đâu | Máy + tài khoản (khi có phiên) | Đổi máy vẫn còn; không tạo phiên khách chỉ để lưu yêu thích |
| Cách làm hướng dẫn động | **A. SVG động** (khung diễn dùng chung, chỉ `transform`/`opacity`) | Gần như không tốn hiệu năng; B (chạy scene Phaser) nặng, trái bất biến 4 và cần hàm giải cho 30 game; C (video) 6–15 MB |
| Phạm vi hướng dẫn động | 5 game MVP trước, duyệt rồi mới làm tiếp | Phần vẽ tốn công |
| Router | Tự đồng bộ History API trong `nav.store` (mở rộng phần đã có cho `/admin`), **không** thêm thư viện | 0 KB; react-router thêm ~20 KB gzip cho gói đầu |
| URL trong phòng | Giữ `/r/<mã>`, không tách theo pha | Pha do server quyết; Back/F5 không được làm lệch trận |

## 3. Hợp đồng

### 3.1 Yêu thích — dữ liệu (backend-dev + frontend-dev)

**Supabase** — migration `supabase/migrations/20261119100000_practice_favorites.sql`:

- Bảng `practice_favorites (user_id uuid → auth.users on delete cascade, game_id text check (game_id ~ '^[a-z0-9-]{1,40}$'), created_at timestamptz default now(), primary key (user_id, game_id))`. RLS bật, **không** policy; revoke bảng khỏi anon/authenticated (chỉ qua RPC).
- RPC (`security definer`, `set search_path = ''`, grant `authenticated`, revoke `public`/`anon`; `auth.uid()` null → lỗi 28000):

| RPC | Hành vi |
| --- | --- |
| `practice_favorites_get() → text[]` | Danh sách của mình, theo `created_at` |
| `practice_favorites_set(p_game_id text, p_favorite boolean) → void` | Thêm (bỏ qua nếu đã có) / xoá; tối đa 64 game mỗi người (quá thì lỗi `limit`, P0001); id sai dạng → 22023 |
| `practice_favorites_merge(p_game_ids text[]) → text[]` | Gộp (hợp) danh sách trên máy vào tài khoản, bỏ id sai dạng, trần 64; trả danh sách sau gộp |

- "Xoá dữ liệu của tôi" xoá theo cascade (FK `auth.users`), không cần sửa `delete_my_data`.

**Web:**

- Khoá `brain-rizz:favorites` (thêm vào `STORAGE_KEYS`): `{ ids: string[], synced: boolean, userId: string | null }` (`userId` = tài khoản lần đồng bộ cuối, `null` = chưa từng đồng bộ). `ids` theo thứ tự thêm; đọc vào thì bỏ id không có trong `GAME_IDS`.
- Bấm ⭐: đổi `ids` ngay (lạc quan); có phiên thì gọi `practice_favorites_set`, lỗi thì đặt `synced = false` (không hoàn tác trên máy).
- Mở Luyện tập khi có phiên: `userId` null, hoặc cùng tài khoản mà `synced = false` → `practice_favorites_merge(ids)`; cùng tài khoản và `synced = true` → `practice_favorites_get()`; **khác tài khoản** → `practice_favorites_get()` (lấy danh sách của tài khoản mới, không trộn ⭐ của người trước). Kết quả thay `ids`, đặt `synced = true`. Không có phiên / chưa cấu hình Supabase → chỉ dùng máy, không báo lỗi.
- Gọi Supabase trong `net/data-api.ts` (DataResult, không ném).

### 3.2 Yêu thích — giao diện

- Thẻ game ở `PracticePick`: nút ⭐ (vùng chạm ≥ 44 px, `aria-pressed`, nhãn "Thêm vào yêu thích"/"Bỏ yêu thích"), không làm mở game khi bấm sao.
- Mục **Yêu thích** đầu danh sách khi có ≥ 1 game (cả khi đang lọc "Tất cả"); chip lọc **Yêu thích** cạnh các chip nhóm. Trống: dòng gợi ý "Bấm ⭐ để ghim game hay chơi".
- ⭐ cũng có ở đầu màn hướng dẫn của Luyện tập (`PracticeSetup`). Thông số cụ thể theo bản mẫu ui-designer (UI-UX 6.10).

### 3.3 Hướng dẫn động (ui-designer + frontend-dev)

- `GameClient` thêm trường tuỳ chọn `Demo?: ComponentType<{ className?: string; playing?: boolean; loops?: number; onEnd?: () => void }>` (`loops` mặc định vô hạn; thẻ hướng dẫn chạy 3 vòng rồi hiện "Xem lại", dừng ở khung tĩnh). Có `Demo` thì màn hướng dẫn dùng `Demo`, không có thì dùng `Illustration` tĩnh như cũ.
- **Không** dùng `Demo` ở thẻ nhỏ (`GameThumb`, lưới chọn game, trống quay): ở đó vẫn là `Illustration` tĩnh, để không chạy 30 hoạt ảnh cùng lúc.
- Khung diễn dùng chung `apps/web/src/games/_shared/demo/`: con trỏ bàn tay, sóng chạm, dấu ✓/✗, chuyển câu, đồng hồ dòng thời gian lặp (4–6 giây). Mỗi game chỉ khai báo các "cảnh" (vị trí chạm, thứ tự, đối tượng đổi trạng thái).
- Chỉ animate `transform`, `opacity` (CSS keyframes hoặc Web Animations API); không animate `filter`, `d` của path, kích thước layout. Dừng khi: `useReducedMotion` (hiện khung cuối tĩnh), tab ẩn, demo không còn trên màn (IntersectionObserver), hoặc `playing = false`.
- Không thêm canvas WebGL (bất biến 4), không thêm file ảnh/video.
- Màn dùng: Hướng dẫn party (`GuideCard`), Luyện tập (`PracticeSetup`), Kiểm tra não (`BrainGameIntro`). Khung minh hoạ to hơn; nút **Phóng to** mở hộp thoại/sheet toàn màn chỉ chứa demo + 3 bước.

### 3.4 Bản đồ URL (frontend-dev)

| Đường dẫn | Màn | Ghi chú |
| --- | --- | --- |
| `/` | Giới thiệu / menu | Như cũ |
| `/profile` | Chọn bạn đồng hành | |
| `/practice` | Luyện tập · chọn game | |
| `/practice/<gameId>` | Luyện tập · hướng dẫn game đó | Đếm ngược/chơi/kết quả vẫn ở URL này (không đẩy lịch sử); `gameId` lạ → `/practice` (replace) |
| `/brain-test` | Kiểm tra não | Pha trong phòng do server quyết, một URL |
| `/leaderboard`, `/leaderboard/<gameId>` | Bảng xếp hạng Điểm Não / theo game | `gameId` lạ → `/leaderboard` |
| `/account` | Tài khoản & lịch sử | Quay về từ Google vẫn chạy như cũ |
| `/admin`, `/admin/<mục>` | Trang quản trị | `<mục>`: overview, games, scoring, logins, players, matches, rooms, admins |
| `/r/<mã>` | Link mời / trong phòng | Như cũ; không tách theo pha |
| khác | → `/` (replace) | |

- Người dùng chuyển màn → `pushState`; sửa đường dẫn sai / chuyển hướng → `replaceState`. `popstate` → đổi màn **không** đẩy thêm lịch sử.
- Chưa có hồ sơ mà mở link sâu → qua màn chọn bạn đồng hành rồi về đúng màn đó.
- Đang ở trong phòng (party hoặc Kiểm tra não) mà bấm Back → hỏi "Rời phòng?" (dùng hộp thoại sẵn có); đồng ý thì rời phòng rồi về màn trước, không thì ở lại (đẩy lại mục lịch sử).
- Đang đếm ngược/chơi Luyện tập mà bấm Back → như nút Thoát hiện có ("Bỏ lượt này?").
- Hàm thuần `screenForPath`/`pathForScreen` + test (khứ hồi, id lạ, `/admin/<mục>`, `/r/<mã>`).

## 4. Chia việc

| Bước | Phòng | Việc | File chính | Phụ thuộc |
| --- | --- | --- | --- | --- |
| A | backend-dev | Migration + RPC yêu thích, hướng dẫn Supabase | `supabase/migrations/20261119100000_practice_favorites.sql`, `docs/03-guides/supabase-setup.md` | — |
| B | ui-designer | Bản mẫu ⭐ + mục Yêu thích; khung hướng dẫn to + Phóng to; đặc tả khung diễn + kịch bản 5 game | canvas, `ui-ux.md` 6.10–6.11 | — |
| C | frontend-dev | Tách URL (3.4) | `stores/nav.store.ts`, `app/App.tsx`, `features/practice/practice.store.ts`, `PracticeScreen.tsx`, `features/leaderboard`, `features/admin` (mục), `features/account`, `features/home` (điều hướng) | — |
| D | frontend-dev | Yêu thích (3.1, 3.2) | `features/practice/components/PracticePick.tsx`, `PracticeSetup.tsx` (chỉ nút ⭐), `features/practice/favorites.ts`, `net/data-api.ts`, `lib/storage.ts`, `i18n/locales/solo/**` | A, B |
| E | frontend-dev | Khung diễn + 5 demo + khung hướng dẫn to (3.3) | `games/_shared/demo/**`, `games/<5 id>/*Demo.tsx`, `games/types.ts`, `features/game-intro/components/GuideCard.tsx`, `features/practice/components/PracticeSetup.tsx` (khung minh hoạ), `features/brain-test/components/BrainGameIntro.tsx`, `i18n/locales/vi.ts`, `en.ts` | B |
| F | qa-tester | Soát + thử trình duyệt | — | C, D, E |

A, B, C chạy song song; D, E song song sau B. D và E cùng sửa `PracticeSetup.tsx` ở hai chỗ khác nhau — sửa nhỏ, đọc lại file trước mỗi lần sửa.

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
