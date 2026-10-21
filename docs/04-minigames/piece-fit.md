# Mảnh vừa khít (`piece-fit`)

- Nhóm: Hình dung (`visualize`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- Nguồn: [CR-013](../00-tracking/change-requests.md#cr-013), [kế hoạch mở rộng minigame](../01-product/minigame-expansion.md) mục 3.5. Chỉ mượn cơ chế cổ điển "lắp polyomino vào chỗ trống"; tên, hình và chữ là của Brain Rizz (kế hoạch mục 2).
- File:
  - `packages/shared/src/games/piece-fit/`: `piece-fit.ts` (bộ sinh, kiểu `PieceFitPuzzle` / `PieceFitAnswer`, hằng `PIECE_FIT_*`), `piece-fit.test.ts`. Hàm hình học (chuẩn hoá, xoay, lật, liền khối, khung bao) dùng lại của Xoay hình (`rotate-match/shapes.ts`), chỉ import, không sửa.
  - `apps/web/src/games/piece-fit/` (scene + `locales.ts`): frontend-dev làm.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M29** (PieceFitMobile, PieceFitLevels, PieceFitStates, PieceFitHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.
- Thẻ game: **vi** "Mảnh vừa khít" · "Chọn mảnh lấp vừa khoảng trống". **en** "Perfect Fit" · "Pick the piece that fills the gap".

## Cách chơi

Hộp lưới đã xếp kín, chỉ còn một khoảng trống. Chạm vào mảnh lấp vừa khít khoảng trống đó: mảnh được **xoay**, nhưng **không được lật**.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn khoảng trống trong hộp
  2. Chạm mảnh lấp vừa khít
  3. Được xoay, không được lật
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ:** hộp 5 × 5 tô kín, khoảng trống hình chữ L 4 ô (`#.` / `#.` / `##`) viền phấn gạch đứt ở góc phải dưới. Dưới hộp là hai thẻ: trái là chữ L đã xoay 90° (`###` / `#..`), khoanh phấn tròn + ✓, một mũi tên phấn cong ↻ đi từ thẻ này vào khoảng trống; phải là bản lật gương (chữ J) xoay 90° (`#..` / `###`), gạch chéo ✗ kèm icon gương nhỏ (đường gạch đứt giữa hai mũi tên ngược chiều).
- **Câu nhắc lúc đếm ngược:** "Xoay được, lật thì sai!"
- **Câu nhắc theo mức:**
  - Mầm: "Mảnh đúng nằm sẵn đúng hướng"
  - Khó: "Coi chừng mảnh bị lật gương!"
  - Siêu khó: "Mảnh nào cũng đủ số ô!"

## Câu đố & đáp án

- `Puzzle` (`PieceFitPuzzle`): `{ box: { cols, rows }; gap: Cell[]; options: Piece[]; answerIndex: number; answerTurns: number }`
  - `box`: hộp vuông 4 / 5 / 5 / 6 ô theo mức.
  - `gap`: các ô trống, toạ độ tuyệt đối trong hộp, sắp theo (y, x). Mọi ô khác của hộp là ô đã xếp kín.
  - `options`: 3 thẻ (Mầm) hoặc 4; mỗi thẻ `{ cells, kind }`, `cells` là mảnh đúng như vẽ (đã chuẩn hoá, không xoay thêm).
  - `answerIndex`: vị trí thẻ đúng. `answerTurns`: số lần xoay 90° theo chiều kim đồng hồ đưa thẻ đúng về hướng khoảng trống (FE dùng cho hiệu ứng lắp vào).
- `Answer` (`PieceFitAnswer`): chỉ số thẻ được chạm, số nguyên 0–3. `check` đúng khi và chỉ khi bằng `answerIndex`. Biểu thức đáp án cho test server: `GAMES["piece-fit"].generate(s, i, d).answerIndex`.

## Cách sinh câu đố

### Kho mảnh (tính một lần, không ngẫu nhiên)

1. Liệt kê mọi polyomino cố định n ô bằng cách nở từng ô một từ hình 1 ô.
2. Gộp thành mảnh **một mặt**: hai hình cùng mảnh khi một phép xoay 90° (0–3 lần) đưa hình này về hình kia; **không gộp lật**. Đại diện là phép xoay có khoá chuỗi nhỏ nhất. Có 2 mảnh 3 ô, 7 mảnh 4 ô, 18 mảnh 5 ô, 60 mảnh 6 ô.
3. Mảnh **có tay thuận** khi bản lật gương của nó không trùng phép xoay nào (vd. L và J là hai mảnh khác nhau; T, I, U, X đối xứng gương).
4. Kho khoảng trống của từng mức (khung bao mọi mảnh trong mức ≤ `PIECE_FIT_MAX_PIECE_SIDE[d]` = 3 / 4 / 4 / 4):

| Mức | Lọc | Số mảnh |
| --- | --- | --- |
| Mầm | 3 ô; có ít nhất một mảnh "thừa một ô" khung ≤ 3 | 2 (thẳng, góc) |
| Thường | 4 ô; bỏ mảnh xoay 90° vẫn y hệt (hình vuông 2 × 2) | 6 (I, T, S, Z, L, J) |
| Khó | 5 ô; chỉ mảnh có tay thuận | 12 (F, L, N, P, Y, Z, mỗi hình cả hai tay) |
| Siêu khó | 5 ô như Khó nhưng mảnh lệch 1 ô cũng phải có tay thuận; cộng 6 ô có tay thuận, có mảnh lệch 1 ô có tay thuận | 12 mảnh 5 ô + 42 mảnh 6 ô |

Kho sắp theo khoá (so sánh chuỗi thường, không `localeCompare`) và tính lười ở lần `generate` đầu tiên của mỗi mức, nên mọi máy có cùng thứ tự.

### Một câu đố

Mọi thứ ngẫu nhiên đi qua `createRng(deriveSeed(roundSeed, index))`, không có vòng thử lại.

1. **Khoảng trống:** Siêu khó bốc 5 hoặc 6 ô (mỗi loại 1/2). Bốc một mảnh trong kho, xoay ngẫu nhiên 0–3 lần, đặt vào vị trí ngẫu nhiên sao cho lọt hộp.
2. **Thẻ đúng:** khoảng trống xoay ngược `answerTurns` lần. `answerTurns` bốc trong `PIECE_FIT_ANSWER_TURNS[d]` = Mầm {0} · Thường {1, 2} · Khó, Siêu khó {1, 2, 3}; từ Thường bỏ giá trị làm thẻ trông y hệt khoảng trống (I, S, Z đối xứng xoay 180° nên ở Thường chỉ còn 90°).
3. **Thẻ nhiễu** (`kind`):
   - Mầm: mảnh 3 ô còn lại, hướng bất kỳ (`other`); khoảng trống **thêm một ô**, giữ đúng hướng khoảng trống (`size`, 4 ô).
   - Thường: 3 mảnh 4 ô khác, hướng bất kỳ (`other`). Không lấy bản lật gương của khoảng trống, không lấy hai mảnh là gương của nhau.
   - Khó: luôn **hai cặp gương**. Cặp một là đáp án và bản lật gương của khoảng trống (`mirror`). Cặp hai là W và bản lật gương của W (cả hai `other`), với W là một pentomino có tay thuận **khác chữ** với khoảng trống (bốc đều trong 5 chữ còn lại, tay ngẫu nhiên), bốc độc lập với cách xếp ô của khoảng trống. Hướng bất kỳ, cả 4 thẻ cùng 5 ô.
   - Siêu khó: bản lật gương (`mirror`), mảnh **lệch 1 ô** có tay thuận (`near`: bỏ một ô mà phần còn lại vẫn liền, đặt nó vào một ô kề khác; khác loại cả khi tính lật), **bản lật gương của mảnh lệch** (`other`). Cũng là hai cặp gương; cả 4 thẻ cùng số ô.
   - Ghi chú: 6 pentomino có tay thuận đôi một trùng nhau 4/5 ô ở một cách đặt nào đó, và mỗi chữ đều "lệch 1 ô" được sang mọi chữ khác. Vì vậy W ở Khó không thể "khác hẳn" theo nghĩa hình học; khác biệt với Siêu khó là W bốc theo chữ chứ không dựng từ khoảng trống, và Siêu khó có thêm nửa số câu 6 ô, hộp 6 × 6.
4. Xáo vị trí 3–4 thẻ.

### Vì sao chắc chắn đúng một đáp án

- Thẻ đúng là chính khoảng trống đã xoay, nên luôn khớp.
- Mọi thẻ nhiễu thuộc mảnh một mặt khác khoảng trống, nên xoay thế nào cũng không khớp: `other` ở Mầm, Thường là mảnh khác; `size` khác số ô; `near` khác loại cả khi tính lật; `mirror` khác vì kho Khó, Siêu khó **chỉ có mảnh có tay thuận** (hình đối xứng gương bị loại khỏi kho, nên không bao giờ xảy ra "bản lật gương trùng chính nó"); W và gương của W ở Khó khác chữ với khoảng trống; `other` ở Siêu khó là gương của mảnh lệch, khác loại với khoảng trống.
- Các thẻ nhiễu đôi một khác mảnh một mặt.
- Test kiểm lại bằng hàm hình học viết riêng: chỉ đúng một thẻ cùng dạng chuẩn xoay và cùng số ô với khoảng trống, và đó là `answerIndex`.

### Vì sao không lộ đáp án

- **Vị trí:** mỗi ô thẻ là đáp án 1/n ± 2 % (test 10 000 seed).
- **Tư thế vẽ:** khoảng trống xoay ngẫu nhiên, thẻ nhiễu cũng vậy, nên ở tư thế nào tỉ lệ thẻ là đáp án cũng như nhau (test: chênh < 3 %).
- **Đếm ô:** đáp án không bao giờ là thẻ duy nhất có đúng số ô của khoảng trống: Mầm 2 thẻ, từ Thường cả 4.
- **Tìm cặp gương:** ở mỗi câu, hoặc không thẻ nào thuộc một cặp gương (Mầm, Thường), hoặc cả 4 thẻ đều thuộc (Khó, Siêu khó: hai cặp đối xứng nhau). Tìm cặp gương vì thế không loại được thẻ nào. Test 10 000 seed kiểm điều này ở từng câu, và thống kê thẻ "thuộc một cặp gương" là đáp án đúng 1/n ± 2 %.
- `kind` chỉ để FE chọn phản hồi sau khi chạm, không được hiện trước.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Hộp 4 × 4 · khoảng trống 3 ô · đáp án không xoay · 3 thẻ: đáp án, mảnh 3 ô kia, khoảng trống thêm một ô | Khoảng trống thẳng hoặc góc; tìm thẻ y hệt, đừng lấy thẻ dư một ô |
| Thường | Hộp 5 × 5 · 4 ô (tetromino) · đáp án xoay 90° hoặc 180° (chiều kim đồng hồ) · 4 thẻ, không có bản lật gương | Bốn mảnh kiểu "xếp gạch", phải xoay trong đầu |
| Khó | Hộp 5 × 5 · 5 ô (pentomino có tay thuận) · xoay 90°, 180° hoặc 270° · nhiễu: bản lật gương + một cặp gương pentomino khác chữ | Hai cặp mảnh, mỗi cặp là gương của nhau; chỉ một mảnh xoay mà khớp |
| Siêu khó | Hộp 6 × 6 · 5–6 ô · xoay 90°/180°/270° · cả 4 thẻ cùng số ô · nhiễu: bản lật gương, lệch 1 ô, gương của mảnh lệch | Bốn mảnh cùng cỡ, hai cặp gương, phải so từng ô |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng theo dạng chuẩn xoay (4 góc xoay + tịnh tiến); `check` nhận đúng `answerIndex`, từ chối mọi chỉ số khác (kể cả 3 ở Mầm).
- Khoảng trống liền khối (4-kề), nằm trong hộp, sắp theo (y, x), số ô 3 / 4 / 5 / 5–6.
- Mọi mảnh trên thẻ liền khối, đã chuẩn hoá, khung bao ≤ 3 / 4 / 4 / 4; chỉ số nguyên.
- Thẻ nhiễu không trùng dạng chuẩn với nhau.
- Góc xoay theo mức: Mầm 0; Thường 1 hoặc 2 lượt; Khó, Siêu khó 1–3 lượt; từ Thường thẻ đúng không bao giờ trông y hệt khoảng trống. `answerTurns` khớp thật (xoay thẻ đúng `answerTurns` lần ra đúng khoảng trống).
- Khó, Siêu khó: khoảng trống có tay thuận; thẻ `mirror` đúng là bản lật gương; cả 4 thẻ cùng số ô; đúng hai cặp gương. Khó: hai thẻ `other` là gương của nhau, có tay thuận, khác loại với khoảng trống. Siêu khó: thẻ `near` cùng số ô, liền, trùng n − 1 ô với khoảng trống sau một phép xoay, khác loại cả khi tính lật, có tay thuận; `other` là gương của `near`.
- Mầm: thẻ `size` chứa nguyên khoảng trống đúng hướng cộng một ô.
- Không lộ đáp án qua vị trí, tư thế vẽ, số ô hay cặp gương (mục trên).
- Độ khó tăng đo được: số ô trung bình 3 → 4 → 5 → 5,5; số thẻ 3 → 4; tỉ lệ phải xoay 0 → 100 %; có bẫy gương 0 → 0 → 100 → 100 %; số cặp gương 0 → 0 → 2 → 2; có mảnh lệch 1 ô dựng từ khoảng trống 0 → 0 → 0 → 100 %; mọi thẻ cùng số ô 0 → 100 %.
- Tất định: cùng `(seed, index, difficulty)` → cùng câu, kể cả khi nạp lại module hay sinh các mức theo thứ tự khác; sửa câu đã trả về không ảnh hưởng câu sau; mã băm đầu ra cố định (đổi `rotate-match/shapes.ts` mà làm đổi câu đố thì test này báo).

Các điều trên được kiểm bằng test 10 000 seed × 4 độ khó trong `piece-fit.test.ts`.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức. Mô hình thời gian một câu, gọi chính `generate()`: nhìn khoảng trống + chạm 0,3 s + so lần lượt từng thẻ theo thứ tự trên màn hình, dừng ở thẻ đúng (thẻ đúng nằm cuối thì tự suy ra, tốn 0,3 lần so). Thời gian so một thẻ `c` đều trong khoảng dưới; loại nhanh thẻ hình vuông 2 × 2 ở Thường (0,3 s); mảnh 6 ô so lâu hơn 15 %.

| Người chơi · mức | Nhìn | `c` mỗi thẻ | Thời gian giải mỗi câu (trung bình theo `c` thấp → cao) | Sai | Câu mỗi vòng 60 s (đúng · sai) |
| --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 0,8 s (chạm 0,5 s) | 0,7–1,1 s | 2,5–3,2 s (TB 2,9) | 10 % | 17,8 (16,0 · 1,8) |
| Người lớn · Mầm | 0,4 s | 0,3–0,5 s | 1,2–1,6 s (TB 1,4) | 3 % | 34,1 (33,1 · 1,0) |
| Thường | 0,5 s | 0,75–1,15 s | 2,4–3,2 s (TB 2,8) | 8 % | 18,5 (17,0 · 1,5) |
| Khó | 0,6 s | 1,2–1,7 s | 3,7–4,8 s (TB 4,2) | 12 % | 12,4 (10,9 · 1,5) |
| Siêu khó | 0,7 s | 1,6–2,2 s | 5,0–6,4 s (TB 5,7) | 16 % | 9,3 (7,8 · 1,5) |

Các mức của người lớn không chồng nhau (Thường ≤ 3,2 s < Khó ≥ 3,7 s; Khó ≤ 4,8 s < Siêu khó ≥ 5,0 s; Siêu khó giả định câu 5 ô cũng chậm hơn Khó, xem Câu hỏi mở). Siêu khó còn 9,3 câu mỗi vòng (≥ 8). Thường khoảng 2,8 s mỗi câu, khớp kế hoạch (~3 s, ~17 câu). Từng câu dao động rộng hơn bảng (vd. Thường 1,7–3,8 s ở phân vị 10–90) vì thẻ đúng có khi nằm đầu, có khi nằm cuối.

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong `pieceFit`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 1,13 → min(1,13; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **2** | không khai báo | Mô phỏng cần 2,02, làm tròn tới 0,05 |
| Siêu khó | **3,2** | không khai báo | Mô phỏng cần 3,20 |

- `speedAllowanceMs`: không cần. Hộp và thẻ hiện cùng lúc, chạm được ngay, một chạm là xong. `answerWindowMs`: không khai báo (không có vật biến mất).
- Cách mô phỏng (20 000 vòng 60 s mỗi mức): thời gian và tỉ lệ sai như bảng trên; câu đúng thêm 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau; câu sai khoá 1,5 s, đồng hồ câu sau tính từ lúc hết khoá; câu chưa xong khi hết giờ không tính. Điểm theo `pointsForCorrect` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, giải m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 16,0 · 1,8 | 2 022 | 755 | 1,13 | 1 | ~2 780 (92 %) |
| Người lớn · Thường | 17,0 · 1,5 | 2 193 | 835 | 1 | 1 | ~3 030 (100 %) |
| Người lớn · Khó | 10,9 · 1,5 | 1 321 | 357 | 2,02 | 2 | ~3 000 (99 %) |
| Người lớn · Siêu khó | 7,8 · 1,5 | 901 | 151 | 3,20 | 3,2 | ~3 030 (100 %) |
| Người lớn chọn Mầm | 33,1 · 1,0 | 4 613 | 2 224 | 0,18 | 1 | ~6 840 (226 %) |

- Người lớn chọn Mầm được khoảng 226 % điểm Thường: Mầm chỉ là tìm thẻ y hệt khoảng trống 3 ô. Hệ số Mầm đã ở trần 1; phần còn lại do chủ phòng giám sát (CR-006). Script mô phỏng không lưu trong repo.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): đề xuất **1 900**. Theo cách của [GDD](../01-product/game-design.md#kiểm-tra-não): 4 000 lượt người lớn ở Thường, 40 s của nhóm Hình dung, thời gian mỗi câu đều ±20 % quanh 2,8 s, sai 8 %, hiệu ứng 0,25–0,35 s giữa hai câu, câu sai khoá 1,5 s, câu dở khi hết giờ không tính: 12,1 câu · 11,1 đúng, trung bình 1 917 điểm (20 000 lượt: 1 920), làm tròn tới 50. Người nhanh hơn 30 %: × 1,48; chậm hơn 40 %: × 0,67. Kiểm chứng: cách mô phỏng này cho Phấn trượt 4 921 và Xoay hình 1 890, khớp bảng GDD (4 900, 1 900); cùng giả định ở 60 s ra 3 040, khớp mô hình quét thẻ ở trên (3 030). Ngang Xoay hình (1 900) vì thời gian mỗi câu gần như nhau.

Núm chỉnh sau chơi thử (sửa trong `piece-fit.ts`, rồi tính lại hệ số và điểm chuẩn; đổi bộ sinh thì cập nhật mã băm trong test):

1. Thường quá dễ (dưới 2 s, vì 4 mảnh tetromino khác hẳn nhau): thêm bản lật gương của khoảng trống làm thẻ nhiễu (khoảng trống chỉ lấy L, J, S, Z).
2. Siêu khó đúng < 75 %: chỉ dùng 5 ô (bỏ 6 ô).
3. Mầm khó với trẻ: bỏ thẻ "thừa một ô", thay bằng mảnh 4 ô khác hẳn.
4. Khó và Siêu khó quá gần nhau (dễ xảy ra, xem Câu hỏi mở): Siêu khó chỉ dùng 6 ô.

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `pieceFit.generate(seed, index, difficulty)` từ `@brain-rizz/shared` rồi gửi chỉ số thẻ được chạm. Kiểu và hằng export từ `@brain-rizz/shared`, có comment từng trường trong `piece-fit.ts`.

| Trường / hằng | Ý nghĩa |
| --- | --- |
| `box.cols`, `box.rows` | Cạnh hộp (ô), luôn bằng nhau: `PIECE_FIT_BOX_SIZE[d]` = 4 / 5 / 5 / 6. |
| `gap` | Các ô trống `[x, y]` trong hộp, x sang phải, y xuống dưới. Mọi ô khác của hộp là ô đã xếp. |
| `options[i].cells` | Mảnh trên thẻ, vẽ y nguyên (không xoay, không lật ở FE). Đã chuẩn hoá về góc trên trái. |
| `options[i].kind` | `fit` / `mirror` / `near` / `size` / `other`. **Chỉ dùng sau khi chạm** để chọn phản hồi. |
| `answerIndex` | Vị trí thẻ đúng. |
| `answerTurns` | Số lần xoay 90° chiều kim đồng hồ đưa thẻ đúng về hướng khoảng trống (0–3; 3 = quay ngược 90°). |
| `PIECE_FIT_MAX_PIECE_SIDE[d]` | Khung bao lớn nhất của mọi mảnh ở mức d: 3 / 4 / 4 / 4. Dùng để chọn cỡ ô. |

- Kiểm cục bộ bằng `pieceFit.check(puzzle, i)` để phản hồi ngay (server chấm lại bằng chính hàm này).

### Bố cục (khung 720×1280)

| Thành phần | x, y | Rộng × cao | Ghi chú |
| --- | --- | --- | --- |
| Hộp | căn giữa ngang, mép trên y = 96 | cạnh = cạnh hộp × u (372 / 350 / 350 / 396) | Không nhận chạm |
| Thẻ 0 · 1 | 28, 520 · 372, 520 | 320 × 320 | Hàng trên |
| Thẻ 2 · 3 | 28, 864 · 372, 864 | 320 × 320 | Hàng dưới. Mầm chỉ có thẻ 2, đặt giữa ở 200, 864 |

- Cỡ ô **chung cho hộp và thẻ** trong một mức: u = min(⌊400 / cạnh hộp⌋, ⌊280 / `PIECE_FIT_MAX_PIECE_SIDE[d]`⌋) = **93 / 70 / 70 / 66 px**. Cùng cỡ để mảnh "lắp vào" khít và trẻ so được bằng mắt; không đổi cỡ theo từng câu để cỡ không lộ đáp án.
- Cả thẻ là vùng chạm (320 px, ≫ 48 px), khe 24 px giữa các thẻ. Thứ tự `options` là thứ tự ô trên màn hình. Không đánh số hay chữ lên thẻ.

### Vẽ

- Ô đã xếp trong hộp: nền thẻ sáng, **gạch chéo phấn** (hoa văn, không chỉ màu), đường chia ô mảnh; có thể chia thành vài "gói quà" bằng nét đậm cho vui mắt, miễn là không vẽ đường nào bên trong khoảng trống.
- Khoảng trống: để màu bảng (tối), viền phấn **gạch đứt** quanh đúng chu vi khoảng trống, không vẽ đường chia ô bên trong (để không gợi ý cách xoay).
- Mảnh trên thẻ: tô màu nhóm Hình dung (`--color-visualize`), viền mực 3 px, đường chia ô 2 px (mực 40 %) để đếm được ô; đặt tâm khung bao vào tâm thẻ. Mọi mảnh trong mức cùng màu.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Hộp và thẻ hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120 ms |
| Chờ chọn | Máy tính: rê chuột thì thẻ nhấc 4 px. Điện thoại: thẻ co 0,97 lúc nhấn. Ghi nhận ở `pointerdown`, một chạm là chốt | — |
| Đúng | Thẻ được chọn viền màu thành công + ✓; bản sao mảnh bay vào khoảng trống, xoay `answerTurns` × 90° theo chiều gần nhất (3 thì quay ngược 90°), khớp vào thì hộp nảy nhẹ | ≤ 350 ms rồi sang câu mới |
| Sai, khoá | Xem mục dưới | `bridge.unlockDelay` |
| Hết giờ | Không nhận chạm nữa (PlayScreen xử lý) | — |

- Giữ hiệu ứng đúng ≤ 350 ms: server tính giờ câu sau từ lúc nhận đáp án trước.

### Hiện đáp án đúng khi sai

1. `pieceFit.check(puzzle, i)` sai thì `submit` rồi gọi `bridge.unlockDelay(index)`; hết khoá theo số ms nó trả về, không tự đếm 1,5 s. Vòng hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả.
2. Thẻ bị chạm: rung ngang ±8 px, viền gạch đứt + ✗. `kind = "mirror"` thì thêm icon gương nhỏ (đúng bẫy lật). Kind khác chỉ ✗.
3. Thẻ `options[answerIndex]`: viền liền màu thành công + ✓, rồi bản sao mảnh (mờ 60 %) bay vào khoảng trống và xoay `answerTurns` lượt như hiệu ứng đúng, nằm lại trong khoảng trống tới hết khoá.
4. Các thẻ còn lại mờ còn 35 %.
5. Huy hiệu khoá che dải giữa trên cùng (tới y ≈ 80, máy thấp tới y ≈ 225), nên hàng ô trên cùng của hộp có thể bị che trên máy thấp. Dấu ✓ trên thẻ đúng (y ≥ 520) luôn thấy được, đủ để hiểu; không cần dời bố cục.

- `prefers-reduced-motion`: không rung, không bay; tô luôn khoảng trống bằng màu mảnh (mờ 60 %) và đổi viền + huy hiệu ✓/✗.
- Không chỉ dùng màu: đúng là ✓ + viền liền, sai là ✗ + viền gạch đứt.

### Âm thanh dự kiến

- Đúng: tiếng "cạch" lúc mảnh khớp vào hộp + "ting" cao dần theo combo.
- Sai: "bụp" trầm.
- Hiện câu: không có âm.

### Ví dụ để vẽ bản mẫu (seed 2026, câu 0)

`#` là ô đã xếp / ô của mảnh, `.` là ô trống. Thẻ theo thứ tự 0, 1, 2, 3.

- **Mầm:** hộp `####` / `###.` / `###.` / `###.` (khoảng trống thẳng đứng 3 ô ở cột phải). Thẻ: `#.`/`##`/`#.` (thừa một ô) · `.#`/`##` (góc 3 ô) · `#`/`#`/`#` (**đúng**, không xoay).
- **Thường:** hộp 5 × 5, khoảng trống thẳng đứng 4 ô ở cột phải, từ hàng 2. Thẻ: `.##`/`##.` · `##`/`##` · `####` (**đúng**, xoay 90°) · `#..`/`###`.
- **Khó:** hộp 5 × 5, khoảng trống hình Y: cột 4 từ hàng 2 xuống hết, thêm một ô bên phải ở hàng 4. Thẻ: `##`/`##`/`.#` (W, chữ P) · `####`/`..#.` (lật gương) · `####`/`.#..` (**đúng**, quay ngược 90°) · `###`/`.##` (gương của W).
- **Siêu khó:** hộp 6 × 6, khoảng trống hình Y nằm ngang ở hàng 5 (cột 3–6) với một ô nhô lên ở cột 5. Thẻ: `##`/`##`/`.#` (lệch 1 ô) · `#.`/`##`/`#.`/`#.` (lật gương) · `#.`/`#.`/`##`/`#.` (**đúng**, quay ngược 90°) · `###`/`.##` (gương của mảnh lệch).

### Chỉnh scene theo bản mẫu

Bố cục, cỡ ô, thẻ, vòng đúng và huy hiệu của scene hiện tại đã khớp bản mẫu M29; chỉ chỉnh màu (`PieceFitScene.ts`):

- **Đã chốt (ui-designer, 2026-10-20):** mảnh tím ở nền tối `#bcacf6` thay `#a99ce0` (thẻ tối #2f2a52 6,6:1; bảng tối #24203f 7,7:1; bảng sáng #2d6a54 3,1:1; viền mực 9,5:1). Nền giấy sáng giữ `--color-visualize` #7768ae (4,55:1). Mọi game nhóm Hình dung dùng chung giá trị này.
- `SHAPE_DARK = "#a99ce0"` → `"#bcacf6"`.
- Đề xuất token (chưa sửa `globals.css`, chờ duyệt): `--color-visualize-on-board: #bcacf6` (hình tím đặt thẳng trên bảng, cả hai chế độ) và `--visualize-shape` = #7768ae (sáng) / #bcacf6 (tối). Khi có token: `TOKENS.shape` đọc `--visualize-shape`, bỏ `SHAPE_DARK`.
- Gạch chéo ô đã xếp ở nền tối: `HATCH_MIX` 0,22 → 0,32 khi `colorScheme === "dark"` (sáng giữ 0,22) để ô đã xếp tách rõ khỏi khoảng trống màu bảng.
- `PieceFitHowTo.tsx`, thẻ sai (`--destructive` theo chế độ), trạng thái trống/đang tải/mất kết nối (PlayScreen phủ): giữ nguyên.

## Ghi chú cho BE

Không có xử lý khác thường: không có pha trình chiếu, đáp án một bước, chấm bằng `generate()` + `check()`.

- `isAnswer` nhận số nguyên 0–3; ở Mầm (3 thẻ) gửi 3 thì `check` trả sai.
- Khai báo CR-006 trong `pieceFit`: `durationMs: 60_000`; `difficultyMultiplier: { 0: 1, 1: 1, 2: 2, 3: 3.2 }`; không có `speedAllowanceMs`, không có `answerWindowMs`.
- Kho mảnh tính lười ở lần `generate` đầu tiên của mỗi mức, một lần cho mỗi tiến trình.
- Điểm chuẩn Kiểm tra não đề xuất 1 900 (mục Cân bằng); `brain-test.ts` do điều phối cập nhật.

## Đối chiếu kế hoạch (mục 3.5)

- Theo đúng: chỉ xoay, không lật; Mầm 3 ô không xoay 3 thẻ; Thường 4 ô xoay 90°/180° 4 thẻ; Khó 5 ô có bản lật gương; Siêu khó 5–6 ô, cả 4 thẻ cùng số ô, nhiễu là bản lật gương và bản lệch 1 ô; hình đối xứng gương bị loại khỏi kho khi có thẻ "bản lật gương".
- Cụ thể hoá (kế hoạch chưa ghi): thẻ nhiễu Mầm là mảnh 3 ô kia + khoảng trống thừa một ô; Thường không có bản lật gương hay cặp gương; Khó và Siêu khó luôn có hai cặp gương để tìm cặp không đoán được đáp án (điều phối quyết định 2026-10-20, bỏ thẻ thừa/thiếu một ô ở Khó): Khó thêm một cặp gương pentomino khác chữ, Siêu khó thêm mảnh lệch 1 ô và gương của nó.
- Lệch nhẹ: "góc xoay bất kỳ" ở Khó làm thành 90°/180°/270° (không có 0°, luôn phải xoay); "90° hoặc 180°" ở Thường hiểu là xoay theo chiều kim đồng hồ (`answerTurns` 1 hoặc 2). Hộp vuông 4 / 5 / 5 / 6 ô.

## Câu hỏi mở

- Đã quyết (điều phối, 2026-10-20): Khó luôn có hai cặp gương, bỏ thẻ thừa/thiếu một ô.
- Vì mọi pentomino có tay thuận đều "lệch 1 ô" được sang nhau, câu 5 ô của Siêu khó và câu Khó gần như cùng cấu trúc (hai cặp gương, cặp nhiễu là một chữ khác). Bảng Cân bằng vẫn giả định Siêu khó so mỗi thẻ 1,6–2,2 s. Nếu đo thấy câu 5 ô ở Siêu khó nhanh như Khó (1,2–1,7 s), Siêu khó chỉ còn TB ~5,2 s, hệ số cần ~2,85 và hai mức sát nhau: khi đó dùng núm chỉnh 4 (Siêu khó chỉ 6 ô).
- Mầm chỉ có 2 hình khoảng trống (thẳng, góc), dễ lặp với trẻ. Chơi thử xem có cần thêm mảnh 4 ô dễ (L, T) vào Mầm không.
- Thường dễ giải bằng cách nhận dạng mảnh (không có J khi khoảng trống là L) hơn là xoay thật. Đo ở buổi chơi thử; quá dễ thì dùng núm chỉnh 1.
