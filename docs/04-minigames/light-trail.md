# Theo dấu ánh đèn (`light-trail`)

- Nhóm: Ghi nhớ
- Thời lượng vòng: 60 000 ms — thay cho 45 000 ms của mẫu, lý do ở [Cân bằng](#cân-bằng); **đã duyệt 2026-10-12** ([CR-006](../00-tracking/change-requests.md#cr-006))
- File: `packages/shared/src/games/light-trail/` (logic + test, đã làm), `apps/web/src/games/light-trail/` (`LightTrailScene.ts`, `locales.ts`)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, khu M2 (LightTrailMobile, LightTrailLevels, LightTrailStates, LightTrailHowTo) — đã duyệt 2026-10-12

## Cách chơi

Các ô đèn trên lưới lần lượt sáng lên. Xem hết, rồi chạm lại các ô đúng thứ tự vừa sáng; ở mức Siêu khó thì chạm ngược, bắt đầu từ ô sáng cuối cùng.

## Màn hướng dẫn

- **Cách chơi:**
  1. Xem các ô lần lượt sáng
  2. Chạm lại đúng thứ tự đó
  3. Siêu khó: chạm ngược từ ô cuối
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** một khung tĩnh chia hai nửa, giữa là mũi tên phấn.
  - Nửa trái, *Xem* (biểu tượng mắt phía trên): lưới 3×3 đèn tắt; ba ô 6 → 1 → 5 ghi số phấn 1, 2, 3, nối bằng đường nét đứt có mũi tên; ô số 3 đang sáng (vàng, viền phấn dày, tia sáng).
  - Nửa phải, *Chạm lại* (biểu tượng ngón tay): cùng lưới, ngón tay phấn chạm ô số 1, ô đó có huy hiệu "1"; dải chấm tiến độ 1 đặc, 2 rỗng.
  - Góc dưới phải, cỡ nhỏ: huy hiệu tua ngược (hai tam giác chỉ sang trái) cạnh dãy "3 → 2 → 1", nhắc luật Siêu khó.
- **Câu nhắc lúc đếm ngược:** "Nhớ thứ tự đèn sáng!" (dùng chung cho chạm và click). Siêu khó dùng câu riêng "Nhớ đèn, chạm ngược lại!" qua `levelHints` của `locales.ts` (đã duyệt và đã làm 2026-10-12, cùng các gợi ý chạm ngược khác: huy hiệu tua ngược, chấm tiến độ lấp từ phải, nốt nhạc đi xuống lúc nhập).
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó (UC-21 bước 2): Mầm "3×3 · 3 đèn" · Thường "3×3 · 4 đèn" · Khó "4×4 · 5 đèn" · Siêu khó "4×4 · 5 đèn · ngược".

## Câu đố & đáp án

- `Puzzle` (kiểu `LightTrailPuzzle`): `{ cols, rows, sequence, expected, reverse, leadMs, litMs, stepMs }`
  - `cols = rows` = 3 hoặc 4. Ô đánh số theo hàng, ô 0 ở góc trên trái (giống Kẻ lạc đàn).
  - `sequence: number[]`: các ô theo thứ tự **sáng**, không trùng nhau.
  - `expected: number[]`: thứ tự **phải chạm**. Bằng `sequence`, hoặc `sequence` đảo ngược khi `reverse = true` (chỉ Siêu khó).
  - `leadMs`, `litMs`, `stepMs` (ms, số nguyên): lịch trình chiếu. Đèn thứ `k` (đếm từ 0) bật lúc `leadMs + k × stepMs` và sáng trong `litMs`. Người chơi được nhập từ **`revealMs = leadMs + L × stepMs`** (L = độ dài chuỗi). Shared cung cấp hàm thuần `lightTrailRevealMs(puzzle)` để scene và server dùng cùng một con số.
- `Answer` (kiểu `LightTrailAnswer`): `number[]`, các ô người chơi đã chạm theo thứ tự chạm. Client gom các lần chạm và chỉ gửi **một lần** mỗi câu:
  - chạm đúng đủ L ô → gửi cả mảng, vd. `[6, 1, 5]`;
  - **chạm sai lần đầu → gửi ngay** mảng tính tới lần chạm sai, vd. `[7, 10, 3]`. Khoá 1,5 giây bắt đầu ngay, người chơi không phải bấm nốt.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer` trùng khít `expected` (cùng độ dài, từng phần tử bằng nhau). Mảng thiếu, thừa hoặc có phần tử sai đều là sai.
- `isAnswer(value)`: mảng 1–5 phần tử, mỗi phần tử là số nguyên 0–15. Giới hạn lấy từ bảng tham số (5 = chuỗi dài nhất, 16 = số ô của lưới lớn nhất), không viết cứng. Duyệt theo chỉ số nên mảng thưa (có lỗ) cũng bị từ chối. Mảng có ô trùng vẫn qua `isAnswer` (client hợp lệ không gửi, nhưng nếu có thì `check` chấm sai).

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. Lấy tham số của mức ở bảng [Độ khó](#độ-khó): cạnh lưới `n`, độ dài `L`, `reverse`, `litMs`, `stepMs`; `leadMs = 500` ở mọi mức.
3. Lập danh sách `0, 1, …, n² − 1`, xáo bằng `rng.shuffle` (Fisher–Yates), lấy `L` phần tử đầu làm `sequence`. Đây là lần duy nhất dùng `rng`.
4. `expected` = `sequence` đảo ngược nếu `reverse`, ngược lại bằng `sequence`.

- **Tất định:** kết quả chỉ phụ thuộc `(roundSeed, index, difficulty)`. Mọi số ngẫu nhiên đi qua `createRng`; chỉ số ô và thời gian đều là số nguyên; không đọc giờ, không `Math.random()`.
- **Đúng một đáp án:** `check` so trùng khít với một mảng `expected` duy nhất, nên chỉ một cách chạm được chấp nhận. Lúc xem cũng không có chỗ mơ hồ: mỗi ô sáng tối đa một lần, hai đèn liên tiếp cách nhau khoảng tắt ≥ 150 ms và không bao giờ sáng chồng thời gian, không cho chạm khi đang trình chiếu.
- **Mỗi ô sáng tối đa một lần trong một câu**, nên cũng không bao giờ lặp liền kề. Lý do:
  - một ô sáng hai lần sát nhau dễ bị nhìn thành một lần, nhất là ở nhịp 520 ms, và người chơi sẽ thấy game "ăn gian";
  - phản hồi gọn: ô đã chạm giữ huy hiệu số thứ tự; chạm lại ô đó được **bỏ qua**, không tính sai. Cách này chống chạm đúp do nảy ngón tay mà không bao giờ chặn nhầm đáp án đúng;
  - luật nói được trong một câu, hợp với trẻ 7 tuổi;
  - đã đủ đòn bẩy độ khó (độ dài, cỡ lưới, nhịp, chiều ngược): lưới 4×4 với 5 đèn vẫn có 524 160 chuỗi khác nhau;
  - ở Siêu khó, ô phải chạm đầu tiên luôn khác ô sáng đầu tiên, nên ai quên luật ngược biết ngay ở lần chạm đầu.
- **Cùng gốc giữa các mức** (GDD §6): cùng `(seed, index)` thì chuỗi Mầm là 3 ô đầu của chuỗi Thường (cùng một lần xáo lưới 3×3); Khó và Siêu khó sáng y hệt nhau (cùng một lần xáo lưới 4×4), Siêu khó chỉ khác ở chỗ phải chạm ngược.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Lưới 3×3 · 3 đèn · xuôi · sáng 550 ms, nhịp 800 ms · trình chiếu 2 900 ms | 9 ô to; 3 ô sáng chậm rãi rồi chạm lại |
| Thường | Lưới 3×3 · 4 đèn · xuôi · sáng 450 ms, nhịp 650 ms · trình chiếu 3 100 ms | Vẫn 9 ô; 4 ô sáng, nhịp nhanh hơn |
| Khó | Lưới 4×4 · 5 đèn · xuôi · sáng 360 ms, nhịp 520 ms · trình chiếu 3 100 ms | 16 ô nhỏ hơn, khó gọi tên vị trí; 5 ô sáng nhanh |
| Siêu khó | Lưới 4×4 · 5 đèn · **ngược** · sáng 360 ms, nhịp 520 ms · trình chiếu 3 100 ms | Như Khó, thêm huy hiệu tua ngược; chạm từ ô sáng cuối về ô sáng đầu |

"Nhịp" là khoảng cách giữa hai lần bật đèn (thời gian sáng + khoảng tắt). Nhịp nhanh nhất 520 ms ≈ 1,9 lần nháy mỗi giây, dưới ngưỡng 3 lần/giây của WCAG 2.3.1 (an toàn cho người nhạy cảm ánh sáng).

Độ khó đo được: không mức nào dễ hơn mức trước ở bất kỳ tham số nào, và mỗi mức khó hơn ở ít nhất một tham số.

| Mức | Số chuỗi có thể có | Nhịp | Chiều | Thời gian nhập của cùng một người lớn (ước lượng) | Tỉ lệ đúng mục tiêu |
| --- | --- | --- | --- | --- | --- |
| Mầm | 504 | 800 ms | xuôi | ~1,6 s | ≥ 85 % với trẻ 7 tuổi |
| Thường | 3 024 | 650 ms | xuôi | ~2,3 s | ~90 % |
| Khó | 524 160 | 520 ms | xuôi | ~3,1 s | ~80 % |
| Siêu khó | 524 160, đảo chiều | 520 ms | ngược | ~4,2 s | ~75 % |

Căn cứ chọn độ dài: tầm nhớ vị trí theo thứ tự (kiểu bài Corsi) khoảng 4–5 ô ở trẻ 7 tuổi và 5–7 ô ở người lớn. Mỗi mức đặt độ dài thấp hơn tầm nhớ của người chơi mục tiêu 1–2 ô.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng: `check(p, p.expected)` đúng, còn mọi biến thể đều sai: đổi một phần tử sang ô khác (mọi vị trí, mọi ô), đổi chỗ hai phần tử liền kề, mọi tiền tố ngắn hơn, thêm một phần tử, mảng "tiền tố đúng + một ô sai" (đúng hình dạng client gửi khi sai), và (Siêu khó) chạm xuôi theo `sequence`. Ở Mầm và Thường, test còn duyệt hết 504 / 3 024 chuỗi ô khác nhau trên 200 seed mỗi mức: mỗi câu đúng một chuỗi được nhận.
- `expected` và mọi mảng "tiền tố đúng + ô sai" đều qua `isAnswer`, để server không bao giờ vứt một đáp án hợp lệ.
- `cols = rows = n` của mức; `sequence` dài đúng `L`, không trùng phần tử, mọi phần tử nằm trong `[0, n²)`.
- `expected` bằng `sequence` ở Mầm, Thường, Khó; bằng `sequence` đảo ngược ở Siêu khó, và khi đó `expected[0] ≠ sequence[0]`.
- `leadMs`, `litMs`, `stepMs` đúng bảng; khoảng tắt `stepMs − litMs ≥ 150 ms`; `stepMs ≥ 400 ms`; `revealMs ≤ 3 200 ms`.
- Đèn cuối tắt hẳn trước `revealMs` (Mầm tắt lúc 2 650 ms, nhập từ 2 900 ms; các mức khác tắt lúc 2 900–2 940 ms, nhập từ 3 100 ms).
- Tất định: gọi `generate` hai lần với cùng tham số cho kết quả giống hệt; thêm vài câu cố định (vd. seed 777, câu 5) được ghi cứng trong test, để đổi cách sinh câu đố phải là cố ý.
- Độ khó tăng dần: từ mức 0 tới 3, `L` và `n` không giảm, `stepMs` không tăng, `reverse` chỉ bật ở mức 3; mỗi mức khó hơn mức trước ở ít nhất một tham số. Đo được: số chuỗi có thể có 504 → 3 024 → 524 160 → 524 160 (đảo chiều); số chuỗi khác nhau thật sự xuất hiện trên 10.000 seed là 504 (phủ đủ) → 2 892 → 9 888.
- Không thiên vị vị trí: trên 10.000 seed, số lần mỗi ô là ô sáng đầu tiên lệch ≤ 20 % so với trung bình (đo với bộ seed của test: lệch lớn nhất 4,0 % ở 3×3, 10,4 % ở 4×4).
- Cùng gốc: `sequence` của Mầm là tiền tố của Thường; Khó và Siêu khó có cùng `sequence`.
- `isAnswer` nhận mảng hợp lệ và từ chối: không phải mảng (kể cả `Uint8Array`, đối tượng giả mảng), mảng rỗng, dài hơn 5, phần tử không nguyên, âm, ≥ 16, `NaN`, `Infinity`, chuỗi, `null`, mảng lồng, mảng thưa.
- `speedAllowanceMs` (CR-006) hữu hạn, nguyên, ≥ 0, tất định, bằng `lightTrailRevealMs` và nhỏ hơn thời lượng vòng.

Các điều trên được kiểm bằng test 10.000 seed × 4 độ khó (`light-trail.test.ts`, 12 ca, chạy 2–4 giây).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Số liệu ước lượng trên giấy, đo lại sau buổi chơi thử đầu tiên.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu dự kiến mỗi vòng |
| --- | --- | --- |
| Mầm | xem 2,9 s + nhập ~2,6 s + chuyển câu 0,3 s ≈ 5,8 s | 60 s: ~10 câu (~9 đúng) · 45 s: ~8 câu (~7 đúng) |
| Thường | 3,1 + ~2,3 + 0,3 ≈ 5,7 s | 60 s: ~10–11 (~9–10 đúng) · 45 s: ~8 (~7 đúng) |
| Khó | 3,1 + ~3,1 + 0,3 ≈ 6,5 s | 60 s: ~9 (~7–8 đúng) · 45 s: ~7 (~5–6 đúng) |
| Siêu khó | 3,1 + ~4,2 + 0,3 ≈ 7,6 s | 60 s: ~8 (~6 đúng) · 45 s: ~6 (~4–5 đúng) |

Một câu sai tốn gần bằng câu đúng (xem + nhập dở + khoá 1,5 s); số câu ở bảng đã tính theo tỉ lệ đúng mục tiêu.

**Thời lượng vòng: 60 s (đã duyệt 2026-10-12, CR-006).** Mỗi câu có ~3 s trình chiếu không thao tác được. Với 45 s chỉ còn 6–8 câu: một câu sai mất 1/7 vòng, combo (từ câu đúng thứ 3) hiếm khi thành. 60 s cho 8–11 câu mà thời gian thao tác thật (~25–35 s) vẫn ít hơn một vòng 45 s của game nhận diện. Vẫn nằm trong khung 45–60 s của GDD; trận 3 vòng dài thêm khoảng 45 giây.

**Thưởng tốc độ: không tính thời gian trình chiếu (đã duyệt 2026-10-12, CR-006).** Nếu đo từ lúc câu hiện ra thì tính cả ~3 s trình chiếu mà người chơi không làm gì được.

| Mức | Thưởng mỗi câu, đo từ lúc câu hiện ra | Thưởng mỗi câu, không tính trình chiếu (đã chọn) |
| --- | --- | --- |
| Mầm | ~17 (nhanh nhất cũng chỉ ~29) | ~39 |
| Thường | ~18 | ~42 |
| Khó | ~12 | ~35 |
| Siêu khó | ~3 (nhập chậm hơn 4,6 s là 0) | ~27 |

Đo từ lúc câu hiện ra thì không ai đạt trọn 50, còn ở Khó và Siêu khó phần lớn câu nằm sát sàn nên tốc độ hết ý nghĩa. Vì vậy đồng hồ thưởng tốc độ bắt đầu khi hết trình chiếu (lúc được nhập), giữ nguyên khung 1,5–8 s; hiện thực bằng `speedAllowanceMs` ở mục dưới. Khi đó nhập xong trong ~1,2 s là được trọn 50 (0,3 s hiệu ứng của câu trước vẫn bị tính), và hai người cùng mức nhập 1,5 s và 3,5 s chênh nhau khoảng 16 điểm mỗi câu.

### Hệ số điểm và miễn trừ thời gian (CR-006)

Khai báo trong `lightTrail` (`packages/shared/src/games/light-trail/light-trail.ts`); `scoring.ts` và server dùng các trường này.

| Trường | Giá trị | Cách tính |
| --- | --- | --- |
| `durationMs` | 60 000 | Mục trên. |
| `speedAllowanceMs(puzzle)` | `lightTrailRevealMs(puzzle)` = `leadMs + L × stepMs`: Mầm 2 900 ms; Thường, Khó, Siêu khó 3 100 ms | Đúng phần thời gian không chạm được. Chưa thêm phụ cấp mỗi lần chạm (núm số 3 bên dưới, chờ số liệu chơi thử). |
| `difficultyMultiplier` | Mầm **1** · Thường **1** · Khó **1,55** · Siêu khó **2,2** | Mô phỏng bên dưới. Thay cho hệ số chung 0,8 / 1 / 1,25 / 1,5. |

Cách tính `difficultyMultiplier`: mô phỏng 200 000 vòng 60 s cho mỗi mức, với người chơi mục tiêu ở bảng trên.

- Mỗi câu: xem đúng `revealMs`; nhập mất thời gian ở bảng trên, dao động đều ±30 %; đúng với xác suất bằng tỉ lệ đúng mục tiêu (85 / 90 / 80 / 75 %).
- Câu đúng: 0,3 s hiệu ứng tính vào câu sau, cả vào thời gian tính thưởng. Câu sai: xem + nhập dở (0–100 % thời gian nhập) + khoá 1,5 s; câu sau tính từ lúc hết khoá. Câu chưa xong khi hết giờ không tính.
- Điểm câu đúng theo `scoring.ts`: `(100 × hệ số + thưởng tốc độ) × combo`; thưởng tốc độ đo sau khi trừ `speedAllowanceMs`; combo có trần × 1,5 (CR-006).
- Điểm vòng tuyến tính theo hệ số, nên với mỗi mức giải ra hệ số để điểm vòng kỳ vọng bằng điểm vòng của Thường (hệ số 1), rồi làm tròn tới 0,05.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 10,0 | 8,5 | 9,9 | 39,7 | 1,17 | 1 | ~1 380 (89 %) |
| Thường | 10,0 | 9,0 | 10,9 | 41,9 | 1 | 1 | ~1 550 (100 %) |
| Khó | 8,9 | 7,1 | 8,1 | 36,0 | 1,56 | 1,55 | ~1 540 (99 %) |
| Siêu khó | 7,7 | 5,7 | 6,3 | 27,8 | 2,19 | 2,2 | ~1 560 (101 %) |

- Hệ số chung cũ cho 77 / 100 / 84 / 72 %: chọn mức cao bị thiệt.
- Kết quả ít nhạy với giả định: bỏ trần combo thì hệ số cần là 1,18 / 1,60 / 2,24; bỏ dao động thời gian nhập thì 1,15 / 1,53 / 2,19.
- **Mầm giữ 1 thay vì 1,17** (tự quyết khi hiện thực, xem [Câu hỏi mở](#câu-hỏi-mở)): hệ số không bao giờ giảm khi lên mức, để chọn mức cao hơn không bao giờ được ít điểm hơn trên mỗi câu đúng. Hệ số 1,17 còn làm người lớn chọn Mầm (nhập ~1,6 s, giả định đúng ~97 %) được ~158 % điểm Thường; với 1 là ~144 % (hệ số cũ 0,8: ~124 %). Đổi lại, trẻ ở Mầm còn ~89 % điểm của người lớn ở Thường (hệ số cũ: ~77 %).
- Script mô phỏng không lưu trong repo; khi đổi số thì chạy lại theo đúng các bước trên.

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên (đổi tham số thì sửa bảng Độ khó, test, và tính lại `difficultyMultiplier` theo cách trên; chỉ sửa số trong `light-trail.ts`):

1. Siêu khó đúng < 65 %: chậm nhịp Siêu khó lại (600 ms) hoặc bớt còn 4 đèn.
2. Trẻ ở Mầm đúng < 80 %: nhịp Mầm 900 ms.
3. Thưởng tốc độ của Khó và Siêu khó thấp rõ so với Thường: thêm phụ cấp 300 ms cho mỗi lần chạm sau lần đầu vào `speedAllowanceMs`.

## Ghi chú cho FE

Scene không vẽ chữ: chỉ có biểu tượng, chấm và chữ số. Canvas trong suốt đặt trên khung `bg-muted` của màn chơi, nên ô phải tự có nền và viền để nhìn rõ ở cả giao diện sáng lẫn tối (đọc token màu lúc tạo scene). `locales.ts`: tên "Theo dấu ánh đèn", câu `howTo` lấy từ mục Cách chơi, nội dung màn hướng dẫn lấy từ mục Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: kiểu `LightTrailPuzzle`, `LightTrailAnswer`, hàm `lightTrailRevealMs`, hằng `WRONG_ANSWER_LOCK_MS`. Mọi số đều là số nguyên.

| Trường | Kiểu | Dùng để |
| --- | --- | --- |
| `cols`, `rows` | `number`, 3 hoặc 4, luôn bằng nhau | Chọn bố cục 3×3 hay 4×4. Ô `i` ở hàng `Math.floor(i / cols)`, cột `i % cols`. |
| `sequence` | `number[]`, 3–5 ô khác nhau | Trình chiếu: đèn thứ k là ô `sequence[k]`. |
| `expected` | `number[]`, cùng độ dài với `sequence` | Chấm từng lần chạm ở client; vẽ đáp án đúng lúc khoá. |
| `reverse` | `boolean` | Siêu khó: huy hiệu tua ngược, chấm tiến độ lấp từ phải. |
| `leadMs`, `litMs`, `stepMs` | `number` (ms) | Lịch: đèn k bật lúc `leadMs + k × stepMs`, sáng trong `litMs`. |
| `lightTrailRevealMs(puzzle)` | hàm trả về `number` (ms) | Hết trình chiếu, bắt đầu nhận chạm. Server dùng đúng số này để trừ khỏi thời gian tính thưởng tốc độ. |

`LightTrailAnswer` là `number[]`: các ô đã chạm theo thứ tự chạm, gửi một lần mỗi câu (xem *Gửi đáp án* bên dưới). Không đưa vào mảng những lần chạm bị bỏ qua: chạm lúc đang chiếu, chạm lại ô đã chạm, chạm vào khe hay ngoài lưới.

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | y 72–280 | Biểu tượng pha 112×112, tâm (360, 150): mắt khi đang chiếu, ngón tay khi tới lượt. Siêu khó thêm huy hiệu tua ngược 80×80, tâm (500, 150), hiện suốt câu. Dải chấm tiến độ tâm y = 250: L chấm Ø 28 px, cách nhau 20 px. |
| Lưới đèn | khung 600×600, góc trên trái (60, 340) | 3×3: ô 176 px, khe 36 px; ô hàng r cột c bắt đầu tại (60 + 212c, 340 + 212r). 4×4: ô 132 px, khe 24 px; bắt đầu tại (60 + 156c, 340 + 156r). Viền khung lưới màu nhóm Ghi nhớ (`--color-memorize`). |
| Dưới | y 1000–1220 | Thanh khoá 420×14 px, tâm (360, 1040), chỉ hiện khi sai. Phần còn lại để trống cho ngón cái và safe-area. |

Vùng chạm đúng bằng ô: 132–176 px, trên điện thoại ngang 390 px còn khoảng 65–88 px. Chạm vào khe hay ngoài lưới thì bỏ qua. Chỉ nhận một điểm chạm mỗi lúc; dùng `pointerdown` để phản hồi tức thì như Kẻ lạc đàn.

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Đang trình chiếu | Từ lúc câu hiện tới `revealMs` | Biểu tượng mắt nảy lúc câu mới; các ô tắt; đèn lần lượt sáng theo lịch trong Puzzle; chấm k lấp đặc khi đèn k sáng | Không: bỏ qua, không tính sai; con trỏ thường |
| Chờ nhập | Từ `revealMs` tới lần chạm đầu | Mắt đổi thành ngón tay (nảy 150 ms), chấm về rỗng; Siêu khó: huy hiệu tua ngược nảy một lần; máy tính: con trỏ bàn tay, rê chuột thấy viền mảnh trên ô | Có |
| Đang nhập | Sau mỗi lần chạm đúng, chưa đủ L | Ô vừa chạm sáng 150 ms rồi giữ huy hiệu số thứ tự chạm; chấm tương ứng lấp đặc (chấm k luôn ứng với đèn k, nên xuôi lấp từ trái, Siêu khó lấp từ phải) | Có; chạm lại ô đã chạm thì bỏ qua |
| Đúng | Chạm đúng ô thứ L | Gửi đáp án; các ô đã chạm cùng nảy 300 ms; sang câu mới | Không |
| Sai / khoá | Lần chạm sai đầu tiên | Gửi ngay; ô sai hiện dấu X và lắc; chấm của bước sai hiện X; lưới mờ còn 35 % nhưng dấu X và đáp án đúng vẫn rõ (xem *Hiện đáp án đúng khi sai*); thanh khoá rút ngắn trong `WRONG_ANSWER_LOCK_MS` (1 500 ms); hết khoá sang câu mới | Không, trong 1 500 ms |

**Gửi đáp án:** giữ mảng các ô đã chạm của câu. Mỗi lần chạm hợp lệ, thêm ô vào mảng rồi so với `expected` ở cùng vị trí. Khác thì gọi `bridge.submit(index, mảng)` và vào Sai/khoá; đủ L ô thì gọi `bridge.submit(index, mảng)` và vào Đúng. Chấm ngay ở client như Kẻ lạc đàn; server chấm lại để tính điểm.

### Hiện đáp án đúng khi sai (CR-006)

Áp dụng cho mọi game (CR-006): trả lời sai thì hiện đáp án đúng suốt 1,5 giây khoá. Ở game này:

- Vào Sai/khoá là hiện ngay, không chờ server (client đã có `expected`). Hiện trong cả 1 500 ms khoá; hết khoá thì xoá cùng lúc với lưới mờ dần vào câu mới.
- Trên ô `expected[k]` vẽ số `k + 1` trong vòng tròn nét đứt màu phấn, nền `--card` để vẫn đọc được trên lưới mờ 35 %. Số là thứ tự **phải chạm**, nên ở Siêu khó số 1 nằm ở ô sáng cuối (`sequence[L − 1]`).
- Vòng số đặt giữa ô; huy hiệu thứ tự của các ô đã chạm đúng nằm ở góc trên trái, nên hai thứ không đè nhau.
- Nếu ô chạm sai cũng nằm trong `expected`, vẽ dấu X trước rồi vòng số đè lên, để người chơi thấy cả "chạm sai lúc này" lẫn "ô này là bước thứ mấy". Trường hợp này hay gặp: ở Siêu khó, ai quên luật ngược sẽ chạm ô sáng đầu, tức ô mang số L.
- Khi bật *giảm chuyển động*: vòng số hiện ngay, không mờ dần.

### Hiển thị ô (không chỉ bằng màu)

- *Tắt:* nền tối (gợi ý màu mực `--sticker`), viền 3 px (`--chalk-muted` ở giao diện tối để tách khỏi nền), hình bóng đèn phấn mờ ở giữa.
- *Sáng:* nền vàng `--primary`, phóng to 110 %, viền phấn trắng 6 px, 8 tia sáng ngắn nằm trong khe (không đè ô bên cạnh). Chênh độ sáng giữa ô tắt và ô sáng ≥ 4,5 : 1 ở cả hai giao diện, nên người mù màu vẫn thấy rõ. Không dùng đỏ hay hồng cho đèn sáng: nháy đỏ gây khó chịu và dễ lẫn với màu báo sai.
- *Đã chạm:* nền tối, viền trong vàng 3 px, huy hiệu số thứ tự chạm ở góc trên trái (nền giấy `--card`, chữ số Baloo 2 đậm; Ø 48 px ở lưới 3×3, 40 px ở 4×4).
- *Chạm sai:* dấu X lớn hai nét 10 px, màu `--destructive` có viền phấn trắng.
- *Đáp án đúng (lúc khoá):* số 1…L trong vòng tròn nét đứt màu phấn. Ở Siêu khó, số 1 nằm ở ô sáng cuối.

### Hiệu ứng (đều ≤ 400 ms)

- Bật đèn 80 ms (sáng lên và phóng to), tắt 100 ms, đều nằm trong `litMs`.
- Chạm đúng: ô sáng 150 ms. Chạm lại ô đã chạm: lắc nhẹ 100 ms, không âm thanh.
- Đúng cả câu: các ô đã chạm nảy lên 115 % rồi về, 300 ms. Giữ ≤ 300 ms vì phần này vẫn tính vào thời gian của câu sau, như mọi game.
- Sai: ô lắc ngang ±8 px trong 200 ms, dấu X hiện trong 120 ms, lưới mờ trong 150 ms.
- Đổi pha: biểu tượng nảy 150 ms. Câu mới: xoá huy hiệu, lưới mờ dần vào trong 120 ms.
- Khi bật *giảm chuyển động*: bỏ phóng to, nảy, lắc; giữ đổi độ sáng, viền, tia sáng, huy hiệu, dấu X. Lịch trình chiếu giữ nguyên vì là luật chơi.

### Âm thanh (GĐ 2)

- Mỗi lần đèn sáng: tiếng "bíp" mềm, cao độ đi lên theo thứ tự đèn (nốt 1–5 của thang ngũ cung) và **giống nhau cho mọi ô**. Âm thanh không tiết lộ vị trí nên người tắt tiếng không bị thiệt.
- Lúc nhập, lần chạm thứ k phát nốt của đèn tương ứng: xuôi thì đi lên, Siêu khó thì đi xuống (nhắc chiều ngược bằng tai). Nốt chỉ phụ thuộc số lần đã chạm nên không lộ đúng hay sai.
- Tới lượt nhập: tiếng "tách" hai nốt. Đúng: "ting" cao dần theo combo. Sai: "bụp" trầm và rung ngắn.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, chiếu câu đó lại từ đầu.
- Ẩn tab hoặc chuyển app lúc đang chiếu: quay lại thì chiếu lại câu từ đầu. Đang ở pha nhập thì giữ nguyên.
- Lịch trình chiếu chạy bằng đồng hồ của scene (`this.time`), không theo giờ server; bắt đầu sau khung hình đầu tiên để đèn đầu không bị giật.

### Ví dụ để vẽ bản mẫu

Đánh số ô:

```
3×3          4×4
0 1 2         0  1  2  3
3 4 5         4  5  6  7
6 7 8         8  9 10 11
             12 13 14 15
```

Mỗi mức một câu; mỗi câu vẽ một trạng thái khác nhau để bản mẫu phủ đủ các trạng thái. Lịch tính bằng ms từ lúc câu hiện ra.

| Mức | Câu đố | Lịch trình chiếu | Khung nên vẽ |
| --- | --- | --- | --- |
| Mầm | 3×3, `sequence = [6, 1, 5]`, xuôi, `expected = [6, 1, 5]` | ô 6: 500–1 050 · ô 1: 1 300–1 850 · ô 5: 2 100–2 650 · nhập từ 2 900 | **Đang trình chiếu**, lúc 1 500 ms: ô 1 đang sáng, các ô khác tắt; biểu tượng mắt; chấm 2 đặc, 1 rỗng. Chơi đúng sẽ gửi `[6, 1, 5]`. |
| Thường | 3×3, `sequence = [0, 5, 7, 2]`, xuôi, `expected` giống `sequence` | ô 0: 500–950 · ô 5: 1 150–1 600 · ô 7: 1 800–2 250 · ô 2: 2 450–2 900 · nhập từ 3 100 | **Đang nhập**: đã chạm ô 0 (huy hiệu 1) và ô 5 (huy hiệu 2); biểu tượng ngón tay; chấm 2 đặc, 2 rỗng. Bản máy tính: chuột đang rê trên ô 7. |
| Khó | 4×4, `sequence = [9, 2, 15, 4, 11]`, xuôi, `expected` giống `sequence` | ô 9: 500–860 · ô 2: 1 020–1 380 · ô 15: 1 540–1 900 · ô 4: 2 060–2 420 · ô 11: 2 580–2 940 · nhập từ 3 100 | **Đúng**: 5 ô có huy hiệu 1–5 cùng nảy; chấm 5 đặc; vừa gửi `[9, 2, 15, 4, 11]`. Điểm cộng do React vẽ, không thuộc scene. |
| Siêu khó | 4×4, `sequence = [13, 6, 0, 10, 7]`, ngược, `expected = [7, 10, 0, 6, 13]` | ô 13: 500–860 · ô 6: 1 020–1 380 · ô 0: 1 540–1 900 · ô 10: 2 060–2 420 · ô 7: 2 580–2 940 · nhập từ 3 100 | **Sai / khoá**: đã chạm ô 7 (huy hiệu 1), ô 10 (huy hiệu 2) rồi chạm nhầm ô 3 (lẽ ra là ô 0), gửi ngay `[7, 10, 3]`. Ô 3 có dấu X; lưới mờ; số nét đứt: ô 7 = 1, ô 10 = 2, ô 0 = 3, ô 6 = 4, ô 13 = 5; huy hiệu tua ngược; chấm lấp từ phải: 2 đặc, chấm giữa có X, 2 rỗng; thanh khoá đang chạy. |

Nếu kịp, vẽ thêm Siêu khó ở trạng thái **Chờ nhập** (huy hiệu tua ngược đang nảy, 5 chấm rỗng).

## Ghi chú cho BE

- **Không cần tin nhắn mới.** Đáp án là mảng số; `AnswerSchema.answer` đã là `z.unknown()` và `isAnswer` kiểm hình dạng. Mỗi câu chấm một lần, server không theo dõi từng lần chạm.
- **Thời lượng 60 s:** đã đặt `durationMs: 60_000` trong `lightTrail` (FR-VC-03 đã hỗ trợ thời lượng theo game).
- **Thưởng tốc độ (đã duyệt 2026-10-12, CR-006):** đề xuất trường `revealMs` ban đầu được gộp vào trường chung `speedAllowanceMs` của CR-006.
  - `lightTrail.speedAllowanceMs(puzzle)` trả về `lightTrailRevealMs(puzzle)` (2 900 hoặc 3 100 ms). Server tính `answerMs = max(0, now − shownAt − allowance)` trước khi gọi `scoring.ts`.
  - `lightTrail.difficultyMultiplier` = Mầm 1 · Thường 1 · Khó 1,55 · Siêu khó 2,2, thay cho `DIFFICULTY_MULTIPLIER` chung (cách tính ở [Cân bằng](#hệ-số-điểm-và-miễn-trừ-thời-gian-cr-006)).
  - **Không từ chối** đáp án đến sớm hơn `revealMs`. Lệch mạng có thể làm đáp án thật đến sớm vài trăm ms; nếu bỏ qua, `progress` của server lệch với client và người chơi kẹt tới hết vòng. Chỉ kẹp về 0.

## Đối chiếu quy tắc thiết kế

| Quy tắc (GDD §5) | Cách đáp ứng |
| --- | --- |
| Hiểu trong ≤ 5 giây | "Xem đèn sáng, chạm lại đúng thứ tự" + hình hai nửa Xem / Chạm lại |
| Một câu 1–8 giây ở Thường | Phần nhập ~2,3 s; cả câu ~5,7 s kể cả 3,1 s xem |
| Đúng một đáp án, test 10.000 seed | `check` so trùng khít `expected`; xem mục Đảm bảo |
| Chỉ số nguyên + `createRng` | Một lần `rng.shuffle`; mọi tham số là số nguyên |
| Bốn mức rõ rệt, Mầm cho trẻ 7 tuổi | 3 → 4 → 5 đèn, 9 → 16 ô, nhịp 800 → 520 ms, chiều ngược ở Siêu khó; Mầm 3 đèn, dưới tầm nhớ 4–5 vị trí của trẻ 7 tuổi |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Ô 176 px (3×3) / 132 px (4×4) |
| Không phụ thuộc chữ | Scene chỉ có biểu tượng, chấm, chữ số |
| Không chỉ phân biệt bằng màu | Đèn sáng: sáng hơn, phóng to, viền dày, tia sáng; đã chạm: huy hiệu số; sai: dấu X; chiều ngược: huy hiệu tua ngược và hướng lấp chấm |

## Câu hỏi mở

Đã chốt (2026-10-12, cùng CR-006): thời lượng vòng 60 s; thưởng tốc độ không tính thời gian trình chiếu (hiện thực bằng `speedAllowanceMs`); phụ cấp mỗi lần chạm chưa làm, giữ làm núm chỉnh sau chơi thử như đã viết ở [Cân bằng](#cân-bằng).

Còn mở:

- **Hệ số Mầm 1 hay 1,15?** Mô phỏng cho thấy trẻ 7 tuổi ở Mầm cần 1,17 để bằng điểm người lớn ở Thường. Đã chọn 1 để hệ số không giảm khi lên mức và bớt lợi cho người lớn chọn Mầm; trẻ còn ~89 %. Chọn 1,15 thì trẻ ~99 %, nhưng người lớn ở Mầm lên ~158 %.
- Màn đếm ngược có hỗ trợ **câu nhắc theo độ khó** không (để Siêu khó nhắc "chạm ngược")? Câu riêng cho Siêu khó đã duyệt; nếu màn đếm ngược không hỗ trợ thì dùng câu chung.
- Sau MVP: phím số cho lưới 3×3 trên máy tính; biến thể cho một ô sáng hai lần (không liền kề) hoặc trộn xuôi/ngược từng câu ở Siêu khó.
