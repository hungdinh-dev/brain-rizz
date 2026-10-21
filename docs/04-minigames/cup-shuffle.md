# Tráo cốc (`cup-shuffle`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006). Kiểm tra não: 30 s như mọi game Nhận diện.
- File: `packages/shared/src/games/cup-shuffle/` (logic + test, đã làm), `apps/web/src/games/cup-shuffle/` (scene + chữ hiển thị, đã làm theo mục Ghi chú cho FE)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M18** (CupShuffleMobile, CupShuffleLevels, CupShuffleStates, CupShuffleHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.
- Nguồn ý tưởng: trò tráo cốc cổ điển, mượn cơ chế của "Úp Nón Tìm Kẹo" (Pumer Party), [kế hoạch mở rộng mục 3.1](../01-product/minigame-expansion.md#31-tráo-cốc-cup-shuffle-nhận-diện). Không chép tên, hình, chữ hay code.

## Cách chơi

Cục phấn nằm dưới một chiếc cốc. Cốc úp xuống rồi tráo chỗ; hết tráo, chạm vào cốc có phấn. Ở Siêu khó có cả phấn lẫn tẩy, hết tráo mới biết phải tìm vật nào.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhớ cốc úp cục phấn
  2. Dõi theo cốc khi tráo
  3. Hết tráo, chạm cốc có phấn
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím (tuỳ chọn): phím 1–5 = cốc thứ 1–5 từ trái sang.
- **Hình minh hoạ:** ba khung nối bằng mũi tên phấn.
  - Trái, biểu tượng mắt: hàng 3 cốc, cốc giữa nhấc lên, thấy cục phấn trắng nằm dưới.
  - Giữa: cốc giữa và cốc phải đổi chỗ, hai mũi tên cong ngược chiều (một vòng trên, một vòng dưới); cốc đang úp phấn có chấm phấn mờ ở chân để người xem biết phải dõi cốc nào.
  - Phải, biểu tượng ngón tay: bàn tay chạm cốc phải, cốc nhấc lên lộ cục phấn, có dấu tích.
  - Góc dưới, cỡ nhỏ: huy hiệu "xoay vòng" (ba mũi tên nối thành vòng tròn, nhắc luật Khó) và huy hiệu "phấn + tẩy" (nhắc luật Siêu khó).
- **Câu nhắc lúc đếm ngược:** "Đừng rời mắt khỏi cục phấn!"
- **Câu nhắc theo mức** (qua `levelHints` của `locales.ts`):
  - Khó: "Có lượt ba cốc xoay vòng!"
  - Siêu khó: "Nhớ cả phấn lẫn tẩy!"
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "3 cốc · 3 lượt" · Thường "3 cốc · 5 lượt nhanh" · Khó "4 cốc · có xoay vòng" · Siêu khó "5 cốc · phấn và tẩy".
- **Thẻ game** (danh mục chọn game): tên "Tráo cốc" / "Cup Shuffle"; mô tả "Dõi theo cốc úp cục phấn" / "Follow the cup hiding the chalk".

## Câu đố & đáp án

- `Puzzle` (kiểu `CupShufflePuzzle`): `{ cups, start, target, moves, showMs, coverMs, moveMs, answer }`
  - `cups`: số cốc, 3 / 3 / 4 / 5 theo mức, xếp một hàng ngang. **Ô** đếm từ trái sang, bắt đầu từ 0.
  - `start: number[]`: ô ban đầu của từng vật theo thứ tự `CUP_SHUFFLE_ITEMS = ["chalk", "eraser"]`. Dài 1 (chỉ phấn), dài 2 ở Siêu khó (phấn, tẩy; hai ô khác nhau).
  - `target`: vật được hỏi (chỉ số trong `start`). Luôn 0 khi chỉ có phấn; Siêu khó là 0 (phấn) hoặc 1 (tẩy), mỗi bên một nửa số câu.
  - `moves: CupShuffleMove[]`: các lượt tráo theo thứ tự.
    - `[a, b]` (`a < b`): đổi chỗ hai cốc ở ô `a` và `b`.
    - `[a, b, c]`: xoay vòng ba cốc cùng lúc: cốc ở `a` sang `b`, cốc ở `b` sang `c`, cốc ở `c` về `a` (`a` nhỏ nhất, `b`, `c` theo một trong hai chiều). Chỉ có từ Khó.
  - `showMs` (cốc nhấc lên, thấy vật), `coverMs = 300` (cốc úp xuống), `moveMs` (một lượt tráo, mọi lượt như nhau).
  - `answer`: ô có vật `target` sau lượt cuối, là đáp án đúng duy nhất.
- Hàm dùng chung trong shared (scene và test dùng, server không cần):
  - `cupShuffleMoveStartMs(p, k)` = `showMs + coverMs + k × moveMs`: mốc bắt đầu lượt `k`.
  - `cupShuffleInputAtMs(p)`: mốc hết tráo, bắt đầu được chạm. Mầm 3 300 · Thường 3 400 · Khó 3 420 · Siêu khó 3 720 ms.
  - `cupShuffleCupOrder(p, k)`: `order[ô]` = số hiệu chiếc cốc đang đứng ở ô đó sau `k` lượt (cốc `i` lúc đầu đứng ở ô `i`). Scene dùng để biết hình cốc nào phải di chuyển ở lượt `k`.
  - `cupShuffleItemSlots(p, k)`: ô của từng vật sau `k` lượt. `cupShuffleApplyMove(ô, lượt)`: ô mới sau một lượt.
- `Answer` (kiểu `CupShuffleAnswer`): `number`, ô của cốc người chơi chạm. Chạm một lần là nộp.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer === puzzle.answer`.
- `isAnswer(value)`: số nguyên 0–4 (5 cốc ở mức nhiều nhất). Từ chối −1, 5, 1,5, `NaN`, vô cực, chuỗi, `null`, `undefined`, `true`, mảng, đối tượng.
- Biểu thức đáp án cho test server: `GAMES["cup-shuffle"].generate(seed, index, difficulty).answer`.

## Cách sinh câu đố

**Nguyên tắc chống đoán mò:** dãy tráo được chọn **trước** và **không phụ thuộc** chỗ giấu vật; chỗ giấu chọn đều, độc lập với dãy. Vì thế nhìn lượt tráo nào (lượt cuối, lượt đầu…) mà không theo dõi vật thì cũng không đoán được vật ở đâu. Ràng buộc chất lượng ("mỗi cốc phải di chuyển ít nhất k lượt") chỉ xét dãy tráo và áp như nhau cho **mọi** cốc, nên không làm lộ chỗ giấu.

Bản nháp trước làm ngược lại (chọn từng lượt theo vị trí phấn: lượt nào cũng chạm phấn, cấm lặp lượt trước), nên chạm ô đầu ở Mầm đúng 57,8 % và đáp án nằm trong lượt cuối 83 % số câu Mầm.

### Mức 3 cốc (Mầm, Thường): danh mục mẫu có trọng số

1. **Mẫu dãy:** mỗi chữ là một lượt đổi chỗ; `A`, `B`, `C` là ba cặp ô khác nhau trong {(0,1), (0,2), (1,2)}. Hai chữ liền nhau luôn khác nhau, nên không lượt nào lặp hay hoàn tác lượt trước.
   - Mầm (3 lượt): `ABA`, `ABC`, trọng số 1, 1. Đây là mọi dãy 3 lượt không lặp.
   - Thường (5 lượt): `ABABA` 4 · `ABABC` 2 · `ABACA` 1 · `ABACB` 1 · `ABCAB` 3 · `ABCAC` 1 · `ABCBA` 1 · `ABCBC` 2. Đây là mọi dãy 5 lượt không lặp. Trọng số là nghiệm nguyên nhỏ nhất (tìm bằng máy) để **mọi chiến lược chỉ dựa vào ô đầu cộng tối đa hai lượt đầu hoặc hai lượt cuối đều đúng đúng 1/3** (test kiểm bằng liệt kê, xem mục dưới). Trọng số đều thì chiến lược "ô đầu + lượt cuối" đúng 50 %.
2. **Danh mục:** mỗi mẫu × 6 cách gán `A`, `B`, `C` cho ba cặp ô × 3 ô giấu phấn. Mầm 12 dãy × 3 = 36 câu (tổng trọng số 36); Thường 48 dãy × 3 = 144 câu (tổng trọng số 270). Dựng một lần rồi giữ trong bộ nhớ.
3. **Lấy mẫu hệ thống theo vòng** (để một vòng không bao giờ lặp câu): chia chỉ số câu thành **khối** `blockSize = ⌊tổng trọng số / trọng số lớn nhất⌋` câu (Mầm 36, Thường 67). Với khối `b`: `rng = createRng(deriveSeed(roundSeed, b, 0x0c5))`, xáo danh mục bằng `rng.shuffle`, trải trọng số các mục nối nhau trên một vòng tròn dài bằng tổng trọng số, lấy `u = rng.int(0, tổng − 1)`. Câu thứ `k` trong khối là mục chứa điểm `(u + k × step) mod tổng`, với `step = ⌊tổng / blockSize⌋` (Mầm 1, Thường 4).
   - Mỗi câu riêng lẻ ra mục `e` với xác suất **đúng bằng** `e.weight / tổng` (vì `u` đều), nên mọi tỉ lệ ở trên giữ nguyên.
   - `step` ≥ mọi trọng số, nên trong một khối không mục nào ra hai lần: Mầm không lặp trong 36 câu liền, Thường trong 67 câu liền (một vòng 60 s chỉ ~11–14 câu).

### Mức 4–5 cốc (Khó, Siêu khó): sinh ngẫu nhiên

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. Chọn số lượt xoay vòng trong khoảng của mức, đặt vào các vị trí đôi một không liền nhau (chọn đều). Lượt đổi chỗ chọn đều trong mọi cặp ô (Khó 6 cặp, Siêu khó 10), lượt xoay chọn đều trong mọi bộ ba ô × 2 chiều (Khó 8, Siêu khó 20). Mỗi lượt phải khác **tập ô** của lượt trước (không lặp, không hoàn tác, không xoay ngược ngay).
3. Nếu có chiếc cốc di chuyển ít hơn 2 lượt thì thử lại (tối đa 64 lần; tỉ lệ đạt mỗi lần ~85 % ở Khó, ~65 % ở Siêu khó; đo được nhiều nhất 6 và 12 lần trên 40 000 câu). Hết 64 lần thì dùng dãy dự phòng cố định trong `CUP_SHUFFLE_LEVELS` (thoả mọi ràng buộc, có test riêng).
4. **Sau khi đã có dãy**, chọn ô giấu bằng `rng.shuffle` các ô rồi lấy 1 (Khó) hoặc 2 ô đầu (Siêu khó: phấn, tẩy), rồi `target = rng.int(0, 1)` ở Siêu khó.

### Đúng một đáp án

Đáp án tính bằng cách cho vật đi theo từng lượt (`cupShuffleItemSlots`). Mỗi lượt là một hoán vị của các ô, nên vật luôn ở đúng một ô; hai vật ở hai ô khác nhau lúc đầu thì cuối cùng vẫn ở hai ô khác nhau. Hỏi vật nào cũng có đúng một cốc đúng. Mọi số là số nguyên; mọi ngẫu nhiên đi qua `createRng`.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 cốc · 3 lượt đổi chỗ · 700 ms/lượt · xem 900 ms | Phấn đi chậm, mỗi lượt chỉ hai cốc chạy; phấn bị chạm 1–3 lượt |
| Thường | 3 cốc · 5 lượt đổi chỗ · 500 ms · xem 600 ms | Nhanh hơn, dài hơn; có 0–3 lượt mồi không chạm phấn |
| Khó | 4 cốc · 6 lượt, trong đó 1–2 lượt **xoay vòng 3 cốc** · 420 ms · xem 600 ms | Thêm một cốc; có lúc ba cốc cùng chạy |
| Siêu khó | 5 cốc · 7 lượt, 2–3 lượt xoay · 360 ms · xem 900 ms · **phấn và tẩy** | Phải dõi hai vật; hết tráo mới hiện vật được hỏi |

Thời gian xem dài hơn ở Mầm (trẻ nhỏ) và Siêu khó (phải nhớ chỗ hai vật). Mọi mức: cốc úp 300 ms.

Độ khó đo được (10 000 câu mỗi mức, test "khó dần theo độ khó"):

| Mức | Đoán mò đúng | Nhịp (lượt/giây) | Số lần cốc chuyển chỗ mỗi câu | Tổng lượt chạm cốc có vật phải nhớ (TB) | Ít nhất mỗi vật bị chạm |
| --- | --- | --- | --- | --- | --- |
| Mầm | 33 % | 1,43 | 6 | 2,00 | 1 |
| Thường | 33 % | 2,00 | 10 | 3,34 | 2 |
| Khó | 25 % | 2,38 | 13,5 | 3,36 | 2 |
| Siêu khó | 20 % | 2,78 | 16,5 | 6,62 (hai vật) | 2 |

Không mức nào dễ hơn mức trước ở bất kỳ chỉ số nào. Khó chỉ ngang Thường về số lượt chạm phấn; Khó khó hơn nhờ thêm cốc, xoay vòng và nhịp nhanh hơn.

## Đảm bảo khi sinh câu đố

Kiểm bằng `cup-shuffle.test.ts` (15 ca, 10 000 câu × 4 mức, chạy ~2 s):

- **Đúng một đáp án:** `check` chỉ đúng ở `answer` (thử −1 tới 5); `answer` khớp cách tính độc lập (theo dõi từng chiếc cốc) và khớp `cupShuffleCupOrder`; hai vật luôn ở hai cốc khác nhau.
- **Bất biến:** đúng số cốc, số lượt, nhịp, số vật của bảng Độ khó; ô đầu khác nhau và trong hàng; mỗi lượt dài 2 hoặc 3 với các ô khác nhau trong hàng (không có lượt "không làm gì"); đổi chỗ có `a < b`; không lượt nào cùng tập ô với lượt trước; không hai lượt xoay liền nhau; số lượt xoay đúng khoảng; mỗi chiếc cốc di chuyển ≥ 1 lượt (Mầm) / ≥ 2 lượt (các mức khác); dãy mức 3 cốc thuộc bảng mẫu. Dãy dự phòng cũng thoả các điều trên.
- **Tất định:** cùng tham số → cùng câu; ba câu cố định (seed 123 456, câu 7, Mầm / Thường / Siêu khó) ghi cứng trong test.
- **Không thiên vị:** đáp án ở mỗi ô lệch < 10 % so với trung bình; Siêu khó hỏi phấn và tẩy mỗi bên > 47 %; tần suất từng mẫu dãy ở Mầm, Thường khớp trọng số (lệch < 12 %).
- **Khó dần:** như bảng trên. **Thời gian:** `speedAllowanceMs` = `cupShuffleInputAtMs`, nhỏ hơn thời lượng vòng. **Hệ số** Thường = 1, không giảm khi lên mức.

### Chống đoán mò và lặp câu (ba lỗi của bản nháp)

Đo trên 10 000 câu mỗi mức. "Chạm cốc lượt cuối" = chạm ngẫu nhiên một trong các cốc của lượt tráo cuối. "Ô đầu + lượt cuối" = chiến lược tốt nhất chỉ dựa vào quan hệ của mỗi cốc với ô đầu của vật được hỏi, ô đầu của vật kia và lượt cuối.

| Mức | Đoán mò | Chạm ô đầu | Chạm cốc lượt cuối | Ô đầu + lượt cuối | Số câu khác nhau | Lặp trong một vòng |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 33,3 % | 33,3 % | 33,2 % | 50,1 % (giới hạn đã biết) | 36 (cả danh mục) | Không (36 câu liền) |
| Thường | 33,3 % | 33,3 % | 33,8 % | 33,8 % (liệt kê chính xác: 33,3 %) | 144 (cả danh mục) | Không (67 câu liền) |
| Khó | 25 % | 26,1 % | 24,6 % | 26,4 % | 9 977 / 10 000 | Không thấy trong 500 vòng × 30 câu |
| Siêu khó | 20 % | 20,8 % (ô đầu vật kia: 19,2 %) | 19,9 % | 21,4 % | 10 000 / 10 000 | Không thấy trong 500 vòng × 30 câu |
| *Bản nháp* | | *Mầm 57,8 %* | *Mầm: đáp án ∈ lượt cuối 83 %* | | *Mầm 30, Thường 126* | *gần như chắc lặp* |

Ngưỡng trong test: chạm ô đầu và chạm cốc lượt cuối lệch đoán mò < 2,5 điểm %; ô đầu + lượt cuối < 52,5 / 36 / 28 / 23 %; Mầm và Thường dùng hết danh mục; Khó > 98 %, Siêu khó > 99,5 % câu khác nhau; 30 câu đầu của 500 vòng không trùng nhau ở mọi mức. Thêm phần **liệt kê chính xác** cho mức 3 cốc (số nguyên, không sai số mẫu): ở Thường, cả sáu góc nhìn (ô đầu; ô đầu + lượt cuối; + 2 lượt cuối; + lượt đầu; + 2 lượt đầu; + lượt đầu và lượt cuối) đều đúng đúng 1/3; ở cả Mầm lẫn Thường, đáp án nằm trong 2 cốc của lượt cuối đúng 2/3 số câu.

**Giới hạn đã biết ở Mầm:** với 3 cốc, hai lượt đổi chỗ khác nhau liền nhau không bao giờ đưa phấn về chỗ cũ. Mầm chỉ có 3 lượt, nên ai nhớ ô đầu và thấy lượt cuối loại được một cốc (đúng 50 %). Liệt kê chứng minh không bộ trọng số nào sửa được điều này khi có 3 lượt mà không cho lượt hoàn tác. Chấp nhận vì Mầm dành cho trẻ 7 tuổi và mẹo này phải suy luận mới thấy; hai chiến lược đơn giản (chạm ô đầu, chạm cốc lượt cuối) vẫn đúng đúng 1/3. Xem Câu hỏi mở.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức. Số liệu ước lượng trên giấy, đo lại sau buổi chơi thử đầu tiên.

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ đúng mục tiêu | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | xem + tráo 3,3 s + chọn ~1,4 s + chuyển 0,3 s ≈ 5,0 s | ~85 % (trẻ 7 tuổi) | 11,1 câu (9,4 đúng) |
| Thường | 3,4 + ~0,8 + 0,3 ≈ 4,5 s | ~90 % | 12,5 câu (11,3 đúng) |
| Khó | 3,42 + ~1,0 + 0,3 ≈ 4,7 s | ~80 % | 11,6 câu (9,3 đúng) |
| Siêu khó | 3,72 + ~1,5 + 0,3 ≈ 5,5 s | ~70 % | 9,7 câu (6,8 đúng) |

"Chọn" là lúc hết tráo tới lúc chạm: nhìn lại cốc mình đang dõi rồi chạm một lần. Siêu khó chậm hơn vì phải xem vật được hỏi rồi mới nhớ lại cốc của vật đó. Các mức không chồng nhau: phần chọn 0,8 / 1,0 / 1,5 s ở người lớn, tỉ lệ đúng 90 / 80 / 70 %. Siêu khó vẫn còn ~9,7 câu mỗi vòng (≥ 8).

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong `cupShuffle`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | 3 300 | Mô phỏng trẻ 7 tuổi cần 1,40 → min(1,40; 1) = 1 |
| Thường | 1 | 3 400 | Mốc so sánh |
| Khó | **1,45** | 3 420 | Mô phỏng cần 1,46, làm tròn tới 0,05 |
| Siêu khó | **2,35** | 3 720 | Mô phỏng cần 2,34, làm tròn tới 0,05 |

- `speedAllowanceMs(puzzle)` = `cupShuffleInputAtMs(puzzle)` = xem + úp + mọi lượt tráo: toàn bộ phần không chạm được. Đo từ lúc câu hiện ra thì không ai đạt trọn 50 điểm tốc độ.
- Cách mô phỏng (50 000 vòng 60 s mỗi mức, bằng chính `generate()`, `speedAllowanceMs` và `pointsForCorrect`): thời gian chọn ở bảng trên, dao động đều ±30 %; đúng theo tỉ lệ mục tiêu. Câu đúng: 0,3 s hiệu ứng tính vào câu sau (cả vào thời gian tính thưởng). Câu sai: tốn thời gian như câu đúng + khoá 1,5 s. Combo trần × 1,5. Điểm vòng tuyến tính theo hệ số nên giải ra hệ số để bằng Thường.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 11,1 | 9,4 | 11,1 | 48,4 | 1,40 | 1 | ~1 650 (79 %) |
| Thường | 12,5 | 11,3 | 13,9 | 50,0 | 1 | 1 | ~2 090 (100 %) |
| Khó | 11,6 | 9,3 | 10,7 | 50,0 | 1,46 | 1,45 | ~2 080 (100 %) |
| Siêu khó | 9,7 | 6,8 | 7,4 | 47,8 | 2,34 | 2,35 | ~2 100 (100 %) |
| Người lớn chọn Mầm (chọn ~0,6 s, đúng ~98 %) | 13,9 | 13,6 | 18,1 | 50,0 | 0,66 | 1 | ~2 715 (130 %) |

- Hệ số chung cũ (0,8 / 1 / 1,25 / 1,5) làm người chọn Khó, Siêu khó thiệt rõ: thời gian tráo gần như cố định nên số câu không giảm bao nhiêu, nhưng tỉ lệ đúng giảm và combo gãy nhiều.
- Script mô phỏng không lưu trong repo; đổi tham số thì chạy lại theo đúng các bước trên.

**Điểm chuẩn Kiểm tra não** (Thường, 30 s, theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não)): 4 000 lượt; mỗi câu xem + tráo 3,4 s cố định, chọn 0,8 s dao động đều ±20 %, sai 10 %; câu sai tốn như câu đúng + khoá 1,5 s; giữa hai câu 0,25–0,35 s; câu chưa xong khi hết giờ không tính. Kết quả 5,98 câu · 5,38 đúng · 907 điểm → **điểm chuẩn 900**. Người nhanh hơn 30 % (chọn 0,56 s): 1 024 điểm (**× 1,14**); chậm hơn 40 % (chọn 1,12 s): 864 điểm (**× 0,96**). Pha tráo cố định chiếm ~3/4 mỗi câu nên tốc độ tay ảnh hưởng ít, giống các game Ghi nhớ (× 1,15–1,23), khác các game Nhận diện khác (× 1,33–1,41).

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên (đổi thì sửa bảng Độ khó, test, và tính lại hệ số; chỉ sửa số trong `CUP_SHUFFLE_LEVELS`):

1. Siêu khó đúng < 60 %: `moveMs` 360 → 400, hoặc bớt một lượt xoay (2–3 → 1–2).
2. Trẻ ở Mầm đúng < 80 %: `moveMs` 700 → 800.
3. Thường và Khó quá gần nhau: Khó lên 7 lượt.

## Ghi chú cho FE

Scene không vẽ chữ: chỉ cốc, vật, biểu tượng, thanh thời gian. Canvas trong suốt trên khung `bg-muted`, nên cốc và vật tự có viền mực + nền, đọc token màu lúc tạo scene. `locales.ts`: tên, cách chơi, câu nhắc, gợi ý mức như mục Màn hướng dẫn. Thẻ game ở `features/game-select/catalog.ts` và i18n: tên + mô tả như mục Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `CupShufflePuzzle`, `CupShuffleAnswer`, `CupShuffleMove`, `CUP_SHUFFLE_ITEMS`, `cupShuffleMoveStartMs`, `cupShuffleInputAtMs`, `cupShuffleCupOrder`, `cupShuffleItemSlots`, `WRONG_ANSWER_LOCK_MS`.

| Trường | Dùng để |
| --- | --- |
| `cups` | Bố cục hàng cốc (3, 4 hay 5) |
| `start` | Vẽ vật dưới cốc nào ở pha xem (`start[0]` phấn, `start[1]` tẩy) |
| `moves`, `cupShuffleCupOrder(p, k)` | Lượt `k`: hình cốc nào ở ô nào trước lượt, chạy tới ô nào |
| `showMs`, `coverMs`, `moveMs`, `cupShuffleMoveStartMs`, `cupShuffleInputAtMs` | Dòng thời gian của câu |
| `target` | Siêu khó: vật được hỏi, hiện lúc hết tráo |
| `answer` | Chấm ngay ở client, hiện đáp án khi sai |

### Dòng thời gian (bắt buộc)

- Scene chạy theo **dòng thời gian của `Puzzle`**, không đếm khung hình: mỗi khung tính `t = now − t0` (đồng hồ của scene, `this.time.now`, `t0` lấy ở khung hình đầu tiên của câu) rồi đặt **mọi** cốc đúng vị trí của thời điểm `t`, như một hàm thuần của `t`. Không dùng tween nối đuôi nhau hay bộ đếm khung hình cho phần tráo, để máy chậm, rớt khung hay đổi tần số màn hình không làm lệch: lượt `k` luôn chạy trong `[cupShuffleMoveStartMs(p, k), … + moveMs)`, và lúc `t = cupShuffleInputAtMs(p)` mọi cốc đã đứng yên đúng ô cuối.
- Ngoại lệ an toàn: nếu giữa hai khung hình trong pha tráo `t` nhảy quá 250 ms (tab bị bóp, GC), cộng phần nhảy đó vào `t0` (dừng đồng hồ của câu) để không lượt tráo nào bị bỏ qua mà người chơi không thấy.
- Trong một lượt, vị trí theo tỉ lệ `u = (t − start_k) / moveMs`, đi qua hàm làm mượt dạng `easeInOutSine`.

### Bố cục (khung 720×1280, chờ bản mẫu của ui-designer)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | huy hiệu tròn Ø 112, tâm (360, 140) | Mắt (xem) → cốc úp (tráo) → ngón tay (chờ chạm). Khó, Siêu khó: huy hiệu xoay vòng Ø 80 tại (500, 140), sáng lên trong lượt xoay. |
| Thanh tráo / khoá | 420×14, góc (150, 229) | Pha xem + tráo: màu nhóm Nhận diện (cam `--color-identify`), rút dần tới `cupShuffleInputAtMs`. Lúc khoá: màu mực, rút trong thời gian khoá. Ẩn ở pha chờ chạm. |
| Hỏi vật (Siêu khó) | bong bóng Ø 140, tâm (360, 420) | Từ `cupShuffleInputAtMs`: hình vật được hỏi (phấn hoặc tẩy), viền vàng. Dưới y 225 nên huy hiệu khoá không che. |
| Hàng cốc | đáy cốc ở y 820, mặt bàn (vạch phấn ngang) y 830 | 3 cốc: tâm x 160 / 360 / 560, cốc 150×170. 4 cốc: x 120 / 280 / 440 / 600, cốc 130×150. 5 cốc: x 96 / 228 / 360 / 492 / 624, cốc 112×130. |

- **Vùng chạm** = cả cột của ô (bề rộng bằng khoảng cách hai tâm: 200 / 160 / 132 px, cao từ y 560 tới 900). Trên điện thoại 390 px còn ~72–108 px ≥ 48 px. Chạm theo **ô**, không theo hình cốc: đáp án là ô.
- Một điểm chạm mỗi lúc, dùng `pointerdown`. Trước `cupShuffleInputAtMs` bỏ qua mọi lần chạm, không tính sai. Bàn phím (tuỳ chọn): phím 1–5 = ô 0–4, chỉ nhận phím ≤ `cups`.

### Đường đi của cốc

- **Đổi chỗ `[a, b]`:** hai cốc đi hai cung ngược nhau, cốc đi sang phải vòng **phía trên**, cốc đi sang trái vòng **phía dưới** (to hơn 6 %, như đi phía trước). Độ cao cung tỉ lệ với khoảng cách, ~0,35 × quãng đường, tối đa 140 px. Cốc ở giữa (khi đổi hai ô không kề nhau) đứng yên.
- **Xoay vòng `[a, b, c]`:** ba cốc chạy cùng lúc, mỗi cốc tới ô kế trong vòng. Cốc đi sang phải vòng trên, cốc đi sang trái vòng dưới; hai cốc cùng chiều thì cốc đi xa hơn vòng cao hơn. Không lúc nào hai cốc chồng khít lên nhau.
- Mọi cốc giống hệt nhau trong pha tráo (không màu, số hay vết riêng), nếu không người chơi chỉ cần nhớ màu cốc. Vật không hiện xuyên cốc.

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Đang xem | `[0, showMs)` | Mọi cốc nhấc lên ~90 px, vật nằm dưới cốc của nó; biểu tượng mắt; thanh rút dần | Không |
| Úp cốc | `[showMs, showMs + coverMs)` | Cốc hạ xuống, che vật | Không |
| Đang tráo | tới `cupShuffleInputAtMs` | Cốc chạy theo `moves`; Khó, Siêu khó: huy hiệu xoay vòng sáng trong lượt xoay | Không |
| Chờ chạm | từ `cupShuffleInputAtMs` | Cốc đứng yên, ngón tay; Siêu khó: bong bóng hỏi vật. Máy tính: rê chuột cốc nhấc lên 8 px | Có, một lần |
| Đúng | chạm `answer` | Gửi đáp án; cốc vừa chạm nhấc lên lộ vật, vòng vàng + dấu tích, ≤ 300 ms vì tính vào câu sau; sang câu mới | Không |
| Sai / khoá | chạm ô khác | Gửi ngay; xem mục dưới | Không, suốt thời gian khoá |

### Hiện đáp án đúng khi sai (CR-006)

- Vào khoá là hiện ngay (client đã có `answer`), suốt thời gian khoá lấy từ `bridge.unlockDelay`.
- **Mọi cốc nhấc lên**: người chơi thấy vật thật nằm ở đâu (Siêu khó thấy cả phấn lẫn tẩy).
- Cốc đúng (ô `answer`): vòng vàng dày quanh cốc và vật, không mờ.
- Cốc chạm sai: dấu X hai nét (`--destructive`, viền trắng) trên chỗ trống (hoặc trên vật kia ở Siêu khó), rung ngang ±8 px trong 200 ms.
- Các cốc còn lại mờ còn 35 %.
- Mọi thứ trên nằm dưới y 560, không bị huy hiệu khoá ở dải trên cùng che (tới y ≈ 225).

### Hiển thị vật (không chỉ bằng màu)

- **Phấn:** thanh trụ ngắn nằm ngang, đầu vát, trắng ngà, viền mực. **Tẩy:** khối chữ nhật dẹt, nửa trên gỗ nâu có vân, nửa dưới nỉ xám. Hai vật khác hẳn **dáng** ở cỡ 64 px (dài mảnh và vuông dẹt).
- Đúng: vòng vàng + dấu tích. Sai: dấu X + rung. Ô hỏi Siêu khó: bong bóng viền vàng + hình vật (không viết chữ).
- Nền tối: cốc nền mực (`--sticker`) viền phấn; vật giữ màu.

### Hiệu ứng và giảm chuyển động

- Hiệu ứng phụ (đều ≤ 300 ms): cốc nghiêng nhẹ theo hướng chạy, bụi phấn khi cốc chạm bàn, cốc "nhún" khi dừng, vật nảy khi lộ ra, rung khi sai, câu mới mờ dần vào 120 ms.
- **Giảm chuyển động KHÔNG bỏ phần tráo**: chuyển động của cốc là nội dung câu đố, nên đường đi, thời lượng và dòng thời gian giữ nguyên. Pha nhấc / úp cốc ở đầu câu cũng giữ (là luật chơi). Chỉ bỏ hiệu ứng phụ: nghiêng, bụi phấn, nhún, nảy, rung, mờ dần; giữ dấu tích, X, vòng vàng, cốc nhấc lên khi hiện đáp án.
- Máy chủ dự án đang bật giảm chuyển động: phải chơi thử trên máy đó để chắc phần tráo vẫn chạy.

### Âm thanh (GĐ 2)

- Mỗi lượt tráo: tiếng "sột" khẽ của cốc trượt trên bàn (lượt xoay: ba tiếng chồng nhẹ). Đúng: "ting" cao dần theo combo. Sai: "bụp" trầm + rung ngắn. Game chơi được trọn vẹn khi tắt tiếng.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, chiếu lại câu đó từ pha xem.
- Ẩn tab lúc đang xem hoặc tráo: quay lại thì chiếu lại câu từ đầu (pha xem). Đang chờ chạm thì giữ nguyên.

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M18 thắng về hình; bố cục, dòng thời gian, quỹ đạo, vùng chạm giữ như trên. Khung chơi là nền `--muted` (#f3eadf / #3a3560).

- **Cốc (đã chốt), cùng màu ở hai giao diện:** thân #f2a541, dải ngang #fff8ef (nét mực hai mép), vành #e08f2e, viền `--sticker`, bóng nửa phải mực 14 %, hai nét bóng giấy bên trái. Thay cốc giấy (sáng) và cốc mực viền phấn (tối) ở mục Hiển thị vật.
- **Tẩy (đã chốt):** tay cầm xanh #4f8fd9 (vệt sáng #9cc4f0), nỉ #c9c6dc (chấm #a29ebb), viền mực. Bỏ gỗ nâu: trùng tông cốc cam và bàn gỗ, chỉ 2,5:1 trên #3a3560 (tay cầm 3,3:1, nỉ 6:1). Phấn giữ #fff8ef.
- Vật không có viền phấn ở nền tối (bỏ `halo` trong `itemColors`); bong bóng hỏi vật vẽ vật với mực #1f1b3a.
- **Bàn gỗ thay vạch phấn:** rect (36, 820) 648×30 r10 gỗ #a8693b (tối #6b4528), viền sticker 4, bóng lệch y +6; mặt trên (42, 824) 636×7 #c58350 (tối #8a5a36); 3 vân đen 16 %. Đáy cốc vẫn y 820.
- Bóng cốc: rx = 0,46 × rộng × (1 − min(0,3; độ nhấc/400)); ẩn khi cốc đang vòng phía dưới.
- Biểu tượng "cốc úp" trong huy hiệu trạng thái dùng cốc màu mới.
- Dấu X khi sai: viền dưới #ffffff (sáng) / #f6f3ea (tối); đặt (x ô, 790) ở chỗ trống, (x ô, 806) khi đè vật kia.
- `CupShuffleHowTo.tsx`: cốc dán cùng màu (40×46) trên bàn gỗ nhỏ, ba huy hiệu mắt / cốc úp / bàn tay ở đỉnh ba khung, khung phải có bàn tay + vòng vàng + tích, hai huy hiệu dưới (xoay vòng nền cam, viên giấy phấn + tẩy).
- Chi tiết số liệu từng việc: file fixes do phiên điều phối chuyển cho frontend-dev.

## Ghi chú cho BE

- **Không cần tin nhắn mới.** Đáp án là một số nguyên; `isAnswer` kiểm hình dạng; mỗi câu chấm một lần.
- `cupShuffle.speedAllowanceMs(puzzle)` (3 300 / 3 400 / 3 420 / 3 720 ms) và `difficultyMultiplier` = 1 / 1 / 1,45 / 2,35 đã khai báo trong định nghĩa game; server dùng các trường chung của CR-006, không cần sửa.
- Không từ chối đáp án đến sớm hơn `cupShuffleInputAtMs` (lệch mạng); thời gian tính thưởng chỉ bị kẹp về 0, như Ai vừa biến mất.
- Câu của Mầm, Thường phụ thuộc cả khối câu cùng vòng (lấy mẫu hệ thống), nhưng vẫn chỉ từ `(seed, index, difficulty)`; server gọi `generate()` như mọi game.
- Điểm chuẩn Kiểm tra não đề xuất: **900** (thay số giữ chỗ 1 500 trong `BRAIN_TEST_REFERENCE_SCORE`).

## Câu hỏi mở

- **Mầm: giữ 3 lượt (theo kế hoạch) hay lên 4 lượt × 600 ms?** 3 lượt có giới hạn "ô đầu + lượt cuối" đúng 50 % (mục Chống đoán mò). 4 lượt với trọng số mẫu `ABAB 2 · ABAC 1 · ABCA 2 · ABCB 1` làm góc nhìn đó đúng đúng 1/3, nhưng "ô đầu + 2 lượt cuối" lên 2/3, và trẻ phải dõi thêm một lượt. Đề xuất: giữ 3 lượt, xem lại sau chơi thử.
- **Thường: mẫu `ABABA` chiếm 27 % số câu** (trọng số bắt buộc để công bằng chính xác cả sáu góc nhìn). Nếu chơi thử thấy lặp nhịp, đổi sang trọng số `3,1,1,1,3,1,1,1` (`ABABA` 25 %, chỉ góc nhìn "ô đầu + lượt đầu + lượt cuối" lên 41,7 %).
- **Siêu khó hệ số 2,35** dựa trên giả định 70 % đúng (65 % đúng thì cần 2,64). Chơi thử mà người lớn đúng nhiều hơn hẳn thì chạy lại mô phỏng và giảm hệ số.
- **Người lớn chọn Mầm được ~130 % điểm Thường** (luật Mầm = min(mô phỏng trẻ, 1) giữ hệ số 1), giống các game khác.
- **Kiểm tra não:** pha tráo cố định làm điểm ít phân biệt người nhanh/chậm (× 1,14 / × 0,96). Điều phối cân nhắc ghi vào "Hạn chế đã biết" của GDD cùng nhóm Ghi nhớ.
