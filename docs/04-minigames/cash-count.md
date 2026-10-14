# Đếm tiền nhanh (`cash-count`)

- Nhóm: Tính toán (`compute`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; lý do ở mục [Cân bằng](#cân-bằng))
- File: `packages/shared/src/games/cash-count/` (logic + test), `apps/web/src/games/cash-count/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng M7: artboard `CashCountMobile`, `CashCountLevels`, `CashCountStates`, `CashCountHowTo` (đã duyệt)
- Trạng thái:
  - Đặc tả bản đầu 2026-10-14, theo ý tưởng và bản mẫu đã duyệt. Các điểm lệch khỏi bản mẫu ghi ở mục [Câu hỏi mở](#câu-hỏi-mở).
  - Bộ sinh câu đố và test đã xong (2026-10-14). Mọi số liệu "đo" trong đặc tả lấy từ chính code, 10 000 seed mỗi mức.
  - Scene web, màn hướng dẫn và chữ hiển thị đã làm theo bản mẫu (2026-10-14); chờ chơi thử để chốt hệ số điểm.

## Cách chơi

Trên bàn có vài tờ tiền. Cộng nhanh rồi chạm thẻ ghi đúng tổng số tiền trong 4 thẻ. Ở Siêu khó, khách đưa vài tờ để trả một hoá đơn, và bạn chọn số tiền phải thối lại.

## Màn hướng dẫn

- **Cách chơi:**
  1. Cộng nhanh các tờ tiền trên bàn
  2. Chạm thẻ ghi đúng tổng tiền
  3. Chọn sai bị khoá một chút
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ:** như artboard `CashCountHowTo`. Bên trái là ba tờ 20.000, 10.000, 5.000 xếp dọc, giữa các tờ có dấu cộng phấn, và một ngoặc nhọn phấn gom cả ba. Tiếp theo là dấu bằng, rồi lưới 2×2 bốn thẻ 25.000, 30.000, 35.000, 40.000. Ngón tay đang chạm thẻ 35.000, thẻ này có viền vàng. Số thứ tự phấn: ① ở xấp tiền, ② ở dấu bằng, ③ ở thẻ được chạm.
- **Câu nhắc lúc đếm ngược:** "Cộng tiền, chạm tổng đúng!"
- **Câu nhắc theo mức:**
  - Khó: "Có tờ trùng, đừng bỏ sót!"
  - Siêu khó: "Tiền khách đưa trừ hoá đơn!" (luật đổi, nên bắt buộc có)

## Câu đố & đáp án

`CashCountPuzzle` (export từ `@brain-rizz/shared`, cùng `CashCountMode` và `CASH_DENOMINATIONS`):

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `mode` | `"sum"` \| `"change"` | `"sum"`: tổng các tờ (Mầm–Khó). `"change"`: tiền thối (Siêu khó) |
| `bills` | `number[]` | mệnh giá từng tờ, tính bằng đồng, theo thứ tự ô trên bàn, luôn **xếp từ lớn đến nhỏ**. Ở `"change"` là các tờ khách đưa |
| `tilts` | `number[]` | độ nghiêng từng tờ (độ): −4, −3, −2, 2, 3 hoặc 4. Chỉ trang trí |
| `receipt` | `number` | hoá đơn (đồng) ở `"change"`, luôn lẻ nghìn (vd. 286 000). Ở `"sum"` là 0 |
| `options` | `number[]` | 4 số tiền (đồng) tăng dần ngặt, đều dương, bội của 1 000 |
| `answerIndex` | `number` | chỉ số thẻ đúng trong `options` |

- `Answer` (`CashCountAnswer = number`): chỉ số thẻ đã chạm, 0–3, gửi một lần mỗi câu. `isAnswer` chỉ nhận số nguyên 0–3.
- Mệnh giá dùng trong game (`CASH_DENOMINATIONS`): 1 000, 2 000, 5 000, 10 000, 20 000, 50 000, 100 000, 200 000, 500 000.
- Mọi số tiền là số nguyên tính bằng đồng. Không có phép chia, không có số lẻ dưới 1 000.

## Cách sinh câu đố

Mỗi câu dùng hai nguồn ngẫu nhiên: `rng = createRng(deriveSeed(seed, index))` cho số tiền và thẻ, `deco = createRng(deriveSeed(seed, index, 1))` cho độ nghiêng.

1. **Chọn trước vị trí đáp án.** `below = rng.int(0, 3)` là số thẻ nhiễu nhỏ hơn đáp án. Sau khi xếp tăng dần, đáp án nằm đúng ở ô `below`, nên 4 ô đúng với tần suất như nhau (đo được 24,3 / 25,8 / 25,3 / 24,7 %). Không ai đoán được kiểu "chọn thẻ ở giữa".
2. **Rút các tờ** theo mức (bảng [Độ khó](#độ-khó)), rồi xếp từ lớn đến nhỏ.
   - Mầm: chọn 3 trong 4 mệnh giá 1 000, 2 000, 5 000, 10 000, không trùng.
   - Thường: xếp 7 mệnh giá 1 000–100 000, mỗi loại 2 tờ, thành một xấp. Xáo xấp rồi lấy 5 tờ, nên mỗi mệnh giá có tối đa 2 tờ và bàn luôn có ≥ 3 mệnh giá khác nhau.
   - Khó: chọn trước một mệnh giá làm cặp trùng. Bốn tờ còn lại rút từ xấp 2 tờ mỗi loại của 8 mệnh giá kia. Kết quả là 6 tờ, luôn có tờ trùng, mỗi loại ≤ 2 tờ, ≥ 3 mệnh giá khác nhau. Không cần sinh lại.
   - Siêu khó, tiền thối:
     - Khách đưa 2 hoặc 3 tờ (`rng.int(2, 3)`), không trùng, trong các mệnh giá 10 000–500 000, tổng ≥ 200 000. Code lập sẵn danh sách 25 bộ hợp lệ rồi chọn một bộ.
     - Tiền thối = (10 × chục + nghìn) × 1 000, trong đó hàng nghìn chọn trong 1–9, khác 0. Hàng chục nghìn chọn trong khoảng từ `max(ngưỡng theo below, phần dưới 100 000 của tiền đưa ÷ 10 000)` tới 9. Ngưỡng theo `below` là 1 / 1 / 2 / 5.
     - Hoá đơn = tiền đưa − tiền thối. Tiền đưa là bội của 10 000, nên hoá đơn luôn lẻ nghìn và phép trừ luôn phải mượn ở hàng nghìn.
     - Tiền thối lớn hơn phần dưới 100 000 của tiền đưa (vd. đưa 350 000 thì tiền thối > 50 000), nên phép trừ mượn thêm ở hàng chục nghìn: **luôn mượn ít nhất 2 lần**.
3. **Thẻ nhiễu** = đáp án ± một khoản lệch. Chọn `below` khoản cho phía dưới và `3 − below` khoản cho phía trên, các khoản cùng phía đôi một khác nhau.
   - Tính tổng: khoản lệch là **giá trị một tờ đang có trên bàn**. Thẻ phía dưới là "sót một tờ", thẻ phía trên là "đếm một tờ hai lần". Bàn luôn có ≥ 3 mệnh giá khác nhau và mỗi tờ nhỏ hơn tổng, nên luôn đủ 3 khoản mỗi phía và mọi thẻ đều dương.
   - Tiền thối: khoản lệch là **một tờ thối nhầm**, tức 10 000, 20 000, 50 000 hoặc 100 000. Phía dưới chỉ dùng tờ nhỏ hơn tiền thối. Ngưỡng hàng chục nghìn ở bước 2 bảo đảm đủ khoản.
4. Xếp 4 thẻ tăng dần. Đáp án là `options[below]`.

**Vì sao đúng một đáp án:** các khoản lệch cùng phía đôi một khác nhau và đều > 0, nên 4 thẻ đôi một khác nhau, và chỉ thẻ ở `answerIndex` bằng phép tính. `check` so `answer === answerIndex`. Test tính lại đáp án độc lập (tổng các tờ, hoặc tổng − hoá đơn) và đếm số thẻ đúng trên 10 000 seed × 4 mức.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 tờ không trùng trong 1 000–10 000, tổng 8 000–17 000. Có 4 bộ tờ | ba tờ to xếp một cột; 4 thẻ cách đáp án 1 000–10 000 (trung bình lệch 11,4 % tổng) |
| Thường | 5 tờ 1 000–100 000, mỗi loại ≤ 2 tờ. 266 bộ tờ, tổng 11 000–320 000 (trung vị 133 000) | lưới 2 cột 3 hàng; 79 % câu có thẻ nhiễu lệch ≤ 5 % tổng |
| Khó | 6 tờ 1 000–500 000, **luôn có tờ trùng** (39 % câu có 2 cặp). 1 448 bộ tờ, tổng 16 000–1 550 000 (trung vị 560 000) | lưới 2 cột kín 6 ô; 90 % câu có thẻ nhiễu lệch ≤ 5 % tổng (vd. 790 000 / 795 000) |
| Siêu khó | **Tiền thối**: khách đưa 2–3 tờ (mỗi loại 50 %) 10 000–500 000, tổng 210 000–800 000; hoá đơn lẻ nghìn; tiền thối 11 000–99 000 (trung vị 71 000), luôn mượn ≥ 2 lần | cột tiền khách đưa, dấu trừ, tờ hoá đơn; thẻ nhiễu lệch ±10 000 / 20 000 / 50 000 / 100 000 |

Mỗi mức thêm một thứ mới: Mầm cộng 3 số nhỏ, không phải nhớ. Thường có 5 tờ và số sáu chữ số. Khó có tờ trùng, mệnh giá tới 500 000 và thẻ nhiễu rất sát. Siêu khó thêm bước trừ có mượn.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng, và đáp án bằng phép tính trên các tờ.
- 4 thẻ tăng dần ngặt, đều dương, bội của 1 000.
- Mọi thẻ nhiễu lệch đáp án đúng giá trị một tờ trên bàn (tính tổng) hoặc một tờ thối nhầm 10 000 / 20 000 / 50 000 / 100 000 (tiền thối).
- Số tờ, mệnh giá, số tờ trùng, thứ tự lớn → nhỏ và độ nghiêng đúng bảng Độ khó. Mầm có tổng ≤ 20 000. Khó luôn có tờ trùng. Siêu khó: tiền đưa ≥ 200 000, hoá đơn lẻ nghìn, tiền thối 11 000–99 000, nhỏ hơn hoá đơn, phép trừ mượn ≥ 2 lần.
- Vị trí đáp án chia đều 4 ô, mỗi ô 22–28 %.
- Tất định: cùng `(seed, index, difficulty)` cho cùng câu, kể cả độ nghiêng.
- Độ khó tăng thật, đo bằng thời gian giải theo mô hình (mục Cân bằng): trung bình mỗi mức hơn mức dưới ≥ 0,5 s, và p90 của mức dưới nhỏ hơn p10 của mức trên. Mức tính tổng còn có số tờ (3 → 5 → 6), tổng trung bình (×3 mỗi mức) và độ sát của thẻ nhiễu cùng tăng.
- `speedAllowanceMs` hữu hạn, ≥ 0. `difficultyMultiplier` dương và không giảm theo mức.

Các điều trên được kiểm bằng test 10 000 seed × 4 độ khó (`cash-count.test.ts`).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi con số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu (trung bình, p10–p90) | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm | trẻ 7 tuổi ~5,6 s · người lớn ~3,2 s (mọi câu như nhau) | trẻ ~10 (~9 đúng) · người lớn ~17 (~16,5 đúng) |
| Thường | ~5,0 s (4,7–5,3) | ~11 (~10,3 đúng) |
| Khó | ~5,9 s (5,8–6,2) | ~9,3 (~8,4 đúng) |
| Siêu khó | ~6,9 s (6,5–7,3) | ~8,1 (~7,2 đúng) |

Các mức không chồng nhau: p90 của mỗi mức nhỏ hơn p10 của mức trên (3,2 < 4,7; 5,3 < 5,8; 6,2 < 6,5). Test kiểm điều này.

**Mô hình thời gian** (kiểu KLM, tính theo nghìn đồng; test cài đúng mô hình này):

- 0,4 s định hướng.
- Đọc mỗi tờ: 0,3 s, tờ từ 100 000 trở lên 0,35 s.
- Mỗi phép cộng dồn (số tờ − 1 lần): 0,45 s, cộng 0,3 s mỗi lần nhớ khi cộng theo chữ số, cộng 0,15 s nếu các tờ không xếp từ lớn đến nhỏ (hiện mọi mức đều xếp, nên khoản này bằng 0).
- Tiền thối: 0,4 s giữ tổng tiền đưa trong đầu, 0,5 s đọc hoá đơn, 1,5 s cho phép trừ, cộng 0,8 s mỗi lần mượn.
- Chọn thẻ: 0,95 s (so 4 thẻ và chạm), cộng 0,3 s nếu thẻ nhiễu sát nhất lệch ≤ 5 % đáp án (phải đọc tới chữ số cuối).
- Trẻ 7 tuổi: nhân mọi khoản trừ định hướng với 1,8, và định hướng 0,6 s.

Số câu mỗi vòng tính thêm 0,25 s chuyển câu. Tỉ lệ sai giả định: trẻ ở Mầm 10 %, người lớn ở Mầm 4 %, Thường 7 %, Khó 10 %, Siêu khó 12 %. Mỗi câu sai mất 30–100 % thời gian giải rồi khoá 1,5 s.

**Vì sao mọi mức đều xếp tờ từ lớn đến nhỏ** (bản mẫu Thường vẽ 50 000, 20 000, 10 000, 20 000, 5 000): bản đầu xáo thứ tự ở Thường và Khó. Khi đó Khó mất ~6,7 s, chậm hơn cả Siêu khó (~6,9 s, chồng nhau), và Siêu khó chỉ còn ~7,9 câu mỗi vòng, dưới mức 8 bắt buộc. Xếp lớn → nhỏ như các bản mẫu Mầm, Khó và Siêu khó giúp các mức tách nhau rõ. Thứ tự này cũng giống cách người ta đếm tiền thật.

**Vì sao Siêu khó luôn mượn 2 lần:** nếu chỉ mượn ở hàng nghìn, câu tiền thối 2 tờ (~5,7 s theo mô hình) lại nhanh hơn câu Khó (~5,9 s). Mượn qua hàng chục nghìn, như ví dụ 350 000 − 286 000 = 64 000 của bản mẫu, là cái khó thật của việc tính tiền thối.

**Vì sao vòng 60 giây:** với 45 giây, Siêu khó chỉ còn ~6 câu. 60 giây cho ≥ 8 câu ở mọi mức.

### Miễn trừ thời gian cho thưởng tốc độ (CR-006)

Thưởng tốc độ chung (trọn 50 khi ≤ 1,5 s, hết từ 8 s) quá gắt với game phải cộng 5–6 tờ: ở Thường một câu điển hình chỉ còn ~23 điểm thưởng. **Đã khai báo:** `speedAllowanceMs(puzzle) = 500 × max(0, số tờ − 2)`, thêm 2 000 ms nếu là câu tiền thối.

| Mức | Miễn trừ | Lý do |
| --- | --- | --- |
| Mầm | 500 ms | 1 tờ thêm |
| Thường | 1 500 ms | 3 tờ thêm |
| Khó | 2 000 ms | 4 tờ thêm |
| Siêu khó | 2 000 ms (đưa 2 tờ) · 2 500 ms (đưa 3 tờ) | phép trừ có mượn + tờ thêm |

Hàm chỉ đọc câu đố nên luôn tất định, hữu hạn và ≥ 0. Mức 500 ms mỗi tờ chỉ bù phần đọc và cộng tối thiểu, để người nhanh vẫn hơn người chậm. Thưởng trung bình mỗi câu đúng trong mô phỏng: trẻ ở Mầm 23, người lớn ở Mầm 41, Thường 35, Khó 31, Siêu khó 26.

### Hệ số điểm (CR-006)

**Đã khai báo:** `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.4, 3: 1.8 }`.

Cách tính giống Bóng bay số. `T` là thời gian cho mỗi câu đúng, bằng 60 s ÷ số câu đúng mỗi vòng. `B` là thưởng tốc độ trung bình mỗi câu đúng, `K` là hệ số combo trung bình. Hệ số được chọn để điểm mỗi giây bằng người lớn ở Thường, làm tròn tới 0,05, giữ điều kiện không giảm theo mức, và Mầm = min(giá trị cho trẻ 7 tuổi, 1).

| Mức | Người chơi | Tỉ lệ sai | `T` | `B` | `K` | Theo mô phỏng | Đã chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 10 % | 6,69 s | 23 | 1,21 | 1,36 | **1** (không cao hơn Thường) |
| Thường | người lớn | 7 % | 5,85 s | 35 | 1,25 | 1 | **1** |
| Khó | người lớn | 10 % | 7,13 s | 31 | 1,20 | 1,39 | **1,4** |
| Siêu khó | người lớn | 12 % | 8,39 s | 26 | 1,16 | 1,81 | **1,8** |

`T`, `B`, `K` lấy từ mô phỏng 4 000 vòng mỗi người chơi: câu đố sinh bằng chính `generate()`, thời gian theo mô hình cộng nhiễu ±25 %, điểm tính như `scoring.ts` (miễn trừ, trần combo × 1,5, khoá 1,5 s).

Điểm vòng mô phỏng (% so với người lớn ở Thường):

| Người chơi | Hệ số chung 0,8 / 1 / 1,25 / 1,5 | Hệ số của game (đã chọn) |
| --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | ~1 110 (65 %) | ~1 330 (77 %) |
| Người lớn ở Mầm | ~2 650 (154 %) | ~3 090 (180 %) |
| Người lớn ở Thường | ~1 720 (100 %) | ~1 720 (100 %) |
| Người lớn ở Khó | ~1 580 (92 %) | ~1 730 (100 %) |
| Người lớn ở Siêu khó | ~1 470 (85 %) | ~1 720 (100 %) |

- **Độ nhạy:**
  - Tỉ lệ sai thật ở Khó là 7 % thì Khó được ~105 % điểm Thường, là 13 % thì ~95 %.
  - Siêu khó sai 9 % thì được ~104 %, sai 16 % thì ~94 %.
  - Trẻ ở Mầm sai 5 % thì được ~84 %, sai 15 % thì ~71 %.
- **Mầm giữ × 1** (theo quy ước chung của PM: hệ số không giảm khi lên mức). Nếu đặt 1,36, trẻ đạt ~100 % nhưng người lớn chọn Mầm lên ~225 %. Người lớn chọn Mầm vẫn được ~1,8 lần điểm Thường. Phần này do chủ phòng giám sát (GDD §6).
- **Chỉnh sau buổi chơi thử:** đo tỉ lệ sai và số câu đúng mỗi vòng ở từng mức, rồi tính lại theo bảng trên. Chỉ cần đổi số trong `difficultyMultiplier`.

## Ghi chú cho FE

**Bản mẫu đã duyệt, bám sát:** <https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ>, trang Minigame, hàng M7, các artboard `CashCountMobile` (điện thoại, mức Thường), `CashCountLevels` (4 mức), `CashCountStates` (sai/đúng, nền sáng và tối), `CashCountHowTo` (hình hướng dẫn 560×360).

### Dữ liệu

Scene gọi `cashCount.generate(bridge.seed, index, bridge.difficulty)` rồi vẽ theo `CashCountPuzzle`, không cần đọc logic sinh.

- Số tiền hiển thị theo kiểu Việt Nam, dấu chấm ngăn nghìn: `95.000`, `1.550.000`. Dùng `Intl.NumberFormat("vi-VN")` hoặc tự chèn dấu chấm, cả khi giao diện tiếng Anh, vì đây là tiền VNĐ. Không ghi "đ" trên tờ tiền hay trên thẻ. `aria-label` của thẻ là "95.000 đồng".
- Tờ tiền **cách điệu kiểu nhãn dán**: mệnh giá in to ở giữa, viền mực, bóng đổ phẳng. **Không chép chân dung, quốc huy hay hoa văn tiền thật.** Màu và chiều dài theo mệnh giá, lấy từ bản mẫu (rộng × cao 128 px thiết kế, tờ lớn dài hơn):

| Mệnh giá | Rộng | Màu |
| --- | --- | --- |
| 1.000 | ~230 (chưa có trong bản mẫu, ui-designer chốt) | — |
| 2.000 | 236 | `#dcc19c` |
| 5.000 | 236 | `#c3b2ee` |
| 10.000 | 248 | `#f0cf72` |
| 20.000 | 258 | `#9cc2f2` |
| 50.000 | 268 | `#f6a5c0` |
| 100.000 | 278 | `#a7dc8f` |
| 200.000 | 288 | `#f5ab84` |
| 500.000 | 298 | `#86d2d4` |

  Hai mệnh giá cùng màu nhạt thì phân biệt bằng số in to, không bằng màu.
- `tilts[i]` là độ xoay của tờ `i`. Scene không tự random vị trí hay độ nghiêng, để mọi người cùng mức thấy câu giống hệt nhau.

### Bố cục (khung 720×1280, px thiết kế, theo `CashCountMobile` / `CashCountLevels`)

| Vùng | Toạ độ | Nội dung |
| --- | --- | --- |
| Gợi ý luật | tâm (360, 50), trong dải y 24–80 | biểu tượng không chữ: xấp tiền = ?. Siêu khó: xấp tiền − hoá đơn = ? |
| Bàn | x 24–696, y 100–704, bo 30 | nền giấy kem `#e9dccb`, viền mực mờ |
| Tờ tiền (Thường, Khó) | lưới 2 cột: tâm x ≈ 200 / 520, hàng y ≈ 206 / 404 / 600 | tờ `i` ở cột `i % 2`, hàng `⌊i / 2⌋`. Thường 5 tờ (ô cuối trống), Khó 6 tờ |
| Tờ tiền (Mầm) | một cột tâm x 360, y ≈ 206 / 402 / 598, phóng 1,2 | 3 tờ to cho trẻ |
| Siêu khó | tiền đưa: một cột tâm x ≈ 196, y ≈ 218 / 406 / 594 (2 tờ thì y ≈ 312 / 500), trong khung phấn nét đứt. Dấu "−" ở giữa. Tờ hoá đơn tâm (548, 404), số 56 px | hoá đơn là tờ giấy in nhiệt (mép răng cưa), khác hẳn tiền |
| Ô kết quả | "=" ở x 138–170, ô nét đứt x 196–524, y 726–818, chữ "?" 60 px | chờ trả lời: "?"; đúng/sai: hiện số |
| 4 thẻ | lưới 2×2, x 24–696, y ≈ 848–1248, khe ~22 px | đọc theo hàng: `options[0] options[1] / options[2] options[3]`, chữ Baloo 2 ExtraBold, chữ số đều nhau |

- **Vùng chạm** là cả thẻ (~325 × 189 px thiết kế, ≥ 48 px thật ở mọi máy). Tờ tiền không nhận chạm.
- Trên máy tính, rê chuột vào thẻ thì thẻ nhấc lên 2 px và phóng 1,03, con trỏ bàn tay.
- Chờ font tải xong mới vẽ câu đầu. Mọi chữ số trên tờ, hoá đơn và thẻ có tương phản ≥ 4,5:1. Tờ tiền có viền mực để nổi trên cả nền sáng lẫn tối. Bản tối (artboard `CashCountStates`) dùng bàn tím đậm viền kem và thẻ tím đậm chữ kem, lấy màu theo token lúc tạo scene.

### Trạng thái

| Trạng thái | Hình | Thời lượng |
| --- | --- | --- |
| Hiện câu | các tờ trượt/rơi nhẹ vào chỗ, ô kết quả có "?". **Chạm được ngay**, không chờ hiệu ứng | ≤ 200 ms |
| Đúng | ô kết quả ghi số đúng, nảy nhẹ, có dấu ✓ vàng; thẻ đã chọn viền vàng + ✓ | câu mới sau ≤ 300 ms |
| Sai → khoá | xem mục dưới | rung 200 ms; khoá theo `bridge.unlockDelay` (1,5 s) rồi sang câu mới |
| Hết giờ giữa câu | ngừng nhận chạm, không gửi gì | — |
| Nối lại giữa vòng | bắt đầu từ `bridge.startIndex` | — |

Chấm ở client để phản hồi tức thì (`check`), server chấm lại. Sau lần chạm đầu tiên, bỏ qua mọi chạm cho tới câu mới, kể cả chạm nhiều ngón.

### Hiện đáp án đúng khi sai

Trong suốt lúc khoá, theo artboard `CashCountLevels` (Khó) và `CashCountStates`:

- Thẻ vừa chọn: viền nét đứt đỏ (`--destructive`) và dấu ✗. Thẻ đúng: vòng vàng (`--highlight`). Hai thẻ còn lại mờ đi.
- Ô kết quả hiện **số đúng** kèm hình ổ khoá. Ô này ở y 726–818, ngoài dải huy hiệu khoá ở trên cùng khung.
- **Chỉ ra chỗ nhầm** ở câu tính tổng, với `diff = options[chọn] − options[answerIndex]`. Luôn có một tờ trên bàn bằng đúng `|diff|`; scene lấy tờ đầu tiên có giá trị đó.
  - `diff < 0` (sót tờ): khoanh tờ đó bằng vòng phấn nét đứt, các tờ khác mờ đi. Bản mẫu Khó chọn 790.000 thì khoanh tờ 5.000.
  - `diff > 0` (đếm một tờ hai lần): khoanh tờ đó và thêm huy hiệu phấn "×2" cạnh tờ.
- Câu tiền thối: dưới khung tiền khách đưa hiện nhãn "= 350.000" (tổng các tờ đưa), để người chơi tự thấy phép trừ (artboard `CashCountStates`, Siêu khó).
- Đã chọn, đúng và sai phân biệt bằng nét (đứt/liền), ✗/✓ và ổ khoá, không chỉ bằng màu.

### Hiệu ứng & âm thanh

| Sự kiện | Hình | Âm (GĐ 2) |
| --- | --- | --- |
| Hiện câu | tờ tiền rơi nhẹ lên bàn | tiếng "sột" giấy (tuỳ chọn) |
| Đúng | ô kết quả nảy + ✓ | "ting" máy tính tiền, cao dần theo combo |
| Sai | rung + ✗ + khoanh tờ bị sót | "bụp" trầm; rung máy ngắn |

Khi bật giảm chuyển động: tờ hiện tại chỗ, không rơi; bỏ rung; vòng nét đứt đứng yên.

## Ghi chú cho BE

Không có gì khác thường.

- Không có pha trình chiếu. Đáp án là một số nguyên 0–3, mỗi câu một tin nhắn, `isAnswer` kiểm chặt. Không đổi giao thức.
- `durationMs = 60_000`, `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.4, 3: 1.8 }`.
- `speedAllowanceMs(puzzle)` = 500 × max(0, số tờ − 2), cộng 2 000 ms nếu là câu tiền thối. Server gọi qua `gameSpeedAllowanceMs` với puzzle tự sinh lại.

## Đối chiếu quy tắc thiết kế (GDD §5)

| Quy tắc | Đạt? | Vì sao |
| --- | --- | --- |
| Hiểu trong ≤ 5 giây với một câu + hình | Có | "Cộng tiền, chạm tổng đúng" + hình xấp tiền = thẻ |
| Một câu giải trong 1–8 giây ở mức Thường | Có | ~5,0 s theo mô hình |
| Đúng một đáp án, kiểm được bằng máy | Có | 4 thẻ đôi một khác nhau, chỉ một thẻ bằng phép tính; test 10 000 seed × 4 mức |
| Chỉ số nguyên + `createRng()` | Có | mọi số là bội của 1 000 đồng, không có phép chia |
| Bốn mức khác rõ; Mầm hợp trẻ 7 tuổi | Có | Mầm 3 tờ ≤ 10 000, tổng ≤ 17 000, không phải nhớ |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Có | 4 thẻ lớn ở nửa dưới, trong tầm ngón cái |
| Không phụ thuộc chữ | Có | chỉ có chữ số và ký hiệu +, −, = |
| Không chỉ phân biệt bằng màu | Có | mệnh giá in to trên mỗi tờ; đúng/sai có ✓/✗ và nét đứt |

## Câu hỏi mở

1. **Mầm chỉ có 4 bộ tờ** (tổng 8 000, 13 000, 16 000, 17 000), vì luật "3 tờ không trùng 1.000–10.000, tổng ≤ 20.000" chỉ cho ngần ấy tổ hợp. Thẻ nhiễu và vị trí đáp án vẫn đổi mỗi câu, nhưng trẻ có thể nhớ tổng sau vài vòng. Nếu chơi thử thấy vậy, đề xuất cho phép một cặp trùng (vd. 5.000 + 5.000 + 2.000), hoặc thêm 20.000 với tổng ≤ 30.000.
2. **Mọi mức xếp tờ lớn → nhỏ** (lệch bản mẫu Thường một chút; lý do ở mục Cân bằng). Nếu muốn Khó xáo thứ tự cho khó hơn, cần giảm Siêu khó hoặc chấp nhận Khó và Siêu khó chồng nhau.
3. **Thẻ nhiễu ở Siêu khó** là ±10.000 / 20.000 / 50.000 / 100.000 ("thối nhầm một tờ"), không phải giá trị tờ khách đưa. Cách này khớp bản mẫu (54.000 / 74.000 / 164.000 quanh 64.000) và khớp lỗi mượn thường gặp.
4. **Tờ 1.000** chưa có trong bản mẫu: ui-designer cần chốt màu và chiều dài.
