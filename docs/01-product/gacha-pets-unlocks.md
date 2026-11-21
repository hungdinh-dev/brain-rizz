# Kế hoạch gacha phụ kiện, thú mới, mở khoá bằng thành tích

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế + làm: [CR-023](../00-tracking/change-requests.md#cr-023), [CR-024](../00-tracking/change-requests.md#cr-024) — chủ dự án cho phép điều phối tự lên kế hoạch và triển khai (2026-11-19) |
| Phiên bản tài liệu | 0.2 · 2026-11-20 · game-designer chỉnh số bằng mô phỏng: điều kiện mở thú (mục 3.2), kinh tế phấn (mục 4); API shared thật (5.1); quy ước đánh dấu hằng số trong SQL + thuật toán quay tham chiếu (5.3). Bản 0.1 (2026-11-19): bản đầu, số xuất phát |
| Liên quan | [GDD](game-design.md), [SRS](srs.md) (UC-25, UC-26), [UI-UX](ui-ux.md), [admin-console.md](admin-console.md), [practice-favorites-howto-routes.md](practice-favorites-howto-routes.md) (URL, link sâu), ADR 0009 (nhân vật), ADR 0011 (Supabase) |
| Cập nhật khi | Đổi hợp đồng ở mục 5 (bảng, RPC, state, kiểu shared) → sửa ở đây trước |

## 1. Tóm tắt

Cho người chơi **lý do quay lại**:

1. **Phấn** (tiền trong game, không mua bằng tiền thật) kiếm được khi chơi: trận party, Kiểm tra não, luyện tập, quà mỗi ngày.
2. **Máy quay phụ kiện** (`/gacha`): tiêu phấn để quay ra phụ kiện (mũ, kính, khăn…) gắn lên nhân vật. Tỉ lệ công khai, có bảo hiểm, trùng món thì đổi lại phấn.
3. **Tủ đồ** (`/wardrobe`; từ 2026-11-21 là tab **Phụ kiện** của Hồ sơ `/profile/accessories`, [CR-026](../00-tracking/change-requests.md#cr-026)): mặc phụ kiện đã có (tối đa 1 món mỗi chỗ: đầu, mặt, cổ); cả phòng thấy.
4. **6 bạn đồng hành mới**, **khoá** cho tới khi đạt thành tích (vd "kỷ lục Bóng bay số ≥ 2 200 ở mức Thường", "trung bình 3 kỷ lục cao nhất nhóm Phân tích ≥ 2 500", "về nhất 5 trận party" — đủ ở mục 3.2). Có thanh tiến độ và nút **Luyện ngay** dẫn tới đúng game.

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

Luật nằm ở `UNLOCK_RULES` (`packages/shared/src/cosmetics/unlocks.ts`), chỉnh bằng mô phỏng `economy-sim.test.ts` (mục 4.1). Cột "Ước lượng" là ngày mở **trung vị / p90** của người lớn điển hình chơi vừa (5 trận + 1 Kiểm tra não + 5 lượt luyện tập mỗi ngày, luyện tập theo nút Luyện ngay) và của trẻ em (3 trận với bot Dễ + 5 lượt luyện tập Mầm).

| id | Tên | Loài | Điều kiện mở | Loại luật | Ước lượng: chơi vừa · trẻ em |
| --- | --- | --- | --- | --- | --- |
| `pin` | Pin | cánh cụt | Chơi xong **10 trận party** (trận có bot cũng tính) | `party-matches` | ngày 2 · ngày 4 |
| `op` | Ộp | ếch | Kỷ lục Luyện tập **Bóng bay số** ≥ **2 200** ở mức Thường trở lên | `practice-best` | ngày 2 / 4 (~9 lượt thử: mỗi lượt ~11 % chạm mốc) · — |
| `thong` | Thông | cú | Trung bình **3 kỷ lục cao nhất** nhóm **Phân tích** ≥ **2 500**, đã có kỷ lục ở ≥ 3 game của nhóm, **tính cả mức Mầm** | `practice-category-avg` | ngày 2 · ngày 1–2 |
| `gai` | Gai | nhím | **Về nhất 5 trận party** (phòng bot Dễ cũng tính) | `party-wins` | ngày 4 / 6 · ngày 2 |
| `may` | Mây | koala | **Điểm Não ≥ 530** trong một lượt Kiểm tra não | `brain-score` | ngày 6 / 20 (mỗi lượt ~12,5 % chạm mốc) · — |
| `lua` | Lửa | rồng con | **Chơi xong 120 trận party** và trung bình điểm mỗi trận ≥ **1 600** ở **cả 5 nhóm** (mỗi nhóm ≥ 10 trận) | `all` (`party-matches` + 5 × `party-category-avg`) | ngày 24 (~3,5 tuần) · ngày 40 / 47 |

6 nhân vật cũ (`khoi`, `bo`, `mochi`, `bap`, `cam`, `tron`) luôn mở.

**Lý do chọn số (mô phỏng, người lớn điển hình = người chơi chuẩn của mô phỏng bot):**

- **Ba thú "chăm chơi"** (`pin`, `gai`, `thong`): ai chịu chơi cũng mở trong vài ngày, kể cả trẻ em (trẻ thắng bot Dễ ~93 % số vòng; luyện tập Mầm được tính cho `thong`). Mô phỏng: trẻ em mở đủ 3 thú này trong 4 ngày, và `lua` sau ~6 tuần.
- **`op`**: kỷ lục Bóng bay số của người lớn điển hình ở Thường có trung vị 1 722, p90 2 224 → mốc 2 200 cần vài lượt thử, người giỏi (nhanh hơn 15 %) chạm ngay. Chỉ tính từ Thường để người lớn không mở bằng mức Mầm.
- **`thong`**: điểm các game Phân tích chênh nhau nhiều (Phấn trượt, Cổng luật ~7 000; Đếm khối ~2 000 ở Thường), nên lấy **3 kỷ lục cao nhất** — thử thêm game mới không kéo điểm xuống. Mục đích là dẫn người chơi thử ≥ 3 game Phân tích; tính cả Mầm để trẻ em mở được (trung bình Mầm của trẻ: 1 600–3 700 mỗi game).
- **`may`**: Điểm Não người lớn điển hình trung vị 471, p90 536 (bản 0.1 đặt 600: người điển hình **không bao giờ** đạt, chỉ người giỏi ~24 %/lượt). 530 ≈ một lượt chơi tốt; trẻ em chơi Kiểm tra não ở Thường cố định nên không tính thú này vào 3 thú của trẻ.
- **`lua`**: trung bình theo nhóm hội tụ nhanh (sau 120 trận: người lớn p10 ở nhóm yếu nhất — Tính toán — là 1 706, trẻ em Mầm 1 587), nên phần "thời gian" nằm ở **120 trận** (~3,5 tuần chơi vừa) còn mốc 1 600 là "không bỏ nhóm nào": người điển hình qua, người yếu một nhóm có lý do luyện nhóm đó (hoặc chơi party ở mức thấp hơn cho đúng sức). Bản 0.1 (1 500, mỗi nhóm ≥ 3 trận) mở sau ~2 ngày, quá nhanh cho thú khó nhất.
- Điểm nhóm trong party dùng cấu hình điểm của quản trị viên (CR-019); đổi điểm gốc / hệ số nhiều thì xem lại mốc 1 600. Trận nhiều vòng hơn cộng nhiều vòng cùng nhóm vào một trận nên trung bình mỗi trận cao hơn chút — chấp nhận.

## 4. Kinh tế

Hằng số và hàm ở `packages/shared/src/cosmetics/economy.ts` (số nguyên hết). Đổi số → chạy lại mô phỏng (4.1), sửa bảng này, GDD mục Kinh tế, và migration (test đọc file SQL, mục 5.3).

| Nguồn | Phấn | Trần mỗi ngày (giờ VN) |
| --- | --- | --- |
| Trận party (người đã có phiên, ghi ở `match_results`) | 10 + 5 × số vòng + thưởng hạng (nhất 20, nhì 12, ba 8). Trận 3 vòng: 45 · 37 · 33 · 25 (phòng 4 người trung bình 35). Trận chỉ 1 người thật → × 0,5 làm tròn xuống (22 · 18 · 16 · 12) | **300 phấn** (bản 0.1: 400) |
| Kiểm tra não (ghi ở `brain_tests`) | 30 + ⌊Điểm Não / 20⌋ (30 … 80; người lớn điển hình ~53) | 3 lượt |
| Luyện tập (`submit_practice_result`, chấm trên máy nên trần thấp) | 5 mỗi lượt | 10 lượt |
| Quà mỗi ngày | 20 | 1 lần |

| Quay | Giá |
| --- | --- |
| 1 lần | **100** (bản 0.1: 50) |
| 10 lần (chắc ≥ 1 Hiếm) | **900** (bản 0.1: 450) |

Tỉ lệ: C 60 % · R 30 % · E 8 % · L 2 %; bảo hiểm như mục 2 (lần thứ 15 kể từ Sử thi+ gần nhất chắc Sử thi+, lần thứ 60 kể từ Huyền thoại gần nhất chắc Huyền thoại). Trùng món đổi lại: **C 10 · R 30 · E 80 · L 200** (bản 0.1: 5 · 15 · 40 · 100, nhân đôi theo giá).

**Vì sao đổi so với bản 0.1:** với giá 50 và thu nhập như cũ, người chơi vừa đủ 24 món sau ~25 ngày, người chơi nhiều ~10 ngày — quá nhanh cho mục tiêu "1–2 tháng". Giữ nguyên các khoản thưởng (số "+45 phấn" sau trận nghe vui hơn số nhỏ) và **nhân đôi giá + phấn trùng**: "3 trận = 1 lượt quay". Trần party hạ 400 → 300 vì thưởng hạng làm trận 1 vòng với bot Dễ lời nhất tính theo phút (22 phấn / ~1,5 phút); trần chặn kiểu cày này mà người chơi vừa (~140 phấn party/ngày) không chạm.

### 4.1 Mô phỏng

`packages/shared/src/cosmetics/economy-sim.test.ts` — 200 người mỗi kiểu, 120 ngày; điểm vòng / luyện tập / Điểm Não lấy từ mô phỏng bot (`bots/simulate.ts`) chấm bằng hàm điểm thật; trận 3 vòng, phòng 4 ghế; tiêu hết bằng gói 10 ngay khi đủ (`rollGachaBatch` + `pickGachaItem`: bốc đều trong độ hiếm, Huyền thoại không trùng tới khi đủ bộ, trùng đổi phấn). In bảng: `BRAIN_RIZZ_ECONOMY_SIM=1 pnpm --filter @brain-rizz/shared exec vitest run src/cosmetics/economy-sim.test.ts`. Test kiểm các khoảng mục tiêu (lượt quay đầu ≤ 2 ngày với chơi nhẹ; đủ 24 món 30–60 ngày với chơi vừa; thú đầu 1–3 ngày, `lua` 18–32 ngày và mở cuối cùng; mọi thú p90 ≤ 6 tuần với chơi vừa; trẻ em ≥ 3 thú trong 30 ngày).

| Kiểu người chơi | Phấn / ngày | Trận / lượt quay | Lượt quay đầu | Đủ 24 món (trung vị / p90) | Thú mở sau 30 ngày |
| --- | --- | --- | --- | --- | --- |
| Nhẹ: 2 trận với bạn + quà ngày | 90 | 2,9 | ngày 2 | ngày 97 (p90 ngoài 120 ngày mô phỏng) | 2 (`pin` ngày 5, `gai` ngày 10; `lua` ngày 60) |
| **Vừa**: 5 trận (3 với bạn + 2 với bot) + 1 Kiểm tra não + 5 luyện tập + quà ngày | 237 | 3,6 | ngày 1 | **ngày 37 / 49** | 6 |
| Nhiều: chạm mọi trần (party 300, 3 Kiểm tra não, 10 luyện tập) | 528 | 3,9 | ngày 1 | ngày 17 / 22 | 6 (`lua` ngày 11) |
| Trẻ em: 3 trận với 3 bot Dễ + 5 luyện tập Mầm + quà ngày | 111 | 4,6 | ngày 1 | ngày 80 / 104 | 3 (`pin`, `gai`, `thong`; `lua` ngày 40) |

- **Chi phí ròng đủ 24 món** (giá trừ phấn trùng, chỉ quay gói 10, Huyền thoại không trùng tới khi đủ bộ): trung bình 8 880, trung vị 8 630, p90 11 840 phấn. Bản bốc đều cả Huyền thoại (trước quyết định bên dưới): trung bình 12 845, trung vị 11 580, p90 20 300 — phần lớn là săn **3 món Huyền thoại** (~5,5 lần ra Huyền thoại vì trùng), đuôi dài p90 ≈ 1,75 × trung vị, chơi vừa đủ bộ ngày 50 / 79.
- Thời gian chơi ước lượng: chơi vừa ~35–40 phút/ngày; chơi nhiều 1,5–2 giờ/ngày.

**Đã duyệt (điều phối, theo uỷ quyền của chủ dự án, 2026-11-20) — Huyền thoại không trùng tới khi đủ bộ:** khi ra Huyền thoại, bốc trong các món Huyền thoại **chưa có** (đủ cả 3 rồi mới bốc đều). Mô phỏng: chi phí ròng trung vị 8 630, p90 11 760 (đuôi ngắn hẳn, p90 ≈ 1,36 × trung vị) → chơi vừa đủ 24 món ~36 ngày (p90 ~50), vẫn trong "1–2 tháng". Áp dụng trong `gacha_pull` (mục 5.3) và bản tham chiếu shared.

## 5. Hợp đồng

### 5.1 Shared (`packages/shared/src/cosmetics/`) — game-designer

Đã làm (2026-11-20). Mọi hàm thuần, tất định, không ngẫu nhiên; xuất qua `@brain-rizz/shared`.

- `catalog.ts`: `COSMETIC_SLOTS = ["head","face","neck"]`, `RARITIES = ["common","rare","epic","legendary"]`, `COSMETIC_ITEMS` (24 dòng mục 3.1: `id`, `slot`, `rarity`; thứ tự theo chỗ rồi độ hiếm), kiểu `CosmeticSlot`, `Rarity`, `CosmeticId`, `CosmeticItem`; `COSMETIC_IDS`, `MAX_ACCESSORIES` (3), `MAX_COSMETIC_ID_LENGTH` (40, cho zod ở giao thức); `isCosmeticId`, `getCosmetic(id)`, `cosmeticsByRarity(rarity)`; `sanitizeLoadout(ids: unknown, owned?)` — không ném, bỏ id lạ, chỉ giữ món có trong `owned` (nếu truyền), mỗi chỗ giữ món gặp đầu tiên, trả theo thứ tự đầu → mặt → cổ.
- `economy.ts`: hằng số mục 4 — `GACHA_PRICE_SINGLE`, `GACHA_PRICE_TEN`, `GACHA_TEN_COUNT`, `GACHA_RATES` (số nguyên %, tổng 100), `GACHA_PITY = { epic, legendary }`, `DUPLICATE_REFUND`, `PARTY_CHALK`, `BRAIN_CHALK`, `PRACTICE_CHALK`, `DAILY_BONUS`, `CHALK_DAILY_CAPS = { party: { maxChalk }, brain: { maxGrants }, practice: { maxGrants } }`, `CHALK_DAY_TIMEZONE`, `CHALK_SOURCES`, `ECONOMY_SQL_CONSTANTS` (tên đánh dấu → giá trị, mục 5.3). Hàm: `partyChalkReward({ rounds, placement, humans })` (`humans` = số người thật, server tính theo mục 5.3 — tài khoản khác nhau + ghế chưa xác thực; ≤ 1 → × 0,5), `brainChalkReward(brainScore)`, `capChalkGrant(source, amount, today)` (bản tham chiếu của kẹp trần trong `grant_chalk`), `gachaRarityPool`, `rollGachaRarity(u, pity, guaranteeRare)`, `advancePity`, `rollGachaBatch(uniforms, pity)` (bản tham chiếu thuật toán quay, mục 5.3).
- `unlocks.ts`: `BASE_CHARACTER_IDS` (6 cũ), `PET_CHARACTER_IDS` (`pin, op, thong, gai, may, lua`), kiểu `PetId`, `BaseCharacterId`, `isPetId`, `isBaseCharacterId`; kiểu `LeafUnlockRule` (`party-matches`, `party-wins`, `practice-best`, `practice-category-avg`, `party-category-avg`, `brain-score`) và `UnlockRule` (thêm `{ kind: "all", rules: LeafUnlockRule[] }`), `UNLOCK_RULES: Record<PetId, UnlockRule>`; kiểu `UnlockStats` (camelCase: `partyMatches`, `partyWins`, `brainBest`, `practiceBest[game][difficulty]`, `partyCategory[cat] = { sum, matches }`), `emptyUnlockStats()`, `parseUnlockStats(raw)` — đọc JSON **snake_case** của `unlock_stats_for` (object hoặc chuỗi), không ném, số sai → 0, khoá lạ bị bỏ; `evaluateUnlock(rule, stats) → UnlockProgress { unlocked, current, target, count?, parts? }` (`count` = điều kiện số lượng: số game có kỷ lục / số trận của nhóm; `all`: `current` = số điều kiện đạt, `parts` = từng điều kiện), `unlockRatio(progress)` (0…1 cho thanh tiến độ, = 1 khi và chỉ khi đã mở), `petProgress(pet, stats)`, `isCharacterUnlocked(id, stats)`, `unlockedCharacters(stats)` (theo thứ tự `CHARACTER_IDS`).
- `constants.ts`: `CHARACTER_IDS` = 6 cũ + 6 mới, theo thứ tự đó (`isCharacterId` nhận cả hai; kiểu kiểm `CharacterId` = `BaseCharacterId | PetId`).
- Bot chỉ dùng `BASE_CHARACTER_IDS`: đã sửa `BotDriver.pickAvatar` (server) + test `PartyBots`. Web `previewBotFaces` (`features/home/bot-setup.ts`) vẫn đọc `CHARACTER_IDS` → frontend-dev đổi sang `BASE_CHARACTER_IDS`.
- Test (`cosmetics/*.test.ts`): `catalog` (khớp bảng 3.1, `sanitizeLoadout`), `economy` (thưởng, × 0,5, thưởng hạng, kẹp trần, ngưỡng tỉ lệ, bảo hiểm, 10 000 gói không bao giờ quá hạn bảo hiểm), `unlocks` (biên từng loại luật, `all`, luật thật của 6 thú, `parseUnlockStats` với dữ liệu thiếu / sai / độc), `economy-sim` (mục 4.1), `migration` (mục 5.3; bỏ qua có ghi lý do khi chưa có file SQL).

### 5.2 Giao thức + game server — backend-dev

- `PlayerView.accessories: string[]` (đã lọc, ≤ 3); `JoinOptions` và `setProfile` thêm `accessories?: string[]` (zod: ≤ 3, id ≤ 40 ký tự).
- **Kiểm sở hữu khi vào phòng / đổi hồ sơ:** nhân vật cũ luôn được; thú khoá và phụ kiện cần token hợp lệ → `ResultStore.loadCosmetics(userId) → { stats: UnlockStats, items: string[] }` (đệm 60 giây theo người; xin món / thú mà bản đệm chưa có — vừa quay gacha, vừa mở thú — thì đọc lại DB bỏ qua đệm, tối đa 1 lần mỗi người mỗi 5 giây) → `unlockedCharacters`, lọc phụ kiện theo `items`. Không có token / chưa mở / không sở hữu → **không từ chối vào phòng**, chỉ thay bằng nhân vật mặc định (`khoi`) / bỏ phụ kiện. Bot chỉ dùng 6 nhân vật cũ, không phụ kiện.
- **Thưởng phấn:** sau khi ghi `match_results` (vào `podium`) và `brain_tests`, server gọi `grant_chalk` cho từng người đã xác thực (số tính bằng hàm shared) rồi gửi `ServerMessage.Reward { chalk }` riêng cho người đó (số đã qua trần; 0 = chạm trần). Lỗi ghi phấn (`grantChalk` → `null`) không làm hỏng trận và không gửi `Reward`; Kiểm tra não giữ `chalkEarned` = 0.
- `BrainStateView` thêm `chalkEarned: number` (0 khi chưa có / khách không phiên).

### 5.3 Supabase — migration `supabase/migrations/20261120000000_gacha.sql` — backend-dev

**Bảng** (RLS bật, không policy, revoke khỏi anon/authenticated; chỉ qua RPC / khoá secret):

| Bảng | Cột chính |
| --- | --- |
| `chalk_ledger` | `id bigserial`, `user_id → auth.users cascade`, `source text check in ('party','brain','practice','daily','gacha','refund','admin')`, `ref text` (vd `room_code:created_at`, id lượt), `amount int` (âm khi tiêu; 0 = lần thưởng bị trần kẹp hết), `day date` (ngày giờ VN, để tính trần), `created_at`; `unique (user_id, source, ref)` cho nguồn có ref |
| `cosmetic_items` | `id text pk`, `slot`, `rarity`, `active bool default true` — seed 24 món |
| `user_items` | `(user_id, item_id) pk`, `obtained_at`, `pulls int default 1` (số lần quay ra) |
| `gacha_state` | `user_id pk`, `since_epic int`, `since_legendary int`, `total_pulls int` |
| `gacha_pulls` | `id`, `user_id`, `batch_id` (chung cho các lần của một lượt quay, = `ref` của dòng `gacha`/`refund` trong sổ, = `p_request_id` nếu web gửi), `item_id`, `rarity`, `duplicate bool`, `refund int`, `created_at` (lịch sử) |

**RPC** (`security definer`, `set search_path = ''`):

| RPC | Ai gọi | Hành vi |
| --- | --- | --- |
| `my_wallet() → jsonb` | authenticated | `{ balance, since_epic, since_legendary, total_pulls, daily_claimed, today: { party, brain, practice } }` — `today` theo đơn vị của trần: `party` = số phấn đã cộng hôm nay, `brain` / `practice` = số lần đã được cộng |
| `claim_daily_chalk() → int` | authenticated | +`DAILY_BONUS` một lần mỗi ngày VN (ref = ngày); đã nhận → 0 |
| `gacha_pull(p_count int, p_request_id uuid default null) → jsonb` | authenticated | `p_count` ∈ {1, 10}; khoá theo user; đủ phấn mới quay (thiếu → lỗi `insufficient`, P0001); trừ giá, bốc độ hiếm theo tỉ lệ + bảo hiểm (10 lần: ≥ 1 Hiếm), bốc đều trong độ hiếm (Huyền thoại: trong các món chưa có, đủ bộ rồi mới bốc đều), ghi `user_items`/`gacha_pulls`/`gacha_state`, trùng thì cộng `refund`; trả `{ results: [{ item_id, rarity, duplicate, refund }], balance, since_epic, since_legendary, replayed: false }`. **Idempotent theo `p_request_id`** (web tạo một uuid mỗi lần bấm, giữ nguyên khi "Thử lại"; `batch_id` = mã này): mã đã có lượt quay của người này → kiểm sau khoá, trước khi kiểm đủ phấn → trả lại đúng `results` đã lưu (`balance` / bảo hiểm theo hiện tại) kèm `replayed: true`, không trừ phấn, không quay. Không có mã → mỗi lần gọi một lượt mới |
| `my_items() → text[]` | authenticated | món đã có |
| `gacha_history(p_limit int default 30)` | authenticated | lịch sử quay của mình, mới nhất trước (`p_limit` kẹp 1–100): bảng `{ id, batch_id, item_id, rarity, duplicate, refund, created_at }` |
| `my_unlock_stats() → jsonb` | authenticated | `UnlockStats` của mình (gọi hàm nội bộ dưới) |
| `unlock_stats_for(p_user uuid) → jsonb` | chỉ service role | `{ party_matches, party_wins, brain_best, practice_best: { <game>: { <difficulty>: best } }, party_category: { <cat>: { sum, matches } } }` |
| `grant_chalk(p_user uuid, p_source text, p_ref text, p_amount int) → int` | chỉ service role | `p_source` ∈ `party`, `brain`, `practice`, `admin` (không kẹp); idempotent theo `(user, source, ref)` — gọi lại trả đúng số đã cộng lần đầu, không cộng thêm; kẹp theo trần ngày của nguồn, trả số thực cộng; người dùng đã xoá → 0 |
| `submit_practice_result(…)` | authenticated | (thay hàm cũ, giữ chữ ký) thêm cộng phấn luyện tập theo trần |

Hằng số giá/tỉ lệ/bảo hiểm/trần trong SQL phải khớp `economy.ts` (test shared đọc file migration). `delete_my_data` không cần sửa (cascade).

**Quy ước đánh dấu để test dò được** (`packages/shared/src/cosmetics/migration.test.ts`):

- Mỗi chữ số / chuỗi trong SQL dùng một hằng số kinh tế được đặt **ngay sau** một comment khối `/* @economy <TÊN> */`. Tên là khoá của `ECONOMY_SQL_CONSTANTS` trong `economy.ts`:

  | Tên | Dùng ở |
  | --- | --- |
  | `GACHA_PRICE_SINGLE`, `GACHA_PRICE_TEN`, `GACHA_TEN_COUNT` | `gacha_pull` (giá, kiểm `p_count`) |
  | `GACHA_RATES.common` / `.rare` / `.epic` / `.legendary` | trọng số bốc độ hiếm |
  | `GACHA_PITY.epic`, `GACHA_PITY.legendary` | bảo hiểm |
  | `DUPLICATE_REFUND.common` / `.rare` / `.epic` / `.legendary` | phấn trùng |
  | `CHALK_DAILY_CAPS.party.maxChalk`, `CHALK_DAILY_CAPS.brain.maxGrants`, `CHALK_DAILY_CAPS.practice.maxGrants` | `grant_chalk` |
  | `PRACTICE_CHALK` | `submit_practice_result` |
  | `DAILY_BONUS` | `claim_daily_chalk` |
  | `CHALK_DAY_TIMEZONE` (chuỗi) | mọi chỗ tính "hôm nay" |

  Ví dụ: `v_price := case when p_count = 10 /* @economy GACHA_TEN_COUNT */ then 900 /* @economy GACHA_PRICE_TEN */ else 100 /* @economy GACHA_PRICE_SINGLE */ end;` · `(now() at time zone 'Asia/Ho_Chi_Minh' /* @economy CHALK_DAY_TIMEZONE */)::date`. Mỗi tên phải xuất hiện **ít nhất một lần**, mọi lần đều đúng giá trị; tên lạ là lỗi. Comment dòng `-- …` bị bỏ qua khi dò (đừng đặt dấu hiệu trong comment dòng).
- Seed `cosmetic_items`: mỗi món một bộ `('<id>', '<slot>', '<rarity>'` theo đúng thứ tự cột `(id, slot, rarity)` (thêm cột sau được), đúng 24 món của `COSMETIC_ITEMS`.
- `chalk_ledger.source`: mọi giá trị của `CHALK_SOURCES` xuất hiện dạng `'party'`, `'brain'`… trong SQL (ràng buộc `check`).
- Thiếu file migration → test **đỏ** (không còn `skip`); kèm các test đọc tĩnh: `search_path` + revoke cho mọi hàm `security definer`, hàm chỉ service role / chỉ authenticated, RLS không policy + cascade, khoá đứng trước lần đọc/ghi sổ đầu tiên, `gacha_pull` kiểm `insufficient` trước khi trừ phấn, `gacha_pull` kiểm mã yêu cầu sau khoá và trước khi kiểm đủ phấn / trừ phấn (nhánh gọi lại không ghi gì), chỉ một bản `gacha_pull(int, uuid)` được revoke / grant.

**Thuật toán quay tham chiếu** (`rollGachaBatch` / `rollGachaRarity` / `pickGachaItem` trong `economy.ts`, SQL làm y hệt, RNG = `random()`):

1. Mỗi lần quay chọn tập độ hiếm được phép, theo thứ tự ưu tiên: `since_legendary + 1 ≥ GACHA_PITY.legendary` → chỉ Huyền thoại; `since_epic + 1 ≥ GACHA_PITY.epic` → Sử thi, Huyền thoại; lần cuối của gói 10 mà 9 lần trước toàn Thường → Hiếm, Sử thi, Huyền thoại; còn lại → cả bốn.
2. `T` = tổng `GACHA_RATES` của tập đó; `r = floor(random() × T)`; đi theo thứ tự common → legendary, trừ dần trọng số, dừng ở độ hiếm đầu tiên có `r < trọng số`.
3. Bộ đếm: ra Huyền thoại → `since_epic = since_legendary = 0`; Sử thi → `since_epic = 0`, `since_legendary + 1`; còn lại → cả hai + 1. `total_pulls + 1`.
4. Chọn món (`pickGachaItem`): đều nhau trong các món `active` của độ hiếm đó; riêng Huyền thoại chỉ bốc trong các món Huyền thoại `active` **chưa có** (kể cả món vừa ra ở lần trước của cùng gói), đủ cả rồi mới bốc đều. Đã có → `duplicate`, cộng `DUPLICATE_REFUND[rarity]`, `user_items.pulls + 1`.

**`grant_chalk`** kẹp như `capChalkGrant`: nguồn có `maxGrants` → đã đủ số lần hôm nay (giờ VN) thì cộng 0; nguồn có `maxChalk` → cộng `min(p_amount, maxChalk − đã cộng hôm nay)`, không âm. Số tiền do server tính bằng `partyChalkReward` (người thật trong phòng = số tài khoản khác nhau trong các ghế đã xác thực + số ghế chưa xác thực, không tính bot; một tài khoản hai thẻ chỉ tính một) và `brainChalkReward`.

### 5.4 Web — frontend-dev

- `/gacha` (`features/gacha/`): số dư phấn, máy quay (SVG + CSS), nút Quay 1 / Quay 10 (giá, thiếu phấn thì tắt + chỉ cách kiếm), bộ đếm bảo hiểm, nút **Tỉ lệ** (hộp thoại: tỉ lệ, 24 món có/chưa), màn mở quà (viên nang mở lần lượt, sáng theo độ hiếm, trùng → "+N phấn"), giảm chuyển động → hiện thẳng kết quả.
- `/wardrobe` (`features/wardrobe/`; 2026-11-21 gộp vào Hồ sơ theo [CR-026](../00-tracking/change-requests.md#cr-026): tab Phụ kiện `/profile/accessories`, tab Bạn đồng hành `/profile`, link cũ chuyển hướng): tab **Phụ kiện** (xem trước nhân vật, 3 chỗ, chọn/bỏ món) và tab **Bạn đồng hành** (12 nhân vật; thú khoá hiện ổ khoá + điều kiện + thanh tiến độ + nút **Luyện ngay** / **Chơi party** dẫn tới đúng màn bằng URL của CR-022).
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
