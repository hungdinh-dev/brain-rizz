# Hình to hình nhỏ (`navon-shapes`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/navon-shapes/` (logic + test), `apps/web/src/games/navon-shapes/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M20** (NavonShapesMobile, NavonShapesLevels, NavonShapesStates, NavonShapesHowTo). Chờ chủ dự án duyệt.
- Nguồn: [CR-014](../00-tracking/change-requests.md#cr-014), [kế hoạch mở rộng minigame](../01-product/minigame-expansion.md) mục 3.11. Cơ chế cổ điển **hình Navon** (hình to ghép từ hình nhỏ, Navon 1977), thay cho Stroop chữ màu để không phụ thuộc chữ và không chỉ phân biệt bằng màu (kế hoạch mục 2, nguyên tắc 6). Tên, hình, chủ đề bảng phấn là của Brain Rizz.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Giữa bảng có một **hình to** được ghép từ nhiều **hình nhỏ** (vd. một tam giác to ghép từ các hình tròn nhỏ). Nhìn khung bao quanh: **khung tròn** → chạm nút có **hình to**; **khung vuông** (từ mức Khó) → chạm nút có **hình nhỏ**.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn hình to ghép từ hình nhỏ
  2. Khung tròn: chạm hình to
  3. Khung vuông (từ Khó): chạm hình nhỏ
- **Điều khiển:** Chạm nút hình (điện thoại) · Click nút hình, hoặc phím số 1–5 theo nút từ trái sang (máy tính).
- **Hình minh hoạ:** hai ô cạnh nhau, cùng một hình: tam giác to ghép từ các hình tròn nhỏ. Ô trái đặt trong **khung tròn** (viền phấn liền): bên dưới, nút tam giác sáng vàng + dấu tích, nút hình tròn mờ gạch chéo. Ô phải đặt trong **khung vuông** (viền là chuỗi ô vuông nhỏ): nút hình tròn sáng vàng + dấu tích, nút tam giác mờ gạch chéo. Dưới mỗi ô là biểu tượng của chip luật (mục Ghi chú cho FE): khung tròn → một hình to; khung vuông → kính lúp trên nhóm hình nhỏ.
- **Câu nhắc lúc đếm ngược:** "Hình to là hình gì?" (dùng cho Mầm, Thường).
- **Câu nhắc theo mức** (`levelHints`): Khó "Tròn: hình to · Vuông: hình nhỏ!" · Siêu khó "Nhớ luật khung, nút đổi chỗ!". Bắt buộc có cho Khó và Siêu khó, vì câu chung chỉ nói về hình to.
- **Gợi ý cạnh từng mức** (`levels`): Mầm "3 hình · chọn hình to" · Thường "4 hình · hình nhỏ đánh lừa" · Khó "Khung tròn hình to, vuông hình nhỏ" · Siêu khó "5 hình · nút đổi chỗ".
- **Thẻ game** (gợi ý): tên "Hình to hình nhỏ", mô tả "Chọn hình to hay hình nhỏ theo khung". Tiếng Anh: "Big Shape, Small Shape", "Pick the big or small shape"; câu nhắc Khó "Round: big shape · Square: small ones!", Siêu khó "Mind the frame, buttons move!"; câu chung "What's the big shape?".

### Khác Phấn trượt ở đâu

Cả hai game đều đổi luật theo một dấu hiệu, nên cố ý tách khác nhau rõ:

| | Phấn trượt | Hình to hình nhỏ |
| --- | --- | --- |
| Dấu hiệu đổi luật | Thuộc tính của chính vật (màu phấn + kiểu nét) | **Vật chứa bên ngoài** (khung tròn / khung vuông + kiểu viền), không dùng màu |
| Hai thứ giằng co | Hai hướng chuyển động (chỉ / trượt) | Hai cấp nhìn (cả hình / từng mảnh), đứng yên |
| Trả lời | Vuốt 4 hướng | Chạm 1 trong 3–5 nút hình |
| Từ mức nào đổi luật | Thường (đổi màu 30 %) | **Khó** (Mầm, Thường luôn hỏi hình to) |
| Cách đổi | Chuỗi đổi màu giữa hai câu liền 30 / 60 % | Mỗi câu bốc độc lập 50 / 50 → đổi khung ~50 % giữa hai câu liền |
| Siêu khó thêm | Tốc độ, màu gần, nét tẩy mờ | Loại hình thứ 5, nút đổi chỗ mỗi câu, ẩn chip luật |

Câu nhắc của game này không bao giờ nói về màu; câu nhắc của Phấn trượt không nói về khung.

## Câu đố & đáp án

**Loại hình** (`NavonShape`, thứ tự cố định `NAVON_SHAPES`): `"circle"` tròn, `"square"` vuông, `"triangle"` tam giác, `"plus"` chữ thập, `"heart"` trái tim. Mầm dùng 3 loại đầu, Thường và Khó 4 loại đầu, Siêu khó cả 5.

**Mặt nạ hình to** (`NAVON_MASKS`, lưới `NAVON_GRID` = 7 × 7, ô `{ col, row }`, gốc trên trái; `#` là ô có một hình nhỏ):

```
circle   square   triangle plus     heart
..###..  #######  ...#...  ...#...  .##.##.
.#...#.  #.....#  ..#.#..  ...#...  #..#..#
#.....#  #.....#  ..#.#..  ...#...  #.....#
#.....#  #.....#  .#...#.  #######  #.....#
#.....#  #.....#  .#...#.  ...#...  .#...#.
.#...#.  #.....#  #.....#  ...#...  ..#.#..
..###..  #######  #######  ...#...  ...#...
16 ô     24 ô     18 ô     13 ô     16 ô
```

Mọi hình to chiếm trọn khung 7 × 7 (cùng cỡ, không đoán được qua kích thước), đối xứng trái–phải, liền một khối; hai hình bất kỳ khác nhau ít nhất 16 ô (test kiểm ≥ 12) và không hình nào nằm gọn trong hình khác. Hình to là **đường bao** (trừ chữ thập là hai nét), để từng hình nhỏ đứng riêng, dễ đọc.

- `Puzzle` (`NavonShapesPuzzle`):
  - `global: NavonShape`: hình to.
  - `local: NavonShape`: hình nhỏ ghép nên hình to (trùng `global` ở câu không xung đột).
  - `cells: readonly NavonCell[]`: mặt nạ của hình to (= `NAVON_MASKS[global]`); FE đặt một hình nhỏ `local` vào tâm mỗi ô.
  - `ask: "global" | "local"`: `"global"` → vẽ **khung tròn**, hỏi hình to; `"local"` → vẽ **khung vuông**, hỏi hình nhỏ.
  - `buttons: readonly NavonShape[]`: loại hình trên từng nút, trái → phải; mỗi loại của mức đúng một lần.
  - `answerIndex: number`: nút đúng, `buttons[answerIndex] === (ask === "global" ? global : local)`.
- `Answer`: `number`, **chỉ số nút** chạm (0 = nút trái nhất), gửi một lần mỗi câu. `check`: đúng khi `answer === answerIndex`. `isAnswer`: số nguyên 0–4.
- Hằng số export cho FE: `NAVON_SHAPES`, `NAVON_GRID`, `NAVON_MASKS`, `NAVON_SHAPES_LEVELS`.
- Lấy đáp án đúng (test server): `GAMES["navon-shapes"].generate(s, i, d).answerIndex`.

## Cách sinh câu đố

1. Đi lần lượt từ câu 0 tới câu `index`. Câu `j` bốc từ luồng riêng `createRng(deriveSeed(seed, j))`, đúng 4 lần gọi: hình to `g = int(0, n − 1)`; xung đột `int(0, 99) < conflictPct`; độ lệch `int(1, n − 1)`; câu hỏi `int(0, 99) < localAskPct` → `"local"`, ngược lại `"global"`. Hình nhỏ = `g` nếu không xung đột, `(g + độ lệch) mod n` nếu xung đột (đều trong các loại còn lại).
2. **Không lặp y hệt câu trước:** nếu câu `j` ra đúng cùng hình to, hình nhỏ và khung với câu `j − 1` thì đẩy hình to sang loại kế (`g + 1 mod n`), giữ nguyên cờ xung đột, độ lệch và khung. Phép đẩy đối xứng vòng quanh danh sách nên hình to vẫn đều các loại; tỉ lệ xung đột và tỉ lệ khung không đổi. Chi phí O(index), mỗi bước một `createRng` nhỏ (index ≤ ~60 mỗi vòng, ~4 µs ở câu 59), giống chuỗi đổi màu của Phấn trượt.
3. **Nút:** Mầm, Thường, Khó giữ thứ tự cố định `NAVON_SHAPES`. Siêu khó xáo bằng luồng riêng `createRng(deriveSeed(seed, index, muối))`; câu chẵn dùng hoán vị chẵn, câu lẻ hoán vị lẻ (lệch tính chẵn lẻ thì đổi chỗ hai nút đầu), nên **hai câu liền nhau không bao giờ cùng thứ tự nút**, mà thứ tự vẫn đều trong mỗi nhóm.
4. `answerIndex` = vị trí của hình được hỏi trong `buttons`.

**Vì sao đúng một đáp án:** `ask` chọn đúng một loại hình (hình to hoặc hình nhỏ); `buttons` là hoán vị của các loại trong mức nên loại đó có đúng một nút; `check` chỉ nhận chỉ số nút đó. Hình to và hình nhỏ luôn thuộc loại của mức nên khi xung đột cả hai đều có trên nút: luôn có giằng co giữa nút "hình to" và nút "hình nhỏ".

## Độ khó

| Mức | Loại hình = số nút | Xung đột (hình nhỏ ≠ hình to) | Khung | Nút |
| --- | --- | --- | --- | --- |
| Mầm | 3 (tròn, vuông, tam giác) | 25 % | luôn tròn (hỏi hình to) | cố định |
| Thường | 4 (+ chữ thập) | 75 % | luôn tròn (hỏi hình to) | cố định |
| Khó | 4 | 80 % | tròn / vuông 50 / 50, bốc từng câu | cố định |
| Siêu khó | 5 (+ trái tim) | 90 % | tròn / vuông 50 / 50, bốc từng câu | **đổi chỗ mỗi câu** |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Hình to thường ghép từ chính nó (tròn ghép từ tròn); ba nút quen chỗ |
| Thường | Hình nhỏ thường khác hình to và có nút riêng: phải bỏ qua hình nhỏ đang "kéo mắt" |
| Khó | Khung đổi tròn / vuông gần như mỗi câu thứ hai; câu hỏi hình nhỏ khó hơn vì hình to nổi lên trước |
| Siêu khó | Thêm trái tim, nút đổi chỗ mỗi câu (phải tìm nút), không còn chip nhắc luật |

**Độ khó đo được** (bộ sinh thật, 10 000 seed × 12 câu liên tiếp mỗi mức, 2026-10-20):

| Mức | Số nút | Câu xung đột | Hỏi hình nhỏ | Đổi khung giữa 2 câu liền | Nút đổi chỗ giữa 2 câu liền (TB) | Hình to trùng câu trước |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 3 | 25,0 % | 0 % | 0 % | 0 | 13,6 % |
| Thường | 4 | 75,0 % | 0 % | 0 % | 0 | 18,8 % |
| Khó | 4 | 79,9 % | 50,0 % | 49,8 % | 0 | 21,9 % |
| Siêu khó | 5 | 89,9 % | 50,0 % | 49,8 % | 4,00 / 5 | 18,0 % |

Mỗi bước lên mức tăng ít nhất một chỉ số (số nút, xung đột, hỏi hình nhỏ, nút đổi chỗ) và không chỉ số nào giảm (test `khó dần`). Đáp án đều theo nút (đo được lệch < 0,5 %) và theo loại hình (test kiểm lệch < 3 %). Không câu nào giống hệt câu trước (0 %).

## Đảm bảo khi sinh câu đố

- Đúng một nút đúng trong 5 đáp án hợp lệ; nút đó mang hình được hỏi (`ask`).
- Nút đủ các loại của mức, không trùng; hình được hỏi xuất hiện đúng một lần; khi xung đột cả hình to lẫn hình nhỏ đều có trên nút.
- `cells` đúng mặt nạ của hình to; mặt nạ trong lưới 7 × 7, chiếm trọn khung, đối xứng, liền khối, hai hình khác nhau ≥ 12 ô.
- Mầm, Thường chỉ hỏi hình to; Khó trở lên có cả hai khung (50 %, lệch < 2 %).
- Tỉ lệ xung đột đúng bảng mức (lệch < 2 %).
- Chỉ Siêu khó xáo nút, và hai câu liền nhau luôn khác thứ tự nút.
- Hai câu liền nhau không bao giờ giống hệt (cùng hình to, hình nhỏ, khung), kể cả cuối vòng dài (câu 50–59).
- Hình to và đáp án phân bố đều (lệch < 3 %).
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random` / `Date.now` (test chặn hai hàm này khi sinh).

Kiểm trong `navon-shapes.test.ts`: 10 000 seed × 12 câu liên tiếp × 4 độ khó (480 000 câu), thêm 2 000 seed × câu 50–59 mỗi mức. Chạy ~1,5 s.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian = nhận hình (hình to nổi lên trước hình nhỏ, "global precedence") + gạt bỏ cấp kia khi xung đột + tìm nút + chạm ~0,3 s.

- Thường: nhận hình to ~0,4 s, gạt hình nhỏ ~0,1 s, tìm nút cố định ~0,2 s → 1,0–1,5 s (kế hoạch: ~1,3 s).
- Khó: thêm nhìn khung ~0,15 s, chi phí đổi luật ở câu đổi khung ~0,25 s, câu hỏi hình nhỏ chậm hơn ~0,2 s vì hình to chen vào → 1,5–2,1 s.
- Siêu khó: thêm tìm nút trong 5 nút đã đổi chỗ ~0,4–0,6 s → 2,1–2,8 s.

| Mức | Thời gian giải mỗi câu | Tỉ lệ đúng | Số câu mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 1,6–2,4 s (người lớn 0,6–0,9 s) | 90 % (người lớn 97 %) | ~24 (22,0 đúng) |
| Thường | 1,0–1,5 s | 95 % | ~37 (35,2 đúng) |
| Khó | 1,5–2,1 s | 89 % | ~27 (23,7 đúng) |
| Siêu khó | 2,1–2,8 s | 85 % | ~20 (17,1 đúng) |

Các mức của người lớn không chồng nhau (Thường ≤ 1,5 s ≤ Khó ≤ 2,1 s ≤ Siêu khó). Siêu khó còn ~17 câu đúng mỗi vòng (≥ 8). Thường nhiều câu hơn khuyến nghị 15–25 của GDD vì mỗi câu chỉ là một lần nhận hình, giống Kẻ lạc đàn và Phấn trượt; vẫn trong khung 1–8 s mỗi câu.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `navonShapes`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 2,10 → min(2,10; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **1,9** | không khai báo | Mô phỏng cần 1,92, làm tròn tới 0,05 |
| Siêu khó | **3** | không khai báo | Mô phỏng cần 3,02, làm tròn tới 0,05 |

- `speedAllowanceMs`: không cần, hình và khung hiện cùng lúc, chạm được ngay, một chạm là xong. `answerWindowMs`: không khai báo (hình không biến mất).
- Cách mô phỏng (như Bóng của ai, Phấn trượt): 200 000 vòng 60 s mỗi người chơi, chạy trên chính `generate()` và `pointsForCorrect`; thời gian giải đều trong khoảng ở bảng trên, đúng theo tỉ lệ ở bảng; câu đúng thêm 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau; câu sai tốn thời gian như câu đúng rồi khoá 1,5 s; câu chưa xong khi hết giờ không tính. S_d(m) = m × A_d + B_d, giải m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 22,0 · 2,4 | 2 828 | 1 250 | 2,10 | 1 | ~4 080 (57 %) |
| Người lớn · Thường | 35,2 · 1,9 | 4 805 | 2 375 | 1 | 1 | ~7 180 (100 %) |
| Người lớn · Khó | 23,7 · 2,9 | 3 020 | 1 382 | 1,92 | 1,9 | ~7 120 (99 %) |
| Người lớn · Siêu khó | 17,1 · 3,0 | 2 093 | 854 | 3,02 | 3 | ~7 130 (99 %) |
| Người lớn chọn Mầm | 53,4 · 1,7 | 7 546 | 3 773 | 0,45 | 1 | ~11 320 (158 %) |

- Trẻ 7 tuổi ở Mầm được ~57 % người lớn ở Thường do trần hệ số Mầm = 1 (quy tắc chung). Người lớn chọn Mầm được ~158 %: Mầm quá dễ với người lớn, giống mọi game Nhận diện.
- Siêu khó cần hệ số 3, gần Phấn trượt (2,9): Thường của cả hai game rất nhanh (~35 câu đúng) nên mốc cao.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **3 450**. Theo cách của [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): người lớn ở Thường, 30 s của nhóm Nhận diện, thời gian đều ±20 % quanh 1,25 s, sai 5 %, hiệu ứng 0,25–0,35 s, chạy trên `generate()` + `pointsForCorrect`: 4 000 lượt ra 3 463 (17,5 đúng · 0,9 sai), 200 000 lượt ra 3 455, làm tròn tới 50 → 3 450. Nhanh hơn 30 % được × 1,34, chậm hơn 40 % được × 0,72. Gần Kẻ lạc đàn (3 350, 1,3 s mỗi câu). Script mô phỏng không lưu trong repo.

Núm chỉnh sau chơi thử (chỉ sửa số trong `NAVON_SHAPES_LEVELS`, rồi tính lại hệ số):

1. Thường quá dễ (gần như không sai): xung đột 75 % → 90 %.
2. Khó sai > 20 %: hiện chip luật to hơn ngay trên khung, hoặc hỏi hình nhỏ 50 % → 35 %.
3. Siêu khó sai > 25 %: bỏ xáo nút nhưng giữ 5 loại.
4. Trùng ý Phấn trượt / Cổng luật khi chơi thử: mở CR bỏ game (theo CR-014).

## Ghi chú cho FE

Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Chip luật | y 180–236, căn giữa, rộng ≤ 420 | Chỉ biểu tượng, không chữ: [khung tròn nhỏ] → [một hình to] · [khung vuông nhỏ] → [kính lúp trên 3 hình nhỏ]. Mầm/Thường chỉ nửa trái (chưa có khung vuông); Khó đủ hai nửa; **Siêu khó ẩn**. Thấp hơn dải huy hiệu khoá |
| Khung | tâm (360, 580), cỡ ngoài 640 (x 40–680, y 260–900) | Khung tròn: đường tròn đường kính 640. Khung vuông: hình vuông 640 × 640, **góc vuông không bo**. Lòng khung tô nền bảng đậm hơn nền chung một chút |
| Lưới hình to | 448 × 448 (ô 64), góc trên trái (136, 356) | Mỗi ô của `cells` đặt một hình nhỏ `local` ở tâm ô, cỡ 46 (~72 % ô, ~25 px trên điện thoại 390). Cùng màu phấn `--chalk`, đặc |
| Nút | hàng y 960–1120 | 3 nút: 200 × 160, tâm x 136 / 360 / 584 · 4 nút: 150 × 160, tâm x 111 / 277 / 443 / 609 · 5 nút: 120 × 150, tâm x 96 / 228 / 360 / 492 / 624 (~65 px trên điện thoại 390). Mỗi nút vẽ `buttons[i]` cỡ 76 (5 nút: 64) |
| Thanh khoá | 420 × 14 tại (150, 1206) | Khi sai |

- **Khung là dấu hiệu luật, không dùng màu:** hai khung khác nhau cả **hình dạng** lẫn **kiểu viền**. Khung tròn: một nét phấn liền dày ~14 ("một hình to"). Khung vuông: viền là chuỗi **ô vuông nhỏ** ~22 × 22, khe ~10 ("nhiều mảnh nhỏ"). Cùng màu phấn; người mù màu và màn đen trắng vẫn phân biệt được.
- **Không nhầm khung với hình to:** khung là một tấm bảng có lòng tô nền, lớn hơn lưới (hình vuông to nhất cách mép trong khung tròn ≥ 8 đơn vị); hình to luôn ghép từ hình nhỏ rời nhau, còn khung là nét liền hoặc chuỗi ô đều. Hình tròn to trong khung tròn, hay hình vuông to trong khung vuông, vẫn phải thấy rõ hai lớp.
- **Vẽ hình nhỏ:** tròn = đĩa; vuông = ô vuông đặc; tam giác = tam giác đều đỉnh lên; chữ thập = hai thanh rộng 1/3; trái tim = hai đĩa + tam giác. Hình nhỏ đứng thẳng, không xoay (tam giác xoay dễ thành mũi tên). Có thể vẽ sẵn mỗi loại thành texture khi tạo scene. Nút dùng cùng nét vẽ, to hơn.
- **Nhập:** chạm / click nút. Máy tính: phím số 1…n theo vị trí nút trái → phải (Siêu khó theo vị trí sau khi xáo); nút hiện nhãn phím nhỏ ở góc; bấm phím thì nút nhấp sáng như khi click; bỏ qua phím lặp (`event.repeat`), phím kèm Ctrl/Alt/Meta và khi con trỏ đang ở ô nhập chữ (ô chat). Mỗi câu chỉ nhận một lần.
- Rê chuột: nút nhấc 4 px.
- Nền tối: phấn `--chalk` trên bảng tối giữ tương phản ≥ 3 : 1; lòng khung đậm hơn nền chung nhưng không làm tương phản hình nhỏ dưới 3 : 1.

| Trạng thái | Hiển thị |
| --- | --- |
| Câu mới | Khung và hình to hiện **cùng lúc** (mờ → rõ 120 ms, hình to phóng 92 % → 100 %), nhận đáp án ngay. Không làm hiệu ứng riêng khi khung đổi tròn ↔ vuông (để chi phí đổi luật là thật). Hiệu ứng hiện câu luôn chạy nên hai câu cùng hình to vẫn đọc ra là câu mới |
| Đúng | Gửi ngay; nút vừa chọn sáng vàng (`--primary`), các hình nhỏ bay tản ra như bụi phấn; ~300 ms sau câu mới (đã tính vào mô phỏng) |
| Sai / khoá | Xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`: nút đúng sáng vàng (`--primary`) + dấu tích; nút vừa chạm có X đỏ (`--destructive`), các nút khác mờ 35 %. Trong khung, chỉ ra cấp đúng:

- `ask = "global"` (khung tròn): sau mỗi hình nhỏ vẽ một đĩa vàng mờ (`--primary` 35 %, bán kính ~0,6 ô) để các đĩa chồng nhau thành một dải vàng theo **đường bao hình to**.
- `ask = "local"` (khung vuông): một hình nhỏ (ô gần tâm khung nhất; hoà thì lấy ô đứng trước trong `cells`) phóng ×2,2 trong một vòng **kính lúp** viền vàng; đường bao hình to mờ 50 %.
- Viền khung nháy vàng 2 lần (giữ hình dạng và kiểu viền) để nhắc "khung này hỏi cấp nào"; ngay dưới khung (y 905–950) hiện nửa chip luật ứng với khung đó.

Khung, lưới và nút đều dưới y 260, không bị huy hiệu khoá che (chip luật y ≥ 180 không chứa đáp án).

### Hiệu ứng

Câu mới 120 ms, hình nhỏ tản khi đúng 250 ms, rung nút sai 200 ms. Giảm chuyển động (`prefersReducedMotion()`): bỏ phóng, tản, rung, nháy; giữ trạng thái tĩnh (nút vàng / X đỏ, dải vàng, kính lúp). Âm: "cạch" phấn ngắn khi đúng, "bụp" trầm khi sai.

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M20 (ui-designer, 2026-10-20). Toạ độ trên khung 720×1280.

- **Đã chốt, mặt bảng:** thẻ khung chơi là `bg-muted` (kem #f3eadf / #3a3560) nên vẽ tấm bảng trong canvas. Tấm bảng chính là khung luật: tròn r 328 hoặc vuông 640 góc không bo. Không thêm bảng gỗ chữ nhật phía sau, vì sẽ làm khung tròn trông như nằm trong khung vuông.
- **Đã chốt, khung:** khung tròn là nét phấn liền 12 ở r 314; khung vuông là chuỗi 20 ô RỖNG mỗi cạnh (ô 22, nét 6). Vuông to ghép từ vuông nhỏ trong khung vuông vẫn tách được hai lớp, vì ô viền rỗng và chỉ bằng nửa hình nhỏ đặc.
- **Đã chốt, nút:** chữ nhật bo 22, không tròn, không vuông. Viền mực 5, bóng 6 (hiện đang là bo 18, viền 4). Hình trên nút đặt đúng tâm nút.
- **Đã chốt, chip luật:** viên thuốc `--card` viền mực 4, bóng 5, cao 56, chỉ biểu tượng, không mã màu. Khung mini vẽ y như khung lớn: tròn là đĩa r 20 tô lòng bảng + vòng phấn r 14; vuông là ô 40 tô lòng bảng + 16 ô phấn 5×5. Hiện đang là nét mực trên nền kem.
- Lòng bảng: #2b604d ở nền sáng, #1b1832 ở nền tối (`--board` phủ thêm đen 8 % / 25 %, không thêm token). Thêm vết lau trắng mờ 5–7 % sát mép, tránh vùng lưới.
- Nhãn phím trên máy tính: Baloo cỡ 24, màu chữ thẻ 70 %, đặt ở (trái + 22, đỉnh + 34).
- Khi đúng: hình nhỏ tản ra xa tâm khung một quãng bằng 17 % khoảng cách tới tâm (không dùng số px cố định), mờ còn 55 %, kèm bụi phấn.
- Khi viền khung nháy vàng: thêm nét mực dưới nét vàng (vòng tròn: mực 20 dưới vàng 12; chuỗi ô: mực 11 dưới vàng 6).
- Kính lúp: lòng tối hơn lòng bảng (#1d4637 / #121024). Vành vàng 8 trên mực 16. Cán vẽ theo đường chéo từ 82 tới 124 (mực 28, vàng 16).
- Hình hướng dẫn: ô trái là đĩa tô đen 16 % + vòng phấn liền, có dải vàng mờ theo đường bao hình to. Ô phải là ô vuông + chuỗi 16 ô rỗng, khoanh vàng một hình nhỏ. Dưới mỗi ô có 2 nút 68×56, rồi nửa chip thu 0,72.

## Ghi chú cho BE

Không. Đáp án một số nguyên 0–4, chấm một lần mỗi câu như Kẻ lạc đàn. `generate` đi lại từ câu 0 tới câu `index` (O(index), ~4 µs ở câu 59), vẫn tất định và rẻ. Không cần `speedAllowanceMs` hay `answerWindowMs`.

## Tác động Kiểm tra não

Nhóm Nhận diện thêm một game: commit đăng ký phải thay số giữ chỗ bằng điểm chuẩn **3 450**, tăng `BRAIN_TEST_RULES_VERSION` (một lần cho cả đợt CR-014) và thêm dòng vào bảng điểm chuẩn ở GDD: Nhận diện · Hình to hình nhỏ · 30 s · 1,25 s · 5 % · ~18,4 · 17,5 · **3 450** · × 1,34 · × 0,72. Phần này do điều phối làm.

## Câu hỏi mở

1. **Khung tròn / vuông trùng tên với hình tròn / vuông trong bộ hình.** Đề xuất giữ (tròn, vuông là hai hình dễ nhất cho trẻ ở Mầm) và tách bằng cách vẽ khung như mục Ghi chú cho FE. Nếu chơi thử thấy nhầm, thay hình tròn / vuông trong bộ hình bằng thoi / ngôi sao (chỉ sửa `NAVON_SHAPES` và mặt nạ, test giữ nguyên).
2. **Chip luật ẩn ở Siêu khó** (Phấn trượt ẩn từ Khó). Đề xuất: hiện ở Khó vì luật khung là ánh xạ tuỳ ý, mới gặp lần đầu ở Khó; ẩn ở Siêu khó để tách hai mức.
3. **Phím số 1–5 trên máy tính**: đề xuất làm luôn như Phấn trượt.
4. **Thường ~37 câu mỗi vòng**, nhiều hơn khuyến nghị 15–25 của GDD: đề xuất giữ như Phấn trượt, Kẻ lạc đàn.
5. **Trẻ 7 tuổi ở Mầm** được ~57 % người lớn ở Thường do trần hệ số Mầm = 1: theo luật chung, không có hệ số riêng.
