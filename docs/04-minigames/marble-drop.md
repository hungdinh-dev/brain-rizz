# Bi rơi đâu (`marble-drop`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/marble-drop/` (logic + test, đã làm), `apps/web/src/games/marble-drop/` (`MarbleDropScene.ts`, `MarbleDropHowTo.tsx`, `locales.ts`; đã làm theo bản mẫu, chờ chơi thử)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng M13 (MarbleDropMobile, MarbleDropLevels, MarbleDropStates, MarbleDropHowTo), đã duyệt

## Cách chơi

Bi lăn từ phễu xuống bảng cần gạt; mỗi cần gạt hình mũi tên chỉ bi đi trái hay phải. Lần theo mũi tên rồi chạm cốc bi rơi vào. Từ mức Khó có công tắc vàng tự lật sau mỗi lần bi đi qua; thả lần lượt nhiều bi, hỏi bi cuối (bi vàng có dấu ?).

## Màn hướng dẫn

- **Cách chơi:**
  1. Lần theo mũi tên cần gạt
  2. Chạm cốc bi rơi vào
  3. Công tắc vàng lật sau mỗi bi
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** đã vẽ ở artboard *MarbleDropHowTo*, dựng như màn chơi mức Mầm. Trong khung dọc: bi vàng ở phễu; cần gạt tầng 1 chỉ phải (số phấn 1), tầng 2 hai cần gạt chỉ trái; nét đứt vàng đi theo mũi tên xuống cốc B, cốc B khoanh phấn vàng, có bàn tay chạm (số 3). Cột trái (số 2): một chạc có công tắc vàng mang vòng mũi tên; bi 1 qua thì rẽ trái và công tắc lật, bi 2 (vàng, dấu ?) qua thì rẽ phải, bóng nét đứt chỉ vị trí cũ của cần gạt.
- **Câu nhắc lúc đếm ngược:** "Lần theo mũi tên!"
- **Câu nhắc theo mức** (`levelHints`):
  - Khó: "Công tắc lật sau mỗi bi!"
  - Siêu khó: "3 bi, hỏi bi cuối!"
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "2 tầng · 3 cốc" · Thường "3 tầng · 4 cốc" · Khó "4 tầng · 2 bi" · Siêu khó "4 tầng · 3 bi".

## Câu đố & đáp án

- `Puzzle` (kiểu `MarbleDropPuzzle`, mọi giá trị là số nguyên hoặc boolean):
  - `tiers`: số tầng cần gạt (2 / 3 / 4 / 4). Tầng `r` (đếm từ 0, trên cùng) có `r + 1` chạc, vị trí `i` đếm từ trái.
  - `cups` = `tiers + 1`. Cốc 0 là cốc A (trái nhất).
  - `levers[r][i]`: `{ dir, toggle }`. `dir` 0 = chỉ trái, 1 = chỉ phải, là hướng **lúc hiện câu**. `toggle = true` là công tắc.
  - `balls`: số bi thả lần lượt (1 / 1 / 2 / 3). Bi được hỏi luôn là bi cuối (`balls − 1`).
  - `paths[b]`: đường đi thật của bi `b`, dài `tiers + 1`: `paths[b][r]` là vị trí chạc ở tầng `r`, phần tử cuối là cốc. Dùng để vẽ đường bi lúc khoá sau câu sai.
  - `answer`: cốc của bi cuối (= `paths[balls − 1][tiers]`).
- **Luật bi**: bi ở chạc (r, i) đi theo cần gạt xuống chạc (r + 1, i + dir); ra khỏi tầng cuối thì rơi vào cốc `i + dir`. Hai ống nhập vào một chạc thì bi vẫn theo cần gạt của chạc đó. Công tắc lật sang hướng kia **ngay sau** khi một bi đi qua; cần gạt thường không bao giờ đổi. Bi thả lần lượt, bi sau thả khi bi trước đã vào cốc.
- `Answer` (kiểu `MarbleDropAnswer`): số nguyên, chỉ số cốc người chơi chạm. Gửi một lần mỗi câu.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer === puzzle.answer`.
- `isAnswer(value)`: số nguyên 0–4 (giới hạn lấy từ số cốc nhiều nhất trong bảng tham số). Từ chối số âm, ≥ 5, số lẻ, `NaN`, vô cực, chuỗi, mảng, `null`.
- Hàm thuần xuất kèm cho scene và test:
  - `simulateMarbleDrop(levers, balls)` trả về `paths` (không sửa `levers`).
  - `marbleLeverDirsBefore(levers, paths, b)`: hướng mọi cần gạt ngay trước khi thả bi `b`. Hướng khác `levers[r][i].dir` nghĩa là công tắc đã lật.
  - `marbleFlippedOnPath(levers, paths, b)`: số công tắc đã lật mà bi `b` đi qua.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`. Lấy `tiers`, `balls`, số công tắc của mức ở bảng [Độ khó](#độ-khó).
2. Chọn **cốc đích** đều trong `0 … tiers` (`rng.int`). Lý do: nếu đặt cần gạt ngẫu nhiên rồi lấy cốc bi rơi, cốc giữa ra nhiều hơn hẳn cốc mép (phân bố nhị thức) và chiến thuật "đoán cốc giữa" sẽ có lời.
3. Lặp tối đa 400 lần:
   1. Mỗi cần gạt chọn hướng ngẫu nhiên; xáo danh sách chạc, lấy số chạc đầu bằng số công tắc của mức làm công tắc.
   2. Bỏ nếu **tính chẵn lẻ** của bảng (số cần gạt chỉ phải, mod 2) khác `index mod 2`. Nhờ vậy hai câu liền nhau không bao giờ cùng bảng: Mầm chỉ có 8 bảng, không chặn thì ~14 % câu giống hệt câu vừa xong. Mỗi lớp chẵn / lẻ vẫn đủ bảng cho mọi cốc, và người chơi không nhận ra.
   3. Mô phỏng thả bi (`simulateMarbleDrop`). Bỏ nếu không hợp lệ (luật ở mục [Đảm bảo](#đảm-bảo-khi-sinh-câu-đố)).
   4. Bi cuối rơi đúng cốc đích thì nhận. Không thì nhớ câu hợp lệ đầu tiên và thử tiếp.
4. Hết 400 lần mà chưa trúng đích thì nhận câu hợp lệ đầu tiên. Không có câu hợp lệ nào thì dùng bảng dự phòng dựng tay (`marbleFallbackBoard`, lật gương ngẫu nhiên, đổi chẵn lẻ bằng cách lật một cần gạt ở tầng cuối mà không bi nào đi qua). Trên 10 000 seed × 4 mức, cả hai nhánh này đều không xảy ra; test vẫn kiểm bảng dự phòng hợp lệ.

- **Tất định:** chỉ dùng `createRng`; mọi giá trị là số nguyên; không đọc giờ, không `Math.random()`.
- **Đúng một đáp án:** bảng, luật bi và thứ tự thả đều cố định, nên mô phỏng cho đúng một cốc với bi cuối. `check` so bằng với cốc đó.
- **Chi phí:** một câu Siêu khó dựng mất ~0,1 ms (trung bình vài chục lần thử); Mầm, Thường gần như tức thì.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 2 tầng (3 cần gạt) · 3 cốc · 1 bi · không công tắc | Cần gạt và cốc to; lần theo 2 mũi tên |
| Thường | 3 tầng (6 cần gạt) · 4 cốc · 1 bi · không công tắc | Lần theo 3 mũi tên, nhiều nhánh hơn |
| Khó | 4 tầng (10 cần gạt) · 5 cốc · 2 bi · 2 công tắc | Bi 1 kem, bi 2 vàng có dấu ?; phải nhớ công tắc nào bi 1 đã lật |
| Siêu khó | 4 tầng (10 cần gạt) · 5 cốc · 3 bi · 3 công tắc | Ba bi xếp hàng, hỏi bi 3; công tắc có thể bị lật hai lần (về như cũ) |

Độ khó đo được trên 10 000 câu mỗi mức (test kiểm chiều tăng):

| Mức | Số cốc | Lần đọc cần gạt (tầng × bi) | Công tắc có bi đi qua (TB) | Công tắc đã lật trên đường bi được hỏi (TB) | Số bảng khác nhau xuất hiện |
| --- | --- | --- | --- | --- | --- |
| Mầm | 3 | 2 | 0 | 0 | 8 (đủ hết) |
| Thường | 4 | 3 | 0 | 0 | 64 (đủ hết) |
| Khó | 5 | 8 | 1,38 | 1,03 | ~7 700 |
| Siêu khó | 5 | 12 | 2,49 | 1,03 | ~7 900 |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án: trong các cốc 0–4, đúng một cốc qua `check`, và cốc đó khớp một **mô phỏng độc lập viết lại trong test** (không dùng code của game).
- Hình dạng đúng bảng tham số: `tiers`, `cups`, `balls`, số công tắc; tầng `r` có `r + 1` cần gạt; `dir` ∈ {0, 1}; mỗi đường đi bắt đầu ở chạc 0 và mỗi tầng tăng 0 hoặc 1; `paths` bằng `simulateMarbleDrop(levers, balls)`.
- Câu nhiều bi (Khó, Siêu khó):
  - bi được hỏi đi qua **ít nhất một công tắc đã lật** (bị các bi trước lật một số lẻ lần);
  - bi được hỏi rơi vào cốc **khác mọi bi trước** (chặt hơn yêu cầu "khác bi 1" của bản mẫu). Nên ai quên công tắc (lần theo bảng lúc hiện câu, ra đúng cốc bi 1) hay bỏ sót một bi (ra cốc của bi trước đó) luôn chọn sai;
  - `marbleLeverDirsBefore` khớp đường đi của từng bi.
- Hai câu liền nhau không bao giờ cùng bảng (tính chẵn lẻ của bảng = `index mod 2`).
- Không thiên vị cốc: trên 10 000 câu mỗi mức, số lần mỗi cốc là đáp án lệch ≤ 15 % so với trung bình (đo được: lệch lớn nhất ~3 %).
- Tất định: gọi `generate` hai lần cho kết quả giống hệt; câu (seed 777, câu 5) ở Mầm và Siêu khó được ghi cứng trong test.
- Bảng dự phòng hợp lệ ở mọi mức, cả hai chiều gương.
- `isAnswer` nhận 0–4, từ chối dữ liệu rác. `difficultyMultiplier` không giảm khi lên mức; `speedAllowanceMs` nguyên, ≥ 0, nhỏ hơn thời lượng vòng.

Các điều trên được kiểm bằng test 10 000 câu × 4 mức (`marble-drop.test.ts`, 12 ca, chạy ~6–8 giây).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức. Số liệu ước lượng trên giấy, đo lại sau buổi chơi thử.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu dự kiến mỗi vòng (60 s) |
| --- | --- | --- |
| Mầm (trẻ 7 tuổi) | ~3,2 s (2 mũi tên + chạm), đúng ~85 % | ~16 (~13 đúng) |
| Thường | ~2,5 s (3 mũi tên + chạm), đúng ~90 % | ~20 (~18 đúng) |
| Khó | ~4,5 s (bi 1: 4 mũi tên, nhớ công tắc lật, bi 2: 4 mũi tên), đúng ~80 % | ~11–12 (~9 đúng) |
| Siêu khó | ~6,5 s (3 bi × 4 mũi tên + nhớ ~2,5 lần lật), đúng ~75 % | ~8 (~6 đúng) |

Các mức không chồng nhau: mỗi mức thêm việc phải làm (2 → 3 → 8 → 12 lần đọc cần gạt; 0 → 0 → ~1,4 → ~2,5 công tắc có bi đi qua).

**Siêu khó vừa chạm ngưỡng 8 câu mỗi vòng.** Nếu người lớn mất ~7 s mỗi câu thì chỉ còn ~7,5 câu. Núm chỉnh nếu chơi thử thấy chậm: giảm Siêu khó còn 2 bi, giữ 3 công tắc (vẫn khó hơn Khó vì có 3 công tắc và một số bị lật hai lần); sửa `LEVELS[3]` trong `marble-drop.ts`, bảng này và test.

### Hệ số điểm và miễn trừ thời gian (CR-006)

Khai báo trong `marbleDrop` (`packages/shared/src/games/marble-drop/marble-drop.ts`).

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | 0 | Mô phỏng cho trẻ 7 tuổi ra 1,64; theo quy tắc chung Mầm = min(mô phỏng, 1) |
| Thường | 1 | 0 | Mốc |
| Khó | **2,65** | **2 000** | Hệ số: mô phỏng. Miễn trừ: 4,5 s − 2,5 s của Thường |
| Siêu khó | **4,45** | **4 000** | Hệ số: mô phỏng. Miễn trừ: 6,5 s − 2,5 s |

Miễn trừ là hằng số theo mức (cấu trúc câu cố định theo mức), để người chơi Khó / Siêu khó giải nhanh hơn dự kiến vẫn có thưởng tốc độ như người chơi Thường.

Cách tính `difficultyMultiplier`: mô phỏng 100 000 vòng 60 s mỗi mức, dùng chính `pointsForCorrect` của `scoring.ts`.

- Mỗi câu: thời gian giải ở bảng trên, dao động đều ±30 %; đúng với xác suất ở bảng trên.
- Câu đúng: 0,3 s hiệu ứng tính vào câu sau (cả vào thời gian tính thưởng). Câu sai: thời gian giải + khoá 1,5 s. Câu chưa xong khi hết giờ không tính.
- Điểm câu đúng = `(100 × hệ số + thưởng tốc độ) × combo`, combo trần × 1,5, thưởng tốc độ đo sau khi trừ `speedAllowanceMs`. Điểm vòng tuyến tính theo hệ số, nên giải ra hệ số để điểm vòng bằng Thường, làm tròn tới 0,05.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Điểm thưởng tốc độ/vòng | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 15,9 | 13,4 | 16,2 | 568 | 1,64 | 1 | ~2 190 (68 %) |
| Thường | 20,2 | 18,1 | 22,9 | 925 | 1 | 1 | ~3 220 (100 %) |
| Khó | 11,5 | 9,1 | 10,5 | 428 | 2,65 | 2,65 | ~3 220 (100 %) |
| Siêu khó | 8,0 | 6,0 | 6,6 | 268 | 4,45 | 4,45 | ~3 220 (100 %) |
| Người lớn chọn Mầm (1,6 s, đúng 97 %) | 30,7 | 29,7 | 41,3 | 1 943 | | 1 | ~6 070 (189 %) |

- Hệ số Khó, Siêu khó cao hơn các game khác vì Thường của game này rất nhanh (~20 câu/vòng) còn Siêu khó chỉ ~8 câu.
- Độ nhạy: nếu mọi mức chậm hơn 0,5 s (Thường 3 s, Khó 5 s, Siêu khó 7 s) thì hệ số cần là 2,4 / 3,95. Đo lại sau chơi thử rồi chỉ sửa số trong `MULTIPLIER_BY_DIFFICULTY`.
- Trẻ ở Mầm chỉ đạt ~68 % điểm người lớn ở Thường (game khác: 80–89 %), do trần Mầm = 1. Người lớn chọn Mầm được ~189 % (game khác: 144–208 %); phần này do chủ phòng giám sát (CR-006).
- Script mô phỏng không lưu trong repo; khi đổi số thì chạy lại theo đúng các bước trên.

## Ghi chú cho FE

**Bám sát bản mẫu đã duyệt:** [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M13**: `MarbleDropMobile` (Thường, chờ chọn), `MarbleDropLevels` (4 mức), `MarbleDropStates` (đúng, sai/khoá, nền tối, bảng ký hiệu), `MarbleDropHowTo` (hình hướng dẫn). Màu nhóm Phân tích (xanh `#4d9de0`) cho cần gạt thường; công tắc là chốt vàng `#ffd166` có vòng mũi tên.

Scene không vẽ chữ trừ chữ cái cốc (A–E) và số trên bi. Canvas trong suốt trên khung `bg-muted`; ống, cốc, cần gạt tự có nền và viền để nhìn rõ ở cả sáng lẫn tối (đọc token màu lúc tạo scene). `locales.ts`: tên "Bi rơi đâu", nội dung lấy từ mục Cách chơi và Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `MarbleDropPuzzle`, `MarbleLever`, `MarbleDropAnswer`, `marbleDrop`, `marbleLeverDirsBefore` (vẽ công tắc đã lật), `WRONG_ANSWER_LOCK_MS`. Không cần tự mô phỏng: `paths` có sẵn đường đi của từng bi.

### Bố cục (khung 720×1280), theo bản mẫu

Chạc (r, i) có tâm `x = 360 + (2i − r) × h`, `y = y0 + r × v`. Cốc c có tâm `x = 360 + (2c − tiers) × h`. Ống nối mỗi chạc xuống hai chạc dưới (hoặc xuống cốc).

| Mức | `h` (nửa bước ngang) | `v` (bước tầng) | `y0` (chạc đỉnh) | Cần gạt | Cốc (tâm miệng, tỉ lệ) | Vùng chạm cốc |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 110 | 264 | 290 | × 1,2 | y 1030, × 1,3 | 196 × 220, từ y 980 |
| Thường | 75 | 180 | 280 | × 1 | y 1042, × 1,05 | 136 × 220, từ y 980 |
| Khó, Siêu khó | 64 | 153,6 | 284 | × 0,92 | y 1048, × 0,92 | 116 × 220, từ y 980 |

- Phễu tâm (360, ~110–150) phía trên chạc đỉnh. Khó / Siêu khó: bi xếp hàng ở phễu và máng (bi 1 trong phễu, bi sau trên máng), bi trước màu kem, bi được hỏi màu vàng có huy hiệu "?"; mỗi bi ghi số thứ tự.
- Cần gạt: mũi tên dài 70 px (trước khi nhân tỉ lệ) quay quanh chốt, nghiêng ±22,6° theo hướng `dir`; chốt kem cho cần gạt thường, chốt vàng có vòng mũi tên cho công tắc.
- Vùng chạm là cả thẻ cốc (≥ 116 px; ~63 px trên điện thoại ngang 390 px). Chỉ cốc nhận chạm; chạm cần gạt hay ống thì bỏ qua. Dùng `pointerdown`. Máy tính: rê chuột lên cốc thì cốc nhấc lên.
- Giữ trống dải trên cùng y < 225 cho huy hiệu khoá (phễu nằm dưới huy hiệu nhưng không chứa thông tin đáp án).

### Trạng thái

| Trạng thái | Hiển thị | Nhận chạm |
| --- | --- | --- |
| Chờ chọn | Bảng ở hướng lúc hiện câu; bi xếp ở phễu; không có hoạt ảnh bi lăn (người chơi tự lần theo) | Có |
| Đúng | Bi vàng nhảy thẳng vào cốc đã chạm; cốc khoanh vàng, dấu tích, vạch nảy; ≤ 300 ms rồi sang câu mới | Không |
| Sai / khoá | Xem mục dưới; hết khoá theo `bridge.unlockDelay` | Không |

### Hiện đáp án đúng khi sai (CR-006)

Hiện ngay khi chạm sai (client có sẵn `paths`), giữ suốt thời gian khoá:

- Mọi thứ mờ; cốc vừa chạm có dấu X (`--destructive`, viền phấn trắng) và rung ngắn.
- **Đường bi được hỏi** (`paths[balls − 1]`): nét đứt vàng dày đi từ phễu qua từng chạc xuống cốc đúng; các cần gạt trên đường giữ sáng và có **số bước 1, 2, 3…**; bi vàng nằm trong cốc đúng; cốc đúng khoanh vàng.
- Khó / Siêu khó: đường các bi trước là nét chấm mảnh màu kem, mỗi bi nằm trong cốc của nó. Công tắc có hướng trong `marbleLeverDirsBefore(levers, paths, balls − 1)` khác `dir` ban đầu thì vẽ ở hướng mới, kèm **bóng nét đứt** ở vị trí cũ; công tắc bị lật hai lần thì vẽ như cũ (không bóng).
- Cốc đúng luôn ở đáy khung, không bị huy hiệu khoá che.
- *Giảm chuyển động*: bỏ nảy, rung; nét đứt hiện ngay, không vẽ dần.

### Âm thanh (GĐ 2)

Chạm cốc: "tách". Đúng: "ting" + tiếng bi rơi vào cốc. Sai: "bụp" trầm.

### Tình huống đặc biệt

- Hết giờ giữa câu: dừng, không gửi gì. Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`.
- Không cần thời gian trình chiếu: câu hiện ra là chạm được ngay.

## Ghi chú cho BE

Không. Đáp án là một số nguyên, chấm một lần mỗi câu. `difficultyMultiplier` và `speedAllowanceMs` (hằng số theo mức) đã khai báo trong `marbleDrop`, server dùng qua `gameMultiplier` / `gameSpeedAllowanceMs` như các game khác.

## Câu hỏi mở

- **Siêu khó 3 bi** giữ như bản mẫu, vừa đủ ~8 câu/vòng. Chơi thử thấy dưới 8 câu thì giảm còn 2 bi (núm ở mục Cân bằng).
- **Hệ số Khó 2,65, Siêu khó 4,45** cao hơn các game khác vì chênh lệch thời gian giữa các mức của game này lớn. Cần đo lại sau chơi thử.
- **Luật "khác cốc mọi bi trước"** chặt hơn yêu cầu "khác cốc bi 1" (giữ bẫy "bỏ sót một bi" ở Siêu khó). Ví dụ Siêu khó trong bản mẫu (bi 1 → D, bi 2 → B, bi 3 → C) đã khớp luật này.
