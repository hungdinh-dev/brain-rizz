# Lật cặp (`pair-flip`)

- Nhóm: Ghi nhớ
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; giữ nguyên, lý do ở [Cân bằng](#cân-bằng))
- File: `packages/shared/src/games/pair-flip/` (logic + test, đã làm), `apps/web/src/games/pair-flip/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng M11 (PairFlipMobile, PairFlipLevels, PairFlipStates, PairFlipHowTo), đã duyệt

## Cách chơi

Đầu mỗi bàn được xem nhanh toàn bộ thẻ rồi thẻ úp lại. Mỗi câu, game lật sẵn một thẻ đề có vòng vàng: chạm vào thẻ úp giống hệt nó.

Đây là biến thể "thẻ đề" của trò lật cặp cổ điển: mỗi câu có đúng một lần chạm và đúng một đáp án, nên hợp hệ chấm theo câu, và server không phải nhớ bàn của từng người.

## Màn hướng dẫn

- **Cách chơi:**
  1. Xem nhanh toàn bộ thẻ
  2. Thẻ đề lật lên, có vòng vàng
  3. Chạm thẻ úp giống thẻ đề
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** theo artboard PairFlipHowTo (560×360). Một khung tĩnh chia hai nửa, giữa là mũi tên phấn.
  - Nửa trái, *Xem* (biểu tượng mắt): lưới 3×2, cả sáu thẻ ngửa: hai táo, hai chuối, hai cà rốt.
  - Nửa phải, *Chạm* (biểu tượng ngón tay): cùng lưới, các thẻ đã úp (dấu ?); thẻ táo góc trên trái ngửa trong vòng vàng; ngón tay chạm thẻ táo giữa hàng dưới, thẻ này cũng ngửa trong vòng vàng; dải chấm 1 đặc, 1 rỗng.
  - Góc dưới phải, cỡ nhỏ: thẻ cà rốt có dấu X → mũi tên cong → thẻ úp, chữ số "1,5 s": chạm sai thì thẻ úp lại.
- **Câu nhắc lúc đếm ngược:** "Nhớ chỗ từng thẻ!"
- **Câu nhắc theo mức:** không cần; luật như nhau ở mọi mức.
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "3×2 · 3 cặp · xem 3 s" · Thường "4×2 · 4 cặp · xem 3 s" · Khó "4×3 · 6 cặp · xem 4 s" · Siêu khó "4×4 · 8 cặp · xem 4 s".

## Câu đố & đáp án

- `Puzzle` (kiểu `PairFlipPuzzle`):
  - `cols`, `rows`: cỡ bàn (3×2, 4×2, 4×3, 4×4). Ô đánh số theo hàng, ô 0 ở góc trên trái: ô `i` ở hàng `Math.floor(i / cols)`, cột `i % cols`.
  - `cards: PairFlipItem[]`: vật trên mặt ngửa của từng ô. Mỗi vật đúng 2 thẻ. Vật lấy từ `PAIR_FLIP_ITEMS`, chính là bộ 8 vật của Cân não (`BALANCE_ITEMS`: apple, pear, banana, carrot, mushroom, grapes, strawberry, watermelon), nên FE dùng lại hình của Cân não.
  - `board`: bàn thứ mấy trong vòng (từ 0). `step`: câu thứ mấy trong bàn (từ 0). `steps`: số câu của bàn = số cặp − 1.
  - `cleared: number[]`: các ô đã xong (ngửa, mờ), tăng dần. Gồm cả hai thẻ của mọi cặp đề trước trong bàn, dù người chơi khớp đúng hay bỏ lỡ.
  - `prompt`: ô của thẻ đề (lật sẵn, vòng vàng). `answer`: ô của thẻ còn lại cùng vật, đáp án đúng duy nhất.
  - Lịch (ms, số nguyên): `gapMs`, `dealMs`, `previewMs`, `hideMs`, `promptMs`. Xem [Lịch một câu](#lịch-một-câu).
- `Answer` (kiểu `PairFlipAnswer`): `number`, chỉ số ô người chơi chạm. Gửi **một lần** mỗi câu.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer === puzzle.answer`.
- `isAnswer(value)`: số nguyên 0–15 (16 = số ô của bàn lớn nhất, lấy từ bảng tham số). Từ chối số âm, ≥ 16, không nguyên, `NaN`, vô cực, chuỗi, `null`, mảng, đối tượng.
- Hàm phụ trong shared:
  - `pairFlipInputMs(puzzle)`: thời điểm được chạm, scene và server dùng chung.
  - `pairFlipBoardSize(difficulty)`: `{ pairs, steps }`.
  - `pairFlipLastPair(puzzle)`: hai ô của cặp tự lật khi bàn xong (chỉ có ở câu cuối bàn; câu khác trả mảng rỗng).
  - Hằng `PAIR_FLIP_TIMING`: `boardGapMs` 600, `dealMs` 400, `hideMs` 300, `promptMs` 300.

### Lịch một câu

Tính từ lúc câu hiện ra, tức lúc server bắt đầu đếm giờ câu này (ngay khi trả lời đúng câu trước, hoặc lúc hết khoá nếu sai). Các pha nối tiếp nhau; pha nào không có thì bằng 0.

| Pha | Trường | Câu đầu bàn đầu | Câu đầu các bàn sau | Các câu khác |
| --- | --- | --- | --- | --- |
| Cặp cuối bàn trước tự lật, giữ | `gapMs` | 0 | 600 | 0 |
| Chia thẻ (ngửa sẵn) | `dealMs` | 400 | 400 | 0 |
| Xem trước | `previewMs` | 3 000 (Mầm, Thường) · 4 000 (Khó, Siêu khó) | như cột trái | 0 |
| Úp toàn bộ | `hideMs` | 300 | 300 | 0 |
| Lật thẻ đề | `promptMs` | 300 | 300 | 300 |
| **Được chạm từ** | `pairFlipInputMs` | 4 000 · 5 000 | 4 600 · 5 600 | 300 |

## Cách sinh câu đố

1. Lấy tham số mức: `cols`, `rows`, `previewMs`. Số cặp `N = cols × rows / 2`, số câu mỗi bàn `steps = N − 1`.
2. `board = ⌊index / steps⌋`, `step = index mod steps`.
3. `rng = createRng(deriveSeed(roundSeed, board, 0x5f1))`: seed theo **bàn**, không theo câu, có muối riêng để không trùng dòng số với `deriveSeed(roundSeed, index)`.
4. Rút số theo đúng thứ tự, không phụ thuộc `step` (để mọi câu của một bàn thấy cùng một bàn):
   1. `items` = `rng.shuffle(PAIR_FLIP_ITEMS)`, lấy `N` vật đầu (các cặp khác vật nhau).
   2. `cards` = `rng.shuffle([...items, ...items])`.
   3. `order` = `rng.shuffle(items)`: thứ tự các cặp làm đề.
   4. Với mỗi cặp trong `order`, `rng.int(0, 1)` chọn thẻ nào (đứng trước hay đứng sau theo thứ tự ô) làm thẻ đề.
5. `cleared` = vị trí của các cặp `order[0 … step − 1]`, sắp tăng dần. Cặp `order[step]` cho `prompt` và `answer`. Cặp `order[N − 1]` không bao giờ làm đề: đó là cặp tự lật khi bàn xong.
6. Lịch theo bảng trên.

- **Tất định:** chỉ phụ thuộc `(roundSeed, index, difficulty)`; mọi số ngẫu nhiên qua `createRng`; mọi trường là số nguyên hoặc ID vật; không đọc giờ.
- **Không cần trạng thái bàn ở server:** câu sai vẫn "tiêu" cặp đề (cặp đề coi như xong), nên câu `index` giống hệt nhau dù các câu trước đúng hay sai. Server chỉ cần `index`, như mọi game.
- **Đúng một đáp án:** mỗi vật có đúng 2 thẻ; thẻ đề là một thẻ, nên trong bàn chỉ còn đúng một thẻ cùng vật, và thẻ đó đang úp (cặp đề chưa từng làm đề trước đó nên không nằm trong `cleared`). `check` chỉ nhận đúng ô đó.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Bàn 3×2 · 3 cặp · 2 câu/bàn · xem 3 s | 6 thẻ to; xem thong thả, nhớ 3 cặp |
| Thường | Bàn 4×2 · 4 cặp · 3 câu/bàn · xem 3 s | 8 thẻ, thời gian xem như Mầm |
| Khó | Bàn 4×3 · 6 cặp · 5 câu/bàn · xem 4 s | 12 thẻ, thẻ nhỏ hơn |
| Siêu khó | Bàn 4×4 · 8 cặp · 7 câu/bàn · xem 4 s | 16 thẻ, đủ cả 8 vật (có táo, dâu, dưa hấu cùng tông đỏ) |

Độ khó đo được (test kiểm, 10.000 seed mỗi mức):

| Mức | Thẻ phải nhớ | Thời gian xem mỗi thẻ | Thẻ úp trung bình để chọn mỗi câu | Đoán bừa trúng | Thẻ đáp án nằm sát thẻ đề |
| --- | --- | --- | --- | --- | --- |
| Mầm | 6 | 500 ms | 4,0 | 25 % | 47 % |
| Thường | 8 | 375 ms | 5,0 | 20 % | 36 % |
| Khó | 12 | 333 ms | 7,0 | 14 % | 25 % |
| Siêu khó | 16 | 250 ms | 9,0 | 11 % | 20 % |

Trong một bàn, câu đầu khó nhất (nhiều thẻ úp nhất, mới xem xong), các câu sau dễ dần vì thẻ đã xong ngửa ra và ít lựa chọn hơn; câu cuối bàn luôn còn 3 thẻ úp. Một câu sai cũng cho người chơi thấy thêm một thẻ (thẻ chạm nhầm ngửa trong 1,5 s rồi úp lại).

## Đảm bảo khi sinh câu đố

Kiểm bằng `pair-flip.test.ts` (10 ca, 10.000 seed × 4 mức, chạy ~1,5 s):

- Luôn có đúng một đáp án: duyệt cả 16 giá trị `isAnswer` nhận, chỉ `answer` được `check` nhận; `answer ≠ prompt`, cùng vật với thẻ đề, đang úp, và là thẻ úp duy nhất mang vật đó.
- Bàn hợp lệ: đúng cỡ của mức; mỗi vật đúng 2 thẻ; các cặp khác vật; mọi vật thuộc `PAIR_FLIP_ITEMS`; `board`, `step`, `steps` khớp `index`; `cleared` dài `2 × step`, tăng ngặt, không chứa thẻ đề; lịch đúng bảng.
- Các câu cùng bàn nối tiếp nhau: cùng `cards`; `cleared` của câu sau = `cleared` câu trước + thẻ đề + đáp án; mỗi cặp làm đề tối đa một lần; câu cuối bàn còn đúng một cặp tự lật (`pairFlipLastPair`) chưa từng làm đề.
- Tất định: sinh hai lần giống hệt; ba câu cố định ghi cứng trong test, để đổi cách sinh phải là cố ý.
- Khó dần: số thẻ 6 → 8 → 12 → 16; thời gian xem mỗi thẻ giảm ngặt; số thẻ úp trung bình tăng ít nhất 0,5 mỗi mức.
- Không thiên vị: số lần mỗi ô làm thẻ đề / đáp án lệch < 20 % so với trung bình (đo: lệch lớn nhất 3,8–9,8 %); mỗi vật làm đề lệch < 15 %.
- `speedAllowanceMs` = `pairFlipInputMs`, nguyên, trong [300, 5 600] ms.
- Hệ số điểm đúng bảng và không giảm khi lên mức.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức. Số liệu ước lượng, đo lại sau buổi chơi thử đầu tiên.

| Mức | Thời gian giải dự kiến mỗi câu (chạm, sau khi thẻ đề lật) | Tỉ lệ đúng mục tiêu | Thời gian trung bình mỗi câu kể cả xem trước | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- | --- |
| Mầm | ~2,0 s (trẻ 7 tuổi) | 85 % | ~4,8 s | ~12–13 (~10–11 đúng) |
| Thường | ~1,5 s | 88 % | ~3,4 s | ~17–18 (~15–16 đúng) |
| Khó | ~1,9 s | 78 % | ~3,6 s | ~16–17 (~13 đúng) |
| Siêu khó | ~2,3 s | 68 % | ~3,7 s | ~16 (~11 đúng) |

- Các mức không chồng nhau: thời gian chạm tăng 1,5 → 1,9 → 2,3 s trong khi tỉ lệ đúng giảm 88 → 78 → 68 %; mỗi bước thêm 2–4 thẻ và bớt thời gian xem mỗi thẻ.
- Siêu khó vẫn ~16 câu mỗi vòng, trên mức tối thiểu 8.
- **Giữ 60 s**: mỗi bàn mất 4–5,6 s chia, xem và úp không thao tác được; với 45 s, Mầm chỉ còn ~9 câu.
- Mầm có ít câu nhất dù chạm không chậm hơn nhiều: bàn 3 cặp chỉ có 2 câu cho mỗi lần xem 4 s (2 s/câu), trong khi Siêu khó 7 câu cho mỗi lần xem 5 s (0,7 s/câu).

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong `pairFlip`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | `pairFlipInputMs(puzzle)`: câu đầu bàn 4 000 / 4 600 ms, câu khác 300 ms | Mô phỏng cần 1,82; lấy min(1,82; 1) = 1 theo luật chung |
| Thường | 1 | câu đầu bàn 4 000 / 4 600 ms, câu khác 300 ms | Mốc so sánh |
| Khó | **1,45** | câu đầu bàn 5 000 / 5 600 ms, câu khác 300 ms | Mô phỏng cần 1,46 |
| Siêu khó | **1,95** | câu đầu bàn 5 000 / 5 600 ms, câu khác 300 ms | Mô phỏng cần 1,96 |

- `speedAllowanceMs` = đúng phần thời gian không chạm được (chia, xem, úp, lật thẻ đề, và 0,6 s cặp cuối bàn trước). Không miễn trừ thì câu đầu mỗi bàn luôn mất gần hết thưởng tốc độ.
- Cách mô phỏng (20 000 vòng 60 s mỗi mức, chạy chính `generate()` và `pointsForCorrect` của `scoring.ts`): thời gian chạm dao động đều ±30 % quanh bảng trên; đúng với xác suất bằng tỉ lệ đúng mục tiêu; câu sai tốn 0–100 % thời gian chạm + khoá 1,5 s; câu đúng: câu sau bắt đầu ngay (hiệu ứng khớp cặp chạy song song với lúc lật thẻ đề mới); combo trần × 1,5; câu chưa xong khi hết giờ không tính. Giải hệ số để điểm vòng kỳ vọng bằng Thường, làm tròn tới 0,05.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 12,5 | 10,6 | 12,6 | 46 | 1,82 | 1 | ~1 850 (64 %) |
| Thường | 17,7 | 15,6 | 19,3 | 49 | 1 | 1 | ~2 880 (100 %) |
| Khó | 16,6 | 12,9 | 15,0 | 47 | 1,46 | 1,45 | ~2 870 (99 %) |
| Siêu khó | 16,2 | 10,9 | 12,0 | 44 | 1,96 | 1,95 | ~2 870 (99 %) |
| Người lớn chọn Mầm (chạm 1,1 s, đúng 97 %) | 16,0 | 15,5 | 20,7 | 50 | — | 1 | ~3 100 (108 %) |

- Ít nhạy với giả định: bỏ dao động thời gian chạm thì hệ số cần là 1,84 / 1,48 / 1,99; bỏ trần combo thì 1,78 / 1,44 / 1,95.
- Hệ số chung cũ (0,8 / 1 / 1,25 / 1,5) cho Mầm (trẻ) ~56 %, Khó ~89 %, Siêu khó ~81 % điểm Thường.
- **Mầm còn ~64 % điểm người lớn ở Thường** (light-trail: ~89 %). Không nâng hệ số Mầm vì người lớn chọn Mầm đã được 108 % với hệ số 1. Xem [Câu hỏi mở](#câu-hỏi-mở).
- Script mô phỏng không lưu trong repo; khi đổi số thì chạy lại theo đúng các bước trên.

Núm chỉnh sau chơi thử (đổi thì sửa bảng Độ khó, test, và tính lại hệ số; chỉ sửa số trong `pair-flip.ts`):

1. Siêu khó đúng < 60 %: xem 5 s.
2. Trẻ ở Mầm đúng < 80 %: xem 4 s. Trẻ đúng > 95 % và chán: xem 2,5 s.
3. Thường quá dễ (đúng > 95 %): xem 2,5 s.

## Ghi chú cho FE

Bám sát bản mẫu đã duyệt: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M11**, artboard **PairFlipMobile** (bố cục điện thoại, Thường), **PairFlipLevels** (4 mức, mỗi mức một trạng thái, bản máy tính), **PairFlipStates** (sai/khoá, úp lại, khớp cặp, xong bàn, nền tối, bảng hiển thị thẻ), **PairFlipHowTo** (hình hướng dẫn). Mọi toạ độ dưới đây lấy từ bản mẫu, trong khung 720×1280.

Scene không vẽ chữ, chỉ có hình vật, biểu tượng, chấm và dấu. `locales.ts`: tên "Lật cặp", câu `howTo` lấy từ mục Cách chơi, nội dung màn hướng dẫn và gợi ý từng mức lấy từ mục Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `PairFlipPuzzle`, `PairFlipAnswer`, `PairFlipItem`, `PAIR_FLIP_ITEMS`, `PAIR_FLIP_TIMING`, `pairFlipInputMs`, `pairFlipLastPair`, `WRONG_ANSWER_LOCK_MS`.

- Hình vật: ánh xạ ID `PairFlipItem` sang đúng hình của Cân não (cùng 8 ID), vẽ phấn màu như bản mẫu.
- Bàn mới khi `puzzle.step === 0`. Giữ `cards` của câu trước để vẽ pha `gapMs` (cặp cuối bàn trước tự lật).

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | huy hiệu tròn Ø112, tâm (360, 150); dải chấm tâm y = 250 | Huy hiệu: mắt khi xem trước (kèm vòng giờ quanh mắt cho thời gian xem còn lại), ngón tay khi tới lượt chạm, dấu tích vàng khi xong bàn. Dải chấm: `steps` chấm (2 / 3 / 5 / 7), Ø28, tâm cách nhau 48 px; đặc = đúng, rỗng = chưa, X = sai. |
| Khung bàn | x 36–684, từ y 316; cao Mầm 574 · Thường 496 · Khó 648 · Siêu khó 764 | Nền giấy, viền mực 5 px, viền trong màu nhóm Ghi nhớ (`--color-memorize`), bóng dưới 8 px. |
| Thẻ | xem bảng dưới | |
| Thanh khoá | 420×14, góc trên trái (150, 1149) | Chỉ hiện khi sai, rút hết trong `WRONG_ANSWER_LOCK_MS`. |

| Mức | Cỡ thẻ | Tâm cột (x) | Tâm hàng (y) |
| --- | --- | --- | --- |
| Mầm 3×2 | 180×248 | 150 · 360 · 570 | 464 · 742 |
| Thường 4×2 | 132×212 | 126 · 282 · 438 · 594 | 446 · 682 |
| Khó 4×3 | 132×184 | 126 · 282 · 438 · 594 | 432 · 640 · 848 |
| Siêu khó 4×4 | 132×164 | 126 · 282 · 438 · 594 | 422 · 606 · 790 · 974 |

Vùng chạm = cả thẻ (nhỏ nhất 132×164, trên điện thoại ngang 390 px còn ~71×89 px). Dùng `pointerdown`, một điểm chạm mỗi lúc. **Bỏ qua, không gửi** khi chạm: thẻ đề, thẻ đã xong, khe giữa thẻ, hay bất cứ đâu trước `pairFlipInputMs(puzzle)`.

### Hiển thị thẻ (không chỉ bằng màu)

- *Úp:* nền mực, khung trong hồng (`--color-memorize`), hình não phấn mờ 30 % và dấu "?" ở giữa, bóng dưới.
- *Ngửa:* nền giấy, viền mực 5 px, hình vật phấn màu, bóng dưới.
- *Thẻ đề:* ngửa + vòng vàng (`--primary`) dày 7 px có viền mực ngoài 12 px, cách mép thẻ 7 px.
- *Đã xong:* ngửa, mờ 45 %, không bóng (khớp hay bỏ lỡ như nhau).
- *Chạm sai:* ngửa + dấu X đỏ (`--destructive`) viền trắng.
- Rê chuột (máy tính) trên thẻ úp chạm được: thẻ nhấc lên 6 px, viền nét đứt quanh thẻ, con trỏ bàn tay.
- Nền tối: khung bàn đổi sang tím đậm, thẻ úp viền phấn sáng, chấm màu kem (PairFlipStates).

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Cặp cuối tự lật | `gapMs` (600 ms) ở câu đầu bàn 2 trở đi | Cặp còn lại của bàn trước (`pairFlipLastPair(câu trước)`) lật ngửa, phóng to, sao lấp lánh; huy hiệu đổi dấu tích vàng. Không tính câu | Không |
| Chia thẻ | `dealMs` (400 ms) | Thẻ bay vào chỗ, đã ngửa; dải chấm về rỗng | Không |
| Xem trước | `previewMs` | Mọi thẻ ngửa; huy hiệu mắt, vòng giờ quanh mắt rút dần | Không |
| Úp | `hideMs` (300 ms) | Mọi thẻ lật úp cùng lúc | Không |
| Lật thẻ đề | `promptMs` (300 ms), mọi câu | Thẻ đề lật ngửa, vòng vàng hiện; huy hiệu đổi ngón tay (nảy 150 ms) | Không |
| Chờ chạm | Từ `pairFlipInputMs(puzzle)` | Thẻ đề vòng vàng; thẻ đã xong mờ; thẻ úp chờ | Có |
| Đúng | Chạm `answer` | Gửi ngay; thẻ lật ngửa, hai thẻ cùng vật phóng to 108 %, nảy, huy hiệu dấu tích vàng góc trên phải thẻ; chấm đặc. 300 ms sau mờ thành "đã xong". Câu sau bắt đầu ngay: lật thẻ đề mới **song song** với hiệu ứng này | Không cho tới khi thẻ đề mới lật xong |
| Sai / khoá | Chạm thẻ úp khác `answer` | Gửi ngay; thẻ chạm nhầm lật ngửa có dấu X, lắc ±8 px; bàn mờ 35 % nhưng thẻ sai, thẻ đề và đáp án vẫn rõ; chấm có X; thanh khoá chạy 1 500 ms | Không |
| Hết khoá | Sau 1 500 ms | Thẻ sai lật úp lại; cặp đề mờ thành "đã xong"; thẻ đề mới lật lên, cùng lúc | Từ khi thẻ đề mới lật xong |

### Hiện đáp án đúng khi sai (CR-006)

- Vào Sai/khoá là hiện ngay (client có `answer`), suốt `bridge.unlockDelay`.
- Thẻ `answer` lật ngửa, mang vòng vàng giống thẻ đề, để người chơi thấy cả cặp đúng. Thẻ chạm nhầm ngửa với dấu X. Bàn còn lại mờ 35 %.
- Mọi thẻ đều nằm dưới y ≈ 300, không bị huy hiệu khoá che.
- Câu cuối bàn mà sai: hết khoá thì sang ngay pha cặp cuối tự lật (`gapMs` của câu sau).

### Hiệu ứng (đều ≤ 400 ms)

- Lật thẻ: co ngang về 0 rồi mở ra mặt kia, 300 ms (bản mẫu "Úp lại" vẽ thẻ hẹp ngang và vạch chuyển động).
- Khớp cặp: nảy 115 % rồi về 108 %, 300 ms, rồi mờ 150 ms.
- Sai: lắc 200 ms, X hiện 120 ms, bàn mờ 150 ms.
- Khi bật *giảm chuyển động*: bỏ bay vào, lắc, nảy, phóng to; lật thẻ thành đổi mặt tức thì; lịch các pha giữ nguyên vì là luật chơi.

### Âm thanh (GĐ 2)

Lật thẻ: "lạch" nhẹ (giống nhau cho mọi thẻ, không lộ vật). Khớp: "ting" cao dần theo combo. Sai: "bụp" trầm, rung ngắn. Hết xem trước: "tách" hai nốt.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- **Nối lại giữa vòng** (bắt đầu ở `bridge.startIndex` với `step > 0`): người chơi chưa thấy bàn, nên chiếu lại pha xem trước (`previewMs` của mức) với các thẻ trong `cleared` mờ sẵn, rồi úp, rồi lật thẻ đề. Server không biết pha này nên câu đó có thể mất một phần thưởng tốc độ; chấp nhận được.
- Ẩn tab hoặc chuyển app lúc đang xem trước: quay lại thì chiếu lại xem trước từ đầu. Đang chờ chạm thì giữ nguyên.
- Lịch chạy bằng đồng hồ của scene (`this.time`), bắt đầu sau khung hình đầu tiên.

## Ghi chú cho BE

- **Không cần tin nhắn hay luật phòng mới.** Đáp án là một số nguyên; `isAnswer` kiểm hình dạng; mỗi câu chấm một lần như mọi game.
- **Không cần lưu bàn của người chơi:** bàn và thứ tự đề sinh từ `(roundSeed, ⌊index / steps⌋)`, câu sai vẫn tiêu cặp đề, nên `generate(seed, progress, difficulty)` là đủ.
- `speedAllowanceMs(puzzle)` = `pairFlipInputMs(puzzle)` (300–5 600 ms). Không từ chối đáp án đến sớm hơn mốc này, chỉ kẹp về 0 như light-trail.
- `difficultyMultiplier` = 1 / 1 / 1,45 / 1,95 thay cho hệ số chung.

## Câu hỏi mở

- **Mầm chỉ ~64 % điểm Thường cho trẻ 7 tuổi** (bàn 3 cặp chỉ có 2 câu mỗi lần xem ~4 s). Luật chung giữ Mầm ≤ 1, và nâng lên thì người lớn chọn Mầm càng lời (đang 108 %). Cách gỡ nếu cần: cho Mầm 3 câu mỗi bàn bằng bàn 4×2 nhưng xem lâu hơn (4 s), hoặc chấp nhận vì trẻ chơi Mầm với nhau. Cần quyết sau chơi thử.
- Táo, dâu tây, dưa hấu cùng tông đỏ: hình dáng đủ khác, nhưng nếu chơi thử thấy nhầm nhiều ở Siêu khó thì đổi một vật sang bộ khác (cần thêm vật vào `PAIR_FLIP_ITEMS`, giữ ≥ 8).
- Nối lại giữa bàn: có nên để server cộng thêm thời gian xem trước vào miễn trừ cho câu đầu sau khi nối lại? Hiện không (cần luật phòng mới, lợi ích nhỏ).
