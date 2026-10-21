# Đường số (`number-path`)

- Nhóm: Tính toán (`compute`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006, giữ nguyên; lý do ở mục [Cân bằng](#cân-bằng))
- File: `packages/shared/src/games/number-path/` (logic + test), `apps/web/src/games/number-path/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M28** (NumberPathMobile, NumberPathLevels, NumberPathStates, NumberPathHowTo). Chờ chủ dự án duyệt.
- Nguồn: [CR-014](../00-tracking/change-requests.md#cr-014), [kế hoạch mở rộng minigame mục 3.14](../01-product/minigame-expansion.md#314-đường-số-number-path-tính-toán). Chỗ lệch khỏi kế hoạch: [Quyết định thiết kế](#quyết-định-thiết-kế-lệch-khỏi-kế-hoạch-314).
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Trên đỉnh bảng là **số xuất phát**, bên trên nữa là **số đích**. Từ số xuất phát có vài con đường phấn vẽ sẵn, mỗi đường đi qua vài ô phép tính (+3, ×2, ÷3, x², ×(−1)…) rồi tới một cửa ra ở đáy bảng. Tính nhẩm dọc từng đường; chạm cửa ra của con đường duy nhất cho ra đúng số đích.

Khác Chạm đích (chọn một **tập** thẻ có tổng bằng đích) và Bóng bay số (so **thứ tự** các số): ở đây là **theo dõi một chuỗi phép tính nối tiếp**, giữ kết quả trung gian trong đầu, thứ tự phép có ý nghĩa (6 × 2 + 4 khác (6 + 4) × 2), và ở Siêu khó còn phải dò nét các đường đan chéo nhau.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn số xuất phát và số đích
  2. Tính dọc từng đường, từng ô
  3. Chạm cửa ra của đường đúng
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ** (560×360): góc trên phải có thẻ đích ghi 13 (kèm biểu tượng hồng tâm nhỏ). Giữa phía trên là vòng tròn xuất phát ghi 5. Hai đường phấn thẳng đi xuống: đường trái (nét liền, cửa ○) qua ô "×2" rồi ô "+3"; đường phải (nét gạch, cửa △) qua ô "+4" rồi ô "×2". Cạnh đường trái có số trung gian viết phấn nhỏ "10" rồi "13". Ngón tay đang chạm cửa ○, cạnh cửa có dấu ✓. Dưới cửa △ ghi "18" bị gạch chéo, đường phải mờ đi.
- **Câu nhắc lúc đếm ngược:** "Tính đường cho trúng đích!"
- **Câu nhắc theo mức:**
  - Khó: "Âm chia dương vẫn ra số âm" (số xuất phát ở Khó luôn âm, bẫy chính là dấu).
  - Siêu khó: "Bám đúng nét đường; ô chung, phép chung" (luật riêng của mức: hai đường đi qua cùng một ô thì cùng áp phép của ô đó).
  - Mầm và Thường dùng câu nhắc chung.

Gợi ý câu `howTo` cho `locales.ts` (≤ 12 từ): "Chạm cửa ra của đường tính ra đúng số đích."

Gợi ý thẻ game: **Đường số** · "Chọn đường tính ra đúng số đích" / **Number Path** · "Pick the path that hits the target".

## Câu đố & đáp án

Đúng như code (`number-path.ts`, export qua `@brain-rizz/shared`):

```ts
type NumberPathOpKind = "add" | "sub" | "mul" | "div" | "sq" | "neg";

interface NumberPathOp {
  kind: NumberPathOpKind;
  n: number; // add/sub/mul/div: toán hạng nguyên dương; sq, neg: luôn 0
}

interface NumberPathCell {
  col: number; // 0 … cols − 1, từ trái sang
  row: number; // 0 … rows − 1, từ trên xuống
}

interface NumberPathPuzzle {
  start: number;                // số xuất phát
  target: number;               // số đích
  cols: number;                 // số cột = số đường = số cửa ra: 2 / 3 / 3 / 4
  rows: number;                 // số hàng ô = số phép mỗi đường: 2 / 3 / 3 / 3
  paths: NumberPathOp[][];      // paths[i]: các phép của đường i, từ trên xuống
  layout: NumberPathCell[][];   // layout[i][k]: ô chứa phép paths[i][k], luôn ở hàng k
  answer: number;               // chỉ số đường duy nhất ra target
}

type NumberPathAnswer = number; // chỉ số đường (= cột cửa ra) người chơi chạm
```

- **Đường `i` ra ở cửa cột `i`**: `layout[i][rows − 1].col === i`. Ở Mầm, Thường, Khó đường `i` đi thẳng dọc cột `i`; ở Siêu khó các đường đan chéo, nên hàng 0 của đường `i` có thể ở cột khác.
- **Ô dùng chung** (chỉ Siêu khó): hai đường có cùng `(row, col)` ở cùng một hàng thì đi qua cùng một ô và cùng áp phép của ô đó (`paths[i][row]` và `paths[j][row]` giống hệt nhau). Mỗi `(row, col)` xuất hiện ở nhiều đường thì FE chỉ vẽ một ô.
- Hàm dùng chung, export cùng file:
  - `evaluateNumberPath(start, ops)`: kết quả cuối của một đường. Bộ sinh, `check` và test cùng dùng.
  - `traceNumberPath(start, ops)`: các kết quả sau từng phép (không gồm số xuất phát), để FE hiện số trung gian khi người chơi sai.
  - `applyNumberPathOp(value, op)`: áp một phép. Không bao giờ trả về −0.
  - `numberPathSolveSeconds(puzzle)`: mô hình thời gian giải (mục Cân bằng), bộ sinh dùng để giữ mỗi mức trong khoảng thời gian riêng.
  - `numberPathTryGenerate(seed, index, d)` và `numberPathFallback(d)`: tách riêng để test kiểm được là câu dự phòng không bao giờ cần tới.
- `check(puzzle, answer)`: đúng khi và chỉ khi `paths[answer]` tồn tại và `evaluateNumberPath(start, paths[answer]) === target`. Vì chỉ một đường ra đích, việc này tương đương `answer === puzzle.answer`.
- `isAnswer(value)`: số nguyên 0–3. Từ chối số âm, ≥ 4, số thực, `NaN`, vô cực, chuỗi, `bigint`, `null`, mảng, object. Chỉ số 2 hoặc 3 gửi cho câu ít đường hơn vẫn qua `isAnswer` và bị `check` chấm sai (khoá 1,5 s), không bị lặng lẽ bỏ qua.
- Biểu thức lấy đáp án đúng cho test server: `GAMES["number-path"].generate(s, i, d).answer`.

## Cách sinh câu đố

Một nguồn ngẫu nhiên `rng = createRng(deriveSeed(roundSeed, index))`. Mỗi câu thử tối đa 400 lần; mỗi lần dựng một câu ứng viên rồi **nhận** khi (a) chỉ `answer` ra đích và kết quả các đường đôi một khác nhau (kiểm lại bằng `evaluateNumberPath`), và (b) thời gian giải theo mô hình nằm trong khoảng của mức (bảng Độ khó). Không lần nào được thì dùng câu dự phòng cố định của mức; đo 10 000 seed mỗi mức: chưa từng xảy ra (trung bình 1,1 / 1,5 / 2,2 / 8,4 lần thử, nhiều nhất 5 / 8 / 15 / 105).

Luật chung khi bốc phép (mọi mức):

- Mọi giá trị (xuất phát, trung gian, đích, kết quả đường nhiễu) nằm trong khoảng của mức.
- Cộng/trừ: toán hạng 1–9. Nhân: ×2 (Thường), ×2 hoặc ×3 (Khó, Siêu khó), không nhân số 0.
- **Chia luôn chia hết**: chỉ chia số khác 0, chia hết, và |số bị chia| > số chia (thương khác ±1).
- Bình phương chỉ áp cho số có trị tuyệt đối 2–4 (ra 4, 9 hoặc 16). Đổi dấu không áp cho số 0.
- **Không phép nào triệt tiêu phép ngay trước** trên cùng đường (×2 rồi ÷2, +5 rồi −5, đổi dấu hai lần).
- **Phép cuối của mọi đường là cộng/trừ.** Toán hạng được chỉnh cho kết quả bằng `đích + độ lệch`: độ lệch = 0 ở đường đúng, mỗi đường nhiễu một độ lệch khác nhau trong ±1 … ±near (gán trước khi sinh đường, theo thứ tự xáo trộn).

**Mầm, Thường, Khó (đường thẳng):**

1. Bốc số xuất phát, chỉ số đường đúng (đều), số đích (đều trong khoảng giá trị của mức), rồi độ lệch của từng đường.
2. Sinh đường đúng trước, rồi các đường nhiễu theo thứ tự chỉ số. Mỗi đường thử tối đa 40 lần: bốc phần đầu (mọi phép trừ phép cuối) theo khuôn của mức (xáo thứ tự ô khuôn, bốc toán hạng đều trong các phép hợp lệ), phần đầu phải khác mọi phần đầu đã có; rồi khép bằng phép cuối cộng/trừ ra đúng `đích + độ lệch`.
3. Khuôn phần đầu: Mầm `[±]`; Thường `[×2, ±]`; Khó `[÷, × hoặc ±]` (ô thứ hai bốc đều loại × hay ± trước, loại nào không còn phép hợp lệ thì lấy loại kia).

**Siêu khó (đường đan):**

1. Bốc số xuất phát và chỉ số đường đúng.
2. **Vẽ đường đan**, đi ngược từ cửa ra (đường `p` ở cột `p` của hàng cuối) lên hàng 0. Mỗi hàng, mỗi đường lệch −1, 0, 0 hoặc +1 cột (đi thẳng gấp đôi đi chéo cho nét gọn), trong lưới 4 cột. Một ô chứa tối đa 2 đường; hai đường đã chung một ô thì không chung ô ở hàng kế tiếp (không đi chồng lên cùng một đoạn nét). Mỗi hàng thử tối đa 40 lần. Chỉ giữ lưới có 1–2 ô dùng chung.
3. **Điền phép từng hàng** (trừ hàng cuối), mỗi ô một lần. Loại phép bốc theo trọng số ± 4 · × 1 · ÷ 1 · x² 1,5 · ×(−1) 1,5 trong các loại còn phép hợp lệ cho **mọi** giá trị đi vào ô (ô dùng chung có hai giá trị, phép phải hợp lệ cho cả hai). Đường nào tới hàng áp chót mà chưa có x² hay ×(−1) thì ô đó chỉ bốc hai loại này. Câu phải có cả x² lẫn ×(−1).
4. **Hàng cuối** (mỗi đường một ô riêng): xáo độ lệch một lần, rồi thử các số đích trong khoảng của mức theo thứ tự xáo trộn; lấy số đầu tiên mà mọi đường đều khép được bằng cộng/trừ 1–9 ra `đích + độ lệch`.

**Vì sao đúng một đáp án:** đường đúng ra `đích + 0`; mỗi đường nhiễu ra `đích + độ lệch`, độ lệch khác 0 và đôi một khác nhau, nên không đường nhiễu nào ra đích và các kết quả đều khác nhau. Bộ sinh kiểm lại điều này bằng chính `evaluateNumberPath` trước khi nhận câu.

**Vì sao không loại được bằng ước lượng:** mọi đường nhiễu lệch đích chỉ 1–3 (Mầm) tới 1–5 (Siêu khó), nên phải tính đúng từng bước.

**Vì sao không đoán được đáp án qua hình dạng câu:** mọi đường (kể cả đường đúng) sinh theo cùng một luật, nên phép cuối của đường đúng không lớn hơn, nhỏ hơn hay khác dấu đường nhiễu (đo: chênh độ lớn trung bình ≤ 0,1, chênh tỉ lệ phép cộng ≤ 2 điểm phần trăm), và vị trí đáp án rải đều (lệch tối đa 3 % so với chia đều). Bản đầu chọn phép cuối của đường đúng tự do và chỉ chỉnh phép cuối của đường nhiễu; khi đó ở Thường đường đúng có phép cuối nhỏ nhất 36 % số câu nhưng lớn nhất chỉ 19 %, đủ để đoán mò có lợi, nên đã bỏ.

**Vì sao tất định:** chỉ dùng `createRng` và `deriveSeed`, chỉ có số nguyên, thứ tự gọi `rng` cố định, không có `Math.random()` hay `Date.now()`. Mô hình thời gian dùng phép cộng, nhân số thực IEEE 754, cho cùng kết quả trên mọi trình duyệt và Node.

## Độ khó

| Mức | Tham số | Người chơi thấy gì (ví dụ là câu dự phòng của mức) |
| --- | --- | --- |
| Mầm | 2 đường thẳng · 2 phép cộng/trừ · xuất phát 2–12 · mọi số 0–20 · đường nhiễu lệch 1–3 · thời gian mô hình ≤ 3,6 s | Xuất phát 7, đích 9: ○ "+5, −3" · △ "−2, +6" |
| Thường | 3 đường thẳng · 3 phép: đúng một ×2 (phép 1 hoặc 2), còn lại cộng/trừ · xuất phát 1–12 · mọi số 0–40 · lệch 1–4 · 3,7–4,95 s | Xuất phát 6, đích 16: "×2, +5, −3" · "+4, ×2, −4" · "−1, ×2, +3" |
| Khó | 3 đường thẳng · 3 phép: đúng một ÷2/÷3 (chia hết), một ×2/×3 hoặc cộng/trừ, phép cuối cộng/trừ · **xuất phát âm** −12…−2 · mọi số −20…20 · lệch 1–4 · 5,05–6,05 s | Xuất phát −6, đích 5: "÷3, ×2, +9" · "+2, ÷2, +5" · "÷2, −5, +9" |
| Siêu khó | **4 đường đan chéo** trên lưới 4×3 · **1–2 ô dùng chung** · 3 phép, mỗi đường có x² hoặc ×(−1), câu nào cũng có cả hai · xuất phát −9…9 · mọi số −20…20 · lệch 1–5 · 6,15–7,3 s | Xuất phát −3, đích 5; ô ×(−1) ở hàng 0 chung cho hai đường, ô +8 ở hàng 1 có hai đường cắt nhau (ví dụ đầy đủ ở Ghi chú cho FE) |

Mỗi mức thêm đúng một thứ mới: Mầm → Thường thêm đường, thêm phép và ×2; Thường → Khó thêm ÷ và số âm; Khó → Siêu khó thêm đường thứ tư, nét đan chéo, ô dùng chung, x² và đổi dấu.

Đo trên code, 10 000 seed mỗi mức (2026-10-20):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Đường × phép | 2 × 2 | 3 × 3 | 3 × 3 | 4 × 3 |
| Tỉ lệ phép | + 64 % · − 36 % | + 37 % · − 29 % · ×2 33 % | ÷ 33 % · + 34 % · − 26 % · × 7 % (22 % số đường có ×) | + 28 % · − 27 % · ×(−1) 23 % · x² 13 % · × 5 % · ÷ 4 % (39 % số đường có x², 70 % có ×(−1)) |
| Giá trị đo được | 0…20 | 0…40 | −20…16 (đích âm 56 %) | −20…20 (đích âm 29 %, xuất phát âm 64 %) |
| Ô dùng chung | 0 | 0 | 0 | 1 ô: 37 % · 2 ô: 63 % |
| Lệch của đường nhiễu | 1, 2, 3 gần đều | 1–4 gần đều | 1–4 gần đều | 1–5 gần đều |
| Thời gian giải theo mô hình, người lớn: TB (P10–P90; thấp nhất–cao nhất) | 2,83 s (2,40–3,05; 2,40–3,23) | 4,53 s (4,06–4,90; 3,81–4,95) | 5,65 s (5,31–5,97; 5,05–6,05) | 6,56 s (6,24–6,92; 6,15–7,30) |
| Trẻ 7 tuổi: TB (P10–P90) | 5,05 s (4,28–5,45) | — | — | — |

Với cùng một người lớn, khoảng thời gian của các mức không chồng nhau (cao nhất của mức dưới < thấp nhất của mức trên). Test kiểm điều này, và kiểm thời gian trung bình lệch bảng trên không quá 0,1 s.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng: đúng một đường có `evaluateNumberPath(start, paths[i]) === target`, đó là `answer`; `check` chỉ nhận `answer` trong các chỉ số 0–3.
- Kết quả các đường đôi một khác nhau; mỗi đường nhiễu lệch đích 1 … near (3 / 4 / 4 / 5).
- Mọi số (xuất phát, trung gian, đích) là số nguyên trong khoảng của mức, không có −0. Xuất phát trong khoảng của mức (Khó luôn âm).
- ÷ luôn chia hết, số bị chia khác 0, thương khác ±1. × không áp cho 0. x² chỉ trên |x| 2–4. Đổi dấu không áp cho 0.
- Chỉ có loại phép của mức; toán hạng đúng phạm vi (± 1–9, × theo mức, ÷ 2 hoặc 3, x² và ×(−1) có `n = 0`); phép cuối luôn cộng/trừ; không phép nào triệt tiêu phép ngay trước.
- Khuôn: Thường mỗi đường đúng một ×2; Khó mỗi đường đúng một ÷ và tối đa một ×; Siêu khó mỗi đường có x² hoặc ×(−1), câu có cả hai. Đường thẳng: phần đầu các đường đôi một khác nhau.
- Lưới: đúng kích thước của mức; mỗi đường một ô mỗi hàng, `layout[i][k].row === k`; hai ô liền nhau lệch tối đa một cột; đường `i` ra cửa `i`; Mầm, Thường, Khó đi thẳng.
- Siêu khó có 1–2 ô dùng chung; tối đa 2 đường một ô; cùng ô thì cùng phép; hai đường không đi chung hai hàng liền nhau. Ba mức dưới không có ô dùng chung.
- Tất định: gọi lại cùng `(seed, index, difficulty)` cho kết quả giống hệt; câu khác nhau theo seed và theo chỉ số câu.
- Câu dự phòng không bao giờ cần tới (`numberPathTryGenerate` không trả về null), và chính câu dự phòng cũng đủ mọi ràng buộc trên, kể cả khoảng thời gian.
- Độ khó tăng thật: thời gian theo mô hình tăng ngặt theo mức, các mức không chồng nhau; mỗi mức thêm đúng thứ mới đã nêu (số đường × phép, ×, ÷ và số âm, ô dùng chung, x² và ×(−1)).
- Vị trí đáp án rải đều (mỗi đường lệch < 10 % so với chia đều); độ lớn và dấu phép cuối của đường đúng như đường nhiễu.
- CR-006: `durationMs = 60 000`; hệ số điểm dương, không giảm theo mức, Thường = 1; không khai báo `speedAllowanceMs` và `answerWindowMs`.
- `isAnswer` nhận 0–3, từ chối dữ liệu rác (danh sách ở mục trên).

Các điều trên được kiểm trong `number-path.test.ts`: 19 test, 10 000 seed × 4 mức, khoảng 9 giây.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi con số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm | trẻ 7 tuổi ~5,1 s (4,3–5,5) · người lớn ~2,8 s (2,4–3,1) | trẻ ~10,6 (~9,5 đúng) · người lớn ~18,6 (~18,0 đúng) |
| Thường | ~4,5 s (4,1–4,9) | ~11,8 (~10,8 đúng) |
| Khó | ~5,6 s (5,3–6,0) | ~9,5 (~8,5 đúng) |
| Siêu khó | ~6,6 s (6,2–6,9) | ~8,1 (~7,0 đúng) |

**Mô hình thời gian** (`numberPathSolveSeconds`, kiểu KLM, cùng thang với Chạm đích và Bóng bay số; phải hiệu chỉnh sau buổi chơi thử). Thời gian là tổng:

- 0,3 s định hướng; đọc số xuất phát và số đích, mỗi số 0,25 s (0,35 s nếu hai chữ số, thêm 0,1 s nếu âm); chạm 0,35 s.
- Tính lần lượt từng đường tới khi gặp đường ra đích. Nếu mọi đường khác đã sai thì đường còn lại chỉ tính nửa (nửa số người chọn luôn, nửa kiểm lại). Lấy trung bình trên mọi thứ tự duyệt đường, nên con số không phụ thuộc vị trí đáp án.
- Mỗi đường tính: dò nét + từng phép + so với đích 0,2 s.
  - Dò nét: đường thẳng 0,1 s mỗi ô; đường đan 0,2 s mỗi ô, thêm 0,25 s mỗi ô chung với một đường tới từ ô khác (nét cắt nhau trong ô), thêm 0,15 s mỗi lần tách khỏi đường đi chung từ số xuất phát.
  - Phép đã tính ở đường trước với cùng phần đầu (ô chung ở hàng 0) không tính lại.
- Mỗi phép:
  - cộng/trừ: 0,3 s nếu mọi số một chữ số, 0,45 s nếu có số hai chữ số; có số âm thêm 0,25 s, không thì có nhớ/mượn qua hàng chục thêm 0,1 s;
  - ×2: 0,35 s (|x| ≤ 9) hoặc 0,5 s; ×3: 0,45 s hoặc 0,65 s; số âm thêm 0,2 s;
  - ÷2: 0,45 s (|x| ≤ 20) hoặc 0,6 s; ÷3: 0,6 s hoặc 0,75 s; số âm thêm 0,2 s;
  - x²: 0,35 s, cơ số âm thêm 0,2 s; ×(−1): 0,25 s.

Với trẻ 7 tuổi: `0,5 + 1,8 × (thời gian người lớn − 0,3)`, tức mọi khoản (trừ định hướng) nhân 1,8 và 0,5 s để định hướng, như Chạm đích.

Số câu mỗi vòng tính thêm: 0,25–0,35 s hiệu ứng sau câu đúng (tính vào thời gian trả lời của câu sau); tỉ lệ sai giả định trẻ ở Mầm 10 %, người lớn ở Mầm 3 %, Thường 8 %, Khó 10 %, Siêu khó 13 % (đường nhiễu chỉ lệch 1–5 nên một phép tính nhầm là chọn sai); câu sai tốn thời gian như câu đúng rồi khoá 1,5 s.

**Vì sao giữ mỗi mức trong một khoảng thời gian:** không lọc thì Khó trải 4,75–6,5 s (P10–P90 5,3–6,2 s), chạm vào cả Thường (cao nhất 4,95 s) lẫn Siêu khó. Lọc theo khoảng bỏ các câu quá dễ hoặc quá khó so với mức (Thường gần như không bị lọc; Khó và Siêu khó chủ yếu bỏ câu dễ nhất), để mức nào cũng có công sức đều tay và các mức không chồng nhau. Cái giá là số lần thử: Siêu khó trung bình 8,4 lần, vẫn dưới 0,2 ms mỗi câu.

**Vì sao vòng 60 giây:** ở Thường mỗi câu ~4,5 s (~11,8 câu mỗi vòng), ít hơn mục tiêu 15–25 câu của GDD vì mỗi câu là một chuỗi phép tính, giống các game Tính toán khác. Vẫn nằm trong quy tắc "1–8 giây ở mức Thường". Siêu khó còn ~8,1 câu, đủ điều kiện ≥ 8 câu mỗi vòng.

### Miễn trừ thời gian cho thưởng tốc độ (CR-006)

**Không khai báo** `speedAllowanceMs`. Mỗi câu chỉ một lần chạm, không có pha trình chiếu: mọi thời gian là đọc và tính nhẩm, đúng kỹ năng game đo. Việc cân điểm giữa các mức để cho hệ số điểm. Không khai báo `answerWindowMs` (không có vật biến mất).

### Hệ số điểm (CR-006)

**Đã khai báo:** `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.5, 3: 1.95 }`.

Cách tính như Chạm đích và Đếm sĩ số: mô phỏng 4 000 vòng 60 s cho mỗi người chơi bằng chính `generate()`, thời gian giải = mô hình × nhiễu đều ±20 %, điểm tính bằng `pointsForCorrect` của `scoring.ts` (trần combo × 1,5, khoá 1,5 s). Điểm một vòng gần đúng là `hệ số × A + B` (A = tổng 100 × combo, B = tổng thưởng tốc độ × combo của các câu đúng), nên hệ số cần = (điểm người lớn ở Thường − B) ÷ A. Làm tròn tới 0,05, giữ hệ số không giảm theo mức, Mầm = min(giá trị cho trẻ 7 tuổi, 1).

| Mức | Người chơi | Tỉ lệ sai | Thời gian mỗi câu đúng | Thưởng TB | Combo TB | Theo công thức | Đã chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 10 % | 6,33 s | 20,9 | 1,214 | 1,25 | **1** (không cao hơn Thường) |
| Thường | người lớn | 8 % | 5,54 s | 24,8 | 1,246 | 1 | **1** |
| Khó | người lớn | 10 % | 7,04 s | 16,4 | 1,202 | 1,48 | **1,5** |
| Siêu khó | người lớn | 13 % | 8,52 s | 9,5 | 1,159 | 1,97 | **1,95** |

Điểm vòng mô phỏng (vòng 60 s; % so với người lớn ở Thường):

| Người chơi | Hệ số chung 0,8 / 1 / 1,25 / 1,5 | Hệ số của game (đã chọn) |
| --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | ~1 160 (69 %) | ~1 390 (83 %) |
| Người lớn ở Mầm | ~2 870 (171 %) | ~3 360 (200 %) |
| Người lớn ở Thường | ~1 680 (100 %) | ~1 680 (100 %) |
| Người lớn ở Khó | ~1 450 (86 %) | ~1 700 (101 %) |
| Người lớn ở Siêu khó | ~1 300 (77 %) | ~1 670 (99 %) |

- Người lớn chọn Mầm được ~2 lần điểm mức Thường. Không công thức nào chặn được việc này; phần đó do chủ phòng giám sát (nút Nhắc, GDD §6).
- **Chỉnh sau buổi chơi thử:** đo tỉ lệ sai và số câu đúng mỗi vòng ở từng mức, thay vào bảng trên rồi tính lại. Chỉ đổi số trong `difficultyMultiplier`; test chỉ kiểm hệ số dương, không giảm theo mức, Thường = 1.

### Điểm chuẩn Kiểm tra não

Theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): Thường, 45 s, 4 000 lượt, thời gian thao tác dao động đều ±20 % quanh mô hình, câu sai tốn thời gian như câu đúng cộng khoá 1,5 s, câu chưa xong khi hết giờ không tính, 0,25–0,35 s hiệu ứng giữa hai câu.

| Nhóm | Game | Thời lượng | Giả định ở Thường: thời gian mỗi câu · tỉ lệ sai | Câu · đúng | **Điểm chuẩn** | Nhanh hơn 30 % | Chậm hơn 40 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tính toán | Đường số | 45 s | 4,5 s · 8 % | 8,7 · 8,0 | **1 200** (mô phỏng 1 207; 20 000 lượt: 1 210) | × 1,58 | × 0,60 |

Khớp các game Tính toán đã có (Bóng bay số 1 250, Chạm đích 1 100, Đếm tiền nhanh 1 200; nhanh × 1,57–1,61, chậm × 0,58–0,61). Điều phối điền số này vào `BRAIN_TEST_REFERENCE_SCORE` và bảng điểm chuẩn của GDD.

## Ghi chú cho FE

Chưa có bản mẫu; toạ độ dưới đây là đề xuất của game-designer để ui-designer vẽ và frontend-dev dựng, tính theo px thiết kế trong khung 720×1280.

### Dữ liệu câu đố và đáp án

Scene gọi `numberPath.generate(bridge.seed, index, bridge.difficulty)` rồi vẽ theo `NumberPathPuzzle`:

| Trường | Scene dùng để |
| --- | --- |
| `start` | số trong vòng tròn xuất phát |
| `target` | số trong thẻ đích |
| `cols`, `rows` | chọn toạ độ cột, hàng (bảng Bố cục) |
| `layout` | vẽ ô và nét: mỗi `(row, col)` khác nhau là một ô; nét đường `i` đi số xuất phát → `layout[i][0]` → … → `layout[i][rows − 1]` → cửa `i` |
| `paths` | nhãn phép của ô (`paths[i][k]` là phép của ô `layout[i][k]`; ô dùng chung có cùng phép ở mọi đường đi qua) |
| `answer` | tô đường đúng khi người chơi sai |

**Đáp án** (`NumberPathAnswer = number`): chỉ số đường = chỉ số cửa ra đã chạm, gửi **đúng một lần** mỗi câu.

Nhãn phép (FE tự vẽ ký hiệu, shared không chứa chữ): `add` → "+n", `sub` → "−n" (U+2212), `mul` → "×n", `div` → "÷n", `sq` → "x²", `neg` → "×(−1)". Số âm (xuất phát, đích, số trung gian) vẽ bằng "−" (U+2212), không dùng `String(v)` vì ra gạch ngắn "-". ui-designer có thể đổi ký hiệu "x²" và "×(−1)" nếu tìm được hình rõ hơn, miễn không cần chữ.

### Bố cục

| Vùng | Toạ độ | Nội dung |
| --- | --- | --- |
| Dải trên cùng | y 0–225 ở giữa | để trống cho huy hiệu khoá và thẻ HUD; không đặt gì cần đọc khi khoá |
| Thẻ đích | tâm (360, 290), 300 × 120 | biểu tượng hồng tâm phấn nhỏ bên trái (x ≈ 255), số đích Baloo 2 ExtraBold 80 px (x ≈ 390) |
| Số xuất phát | vòng tròn tâm (360, 440), bán kính 58 | nền kem, số 60 px |
| Cột | 2 cột: x = 220, 500 · 3 cột: x = 150, 360, 570 · 4 cột: x = 105, 275, 445, 615 | tâm ô và cửa ra |
| Hàng | 2 hàng: y = 640, 860 · 3 hàng: y = 600, 770, 940 | tâm ô |
| Ô phép | 150 × 96, bo 22 (4 cột: 140 × 92) | thẻ giấy kem, nhãn phép 52 px (4 cột: 46 px; "×(−1)" 40 px cho vừa) |
| Cửa ra | tâm y = 1130, bán kính 62, dưới mỗi cột | hình riêng mỗi đường: 0 ○, 1 △, 2 □, 3 ◇ (nét phấn 56 px), cùng màu và kiểu nét với đường |

Nét đường:

- Vẽ dưới ô, từ đáy vòng xuất phát tới đỉnh ô hàng 0, giữa tâm các ô liền nhau, rồi tới cửa ra. Dày 8 px.
- Mỗi đường một màu phấn **và** một kiểu nét, để không chỉ phân biệt bằng màu: đường 0 liền (vàng), 1 gạch dài (hồng), 2 chấm (xanh dương), 3 gạch chấm (xanh lá). Mầm, Thường, Khó dùng cùng quy ước cho thống nhất.
- Hai đường chung ô hàng 0 thì đi chung đoạn từ số xuất phát tới ô đó: vẽ hai nét song song cách nhau 14 px (lệch ±7 px vuông góc với đoạn), để thấy cả hai kiểu nét. Ngoài đoạn này không có hai đường nào đi chồng một đoạn (bộ sinh bảo đảm).
- Ô dùng chung ở hàng 1 trở đi: hai nét tới từ hai ô khác nhau, đi vào và ra khỏi ô theo hai hướng khác nhau; kiểu nét phải liền mạch hai bên ô để người chơi dò được nét nào đi tiếp. Không thêm dấu hiệu nào khác trên ô chung (dò nét là kỹ năng của mức).

Ví dụ Siêu khó để vẽ bản mẫu (chính là câu dự phòng): xuất phát −3, đích 5, lưới 4×3.

| Đường (cửa) | Ô hàng 0 | Ô hàng 1 | Ô hàng 2 | Số trung gian | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 0 (○) | cột 0: x² | cột 1: +8 (chung với đường 1) | cột 0: −9 | 9 → 17 → 8 | 8 |
| 1 (△) | cột 2: ×(−1) (chung với đường 2) | cột 1: +8 (chung với đường 0) | cột 1: −2 | 3 → 11 → 9 | 9 |
| 2 (□) | cột 2: ×(−1) (chung với đường 1) | cột 2: x² | cột 2: −4 | 3 → 9 → 5 | **5 (đáp án)** |
| 3 (◇) | cột 3: −4 | cột 3: ×(−1) | cột 3: −6 | −7 → 7 → 1 | 1 |

### Vùng chạm

- **Mầm, Thường, Khó:** cả dải cột của đường, từ đỉnh ô hàng 0 tới đáy cửa ra (rộng bằng khoảng cách cột trừ 10 px: 270 / 200 px). Chạm chỗ nào trên đường cũng chọn đường đó.
- **Siêu khó:** chỉ dải từ đỉnh ô hàng cuối (y ≈ 890) tới đáy cửa ra (y ≈ 1200), rộng 160 px, vì ô hàng cuối và cửa ra là của riêng một đường; các hàng trên có nét đan nên không nhận chạm.
- Ở tỉ lệ thu nhỏ ~0,31 của điện thoại nhỏ, 160 px ≈ 50 px thật, ≥ 48 px.
- Chạm là nộp ngay. Trong lúc khoá, mọi vùng không nhận chạm; chạm không tính là sai. Xử lý chạm đầu tiên rồi dừng, chạm nhiều ngón cùng lúc vẫn chỉ gửi một đáp án.
- Máy tính: con trỏ bàn tay, cửa ra đang rê nhô lên nhẹ. **Không** làm sáng cả đường khi rê chuột: như vậy là dò nét hộ người chơi máy tính, không công bằng với người chơi điện thoại.

### Trạng thái

| Trạng thái | Hình | Thời lượng |
| --- | --- | --- |
| Hiện câu | thẻ đích, số xuất phát, ô và nét hiện ra; chạm được ngay | ≤ 200 ms |
| Đúng | một chấm phấn chạy dọc đường đã chọn từ số xuất phát xuống cửa (không hiện số trung gian); cửa có ✓, thẻ đích loé sáng | câu mới sau ≤ 300 ms |
| Sai → khoá | xem mục dưới | rung 200 ms; khoá theo `bridge.unlockDelay` rồi sang câu mới |
| Hết giờ giữa câu | ngừng nhận chạm, không gửi gì | — |
| Nối lại giữa vòng | bắt đầu từ `bridge.startIndex` | — |

### Hiện đáp án đúng khi sai

Khi chạm cửa của đường không ra đích:

- Gửi đáp án ngay, rồi khoá trong suốt `bridge.unlockDelay`. Thẻ đích vẫn rõ (y 230–350, dưới dải huy hiệu khoá).
- Cửa đã chạm có dấu ✗; ngay dưới cửa hiện kết quả của đường đó (`evaluateNumberPath(start, paths[chọn])`) trong vòng tròn nét đứt đỏ, vd. "8".
- **Đường đúng** tô đậm (nét đôi màu vàng) từ số xuất phát tới cửa `answer`; cạnh mỗi ô trên đường đúng hiện kết quả sau ô đó (`traceNumberPath(start, paths[answer])`) bằng chip phấn nhỏ 34 px, đặt ở khe dưới ô lệch sang phải (khe giữa hai hàng cao ~74 px) để không che ô bên cạnh; cửa đúng có ✓.
- Các đường còn lại mờ đi (độ mờ 0,35), kể cả nét của đường đã chọn sai (chỉ giữ ✗ và kết quả của nó).
- Bản nền tối: ✗ màu hồng viền trắng, nét đúng và ✓ màu kem/vàng như các game khác.

Mọi dữ liệu đã có trong puzzle, không cần chờ server trả `answer-result`. Việc này không lộ gì về câu sau.

### Màu và chữ

- Chữ số dùng Baloo 2 ExtraBold, các chữ số rộng bằng nhau. Chờ font tải xong mới vẽ câu đầu.
- Ô phép, thẻ đích, vòng xuất phát, cửa ra đều có nền riêng (giấy kem hoặc mực), nổi trên cả nền bảng sáng lẫn tối. Màu nét phấn lấy từ token; bản tối dùng ô tím đậm chữ kem.
- Không có chữ nào trong lúc chơi ngoài số và ký hiệu toán.

### Hiệu ứng & âm thanh

| Sự kiện | Hình | Âm (GĐ 2) |
| --- | --- | --- |
| Chạm cửa | cửa lún xuống | "tách" nhẹ |
| Đúng | chấm phấn chạy dọc đường + ✓ | "ting" cao dần theo combo (GDD §9) |
| Sai | rung + ✗ + tô đường đúng | "bụp" trầm; rung máy ngắn (GĐ 2) |

Khi bật giảm chuyển động (`prefers-reduced-motion`): bỏ rung và chấm chạy; hiện ✓ hoặc đường đúng ngay.

### Chữ hiển thị (`locales.ts`)

Thay chữ của câu đố mẫu bằng nội dung mục [Màn hướng dẫn](#màn-hướng-dẫn), thêm `levelHints` cho Khó và Siêu khó.

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M28 thắng các mục Bố cục, Nét đường, Màu và chữ ở trên về hình. Giữ nguyên toạ độ, thẻ đích, vòng xuất phát, ô, chip, nét đôi đường đúng, lớp phủ mờ. Chỉnh:

- **Mặt bảng vẽ trong canvas** (`SLATE` hiện có, màu `--board`): khung GameFrame là giấy `bg-muted`, phấn màu không nổi trên giấy.
- **4 màu nét** thay bộ pastel sun/pink/sky/mint (ba màu cùng độ chói ~0,52, xanh lá trùng sắc bảng sáng). Hằng số chung hai chủ đề:
  - đường 0, cửa ○, nét liền: trắng phấn `#f6f3ea` (`--chalk`), độ chói 0,90;
  - đường 1, cửa △, gạch dài 26/20: vàng `#ffd166`, 0,68;
  - đường 2, cửa □, chấm cách 20: hồng `#ff8aa5`, 0,42;
  - đường 3, cửa ◇, gạch chấm: xanh dương `#3a86d8`, 0,23.
- **Viền mực mọi nét**: mỗi đoạn gạch hoặc chấm vẽ trước lớp `--sticker` dày `LINE_W + 8`, cùng kiểu nét. Không có viền thì hồng 2,86:1, xanh 1,69:1 trên bảng sáng; có viền thì ≥ 4,37:1.
- `SHARED_GAP` 7 → 9, để hai nét có viền đi chung đoạn đầu không chồng nhau.
- Cửa ra: hình ○ △ □ ◇ vẽ nét liền dày 7, màu của đường. Bỏ kiểu nét thu nhỏ trên hình, vì ở điện thoại đoạn nét chỉ ~6 px.
- **Bình phương viết "□²"**, không viết "x²" (Baloo 2 ExtraBold ở ~22 px dễ đọc nhầm thành "×2"). Ô vuông vẽ bằng Graphics: cạnh 0,51 em, nét 0,11 em, bo 0,12 em. Số "2" cỡ 0,6 em, nâng 0,3 em.
- **Đổi dấu giữ "×(−1)"**, chữ 40 px. Viết "−□" thì theo cách đọc "phép + toán hạng" của các ô khác sẽ thành "trừ chính nó".
- `NumberPathHowTo.tsx`: đường đúng trắng phấn nét liền, cửa ○ trắng. Đường sai vàng nét gạch, cửa △ vàng. Cả hai nét có viền mực.

## Ghi chú cho BE

Không. Đáp án là một số nguyên, một lần mỗi câu, chấm bằng `check` như các game chọn một đáp án; không có miễn trừ thời gian, không có hạn trả lời. Test server lấy đáp án đúng bằng `GAMES["number-path"].generate(s, i, d).answer`.

## Đối chiếu quy tắc thiết kế (GDD §5)

- [x] Hiểu trong ≤ 5 giây với một câu hướng dẫn và hình minh hoạ (số xuất phát → các ô phép → cửa; chạm cửa ra đúng số đích).
- [x] Thường 4,1–4,9 s mỗi câu theo mô hình, trong khung 1–8 s.
- [x] Có bảng Cân bằng, hệ số điểm riêng; miễn trừ thời gian không cần (lý do ở trên).
- [x] Đúng một đáp án, kiểm bằng test 10 000 seed × 4 mức.
- [x] Chỉ số nguyên và `createRng()`; không cần dữ liệu ngoài.
- [x] Bốn mức khác nhau rõ rệt, không chồng nhau về thời gian; Mầm là 2 đường, 2 phép cộng/trừ trong phạm vi 20, trẻ 7 tuổi ~5 s mỗi câu.
- [x] Một ngón tay, khung dọc 720×1280, vùng chạm ≥ 48 px thật.
- [x] Không phụ thuộc chữ: chỉ số và ký hiệu toán.
- [x] Không chỉ phân biệt bằng màu: mỗi đường có kiểu nét và hình cửa riêng.

## Quyết định thiết kế (lệch khỏi kế hoạch 3.14)

| Kế hoạch 3.14 | Đặc tả | Lý do |
| --- | --- | --- |
| Khó: 4 phép | **3 phép** (÷, × hoặc ±, ±), xuất phát luôn âm | Với 4 phép, mô hình cho Khó 6,3–6,6 s (P90 7,0–7,3 s): chồng lên mọi phương án Siêu khó còn giữ được ≥ 8 câu mỗi vòng. |
| Siêu khó: 4–5 phép | **3 phép**, giữ 4 đường đan nhau, ô dùng chung, x² và đổi dấu | 4 đường đan × 4 phép ra 8,1 s mỗi câu (× 5 phép: 9,9 s), tức ~6,9 câu mỗi vòng 60 s, dưới mức ≥ 8 câu bắt buộc; thử cho từng cặp đường đi chung hai ô đầu (chia sẻ phép tính) vẫn 7,6 s. Giữ "4 đường đan nhau" vì đó là thứ người chơi thấy rõ nhất ở Siêu khó; 3 đường đan × 4 phép ra 6,6 s nhưng chồng lên Khó. |
| Thường ~6 s → ~9 câu | ~4,5 s → ~11,8 câu | Mô hình cùng thang với Chạm đích và Bóng bay số; con số trong kế hoạch là ước lượng thô. |
| Khó "có số âm" | Số xuất phát luôn âm (−12…−2) | Rõ luật hơn và đều tay hơn: bản đầu để xuất phát −9…12 thì bộ lọc thời gian tự giữ lại 99,9 % câu có xuất phát âm. |
| `Puzzle = { start, target, paths }` | Thêm `cols`, `rows`, `layout` (luôn có, kể cả đường thẳng) và `answer` | FE vẽ mọi mức bằng một cách; `answer` để tô đường đúng khi sai và cho test server. |

Nếu buổi chơi thử cho thấy người chơi thật tính nhanh hơn mô hình (Siêu khó dưới ~5,5 s), có thể trả Siêu khó về 4 phép: chỉ đổi `rows` và khoảng `seconds` của mức trong `LEVELS`, rồi chạy lại mô phỏng hệ số.

## Câu hỏi mở

- Chơi thử để đo thời gian giải và tỉ lệ sai thật từng mức, rồi chỉnh hệ số điểm, điểm chuẩn Kiểm tra não và (nếu cần) số phép ở Khó/Siêu khó như trên.
- Kế hoạch ghi rủi ro chồng ý với Chạm đích và Bóng bay số; đặc tả này tách rõ cơ chế (chuỗi phép nối tiếp, dò nét), nhưng nên chơi thử Đợt 1–2 xong mới chốt giữ game.
- Ở Mầm chỉ có 2 đường nên tính xong một đường là biết đáp án (không ra đích thì chọn đường kia). Coi là ổn cho trẻ 7 tuổi; mô hình đã tính việc này.
- ui-designer chốt ký hiệu cho bình phương ("x²") và đổi dấu ("×(−1)"), và bộ 4 kiểu nét đủ khác nhau trên nền bảng sáng lẫn tối.
