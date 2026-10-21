# Tìm bạn (`crowd-search`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/crowd-search/` (bộ sinh + test), `apps/web/src/games/crowd-search/` (scene + chữ hiển thị)
- Nguồn: [kế hoạch mở rộng minigame](../01-product/minigame-expansion.md) mục 3.6, [CR-014](../00-tracking/change-requests.md#cr-014). Chỉ mượn cơ chế "tìm một người giữa đám đông" (cổ điển, kiểu *Where's Wally*); nhân vật, phụ kiện, tên và chữ là của Brain Rizz.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M19** (CrowdSearchMobile, CrowdSearchLevels, CrowdSearchStates, CrowdSearchHowTo). Chờ chủ dự án duyệt.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Trên cùng là thẻ "tìm người" vẽ một bạn: con vật gì, đội mũ gì, cầm gì, đeo kính gì. Bên dưới là cả lớp đứng yên thành lưới: chạm vào đúng bạn giống hệt thẻ. Ở Siêu khó, thẻ có thêm một món bị gạch chéo: bạn cần tìm không có món đó.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn bạn trên thẻ
  2. Tìm bạn giống hệt trong lớp
  3. Chạm vào bạn đó
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** khung ngang 560×360. Nửa trái (biểu tượng mắt): thẻ giấy vẽ Khói (mèo) đội mũ chóp tiệc, đeo kính tròn. Mũi tên phấn. Nửa phải (biểu tượng ngón tay): lưới 3×3 bạn nhỏ trên thẻ phấn; ngón tay chạm đúng con mèo đội mũ chóp đeo kính tròn, có vòng vàng; ngay cạnh là một con mèo đội mũ chóp nhưng **không kính**, mờ đi, có dấu X nhỏ.
- **Câu nhắc lúc đếm ngược:** "Bạn nào giống hệt thẻ?"
- **Câu nhắc theo mức:** Khó "Soi kỹ mũ, kính, đồ cầm!" · Siêu khó "Món bị gạch: bạn đó không có!".
- **Gợi ý cạnh từng mức:** Mầm "9 bạn" · Thường "16 bạn" · Khó "25 bạn" · Siêu khó "30 bạn · có món cấm".

## Luật

- **Bạn cần tìm giống hệt thẻ:** cùng loài, cùng từng món vẽ trên thẻ; món không vẽ thì bạn đó cũng không có.
- **Siêu khó:** cạnh bạn trên thẻ có một món bị gạch chéo (biển cấm). Bạn cần tìm **không có món đó** (ô phụ kiện đó trống). Trong lớp luôn có vài bạn giống hệt thẻ nhưng có thêm đúng món bị gạch: đó là bẫy.
- **Một luật, ba cách hiểu, cùng một đáp án.** Người chơi có thể hiểu là "giống hệt thẻ", "có đủ những gì trên thẻ (món không vẽ thì sao cũng được)", hay đọc gạch chéo là "không đội mũ nói chung" thay vì "không đội mũ chóp". Bộ sinh bảo đảm cả ba cách đều ra đúng một bạn và là cùng một bạn (test kiểm), nên không có câu nào hai đáp án vì hiểu luật khác nhau.

## Câu đố & đáp án

- `CrowdSearchPuzzle`:
  - `cols`, `rows`: lưới đám đông (3×3 · 4×4 · 5×5 · 5×6).
  - `crowd: Buddy[]`: các bạn theo thứ tự ô, trái → phải, trên → dưới, dài đúng `cols × rows`.
  - `card: { buddy: Buddy; not?: { slot, value } }`: `buddy` là bạn cần tìm vẽ nguyên dạng (luôn bằng `crowd[answerIndex]`); `not` chỉ có ở Siêu khó: món bị gạch, `slot` ∈ `"hat" | "held" | "glasses"`, `value` là kiểu món (≥ 1). Ô `slot` của bạn cần tìm luôn là 0.
  - `answerIndex`: ô của bạn cần tìm.
- `Buddy = { species, hat, held, glasses }`, toàn số nguyên, không có chữ hiển thị (bảng dưới).
- `Answer`: `number`, chỉ số ô chạm trong `crowd`, gửi một lần mỗi câu. `check`: đúng khi `answer === answerIndex`. `isAnswer`: số nguyên 0–29 (`CROWD_SEARCH_MAX_CROWD = 30`).
- Hàm phụ cho FE (export từ shared): `crowdSearchMismatch(buddy, card)` trả các thuộc tính làm một bạn không khớp thẻ (`"species"`, `"hat"`, `"held"`, `"glasses"`), để khoanh chi tiết khi chạm sai; `matchesCard(buddy, card)`; `CROWD_SPECIES` (chỉ số loài → `CharacterId`, để lấy màu từ bộ nhân vật); `CROWD_SEARCH_GRID`; `BUDDY_VARIANTS`.

## Nhân vật & phụ kiện

Loài là 6 nhân vật của Brain Rizz ([ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md)): cùng thân tròn chibi, khác nhau ở tai, mõm, mảng lông, nên vẽ lại được bằng Phaser Graphics từ vài hình cơ bản. Danh sách `CROWD_SPECIES` cố định riêng cho game (không đọc `CHARACTER_IDS`), để thêm avatar mới không làm đổi câu đố đã sinh.

| Thuộc tính | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| `species` (loài) | Khói, mèo: tai tam giác nhỏ | Bơ, chó: tai cụp rủ hai bên | Mochi, thỏ: tai dài dựng | Bắp, gà con: không tai, mào ba chỏm, mỏ tam giác | Cam, cáo: tai tam giác to, mõm trắng hình V | Tròn, gấu trúc: tai tròn đen, mảng mắt đen |
| `hat` (mũ) | không đội | mũ chóp tiệc: tam giác cao, sọc, quả bông ở đỉnh | mũ tốt nghiệp: tấm vuông dẹt rộng hơn đầu, tua rủ một bên | vương miện: dải thấp ba răng cưa | | |
| `held` (đồ cầm) | không cầm | bóng bay: hình bầu dục trên dây, đỉnh cao hơn tai | quyển sách: hình chữ nhật trước bụng, có gáy | lá cờ: cán dọc cao hơn đầu, cờ tam giác | | |
| `glasses` (kính) | không đeo | kính tròn: hai vòng gọng rỗng | kính râm: hai tròng **vuông** tô đặc | | | |

Mỗi kiểu khác nhau về **hình** (tam giác cao / tấm dẹt / răng cưa; tròn trên dây / chữ nhật / tam giác trên cán; vòng rỗng / vuông đặc), không chỉ về màu. 6 × 4 × 4 × 3 = 288 tổ hợp.

## Cách sinh câu đố

`rng = createRng(deriveSeed(roundSeed, index))`, chỉ dùng số nguyên.

1. **Bạn cần tìm:** bốc loài; xáo 3 ô phụ kiện, `k` ô đầu (theo mức) mỗi ô bốc một kiểu, các ô còn lại để trống. Thẻ vẽ đúng bạn này. Siêu khó: ô trống đầu tiên thành **ô cấm**, bốc kiểu món bị gạch `X`.
2. **Cùng loài, lệch đúng 1 món:** liệt kê mọi biến thể đổi một món có trên thẻ sang kiểu khác hoặc bỏ đi (không thêm món vào ô trống), xáo, lấy số lượng theo mức, các biến thể đôi một khác nhau.
3. **Khác loài, phụ kiện y hệt:** lấy các loài khác nhau trong 5 loài còn lại.
4. **Bẫy (Siêu khó):** giống hệt bạn cần tìm, thêm đúng món `X` ở ô cấm.
5. **Bạn ngẫu nhiên** lấp đủ lưới: loài ngẫu nhiên (Mầm, Thường: chỉ loài khác, lượt đầu phủ đủ 5 loài); mỗi ô phụ kiện có món với xác suất theo mức, kiểu ngẫu nhiên. **Sinh xong mới kiểm:** bạn ngẫu nhiên nào có đủ loài và mọi món trên thẻ thì đổi sang loài khác.
6. Xáo vị trí; `answerIndex` = ô của bạn cần tìm.

**Vì sao đúng một đáp án:** bạn ở bước 2–3 và mọi bạn ngẫu nhiên đều thiếu hoặc sai ít nhất một thứ vẽ trên thẻ (loài hoặc một món). Vậy ngoài bạn cần tìm, chỉ có bẫy là có đủ mọi thứ trên thẻ, và bẫy lại có đúng món bị gạch. Bạn cần tìm không có món thừa nào, nên nó vừa là bạn duy nhất "giống hệt thẻ", vừa là bạn duy nhất "có đủ những gì trên thẻ và không có món bị gạch", kể cả khi đọc gạch chéo là "không có gì ở ô đó".

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 9 bạn (3×3) · thẻ 1 món · bạn cần tìm là bạn **duy nhất của loài đó**, 8 bạn còn lại đủ 5 loài khác · bạn ngẫu nhiên có món 35 % | Chỉ cần nhận ra con vật |
| Thường | 16 bạn (4×4) · thẻ 2 món · 4 bạn cùng loài: 3 bạn lệch đúng 1 món trên thẻ · 2 bạn khác loài y hệt phụ kiện · còn lại khác loài, có món 45 % | Tìm đúng loài rồi so mũ/kính/đồ cầm |
| Khó | 25 bạn (5×5) · thẻ đủ 3 món · 5 bạn cùng loài lệch đúng 1 món (đổi kiểu hoặc bỏ đi) · 3 bạn khác loài y hệt phụ kiện · còn lại ngẫu nhiên mọi loài, có món 55 % | Nhiều bạn chỉ khác một chi tiết nhỏ |
| Siêu khó | 30 bạn (5×6) · thẻ 2 món + **1 món bị gạch** ở ô trống · 2 bẫy (giống hệt thẻ + món bị gạch) · 4 bạn cùng loài lệch 1 món · 3 bạn khác loài y hệt · còn lại ngẫu nhiên, có món 55 % | Phải nhớ thêm điều kiện "không", có bẫy |

Độ khó đo được (10 000 seed mỗi mức, test kiểm chiều tăng):

| Mức | Số bạn | Điều kiện trên thẻ | Bạn gần giống (lệch đúng 1 thuộc tính) | Bạn cùng loài (kể cả đáp án) | Cùng loài lệch đúng 1 món |
| --- | --- | --- | --- | --- | --- |
| Mầm | 9 | 2 | 0,46 | 1 | 0 |
| Thường | 16 | 3 | 5,17 | 4 | 3 |
| Khó | 25 | 4 | 8,44 | 8,65 | 5,29 |
| Siêu khó | 30 | 4 (có 1 "không") | 9,90 | 10,19 | 6,51 (gồm 2 bẫy) |

## Đảm bảo khi sinh câu đố

- Đúng một bạn khớp thẻ ở cả ba cách đọc luật (giống hệt; có đủ những gì trên thẻ và không có đúng món bị gạch; có đủ và ô cấm trống), và đó là `answerIndex`. `card.buddy` bằng đúng `crowd[answerIndex]`.
- Mọi bạn sai có ít nhất một chi tiết lệch theo `crowdSearchMismatch`; bẫy chỉ lệch ở ô cấm.
- Số bạn đúng theo mức (9 / 16 / 25 / 30) và bằng `cols × rows`; mọi thuộc tính là số nguyên trong miền.
- Mầm: bạn cần tìm là bạn duy nhất của loài đó, đủ 5 loài khác. Thường: đúng 4 bạn cùng loài, 3 bạn kia lệch đúng một món có trên thẻ, ≥ 2 bạn khác loài y hệt phụ kiện. Khó: ≥ 8 bạn gần giống, ≥ 5 trong đó cùng loài. Siêu khó: có món bị gạch ở ô bạn cần tìm để trống, ≥ 2 bẫy, ≥ 9 bạn gần giống.
- Độ khó tăng thật: số bạn, bạn gần giống, bạn cùng loài, bạn cùng loài lệch 1 món tăng chặt; số điều kiện 2 / 3 / 4 / 4.
- Phân bố đều (lệch < 20 %, 12 000 câu mỗi mức): ô đáp án, loài cần tìm, ô cấm ở Siêu khó.
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random`/`Date.now`.

Tất cả nằm trong `crowd-search.test.ts` (2 500 seed × 4 mức cho các kiểm tra theo câu).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Ước lượng trên giấy theo kiểu tìm kiếm tuần tự: đọc thẻ 0,25 s mỗi điều kiện (thêm 0,3 s cho món bị gạch) + lướt lưới tìm đúng loài (loài là đặc điểm lớn, ~0,04 s mỗi ô) + so từng bạn cùng loài với thẻ ~0,35 s mỗi bạn (loại ngay khi thấy món lệch đầu tiên; gặp đáp án là dừng, nên với n bạn cùng loài trung bình so (n + 1) ÷ 2 bạn) + Siêu khó soi lại ô cấm ở các bạn có đủ món ~0,5 s + chạm 0,3 s. Thường: 0,75 + 0,64 + 2,5 × 0,35 + 0,3 ≈ 2,6 s · Khó: 1,0 + 1,0 + 4,8 × 0,35 + 0,3 ≈ 4,0 s · Siêu khó: 1,3 + 1,2 + 5,6 × 0,35 + 0,5 + 0,3 ≈ 5,3 s · Mầm (người lớn): 0,5 + 0,2 + 0,3 ≈ 1,0 s, trẻ 7 tuổi chậm ~2,5 lần.

| Mức | Thời gian giải mỗi câu | Tỉ lệ đúng | Số câu mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 2,0–3,2 s (người lớn 0,8–1,2 s) | 90 % (người lớn 98 %) | ~20 (~18 đúng) |
| Thường | 2,0–3,0 s | 93 % | ~20 (~19 đúng) |
| Khó | 3,4–4,6 s | 88 % | ~13 (~11–12 đúng) |
| Siêu khó | 4,8–6,0 s | 84 % (bẫy) | ~10 (~8 đúng) |

Các mức của người lớn không chồng nhau (Thường ≤ 3,0 s < Khó ≥ 3,4 s; Khó ≤ 4,6 s < Siêu khó ≥ 4,8 s). Siêu khó còn ~10 câu mỗi vòng (≥ 8). Thường ~2,5 s mỗi câu, khớp kế hoạch (~20 câu).

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `crowdSearch`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 1,17 → min(1,17; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **2,2** | không khai báo | Mô phỏng cần 2,19, làm tròn tới 0,05 |
| Siêu khó | **3,45** | không khai báo | Mô phỏng cần 3,45 |

- `speedAllowanceMs`: không cần. Đám đông đứng yên, hiện ra là chạm được ngay, một chạm là xong. `answerWindowMs`: không khai báo (không có vật biến mất).
- Cách mô phỏng (50 000 vòng 60 s mỗi mức, như Bóng của ai), gọi chính `generate()` và `check()`: thời gian giải phân bố đều trong khoảng ở bảng trên, đúng theo tỉ lệ ở bảng; câu đúng thêm 0,3 s hiệu ứng tính vào `answerMs` câu sau; câu sai khoá 1,5 s; câu chưa xong khi hết giờ không tính. Điểm theo `pointsForCorrect` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, giải m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 17,6 · 2,0 | 2 230 | 883 | 1,17 | 1 | ~3 110 (89 %) |
| Người lớn · Thường | 19,0 · 1,4 | 2 486 | 1 002 | 1 | 1 | ~3 490 (100 %) |
| Người lớn · Khó | 11,5 · 1,6 | 1 407 | 406 | 2,19 | 2,2 | ~3 500 (100 %) |
| Người lớn · Siêu khó | 8,3 · 1,6 | 960 | 175 | 3,45 | 3,45 | ~3 490 (100 %) |
| Người lớn chọn Mầm | 44,2 · 0,9 | 6 277 | 3 139 | 0,06 | 1 | ~9 420 (270 %) |

- Người lớn chọn Mầm được ~270 %: Mầm là tìm một con vật khác loài trong 9 ô lớn, gần như "nhìn là thấy". Giống mọi game Nhận diện, hệ số Mầm đã ở trần 1. Script mô phỏng không lưu trong repo.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **1 600**. Theo cách của [GDD](../01-product/game-design.md#kiểm-tra-não): người lớn ở Thường, 30 s của nhóm Nhận diện, thời gian mỗi câu đều ±20 % quanh 2,5 s, sai 7 %, hiệu ứng 0,25–0,35 s giữa hai câu, câu sai khoá 1,5 s, câu dở khi hết giờ không tính. 4 000 lượt: trung bình 1 616 điểm (9,3 đúng · 0,7 sai, ~10 câu), 20 000 lượt: 1 617; làm tròn tới 50. Người nhanh hơn 30 %: × 1,47; chậm hơn 40 %: × 0,66. Kiểm chứng: cùng giả định ở 60 s ra ~3 480, khớp bảng trên.

Núm chỉnh sau chơi thử (chỉ sửa `LEVELS` trong `crowd-search.ts`, rồi tính lại hệ số):

1. Thường quá dễ (dưới 2 s): cho bạn ngẫu nhiên trùng loài (`fillerSameSpecies`), hoặc thêm 1 bạn cùng loài lệch 1 món.
2. Siêu khó đúng < 75 %: giảm bẫy còn 1, hoặc giảm lưới còn 5×5.
3. Khó và Siêu khó quá gần: Siêu khó thẻ đủ 2 món + gạch, thêm bạn cùng loài lệch 1 món (lên 6).
4. Mầm khó với trẻ: hạ xác suất món của bạn ngẫu nhiên (35 % → 20 %) cho đỡ rối mắt.

## Ghi chú cho FE

Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Thẻ "tìm người" | x 210–510, y 92–340 (300×248) | Giấy, viền mực 5, viền trong cam Nhận diện (`--color-identify`), bóng sàn mờ; bạn cần tìm vẽ to (cao ~190), chính giữa |
| Món bị gạch (Siêu khó) | thẻ dời bạn sang trái (tâm x 310), chip tròn Ø 100 tâm (440, 216) trong thẻ | Vẽ món `X` (cùng hình như trên người bạn) trong vòng tròn, đè **một vạch chéo dày** từ trên trái xuống dưới phải (biển cấm). Nhận ra bằng hình vòng + vạch, không chỉ bằng màu đỏ |
| Khung đám đông | x 24–696, y 372–1236 (672×864) | Giấy, viền mực, viền trong cam. Ô: 3×3 → 224×288 · 4×4 → 168×216 · 5×5 → 134×173 · 5×6 → 134×144 |
| Thanh khoá | 420×14 tại (150, 1250) | Chỉ khi sai |

- **Vùng chạm** = cả ô. Ô nhỏ nhất 134×144 → ~73×78 px trên điện thoại rộng 390 (≥ 48 px).
- **Vẽ bạn** bằng Phaser Graphics (không asset ngoài), phong cách bảng phấn: thân tròn chung, nét mực, màu lấy từ bộ nhân vật (`CROWD_SPECIES[species]` → màu của `CHARACTER_SPECS`). Mỗi bạn vẽ trong hộp vuông cạnh `min(ôRộng, ôCao) × 0,82`, chân chạm đáy hộp. Nên dựng sẵn texture cho mỗi tổ hợp đã gặp (`generateTexture`, khoá theo 4 số) để 30 bạn vẽ nhanh.
- **Đặc điểm loài phải khác về hình** (bảng Nhân vật & phụ kiện): tai, mào, mõm, mảng mắt. Tai thỏ vẫn thấy khi đội mũ; mào gà con có thể bị mũ che, nhưng mỏ phải luôn thấy.
- **Phụ kiện:** mũ neo trên đỉnh đầu (giữa hai tai), đồ cầm ở tay phải của bạn (bên trái màn hình), kính ngang mắt. Chi tiết phân biệt nhỏ nhất ≥ 20 đơn vị khung ở ô 5×6 (~10 px trên điện thoại 390): tua mũ tốt nghiệp, răng vương miện, tròng kính. Kính râm trên gấu trúc: thêm viền phấn sáng quanh tròng để không chìm vào mảng mắt đen. Màu mỗi kiểu cố định (dư thừa có chủ đích, giúp nhận nhanh), nhưng hai kiểu cùng ô không được chỉ khác nhau về màu.
- **Đám đông đứng yên:** vị trí và vùng chạm không đổi suốt câu. Được phép "thở" nhẹ tại chỗ (scale 100–102 %, lệch pha theo ô) và tắt khi giảm chuyển động.
- Rê chuột: ô nhấc 4 px, viền nét đứt.
- **Đúng:** gửi ngay; vòng vàng (`--primary`) quanh bạn đúng + dấu tích, bạn nảy 110 % và vẫy tay, thẻ đề nảy theo; ~300 ms sau câu mới (đã tính vào mô phỏng).
- **Câu mới:** thẻ đề phóng từ 90 % lên; các bạn hiện lần lượt theo hàng (mỗi hàng 30 ms). Chạm được ngay khi câu hiện, không chờ hiệu ứng.
- Nền tối: thẻ và khung tím `#3a3560`, nét mực đổi thành viền phấn `#c9c6dc` quanh mỗi bạn.

### Hiện đáp án đúng khi sai

Khoá suốt `bridge.unlockDelay`:

- Ô chạm nhầm: X đỏ (`--destructive`) viền trắng; **khoanh nét đứt đỏ từng chi tiết lệch** theo `crowdSearchMismatch(buddy, card)`: `"species"` khoanh cả mặt; `"hat"` / `"held"` / `"glasses"` khoanh vùng mũ / tay / mắt, **kể cả khi bạn đó thiếu món** (khoanh chỗ đáng lẽ có món). Với bẫy ở Siêu khó, chỉ khoanh món bị gạch, đồng thời chip cấm trên thẻ nháy 2 lần.
- Bạn đúng: vòng vàng dày + dấu tích, nảy nhẹ một lần; các bạn khác mờ 35 %.
- Mọi bạn nằm trong khung đám đông từ y 372 trở xuống, không bị huy hiệu khoá che (tới y ≈ 225). Thẻ đề có thể bị che một phần lúc khoá; không sao vì đáp án và chi tiết lệch đều hiện ở đám đông.

### Hiệu ứng

Lắc ô sai 200 ms, nảy bạn đúng 300 ms. Tôn trọng nút Hiệu ứng: kiểm `prefersReducedMotion()` (`features/motion`); khi giảm chuyển động thì bỏ thở, lắc, nảy, hiện lần lượt, chỉ đổi trạng thái tĩnh.

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M19 thắng về hình. Giữ nhân vật, phụ kiện (`buddies.tsx`), bố cục thẻ / khung / lưới / vùng chạm như bảng trên.

- **Nền tối (đã chốt):** giấy của thẻ đề, khung đám đông, chip = `--card` #2f2a52, thay #3a3560 ở dòng "Nền tối" phía trên (#3a3560 trùng nền GameFrame `--muted`, khung chỉ còn tách nhờ viền). Nền sáng giữ `--card` #fff8ef; viền phấn #c9c6dc quanh bạn giữ nguyên.
- **Huy hiệu kính lúp ở góc thẻ (mới):** tâm (218, 100), tròn r30 tô `--color-identify`, viền sticker 4,5, bóng lệch y +5; mắt kính r11,5 tại (−5, −5) nền #fff8ef viền #1f1b3a 5, cán (4, 4)→(14, 14) nét 7. Báo "tìm người" mà không cần chữ.
- **Sọc hàng ghế (mới):** hàng lẻ vẽ dải x 44, rộng 632, cao một bước lưới, r14; sticker α .045 (sáng) / #ffffff α .04 (tối), dưới các bạn. Giúp lướt theo hàng ở lưới 5×5, 5×6.
- Chip món cấm: thêm viền sticker 4 và bóng lệch y +5 quanh chip (hiện chỉ có nền giấy).
- Dấu X ô sai: viền dưới #ffffff (sáng) / #f6f3ea (tối).
- `CrowdSearchHowTo.tsx`: thẻ đề và lưới 3×3 đặt trên giấy #fff8ef viền mực + viền trong cam như trong game (bỏ viền phấn quanh bạn trên bảng); huy hiệu con mắt ở góc thẻ; bạn gần đúng mờ 50 % + X nhỏ.
- Chi tiết số liệu từng việc: file fixes do phiên điều phối chuyển cho frontend-dev.

## Ghi chú cho BE

Không. Đáp án một số nguyên, chấm một lần mỗi câu như Kẻ lạc đàn. Đáp án đúng cho test server: `GAMES["crowd-search"].generate(s, i, d).answerIndex`.

## Khác với kế hoạch mục 3.6

- **Thẻ là một bạn vẽ nguyên dạng** (`card.buddy: Buddy`, món 0 = không vẽ) thay vì `Partial<Buddy>`; `not` gồm `slot` + `value` (một món cụ thể bị gạch). Lý do: điều kiện = "mọi thứ vẽ trên thẻ", không cần ký hiệu "sao cũng được"; và bộ sinh giữ cho ba cách hiểu luật cùng ra một đáp án.
- **Mầm "khác loài hết":** chỉ có 6 loài nên 9 bạn không thể đôi một khác loài; hiểu là bạn cần tìm là bạn duy nhất của loài đó, 8 bạn còn lại phủ đủ 5 loài khác. Thẻ Mầm vẫn vẽ 1 món cho giống các mức khác, nhưng chỉ cần nhận ra loài.
- **Không cần bộ phụ kiện SVG:** theo CR-014, nhân vật và phụ kiện vẽ bằng Phaser Graphics; ui-designer chỉ cần bản mẫu hình dáng.

## Câu hỏi mở

- Siêu khó gạch **một kiểu cụ thể** (vd. mũ chóp). Bẫy luôn mang đúng kiểu bị gạch và đáp án luôn để trống ô đó, nên hiểu "không đội mũ chóp" hay "không đội mũ" đều đúng. Chơi thử xem trẻ có hiểu biển cấm không.
- Có nên xếp đám đông lệch nhẹ (không thẳng hàng) cho tự nhiên? Chỉ là trang trí phía FE, vùng chạm vẫn theo ô.
- Người lớn chọn Mầm ~270 % điểm Thường: chấp nhận như các game Nhận diện khác, xem lại sau chơi thử.
