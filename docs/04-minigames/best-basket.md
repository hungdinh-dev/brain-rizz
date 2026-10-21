# Giỏ hời nhất (`best-basket`)

- Nhóm: Tính toán (`compute`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; lý do ở mục [Cân bằng](#cân-bằng))
- File: `packages/shared/src/games/best-basket/` (logic + test), `apps/web/src/games/best-basket/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M27** (BestBasketMobile, BestBasketLevels, BestBasketStates, BestBasketHowTo, BestBasketItems). Chờ chủ dự án duyệt.
- Nguồn: [CR-014](../00-tracking/change-requests.md#cr-014), [kế hoạch mở rộng minigame mục 3.8](../01-product/minigame-expansion.md) (cơ chế từ "Đi Chợ Tết" của Pumer Party; chỉ mượn cơ chế, tên, hình và chủ đề căng tin là của Brain Rizz). Các điểm lệch khỏi kế hoạch ghi ở [Câu hỏi mở](#câu-hỏi-mở).
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Túi bạn có vài xu. Căng tin bày 3–4 giỏ đồ ăn vặt, mỗi món ghi giá (xu) và số sao ngon. Chạm giỏ **nhiều sao nhất** mà tổng giá **không vượt** số xu trong túi.

## Màn hướng dẫn

- **Cách chơi:**
  1. Xem số xu trong túi
  2. Cộng giá và sao từng giỏ
  3. Chạm giỏ nhiều sao mà đủ tiền
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ:** túi xu ghi **8** ở góc trái trên. Bên dưới là 3 giỏ (kiểu Thường, 2 món mỗi giỏ):
  - Giỏ 1: bánh mì 3 xu ★2, hộp sữa 4 xu ★3. Dưới giỏ ghi "7 ✓ · ★5".
  - Giỏ 2: kẹo mút 5 xu ★4, nước cam 4 xu ★4. Dưới giỏ ghi "9 ✗ · ★8", số 9 bị gạch, giỏ mờ đi.
  - Giỏ 3: bánh quy 1 xu ★2, táo 5 xu ★4. Dưới giỏ ghi "6 ✓ · ★6", có viền vàng và ngón tay đang chạm.
  - Số thứ tự phấn: ① ở túi xu, ② ở dấu ✗ của giỏ 2 (nhiều sao nhưng lố tiền), ③ ở ngón tay.
- **Câu nhắc lúc đếm ngược:** "Nhiều sao nhất, đừng lố tiền!"
- **Câu nhắc theo mức:**
  - Khó: "Đủ cặp món nối được thêm sao!" (luật mới, bắt buộc có)
  - Siêu khó: "Đủ đôi món ưu đãi thì giảm giá!" (luật mới, bắt buộc có)
- **Hình phụ cho thẻ luật** (Khó, Siêu khó; vẽ nhỏ cạnh câu nhắc): thẻ "hình A — dây nối — hình B → +2★", và thẻ "hình C hình C → đồng xu −2".

## Câu đố & đáp án

`BestBasketPuzzle` (export từ `@brain-rizz/shared`, cùng `BestBasketItem`, `BestBasketCombo`, `BestBasketDeal`, `BEST_BASKET_SNACKS`, `bestBasketTotals`, `bestBasketSolve`):

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `budget` | `number` | số xu trong túi. Giỏ có tổng giá (sau ưu đãi) **lớn hơn** số này là lố tiền; bằng thì vẫn mua được |
| `baskets` | `BestBasketItem[][]` | các giỏ theo thứ tự vẽ: Mầm 3 giỏ, mức khác 4 giỏ (lưới 2×2 đọc theo hàng). Mỗi món `{ kind, price, stars }` |
| `combo` | `{ kinds: [A, B], bonus } \| null` | cặp món đi kèm: giỏ có **cả** A và B được cộng `bonus` sao (2 hoặc 3). `null` ở Mầm, Thường |
| `deal` | `{ kind, discount } \| null` | ưu đãi: mỗi **2 món** loại `kind` trong cùng một giỏ được giảm `discount` xu (2 hoặc 3). `null` trừ Siêu khó |
| `answerIndex` | `number` | chỉ số giỏ đúng, bằng `bestBasketSolve(puzzle)` |

- `kind` thuộc `BEST_BASKET_SNACKS`: `bun` (bánh mì), `milk` (hộp sữa), `apple` (táo), `banana` (chuối), `candy` (kẹo mút), `cookie` (bánh quy), `juice` (ly nước cam), `corn` (bắp). Web vẽ từng loại bằng hình, **không ghi tên**.
- Trong một câu, **cùng loại thì cùng giá và cùng số sao** (như bảng giá căng tin). Mọi giá và số sao là số nguyên dương nhỏ.
- `Answer` (`BestBasketAnswer = number`): chỉ số giỏ đã chạm, gửi một lần mỗi câu. `isAnswer` chỉ nhận số nguyên 0–3.
- Hàm dùng chung (bộ sinh, `check`, scene, test cùng gọi):
  - `bestBasketTotals(basket, puzzle)` → `{ price, stars, comboApplied, dealTimes }`: tổng giá sau ưu đãi, tổng sao sau thưởng, giỏ có được thưởng không, được giảm mấy lần.
  - `bestBasketSolve(puzzle)` → chỉ số giỏ vừa tiền duy nhất nhiều sao nhất, −1 nếu không có hoặc hoà (bộ sinh không bao giờ tạo ra).
- `check(puzzle, answer)` = `answer === bestBasketSolve(puzzle)`.
- Server test lấy đáp án đúng bằng `GAMES["best-basket"].generate(s, i, d).answerIndex`.

## Cách sinh câu đố

Mỗi câu dùng một nguồn `rng = createRng(deriveSeed(seed, index))`.

1. **Bốc "cốt truyện"** (`rng.int(0, 19)`), tức vai trò của giỏ có luật. Bốc trước khi sinh để các vai trò xuất hiện đúng tỉ lệ; nếu để ngẫu nhiên tự nhiên thì giỏ được thưởng là giỏ bẫy tới 70 % câu, người chơi đoán được.
   - Khó: giỏ đi kèm **là đáp án và chỉ nhờ thưởng mới thắng** 40 %; giỏ đi kèm **lố tiền mà nhiều sao hơn đáp án** (bẫy) 30 %; giỏ đi kèm **vừa tiền nhưng vẫn thua** 30 %.
   - Siêu khó: đáp án là **giỏ ưu đãi, chỉ nhờ giảm giá mới vừa tiền** 35 %; đáp án là giỏ đi kèm, chỉ nhờ thưởng mới thắng 30 %; đáp án là giỏ thường 35 %, và khi đó giỏ ưu đãi vẫn được "cứu" (vừa tiền nhờ giảm giá) hoặc giỏ đi kèm là bẫy.
2. **Thử dựng câu**, tối đa 500 lần (đo: trung bình 1,6 / 1,9 / 8,7 / 8,7 lần, nhiều nhất 147 lần trên 40 000 câu). Mỗi lần:
   1. Xáo 8 loại món, lấy 3 loại (Mầm) hoặc 6 loại. Siêu khó: loại đầu là loại ưu đãi, giảm 2–3 xu. Khó, Siêu khó: hai loại kế là cặp đi kèm, thưởng 2–3 sao.
   2. Mỗi loại một giá theo khoảng của mức. Loại ưu đãi giá ≥ 2, nên đôi món sau khi giảm vẫn ≥ 1 xu.
   3. Dựng giỏ:
      - Mầm: mỗi giỏ một món, 3 loại khác nhau.
      - Mức khác, 4 giỏ, mỗi giỏ 2 món. Siêu khó có giỏ [C, C] (đôi món ưu đãi). Khó và Siêu khó có giỏ [A, B] (đủ cặp đi kèm). Thêm một **giỏ "gần đủ"**: chỉ có một món C (Siêu khó) hoặc chỉ một nửa cặp A/B (Khó). Các giỏ còn lại là cặp 2 món khác loại, bốc ngẫu nhiên, không được đủ cặp A + B.
      - Thứ tự món trong giỏ xáo ngẫu nhiên. Không có hai giỏ giống hệt nhau.
   4. **Bước giá:** tính tổng giá từng giỏ (giỏ ưu đãi tính sau giảm). Giữ các số xu trong khoảng của mức sao cho:
      - đúng **2 giỏ vừa tiền**;
      - có giỏ lố tiền ≤ 2 xu (Mầm ≤ 3 xu);
      - Siêu khó: giỏ ưu đãi **trông như lố** (giá chưa giảm > số xu).

      Không có số nào thì thử lại từ đầu.
   5. **Bước sao:** gán sao cho từng loại, thử tối đa 8 lần. Hai loại đi kèm chỉ 1–4 sao: món thường, có thưởng mới ngon. Với mỗi số xu còn giữ, câu hợp lệ khi:
      - trong 2 giỏ vừa tiền có đúng một giỏ nhiều sao hơn, hơn giỏ kia 1–2 sao (Mầm 1–4);
      - có ít nhất một **giỏ bẫy**: lố tiền mà nhiều sao hơn đáp án. Bẫy gần nhất lố ≤ 2 xu (Mầm ≤ 3);
      - câu đúng cốt truyện đã bốc.

      Chọn ngẫu nhiên một số xu trong các số hợp lệ.
3. **Xáo vị trí giỏ**, rồi `answerIndex = bestBasketSolve(puzzle)`.
4. Nếu 500 lần đều trượt thì dùng câu dựng sẵn của mức (`bestBasketFallback`, xáo vị trí). Câu này thoả mọi ràng buộc, nhưng chưa từng phải dùng tới (test kiểm).

**Vì sao đúng một đáp án:** câu chỉ được nhận khi trong các giỏ vừa tiền có đúng một giỏ có tổng sao lớn nhất. Tổng tính bằng chính `bestBasketTotals` mà `check` dùng. Test tính lại tổng bằng một cách độc lập, rồi đếm số giỏ `check` nhận trên 10 000 seed × 4 mức.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 giỏ × 1 món, 3 loại. Giá 1–9 xu, sao 1–5, túi 3–8 xu (trung vị 6). Đúng **1 giỏ lố tiền**, và đó là giỏ nhiều sao nhất (lố 1–3 xu). 2 giỏ vừa tiền hơn kém nhau 1–3 sao | 3 khay to xếp dọc, mỗi khay một món. Sao vẽ thành hàng ngôi sao, chỉ cần so, không cần cộng |
| Thường | 4 giỏ × 2 món khác loại, 6 loại. Giá 1–5, sao 1–5, túi 4–10 (đo được 4–9, trung vị 6). Đúng 2 giỏ vừa tiền, 2 giỏ lố. Bẫy gần nhất lố 1 xu (70 %) hoặc 2 xu. Giỏ vừa tiền còn lại kém đáp án 1 sao (62 %) hoặc 2 sao | lưới 2×2, phải **cộng cả giá lẫn sao** từng giỏ |
| Khó | như Thường, **thêm cặp đi kèm** (+2 hoặc +3 sao). Đúng một giỏ đủ cặp, luôn có giỏ chỉ có một nửa cặp. Vai trò giỏ đi kèm: đáp án 40 %, bẫy lố tiền 31 %, vừa tiền nhưng thua 30 % | một thẻ luật ở góc phải trên: hình A —nối— hình B → +2★ |
| Siêu khó | như Khó, **thêm ưu đãi**: đôi món loại C giảm 2 hoặc 3 xu. Đúng một giỏ [C, C], luôn trông như lố tiền trước khi giảm. Luôn có giỏ chỉ có một món C (không được giảm). Sau khi giảm, giỏ ưu đãi vừa tiền 72 %, vẫn lố 28 % | hai thẻ luật xếp chồng: cặp đi kèm, và hình C hình C → đồng xu −2 |

Mỗi mức thêm một thứ mới. Mầm chỉ so số. Thường phải cộng hai cột số. Khó có luật làm một giỏ "trông kém" thành nhiều sao nhất, hoặc làm giỏ lố tiền thêm hấp dẫn. Siêu khó có thêm luật làm một giỏ "trông lố" thành vừa tiền.

Từ Thường trở lên, giá và sao cùng nằm trong 1–5 ở mọi mức, nên tổng hiếm khi qua 10. Độ khó tăng nhờ luật, không nhờ số to. Lý do ở mục [Cân bằng](#cân-bằng).

## Đảm bảo khi sinh câu đố

- Luôn có **đúng một đáp án**: `check` chỉ nhận đúng một giỏ, và giỏ đó là `answerIndex`.
- Luôn có **ít nhất một giỏ không lố tiền**. Thực ra luôn đúng 2 giỏ vừa tiền, các giỏ còn lại lố.
- Luôn có **giỏ bẫy**: lố tiền mà nhiều sao hơn đáp án, tính sau thưởng và ưu đãi. Bẫy gần nhất lố ≤ 2 xu (Mầm ≤ 3).
- Giỏ vừa tiền còn lại kém đáp án 1–2 sao (Mầm 1–4).
- Cùng loại thì cùng giá, cùng sao. Không có hai giỏ giống hệt nhau. Ngoài giỏ ưu đãi, mỗi giỏ là 2 món khác loại. Mọi giá trị nằm trong khoảng ở bảng Độ khó. Giỏ nào cũng có tổng giá ≥ 1 xu.
- **Luật xuất hiện đúng mức:**
  - Mầm và Thường không có luật nào.
  - Khó có cặp đi kèm, không có ưu đãi. Đúng một giỏ đủ cặp, mỗi món trong cặp ≤ 4 sao, có giỏ chỉ một nửa cặp.
  - Siêu khó có cả hai luật. Đúng một giỏ được giảm, và đó là giỏ [C, C] trông như lố. C không thuộc cặp đi kèm. Có giỏ chỉ có một món C.
- **Luật thật sự đổi đáp án:**
  - Khó: bỏ thưởng thì đáp án đổi ở 40 % câu.
  - Siêu khó: bỏ ưu đãi đổi đáp án ở 34 % câu, bỏ thưởng đổi ở 31 %. Bỏ cả hai luật chỉ đúng 41 % câu.
- **Không có mẹo tắt:**
  - Bẫy nên "chỉ đếm sao" luôn sai.
  - "Chọn giỏ vừa tiền đắt hơn" đúng 33–42 % câu, tuỳ mức.
  - Khó, Siêu khó: "giỏ có luật nào vừa tiền thì chọn" đúng 57 % (Khó) và 63 % (Siêu khó), không hơn nhiều so với tung đồng xu giữa 2 giỏ vừa tiền.
- **Vị trí đáp án chia đều:** Mầm 33,1 / 33,5 / 33,4 %, mức khác mỗi ô 24,4–25,7 %.
- **Tất định:** cùng `(seed, index, difficulty)` cho cùng câu.
- **Độ khó tăng thật** theo mô hình thời gian ở mục Cân bằng:
  - mỗi mức chậm hơn mức dưới ≥ 0,5 s trung bình, và p90 của mức dưới nhỏ hơn p10 của mức trên;
  - số món tăng 3 → 8 → 8 → 8, số luật 0 → 0 → 1 → 2;
  - Siêu khó trung bình < 7,1 s.
- `speedAllowanceMs` hữu hạn, ≥ 0, đúng bảng ở mục Cân bằng. `difficultyMultiplier` dương, không giảm theo mức.

Các điều trên được kiểm bằng test 10 000 seed × 4 mức (`best-basket.test.ts`).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu (trung bình, p10–p90) | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm | trẻ 7 tuổi ~4,4 s (4,2–4,7) · người lớn ~2,5 s (2,4–2,7) | trẻ ~12,6 (~11,3 đúng) · người lớn ~21 (~20,4 đúng) |
| Thường | ~5,3 s (5,05–5,5) | ~10,4 (~9,7 đúng) |
| Khó | ~6,3 s (5,95–6,55) | ~8,9 (~8,0 đúng) |
| Siêu khó | ~7,0 s (6,7–7,45) | ~8,0 (~7,0 đúng) |

Các mức không chồng nhau: p90 của mỗi mức nhỏ hơn p10 của mức trên (2,7 < 5,05; 5,5 < 5,95; 6,55 < 6,7). Test kiểm điều này.

**Mô hình thời gian** của người lớn, kiểu KLM, cùng mức lạc quan với Đếm tiền nhanh. Test cài đúng mô hình này.

- **Cố định 1,1 s:** 0,4 s định hướng, 0,2 s đọc túi xu, 0,5 s chọn và chạm.
- **Mỗi thẻ luật:** 0,35 s đọc thẻ, cộng 0,05 s cho mỗi món phải dò xem có khớp luật không.
- **Mỗi giỏ, bước giá:**
  - đọc giá 0,15 s mỗi loại món (đôi món giống nhau chỉ đọc một lần);
  - cộng 0,25 s mỗi món thêm, thêm 0,15 s nếu tổng ≥ 10;
  - trừ ưu đãi 0,3 s;
  - so với túi 0,1 s, thêm 0,15 s nếu sát (bằng túi hoặc lố 1 xu).
- **Mỗi giỏ vừa tiền, bước sao:** đọc và cộng sao như giá. Cộng thưởng 0,3 s, thêm 0,15 s nếu thưởng đẩy tổng qua 10.
- **So sao:** 0,1 s, thêm 0,15 s nếu hai giỏ hơn kém 1 sao.
- **Trẻ 7 tuổi:** định hướng 0,6 s, mọi khoản khác nhân 1,8.

Mỗi câu thêm 0,25 s chuyển câu. Tỉ lệ sai giả định, giống Đếm tiền nhanh: trẻ ở Mầm 10 %, người lớn ở Mầm 4 %, Thường 7 %, Khó 10 %, Siêu khó 12 %. Mỗi câu sai mất 30–100 % thời gian giải rồi khoá 1,5 s.

**Vì sao mỗi giỏ chỉ 2 món** (kế hoạch ghi Khó 3 món, Siêu khó 3–4 món):

- Theo mô hình, thêm món thứ ba vào mỗi giỏ thì Khó mất ~9,0 s và Siêu khó ~10,1 s, tức Siêu khó chỉ còn ~6 câu mỗi vòng, dưới mức 8 câu bắt buộc.
- Bản thử 4 giỏ × 2 món nhưng giá và sao tới 6 thì Siêu khó mất ~7,1 s (7,9 câu), và Khó với Siêu khó chồng nhau.
- Bản chốt giữ 2 món, số 1–5 ở mọi mức, và để luật tạo độ khó. Thêm vào đó:
  - luôn đúng 2 giỏ vừa tiền, nên thời gian không dao động theo số giỏ phải cộng sao;
  - giỏ ưu đãi luôn trông như lố, nên luật ưu đãi lúc nào cũng phải tính.

**Vì sao vòng 60 giây:** Siêu khó cần ~7 s mỗi câu. 60 s cho ~8 câu, vừa đủ ngưỡng.

### Miễn trừ thời gian cho thưởng tốc độ (CR-006)

Thưởng tốc độ chung (trọn 50 khi ≤ 1,5 s, hết từ 8 s) quá gắt với game phải cộng 8 số rồi so. **Đã khai báo:** `speedAllowanceMs(puzzle) = 250 × max(0, số món − 2) + 500 × số luật`.

| Mức | Miễn trừ | Lý do |
| --- | --- | --- |
| Mầm | 250 ms | 1 món thêm |
| Thường | 1 500 ms | 6 món thêm |
| Khó | 2 000 ms | 6 món thêm + thẻ đi kèm |
| Siêu khó | 2 500 ms | 6 món thêm + 2 thẻ luật |

Hàm chỉ đọc câu đố nên luôn tất định, hữu hạn và ≥ 0. Mức này chỉ bù phần đọc và cộng tối thiểu, để người nhanh vẫn hơn người chậm. Thưởng trung bình mỗi câu đúng trong mô phỏng: trẻ ở Mầm 28, người lớn ở Mầm 42, Thường 31, Khó 27, Siêu khó 26. Đếm tiền nhanh là 23 / 41 / 35 / 31 / 26.

### Hệ số điểm (CR-006)

**Đã khai báo:** `difficultyMultiplier = { 0: 0.85, 1: 1, 2: 1.4, 3: 1.65 }`.

Cách tính giống Đếm tiền nhanh:

- `T` là thời gian cho mỗi câu đúng: 60 s ÷ số câu đúng mỗi vòng.
- `B` là thưởng tốc độ trung bình mỗi câu đúng, `K` là hệ số combo trung bình.
- Hệ số được chọn để điểm vòng bằng người lớn ở Thường, rồi làm tròn tới 0,05.
- Hệ số không giảm theo mức, và Mầm = min(giá trị cho trẻ 7 tuổi, 1).

| Mức | Người chơi | Tỉ lệ sai | `T` | `B` | `K` | Theo mô phỏng | Đã chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi | 10 % | 5,31 s | 28 | 1,23 | 0,845 | **0,85** |
| Thường | người lớn | 7 % | 6,20 s | 31 | 1,24 | 1 | **1** |
| Khó | người lớn | 10 % | 7,52 s | 27 | 1,19 | 1,38 | **1,4** |
| Siêu khó | người lớn | 12 % | 8,55 s | 26 | 1,16 | 1,67 | **1,65** |

`T`, `B`, `K` lấy từ mô phỏng 4 000 vòng mỗi người chơi:

- câu đố sinh bằng chính `generate()`;
- thời gian theo mô hình, cộng nhiễu ±25 %;
- điểm tính như `scoring.ts`: miễn trừ, trần combo × 1,5, khoá 1,5 s.

Điểm vòng mô phỏng (% so với người lớn ở Thường):

| Người chơi | Hệ số chung 0,8 / 1 / 1,25 / 1,5 | Hệ số của game (đã chọn) |
| --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | ~1 500 (96 %) | ~1 570 (100 %) |
| Người lớn ở Mầm | ~3 370 (215 %) | ~3 500 (224 %) |
| Người lớn ở Thường | ~1 570 (100 %) | ~1 570 (100 %) |
| Người lớn ở Khó | ~1 440 (92 %) | ~1 590 (101 %) |
| Người lớn ở Siêu khó | ~1 430 (91 %) | ~1 550 (99 %) |

- **Độ nhạy:**
  - Khó: tỉ lệ sai thật 7 % thì được ~106 % điểm Thường, 13 % thì ~96 %.
  - Siêu khó: sai 9 % thì ~103 %, sai 16 % thì ~94 %.
  - Trẻ ở Mầm: sai 5 % thì ~110 %, sai 15 % thì ~92 %.
- **Mầm là 0,85, không phải 1:** trẻ 7 tuổi giải Mầm nhanh (~4,4 s, ~11 câu đúng), nên hệ số 1 sẽ cho trẻ ~114 % điểm Thường. 0,85 là giá trị mô phỏng, nhỏ hơn 1. Giống Gấp hộp, Mảnh vừa khít và Xoay hình.
- **Người lớn chọn Mầm** được ~2,2 lần điểm Thường, vì Mầm chỉ là so 3 số. Phần này do chủ phòng giám sát (GDD §6).
- **Chỉnh sau buổi chơi thử:** đo tỉ lệ sai và số câu đúng mỗi vòng ở từng mức, rồi tính lại theo bảng trên. Chỉ cần đổi số trong `difficultyMultiplier`.

### Điểm chuẩn Kiểm tra não

**Đề xuất `BRAIN_TEST_REFERENCE_SCORE["best-basket"]` = 1 100.** Điều phối điền vào `brain-test.ts` và thêm dòng vào bảng ở GDD.

- **Cách tính** theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não):
  - 4 000 lượt người lớn ở Thường, trong 45 s của nhóm Tính toán;
  - câu đố từ `generate()`, miễn trừ từ `speedAllowanceMs` (1 500 ms);
  - thời gian mỗi câu dao động đều ±20 % quanh 5,3 s (trung bình mô hình ở Thường), sai 7 %;
  - câu sai tốn trọn thời gian rồi khoá 1,5 s, giữa hai câu 0,25–0,35 s, câu dở khi hết giờ không tính.
- **Kết quả:** ~7,5 câu, ~7,0 đúng, trung bình 1 083 điểm. Chạy 20 000 lượt ra 1 080. Dùng thời gian theo mô hình từng câu thay cho 5,3 s cố định ra 1 075. Làm tròn tới 50 được **1 100**.
- Người nhanh hơn 30 % được × 1,62, chậm hơn 40 % được × 0,57, tương đương các game Tính toán khác (× 1,57–1,61 / × 0,58–0,61).
- Script mô phỏng không lưu trong repo.

## Ghi chú cho FE

Chưa có bản mẫu: ui-designer vẽ theo mục này (điện thoại mức Thường, 4 mức, trạng thái sai/đúng nền sáng và tối, hình hướng dẫn 560×360).

### Dữ liệu

Scene gọi `bestBasket.generate(bridge.seed, index, bridge.difficulty)` rồi vẽ theo `BestBasketPuzzle`. Tổng giá và sao cho màn hiện đáp án lấy từ `bestBasketTotals(basket, puzzle)`, không tự tính.

- Mỗi `kind` là một hình đồ ăn vặt vẽ bằng Phaser Graphics, nét phấn, có bóng phẳng. Hình dáng phải khác nhau rõ, **không chỉ khác màu**:

  | `kind` | Hình |
  | --- | --- |
  | `bun` | bánh mì ổ dài, có vạch chéo |
  | `milk` | hộp sữa mái nhọn |
  | `apple` | táo tròn có cuống và lá |
  | `banana` | quả chuối cong |
  | `candy` | kẹo mút xoắn ốc có que |
  | `cookie` | bánh quy tròn có chấm |
  | `juice` | ly có ống hút |
  | `corn` | bắp có lưới hạt |

- Mỗi món có hai nhãn:
  - **thẻ giá**: hình đồng xu cùng chữ số (vd. 🪙3);
  - **thẻ sao**: ngôi sao cùng chữ số (★4). Riêng Mầm, sao vẽ thành **hàng 1–5 ngôi sao**, không ghi số, để trẻ so bằng mắt.
- Không có chữ nào ngoài chữ số và ký hiệu (+, −, ✓, ✗). Không ghi "xu" hay "đ".
- Scene không tự random vị trí hay thứ tự món. Món `i` của giỏ vẽ từ trái sang phải theo đúng mảng.

### Bố cục (khung 720×1280, px thiết kế)

| Vùng | Toạ độ | Nội dung |
| --- | --- | --- |
| Túi xu | x 24–300, y 96–236, góc trái | hình túi vải + đồng xu + số `budget` to (~64 px). Đặt lệch trái để khỏi vướng dải huy hiệu khoá ở giữa |
| Thẻ luật (Khó, Siêu khó) | x 320–696, y 96–236, góc phải | Khó: một thẻ "hình A —dây nối phấn— hình B → +`bonus`★". Siêu khó: hai thẻ cao ~62 px xếp chồng. Thẻ trên là cặp đi kèm. Thẻ dưới là "hình C hình C → đồng xu −`discount`" |
| Giỏ (Thường trở lên) | lưới 2×2: cột x 24–352 / 368–696, hàng y 256–744 / 760–1248 | giỏ `i` ở cột `i % 2`, hàng `⌊i / 2⌋`. Mỗi giỏ vẽ vành giỏ đan, 2 món đặt cạnh nhau (hình ~120 px), dưới mỗi món là thẻ giá rồi thẻ sao. Chừa dải y +380 … +470 trong giỏ cho dòng tổng khi hiện đáp án |
| Khay (Mầm) | 3 khay xếp dọc, x 24–696, y 256–576 / 592–912 / 928–1248 | hình món ~200 px bên trái. Bên phải là thẻ giá (chữ số ~64 px) và hàng sao |

- **Vùng chạm** là cả giỏ (~328 × 488 px thiết kế; khay Mầm 672 × 320), ≥ 48 px thật ở mọi máy. Món, thẻ giá, thẻ luật không nhận chạm riêng.
- Trên máy tính, rê chuột vào giỏ thì giỏ nhấc lên 2 px và phóng 1,02, con trỏ bàn tay.
- **Không đánh dấu trước** giỏ nào đủ cặp đi kèm hay đủ đôi ưu đãi (không vẽ dây nối trong giỏ, không viền). Dò luật là một phần độ khó và đã tính vào mô hình thời gian. Chỉ hiện lúc báo đáp án.
- Chữ số trên thẻ giá, thẻ sao, túi xu có tương phản ≥ 4,5:1. Chữ số đều nhau (tabular). Bản tối lấy màu theo token lúc tạo scene, như các game khác.

### Trạng thái

| Trạng thái | Hình | Thời lượng |
| --- | --- | --- |
| Hiện câu | các giỏ trượt nhẹ vào chỗ. **Chạm được ngay**, không chờ hiệu ứng | ≤ 200 ms |
| Đúng | giỏ đã chọn viền vàng (`--highlight`) + ✓. Dòng tổng của giỏ đó hiện thoáng ("🪙7 ✓ · ★9") | câu mới sau ≤ 300 ms |
| Sai → khoá | xem mục dưới | rung 200 ms; khoá theo `bridge.unlockDelay` rồi sang câu mới |
| Hết giờ giữa câu | ngừng nhận chạm, không gửi gì | — |
| Nối lại giữa vòng | bắt đầu từ `bridge.startIndex` | — |

Chấm ở client để phản hồi tức thì (`check`), server chấm lại. Sau lần chạm đầu tiên, bỏ qua mọi chạm cho tới câu mới, kể cả chạm nhiều ngón.

### Hiện đáp án đúng khi sai

Trong suốt lúc khoá (thời gian từ `bridge.unlockDelay`), mọi thứ nằm **trong vùng giỏ** (y ≥ 256), ngoài dải huy hiệu khoá ở trên cùng khung:

- **Dòng tổng ở mọi giỏ** (dải dưới đáy giỏ). Lấy từ `bestBasketTotals`:
  - vừa tiền: "🪙7 ✓ · ★9";
  - lố tiền: "🪙9 ✗", số 9 gạch ngang, kèm "> 🪙8" nhỏ (số xu trong túi); giỏ mờ 50 % và viền nét đứt.
- **Giỏ đúng:** vòng vàng dày (`--highlight`) + ✓ to. **Giỏ đã chạm:** viền nét đứt đỏ (`--destructive`) + ✗.
- **Chỉ ra vì sao sai:**
  - Chạm giỏ lố tiền (bẫy): ✗ ở dòng tổng của giỏ đó nhấp nháy hai lần.
  - Chạm giỏ vừa tiền nhưng ít sao hơn: hiện "★6 < ★7" giữa giỏ đã chạm và giỏ đúng, hoặc tô nổi hai số sao.
- **Luật đã áp dụng:**
  - Giỏ đủ cặp đi kèm: vẽ dây nối phấn giữa hai món, huy hiệu "+2★" cạnh dòng sao.
  - Giỏ ưu đãi: giá chưa giảm gạch ngang → giá sau giảm, kèm huy hiệu đồng xu "−2". Nhờ đó người chơi thấy giỏ "trông như lố" thật ra vừa tiền (hoặc vẫn lố).
- Đúng, sai và lố phân biệt bằng ✓/✗, nét liền/đứt và chữ số gạch, không chỉ bằng màu.

### Hiệu ứng & âm thanh

| Sự kiện | Hình | Âm (GĐ 2) |
| --- | --- | --- |
| Hiện câu | giỏ trượt nhẹ vào | tiếng "sột" giấy (tuỳ chọn) |
| Đúng | giỏ nảy + ✓ | "ting" tiếng xu rơi, cao dần theo combo |
| Sai | rung + ✗ + hiện dòng tổng | "bụp" trầm; rung máy ngắn |

Khi bật giảm chuyển động: giỏ hiện tại chỗ, không trượt; bỏ rung và nhấp nháy.

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M27 vẽ hình món thẳng từ `art.ts`, nên bố cục, giỏ, thẻ, dòng tổng và các trạng thái của scene hiện tại được giữ nguyên. Chỉ chỉnh:

- `art.ts`: `COLORS.cookie` `0xd9a066` → `0xb97a45`, `COLORS.chip` `0x5b3a22` → `0x4a2c17`. Bánh quy và bánh mì (#e2a052) đang cùng độ chói (0,41–0,42); màu mới 0,25, nhìn thang xám vẫn tách được (artboard BestBasketItems).
- `BestBasketScene.ts` › `drawMark` (✗): nét chéo trắng → token `--destructive-foreground` (sáng #fff8ef, tối #1f1b3a). Trắng trên `--destructive` tối #f07a90 chỉ 2,66:1, mực đạt 6,18:1.
- `BestBasketHowTo.tsx` › `Mark`: `stroke-white` → `stroke-destructive-foreground`.
- Vòng giỏ đúng và ✓ dùng `--primary` #ffd166 như code đang làm (bảng Trạng thái ở trên ghi `--highlight` là nhầm: token đó màu xanh lá).
- **8 món đã chốt** theo `art.ts`: bánh mì ổ dài 3 vạch, hộp sữa mái nhọn, táo có cuống lá, chuối trăng khuyết, kẹo mút đĩa xoắn có que, bánh quy chấm có vết cắn, ly nước cam có ống hút, bắp kẻ ô có lá. Nhận ra được ở cỡ thật ~57 px trên thẻ sáng lẫn tối.
- Chấp nhận: lúc khoá, huy hiệu khoá của GameFrame (y ≈ 30–127) che mép trên thẻ luật, ở Siêu khó che nửa trên món A của thẻ đi kèm; lời giải đã hiện đủ trong giỏ.

## Ghi chú cho BE

Không có gì khác thường.

- Không có pha trình chiếu. Đáp án là một số nguyên 0–3, mỗi câu một tin nhắn, `isAnswer` kiểm chặt. Không đổi giao thức.
- `durationMs = 60_000`, `difficultyMultiplier = { 0: 0.85, 1: 1, 2: 1.4, 3: 1.65 }`.
- `speedAllowanceMs(puzzle) = 250 × max(0, số món − 2) + 500 × số luật`. Server gọi qua `gameSpeedAllowanceMs` với câu tự sinh lại.
- Không khai báo `answerWindowMs`: món không biến mất.
- `generate()` thử dựng câu tối đa 500 lần (đo: trung bình ≤ 9, nhiều nhất 147), mỗi lần chỉ vài phép cộng trên 4 giỏ, nên nhẹ khi server chấm lại.

## Tác động Kiểm tra não

Nhóm Tính toán lên 6 game theo kế hoạch (Bóng bay số, Chạm đích, Đếm tiền nhanh, Đếm sĩ số, Giỏ hời nhất, Đường số), nên xác suất bốc mỗi game trong nhóm giảm. Theo quy tắc ở [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não), khi đăng ký phải:

- thay số giữ chỗ 1 500 bằng điểm chuẩn **1 100**;
- tăng `BRAIN_TEST_RULES_VERSION`, một lần cho cả đợt CR-014;
- thêm dòng "Tính toán · Giỏ hời nhất · 45 s · 5,3 s · 7 % · 7,5 · 7,0 · **1 100** · × 1,62 · × 0,57" vào bảng điểm chuẩn ở GDD.

Việc này do điều phối làm, game designer không sửa `brain-test.ts`.

## Đối chiếu quy tắc thiết kế (GDD §5)

| Quy tắc | Đạt? | Vì sao |
| --- | --- | --- |
| Hiểu trong ≤ 5 giây với một câu + hình | Có | "Nhiều sao nhất, đừng lố tiền" + hình túi xu và giỏ bị ✗ |
| Một câu giải trong 1–8 giây ở mức Thường | Có | ~5,3 s theo mô hình, còn ~3,8 s sau miễn trừ |
| Đúng một đáp án, kiểm được bằng máy | Có | `bestBasketSolve` chỉ nhận giỏ vừa tiền duy nhất nhiều sao nhất; test 10 000 seed × 4 mức |
| Chỉ số nguyên + `createRng()` | Có | giá 1–9, sao 1–5, thưởng 2–3, giảm 2–3; không có phép chia |
| Bốn mức khác rõ; Mầm hợp trẻ 7 tuổi | Có | Mầm chỉ so 3 số ≤ 9 và đếm sao ≤ 5; mỗi mức trên thêm một luật |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Có | 3–4 giỏ lớn, chạm cả giỏ |
| Không phụ thuộc chữ | Có | chỉ có chữ số, ★, đồng xu, + − ✓ ✗; luật vẽ bằng hình món |
| Không chỉ phân biệt bằng màu | Có | 8 hình món khác dáng; vừa/lố có ✓/✗ và nét đứt |

## Câu hỏi mở

1. **Lệch kế hoạch mục 3.8: mỗi giỏ 2 món ở cả Khó lẫn Siêu khó** (kế hoạch: Khó 3 món, Siêu khó 3–4 món). Lý do ở mục Cân bằng: 3 món × 4 giỏ thì Siêu khó chỉ còn ~6 câu mỗi vòng. Nếu chơi thử thấy Khó, Siêu khó quá nhẹ, có thể cho riêng giỏ ưu đãi 3 món [C, C, X]. Theo mô hình, cách này thêm ~0,7 s và phải nới vòng lên 70 s.
2. **Siêu khó đúng ở ngưỡng 8 câu mỗi vòng** (~7,0 s mỗi câu). Nếu chơi thử chậm hơn mô hình, có hai cách: bỏ thẻ đi kèm ở Siêu khó và chỉ giữ ưu đãi (nhưng Siêu khó sẽ gần Khó), hoặc vòng 70 s cho riêng game này.
3. **Luôn đúng 2 giỏ vừa tiền** (Mầm 2/3, mức khác 2/4). Người chơi giỏi có thể nhận ra rồi ngừng cộng giá khi đã thấy 2 giỏ lố. Nếu thành mẹo, cho Thường 1–2 giỏ lố: Thường còn dư thời gian. Khó và Siêu khó nên giữ 2/4, vì đổi số giỏ vừa tiền làm các mức chồng nhau.
4. **Món đi kèm luôn ≤ 4 sao** (món khác 1–5), để "chỉ nhờ thưởng mới thắng" xảy ra đủ thường. Chênh lệch nhỏ, khó nhận ra. Xem lại nếu chơi thử thấy người chơi đoán theo đó.
5. **Không đánh dấu trước giỏ đủ luật.** Nếu trẻ lớn hoặc người lớn thấy dò cặp quá mệt, có thể viền mờ hai món khớp luật. Khi đó Khó và Siêu khó nhẹ đi ~0,4 s, phải tính lại hệ số.
6. **Chồng ý với Đếm tiền nhanh và Chạm đích** (rủi ro kế hoạch đã nêu). Game này khác ở chỗ phải *so sánh* sau khi cộng, với hai ràng buộc và luật đổi giá trị. Chơi thử xem có quá giống không.
7. **Hình 8 món** do ui-designer chốt (Phaser Graphics, phong cách phấn). Tên loại trong code là id tiếng Anh, không hiện ra màn hình.
