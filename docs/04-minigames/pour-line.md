# Rót vừa vạch (`pour-line`)

- Nhóm: Hình dung
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/pour-line/` (logic + test), `apps/web/src/games/pour-line/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M31** (PourLineMobile, PourLineLevels, PourLineStates, PourLineHowTo). Chờ chủ dự án duyệt.
- Nguồn ý tưởng: [kế hoạch mở rộng minigame, mục 3.10](../01-product/minigame-expansion.md#310-rót-vừa-vạch-pour-line-hình-dung), [CR-014](../00-tracking/change-requests.md#cr-014). Chỉ mượn cơ chế "giữ để rót, buông đúng vạch"; tên, hình và chủ đề phòng thí nghiệm là của Brain Rizz.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Giữ tay để rót nước vào bình thí nghiệm, buông tay khi mặt nước chạm vạch. Bình có hình lạ thì nước dâng nhanh chậm khác nhau; ở Siêu khó nửa trên bình bị che, phải ước lúc nước tới vạch.

**Một câu = một lần giữ.** Đáp án là số ms người chơi giữ tay; server tính lại mức nước từ số ms đó và so với vạch.

## Màn hướng dẫn

- **Cách chơi:**
  1. Giữ để rót nước vào bình
  2. Buông tay khi nước chạm vạch
  3. Nước nằm trong dải vạch là đúng
- **Điều khiển:** Chạm giữ (điện thoại) · Giữ chuột trái (máy tính) · Bàn phím: giữ phím Space.
- **Hình minh hoạ:** một ống đong bằng nét phấn, vòi rót ở trên đang chảy một dòng nước xanh xuống. Ngang thân ống có dải vạch xanh mờ, giữa dải là vạch đứt nét, mép trái có mũi tên tam giác chỉ vào vạch. Mặt nước vừa chạm giữa dải, có dấu ✓ nhỏ bên phải. Dưới đáy hình, một ngón tay đang nhấc lên khỏi nút tròn lớn (mũi tên cong "nhấc lên").
- **Câu nhắc lúc đếm ngược:** "Giữ để rót, buông đúng vạch!" (máy tính giống hệt; bàn phím: giữ Space).
- **Câu nhắc theo mức:** Khó "Bình loe, nước dâng không đều!" · Siêu khó "Nửa trên bị che, ước lượng nhé!".
- **Gợi ý cạnh từng mức:** Mầm "Ống thẳng · rót chậm · dải rộng" · Thường "Ống thẳng · rót vừa" · Khó "Bình loe hoặc thót" · Siêu khó "Bình lạ · che nửa trên".

## Câu đố & đáp án

**Mô hình bình** (hằng số export từ shared): bình cao **1 000 đơn vị mức nước** (`POUR_LINE_HEIGHT`, 0 = đáy, 1 000 = miệng), chia **40 lát** (`POUR_LINE_SLICES`) mỗi lát cao **25** (`POUR_LINE_SLICE_H`, 2,5 % chiều cao). Mỗi lát có một **bề rộng nguyên** 250 … 1 000 (`POUR_LINE_WIDTH_MAX` = bề rộng vùng vẽ). Thể tích một lát = bề rộng × 25. Đây là mô hình **hai chiều**: thể tích chính là diện tích hình cắt mà người chơi nhìn thấy trên màn, nên chỗ bình hẹp nước dâng nhanh đúng như mắt thấy.

- `Puzzle` (`PourLinePuzzle`):
  - `shape`: `"tube"` ống thẳng · `"flare"` cốc loe (rộng dần lên) · `"taper"` bình thót (hẹp dần lên, kiểu bình tam giác) · `"odd"` bình lạ (có chỗ phình và chỗ thắt). Chỉ để FE chọn nét vẽ; chấm không dùng.
  - `vessel: number[]`: 40 bề rộng lát từ đáy lên, số nguyên.
  - `target`: mức nước của vạch (bội của 5).
  - `tol`: dung sai, đúng khi `|mức nước − target| ≤ tol`.
  - `flow`: thể tích rót mỗi ms (số nguyên ≥ 1), không đổi suốt lần giữ.
  - `hideFrom`: mức bắt đầu bị che (Siêu khó: 500), `null` = không che.
  - `idealHoldMs`: ms đầu tiên nước chạm vạch (mức ≥ `target`). **Đáp án tham chiếu**, luôn nằm trong khoảng đúng.
  - `holdMinMs`, `holdMaxMs`: khoảng giữ tay được chấm đúng, tính cả hai đầu.
  - `fullMs`: ms đầu tiên nước chạm miệng bình (mức = 1 000). FE tự buông và gửi ở mốc này.
- `Answer` (`PourLineAnswer`): **số nguyên ms giữ tay**, 0 … `POUR_LINE_MAX_HOLD_MS` (10 000), client đo. Đây là kiểu đáp án mới: thời lượng do client đo, không phải lựa chọn.
- `pourLineLevelAt(puzzle, holdMs)` (export): mức nước sau `holdMs` ms. Chỉ số nguyên: thể tích đã rót `V = flow × ⌊holdMs⌋`, đổ đầy từng lát từ đáy lên; trong lát `i` còn dư `r` thể tích thì mức = `25·i + ⌊r / vessel[i]⌋`. Quá miệng bình thì giữ 1 000; `holdMs ≤ 0` hoặc NaN thì 0. Vì `r < 25 × vessel[i]` nên thương luôn < 25, phép chia số thực của JS cho đúng phần nguyên trên mọi máy (IEEE 754 bắt buộc trong ECMAScript), không có lệch giữa trình duyệt và Node. Hàm **đơn điệu không giảm** theo `holdMs`.
- `pourLineVolumeAt(vessel, level)`, `pourLineMsToReach(vessel, flow, level)` (export): thể tích để đạt đúng mức `level`, và ms ít nhất để đạt mức đó (`⌈thể tích / flow⌉`, số nguyên). Mức ≥ `level` khi và chỉ khi `holdMs ≥ pourLineMsToReach(level)`.
- `check(puzzle, holdMs)`: `|pourLineLevelAt(puzzle, holdMs) − target| ≤ tol`.
- `isAnswer`: số nguyên trong [0, 10 000]. Chuỗi, số lẻ, số âm, NaN, vô cực, mảng, object đều bị từ chối.
- `speedAllowanceMs(puzzle) = holdMinMs` (xem Cân bằng). Không khai báo `answerWindowMs`: không có vật biến mất.

## Cách sinh câu đố

`rng = createRng(deriveSeed(seed, index))`, mọi thứ ngẫu nhiên đi qua `rng`:

1. **Bình** theo mức: ống thẳng bề rộng đều trong khoảng của mức; cốc loe / bình thót (Khó, 50/50) đi tuyến tính từ đầu hẹp `[250, 400]` tới đầu rộng `[800, 1 000]`; bình lạ (Siêu khó) qua **5 điểm điều khiển** ở mức 0, 250, 500, 750, 1 000, mỗi điểm nguyên trong `[250, 1 000]`, phải có ít nhất một bước tăng ≥ 150 và một bước giảm ≥ 150, chênh rộng–hẹp ≥ 400 (rút lại tối đa 30 lần). 40 lát lấy bề rộng nội suy tuyến tính tại giữa lát, làm tròn (`Math.round` trên số hữu tỉ, kết quả nguyên).
2. **Tốc độ rót:** rút thời gian rót đầy `T` (ms) trong khoảng của mức, `flow = round(tổng thể tích / T)`, tối thiểu 1. Tốc độ khác nhau từ câu này sang câu khác (±7–11 % quanh giữa khoảng tuỳ mức), nên không thể chỉ nhớ nhịp câu trước.
3. **Vạch:** duyệt mọi mức bội của 5 trong khoảng vạch của mức; với mỗi mức tính khoảng giữ đúng bằng `pourLineMsToReach`: `holdMinMs = ⌈V(target − tol) / flow⌉`, `holdMaxMs = ⌈V(target + tol + 1) / flow⌉ − 1`. Giữ lại các vạch có khoảng đúng rộng trong `[khoảng tối thiểu, khoảng tối đa]` của mức; Siêu khó thêm: cả khoảng dung sai nằm trên tấm che (`target − tol ≥ 500`) và thời gian nước dâng khuất tới vạch (`idealHoldMs − ms tới mức 500`) trong 300–1 500 ms. Chọn đều một vạch trong danh sách.
4. Không có vạch hợp lệ thì sinh lại từ bước 1 (tối đa 30 lần), rồi tới **bình dự phòng** cố định của mức (ống 550 / ống 500 / bình thót 900 → 300 / bình cầu cổ dài 600–1 000–700–450–650). Test kiểm bình dự phòng có vạch hợp lệ ở mọi tốc độ rót của mức; 10 000 seed × 4 mức không lần nào phải dùng tới nó.

**Vì sao đúng một đáp án:** đáp án là một số ms, nên "đúng một đáp án" nghĩa là **đúng một khoảng `holdMs` liền** được chấm đúng, và khoảng đó đủ rộng. `pourLineLevelAt` đơn điệu không giảm, nên tập `holdMs` có mức nước trong `[target − tol, target + tol]` là một đoạn liền `[holdMinMs, holdMaxMs]` (tạo ảnh của một đoạn qua hàm đơn điệu). Mọi `holdMs` ngoài đoạn đều sai, kể cả 0 và mọi giá trị ≥ `fullMs` (tràn, vì `target + tol ≤ 920 < 1 000`). Test quét **từng ms** từ 0 tới `fullMs + 1` trên 10 000 seed (chia đều 4 mức) để kiểm điều này.

## Độ khó

| Mức | Bình | Rót đầy bình | Dung sai `tol` | Vạch | Khoảng giữ đúng (chốt) | Che |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | Ống thẳng, rộng 500–650 | 2,8–3,2 s (chậm) | ±80 (±8 %) | 300–800 | ≥ 300 ms | không |
| Thường | Ống thẳng, rộng 400–600 | 1,8–2,2 s (vừa) | ±50 (±5 %) | 300–850 | ≥ 160 ms | không |
| Khó | Cốc loe hoặc bình thót (50/50), hẹp 250–400 ↔ rộng 800–1 000 | 1,7–2,1 s | ±50 (±5 %) | 300–850 | ≥ 140 ms | không |
| Siêu khó | Bình lạ (phình + thắt) | 2,4–3,0 s | ±70 (±7 %) | 600–850 | 200–450 ms | từ mức 500 trở lên |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Ống to, nước dâng chậm và đều, dải vạch rộng |
| Thường | Ống vừa, nước dâng đều, nhanh hơn một chút; tốc độ hơi khác mỗi câu |
| Khó | Bình loe thì nước chậm dần khi lên cao, bình thót thì nhanh dần: phải đoán trước lúc buông |
| Siêu khó | Bình hình lạ, nửa trên phủ khăn: nhìn nước dâng ở nửa dưới, nhìn hình bình phía trên, ước lúc nước khuất tới vạch |

- Siêu khó dung sai rộng hơn (±7 %) và khoảng đúng có trần 450 ms: phần ước lượng khi không thấy nước khó hơn nhiều so với canh mặt nước, nhưng vạch ở chỗ bình phình rộng thì không được thành quá dễ.
- **Tốc độ rót ở Siêu khó không tăng dần** (lệch kế hoạch, xem Câu hỏi mở 1): mỗi câu một tốc độ không đổi, người chơi đọc tốc độ ở nửa dưới rồi ước phần khuất.

**Độ khó đo được** (bộ sinh thật, 10 000 seed mỗi mức, đo 2026-10-20; test kiểm các chiều tăng dần):

| Mức | Khoảng giữ đúng (min · TB · max) | Giữ tới vạch `idealHoldMs` (min · TB · max) | Rót đầy `fullMs` | Dâng không đều ở vạch¹ (TB) | Dâng khuất tới vạch (min · TB · max) |
| --- | --- | --- | --- | --- | --- |
| Mầm | 450 · 483 · 517 ms | 841 · 1 646 · 2 546 ms | 2 793–3 208 ms | 0 | — |
| Thường | 181 · 202 · 223 ms | 540 · 1 147 · 1 858 ms | 1 797–2 205 ms | 0 | — |
| Khó | 140 · 195 · 295 ms | 325 · 1 068 · 1 882 ms | 1 698–2 104 ms | 0,27 (0,09–0,51) | — |
| Siêu khó | 200 · 363 · 450 ms | 1 047 · 1 972 · 2 724 ms | 2 396–3 007 ms | 0,22 | 300 · 610 · 1 494 ms |

¹ `|ln(tốc độ dâng ở vạch / tốc độ dâng trung bình từ đáy tới vạch)|`; 0 = ống thẳng; 0,27 ≈ tốc độ ở vạch lệch ~30 % so với lúc đầu.

Các chiều khó tăng dần: Mầm → Thường → Khó khoảng giữ đúng hẹp dần (483 → 202 → 195 ms TB); Thường → Khó nước dâng không đều (0 → 0,27); Khó → Siêu khó mọi câu có 0,3–1,5 s nước dâng khuất phải ước lượng.

## Đảm bảo khi sinh câu đố

- **Đúng một khoảng `holdMs` liền** được chấm đúng, bằng đúng `[holdMinMs, holdMaxMs]` (quét từng ms, 10 000 seed chia đều 4 mức); `holdMinMs − 1` và `holdMaxMs + 1` sai.
- Khoảng đúng rộng ≥ 300 / **160** / 140 / 200 ms theo mức (Siêu khó ≤ 450 ms). Ở Thường đo được ≥ 181 ms.
- `pourLineLevelAt` đơn điệu không giảm, luôn trả số nguyên; giữ 10 000 ms thì đầy (1 000) và chấm sai.
- `idealHoldMs` là ms đầu tiên nước chạm vạch và nằm trong khoảng đúng; `fullMs` là ms đầu tiên nước chạm miệng, lớn hơn `holdMaxMs`.
- Vạch không sát đáy, không sát miệng: `target − tol ≥ 200`, `target + tol ≤ 920`.
- Thời gian rót hợp lý: `idealHoldMs` trong 0,3–3 s, `fullMs ≤ 3,5 s`, khớp khoảng rót đầy của mức (± 1 % do làm tròn `flow`).
- Bình đúng kiểu của mức; bề rộng nguyên 250–1 000; ống thẳng có bề rộng đều; bình lạ luôn có chỗ phình và chỗ thắt.
- Siêu khó: cả khoảng dung sai nằm trên tấm che (mức ≥ 500), nước dâng khuất 300–1 500 ms. Mức khác không che.
- Khó: cốc loe và bình thót chia đều (lệch < 5 %).
- Độ khó tăng dần như bảng đo ở trên.
- `isAnswer` chỉ nhận số nguyên trong [0, 10 000].
- Tất định theo `(seed, index, difficulty)`, không gọi `Math.random`/`Date.now`, thứ tự sinh câu không ảnh hưởng.

Các điều trên được kiểm bằng `pour-line.test.ts` (10 000 seed × 4 mức, phần quét từng ms 10 000 seed chia đều 4 mức).

## Cách chấm

**Đo ở client, chấm ở server.** Client đo `holdMs` = lúc buông − lúc nhấn, gửi một số nguyên. Server sinh lại câu bằng `generate()`, tính `pourLineLevelAt(puzzle, holdMs)` và so với vạch. Server không biết người chơi giữ tay thật bao lâu.

**Mức tin cậy: ngang Luyện ngắm.** Luyện ngắm tin toạ độ chạm do client gửi; game này tin số ms do client gửi. Client biết seed nên bot gửi thẳng `idealHoldMs` được (hạn chế đã biết NFR-SEC-02, như mọi game). Không có cách gian lận nào lợi hơn bot đó. Gửi số lạ (âm, lẻ, quá 10 000, không phải số) bị `isAnswer` bỏ qua.

**Dung sai và độ trễ.** Lúc nhấn và lúc buông đo bằng **cùng một đồng hồ** (`timeStamp` của sự kiện pointer/phím), nên độ trễ cảm ứng cố định của máy bị trừ đi ở cả hai đầu. Còn lại là độ trễ nhả tay dao động (16–50 ms trên điện thoại: chu kỳ quét cảm ứng 60–120 Hz, khung hình 16 ms) và độ trễ hiển thị (người chơi thấy nước muộn hơn thật một chút và sẽ tự quen buông sớm hơn). Quy đổi giữa ms và mức nước tại vạch:

- Tốc độ dâng tại vạch = `flow / vessel[lát của vạch]` đơn vị mức nước mỗi ms. Ống thẳng: `1 000 / fullMs` (Thường ~0,5 đơn vị/ms, tức 1 % chiều cao mỗi 20 ms).
- Nửa khoảng đúng (ms) ≈ `tol × vessel[lát] / flow`; ống thẳng = `tol × fullMs / 1 000`. Thường: `50 × 2 000 / 1 000 = ±100 ms`.
- 50 ms trễ quy ra mức nước = `50 × flow / vessel[lát]` = `50 × (2·tol + 1) / (độ rộng khoảng đúng)`.

| Mức | Dung sai | Khoảng đúng tối thiểu (chốt) | Nửa khoảng TB | 50 ms trễ = (tối đa) | Dung sai ÷ trễ 50 ms |
| --- | --- | --- | --- | --- | --- |
| Mầm | ±80 (±8 %) | 300 ms (đo ≥ 450) | ±241 ms | 18 đơn vị (1,8 %) | ≥ 4,4 lần |
| Thường | ±50 (±5 %) | **160 ms** (đo ≥ 181) | ±101 ms | 28 đơn vị (2,8 %) | ≥ 1,8 lần |
| Khó | ±50 (±5 %) | 140 ms | ±98 ms | 36 đơn vị (3,6 %) | ≥ 1,4 lần |
| Siêu khó | ±70 (±7 %) | 200 ms (trần 450) | ±182 ms | 35 đơn vị (3,5 %) | ≥ 2,0 lần |

Mọi mức: nửa khoảng đúng nhỏ nhất (≥ 70 ms) lớn hơn độ trễ nhả tay lớn nhất (50 ms), nên người chơi điện thoại không bị chấm oan vì phần cứng. Phần còn lại của khoảng đúng là chỗ cho độ chính xác của tay người (lệch chuẩn ~30–50 ms ở người lớn với vật chuyển động đều).

**Không cần đổi server hay giao thức:** `answer` đã là `z.unknown()` + `isAnswer` của game; `judgeAnswer` chấm như mọi game. Số liệu ở mục này là đầu vào cho ADR "đáp án đo thời gian phía client" (backend-dev viết, chung với Nhại nhịp).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian một câu = **bấm** (từ lúc bình hiện tới lúc nhấn) + **giữ** (bắt buộc, theo vạch của câu) + 0,25–0,35 s hiệu ứng. "Sai" đến từ lệch tay khi buông: lúc buông = `idealHoldMs` + trễ + lệch ngẫu nhiên chuẩn σ. Các số σ là **giả định** (tham khảo bài canh thời điểm vật chuyển động đều: người lớn lệch chuẩn ~30–50 ms, trẻ em gấp 2–3 lần; cộng dao động cảm ứng), phải đo lại khi chơi thử.

| Mức | Người chơi | Bấm | Giữ TB | Một câu | Lệch tay σ · trễ | Tỉ lệ sai (mô phỏng) | Câu · đúng mỗi vòng 60 s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 0,9–1,3 s | 1,65 s | ~3,05 s | 130 ms · 40 ms | 7,5 % | 18,5 · 17,1 |
| Mầm | (người lớn chọn Mầm) | 0,36–0,54 s | 1,65 s | ~2,4 s | 50 ms · 20 ms | 0 % | 24,4 · 24,4 |
| Thường | người lớn | 0,44–0,66 s | 1,15 s | ~2,0 s | 50 ms · 20 ms | 6 % | 28,3 · 26,6 |
| Khó | người lớn | 0,48–0,72 s | 1,07 s | ~2,0 s | 65 ms · 20 ms (tốc độ dâng đổi) | 16 % | 27,3 · 22,9 |
| Siêu khó | người lớn | 0,6–0,9 s | 1,97 s | ~3,0 s | √(50² + (0,2 × dâng khuất)²) ≈ 78–300 ms, TB ~130 | 19 % | 18,1 · 14,7 |

- **Các mức tách nhau theo độ chính xác, không theo thời gian.** Thời gian giữ do vạch quyết định (vạch thấp giữ ngắn, vạch cao giữ dài) nên khoảng thời gian một câu của Thường và Khó chồng nhau (~1,1–2,9 s) là bản chất game. Thay vào đó các mức không chồng nhau ở yêu cầu chính xác: khoảng đúng 450–517 ms (Mầm) > 181–223 ms (Thường), Khó thêm tốc độ dâng thay đổi, Siêu khó thêm 0,3–1,5 s ước lượng không nhìn thấy nước. Tỉ lệ sai mô phỏng tăng 6 % → 16 % → 19 %.
- **Thời gian ở Thường ~2,0 s mỗi câu** (~28 câu mỗi vòng 60 s), nhanh hơn ước lượng 2,5 s của kế hoạch: rót đầy ống ~2 s là nhịp vừa; rót chậm hơn thì khoảng đúng rộng hơn và game nhạt.
- Siêu khó còn ~15 câu đúng mỗi vòng (≥ 8).

**Thưởng tốc độ và miễn trừ:** `speedAllowanceMs = holdMinMs`, tức phần giữ tay bắt buộc để có thể đúng không bị tính là chậm. Không có miễn trừ thì vạch cao (giữ ~1,9 s) mất vài điểm thưởng so với vạch thấp, hoàn toàn do may rủi. Phần còn lại (hiệu ứng + bấm + phần giữ trong khoảng đúng) thường < 1,5 s nên câu đúng gần như luôn được trọn 50 điểm thưởng; nhanh chậm chỉ còn thể hiện ở số câu mỗi vòng.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `pourLine`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | `holdMinMs` | Mô phỏng trẻ 7 tuổi cần 1,93 → min(1,93; 1) = 1 |
| Thường | 1 | `holdMinMs` | Mốc so sánh |
| Khó | **1,4** | `holdMinMs` | Mô phỏng cần 1,41, làm tròn tới 0,05 |
| Siêu khó | **2,55** | `holdMinMs` | Mô phỏng cần 2,56, làm tròn tới 0,05 |

Cách mô phỏng (20 000 vòng 60 s mỗi người chơi, cách tính như Xoay hình): câu đố từ chính `generate()`; bấm phân bố đều ±20 % quanh giả định; lúc buông = `idealHoldMs` + trễ + lệch chuẩn σ (bảng trên), kẹp ở `fullMs`; đúng khi nằm trong `[holdMinMs, holdMaxMs]`; câu đúng: hiệu ứng 0,25–0,35 s tính vào `answerMs` câu sau; câu sai: khoá 1,5 s, câu sau tính từ lúc hết khoá; điểm theo `scoring.ts` với miễn trừ `holdMinMs` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 17,1 · 1,4 | 2 212 | 1 078 | 1,93 | 1 | ~3 290 (62 %) |
| Người lớn · Thường | 26,6 · 1,7 | 3 564 | 1 782 | 1 | 1 | ~5 345 (100 %) |
| Người lớn · Khó | 22,9 · 4,4 | 2 793 | 1 396 | 1,41 | 1,4 | ~5 310 (99 %) |
| Người lớn · Siêu khó | 14,7 · 3,4 | 1 746 | 873 | 2,56 | 2,55 | ~5 335 (100 %) |
| Người lớn chọn Mầm | 24,4 · 0 | 3 463 | 1 732 | 1,04 | 1 | ~5 195 (97 %) |

- B_d = A_d ÷ 2 vì câu đúng nào cũng trọn thưởng tốc độ (miễn trừ ở trên).
- Người lớn chọn Mầm chỉ được ~97 % điểm Thường: nước rót chậm (3 s đầy bình) nên dễ hơn mà không nhanh hơn. Không có lợi khi chọn mức dễ, khác hẳn các game giải đố (Xoay hình 184 %).
- Trẻ 7 tuổi ở Mầm được ~62 % người lớn ở Thường vì trần hệ số Mầm = 1 (quy tắc chung).
- **Độ nhạy:** điểm phụ thuộc chủ yếu vào độ chính xác. Ở Kiểm tra não (40 s, Thường), người lớn lệch chuẩn 35 ms được × 1,14 (sai 1 %), 70 ms được × 0,77 (sai 17 %), 90 ms được × 0,59 (sai 28 %).

**Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`, điều phối điền): **3 450**. Theo cách của [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): 4 000 lượt người lớn ở Thường, 40 s của nhóm Hình dung, bấm 0,55 s ± 20 %, giữ theo `idealHoldMs` của từng câu (TB 1,15 s) cộng lệch tay σ 50 ms, trễ 20 ms (sai ~6 %), hiệu ứng 0,25–0,35 s, miễn trừ `holdMinMs`: **18,8 câu · 17,6 đúng**, trung bình ~3 470 điểm, làm tròn tới 50 được 3 450. Người bấm nhanh hơn 30 % được × 1,09, chậm hơn 40 % được × 0,90 (chỉ phần bấm co giãn; phần giữ tay là bắt buộc). Khoảng này hẹp như nhóm Ghi nhớ (× 1,15–1,23) vì cùng lý do: có phần thời gian cố định. Bù lại, độ chính xác tách người chơi rõ (xem Độ nhạy). Script mô phỏng không lưu trong repo.

Núm chỉnh sau chơi thử (chỉ sửa số trong `LEVELS` của `pour-line.ts`, rồi tính lại hệ số và điểm chuẩn):

1. Điện thoại sai nhiều hơn máy tính rõ ở Thường/Khó: tăng khoảng đúng tối thiểu (160 / 140 ms) hoặc làm chậm rót (`fullMs`).
2. Thường quá dễ (sai < 3 %): rót nhanh hơn, 1,6–2,0 s đầy bình.
3. Siêu khó sai > 25 %: tăng `tol` lên ±80 hoặc giảm trần dâng khuất từ 1 500 xuống 1 200 ms.

## Ghi chú cho FE

Bố cục trong khung 720×1280 (y hướng xuống):

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Vòi rót | tâm x 360, y 250–330 | Ống nghiệm / bình rót nghiêng bằng nét phấn; miệng vòi ở (360, 330) |
| Bình | khung x 180–540 (360 px = 1 000 đơn vị bề rộng, **0,36 px/đơn vị**), y 360–1 000 (640 px = 1 000 đơn vị mức nước, **0,64 px/đơn vị**) | Đáy bình ở y 1 000, miệng ở y 360. Mức `L` → `y = 1000 − 0,64·L` |
| Bệ | y 1 000–1 030 | Mặt bàn thí nghiệm, nét phấn |
| Nút giữ | tâm (360, 1 140), bán kính 72 | Biểu tượng tay/giọt nước, nhấn xuống khi đang giữ. Chỉ là gợi ý thị giác: **nhấn ở bất kỳ đâu trong khung từ y ≥ 240** đều rót |

- **Vẽ bình từ `vessel`:** lát `i` có tâm cao `25·i + 12,5` và nửa bề rộng `0,18 × vessel[i]` px. Nối các điểm `(360 ± 0,18·vessel[i], y(25·i + 12,5))` thành viền trơn, kéo thẳng xuống đáy (y 1 000, bề rộng `vessel[0]`) và lên miệng (y 360, bề rộng `vessel[39]`). Nước tô bằng cùng đa giác đó, cắt ngang ở `y(mức nước)`. Viền vẽ trơn còn mô hình là bậc thang 40 lát nên mép nước lệch tối đa vài px theo chiều ngang, mặt nước luôn đúng. Kiểu `shape` chỉ để trang trí (ống đong có vạch chia nhỏ cho `tube`, cốc loe, bình tam giác cho `taper`, bình cầu cho `odd`).
- **Vạch:** dải ngang từ `target − tol` tới `target + tol` tô màu nhấn trong mờ (~25 %), giữa dải là đường đứt nét dài hơn bình 24 px mỗi bên, mũi tên tam giác ở mép trái ngoài bình. Mầm tô dải đậm hơn. Dải nằm trong bình nên không bị huy hiệu khoá che. Không chỉ dựa vào màu: đường đứt nét + mũi tên.
- **Đo thời gian:** `holdMs = Math.round(lúc buông − lúc nhấn)`, lấy từ `timeStamp` của chính hai sự kiện (Phaser: `pointer.upTime − pointer.downTime`; phím: `KeyboardEvent.timeStamp`), không lấy từ vòng lặp khung hình. Vẽ nước mỗi khung bằng `pourLineLevelAt(puzzle, performance.now() − lúc nhấn)` (cùng gốc đồng hồ với `timeStamp`), không tự viết lại công thức. Gửi `Math.min(holdMs, POUR_LINE_MAX_HOLD_MS)`.
- **Một lần giữ mỗi câu:** chỉ con trỏ đầu tiên; ngón thứ hai bỏ qua. Nhấn đã bắt đầu trước khi bình mới hiện thì bỏ qua tới khi nhả, phải nhấn lại. Buông là gửi ngay, sau đó không nhận nhấn tới câu kế.
- **Buông bất thường:** `pointercancel`, mất tiêu điểm cửa sổ, `visibilitychange` sang ẩn trong lúc đang giữ → coi như buông tại lúc đó, gửi như thường. Canvas đặt `touch-action: none` để trình duyệt không cuộn/thu phóng khi giữ.
- **Tràn:** đang giữ mà tới `fullMs` thì tự buông, gửi `fullMs` (chắc chắn sai), vẽ nước tràn qua miệng.
- **Mất kết nối giữa lúc giữ:** huỷ lần rót (nước rút về 0), không gửi; nối lại xong thì hiện lại câu `progress` theo server như Luyện ngắm (`bridge.watchConnection`).
- **Siêu khó, tấm che:** phủ một **khăn vải bảng phấn** (màu thẻ, đặc, có nét gạch chéo phấn) lên lòng bình từ mức `hideFrom` (y 680) lên tới miệng. **Viền bình vẽ đè lên khăn** để vẫn thấy hình bình phía trên; dải vạch, đường đứt nét và mũi tên cũng vẽ đè lên khăn. Mép khăn ở mức 500 là một đường gợn nhẹ. Dưới khăn không vẽ gì của nước (không bóng, không trong suốt một phần, không bọt nổi lên). Dòng nước từ vòi vẫn thấy tới miệng bình. Buông tay xong thì khăn kéo lên (200 ms) cho thấy mực nước thật rồi mới báo đúng/sai.
- **Không lộ mực nước qua kênh khác:** không hiện số % hay số ms trong lúc rót; âm rót (ọc ọc lặp) **giữ nguyên cao độ** ở mọi mức, không cao dần theo mực nước (người tắt tiếng phải chơi ngang người bật tiếng; kế hoạch đã bỏ ý "chỉ nghe tiếng" vì lý do này).
- Rê chuột trên máy tính: con trỏ bàn tay. Phím Space: giữ = rót, nhả = buông (bỏ qua tự lặp phím).
- Nền tối: nước màu xanh ngọc sáng, viền bình phấn trắng, khăn màu thẻ tối có gạch sáng hơn để vẫn tách khỏi nền.

| Trạng thái | Hiển thị |
| --- | --- |
| Câu mới | Bình rỗng trượt vào hoặc hiện mờ dần 150 ms, vạch hiện cùng lúc; nhận nhấn ngay khi bình đứng yên |
| Đang rót | Dòng nước từ vòi tới mặt nước, gợn và bọt nhỏ ở mặt nước, nút giữ lún xuống |
| Buông | Dòng nước tắt ngay, mặt nước đứng yên ở mức của `holdMs`, gửi đáp án |
| Đúng | Dải vạch loé sáng, dấu ✓ cạnh mặt nước, gợn nước; câu kế sau ~300 ms |
| Sai / tràn | Xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`: nước đứng yên ở chỗ người chơi buông (Siêu khó đã kéo khăn lên). Dải vạch sáng màu `--primary` viền dày; vẽ thêm **mặt nước ma** (đường đứt nét ngang bình, nước trong mờ 30 %) ở đúng mức `target`, tức "đáng lẽ dừng ở đây". Một mũi tên dọc nối mặt nước thật tới vạch: hướng lên nếu chưa tới (buông sớm), hướng xuống nếu quá vạch (buông muộn), kèm biểu tượng đồng hồ và số giây lệch `(holdMs − idealHoldMs) / 1 000`, vd. "−0,24 s" (chỉ số, định dạng theo ngôn ngữ). Tràn: nước chảy tràn qua miệng bình, mặt nước ma ở vạch. Mọi thứ nằm trong bình (y ≥ 360), không bị huy hiệu khoá che.

### Hiệu ứng

Bình hiện 150 ms, gợn mặt nước, bọt, loé dải vạch 200 ms, khăn kéo lên 200 ms, nước tràn 300 ms. Giảm chuyển động (`prefersReducedMotion()` của `@/features/motion`): bình hiện tức thì, bỏ gợn, bọt, loé; khăn biến mất tức thì. **Nước dâng giữ nguyên** vì là luật chơi. Âm: ọc ọc lặp khi rót (cao độ cố định), "ting" khi đúng (cao dần theo combo), "bụp" trầm khi sai, "xèo" khi tràn.

### Chỉnh scene theo bản mẫu

Bố cục scene hiện tại khớp bản mẫu M31; vấn đề là màu trên nền khung sáng `--muted` #f3eadf (`PourLineScene.ts`). Bản mẫu Levels dùng seed 2026 câu 0 của bộ sinh thật.

- **Nước** (đã chốt): sáng `#2f84cf` (3,3:1 trên #f3eadf; `--color-sky` hiện chỉ 1,5:1), tối `#6fd6e8` xanh ngọc (6,7:1 trên #3a3560). **Mặt nước**: sáng mực #1f1b3a, tối phấn #f6f3ea, nét 4 → 5 px (thay `--color-analyze`).
- **Khăn che** (đã chốt): `#8a80b8` ở cả hai chế độ (≥ 3:1 với khung sáng lẫn tối) thay `--card` (trùng tông khung, khăn "biến mất"); gạch chéo sáng mực mờ 0,28 / tối phấn mờ 0,35, nét 4; mép gợn đặc, nét 4.
- **Dải vạch**: mép dải nét liền 3 px mờ 0,75 (sáng #1f1b3a, tối #c9c6dc) thay nét 2 px mờ 0,35; độ mờ nền dải: sáng 0,5 (Mầm 0,65), tối 0,3 (Mầm 0,42).
- **Gợi ý câu đầu** (mới): tới lần nhấn đầu của vòng, vòng gạch đứt r 92 quanh nút + viên thuốc mực (466, 1112, 236 × 64) chữ vàng "Giữ để rót"; cần khoá chữ mới trong `locales.ts` (vi "Giữ để rót", en "Hold to pour").
- Ống nghiệm rót, bệ, nút giữ, ✓, nhãn số giây, mũi tên, nước tràn: giữ hình, chỉ đổi theo màu nước mới.
- `PourLineHowTo.tsx`: mặt nước `stroke-analyze` → `stroke-ink` 4 px, thêm hai mép dải `stroke-chalk` 2 px mờ 0,8.
- Đề xuất token (chưa sửa `globals.css`, chờ duyệt): `--water` / `--water-surface` theo sáng/tối.

## Ghi chú cho BE

- `Answer` là số nguyên ms (như đáp án chỉ số của game khác), `isAnswer` kiểm miền [0, 10 000]; giao thức `answer: z.unknown()` nên **không đổi schema**.
- Không khai báo `answerWindowMs`, không cần hook mới. Nhịp gửi ~0,5 đáp án/giây, xa giới hạn `MAX_ANSWERS_PER_SECOND`.
- Đáp án đo thời gian phía client: mức tin cậy, dung sai và lý do ở mục **Cách chấm**, làm đầu vào cho ADR (backend-dev viết, chung với Nhại nhịp).
- Có thể thêm sau (không đề xuất làm bây giờ): kiểm "server chưa đủ thời gian để người chơi giữ ngần ấy ms" (`now − shownAt < holdMs − LATE_ANSWER_GRACE_MS` → bỏ qua). Chỉ chặn được bot ngây thơ gửi ngay; bot chờ đủ `idealHoldMs` vẫn qua, còn người chơi thật có thể bị chặn oan khi mạng giật. Không đáng so với rủi ro.
- Test server cần một đáp án đúng: `GAMES["pour-line"].generate(s, i, d).idealHoldMs`.

## Tác động Kiểm tra não

Đăng ký game là thêm game vào nhóm Hình dung (Xoay hình, Nhìn từ trên, Gấp hộp, Mảnh vừa khít, Nối mạch, Rót vừa vạch). Theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): điều phối thay số giữ chỗ 1 500 bằng **3 450**, tăng `BRAIN_TEST_RULES_VERSION` một lần chung cho cả đợt CR-014, và thêm dòng vào bảng điểm chuẩn ở GDD: "Hình dung · Rót vừa vạch · 40 s · bấm 0,55 s + giữ theo vạch (TB 1,15 s) · 6 % · 18,8 · 17,6 · **3 450** · × 1,09 · × 0,90".

## Câu hỏi mở

1. **Siêu khó không có tốc độ rót tăng dần** (kế hoạch mục 3.10 có). Lý do: khi nửa trên bị che, nước vừa tăng tốc vừa đi qua bình hình lạ thì lúc tới vạch phụ thuộc phép ngoại suy bậc hai, gần với đoán mò hơn là hình dung thể tích. Thay bằng: mỗi câu một tốc độ khác nhau (±11 %), người chơi đọc tốc độ ở nửa dưới. *Đề xuất:* giữ như vậy; chơi thử thấy Siêu khó quá dễ thì thêm tăng tốc nhẹ (vd. +30 % từ đầu tới cuối) như một núm chỉnh.
2. **Dung sai Siêu khó ±7 %** (kế hoạch không ghi): rộng hơn Khó vì phần ước lượng không nhìn thấy nước. Chốt lại sau chơi thử.
3. **Hiện dải dung sai trên bình ở mọi mức** (không chỉ một đường vạch): giúp người chơi hiểu "trong dải là đúng", và chấm thật cũng theo dải. *Đề xuất:* giữ; nếu thấy Thường quá dễ thì chỉ hiện đường vạch ở Khó trở lên.
4. **Thời gian ở Thường ~2,0 s mỗi câu** (kế hoạch ước 2,5 s, ~20 câu): xem mục Cân bằng.

## Tên và mô tả cho thẻ game (gợi ý cho frontend-dev)

- vi: **Rót vừa vạch** · "Giữ để rót, buông đúng vạch".
- en: **Pour to the Line** · "Hold to pour, release on the line".
