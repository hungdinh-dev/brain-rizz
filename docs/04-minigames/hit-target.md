# Chạm đích (`hit-target`)

- Nhóm: Tính toán (`compute`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006, giữ nguyên; lý do ở mục [Cân bằng](#cân-bằng))
- File: `packages/shared/src/games/hit-target/` (logic + test), `apps/web/src/games/hit-target/` (scene + chữ hiển thị)
- Bản mẫu (đã duyệt): [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M6**: artboard `HitTargetMobile`, `HitTargetLevels`, `HitTargetStates`, `HitTargetHowTo`
- Trạng thái:
  - Đặc tả và bộ sinh câu đố xong ngày 2026-10-14. Mọi số liệu "đo" trong đặc tả lấy từ chính code, 10 000 seed mỗi mức.
  - Scene web, màn hướng dẫn và chữ hiển thị đã làm theo bản mẫu (2026-10-14); chờ chơi thử để chốt hệ số điểm.

## Cách chơi

Giữa bảng là một hồng tâm ghi **số đích**, bên dưới là lưới thẻ số. Chạm các thẻ có tổng bằng số đích. Khay có sẵn 2 hoặc 3 ô: chọn đủ là tự nộp, không có nút Xong. Chạm lại thẻ đã chọn để bỏ chọn.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn số đích trong hồng tâm
  2. Chạm các thẻ cộng lại bằng đích
  3. Chạm lại thẻ để bỏ chọn
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ:** theo artboard `HitTargetHowTo` (560×360). Hồng tâm ghi 10 ở trên. Hàng dưới có 4 thẻ 3, 5, 9, 7. Thẻ 3 đã chọn: lún xuống và khoanh phấn vàng. Ngón tay đang chạm thẻ 7, quanh thẻ có tia phấn. Hai mũi tên phấn nét đứt đi từ thẻ 3 và thẻ 7 lên hồng tâm, giữa hai mũi tên có dấu cộng.
- **Câu nhắc lúc đếm ngược:** "Cộng thẻ cho trúng đích!"
- **Câu nhắc theo mức:**
  - Mầm: "Chọn 2 thẻ cộng bằng đích" (Mầm chọn 2 thẻ, mức khác chọn 3).
  - Siêu khó: "Đáp án có đúng một thẻ âm". Đây là luật riêng của mức, người chơi cần biết để tìm nhanh.
  - Thường và Khó dùng câu nhắc chung.

Gợi ý câu `howTo` cho `locales.ts`: "Chạm các thẻ có tổng bằng số đích."

## Câu đố & đáp án

Đúng như code (`hit-target.ts`, export qua `@brain-rizz/shared`):

```ts
interface HitTargetPuzzle {
  target: number;   // số đích, nguyên dương
  cards: number[];  // giá trị thẻ theo hàng từ góc trên trái; số nguyên, đôi một khác nhau, không có 0
  cols: number;     // Mầm 2 (lưới 2×3), mức khác 3 (lưới 3×3)
  pick: number;     // số thẻ phải chọn = số ô của khay: Mầm 2, mức khác 3
  answer: number[]; // chỉ số các thẻ đáp án, tăng dần: bộ `pick` thẻ DUY NHẤT có tổng = target
}

type HitTargetAnswer = number[]; // chỉ số `pick` thẻ đã chọn, thứ tự bất kỳ
```

- Client gửi đáp án **đúng một lần** mỗi câu, ngay khi khay đủ `pick` thẻ.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer` có đúng `pick` phần tử và, sau khi sắp tăng dần, trùng `puzzle.answer`. Thứ tự chạm không quan trọng. Mảng có phần tử trùng luôn sai.
- `isAnswer(value)`: mảng 2–3 phần tử, mỗi phần tử là số nguyên 0–8, không trùng nhau. Từ chối mọi thứ khác: không phải mảng, mảng rỗng, mảng thưa, số thực, `NaN`, vô cực, chuỗi, `bigint`, mảng lồng. Mọi bộ `pick` thẻ client có thể gửi đều qua `isAnswer`, để bộ sai được server chấm sai và khoá 1,5 s chứ không bị bỏ qua.

## Cách sinh câu đố

`rng = createRng(deriveSeed(roundSeed, index))`. Chỉ có số nguyên, mọi bước đều tất định.

1. **Chọn bộ đáp án:** chọn đều một bộ trong danh sách mọi bộ hợp lệ của mức. Danh sách là hằng số, tính một lần:
   - Mầm: mọi cặp khác nhau trong 1–9 có tổng 5–17.
   - Thường: mọi bộ 3 số khác nhau trong 2–20 có tổng 20–50.
   - Khó: mọi bộ 3 số khác nhau trong 11–60 có tổng 60–150.
   - Siêu khó: một số âm trong −30…−2 cộng hai số dương khác nhau trong 2–45, tổng 10–60.

   Vì chọn đều theo bộ, số đích ở giữa khoảng xuất hiện nhiều hơn ở hai đầu: có nhiều bộ ra 34 hơn ra 20.
2. **Số đích** = tổng bộ đáp án.
3. **Thêm thẻ mồi** cho đủ 6 hoặc 9 thẻ. Rút dần các giá trị được phép theo thứ tự ngẫu nhiên (Fisher–Yates từng bước). Thẻ `x` chỉ được nhận nếu:
   - `x` chưa có trên sân;
   - `x` không tạo thêm bộ nào ra đích: chọn 2 thì `đích − x` chưa có trên sân; chọn 3 thì `đích − x` không phải tổng của hai thẻ đã có;
   - Siêu khó: đủ đúng 2 thẻ mồi âm (−30…−2) và 4 thẻ mồi dương (2–45).

   Mỗi bộ mới sinh ra khi thêm `x` đều chứa `x`, nên kiểm như trên là đủ: **sân luôn có đúng một bộ ra đích.** Rút hết mà chưa đủ thẻ thì lần thử này hỏng.
4. **Bỏ sân quá dễ đoán** (mức chọn 3): đáp án là 3 thẻ lớn nhất hoặc 3 thẻ nhỏ nhất trên sân.
5. **Giữ sân có công sức tìm kiếm trong khoảng của mức** (bảng Độ khó). Công sức là số phép thử dự kiến của người chơi theo cách tìm sau:
   - **Chọn 2:** xét từng thẻ `x` theo thứ tự ngẫu nhiên, tính `đích − x` rồi tìm trên sân. Phép thử không tính nếu `đích − x` nằm ngoài khoảng nhỏ nhất…lớn nhất của các thẻ còn lại (thấy ngay là không có).
   - **Chọn 3:** lấy từng thẻ "neo" `a` theo thứ tự ngẫu nhiên, phần còn lại `R = đích − a`.
     - Nếu `R` nhỏ hơn tổng hai thẻ nhỏ nhất, hoặc lớn hơn tổng hai thẻ lớn nhất của các thẻ kia, thì bỏ neo ngay (không tính).
     - Ngược lại tính 1 phép cho neo, rồi xét từng thẻ `b` theo thứ tự ngẫu nhiên: tính 1 phép nếu `R − b` nằm trong khoảng nhỏ nhất…lớn nhất của các thẻ kia.
     - Neo sai phải xét hết các `b` mới biết là sai; neo đúng dừng ở thẻ đúng đầu tiên.
   - **Siêu khó:** người chơi biết đáp án có đúng một thẻ âm, nên neo chỉ là 3 thẻ âm và `b` chỉ là 6 thẻ dương.
   - Công sức là kỳ vọng chính xác, không mô phỏng: một phần tử sai đứng trước mọi phần tử đúng trong thứ tự ngẫu nhiên với xác suất 1 / (số phần tử đúng + 1).

   Lặp bước 1–5 tới khi được sân trong khoảng, tối đa 400 lần. Hết lượt thì lấy sân hợp lệ gần khoảng nhất đã gặp; nếu không có sân hợp lệ nào thì dùng sân dự phòng cố định (chính ví dụ trong bản mẫu, đã kiểm có đúng một đáp án). Đo trên 40 000 seed mỗi mức:

   | | Mầm | Thường | Khó | Siêu khó |
   | --- | --- | --- | --- | --- |
   | Số lần thử trung bình | 1 | 11,3 | 18,5 | 7,6 |
   | Số lần thử nhiều nhất | 1 | 120 | 196 | 72 |
   | Câu phải dùng sân ngoài khoảng hoặc sân dự phòng | 0 | 0 | 0 | 0 |

   Một câu sinh mất ~0,1 ms (Thường) đến ~0,2 ms (Khó) trên máy phát triển.
6. **Xáo vị trí** 6 hoặc 9 thẻ, để thẻ đáp án rải đều trên lưới. `answer` là chỉ số thẻ đáp án sau khi xáo, sắp tăng dần.

**Vì sao đúng một đáp án:** xem bước 3. Test kiểm vét cạn mọi bộ `pick` thẻ (15 cặp hoặc 84 bộ ba) trên 10 000 seed mỗi mức.

**Vì sao tất định:** chỉ dùng `createRng` và `deriveSeed`, chỉ có số nguyên, thứ tự gọi `rng` cố định, không có `Math.random()` hay `Date.now()`. Công sức tìm kiếm tính bằng số thực nhưng chỉ dùng để so với khoảng: cùng phép tính cho cùng kết quả trên mọi trình duyệt và Node.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 6 thẻ (lưới 2×3) · chọn 2 · số 1–9 · đích 5–17 | 13 ← 6 · 9 / 2 · 8 / 4 · 3 (đáp án 9 + 4) |
| Thường | 9 thẻ (3×3) · chọn 3 · số 2–20 · đích 20–50 · công sức 3–4,5 | 31 ← 7 · 12 · 18 / 16 · 9 · 5 / 14 · 20 · 11 (12 + 14 + 5) |
| Khó | 9 thẻ · chọn 3 · số 11–60 (đều hai chữ số) · đích 60–150 · công sức 4,75–5,75 | 112 ← 23 · 47 · 19 / 52 · 31 · 38 / 44 · 26 · 27 (47 + 38 + 27) |
| Siêu khó | 9 thẻ · chọn 3 · 3 thẻ âm −30…−2 và 6 thẻ dương 2–45 · đáp án có đúng 1 thẻ âm · đích 10–60 · công sức 6–6,75 | 28 ← 34 · −9 · 17 / 8 · 41 · −6 / 22 · 2 · −15 (41 + 2 − 15) |

Mỗi mức thêm một thứ mới: Mầm → Thường thêm thẻ (6 → 9), chọn 3 và số hai chữ số; Thường → Khó mọi thẻ hai chữ số và đích thường có ba chữ số; Khó → Siêu khó thêm số âm. Khoảng công sức tăng theo mức để thời gian giải tăng đều.

Đo trên code, 10 000 seed mỗi mức (2026-10-14):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Số đích P10 / P50 / P90 | 6 / 10 / 15 | 22 / 37 / 48 | 66 / 103 / 144 | 14 / 34 / 53 |
| Công sức tìm kiếm P10 / P50 / P90 (phép thử) | 1,3 / 1,7 / 2,3 | 3,3 / 3,9 / 4,4 | 4,8 / 4,9 / 5,4 | 6,0 / 6,3 / 6,7 |
| Bộ "suýt đúng" (tổng lệch đích 1–2) trung bình mỗi câu | 4,7 | 4,5 | 2,1 | 3,6 |
| Đáp án nằm trong `pick + 1` thẻ lớn nhất hoặc nhỏ nhất | 44 % | 42 % | 15 % | 0 % |
| Thời gian giải theo mô hình, người lớn: TB (P10–P90) | 2,92 s (2,53–3,42) | 5,23 s (4,76–5,55) | 6,01 s (5,66–6,42) | 6,84 s (6,53–7,11) |
| Trẻ 7 tuổi: TB (P10–P90) | 5,21 s (4,52–6,11) | — | — | — |

Với cùng một người lớn, khoảng P10–P90 của các mức không chồng nhau. Test kiểm điều này trên 10 000 seed mỗi mức, và kiểm thời gian trung bình lệch bảng trên không quá 0,1 s.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một bộ `pick` thẻ có tổng bằng đích, và đó là `answer`. `check` nhận bộ đó theo mọi thứ tự, và từ chối mọi bộ `pick` thẻ khác, mảng thiếu, mảng thừa, mảng có phần tử trùng.
- Đúng số thẻ, số cột, `pick` theo mức. Các thẻ đôi một khác giá trị, không có 0, nằm trong phạm vi của mức. Số đích nằm trong khoảng của mức.
- Siêu khó: đúng 3 thẻ âm (−30…−2), 6 thẻ dương (2–45), đáp án có đúng 1 thẻ âm. Mức khác không có thẻ âm.
- Mức chọn 3: đáp án không bao giờ là 3 thẻ lớn nhất hay 3 thẻ nhỏ nhất.
- Thẻ đáp án rải đều trên lưới: tần suất mỗi ô lệch dưới 15 % so với chia đều.
- Tất định: gọi lại cùng `(seed, index, difficulty)` cho kết quả giống hệt; seed khác hoặc chỉ số câu khác cho câu khác.
- Độ khó tăng thật: thời gian trung bình theo mô hình (mục Cân bằng) tăng ngặt theo mức, và P90 của mức dưới nhỏ hơn P10 của mức trên. Mỗi mức thêm một thứ mới như bảng trên.
- `isAnswer` từ chối dữ liệu rác (liệt kê ở mục Câu đố & đáp án) và nhận mọi bộ `pick` thẻ hợp lệ.
- CR-006: `durationMs = 60 000`; hệ số điểm dương, không giảm theo mức; `speedAllowanceMs` hữu hạn, ≥ 0, đúng 500 / 1 000 / 1 000 / 1 000 ms.

Các điều trên được kiểm trong `hit-target.test.ts`, 10 000 seed × 4 mức (12 test, ~9 s, phần lớn là sinh 40 000 câu hai lần cho test tất định).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi con số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm | trẻ 7 tuổi ~5,2 s (4,5–6,1) · người lớn ~2,9 s (2,5–3,4) | trẻ ~10,6 (~9,5 đúng) · người lớn ~18 (~17,7 đúng) |
| Thường | ~5,2 s (4,8–5,6) | ~10,5 (~9,9 đúng) |
| Khó | ~6,0 s (5,7–6,4) | ~9,2 (~8,5 đúng) |
| Siêu khó | ~6,8 s (6,5–7,1) | ~8,2 (~7,2 đúng) |

**Mô hình thời gian** (kiểu KLM, phải hiệu chỉnh sau buổi chơi thử). Test cài đúng mô hình này. Thời gian là tổng các khoản sau:

- 0,3 s định hướng; đọc số đích 0,3 s (0,4 s nếu ba chữ số); lướt mỗi thẻ 0,1 s (thẻ âm 0,15 s).
- 0,35 s cho mỗi lần chạm (`pick` lần).
- Tìm kiếm theo đúng cách tìm ở bước 5 của mục Cách sinh câu đố, nhưng mỗi phép tính theo thời gian:
  - một phép trừ trong đầu: số một chữ số 0,25 s, hai chữ số 0,4 s, ba chữ số 0,5 s; có số âm thêm 0,2 s; có mượn (hàng đơn vị số bị trừ nhỏ hơn) thêm 0,1 s;
  - mỗi phép thử thẻ `b` thêm 0,15 s để tìm số cần trên sân;
  - phép thử bị bỏ vì thấy ngay là không có tính 0,1 s;
  - Mầm: phép thử bị bỏ khi `đích − x` không nằm trong 1–9.

Với trẻ 7 tuổi, nhân các khoản (trừ định hướng) với 1,8 và tính 0,5 s để định hướng. Số câu mỗi vòng tính thêm:

- 0,25 s chuyển câu;
- tỉ lệ sai giả định: trẻ ở Mầm 10 %, người lớn ở Mầm 4 %, Thường 6 %, Khó 8 %, Siêu khó 12 %. Khay hiện tổng đang có nên người cẩn thận ít khi sai; sai chủ yếu do chạm vội thẻ cuối;
- mỗi câu sai mất 30–100 % thời gian giải rồi khoá 1,5 s.

**Vì sao chọn khoảng công sức thay vì để ngẫu nhiên:** nếu không lọc, công sức trải rộng (Thường P10 3,3 → P90 12 phép thử). Khi đó thời gian giải theo mô hình là 7,5 s ở Thường (4,8–9,9 s), 8,8 s ở Khó và 7,0 s ở Siêu khó: Khó chậm hơn Siêu khó, các mức chồng nhau hoàn toàn, và hơn 10 % số câu Thường vượt 8 giây của GDD. Lọc theo khoảng làm thời gian giải tăng đều theo mức và gom lại quanh một giá trị: thẻ mồi phần lớn "loại được ngay" (quá lớn hoặc quá nhỏ so với đích), chỉ vài thẻ cần tính thật.

**Vì sao vòng 60 giây:** ở Thường mỗi câu ~5,2 s (~10,5 câu mỗi vòng), ít hơn mục tiêu 15–25 câu của GDD vì mỗi câu là một bài tìm tổ hợp, không phải một lần nhìn. Vẫn nằm trong quy tắc "1–8 giây ở mức Thường". Vòng dài hơn 60 giây thì vượt khoảng 45–60 giây được phép. Siêu khó còn ~8,2 câu, vừa đủ điều kiện ≥ 8 câu mỗi vòng (xem Câu hỏi mở).

### Miễn trừ thời gian cho thưởng tốc độ (CR-006)

**Đã khai báo:** `speedAllowanceMs(puzzle) = 500 × (pick − 1)`, tức 500 ms ở Mầm và 1 000 ms ở ba mức còn lại. Đây là thời gian tối thiểu cho các lần chạm thêm (0,35 s mỗi lần theo mô hình), không bù thời gian tính nhẩm: tính nhẩm là kỹ năng game đo, việc cân điểm giữa các mức để cho hệ số điểm.

| Mức | Miễn trừ | Khung thưởng sau miễn trừ (trọn → hết) | Thưởng cho câu điển hình: khung chung → có miễn trừ |
| --- | --- | --- | --- |
| Mầm | 500 ms | 2 s → 8,5 s | trẻ 21 → 25 · người lớn 39 → 43 |
| Thường | 1 000 ms | 2,5 s → 9 s | 21 → 29 |
| Khó | 1 000 ms | 2,5 s → 9 s | 15 → 23 |
| Siêu khó | 1 000 ms | 2,5 s → 9 s | 9 → 17 |

### Hệ số điểm (CR-006)

**Đã khai báo:** `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.35, 3: 1.75 }`, tức Mầm × 1 · Thường × 1 · Khó × 1,35 · Siêu khó × 1,75.

Cách tính giống Bóng bay số:

1. `T` = thời gian cho mỗi câu đúng = 60 s ÷ số câu đúng mỗi vòng (đã gồm chuyển câu, câu sai và khoá).
2. Điểm mỗi giây là `(100 × hệ số + B) × K ÷ T`, với `B` là thưởng tốc độ trung bình mỗi câu đúng (sau miễn trừ) và `K` là hệ số combo trung bình (trần × 1,5). Cho điểm mỗi giây bằng của Thường, suy ra `hệ số = [ (T ÷ T_Thường) × (100 + B_Thường) × (K_Thường ÷ K) − B ] ÷ 100`.
3. Làm tròn tới 0,05, rồi giữ điều kiện hệ số không giảm theo mức, và Mầm = min(giá trị tính, 1).

| Mức | Người chơi | Tỉ lệ sai giả định | `T` | `B` | `K` | Theo công thức | Đã chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 10 % | 6,29 s (1,04 × Thường) | 25,4 | 1,213 | 1,12 | **1** (không cao hơn Thường) |
| Thường | người lớn | 6 % | 6,06 s | 29,1 | 1,246 | 1 | **1** |
| Khó | người lớn | 8 % | 7,09 s (1,17 ×) | 23,1 | 1,208 | 1,33 | **1,35** |
| Siêu khó | người lớn | 12 % | 8,38 s (1,38 ×) | 16,7 | 1,164 | 1,74 | **1,75** |

`T`, `B`, `K` lấy từ mô phỏng 4 000 vòng cho mỗi người chơi: câu đố sinh bằng chính `generate()`, thời gian theo mô hình nhân nhiễu đều ×0,75–1,25, điểm tính bằng `pointsForCorrect` của `scoring.ts` (miễn trừ, trần combo × 1,5).

Điểm vòng mô phỏng (vòng 60 s; % so với người lớn ở Thường):

| Người chơi | CR-006 với hệ số chung 0,8 / 1 / 1,25 / 1,5 | CR-006 với hệ số của game (đã chọn) |
| --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | ~1 220 (76 %) | ~1 450 (91 %) |
| Người lớn ở Mầm | ~2 910 (182 %) | ~3 380 (212 %) |
| Người lớn ở Thường | ~1 590 (100 %) | ~1 590 (100 %) |
| Người lớn ở Khó | ~1 520 (95 %) | ~1 620 (102 %) |
| Người lớn ở Siêu khó | ~1 390 (87 %) | ~1 600 (100 %) |

- Người lớn chọn Mầm được ~2 lần điểm mức Thường. Không công thức nào chặn được việc này; phần đó do chủ phòng giám sát (nút Nhắc, GDD §6).
- **Chỉnh sau buổi chơi thử:** đo tỉ lệ sai và số câu đúng mỗi vòng ở từng mức, thay vào bảng trên rồi tính lại theo công thức. Chỉ đổi số trong `difficultyMultiplier`; test chỉ kiểm hệ số dương và không giảm theo mức.

## Ghi chú cho FE

**Bám sát bản mẫu đã duyệt, không vẽ lại:** [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M6**:

- `HitTargetMobile`: khung điện thoại mức Thường, đang chọn.
- `HitTargetLevels`: 4 mức độ khó, gồm cả trạng thái bỏ chọn ở Khó và rê chuột.
- `HitTargetStates`: sai và khoá (Siêu khó), đúng cả câu (Thường), cùng bản nền tối.
- `HitTargetHowTo`: hình minh hoạ cho màn hướng dẫn (560×360).

Toạ độ dưới đây đọc từ các artboard đó, tính theo px thiết kế trong khung 720×1280.

### Dữ liệu câu đố và đáp án

Scene gọi `hitTarget.generate(bridge.seed, index, bridge.difficulty)` rồi vẽ theo `HitTargetPuzzle`:

| Trường | Scene dùng để |
| --- | --- |
| `target` | số trong hồng tâm |
| `cards`, `cols` | lưới thẻ; thẻ `i` ở cột `i % cols`, hàng `Math.floor(i / cols)`. Số âm vẽ bằng "−" (U+2212), không dùng `String(v)` vì ra gạch ngắn "-" |
| `pick` | số ô của khay (2 hoặc 3); chọn đủ `pick` thẻ là nộp |
| `answer` | chỉ số thẻ đáp án, để khoanh khi người chơi sai |

**Đáp án** (`HitTargetAnswer = number[]`): mảng chỉ số các thẻ trong khay, gửi **đúng một lần** khi khay vừa đủ `pick` thẻ. Thứ tự không quan trọng.

### Bố cục

| Vùng | Toạ độ | Nội dung |
| --- | --- | --- |
| Gợi ý luật | tâm (360, 52), cao ~40 | hai ô nhỏ + mũi tên vào hồng tâm nhỏ, không chữ. Chỉ trang trí; huy hiệu khoá có thể che, không sao |
| Hồng tâm | tâm (360, 226), bán kính 120 (vòng xanh), mặt kem bán kính 90 | số đích Baloo 2 ExtraBold 112 px (số ba chữ số ở Khó nhỏ lại cho vừa mặt kem) |
| Khay 3 ô | tâm y = 432; ô 96 × 96 tại x = 112, 264, 416; dấu "+" tại x = 188, 340; dấu "=" tại x = 492; ô tổng 136 × 96 tại x = 588 | ô trống viền nét đứt; ô đã có thẻ là chip kem chữ 56 px; ô tổng nền mực chữ vàng 52 px, hiện tổng các thẻ đang chọn (0 khi trống) |
| Khay 2 ô (Mầm) | ô tại x = 188, 340; "+" tại 264; "=" tại 416; ô tổng tại 512 | như trên |
| Lưới 3×3 | tâm cột x = 136, 360, 584; tâm hàng y = 632, 872, 1112 | thẻ 200 × 200, bo 30, chữ 88 px |
| Lưới 2×3 (Mầm) | tâm cột x = 192, 528; tâm hàng như trên | thẻ 280 × 200 |

- Thẻ âm vào khay: dấu nối đứng trước nó đổi thành "−" và chip ghi trị tuyệt đối (khay Siêu khó trong bản mẫu: "41 − 15 + ▢"). Thẻ âm ở ô đầu tiên ghi cả dấu: "−15".
- Tổng trong ô tổng có thể âm ở Siêu khó; vẽ bằng "−".

### Vùng chạm

- Vùng chạm là cả thẻ (200 × 200, Mầm 280 × 200), đứng yên. Ở tỉ lệ thu nhỏ ~0,31 của điện thoại nhỏ vẫn ≈ 62 px thật, ≥ 48 px.
- Chạm thẻ chưa chọn: chọn (nếu khay còn ô). Chạm thẻ đã chọn: bỏ chọn, thẻ rời khay, các chip sau dồn lên. Chạm chip trong khay cũng bỏ chọn thẻ đó (tuỳ chọn, tiện cho người chơi).
- Khay đầy là nộp ngay, không chờ hiệu ứng. Trong lúc khoá, mọi thẻ không nhận chạm; chạm không tính là sai.
- Xử lý chạm tuần tự theo thứ tự sự kiện; chạm nhiều ngón cùng lúc vẫn chỉ nhận đủ `pick` thẻ rồi dừng.
- Trên máy tính: con trỏ bàn tay; thẻ đang rê nhô lên nhẹ (artboard `HitTargetLevels`, mức Thường).

### Trạng thái

| Trạng thái | Hình (theo bản mẫu) | Thời lượng |
| --- | --- | --- |
| Hiện câu | hồng tâm và thẻ hiện ra, khay trống, tổng 0. Chạm được ngay | ≤ 200 ms |
| Đang chọn | thẻ đã chọn **lún xuống**, nền xanh nhạt, viền đậm hơn, có **huy hiệu số thứ tự** (1, 2, 3) ở góc trên trái; chip bay vào ô kế tiếp của khay; ô tổng cập nhật | chip bay ≤ 200 ms, không chặn chạm tiếp |
| Bỏ chọn | thẻ nảy lên về nền kem, vạch phấn nảy dưới thẻ, huy hiệu mũi tên quay lại thoáng qua (artboard Levels, mức Khó) | ≤ 200 ms |
| Đúng cả câu | hồng tâm có tia phấn và dấu ✓; khay đầy nảy nhẹ; ô tổng nền vàng | câu mới sau ≤ 300 ms |
| Sai → khoá | xem mục dưới | rung 200 ms; khoá theo `bridge.unlockDelay` rồi sang câu mới |
| Hết giờ giữa câu | ngừng nhận chạm, không gửi gì | — |
| Nối lại giữa vòng | bắt đầu từ `bridge.startIndex`; câu đang chọn dở chơi lại từ đầu (khay trống) | — |

Đã chọn và chưa chọn phân biệt **không chỉ bằng màu**: thẻ đã chọn lún xuống và có huy hiệu số.

### Hiện đáp án đúng khi sai

Khi khay đủ `pick` thẻ mà tổng khác đích (artboard `HitTargetStates`, Siêu khó):

- Gửi đáp án ngay, rồi khoá trong suốt thời gian `bridge.unlockDelay`.
- Cạnh hồng tâm hiện ổ khoá. Hồng tâm và số đích vẫn rõ (nằm ở y 106–346, dưới dải huy hiệu khoá).
- Khay giữ nguyên các thẻ đã chọn. Dấu "=" bị gạch chéo; ô tổng viền đỏ nét đứt ghi tổng sai (vd. 27 khi đích 28).
- Thẻ chọn sai (đã chọn nhưng không thuộc `answer`) có dấu ✗.
- **Mọi thẻ thuộc `answer` có vòng nét đứt và dấu ✓**, kể cả thẻ người chơi đã chọn đúng (vd. thẻ 2 trong bản mẫu).
- Các thẻ còn lại mờ đi.
- Bản nền tối: ✗ màu hồng viền trắng, vòng nét đứt và ✓ màu kem, ổ khoá vàng (đúng bản tối trong artboard).

Mọi dữ liệu đã có trong puzzle, không cần chờ server trả `answer-result`. Việc này không lộ gì về câu sau.

### Màu và chữ

- Chữ số dùng Baloo 2 ExtraBold, các chữ số rộng bằng nhau. Chờ font tải xong mới vẽ câu đầu.
- Thẻ, chip, ô tổng, hồng tâm đều có nền riêng (thẻ giấy kem hoặc mực), nên nổi trên cả nền bảng sáng lẫn tối. Màu lấy theo bản mẫu; bản tối dùng thẻ tím đậm chữ kem như artboard States.
- Dấu trừ là "−" dài (U+2212), đậm bằng nét chữ số.

### Hiệu ứng & âm thanh

| Sự kiện | Hình | Âm (GĐ 2) |
| --- | --- | --- |
| Chọn thẻ | lún + chip bay vào khay | "tách" nhẹ, cao dần theo ô 1 → 3 |
| Bỏ chọn | nảy lên | "tách" trầm |
| Đúng cả câu | hồng tâm tia phấn + ✓ | "phập" trúng đích + "ting" cao dần theo combo (GDD §9) |
| Sai | rung + ✗ + khoanh đáp án | "bụp" trầm; rung máy ngắn (GĐ 2) |

Khi bật giảm chuyển động (`prefers-reduced-motion`): bỏ rung và nảy; chip hiện thẳng trong khay; vòng nét đứt đứng yên.

### Chữ hiển thị (`locales.ts`)

Thay chữ của câu đố mẫu ("số lớn nhất") bằng nội dung mục [Màn hướng dẫn](#màn-hướng-dẫn), thêm `levelHints` cho Mầm và Siêu khó.

## Ghi chú cho BE

- Không có pha trình chiếu: câu hiện ra là chạm được ngay, giữ cách tính thời gian hiện tại.
- Đáp án là mảng 2–3 số nguyên. `AnswerSchema.answer` đang là `unknown` nên mảng đi qua được; `isAnswer` kiểm chặt. Mỗi câu chỉ một tin nhắn (bỏ chọn diễn ra ở client, không gửi lên server). Không đổi giao thức.
- `durationMs = 60_000`: server đã dùng `game.durationMs`.
- CR-006: `speedAllowanceMs(puzzle) = 500 × (pick − 1)` (500 / 1 000 / 1 000 / 1 000 ms), không dùng tham số `difficulty`; `difficultyMultiplier = { 0: 1, 1: 1, 2: 1.35, 3: 1.75 }`. Server đọc qua `gameSpeedAllowanceMs` và `gameMultiplier` với puzzle tự sinh lại.
- `generate()` mất tới ~0,2 ms một câu (lặp lọc khoảng công sức, mục Cách sinh câu đố), không đáng kể với server.

## Đối chiếu quy tắc thiết kế (GDD §5)

| Quy tắc | Đạt? | Vì sao |
| --- | --- | --- |
| Hiểu trong ≤ 5 giây với một câu + hình | Có | "Chạm các thẻ có tổng bằng số đích" + hình hai thẻ có mũi tên vào hồng tâm |
| Một câu giải trong 1–8 giây ở mức Thường | Có | ~5,2 s theo mô hình (4,8–5,6 s), trước cả miễn trừ |
| Đúng một đáp án, kiểm được bằng máy | Có | thẻ mồi không tạo thêm bộ ra đích; test vét cạn 10 000 seed |
| Chỉ số nguyên + `createRng()` | Có | chỉ phép cộng trừ số nguyên |
| Bốn mức khác rõ; Mầm hợp trẻ 7 tuổi | Có | Mầm 6 thẻ một chữ số, chọn 2, đích ≤ 17 |
| Một ngón tay, vùng chạm ≥ 48 px | Có | thẻ 200 × 200 px thiết kế |
| Không phụ thuộc chữ | Có | chỉ số và ký hiệu |
| Không chỉ phân biệt bằng màu | Có | thẻ đã chọn lún xuống + huy hiệu số; sai có ✗, đáp án có vòng nét đứt + ✓ |

## Câu hỏi mở

- **Số liệu là mô hình.** Cần đo trong buổi chơi thử: thời gian giải thật ở mỗi mức, tỉ lệ sai, và người chơi có thật sự "loại nhanh" thẻ quá lớn hoặc quá nhỏ như mô hình giả định không. Nếu thật chậm hơn, nới khoảng công sức xuống (vd. Thường 2,5–4) chứ không đổi tham số đã duyệt.
- **Siêu khó vừa sát ngưỡng ≥ 8 câu mỗi vòng** (~8,2 câu theo mô phỏng). Nếu chơi thử thấy dưới 8: hạ khoảng công sức Siêu khó (vd. 5,5–6,25), hoặc thu hẹp thẻ dương 2–45 xuống 2–35.
- **Ở Thường, 42 % câu có đáp án nằm trong 4 thẻ lớn nhất hoặc 4 thẻ nhỏ nhất**, hệ quả của việc lọc công sức thấp. Người chơi có thể học mẹo "thử thẻ cực trước"; đó cũng là cách suy luận hợp lệ. Nếu chơi thử thấy đơn điệu, nâng cận trên khoảng công sức Thường.
- **Phạm vi thẻ dương ở Siêu khó (2–45)** do game-designer chọn, vì ý tưởng đã duyệt chỉ nêu thẻ âm và số đích. 45 ≈ (60 + 30) ÷ 2, để số đích lớn vẫn đi được với thẻ âm sâu. Cần chủ dự án xác nhận.
- Người lớn chọn Mầm được ~212 % điểm Thường (giống các game khác, do chủ phòng giám sát).
