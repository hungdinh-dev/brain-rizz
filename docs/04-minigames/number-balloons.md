# Bóng bay số (`number-balloons`)

- Nhóm: Tính toán (`compute`) · game MVP
- Thời lượng vòng: 60 000 ms (lý do ở mục [Cân bằng](#cân-bằng)) — **đã duyệt 2026-10-12** (CR-006)
- File: `packages/shared/src/games/number-balloons/` (logic + test), `apps/web/src/games/number-balloons/` (`NumberBalloonsScene.ts`, `locales.ts`)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, khu M4 (BalloonsMobile, BalloonsLevels, BalloonsStates, BalloonsHowTo) — đã duyệt 2026-10-12
- Trạng thái:
  - Đặc tả bản đầu 2026-10-10. Chủ dự án **duyệt mọi đề xuất ngày 2026-10-12**, cùng [CR-006](../00-tracking/change-requests.md#cr-006). Danh sách ở mục [Quyết định đã duyệt](#quyết-định-đã-duyệt).
  - Bộ sinh câu đố và test đã xong (2026-10-12). Mọi số liệu "đo" trong đặc tả này lấy từ chính code, 10 000 seed mỗi mức.
  - Scene web đã làm (2026-10-12): `NumberBalloonsScene.ts`, `NumberBalloonsHowTo.tsx`, `locales.ts`. Chưa chơi thử trên máy thật.

## Cách chơi

Mỗi quả bóng mang một số. Nổ bóng lần lượt từ số nhỏ nhất đến số lớn nhất: nổ hết là đúng, chạm nhầm một quả là mất câu đó (mức cao có số âm và phép tính trên bóng).

## Màn hướng dẫn

- **Cách chơi:**
  1. Tìm bóng có số nhỏ nhất
  2. Nổ bóng lần lượt từ nhỏ đến lớn
  3. Nhầm một quả là mất câu đó
- **Mẹo theo mức** (tuỳ chọn, hiện dưới ô chọn độ khó khi người chơi chọn mức đó): Khó: "Nhớ: −8 nhỏ hơn −3". Siêu khó: "Tính kết quả phép tính rồi mới so". Mầm và Thường không có mẹo.
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ:** bốn quả bóng 8, 3, 12, 5 trên nền bảng. Cạnh mỗi quả có số thứ tự khoanh tròn bằng phấn (3 → ①, 5 → ②, 8 → ③, 12 → ④), một mũi tên phấn nét đứt nối 3 → 5 → 8 → 12. Ngón tay đang chạm quả 3, quả này vẽ đang nổ. Phía trên là khay thứ tự: ô đầu đã ghi 3, ba ô còn lại trống.
- **Câu nhắc lúc đếm ngược:** "Nổ bóng từ nhỏ đến lớn!" (dùng chung cho chạm và chuột).

Gợi ý câu `howTo` cho `locales.ts` (≤ 12 từ): "Nổ bóng theo thứ tự số từ nhỏ đến lớn."

## Câu đố & đáp án

Đúng như code (`packages/shared/src/games/number-balloons/number-balloons.ts`, export qua `@brain-rizz/shared`):

```ts
type BalloonKind = "num" | "add" | "sub" | "mul"; // số đơn | a + b | a − b | a × b

interface Balloon {
  kind: BalloonKind;
  a: number;     // "num": chính là số hiển thị (= value); phép tính: toán hạng trái
  b: number;     // toán hạng phải ("num": 0)
  value: number; // giá trị thật sau khi tính: số nguyên, đôi một khác nhau trong một câu
  slot: number;  // ô lưới, đánh số theo hàng từ góc trên trái (0 … cols × rows − 1), đôi một khác nhau
  color: number; // 0–5, đôi một khác nhau, chỉ để trang trí, không liên quan giá trị
  dx: number;    // −2…2: bậc lệch khỏi tâm ô (FE nhân 6 px)
  dy: number;    // −2…2
  phase: number; // 0–359: pha lắc lư, để các bóng lắc lệch nhịp
}

interface NumberBalloonsPuzzle {
  cols: number;        // Mầm 2, Thường 3, Khó 3, Siêu khó 2
  rows: number;        // luôn 3
  balloons: Balloon[]; // Mầm 3 bóng, mức khác 5
  order: number[];     // chỉ số bóng theo giá trị tăng dần = đáp án đúng
}

type NumberBalloonsAnswer = number[]; // chỉ số bóng (trong balloons) theo thứ tự đã chạm
```

- **Gom nhiều lần chạm thành một đáp án.** Giao thức chỉ nhận một `answer` cho mỗi câu, nên client giữ mảng chỉ số bóng đã chạm và gửi **đúng một lần**:
  - nổ hết bóng đúng thứ tự → gửi mảng đủ `n` phần tử;
  - chạm nhầm → gửi **ngay** mảng tính tới và gồm cả quả nhầm (vd. `[2, 0, 4]` khi quả thứ ba nhầm), rồi khoá.
- Lý do gửi ngay khi nhầm:
  - Khoá 1,5 giây (server tính từ lúc nhận đáp án) bắt đầu đúng lúc người chơi thấy lỗi.
  - Người chơi không phải chạm tiếp một câu đã hỏng.
  - Client **không được bỏ qua quả nhầm** để chạm tiếp: nếu bỏ qua thì bấm loạn cũng luôn ra đáp án đúng.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer` dài bằng `order` và trùng từng phần tử. Mảng gửi lúc nhầm luôn sai.
- `isAnswer(value)`: mảng 1–5 phần tử, mỗi phần tử là số nguyên 0–4, không trùng nhau. Từ chối mọi thứ khác: không phải mảng, mảng rỗng, mảng thưa, số thực, `NaN`, vô cực, chuỗi, `bigint`, mảng lồng. 5 là số bóng tối đa; mức nào tăng số bóng thì nới theo. Mọi mảng client hợp lệ gửi lên (đủ `order`, hoặc tiền tố đúng cộng một quả nhầm) đều qua `isAnswer`, để server chấm sai và khoá 1,5 s chứ không lặng lẽ bỏ qua.
- Phép tính lưu bằng mã (`add`, `sub`, `mul`); FE tự vẽ ký hiệu `+`, `−` (U+2212), `×`. Shared không chứa chữ hiển thị.

## Cách sinh câu đố

1. Hai nguồn ngẫu nhiên: `rng = createRng(deriveSeed(roundSeed, index))` cho **các số**, `lay = createRng(deriveSeed(roundSeed, index, 1))` cho **bố cục và trang trí**. Tách ra để chỉnh trang trí không làm đổi câu đố. `lay` không phụ thuộc độ khó, nên người chơi Thường và Khó (cùng lưới 3×3) thấy bóng ở cùng vị trí.
2. Sinh tập giá trị theo mức. Mọi bước chọn thẳng từ một tập hợp lệ đã xáo trộn, không có vòng lặp thử lại, nên luôn dừng:
   - **Mầm:** xáo [1, 18], lấy 3 số, sắp tăng dần rồi cộng lần lượt 0, 1, 2 → 3 số trong [1, 20], hai số liền kề cách nhau ≥ 2.
   - **Thường:** chọn hàng chục `t` ∈ [1, 9] và hai chữ số đơn vị khác nhau → một cặp cùng hàng chục (vd. 41 và 47); thêm 3 số từ [10, 99] đã bỏ cặp đó.
   - **Khó:** chọn số lượng số âm `k` ∈ {2, 3}. Cặp số âm cùng hàng chục: hàng chục ∈ [1, 4], hai chữ số đơn vị khác nhau (vd. −37 và −32); thêm `k − 2` số âm từ [−50, −1] đã bỏ cặp; thêm `5 − k` số từ [0, 50].
   - **Siêu khó:** cặp sát `a` và `a + d` với `a` ∈ [−15, 23], `d` ∈ {1, 2}; một số âm từ [−15, −1] khác cặp; hai số nữa từ [−15, 25] khác các số đã chọn.
3. **Siêu khó: gắn phép tính** cho đúng 2 giá trị, gồm một trong hai số của cặp sát và một trong ba số còn lại. Với giá trị `v`, các phép dùng được là:
   - `a + b = v` với `a, b` ∈ [2, 20] (cần 4 ≤ v ≤ 40);
   - `a − b = v` với `a, b` ∈ [2, 20] (cần −18 ≤ v ≤ 18; ra số âm khi b > a, vd. 4 − 9);
   - `a × b = v` với `a, b` ∈ [2, 9] (v là tích trong bảng cửu chương).

   Chọn đều một phép trong các phép dùng được (bóng thứ hai ưu tiên phép khác bóng thứ nhất nếu còn lựa chọn), rồi chọn đều cặp toán hạng. Mọi `v` trong [−15, 25] đều có ít nhất một phép, vì phép trừ phủ [−18, 18] và phép cộng phủ [4, 40]. Không có phép chia, không có toán hạng âm, mỗi bóng chỉ một phép tính.
4. Xáo thứ tự các bóng bằng `rng`, để chỉ số bóng không lộ cách sinh.
5. Dùng `lay`: xáo các ô lưới rồi lấy `n` ô đầu cho `n` bóng; xáo [0, 5] để lấy màu (các bóng trong một câu khác màu nhau); `dx`, `dy` ∈ [−2, 2]; `phase` ∈ [0, 359].
6. `order` = chỉ số các bóng sắp theo `value` tăng dần.

**Vì sao đúng một đáp án:** các giá trị đôi một khác nhau (mỗi bước chọn từ tập đã loại số trùng), nên chỉ có một cách xếp tăng dần ngặt, và `check` chỉ nhận đúng mảng `order`.

**Vì sao tất định:** chỉ dùng `createRng` và `deriveSeed`, chỉ có số nguyên, thứ tự gọi `rng` cố định, không có `Math.random()` hay `Date.now()`. Sắp xếp theo khoá không trùng cho kết quả duy nhất.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 bóng · lưới 2×3 · số 1–20, hai số bất kỳ cách nhau ≥ 2 | 3 bóng to, số nhỏ: 9 · 4 · 16 |
| Thường | 5 bóng · lưới 3×3 · số 10–99, luôn có một cặp cùng hàng chục | 47 · 82 · 41 · 19 · 65 (phải đọc cả hàng đơn vị) |
| Khó | 5 bóng · lưới 3×3 · số −50…50, 2–3 số âm, luôn có một cặp số âm cùng hàng chục | −32 · 15 · −37 · 4 · −8 (bẫy: −37 nhỏ hơn −32) |
| Siêu khó | 5 bóng · lưới 2×3 (bóng rộng) · giá trị −15…25, ≥ 1 số âm · đúng 2 bóng là phép tính (+, −, ×) · luôn có một cặp giá trị cách nhau 1–2 chứa bóng phép tính | 3 − 11 · −7 · 6 × 4 · 12 · −2 (phải tính đúng mới xếp được) |

Mỗi mức thêm đúng một thứ mới: Mầm → Thường thêm bóng và số hai chữ số, Thường → Khó thêm số âm, Khó → Siêu khó thêm phép tính. Từ Thường trở lên luôn có 5 bóng, để độ khó đến từ loại số chứ không phải từ số lần chạm.

Đo trên code, 10 000 seed mỗi mức (2026-10-12):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Số bóng (= số lần chạm) | 3 | 5 | 5 | 5 |
| Số âm trung bình mỗi câu | 0 | 0 | 2,5 | 2,4 |
| Bóng phép tính mỗi câu | 0 | 0 | 0 | 2 (≈ 66 % trừ, 23 % cộng, 12 % nhân; 46 % ra số âm) |
| Cặp dễ nhầm luôn có | — | cùng hàng chục | số âm cùng hàng chục | cách 1–2, có phép tính |
| Cặp liền kề dễ nhầm trung bình mỗi câu (định nghĩa ở mục Cân bằng) | 0,75 | 1,59 | 1,42 | 1,80 |
| Thời gian giải theo mô hình, người lớn: TB (P10–P90) | 2,81 s (2,60–3,00) | 4,92 s (4,80–5,00) | 5,60 s (5,40–5,85) | 7,12 s (6,65–7,60) |
| Trẻ 7 tuổi: TB (P10–P90) | 5,02 s (4,64–5,36) | — | — | — |

Với cùng một người lớn, khoảng P10–P90 của các mức không chồng nhau. Test kiểm điều này trên 10 000 seed mỗi mức, và kiểm thời gian trung bình lệch bảng trên không quá 0,1 s.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng: các giá trị đôi một khác nhau; `check(p, p.order)` đúng; đổi chỗ bất kỳ hai phần tử liền kề của `order`, hoặc chỉ gửi một phần đầu của `order`, đều sai.
- Đúng số bóng theo mức; mọi giá trị nằm trong phạm vi của mức.
- Mầm: hai giá trị liền kề cách nhau ≥ 2. Thường: có cặp cùng hàng chục. Khó: 2–3 số âm, có cặp số âm cùng hàng chục. Siêu khó: ≥ 1 số âm, đúng 2 bóng phép tính, có cặp cách nhau 1–2 chứa bóng phép tính.
- Bóng phép tính: `a op b === value`; `a, b` ∈ [2, 20] với + và −, ∈ [2, 9] với ×; chỉ có số nguyên, không có phép chia. Bóng `num`: `a === value` và `b === 0`.
- `slot` đôi một khác nhau và nhỏ hơn `cols × rows`; `color` đôi một khác nhau, trong [0, 5]; `dx`, `dy` ∈ [−2, 2]; `phase` ∈ [0, 359].
- Tất định: gọi lại cùng `(seed, index, difficulty)` cho kết quả giống hệt (so sâu).
- Độ khó tăng thật: thời gian trung bình theo mô hình (mục Cân bằng) tăng ngặt theo mức, và P90 của mức dưới nhỏ hơn P10 của mức trên.
- `isAnswer` từ chối: giá trị không phải mảng, mảng rỗng, mảng dài hơn 5, phần tử không phải số nguyên, âm hoặc ≥ 5, phần tử trùng nhau, mảng thưa. `isAnswer` nhận mọi `order` và mọi mảng gửi lúc chạm nhầm.
- Thường và Khó cùng `(seed, index)` có bóng ở cùng ô, cùng màu, cùng độ lệch và pha.
- Siêu khó dùng đủ cả ba phép, và có phép ra số âm (mỗi loại > 5 % số bóng phép tính).
- CR-006: `durationMs = 60 000`; hệ số điểm dương và không giảm theo mức; `speedAllowanceMs` hữu hạn, ≥ 0, tất định, đúng 1 000 / 2 000 / 2 000 / 4 000 ms.

Các điều trên được kiểm trong `number-balloons.test.ts`, 10 000 seed × 4 mức (13 test, ~2,5 s). Riêng "đúng một đáp án" được kiểm vét cạn: thử cả 3! hoặc 5! thứ tự chạm, chỉ đúng một thứ tự được `check` nhận, và đó là `order`.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi con số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm | trẻ 7 tuổi ~5,0 s (4,6–5,4) · người lớn ~2,8 s (2,6–3,0) | trẻ ~11 (~10 đúng) · người lớn ~19 (~18 đúng) |
| Thường | ~4,9 s (4,8–5,0) | ~11 (~10,5 đúng) |
| Khó | ~5,6 s (5,4–5,9) | ~10 (~9 đúng) |
| Siêu khó | ~7,1 s (6,7–7,6) | ~8 (~6,7 đúng) |

**Mô hình thời gian** (kiểu KLM, phải hiệu chỉnh sau buổi chơi thử), tính bằng tổng các khoản sau. Test cài đúng mô hình này để kiểm độ khó tăng dần.

- 0,3 s để định hướng.
- Đọc từng bóng: số một chữ số 0,25 s, hai chữ số 0,35 s, số âm thêm 0,15 s; phép cộng 1,0 s, phép nhân 0,9 s, phép trừ 1,1 s, phép trừ ra số âm 1,4 s.
- 0,35 s cho mỗi lần chạm.
- 0,2 s để tìm mỗi quả kế tiếp, tức `n − 1` lần (0,3 s nếu câu có số âm hoặc phép tính).
- 0,2 s cho mỗi cặp liền kề dễ nhầm. Cặp liền kề dễ nhầm là hai giá trị đứng cạnh nhau khi xếp tăng dần, và cách nhau ≤ 2, hoặc cùng dấu và cùng hàng chục (cả hai có ≥ 2 chữ số, vd. 41 và 47, −37 và −32).

Với trẻ 7 tuổi, nhân các khoản trên với 1,8 và tính 0,5 s để định hướng. Số câu mỗi vòng tính thêm:

- 0,25 s chuyển câu;
- tỉ lệ sai giả định: trẻ ở Mầm 10 %, người lớn ở Mầm 4 %, Thường 6 %, Khó 10 %, Siêu khó 15 %;
- mỗi câu sai mất 30–100 % thời gian giải (nhầm giữa chừng) rồi khoá 1,5 s.

Mức Thường mất ~4,9 s mỗi câu, quá khoảng 2–4 s mà GDD gợi ý. Lý do: mỗi câu gồm 5 quyết định, tức ~1 s cho một lần chạm, ngang nhịp các game một chạm.

**Vì sao vòng 60 giây** (đã duyệt 2026-10-12): với 45 giây, mức Thường chỉ được ~8 câu. 60 giây cho ~11 câu, gần mục tiêu 12–20 câu của GDD, và vẫn nằm trong khoảng 45–60 giây được phép.

**Vì sao Mầm chỉ 3 bóng** (đã duyệt 2026-10-12): trong mô phỏng bản đầu (luật điểm trước CR-006), trẻ 7 tuổi chơi Mầm 3 bóng đạt ~77 % điểm vòng của người lớn chơi Thường; với Mầm 4 bóng con số này chỉ ~53 %. Đổi lại, người lớn chọn Mầm được ~2 lần điểm mức Thường. Việc này trông vào cảnh báo "lệch" của chủ phòng (GDD §6).

### Miễn trừ thời gian cho thưởng tốc độ (CR-006, đã duyệt 2026-10-12)

**Thưởng tốc độ chung (trọn 50 khi ≤ 1,5 s, hết từ 8 s) không hợp với game này.** Riêng 5 lần chạm đã mất ~1,75 s, nên từ mức Thường trở lên không ai lấy được trọn 50 điểm. Ở Siêu khó, một câu điển hình chỉ được ~7 điểm thưởng, tức tốc độ gần như không còn ý nghĩa.

**Đã khai báo:** `speedAllowanceMs(puzzle) = 500 × (số bóng − 1) + 1 000 × (số bóng phép tính)`. Server trừ khoản này khỏi thời gian trả lời trước khi tính thưởng (`gameSpeedAllowanceMs` trong `scoring.ts`).

- Hàm chỉ đọc câu đố, nên luôn tất định, hữu hạn và ≥ 0. Test kiểm điều này trên 10 000 seed mỗi mức.
- Số bóng và số phép tính cố định theo mức, nên miễn trừ thực chất là một hằng số cho mỗi mức.
- 500 ms cho mỗi lần chạm thêm bù đủ thời gian chạm tối thiểu (0,35 s mỗi lần theo mô hình), nhưng chưa bù hết thời gian tìm quả kế tiếp, để người nhanh vẫn hơn người chậm.

| Mức | Miễn trừ | Khung thưởng sau miễn trừ (trọn → hết) | Thưởng cho câu điển hình: khung chung → có miễn trừ |
| --- | --- | --- | --- |
| Mầm | 1 000 ms | 2,5 s → 9 s | trẻ 23 → 31 · người lớn 40 → 48 |
| Thường | 2 000 ms | 3,5 s → 10 s | 24 → 39 |
| Khó | 2 000 ms | 3,5 s → 10 s | 19 → 34 |
| Siêu khó | 4 000 ms | 5,5 s → 12 s | 7 → 38 |

Thưởng trung bình mỗi câu đúng trong mô phỏng: trẻ ở Mầm 29, người lớn ở Mầm 46, Thường 37, Khó 32, Siêu khó 36. Trước CR-006 lần lượt là 21, 38, 22, 17, 7. Miễn trừ làm thưởng tốc độ có ý nghĩa trở lại ở mọi mức; việc cân điểm giữa các mức là của hệ số điểm ở mục kế tiếp.

### Hệ số điểm (CR-006, đã duyệt 2026-10-12)

**Đã khai báo:** `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.35, 3: 2 }`, tức Mầm × 1 · Thường × 1 · Khó × 1,35 · Siêu khó × 2.

Mục tiêu của CR-006: người chơi đúng sức ở mỗi mức được điểm vòng xấp xỉ người lớn ở Thường. Cách tính:

1. Từ thời gian giải ở bảng đầu mục, tính `T` = thời gian cho mỗi câu đúng = 60 s ÷ số câu đúng mỗi vòng. `T` đã gồm chuyển câu, câu sai và khoá.
2. Điểm mỗi giây là `(100 × hệ số + B) × K ÷ T`, với `B` là thưởng tốc độ trung bình mỗi câu đúng (sau miễn trừ) và `K` là hệ số combo trung bình (trần × 1,5). Cho điểm mỗi giây bằng của Thường, suy ra:

   `hệ số = [ (T ÷ T_Thường) × (100 + B_Thường) × (K_Thường ÷ K) − B ] ÷ 100`

3. Làm tròn tới 0,05, rồi giữ điều kiện **hệ số không giảm theo mức**.

| Mức | Người chơi | Tỉ lệ sai giả định | `T` | `B` | `K` | Theo công thức | Đã chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 10 % | 6,06 s (1,06 × Thường) | 29 | 1,22 | 1,22 | **1** (không cao hơn Thường) |
| Thường | người lớn | 6 % | 5,70 s | 37 | 1,26 | 1 | **1** |
| Khó | người lớn | 10 % | 6,73 s (1,18 ×) | 32 | 1,21 | 1,37 | **1,35** |
| Siêu khó | người lớn | 15 % | 8,98 s (1,58 ×) | 36 | 1,14 | 2,02 | **2** |

`T`, `B`, `K` lấy từ mô phỏng 4 000 vòng cho mỗi người chơi: câu đố sinh bằng chính `generate()`, thời gian theo mô hình cộng nhiễu ±25 %, điểm tính như `scoring.ts` sau CR-006 (miễn trừ, trần combo × 1,5).

- **Vì sao hệ số lớn hơn tỉ lệ thời gian** (Khó 1,18 → 1,35; Siêu khó 1,58 → 2): hệ số chỉ nhân 100 điểm gốc, không nhân thưởng tốc độ. Mức cao lại sai nhiều hơn, nên chuỗi đúng ngắn hơn và combo thấp hơn.
- **Vì sao Mầm giữ × 1 thay vì 1,2** (PM chốt chung cho 5 game, 2026-10-12): màn hướng dẫn hiện hệ số từng mức. Nếu Mầm cao hơn Thường, người lớn có lý do rõ ràng để chọn Mầm: điểm người lớn ở Mầm lên ~224 % thay vì ~197 %. Đổi lại, trẻ ở Mầm chỉ đạt ~86 % thay vì ~99 %.

Điểm vòng mô phỏng (vòng 60 s; % so với người lớn ở Thường cùng luật):

| Người chơi | Luật cũ (hệ số chung, combo không trần, không miễn trừ) | CR-006 với hệ số chung 0,8 / 1 / 1,25 / 1,5 | CR-006 với hệ số của game (đã chọn) |
| --- | --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | ~1 260 (75 %) | ~1 320 (72 %) | ~1 560 (86 %) |
| Người lớn ở Mầm | ~3 490 (207 %) | ~3 080 (170 %) | ~3 570 (197 %) |
| Người lớn ở Thường | ~1 690 (100 %) | ~1 820 (100 %) | ~1 820 (100 %) |
| Người lớn ở Khó | ~1 560 (92 %) | ~1 690 (93 %) | ~1 800 (99 %) |
| Người lớn ở Siêu khó | ~1 200 (71 %) | ~1 420 (78 %) | ~1 800 (99 %) |

- **Độ nhạy:** nếu tỉ lệ sai thật ở Khó / Siêu khó là 7 % / 10 %, hai mức này được ~104 % / ~107 %; nếu là 13 % / 20 % thì được ~94 % / ~92 %.
- Người lớn chọn Mầm vẫn được ~2 lần điểm mức Thường. Không công thức nào chặn được việc này; phần đó do chủ phòng giám sát (nút Nhắc, GDD §6).
- **Chỉnh sau buổi chơi thử:** đo tỉ lệ sai và số câu đúng mỗi vòng ở từng mức, thay vào bảng trên rồi tính lại theo công thức. Chỉ đổi số trong `difficultyMultiplier`; test chỉ kiểm hệ số dương và không giảm theo mức.

## Ghi chú cho FE

### Dữ liệu câu đố và đáp án

Scene gọi `numberBalloons.generate(bridge.seed, index, bridge.difficulty)` như mọi game, rồi vẽ theo `NumberBalloonsPuzzle` (hình dạng ở mục [Câu đố & đáp án](#câu-đố--đáp-án); kiểu `Balloon`, `BalloonKind` export từ `@brain-rizz/shared`). Scene không cần đọc logic sinh câu.

| Trường | Scene dùng để |
| --- | --- |
| `cols`, `rows` | chọn lưới: Mầm và Siêu khó 2 × 3, Thường và Khó 3 × 3. Ô `slot` nằm ở cột `slot % cols`, hàng `Math.floor(slot / cols)` |
| `balloons[i].kind` | `"num"`: vẽ số `value`. `"add"` / `"sub"` / `"mul"`: vẽ `a`, ký hiệu `+` / `−` / `×`, rồi `b` |
| `balloons[i].a`, `b` | toán hạng, luôn dương: + và − trong [2, 20], × trong [2, 9]. Bóng `"num"` có `a = value`, `b = 0` |
| `balloons[i].value` | số bay vào khay khi nổ đúng; "= value" khi hiện đáp án đúng. Số âm phải vẽ bằng "−" (U+2212), không dùng `String(value)` vì ra gạch ngắn "-" |
| `balloons[i].color` | chỉ số trong mảng 6 màu của scene; không mang nghĩa |
| `balloons[i].dx`, `dy`, `phase` | độ lệch tĩnh (× 6 px) và nhịp lắc |
| `order` | thứ tự đúng: lần chạm thứ `k` (đếm từ 0) đúng khi chạm bóng `order[k]` |

**Đáp án** (`NumberBalloonsAnswer = number[]`): mảng chỉ số bóng (vị trí trong `balloons`) theo thứ tự đã chạm, gửi **đúng một lần** mỗi câu.

- Nổ hết đúng thứ tự: gửi mảng đủ `balloons.length` phần tử, tức bằng `order`.
- Chạm nhầm: gửi ngay mảng tính tới và gồm cả quả nhầm, vd. `[order[0], order[1], i]`.
- `isAnswer` từ chối mảng có phần tử trùng hoặc dài hơn 5. Bóng đã nổ phải tắt vùng chạm, để không bao giờ gửi một chỉ số hai lần.

### Bố cục (khung 720×1280, px thiết kế)

Đồng hồ, điểm và dải điểm đối thủ do `PlayScreen` vẽ ngoài khung, nên cả khung dành cho game.

| Vùng | Toạ độ | Nội dung |
| --- | --- | --- |
| Gợi ý luật | y 24–80, giữa | biểu tượng "nhỏ → lớn" không chữ (vd. ba bóng nhỏ to dần kèm mũi tên phấn), cao ~56 px |
| Khay thứ tự | y 96–192, giữa | `n` ô 96 × 96, cách nhau 16 px. 5 ô rộng 544 px, tâm ô x = 136, 248, 360, 472, 584; 3 ô có tâm x = 248, 360, 472. Ô trống viền nét đứt; ô đã có số là thẻ giấy, chữ 48 px |
| Sân bóng | x 24–696, y 216–1254 | lưới 3 hàng, mỗi hàng cao 346 px. Lưới 2×3: ô 336 × 346, tâm x = 192, 528. Lưới 3×3: ô 224 × 346, tâm x = 136, 360, 584. Tâm hàng y = 389, 735, 1081 |
| Lề dưới | y 1254–1280 | để trống |

### Bóng và vùng chạm

| Lưới (mức) | Thân bóng rộng × cao | Dây | Cỡ số |
| --- | --- | --- | --- |
| 2×3 (Mầm) | 210 × 232 | 52 | 96 px |
| 3×3 (Thường, Khó) | 176 × 208 | 52 | 72 px |
| 2×3 (Siêu khó) | 264 × 220 | 52 | số đơn 72 px, phép tính 56 px |

- **Vùng chạm là cả ô lưới chứa bóng, và đứng yên.** Ô nhỏ nhất 224 × 346 px; ở tỉ lệ thu nhỏ ~0,31 của điện thoại nhỏ vẫn ≈ 70 × 108 px thật, ≥ 48 px. Ô trống, bóng đã nổ, và mọi ô trong lúc khoá đều không nhận chạm; chạm vào đó không tính là sai.
- **Vị trí tất định:** ô, màu, độ lệch, pha đều lấy từ puzzle; scene không tự random vị trí (mảnh vỡ trang trí thì được). Mọi người cùng mức thấy câu giống hệt nhau.
- **Lắc lư nhẹ:**
  - Lên xuống ±10 px, đung đưa ngang ±6 px, nghiêng ±3°.
  - Chu kỳ 2,6–3,4 s, lệch nhịp theo `phase` (gợi ý: `2600 + (phase mod 9) × 100` ms).
  - Độ lệch tĩnh khỏi tâm ô bằng `dx`, `dy` × 6 px.
  - Cộng hết các khoản trên, bóng vẫn nằm trong ô và cách mép ô ≥ 6 px, nên không bao giờ chồng nhau. Vùng chạm không di chuyển, nên lắc lư không làm khó chạm.
  - Khi bật giảm chuyển động (`prefers-reduced-motion`), bóng đứng yên.
- **Màu và chữ:**
  - Chữ số dùng Baloo 2 ExtraBold, các chữ số rộng bằng nhau. Chờ font tải xong mới vẽ câu đầu.
  - Chữ màu mực đậm trên thân bóng màu nhạt, hoặc chữ trắng viền mực dày; tương phản ≥ 4,5:1.
  - Bóng có viền mực để nổi trên cả nền sáng lẫn tối (canvas trong suốt). Ô khay, huy hiệu, dấu ✗ và vòng nét đứt cũng phải có nền riêng (thẻ giấy) hoặc lấy màu theo token giao diện lúc tạo scene, vì nét mực không nổi trên nền tối.
  - 6 màu bóng chỉ để vui mắt, không mang nghĩa. ui-designer chốt bảng màu, FE giữ mảng màu trong scene.
  - Dấu trừ là "−" dài, đậm bằng nét chữ số, không dùng gạch ngắn "-". Phép nhân dùng "×", không dùng chữ "x".

### Trạng thái

| Trạng thái | Hình | Thời lượng |
| --- | --- | --- |
| Hiện câu | bóng phồng lên (0,6 → 1, ease-out-back); khay có `n` ô trống. **Chạm được ngay**, không chờ hiệu ứng | ≤ 200 ms |
| Đang chạm: chạm đúng | bóng phồng 1 → 1,2 rồi vỡ thành 8–10 mảnh cùng màu, kèm vòng "bụp" nét phấn. Số bay vào ô kế tiếp của khay (bóng phép tính thì bay **kết quả**). Dây rơi và mờ dần; ô đó tắt vùng chạm. Hiệu ứng chạy song song, không chặn lần chạm tiếp | nổ ≤ 250 ms, số bay ≤ 250 ms |
| Đúng cả câu | quả cuối nổ, khay nảy nhẹ, hiện dấu ✓ phấn. Gửi đáp án ngay lúc chạm quả cuối | câu mới sau ≤ 300 ms |
| Sai → khoá | xem mô tả ngay dưới bảng | rung 200 ms; khoá 1 500 ms (`WRONG_ANSWER_LOCK_MS`) rồi sang câu mới |
| Hết giờ giữa câu | ngừng nhận chạm, không gửi gì | — |
| Nối lại giữa vòng | bắt đầu từ `bridge.startIndex`; câu đang làm dở chơi lại từ đầu | — |

Khi chạm sai ở lần chạm thứ `k` (đếm từ 0, tức đã nổ đúng `k` quả), scene làm các việc sau:

- Gửi đáp án ngay (mảng `k + 1` phần tử, phần tử cuối là quả nhầm).
- Quả vừa chạm rung ngang và có dấu ✗ phấn.
- Các bóng còn lại ngừng lắc và mờ còn 60 %.
- **Hiện thứ tự đúng**, trong suốt 1,5 s khoá (`WRONG_ANSWER_LOCK_MS`). Mọi dữ liệu đã có trong puzzle, không cần chờ server trả `answer-result`:
  - Quả lẽ ra phải chạm là bóng `order[k]`: khoanh vòng phấn nét đứt và nhịp nhẹ.
  - Mỗi bóng còn trên sân `order[j]` (j ≥ k), kể cả quả nhầm, có huy hiệu số `j + 1`. Số đánh tiếp sau số ô đã đầy trong khay (đã nổ 2 quả thì huy hiệu bắt đầu từ ③).
  - Bóng phép tính hiện thêm "= `value`" dưới biểu thức (40 px).
- Khay hiện hình ổ khoá; không nhận chạm cho tới câu mới. Hết 1,5 s thì sang câu `index + 1` như mọi game.

Các quy tắc khác:

- **Có hiện thứ tự đúng khi sai.** Người chơi hiểu vì sao sai (nhất là với số âm và phép tính), và 1,5 s khoá vốn bỏ không được dùng vào việc có ích. Việc này không lộ gì về câu sau.
- **Đã chạm và chưa chạm phân biệt không bằng màu:** bóng đã chạm biến mất (chỉ còn ô trống) và số của nó nằm trong khay. Quả nhầm có dấu ✗, quả đúng lẽ ra có vòng nét đứt, thứ tự đúng hiện bằng huy hiệu số.
- **Chấm ở client** để phản hồi tức thì (như Kẻ lạc đàn): lần chạm thứ `k` đúng khi chỉ số bóng bằng `order[k]`. Xử lý chạm tuần tự theo thứ tự sự kiện. Sau lần chạm sai, bỏ qua mọi chạm cho tới câu mới, kể cả chạm nhiều ngón.
- Trên máy tính: con trỏ bàn tay khi rê vào ô có bóng, và bóng phóng to nhẹ (1,03).

### Hiệu ứng & âm thanh

| Sự kiện | Hình | Âm (GĐ 2) |
| --- | --- | --- |
| Bóng hiện | phồng lên | "phù" nhẹ (tuỳ chọn) |
| Nổ đúng | vỡ mảnh + vòng phấn, ≤ 250 ms | "bụp" giòn, **cao dần theo từng quả trong câu** (Đô, Rê, Mi, Son, La), để nghe cũng thấy "tăng dần" |
| Đúng cả câu | khay nảy + ✓ | "ting" cao dần theo combo (GDD §9) |
| Chạm sai | rung + ✗ + hiện thứ tự đúng | tiếng xì hơi + "bụp" trầm; rung máy ngắn (GĐ 2) |

Khi giảm chuyển động: bỏ lắc lư và rung; nổ thay bằng mờ nhanh ≤ 150 ms; vòng nét đứt đứng yên.

### Ví dụ để vẽ bản mẫu

Ô đánh số theo hàng từ góc trên trái: lưới 2×3 là `0 1 / 2 3 / 4 5`, lưới 3×3 là `0 1 2 / 3 4 5 / 6 7 8`. Nếu vẽ ở khung 360×640 thì chia đôi mọi toạ độ.

| Khung | Mức | Dữ liệu | Thứ tự đúng | Trạng thái cần vẽ |
| --- | --- | --- | --- | --- |
| A | Mầm (2×3) | ô 1: 9 · ô 2: 4 · ô 5: 16 (ô 0, 3, 4 trống) | 4 → 9 → 16 | vừa hiện câu, khay 3 ô trống |
| B | Thường (3×3) | ô 0: 47 · ô 2: 82 · ô 4: 41 · ô 6: 19 · ô 7: 65 | 19 → 41 → 47 → 65 → 82 | đang chạm: 19 và 41 đã nổ (ô 6 và ô 4 trống), khay `19 · 41 · _ · _ · _`, ngón tay sắp chạm 47 |
| C | Khó (3×3) | ô 1: −32 · ô 3: 15 · ô 5: −37 · ô 6: 4 · ô 8: −8 | −37 → −32 → −8 → 4 → 15 | sai, khoá: người chơi chạm −8 đầu tiên. ✗ trên −8, vòng nét đứt quanh −37, huy hiệu ① −37, ② −32, ③ −8, ④ 4, ⑤ 15; khay trống, có ổ khoá |
| D | Siêu khó (2×3) | ô 0: 3 − 11 · ô 1: −7 · ô 2: 6 × 4 · ô 4: 12 · ô 5: −2 (ô 3 trống) | 3 − 11 (= −8) → −7 → −2 → 12 → 6 × 4 (= 24) | vừa hiện câu |
| D′ | Siêu khó | như D | như D | sai, khoá: người chơi chạm −7 trước. ✗ trên −7, vòng nét đứt quanh "3 − 11" kèm "= −8", "6 × 4" kèm "= 24", huy hiệu ①–⑤ |
| E | Thường | như B | như B | đúng cả câu: khay đầy `19 · 41 · 47 · 65 · 82` kèm ✓, sân trống |

Mỗi khung vẽ cả bản giao diện sáng và tối, để kiểm bóng và khay nổi rõ trên cả hai nền.

## Ghi chú cho BE

- Không có pha trình chiếu: câu hiện ra là chạm được ngay, giữ cách tính thời gian hiện tại.
- Đáp án là mảng tối đa 5 số nguyên. `AnswerSchema.answer` đang là `unknown` nên mảng đi qua được; `isAnswer` kiểm chặt. Server không cần biết sai ở bước nào: mảng thiếu hoặc lệch thứ tự đều là sai, khoá 1,5 s như mọi game. Mỗi câu chỉ một tin nhắn, nên giới hạn 10 đáp án/giây không ảnh hưởng. Không đổi giao thức.
- `durationMs = 60_000`: server đã dùng `game.durationMs`, không phải sửa.
- **CR-006 (đã duyệt 2026-10-12), game đã khai báo hai trường tuỳ chọn của `MinigameDef`:**
  - `speedAllowanceMs(puzzle)` = `500 × (số bóng − 1) + 1 000 × (số bóng phép tính)`, tức 1 000 / 2 000 / 2 000 / 4 000 ms cho Mầm / Thường / Khó / Siêu khó. Hàm không dùng tham số `difficulty`. Server gọi qua `gameSpeedAllowanceMs` với puzzle **tự sinh lại**, không dùng dữ liệu client gửi.
  - `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.35, 3: 2 }`, đọc qua `gameMultiplier`. Cách tính ở mục [Hệ số điểm](#hệ-số-điểm-cr-006-đã-duyệt-2026-10-12).

## Đối chiếu quy tắc thiết kế (GDD §5)

| Quy tắc | Đạt? | Vì sao |
| --- | --- | --- |
| Hiểu trong ≤ 5 giây với một câu + hình | Có | "Nổ bóng từ nhỏ đến lớn" + hình có mũi tên nối theo thứ tự |
| Một câu giải trong 1–8 giây ở mức Thường | Có | ~4,9 s (4,8–5,0 s theo mô hình) |
| Đúng một đáp án, kiểm được bằng máy | Có | giá trị đôi một khác nhau → thứ tự tăng dần duy nhất; test 10 000 seed |
| Chỉ số nguyên + `createRng()` | Có | không có phép chia, không cần dữ liệu ngoài |
| Bốn mức khác rõ; Mầm hợp trẻ 7 tuổi | Có | mỗi mức thêm một thứ mới; Mầm 3 bóng, số ≤ 20, cách nhau ≥ 2 |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Có | vùng chạm là cả ô, ≥ 224 × 346 px thiết kế, đứng yên |
| Không phụ thuộc chữ | Có | trên màn chơi chỉ có chữ số và ký hiệu toán |
| Không chỉ phân biệt bằng màu | Có | đã nổ = biến mất + vào khay; sai = ✗; màu bóng không mang nghĩa |

## Quyết định đã duyệt

Chủ dự án duyệt toàn bộ đề xuất của đặc tả ngày **2026-10-12**, đúng như đã viết:

1. Thời gian miễn trừ cho thưởng tốc độ, gộp với `revealMs` của Theo dấu ánh đèn thành một trường chung `speedAllowanceMs` ([CR-006](../00-tracking/change-requests.md#cr-006)). Đã khai báo 1 000 / 2 000 / 2 000 / 4 000 ms.
2. Vòng 60 giây thay vì 45 giây (CR-006). Đã khai báo `durationMs = 60_000`.
3. Mầm 3 bóng (trẻ em đua được với người lớn), không phải 4 bóng.
4. Giữ phép nhân ở Siêu khó (~12 % số bóng phép tính), cùng phép cộng và phép trừ.
5. Nhầm ở quả thứ 4 trên 5 vẫn mất cả câu (luật chung, không có điểm một phần).
6. Hiện thứ tự đúng trong 1,5 s khoá khi trả lời sai (CR-006, mục 4).

Hệ số điểm riêng của game (CR-006, mục 2), tính ngày 2026-10-12: Mầm × 1 · Thường × 1 · Khó × 1,35 · Siêu khó × 2. Con số chốt sau buổi chơi thử đủ 5 game MVP.

- **PM chốt chung cho cả 5 game (2026-10-12): hệ số Mầm = 1, ngang Thường**, dù mô phỏng trẻ 7 tuổi ra cao hơn (game này: 1,2). Lý do: hệ số không giảm khi lên mức, và người lớn chọn Mầm không được thêm lợi.
- Thường, Khó, Siêu khó tính từ mô phỏng như mục [Hệ số điểm](#hệ-số-điểm-cr-006-đã-duyệt-2026-10-12).
- Mô phỏng dùng đúng cách server đã cài:
  - thời gian tính thưởng = max(0, `answerMs` − miễn trừ), kẹp vào khung 1,5–8 s;
  - combo có trần × 1,5, đạt từ câu đúng liên tiếp thứ 7.

## Câu hỏi mở

Không còn.
