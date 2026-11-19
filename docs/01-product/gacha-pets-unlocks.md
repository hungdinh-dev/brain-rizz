# Kế hoạch gacha phụ kiện, thú mới, mở khoá bằng thành tích

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế + làm: [CR-023](../00-tracking/change-requests.md#cr-023), [CR-024](../00-tracking/change-requests.md#cr-024) — chủ dự án cho phép điều phối tự lên kế hoạch và triển khai (2026-11-19) |
| Phiên bản tài liệu | 0.1 · 2026-11-19 · bản đầu; số liệu kinh tế ở mục 4 là **xuất phát**, game-designer chỉnh bằng mô phỏng |
| Liên quan | [GDD](game-design.md), [SRS](srs.md) (UC-25, UC-26), [UI-UX](ui-ux.md), [admin-console.md](admin-console.md), [practice-favorites-howto-routes.md](practice-favorites-howto-routes.md) (URL, link sâu), ADR 0009 (nhân vật), ADR 0011 (Supabase) |
| Cập nhật khi | Đổi hợp đồng ở mục 5 (bảng, RPC, state, kiểu shared) → sửa ở đây trước |

## 1. Tóm tắt

Cho người chơi **lý do quay lại**:

1. **Phấn** (tiền trong game, không mua bằng tiền thật) kiếm được khi chơi: trận party, Kiểm tra não, luyện tập, quà mỗi ngày.
2. **Máy quay phụ kiện** (`/gacha`): tiêu phấn để quay ra phụ kiện (mũ, kính, khăn…) gắn lên nhân vật. Tỉ lệ công khai, có bảo hiểm, trùng món thì đổi lại phấn.
3. **Tủ đồ** (`/wardrobe`): mặc phụ kiện đã có (tối đa 1 món mỗi chỗ: đầu, mặt, cổ); cả phòng thấy.
4. **6 bạn đồng hành mới**, **khoá** cho tới khi đạt thành tích (vd "kỷ lục Bóng bay số ≥ 1 500 ở mức Thường", "trung bình nhóm Phân tích ≥ 1 200", "thắng 3 trận party"). Có thanh tiến độ và nút **Luyện ngay** dẫn tới đúng game.

## 2. Nguyên tắc (bắt buộc)

| Nguyên tắc | Cách làm |
| --- | --- |
| Không dùng tiền thật | Không nạp, không mua lượt, không quảng cáo đổi lượt. Phấn chỉ kiếm bằng chơi |
| Minh bạch | Màn quay hiện tỉ lệ từng độ hiếm và danh sách mọi món (đã có / chưa có); hiện bộ đếm bảo hiểm |
| Có bảo hiểm | Quay 10 lần chắc ≥ 1 món Hiếm; tối đa 15 lần chắc ra Sử thi trở lên; tối đa 60 lần chắc ra Huyền thoại |
| Trùng không phí | Trùng món → đổi lại phấn theo độ hiếm |
| Không gây áp lực | Không đồng hồ đếm ngược, không sự kiện giới hạn thời gian, không phạt mất chuỗi điểm danh; quà mỗi ngày nhận hay không tuỳ người |
| Server quyết | Số dư, quay, sở hữu, mở khoá tính trên Supabase / game server; client chỉ hiển thị. RNG quay chạy trong Postgres |
| Chống cày | Trần phấn mỗi ngày theo nguồn; trận chỉ có 1 người thật + bot nhận ít hơn |
| Khách cũng chơi được | Phiên khách ẩn danh có ví như tài khoản Google; liên kết Google giữ nguyên ví |

## 3. Nội dung

### 3.1 Phụ kiện (24 món, 3 chỗ, 4 độ hiếm)

| Chỗ | Thường (C) | Hiếm (R) | Sử thi (E) | Huyền thoại (L) |
| --- | --- | --- | --- | --- |
| Đầu (`head`) | `beanie` mũ len, `bow` nơ, `cap` mũ lưỡi trai | `flower-crown` vòng hoa, `witch-hat` mũ phù thuỷ, `grad-cap` mũ cử nhân, `headphones` tai nghe | `crown` vương miện, `cowboy` mũ cao bồi | `halo` vầng hào quang |
| Mặt (`face`) | `round-glasses` kính tròn, `sunglasses` kính râm, `bandage` băng dán | `heart-glasses` kính tim, `hero-mask` mặt nạ siêu nhân | `monocle` kính một tròng | `star-glasses` kính ngôi sao |
| Cổ (`neck`) | `scarf` khăn len, `bowtie` nơ cổ, `bell` vòng chuông | `cape` áo choàng, `lei` vòng hoa cổ | `pearls` chuỗi ngọc | `royal-cape` áo choàng hoàng gia |

Mỗi món vẽ một lần bằng SVG, đặt theo **điểm neo** của từng loài (đỉnh đầu, giữa hai mắt, cổ) — thêm vào `CharacterSpec`. Món nào cũng đeo được cho mọi loài (cả 6 cũ và 6 mới).

### 3.2 Bạn đồng hành mới (khoá)

| id | Tên | Loài | Điều kiện mở (xuất phát, game-designer chỉnh) |
| --- | --- | --- | --- |
| `pin` | Pin | cánh cụt | Chơi xong 10 trận party |
| `op` | Ộp | ếch | Kỷ lục Luyện tập **Bóng bay số** ≥ 1 500 ở mức Thường trở lên |
| `thong` | Thông | cú | Trung bình kỷ lục Luyện tập nhóm **Phân tích** ≥ 1 200 (ít nhất 3 game trong nhóm) |
| `gai` | Gai | nhím | Hạng nhất 3 trận party |
| `may` | Mây | koala | Điểm Não ≥ 600 trong một lần Kiểm tra não |
| `lua` | Lửa | rồng con | Trung bình điểm theo thể loại trong trận party ≥ 1 500 ở **cả 5** nhóm (mỗi nhóm ≥ 3 trận) |

6 nhân vật cũ (`khoi`, `bo`, `mochi`, `bap`, `cam`, `tron`) luôn mở.

## 4. Kinh tế (xuất phát — game-designer chỉnh bằng mô phỏng)

| Nguồn | Phấn | Trần mỗi ngày (giờ VN) |
| --- | --- | --- |
| Trận party (người đã có phiên, ghi ở `match_results`) | 10 + 5 × số vòng + thưởng hạng (nhất 20, nhì 12, ba 8); trận chỉ 1 người thật → × 0,5 | 400 |
| Kiểm tra não (ghi ở `brain_tests`) | 30 + Điểm Não / 20 | 3 lượt |
| Luyện tập (`submit_practice_result`, chấm trên máy nên trần thấp) | 5 mỗi lượt | 10 lượt |
| Quà mỗi ngày | 20 | 1 lần |

| Quay | Giá |
| --- | --- |
| 1 lần | 50 |
| 10 lần | 450 |

Tỉ lệ: C 60 % · R 30 % · E 8 % · L 2 %; bảo hiểm như mục 2. Trùng món đổi lại: C 5 · R 15 · E 40 · L 100.

## 5. Hợp đồng

### 5.1 Shared (`packages/shared/src/cosmetics/`) — game-designer

- `catalog.ts`: `COSMETIC_SLOTS = ["head","face","neck"]`, `RARITIES = ["common","rare","epic","legendary"]`, `COSMETIC_ITEMS` (24 dòng mục 3.1: `id`, `slot`, `rarity`), `isCosmeticId`, `sanitizeLoadout(ids)` (≤ 1 món mỗi chỗ, bỏ id lạ).
- `economy.ts`: hằng số mục 4 (`GACHA_PRICE_SINGLE`, `GACHA_PRICE_TEN`, `GACHA_RATES`, `GACHA_PITY`, `DUPLICATE_REFUND`, `CHALK_DAILY_CAPS`, `DAILY_BONUS`) và hàm thuần `partyChalkReward({ rounds, placement, humans })`, `brainChalkReward(brainScore)`.
- `unlocks.ts`: `BASE_CHARACTER_IDS` (6 cũ), `PET_CHARACTER_IDS` (6 mới), kiểu `UnlockRule` (`party-matches`, `party-wins`, `practice-best`, `practice-category-avg`, `party-category-avg`, `brain-score`, `all`), `UNLOCK_RULES: Record<PetId, UnlockRule>`, kiểu `UnlockStats` (mục 5.3) và hàm thuần `evaluateUnlock(rule, stats) → { unlocked, current, target }`, `unlockedCharacters(stats)`.
- `constants.ts`: `CHARACTER_IDS` = 6 cũ + 6 mới (`isCharacterId` nhận cả hai).
- Test: rule đúng biên; `sanitizeLoadout`; mô phỏng kinh tế (số trận trung bình để có 1 lượt quay, để đủ 24 món; số ngày để mở từng thú với người chơi điển hình); **test đọc file migration** kiểm `cosmetic_items` seed khớp `COSMETIC_ITEMS` và hằng số giá/tỉ lệ/bảo hiểm/trần trong SQL khớp `economy.ts`.

### 5.2 Giao thức + game server — backend-dev

- `PlayerView.accessories: string[]` (đã lọc, ≤ 3); `JoinOptions` và `setProfile` thêm `accessories?: string[]` (zod: ≤ 3, id ≤ 40 ký tự).
- **Kiểm sở hữu khi vào phòng / đổi hồ sơ:** nhân vật cũ luôn được; thú khoá và phụ kiện cần token hợp lệ → `ResultStore.loadCosmetics(userId) → { stats: UnlockStats, items: string[] }` (đệm 60 giây theo người) → `unlockedCharacters`, lọc phụ kiện theo `items`. Không có token / chưa mở / không sở hữu → **không từ chối vào phòng**, chỉ thay bằng nhân vật mặc định (`khoi`) / bỏ phụ kiện. Bot chỉ dùng 6 nhân vật cũ, không phụ kiện.
- **Thưởng phấn:** sau khi ghi `match_results` (vào `podium`) và `brain_tests`, server gọi `grant_chalk` cho từng người đã xác thực (số tính bằng hàm shared) rồi gửi `ServerMessage.Reward { chalk }` riêng cho người đó (số đã qua trần). Lỗi ghi phấn không làm hỏng trận.
- `BrainStateView` thêm `chalkEarned: number` (0 khi chưa có / khách không phiên).

### 5.3 Supabase — migration `supabase/migrations/20261120000000_gacha.sql` — backend-dev

**Bảng** (RLS bật, không policy, revoke khỏi anon/authenticated; chỉ qua RPC / khoá secret):

| Bảng | Cột chính |
| --- | --- |
| `chalk_ledger` | `id bigserial`, `user_id → auth.users cascade`, `source text check in ('party','brain','practice','daily','gacha','refund','admin')`, `ref text` (vd `room_code:created_at`, id lượt), `amount int` (âm khi tiêu), `created_at`; `unique (user_id, source, ref)` cho nguồn có ref |
| `cosmetic_items` | `id text pk`, `slot`, `rarity`, `active bool default true` — seed 24 món |
| `user_items` | `(user_id, item_id) pk`, `obtained_at`, `pulls int default 1` (số lần quay ra) |
| `gacha_state` | `user_id pk`, `since_epic int`, `since_legendary int`, `total_pulls int` |
| `gacha_pulls` | `id`, `user_id`, `item_id`, `rarity`, `duplicate bool`, `refund int`, `created_at` (lịch sử) |

**RPC** (`security definer`, `set search_path = ''`):

| RPC | Ai gọi | Hành vi |
| --- | --- | --- |
| `my_wallet() → jsonb` | authenticated | `{ balance, since_epic, since_legendary, total_pulls, daily_claimed, today: { party, brain, practice } }` |
| `claim_daily_chalk() → int` | authenticated | +`DAILY_BONUS` một lần mỗi ngày VN (ref = ngày); đã nhận → 0 |
| `gacha_pull(p_count int) → jsonb` | authenticated | `p_count` ∈ {1, 10}; khoá theo user; đủ phấn mới quay (thiếu → lỗi `insufficient`, P0001); trừ giá, bốc độ hiếm theo tỉ lệ + bảo hiểm (10 lần: ≥ 1 Hiếm), bốc đều trong độ hiếm, ghi `user_items`/`gacha_pulls`/`gacha_state`, trùng thì cộng `refund`; trả `{ results: [{ item_id, rarity, duplicate, refund }], balance, since_epic, since_legendary }` |
| `my_items() → text[]` | authenticated | món đã có |
| `gacha_history(p_limit int default 30)` | authenticated | lịch sử quay của mình |
| `my_unlock_stats() → jsonb` | authenticated | `UnlockStats` của mình (gọi hàm nội bộ dưới) |
| `unlock_stats_for(p_user uuid) → jsonb` | chỉ service role | `{ party_matches, party_wins, brain_best, practice_best: { <game>: { <difficulty>: best } }, party_category: { <cat>: { sum, matches } } }` |
| `grant_chalk(p_user uuid, p_source text, p_ref text, p_amount int) → int` | chỉ service role | idempotent theo `(user, source, ref)`, kẹp theo trần ngày của nguồn, trả số thực cộng |
| `submit_practice_result(…)` | authenticated | (thay hàm cũ, giữ chữ ký) thêm cộng phấn luyện tập theo trần |

Hằng số giá/tỉ lệ/bảo hiểm/trần trong SQL phải khớp `economy.ts` (test shared đọc file migration). `delete_my_data` không cần sửa (cascade).

### 5.4 Web — frontend-dev

- `/gacha` (`features/gacha/`): số dư phấn, máy quay (SVG + CSS), nút Quay 1 / Quay 10 (giá, thiếu phấn thì tắt + chỉ cách kiếm), bộ đếm bảo hiểm, nút **Tỉ lệ** (hộp thoại: tỉ lệ, 24 món có/chưa), màn mở quà (viên nang mở lần lượt, sáng theo độ hiếm, trùng → "+N phấn"), giảm chuyển động → hiện thẳng kết quả.
- `/wardrobe` (`features/wardrobe/`): tab **Phụ kiện** (xem trước nhân vật, 3 chỗ, chọn/bỏ món) và tab **Bạn đồng hành** (12 nhân vật; thú khoá hiện ổ khoá + điều kiện + thanh tiến độ + nút **Luyện ngay** / **Chơi party** dẫn tới đúng màn bằng URL của CR-022).
- Chọn nhân vật ở hồ sơ và phòng chờ: thú khoá hiện khoá, bấm vào mở điều kiện. Mở khoá mới (so với danh sách đã thấy lưu trên máy) → hộp chúc mừng.
- Menu: thẻ **Máy quay phụ kiện** + chip số dư phấn + nút nhận quà mỗi ngày.
- Kết quả trận / Kiểm tra não: "+N phấn" từ `ServerMessage.Reward` / `chalkEarned`.
- Party: có Supabase thì tạo phiên khách trước khi tạo/vào phòng (không chặn quá 3 giây) để ai cũng nhận phấn.
- Hồ sơ trên máy thêm `accessories` (khoá `brain-rizz:profile`), gửi kèm khi vào phòng / đổi hồ sơ.
- `Character` nhận `accessories?: string[]`; vẽ món theo điểm neo của loài. Thẻ nhỏ (avatar 22–46 px) có thể ẩn món chỗ mặt để không rối — theo bản mẫu.
- Chữ: `i18n/locales/vi.ts`, `en.ts` (tên món, tên thú, điều kiện) — gói lười nếu lớn.

### 5.5 Hình vẽ nhân vật + phụ kiện — ui-designer

- `CharacterSpec` (`components/characters/specs.tsx`) thêm `anchors: { head: Anchor; face: Anchor; neck: Anchor }`, `Anchor = { x: number; y: number; scale?: number; rotate?: number }` trong hệ toạ độ SVG của `Character`. Điền cho **cả 12** loài.
- `components/characters/accessories.tsx`: `ACCESSORY_ART: Record<CosmeticId, { slot; layer: "back" | "front"; render(): ReactNode }>` vẽ quanh gốc (0, 0) đã chuẩn hoá — đầu: đáy món tại (0, 0); mặt: điểm giữa hai mắt tại (0, 0), khoảng cách hai mắt chuẩn 48; cổ: tâm cổ tại (0, 0). `layer: "back"` (áo choàng) vẽ sau thân.
- `Character` nhận `accessories?: readonly string[]` (đã qua `sanitizeLoadout`), đặt món bằng `translate(x y) rotate(r) scale(s)` theo neo của loài; thứ tự lớp: back → thân → cổ → mặt → đầu. Có prop để ẩn món chỗ mặt ở avatar nhỏ (theo bản mẫu).
- Tên thú: khoá `characters.<id>` ở `i18n/locales/vi.ts`, `en.ts` (cùng chỗ 6 nhân vật cũ).

## 6. Chia việc

| Bước | Phòng | Việc | Phụ thuộc |
| --- | --- | --- | --- |
| A | game-designer | Shared `cosmetics/` (5.1) + mô phỏng kinh tế, chỉnh số mục 4 + GDD mục Kinh tế | — |
| B1 | ui-designer | **Vẽ 6 thú mới** trong `specs.tsx` + điểm neo cho cả 12 loài (5.5), tên thú ở i18n | — |
| B2 | ui-designer | Bản mẫu `/gacha`, `/wardrobe`, khoá thú, menu, "+N phấn"; **vẽ 24 phụ kiện** (`accessories.tsx`) + `Character` vẽ phụ kiện (5.5) | — |
| C | backend-dev | Migration 5.3 + ADR "kinh tế phấn chạy trong Postgres" | A (hằng số) |
| D | backend-dev | Giao thức + server 5.2 | A |
| E1 | frontend-dev | Màn `/gacha`, `/wardrobe`, menu (thẻ + số dư + quà ngày), `net/data-api` phần phấn/quay/món | B2, C |
| E2 | frontend-dev | Khoá thú ở chọn nhân vật (hồ sơ, phòng chờ), hộp chúc mừng, "+N phấn" ở kết quả, gửi `accessories` khi vào phòng, tạo phiên khách trước khi vào phòng, hồ sơ trên máy | B1, D |
| F | qa-tester | Soát + thử | C, D, E1, E2 |

A, B1, B2 song song (A mở rộng `CHARACTER_IDS`, B1 thêm spec — kiểm tra kiểu web đỏ tạm thời cho tới khi cả hai xong); C và D song song sau A; E1, E2 song song sau B1/B2 và C/D.

## 7. Rủi ro

| Rủi ro | Cách giảm |
| --- | --- |
| Cày phấn bằng phòng bot / luyện tập giả | Trần ngày theo nguồn; trận 1 người thật × 0,5; luyện tập trần thấp nhất |
| Lệch số giữa SQL và shared | Test shared đọc file migration |
| Nhân vật khoá dùng chui trong phòng | Server lọc theo `loadCosmetics`; không có token → nhân vật mặc định |
| Vẽ 6 thú + 24 món tốn công | Dùng chung thân `BODY_PATH`, chỉ khác tai/mảng/màu; món vẽ một lần theo điểm neo |
| Trẻ em và cơ chế quay | Không tiền thật, tỉ lệ công khai, bảo hiểm, không đồng hồ áp lực (mục 2) |

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
