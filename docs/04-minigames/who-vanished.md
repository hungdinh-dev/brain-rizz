# Ai vừa biến mất (`who-vanished`)

- Nhóm: Ghi nhớ
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; mỗi câu có 3,4 s xem + che không thao tác được, giống Theo dấu ánh đèn)
- File: `packages/shared/src/games/who-vanished/` (logic + test, đã làm), `apps/web/src/games/who-vanished/` (scene, màn hướng dẫn, chữ hiển thị; đã làm theo bản mẫu, chờ chơi thử)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M10** (WhoVanishedMobile, WhoVanishedLevels, WhoVanishedStates, WhoVanishedHowTo), đã duyệt

## Cách chơi

Xem khay đồ vật trong 3 giây. Rèm che lại, khay hiện ra với một ô trống: chạm vào thẻ của món vừa biến mất.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhớ các món trên khay
  2. Một món biến mất
  3. Chạm thẻ của món đó
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng ở MVP.
- **Hình minh hoạ:** theo artboard WhoVanishedHowTo. Ba phần, nối bằng mũi tên phấn:
  - Trái, biểu tượng mắt: khay 2×2 viền hồng có táo, cà rốt, miếng dưa hấu, chuối; dưới khay là thanh xem đang rút.
  - Giữa: mắt nhắm trên tấm rèm hồng đang hạ xuống.
  - Phải, biểu tượng ngón tay: cùng khay, ô dưới phải trống có dấu "?"; dưới khay ba thẻ nấm, chuối, dâu tây; thẻ chuối được khoanh phấn vàng, có bàn tay chỉ vào và mũi tên nét đứt bay về ô trống.
  - Góc dưới trái, cỡ nhỏ: huy hiệu đổi chỗ cạnh hai ô táo, chuối có mũi tên vòng đổi cho nhau (nhắc luật Siêu khó).
- **Câu nhắc lúc đếm ngược:** "Nhớ hết các món trên khay!"
- **Câu nhắc theo mức:** Siêu khó: "Khay sẽ xáo: nhớ món, đừng nhớ chỗ!" (qua `levelHints` của `locales.ts`).
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "4 món · 3 thẻ" · Thường "6 món · 4 thẻ" · Khó "9 món · 4 thẻ" · Siêu khó "9 món · đổi chỗ".

## Câu đố & đáp án

- `Puzzle` (kiểu `WhoVanishedPuzzle`): `{ cols, rows, shown, vanishedCell, remaining, blankCell, shuffled, choices, answerIndex, viewMs, coverMs }`
  - `cols × rows`: 2×2 (Mầm), 3×2 (Thường), 3×3 (Khó, Siêu khó). Ô đánh số theo hàng, ô 0 ở góc trên trái: ô `i` ở hàng `Math.floor(i / cols)`, cột `i % cols`.
  - `shown: WhoVanishedItem[]`: khay lúc **xem**, theo ô. Các món đôi một khác nhau.
  - `vanishedCell`: ô của món biến mất trên khay lúc xem.
  - `remaining: (WhoVanishedItem | null)[]`: khay lúc **hỏi**, theo ô, `null` ở đúng một ô (ô "?").
  - `blankCell`: ô có dấu "?". Bằng `vanishedCell`, trừ Siêu khó.
  - `shuffled`: `true` chỉ ở Siêu khó: món còn lại đều đổi chỗ khi hỏi.
  - `choices: WhoVanishedItem[]`: hàng thẻ trái → phải, 3 thẻ (Mầm) hoặc 4 thẻ.
  - `answerIndex`: chỉ số thẻ của món biến mất.
  - `viewMs = 3 000`, `coverMs = 400`. Shared có hàm `whoVanishedRevealMs(puzzle)` = `viewMs + coverMs` = 3 400 ms, lúc bắt đầu được chạm.
- `WhoVanishedItem`: một trong 16 ID ở `WHO_VANISHED_ITEMS` (xem [Bộ vật](#bộ-vật)). Các cặp cùng loại khác dáng ở `WHO_VANISHED_TWINS`.
- `Answer` (kiểu `WhoVanishedAnswer`): `number`, chỉ số thẻ đã chạm. Chạm một lần là nộp.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer === answerIndex`.
- `isAnswer(value)`: số nguyên 0–3 (3 = số thẻ nhiều nhất − 1, lấy từ bảng tham số).

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. Gom bộ vật thành 13 **loại**: 3 cặp cùng loại (mỗi cặp một loại, hai món) và 10 món lẻ (mỗi món một loại).
3. **Mầm, Thường, Khó:** xáo các loại, lấy `n + k − 1` loại đầu (n = số ô, k = số thẻ), mỗi loại chọn ngẫu nhiên một món. `n` món đầu xếp vào khay theo thứ tự đó (`shown`), `k − 1` món sau là thẻ mồi. Chọn ngẫu nhiên đều một ô làm `vanishedCell`.
4. **Siêu khó (cặp bẫy):** chọn ngẫu nhiên một cặp cùng loại, xáo thành (a, b). 12 loại còn lại được xáo và chọn món như bước 3 (`others`). Rồi:
   - 1/4 số câu: khay = a, b + 7 món của `others`, xáo chỗ; **b biến mất**; 3 thẻ mồi lấy tiếp từ `others`. Lúc hỏi a vẫn còn trên khay, thẻ đúng là "anh em" của a.
   - 3/4 số câu: khay = a + 8 món của `others`, xáo chỗ; món biến mất chọn đều trong 8 món kia (không phải a); thẻ mồi = **b** + 2 món tiếp của `others`. Thẻ "anh em" của a là bẫy.
   - Vì thế luôn có đúng một thẻ là "anh em" của một món còn trên khay, và thẻ đó là đáp án đúng ~1/4 số câu, bằng xác suất của một thẻ bất kỳ: mẹo "chọn thẻ anh em" hay "loại thẻ anh em" đều không giúp đoán mò.
5. `remaining`: Mầm, Thường, Khó chép `shown`, để `null` ở `vanishedCell`. Siêu khó lấy một hoán vị vòng ngẫu nhiên (thuật toán Sattolo, `perm[i] ≠ i` với mọi ô), đặt món ở ô `i` sang ô `perm[i]`; ô "?" là `perm[vanishedCell]`. Nên mọi món còn lại đều sang ô khác, ô "?" cũng khác chỗ cũ.
6. `choices` = xáo [món biến mất, …thẻ mồi]; `answerIndex` = vị trí của món biến mất.

- **Tất định:** chỉ phụ thuộc `(roundSeed, index, difficulty)`; mọi ngẫu nhiên đi qua `createRng`; mọi số là số nguyên.
- **Đúng một đáp án:** thẻ mồi lấy từ các loại không có trên khay, nên không thẻ mồi nào có mặt lúc xem. Món biến mất có lúc xem và không còn lúc hỏi. Vậy đúng một thẻ thoả "có lúc xem, không còn lúc hỏi". Các thẻ đôi một khác nhau.
- **Không có chỗ nhầm vì giống hình ngoài ý muốn:** mỗi loại xuất hiện tối đa một món trong cả khay lẫn hàng thẻ; chỉ Siêu khó có đúng một cặp cùng loại, và đó là bẫy có chủ đích.

## Bộ vật

16 món, vẽ cùng cỡ, phân biệt bằng **dáng** (không chỉ bằng màu). 8 món đầu dùng lại hình của Cân não; 5 món đã có ở bản mẫu; **3 món cần vẽ thêm** (ui-designer / frontend-dev).

| ID | Món | Nguồn hình |
| --- | --- | --- |
| `apple` | Táo đỏ | Cân não |
| `pear` | Lê | Cân não |
| `banana` | Chuối | Cân não |
| `carrot` | Cà rốt | Cân não |
| `mushroom` | Nấm | Cân não |
| `grapes` | Chùm nho | Cân não |
| `strawberry` | Dâu tây | Cân não |
| `watermelon` | Miếng dưa hấu | Cân não |
| `cherry` | Anh đào | Bản mẫu M10 |
| `pineapple` | Dứa | Bản mẫu M10 |
| `lemon` | Chanh | Bản mẫu M10 |
| `pumpkin` | Bí ngô | Bản mẫu M10 |
| `apple-bitten` | Táo xanh cắn dở | Bản mẫu M10 |
| `corn` | Bắp ngô | **Cần vẽ** |
| `banana-peeled` | Chuối bóc dở (vỏ xoè ba cánh) | **Cần vẽ** |
| `watermelon-whole` | Quả dưa hấu nguyên (tròn, có sọc) | **Cần vẽ** |

Cặp cùng loại khác dáng (`WHO_VANISHED_TWINS`): `apple` / `apple-bitten`, `banana` / `banana-peeled`, `watermelon` / `watermelon-whole`. Hai món trong cặp phải khác **dáng** rõ ở cỡ thẻ 152 px (vết cắn, vỏ xoè, tròn hay tam giác), không chỉ khác màu.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Khay 2×2 · 4 món · 3 thẻ · xem 3 s, che 0,4 s | 4 ô to; món còn lại đứng yên, ô "?" ở đúng chỗ cũ |
| Thường | Khay 3×2 · 6 món · 4 thẻ · xem 3 s, che 0,4 s | 6 ô; thêm một thẻ mồi |
| Khó | Khay 3×3 · 9 món · 4 thẻ · xem 3 s, che 0,4 s | 9 ô nhỏ hơn; nhớ nhiều món hơn trong cùng 3 giây |
| Siêu khó | Khay 3×3 · 9 món · 4 thẻ · **đổi chỗ** · **cặp bẫy cùng loại** · xem 3 s, che 0,4 s | Khi hỏi, mọi món đều sang ô khác, ô "?" ở chỗ ngẫu nhiên; có một cặp "anh em" (vd. táo đỏ / táo xanh cắn dở), một món trên khay, một món trên thẻ |

Độ khó đo được (10 000 câu, 2 500 seed mỗi mức):

| Mức | Số món phải nhớ | Số thẻ (đoán mò đúng) | Vị trí giúp nhớ? | Bẫy cùng loại | Số bộ khay khác nhau trên 2 500 câu |
| --- | --- | --- | --- | --- | --- |
| Mầm | 4 | 3 (33 %) | có | không | 1 144 |
| Thường | 6 | 4 (25 %) | có | không | 1 888 |
| Khó | 9 | 4 (25 %) | có | không | 1 667 |
| Siêu khó | 9 | 4 (25 %) | **không** (mọi món đổi chỗ) | có, thẻ anh em đúng 25,3 % | 2 018 |

Không mức nào dễ hơn mức trước ở bất kỳ tham số nào; mỗi mức khó hơn ở ít nhất một tham số. Thời gian xem giữ 3 s ở mọi mức (luật đã duyệt); độ khó tăng bằng số món, số thẻ, đổi chỗ và bẫy.

## Đảm bảo khi sinh câu đố

Kiểm bằng `who-vanished.test.ts` (10 ca, 10 000 câu × 4 mức, chạy ~1 s):

- Luôn có đúng một đáp án: `check` chỉ đúng ở `answerIndex`; và theo đúng luật chơi, đúng một thẻ "có lúc xem, không còn lúc hỏi", chính là `choices[answerIndex]`.
- `shown` đủ `cols × rows` món, đôi một khác nhau, thuộc bộ vật. `remaining` có đúng một `null` tại `blankCell` và chứa đúng các món của `shown` trừ món biến mất.
- Mầm, Thường, Khó: món còn lại giữ nguyên ô, `blankCell = vanishedCell`. Siêu khó: mọi món còn lại sang ô khác, `blankCell ≠ vanishedCell`.
- Thẻ đủ số lượng, đôi một khác nhau; thẻ mồi không có trên khay lúc xem.
- Mầm, Thường, Khó không bao giờ có hai món cùng loại (trên khay lẫn thẻ). Siêu khó có đúng một cặp: một món còn trên khay lúc hỏi, món kia trên hàng thẻ; thẻ đó là đáp án 21–29 % số câu (đo được 25,3 %).
- Không thiên vị: số lần mỗi thẻ là đáp án lệch < 15 % so với trung bình, mỗi ô là ô biến mất lệch < 20 % (đo được: lệch lớn nhất 7 % ở thẻ, 8 % ở ô).
- Tất định: cùng tham số → cùng câu; câu cố định (seed 777, câu 5) ghi cứng bằng inline snapshot.
- `isAnswer` nhận 0–3, từ chối −1, 4, 1,5, `NaN`, vô cực, chuỗi, `null`, `undefined`, mảng, đối tượng.
- `speedAllowanceMs` = `whoVanishedRevealMs` = 3 400 ms ở mọi mức, nhỏ hơn thời lượng vòng. Hệ số điểm không giảm khi lên mức.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Số liệu ước lượng trên giấy, đo lại sau buổi chơi thử đầu tiên.

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ đúng mục tiêu | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | xem + che 3,4 s + chọn ~2,2 s + chuyển 0,3 s ≈ 5,9 s | ~85 % (trẻ 7 tuổi) | ~9,8 câu (~8,3 đúng) |
| Thường | 3,4 + ~1,5 + 0,3 ≈ 5,2 s | ~90 % | ~11 câu (~9,9 đúng) |
| Khó | 3,4 + ~2,0 + 0,3 ≈ 5,7 s | ~80 % | ~10 câu (~8 đúng) |
| Siêu khó | 3,4 + ~2,6 + 0,3 ≈ 6,3 s | ~70 % | ~9,2 câu (~6,2 đúng) |

Thời gian "chọn" là lúc nhìn 3–4 thẻ, nhận ra món nào đã thấy, chạm một lần. Siêu khó chậm hơn vì khay đã xáo (không dò theo ô được) và phải soi cặp anh em. Các mức không chồng nhau ở phần chọn (2,2 s trẻ em / 1,5 / 2,0 / 2,6 s người lớn); Siêu khó vẫn còn ~9 câu mỗi vòng (≥ 8).

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `whoVanished`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | 3 400 | Mô phỏng trẻ 7 tuổi cần 1,41 → min(1,41; 1) = 1 |
| Thường | 1 | 3 400 | Mốc so sánh |
| Khó | **1,55** | 3 400 | Mô phỏng cần 1,53, làm tròn tới 0,05 |
| Siêu khó | **2,25** | 3 400 | Mô phỏng cần 2,26, làm tròn tới 0,05 |

- `speedAllowanceMs(puzzle)` = `whoVanishedRevealMs(puzzle)` = xem 3 000 + che 400 ms: phần thời gian không chạm được. Đo từ lúc câu hiện ra thì không ai đạt trọn 50 điểm tốc độ.
- Cách mô phỏng (200 000 vòng 60 s mỗi mức, giống Theo dấu ánh đèn): mỗi câu xem + che 3,4 s; thời gian chọn ở bảng trên, dao động đều ±30 %; đúng theo tỉ lệ mục tiêu. Câu đúng: 0,3 s hiệu ứng tính vào câu sau (cả vào thời gian tính thưởng). Câu sai: 3,4 s + chọn dở + khoá 1,5 s. Điểm theo `scoring.ts`: `(100 × hệ số + thưởng tốc độ) × combo`, thưởng tốc độ tính sau khi trừ 3 400 ms, combo trần × 1,5. Điểm vòng tuyến tính theo hệ số nên giải ra hệ số để bằng Thường.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 9,8 | 8,3 | 9,7 | 42,9 | 1,41 | 1 | ~1 385 (78 %) |
| Thường | 11,0 | 9,9 | 12,1 | 47,9 | 1 | 1 | ~1 783 (100 %) |
| Khó | 10,0 | 8,0 | 9,0 | 44,6 | 1,53 | 1,55 | ~1 803 (101 %) |
| Siêu khó | 9,2 | 6,2 | 6,7 | 40,2 | 2,26 | 2,25 | ~1 779 (100 %) |
| Người lớn chọn Mầm (chọn ~1,2 s, đúng ~97 %) | 11,9 | 11,6 | 15,0 | 49,4 | 0,70 | 1 | ~2 239 (126 %) |

- Hệ số chung cũ (0,8 / 1 / 1,25 / 1,5) làm người chọn mức cao bị thiệt rõ, vì Khó và Siêu khó ít câu đúng hơn hẳn trong khi thời gian xem cố định.
- Script mô phỏng không lưu trong repo; đổi tham số thì chạy lại theo đúng các bước trên.

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên (đổi thì sửa bảng Độ khó, test, và tính lại hệ số; chỉ sửa số trong `who-vanished.ts`):

1. Siêu khó đúng < 60 %: bỏ bẫy cùng loại, giữ đổi chỗ (hoặc ngược lại tuỳ lỗi hay gặp).
2. Trẻ ở Mầm đúng < 80 %: xem 3,5 s ở Mầm (đổi `VIEW_MS` thành tham số theo mức).
3. Khó và Thường quá gần nhau: Khó lên 5 thẻ (cần 5 thẻ vừa hàng 720 px, xem Ghi chú cho FE).

## Ghi chú cho FE

**Bản mẫu đã duyệt (bám sát):** [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang Minigame, hàng M10: `WhoVanishedMobile` (Thường, chờ chọn), `WhoVanishedLevels` (4 mức, mỗi mức một trạng thái), `WhoVanishedStates` (che khay, sai ở nền tối, đúng ở nền tối, bộ vật), `WhoVanishedHowTo`.

Scene không vẽ chữ: chỉ hình vật, dấu "?", biểu tượng, thanh thời gian. Canvas trong suốt trên khung `bg-muted`, nên ô và thẻ tự có nền + viền, đọc token màu lúc tạo scene. `locales.ts`: tên "Ai vừa biến mất", câu nhắc và gợi ý mức như mục Màn hướng dẫn.

**Lưu ý:** shared đã đổi hình dạng Puzzle. Game-designer chỉ sửa tối thiểu `WhoVanishedScene.ts` (`puzzle.numbers` → `puzzle.choices`) để typecheck xanh; scene thật cần viết lại theo mục này.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `WhoVanishedPuzzle`, `WhoVanishedAnswer`, `WhoVanishedItem`, `WHO_VANISHED_ITEMS`, `WHO_VANISHED_TWINS`, `whoVanishedRevealMs`, `WRONG_ANSWER_LOCK_MS`.

| Trường | Dùng để |
| --- | --- |
| `cols`, `rows` | Chọn bố cục khay 2×2, 3×2 hay 3×3 |
| `shown` | Vẽ khay pha xem |
| `remaining`, `blankCell` | Vẽ khay pha hỏi; `null` = ô "?" |
| `shuffled` | Siêu khó: huy hiệu đổi chỗ cạnh biểu tượng pha, hiện suốt câu |
| `choices`, `answerIndex` | Hàng thẻ; chấm ngay ở client |
| `viewMs`, `coverMs`, `whoVanishedRevealMs()` | Lịch: xem 0–3 000 ms, che 3 000–3 400 ms, nhận chạm từ 3 400 ms |

### Bố cục (khung 720×1280, theo bản mẫu)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | huy hiệu tròn Ø 112, tâm (360, 140) | Mắt (đang xem) → mắt nhắm (che) → ngón tay (chờ chọn). Siêu khó: huy hiệu đổi chỗ Ø 80, tâm (500, 140). |
| Thanh xem / khoá | 420×14, góc (150, 229) | Pha xem: màu nhóm Ghi nhớ (hồng `--color-memorize`), rút dần trong 3 s. Lúc khoá: màu mực, rút trong thời gian khoá. Ẩn ở pha chờ chọn. |
| Khay | khung 648×648, góc (36, 290), viền trong hồng 8 px | 2×2: ô 276×276, tâm x 198 / 522, y 452 / 776. 3×2: ô 180×276, tâm x 150 / 360 / 570, y 452 / 776. 3×3: ô 176×176, tâm x 148 / 360 / 572, y 402 / 614 / 826. |
| Hàng thẻ | y 976–1176 | 3 thẻ (Mầm) 196×196 tại x 32 / 260 / 488. 4 thẻ 152×200 tại x 32 / 200 / 368 / 536. Thẻ nền giấy `--card`, bóng đổ 6 px. |

Vùng chạm = cả thẻ (152–196 px, trên điện thoại 390 px còn ~82–106 px ≥ 48 px). Chạm vào khay không làm gì. Một điểm chạm mỗi lúc, dùng `pointerdown`. Trước 3 400 ms bỏ qua mọi lần chạm, không tính sai; trong pha xem chỗ hàng thẻ là các khung nét đứt rỗng (chưa lộ thẻ).

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Đang xem | 0–3 000 ms | Khay đủ `shown`, biểu tượng mắt, thanh xem rút dần, hàng thẻ là khung nét đứt | Không |
| Che khay | 3 000–3 400 ms | Rèm hồng có nếp gấp hạ kín khay (mép dưới lượn sóng), mắt nhắm, thanh xem hết (artboard WhoVanishedStates "Che khay") | Không |
| Chờ chọn | từ 3 400 ms | Rèm kéo lên; khay `remaining`, ô `blankCell` nền hồng nhạt, viền đứt, dấu "?" lớn; hàng thẻ hiện; ngón tay. Máy tính: rê chuột thẻ nhấc lên 8 px | Có, một lần |
| Đúng | chạm `answerIndex` | Gửi đáp án; món bay từ thẻ về ô "?", ô viền vàng, món nảy 300 ms; thẻ có vòng vàng + huy hiệu dấu tích; sang câu mới | Không |
| Sai / khoá | chạm thẻ khác | Gửi ngay; xem mục dưới | Không, suốt thời gian khoá |

Siêu khó: khi rèm kéo lên, khay đã ở thứ tự mới (đổi chỗ xảy ra sau rèm, người chơi không thấy món di chuyển).

### Hiện đáp án đúng khi sai (CR-006)

- Vào khoá là hiện ngay (client đã có `answerIndex`), suốt thời gian khoá lấy từ `bridge.unlockDelay`.
- Khay và các thẻ khác mờ còn 35 %.
- **Món đúng hiện lại tại ô `blankCell`** trong một đĩa tròn nét đứt nền `--card` (Ø 160, không mờ). Ở Mầm, Thường, Khó đây chính là chỗ cũ của món; ở Siêu khó là ô "?" (khay đã xáo).
- Thẻ đúng: vòng vàng dày quanh thẻ, không mờ.
- Thẻ chạm sai: dấu X hai nét (`--destructive`, viền trắng) và rung ngang ±8 px trong 200 ms.
- Mọi thứ trên nằm dưới y 290, không bị huy hiệu khoá ở dải trên cùng che.

### Hiển thị vật (không chỉ bằng màu)

- Mọi vật có viền mực dày cùng nét, vẽ cùng cỡ; nhận biết bằng dáng. Cặp cùng loại khác nhau ở dáng: vết cắn, vỏ xoè, tròn hay tam giác.
- Ô "?": viền đứt + dấu "?" (không chỉ đổi màu nền). Đúng: vòng vàng + dấu tích. Sai: dấu X + rung.
- Nền tối: ô và thẻ đổi sang nền mực (`--sticker`), viền phấn; vật giữ nguyên màu (xem các khung nền tối ở WhoVanishedStates).

### Hiệu ứng (đều ≤ 400 ms)

- Rèm hạ 250 ms, kéo lên 150 ms (nằm trong 400 ms che, rèm kéo xong đúng lúc 3 400 ms).
- Đúng: món bay về ô 250 ms rồi nảy; tổng ≤ 300 ms vì phần này tính vào câu sau.
- Câu mới: khay mờ dần vào 120 ms, thanh xem đầy lại.
- *Giảm chuyển động*: rèm thay bằng mờ dần; bỏ bay, nảy, rung; giữ dấu tích, X, vòng vàng, đĩa đáp án. Lịch xem/che giữ nguyên vì là luật chơi.

### Âm thanh (GĐ 2)

- Rèm hạ: tiếng "xoạt" nhẹ. Đúng: "ting" cao dần theo combo. Sai: "bụp" trầm + rung ngắn.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, chiếu lại câu đó từ pha xem.
- Ẩn tab lúc đang xem hoặc che: quay lại thì chiếu lại câu từ đầu. Đang chờ chọn thì giữ nguyên.
- Lịch chạy bằng đồng hồ của scene (`this.time`), bắt đầu sau khung hình đầu tiên.

## Ghi chú cho BE

- **Không cần tin nhắn mới.** Đáp án là một số nguyên; `isAnswer` kiểm hình dạng; mỗi câu chấm một lần.
- `whoVanished.speedAllowanceMs(puzzle)` = 3 400 ms và `difficultyMultiplier` = 1 / 1 / 1,55 / 2,25 đã khai báo trong định nghĩa game; server đã dùng các trường chung của CR-006, không cần sửa.
- Không từ chối đáp án đến sớm hơn 3 400 ms (lệch mạng); chỉ kẹp thời gian tính thưởng về 0, như Theo dấu ánh đèn.

## Câu hỏi mở

- **3 món cần vẽ thêm** (`corn`, `banana-peeled`, `watermelon-whole`) để đủ 16 món: chuyển ui-designer thêm vào artboard "Bộ vật". Nếu muốn đổi món khác thì chỉ cần thay ID trong `WHO_VANISHED_ITEMS` / `WHO_VANISHED_TWINS` (giữ ≥ 16 món, ≥ 1 cặp).
- **Người lớn chọn Mầm được ~126 % điểm Thường** (luật Mầm = min(mô phỏng trẻ, 1) giữ hệ số 1). Chấp nhận như các game khác, hay cần cơ chế chung chống "chọn mức dễ"?
- Sau chơi thử: có nên rút thời gian xem theo mức (vd. Khó 2,5 s) thay vì giữ 3 s cho mọi mức?
