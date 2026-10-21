# Ô bí ẩn (`latin-cell`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/latin-cell/` (logic + test: `latin-cell.ts`, `grid.ts` bộ giải, `fallback.ts` câu dự phòng), `apps/web/src/games/latin-cell/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M24** (LatinCellMobile, LatinCellLevels, LatinCellStates, LatinCellHowTo). Chờ chủ dự án duyệt.
- Nguồn ý tưởng: cơ chế hình vuông Latin cổ điển (kế hoạch mở rộng, [mục 3.7](../01-product/minigame-expansion.md)). Chỉ mượn cơ chế; tên, hình và chữ là của Brain Rizz.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Lưới hình giống Sudoku nhỏ: mỗi hàng, mỗi cột (và mỗi khối viền đậm, từ mức Khó) có đủ mỗi hình đúng một lần. Nhìn lưới, suy ra hình của ô dấu **?** rồi chạm thẻ hình đó ở hàng bên dưới.

## Màn hướng dẫn

- **Cách chơi:**
  1. Mỗi hàng, mỗi cột đủ mọi hình
  2. Tìm hình còn thiếu ở ô ?
  3. Chạm thẻ hình đúng bên dưới
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: phím `1` … `n` chọn thẻ thứ 1 … n (trái sang phải).
- **Hình minh hoạ:** lưới 4×4 của [ví dụ Thường](#ví-dụ) (không khối). Hàng của ô ? được tô nhạt và đánh số ① cạnh hình tròn; cột của ô ? đánh số ② cạnh tam giác và hình vuông. Hàng thẻ bên dưới có 4 thẻ, thẻ ngôi sao được khoanh phấn kèm bàn tay chỉ vào, số ③.
- **Câu nhắc lúc đếm ngược:** "Ô ? là hình gì?"
- **Câu nhắc theo mức:**
  - Khó: "Khối viền đậm cũng đủ mọi hình!"
  - Siêu khó: "Chốt ô bên cạnh trước!"

## Câu đố & đáp án

Code: `packages/shared/src/games/latin-cell/latin-cell.ts`. Mọi kiểu dưới đây export từ `@brain-rizz/shared`.

- `Puzzle` (`LatinCellPuzzle`):
  - `size: number`: cạnh lưới, cũng là số hình và số thẻ đáp án (3 / 4 / 4 / 6).
  - `block: { rows, cols } | null`: cỡ khối (Khó `2×2`, Siêu khó `2×3` = 2 hàng × 3 cột); `null` ở Mầm, Thường.
  - `cells: number[]`: `size × size` ô theo hàng (`hàng × size + cột`). Mỗi ô là mã hình `0 … size−1`, hoặc `LATIN_CELL_EMPTY` (= −1) nếu trống.
  - `target: number`: chỉ số ô ?; ô này luôn trống trong `cells`.
  - `via: { cell, shape }[]`: các ô trung gian của lời giải dự định. Mầm, Thường: rỗng. Khó: 1 ô. Siêu khó: 2 ô. Mỗi ô là ô trống cùng hàng, cột hoặc khối với ô ?, chốt được ngay từ lưới đã cho; `shape` là hình của nó. FE dùng để giải thích khi trả lời sai.
  - `answer: number`: mã hình đúng của ô ?.
- `Answer` (`LatinCellAnswer`): số nguyên, là **mã hình** của thẻ được chạm (không phải vị trí thẻ), gửi một lần mỗi câu.
  - `isAnswer`: `typeof === "number"`, số nguyên, `0 ≤ x < 6` (`LATIN_CELL_MAX_SHAPES`). Từ chối chuỗi, `NaN`, vô cực, số thực, `null`, mảng, object, boolean, `bigint`.
  - `check`: `answer === puzzle.answer`. Mã hợp lệ nhưng vượt cạnh lưới (vd. 5 ở Thường) là sai.
- Hàm phụ cho FE: `latinCellUnits(puzzle, cell)` trả hàng, cột (và khối) chứa ô; `latinCellPeers(puzzle, cell)` trả các ô cùng nhóm.
- Khai báo CR-006: `durationMs: 60_000`, `difficultyMultiplier: { 0: 1, 1: 1, 2: 1.9, 3: 3.1 }`, không khai báo `speedAllowanceMs` (xem [Cân bằng](#cân-bằng)).

### Bảng hình

Mã hình cố định; mức có `size` hình dùng các mã `0 … size−1`. Sáu hình khác nhau ở **dáng**, nhận ra được khi in đen trắng; màu chỉ là phụ.

| Mã | Hình | Dáng nhận diện | Màu gợi ý (phụ) | Dùng từ |
| --- | --- | --- | --- | --- |
| 0 | Tròn | Đĩa tròn đặc | Đỏ phấn | Mầm |
| 1 | Tam giác | Tam giác đều, đỉnh hướng lên | Vàng | Mầm |
| 2 | Vuông | Hình vuông đặc, cạnh thẳng | Xanh dương | Mầm |
| 3 | Sao | Sao 5 cánh | Cam | Thường |
| 4 | Chữ thập | Dấu cộng nét dày | Xanh lá | Siêu khó |
| 5 | Trăng | Trăng lưỡi liềm | Tím | Siêu khó |

Không dùng hình thoi (dễ lẫn với hình vuông xoay) hay lục giác (dễ lẫn với tròn khi nhỏ).

### Ví dụ

Ký hiệu: ● tròn (0), ▲ tam giác (1), ■ vuông (2), ★ sao (3), `·` ô trống.

**Thường** (4×4, không khối). Hàng của ô ? có ●; cột có ▲, ■. Gộp lại thiếu ★.

```
·  ▲  ·  ·
●  ?  ·  ·
★  ·  ·  ·
·  ■  ·  ●        đáp án: ★
```

**Khó** (4×4, khối 2×2; đây là câu dự phòng của mức). Hàng, cột, khối của ô ? cho thấy ● và ▲, nên ô ? là ■ hoặc ★. Ở hàng cuối, ★ chỉ đặt được vào ô cùng cột với ô ? (ô đầu hàng đã có ★ trong cột), nên ô đó là ★ (ô trung gian), và ô ? là ■.

```
●  ·  ?  ▲
·  ·  ·  ·
★  ·  ·  ●
·  ●  ·  ■        đáp án: ■ (qua ô hàng 4, cột 3 = ★)
```

## Cách sinh câu đố

**Bước suy luận.** Một bước là chốt một ô trống bằng một trong hai luật đơn của Sudoku: *ô chỉ còn một hình* (hàng, cột, khối của ô đã có đủ mọi hình khác), hoặc *hình chỉ còn một chỗ* (trong một hàng, cột hay khối, có hình chỉ còn đặt được vào đúng ô này). **Số bước suy luận** của câu là số ô ít nhất phải chốt *trước* ô ? để chốt được ô ?. Bộ giải `stepsToForce` trong `grid.ts` đo con số này (nó đếm cả ô ?, tức là số bước + 1).

| Mức | Số bước suy luận | Cách chốt ô ? |
| --- | --- | --- |
| Mầm | 0 | Từ **một** hàng hoặc cột |
| Thường | 0 | Phải gộp **hàng và cột** (không bên nào tự đủ) |
| Khó | 1 | Ô ? còn 2 hình; chốt 1 ô trung gian để loại một hình |
| Siêu khó | 2 | Ô ? còn 3 hình; chốt 2 ô trung gian để loại hai hình |

Bước chung: `rng = createRng(deriveSeed(roundSeed, index))`; chỉ dùng `rng.int`, `rng.pick`, `rng.shuffle` trên mảng có thứ tự cố định, toàn số nguyên. Lưới đầy đủ (lời giải) sinh bằng `randomSolution`: điền từng ô theo hàng, thử các hình theo thứ tự `rng.shuffle`, hết đường thì quay lui. Hình vuông Latin có khối hợp lệ, đổi tên hình ngẫu nhiên nên đáp án đều giữa các hình.

- **Mầm.** Chọn ô ? ngẫu nhiên; cho đủ 2 hình còn lại trên hàng **hoặc** cột của ô (50/50), đường kia để trống. Thêm 1–2 ô ngoài hàng, cột của ô ? (xem *ô cho thêm* bên dưới).
- **Thường.** Hàng và cột của ô ? mỗi bên cho tối đa 2 hình, gộp lại đủ 3 hình kia. Ba kiểu đều nhau: hàng 2 + cột 1; hàng 1 + cột 2; hàng 2 + cột 2 (trùng một hình). Thêm 2–4 ô cho thêm.
- **Ô cho thêm (Mầm, Thường).** Lấy từ các ô không cùng hàng, cột với ô ?, nên không đổi lối suy ra ô ?. Mỗi lần chọn một ô mang hình đang ít nhất trên lưới (hoà thì bốc đều). Nhờ vậy số lần mỗi hình xuất hiện gần đều: đếm hình nào thiếu nhất trên cả lưới không đoán được đáp án.
- **Khó, Siêu khó (đào lưới).** Mỗi lần thử:
  1. Chọn ô ?, `k` hình mồi khác đáp án (Khó k = 1, Siêu khó k = 2) và với mỗi hình mồi một ô trung gian: ô cùng nhóm với ô ? mang hình đó trong lời giải.
  2. Bắt đầu từ lưới đầy đủ, chỉ xoá ô ? và mọi ô cùng nhóm với ô ? mang hình mồi. Như vậy ô ? còn đúng các ứng viên {đáp án, các hình mồi}.
  3. Đào dần từng ô theo thứ tự ngẫu nhiên (ô mang hình đáp án có trọng số 9/10 ở Khó, 8/10 ở Siêu khó; giải thích ở [Đảm bảo](#đảm-bảo-khi-sinh-câu-đố)). Chỉ giữ một lần đào nếu ô ? vẫn còn đúng các ứng viên trên **và** mỗi ô trung gian vẫn chốt được ngay.
  4. Dừng ở lúc đầu tiên lưới có đủ số ô trống tối thiểu và bộ giải **không** tìm được lời giải nào trong ≤ k bước. Hai điều kiện ở bước 3 đã cho sẵn lời giải k + 1 bước (chốt các ô trung gian, ô ? còn một hình), nên câu cần **đúng** k bước suy luận. Tới số ô trống tối đa mà chưa đạt thì lần thử hỏng.
  5. Tối đa 120 lần thử (`LATIN_CELL_MAX_ATTEMPTS`), cứ 8 lần hỏng thì sinh lời giải mới. Hết lượt thì dùng **câu dự phòng** của mức (`fallback.ts`): một câu mẫu cố định, biến đổi đối xứng bằng chính `rng` (đổi tên hình, xáo dải hàng và hàng trong dải, xáo chồng cột và cột trong chồng, lật chéo khi khối vuông). Các phép này giữ nguyên hàng, cột, khối nên giữ nguyên mọi bước suy luận. Đo trên 10 000 seed: Khó trung bình 4,5 lần thử (tối đa 46), Siêu khó 6,9 lần (tối đa 59), chưa seed nào phải dùng câu dự phòng.

**Vì sao đúng một đáp án.** Hai luật đơn đều đúng với mọi cách điền kín, và lưới đã cho lấy từ một lời giải thật. Vì vậy chuỗi bước chốt ô ? chỉ có thể ra hình của lời giải: ô ? bị ép đúng một giá trị (các ô trống khác có thể còn nhiều cách điền; game chỉ hỏi ô ?). Test kiểm lại độc lập bằng vét cạn.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3×3, 3 hình, không khối · 3–4 ô đã cho | Một hàng (hoặc cột) của ô ? có đủ 2 hình kia, đường còn lại trống. 3 thẻ to |
| Thường | 4×4, 4 hình, không khối · 5–8 ô đã cho | Hàng và cột của ô ? mỗi bên chỉ có 1–2 hình; phải gộp cả hai. 4 thẻ |
| Khó | 4×4, khối 2×2 · 6–10 ô đã cho (6–10 ô trống) | Có khối viền đậm. Nhìn quanh ô ? còn 2 khả năng; phải chốt một ô cạnh nó trước. 4 thẻ |
| Siêu khó | 6×6, khối 2×3 · 16–24 ô đã cho (12–20 ô trống) | Lưới lớn, 6 hình. Quanh ô ? còn 3 khả năng; phải chốt hai ô cạnh nó trước. 6 thẻ |

Chỉ số đo trên bộ sinh thật, 10 000 seed mỗi mức (test kiểm lại các dòng có dấu *):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Số thẻ đáp án (= số hình) * | 3 | 4 | 4 | 6 |
| Số bước suy luận (ô phải chốt trước ô ?) * | 0 | 0 | 1 | 2 |
| Ứng viên của ô ? khi chỉ nhìn hàng, cột, khối * | 1 | 1 | 2 | 3 |
| Số nhóm phải gộp để chốt thẳng ô ? (4 = không chốt thẳng được) * | 1 | 2 | 4 | 4 |
| Ô trống cùng nhóm với ô ? (trung bình) | 2,0 | 2,7 | 4,3 | 7,6 |
| Ô trung gian chốt bằng "ô chỉ còn một hình" (phần còn lại: "hình chỉ còn một chỗ") | — | — | 55 % | 43 % |

## Đảm bảo khi sinh câu đố

- Luôn có **đúng một** đáp án: vét cạn mọi cách điền kín lưới (quay lui), ô ? chỉ nhận được đúng `answer`; `check` chỉ nhận `answer`. Vét cạn cũng chứng minh lưới đã cho khớp một hình vuông Latin (có khối) hợp lệ. Không nhóm nào có hai ô cùng hình; ô ? luôn trống.
- **Số bước suy luận đúng mức, không dễ hơn mức:** đo bằng `stepsToForce` và đo lại bằng một bộ giải độc lập viết riêng trong test (tự dựng nhóm, tự tính ứng viên). Mầm, Thường chốt ngay; Khó, Siêu khó không chốt ngay được; Siêu khó không có lối tắt 2 bước (điền bất kỳ một ô chốt được nào cũng chưa chốt được ô ?).
- Ô trung gian: đúng số lượng của mức, khác nhau, khác hình nhau, cùng nhóm với ô ?, đang trống, chốt được ngay; ứng viên của ô ? đúng bằng {đáp án, hình các ô trung gian}; điền hết các ô trung gian thì ô ? chốt được.
- Mầm: một đường của ô ? đủ hình, đường kia trống hẳn. Thường: không đường nào tự đủ. Khó, Siêu khó: số ô trống trong khoảng của mức.
- Câu dự phòng (1 000 phép đối xứng mỗi mức) đúng mọi điều trên và cho ra hơn 300 câu khác nhau.
- **Không đoán được bằng cách đếm hình.** Đoán "hình ít nhất" hoặc "hình nhiều nhất trên lưới" (hoà thì bốc đều):

  | | Mầm | Thường | Khó | Siêu khó |
  | --- | --- | --- | --- | --- |
  | Bốc bừa một thẻ | 33 % | 25 % | 25 % | 17 % |
  | Nhìn quanh ô ? rồi bốc một ứng viên | 100 % | 100 % | 50 % | 33 % |
  | Đếm cả lưới, chọn hình ít nhất / nhiều nhất | 33 % / 34 % | 27 % / 24 % | 44 % / 3 % | 28 % / 4 % |
  | Đếm, chỉ trong các ứng viên: ít nhất / nhiều nhất | — | — | 50 % / 50 % | 33 % / 34 % |

  Ở Mầm, Thường đếm hình chỉ ngang bốc bừa. Ở Khó, Siêu khó đếm hình không bao giờ hơn người nhìn quanh ô ? rồi bốc bừa, và giữa các ứng viên thật thì không giúp gì. Lý do có trọng số đào: ô ? chỉ hết bị chốt ngay khi đào bớt hình đáp án quanh nó, nên đào đều tay thì hình đáp án thường ít nhất trong các ứng viên (Siêu khó: 41 % thay vì 33 %); trọng số 9/10 và 8/10 bù lại. Test kiểm: giữa các ứng viên lệch < 4 điểm % so với bốc bừa; đếm cả lưới thấp hơn mức "nhìn quanh rồi bốc".
- Phân bố đều: đáp án đều giữa các hình (± 2 điểm %); ô nào cũng có lúc là ô ? (mỗi ô > 60 % mức trung bình).
- Tất định (sinh lại so nguyên văn, không phụ thuộc thứ tự sinh); không gọi `Math.random` hay `Date.now`.

Đã kiểm trong `latin-cell.test.ts`: 10 000 seed × 4 mức (seed 0 … 9 999, index = seed mod 40), **0 lỗi**. Cả file chạy khoảng 5–8 giây, phần lớn là 10 000 câu Siêu khó (sinh ~2,5 s).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức, đã quen luật. Thời gian = nhìn quanh ô ?, gộp các hình đã thấy, (Khó trở lên) tìm và chốt ô trung gian, rồi tìm thẻ trong hàng thẻ.

| Mức | Thời gian giải mỗi câu | Tỉ lệ sai | Số câu mỗi vòng 60 s (trả lời · đúng) |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 2,6–3,8 s (người lớn 1,3–1,9 s) | 10 % (người lớn 3 %) | trẻ ~16 · 14,5 (người lớn ~30 · 29,6) |
| Thường | 2,75–3,75 s | 8 % | ~16 · 14,7 |
| Khó | 4,0–5,5 s | 12 % | ~11 · 9,7 |
| Siêu khó | 5,5–7,5 s | 15 % | ~8,1 · 6,9 |

Đây là ước lượng trước khi chơi thử. Khoảng thời gian của người lớn không chồng nhau (Mầm ≤ 1,9 s < Thường 2,75–3,75 s < Khó 4,0–5,5 s ≤ Siêu khó, chỉ chạm nhau ở 5,5 s). Thường ~3,25 s nằm trong mục tiêu 2–4 s của GDD và gần ước 3,5 s của kế hoạch. Siêu khó còn ~8 câu trả lời mỗi vòng (GDD: ≥ 8), sát ngưỡng; xem núm chỉnh 1.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `latinCell`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 1,04 → min(1,04; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **1,9** | không khai báo | Mô phỏng cần 1,92, làm tròn tới 0,05 |
| Siêu khó | **3,1** | không khai báo | Mô phỏng cần 3,10, làm tròn tới 0,05 |

- `speedAllowanceMs`: không cần. Lưới hiện đủ ngay, chạm được từ khung hình đầu; không có pha trình chiếu. Thời gian suy luận dài hơn của Khó, Siêu khó được bù bằng hệ số (như Phấn trượt).
- Cách mô phỏng: 200 000 vòng 60 s mỗi người chơi, thời gian đều trong khoảng ở bảng trên, câu sai tốn thời gian như câu đúng rồi khoá 1,5 s, giữa hai câu 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau, câu chưa xong khi hết giờ không tính, công thức `pointsForCorrect` (combo trần × 1,5). Điểm vòng = m × A_d + B_d với A_d = Σ 100 × combo, B_d = Σ thưởng × combo; m_d = (điểm người lớn ở Thường − B_d) / A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 14,5 · 1,6 | 1 817 | 631 | 1,04 | 1 | ~2 450 (97 %) |
| Người lớn · Thường | 14,7 · 1,3 | 1 876 | 645 | 1 | 1 | ~2 520 (100 %) |
| Người lớn · Khó | 9,7 · 1,3 | 1 173 | 269 | 1,92 | 1,9 | ~2 500 (99 %) |
| Người lớn · Siêu khó | 6,9 · 1,2 | 790 | 75 | 3,10 | 3,1 | ~2 530 (100 %) |
| Người lớn chọn Mầm | 29,6 · 0,9 | 4 108 | 1 930 | 0,14 | 1 | ~6 040 (240 %) |

- Trẻ 7 tuổi ở Mầm gần bằng người lớn ở Thường (97 %), vì luật Mầm (một đường đủ) rất ngắn.
- Người lớn chọn Mầm được ~240 % do trần hệ số Mầm = 1 (quy tắc chung của mẫu đặc tả); như các game khác, trông vào cờ "lệch" và nút "Nhắc" của chủ phòng.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **1 600**. Theo cách của GDD: 4 000 lượt người lớn ở Thường, 40 s của nhóm Phân tích, thời gian đều ±20 % quanh 3,25 s, sai 8 %, hiệu ứng 0,25–0,35 s, dùng chính `generate()` và `pointsForCorrect`: ~10,5 câu · 9,7 đúng, trung bình 1 610 điểm. Nhanh hơn 30 % được × 1,50, chậm hơn 40 % được × 0,65. Nếu giả định 3,0 s thì ra 1 750, 3,5 s thì 1 450. Nằm trong khoảng các game Phân tích khác (Đếm khối 1 400, Cân não 1 850). Script mô phỏng không lưu trong repo.

Núm chỉnh sau chơi thử (chỉ sửa `LATIN_CELL_LEVELS` trong `latin-cell.ts`, rồi mô phỏng lại hệ số):

1. Siêu khó < 8 câu mỗi vòng hoặc sai > 25 %: hạ trần ô trống `empty` 20 → 17 (nhiều ô đã cho hơn, ô trung gian dễ thấy hơn); nếu vẫn chậm thì `intermediates` 2 → 1 (6×6 một ô trung gian).
2. Khó quá khó: chỉ nhận ô trung gian chốt bằng "ô chỉ còn một hình" (thêm điều kiện vào `holds`).
3. Thường quá dễ: bỏ kiểu "hàng 2 + cột 2", chỉ giữ 2 kiểu gộp 2 + 1.

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `latinCell.generate(bridge.seed, index, bridge.difficulty)` rồi vẽ theo `LatinCellPuzzle`:

| Trường | Dùng để |
| --- | --- |
| `size`, `block` | Cỡ lưới; `block` khác `null` thì vẽ đường viền khối đậm (khối `rows` hàng × `cols` cột) |
| `cells[i]` | Ô thứ i (hàng `⌊i / size⌋`, cột `i mod size`): vẽ hình theo [Bảng hình](#bảng-hình), hoặc ô trống nếu `LATIN_CELL_EMPTY` |
| `target` | Ô vẽ dấu ? |
| `via` | Chỉ dùng khi trả lời sai (bên dưới); không hiện trước |
| `answer` | Chấm ngay ở client bằng `latinCell.check(puzzle, shape)` cho phản hồi tức thì; server chấm lại |

Thẻ đáp án: `size` thẻ theo **thứ tự mã hình cố định** 0, 1, … (thẻ thứ j là hình mã j, mọi câu như nhau, để người chơi quen chỗ). Chạm thẻ j thì gửi `bridge.submit(index, j)`. Đáp án đều giữa các mã nên vị trí thẻ không lộ gì. Không có chữ trong màn chơi; `locales.ts` chỉ chứa phần hướng dẫn và tên game.

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Dải trên | y 0–225 | Để trống cho HUD và huy hiệu khoá của khung; không đặt lưới hay thẻ ở đây |
| Lưới | tâm x = 360, y ≈ 260–880 | Mầm 3×3 ô 180 px (lưới 540 px); Thường, Khó 4×4 ô 150 px (600 px); Siêu khó 6×6 ô 100 px (600 px). Hình trong ô ~60 % cạnh ô |
| Hàng thẻ | y ≈ 960–1200, lề trái phải 24 px | Mầm 3 thẻ ~200 px; Thường, Khó 4 thẻ ~150 px; Siêu khó 6 thẻ một hàng ~102 × 140 px (khe 12 px). Mọi vùng chạm ≥ 48 px |

- Nét lưới: đường ô mảnh (phấn 2 px, mờ), đường khối đậm (phấn 6 px). Ở Siêu khó khối 2 hàng × 3 cột: đường đậm dọc giữa cột 3 và 4, đường đậm ngang sau hàng 2 và hàng 4.
- Ô ?: dấu ? viết phấn, viền `primary` nhấp nháy nhẹ. Đề xuất tô rất nhạt (~8 %) hàng, cột (và khối) của ô ? ở mọi mức để dễ nhìn trên điện thoại; ui-designer chốt khi vẽ bản mẫu (xem Câu hỏi mở 3).
- Hình vẽ bằng Phaser Graphics theo phong cách phấn; không cần asset ngoài. Hình phân biệt bằng dáng; màu chỉ phụ (đủ tương phản trên nền bảng cả sáng lẫn tối).
- Các trạng thái: đang hiện câu (chạm được ngay) → đúng → sang câu kế; hoặc sai → khoá → sang câu kế.

### Phản hồi đúng

Hình đúng hiện vào ô ? (nét phấn vẽ nhanh ~150 ms), thẻ được chạm nảy nhẹ, âm "đúng". Sau ~250 ms sang câu `index + 1`.

### Hiện đáp án đúng khi sai

1. Chạm thẻ khi chưa khoá: chấm bằng `latinCell.check`, gửi `bridge.submit(index, j)`.
2. Nếu sai: gọi `bridge.unlockDelay(index)` và giữ trạng thái "Sai, khoá" đúng số ms trả về (không tự đếm 1,5 s). Promise có thể về sau khi hết vòng: kiểm `this.sys.isActive()` trước khi dùng.
3. Trong lúc khoá:
   - **Dấu hiệu chính:** ô ? hiện hình `answer` (nét `primary`, viền `sticker`), và thẻ `answer` được khoanh phấn, giữ sáng 100 %.
   - Thẻ người chơi đã chạm rung ngang + dấu ✗ màu `destructive`.
   - Khó, Siêu khó: mỗi ô trong `via` hiện hình `shape` của nó mờ 60 % với viền nét đứt, kèm số thứ tự ①, ② ở góc ô, để người chơi thấy "chốt ô này trước". Mầm, Thường: tô nhạt hàng và cột của ô ? (chỗ có các hình đã loại).
   - Phần còn lại mờ còn 35 %; chạm trong lúc khoá bị bỏ qua.
4. Hết khoá: hiện ngay câu `index + 1`.

- Lưới (y ≥ 260) và hàng thẻ nằm ngoài dải huy hiệu khoá (tới y ≈ 225), nên dấu hiệu chính luôn thấy được.
- Khi bật giảm chuyển động: bỏ rung, nhấp nháy và nét vẽ chạy; giữ vòng khoanh, dấu ✗, hình mờ và độ mờ.

### Âm thanh

Dùng bộ âm chung: chạm thẻ, đúng, sai. Không cần âm riêng; chơi được khi tắt tiếng.

### Chỉnh scene theo bản mẫu

Toạ độ trên khung 720×1280; bản đầy đủ do ui-designer bàn giao cùng bản mẫu hàng M24.

- **Câu hỏi mở 3 đã chốt:** có tô phấn hàng, cột (và khối) của ô ? ở mọi mức: 10 % khi chơi, 18 % khi hiện lời giải (`UNIT_TINT_PLAY` 0,08 → 0,10, `UNIT_TINT_MISS` 0,16 → 0,18).
- `drawGrid`: bỏ lớp `--board-shade` dưới lưới (trên nền khung `bg-muted` kem, nét phấn chỉ còn ~1,9:1). Thay bằng khung gỗ x 22–698, y 227–903, bo 30, gỗ #a8693b (tối #6b4528), viền `--sticker` 5, bóng 8; mặt bảng inset 14 (x 36–684, y 241–889, bo 18) màu `--board`, viền mực 3, viền nhóm `--color-analyze` 6 px. Dùng chung art khung với Phấn trượt (tách sang `games/_shared`). Lưới giữ tâm y 565, cạnh 600 (Mầm 540).
- `circleCard`: vòng phấn trắng không thấy trên nền kem → vòng `--primary` 8 px cách thẻ 4 px, nét mực 18 px bên dưới, kèm huy hiệu ✓ (tròn vàng r 20 viền mực) ở (w/2 − 10, −h/2 + 10), như `ringArt` + `tickArt` của Nối mạch.
- Làm mờ thẻ khi sai: thay `card.root.setAlpha(0.35)` (lộ bóng qua mặt thẻ) bằng lớp phủ màu `--muted` 65 % như `CircuitLinkScene.dim`.
- Số phím trên thẻ (máy tính): alpha 0,55 → 0,8, cỡ 18 → 20 cho đủ 4,5:1.
- Giữ nguyên: ô ? viền `--primary` nhấp nháy + dấu ? phấn; khung đáp án vàng nền 22 % viền mực khi sai; ô trung gian viền phấn đứt + hình 60 % + huy hiệu ①②; thẻ đúng nảy 1,1; màu 6 hình (`SHAPE_PAINTS` + viền mực) đọc rõ trên cả hai bảng.
- `LatinCellHowTo.tsx`: hình vuông đặt trong khung 14:9 theo kiểu **lưới trái + cột thẻ phải**. `viewBox` đổi thành `"4 4 552 352"`. Lưới 4×4 ô 68 ở x 40–312, y 44–316; ô ? = ô 5 (viền vàng inset 6, bo 8, nét 3,5; dấu ? cỡ 40); huy hiệu r 10 ở tâm ô + (23, −23) của ô 4 (①), ô 1 và ô 13 (②).
- `LatinCellHowTo.tsx` thẻ: 2 × 2 thẻ 84 × 78 (bo 12, viền 3, bóng 5), tâm x 392 / 492, y 115 / 211, thứ tự ● ▲ / ■ ★, hình r 22. Thẻ ★ có vòng phấn (x 443, y 165, 98 × 97, bo 18), đầu ngón tay `HAND_PATH` ở (500, 278) scale 2, huy hiệu ③ r 11 ở (538, 166).
- Câu ví dụ trong bản mẫu: Thường, Khó như mục [Ví dụ](#ví-dụ); Siêu khó là câu dự phòng trong `fallback.ts`; Mầm (chưa có ví dụ) dùng câu tự dựng `· · ▲ / ■ ? ● / · · ■`, đáp ▲.

## Ghi chú cho BE

Không. Đáp án là một số nguyên (mã hình), server sinh lại câu bằng `generate()` và chấm bằng `check()`. Không có miễn trừ thời gian hay hạn trả lời.

## Câu hỏi mở

1. **"Suy 2 bước" của Siêu khó** — đặc tả này hiểu là *hai ô trung gian độc lập*, mỗi ô chốt được ngay từ lưới, cả hai cùng nằm quanh ô ? (ô ? còn 3 khả năng). Không làm kiểu *chuỗi* (chốt ô A mới chốt được ô B, rồi mới tới ô ?), vì chuỗi phải tìm ô xa ô ?, ước 9–12 s mỗi câu, Siêu khó sẽ còn dưới 8 câu mỗi vòng. Cần chủ dự án xác nhận.
2. **Ô trung gian dùng cả hai luật đơn** ("ô chỉ còn một hình" 43–55 %, còn lại "hình chỉ còn một chỗ"). Nếu chơi thử thấy loại sau khó thấy ở Khó, dùng núm chỉnh 2.
3. **Tô nhạt hàng, cột, khối của ô ? trong lúc chơi**: giúp nhìn nhanh trên điện thoại, không giải hộ (ô trung gian vẫn phải tự chốt). Đề xuất có tô ở mọi mức; ui-designer chốt.
4. Người lớn chọn Mầm được ~240 % điểm Thường (trần Mầm = 1 theo quy tắc chung). Giữ như các game khác, xem lại sau chơi thử.
