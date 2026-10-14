# Nhìn từ trên (`top-view`)

- Nhóm: Hình dung (`visualize`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo [CR-006](../00-tracking/change-requests.md#cr-006))
- Trạng thái đặc tả: **bản đầu, chờ duyệt** (game-designer, 2026-10-14). Luật chơi bám bản mẫu đã duyệt trên canvas; các con số ở mục Cân bằng là ước lượng, chốt sau buổi chơi thử.
- File:
  - `packages/shared/src/games/top-view/`: `top-view.ts` (bộ sinh, kiểu `TopViewPuzzle`/`TopViewAnswer`, export ra ngoài), `patterns.ts` (kho hình chiếu, nội bộ), `iso.ts` (hình học isometric: vẽ theo tam giác, độ che khuất, đếm cách hiểu hình vẽ; nội bộ), `top-view.test.ts`.
  - `apps/web/src/games/top-view/` (scene + `locales.ts`): đã làm theo bản mẫu (2026-10-14), chờ chơi thử.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M8**: `TopViewMobile`, `TopViewLevels`, `TopViewStates`, `TopViewHowTo` (đã duyệt).

## Cách chơi

Trên cùng là một mô hình khối lập phương xếp trên bệ vuông, vẽ nghiêng (isometric); mép trước của bệ tô cam, có nhãn **Trước**. Chạm vào hình chiếu **nhìn thẳng từ trên xuống**, trong đó mép trước nằm ở dưới (vạch cam dưới lưới).

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn mô hình từ trên xuống
  2. Mép cam là phía trước
  3. Chạm hình chiếu đúng
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ:** theo artboard `TopViewHowTo`. Trên: thẻ mô hình, bốn cột khối xếp chữ L trên bệ 3×3, mép trước tô cam, huy hiệu con mắt + mũi tên chỉ nhìn từ trên xuống. Dưới trái: lưới 3×3 tô chữ L, vạch cam ở cạnh dưới, khoanh phấn vàng + dấu ✓; một mũi tên phấn cong từ mô hình xuống thẻ này, cạnh đó là con mắt phấn nhìn xuống. Dưới phải: chữ L bị lật gương, gạch chéo ✗ kèm icon gương.
- **Câu nhắc lúc đếm ngược:** "Mép cam nằm ở dưới!"
- **Câu nhắc theo mức:**
  - Khó: "Ô ghi số tầng, coi chừng xoay!"
  - Siêu khó: "Soát kỹ số tầng từng ô!"

## Câu đố & đáp án

- `Puzzle` (`TopViewPuzzle`):
  - `size`: cạnh bệ, 3 (Mầm, Thường) hoặc 4 (Khó, Siêu khó).
  - `heights[r][c]`: số khối chồng ở ô (c, r) của mô hình, 0 là ô trống. **c** tính từ trái sang phải khi đứng ở mép trước nhìn vào; **r = 0** là hàng xa nhất, **r = size − 1** là hàng sát mép trước (mép cam).
  - `showHeights`: thẻ lựa chọn có ghi số tầng không (Khó, Siêu khó).
  - `choices: { grid: number[][]; kind }[]`: 3 thẻ (Mầm) hoặc 4, đúng thứ tự trên màn hình (trái → phải, trên → dưới). `grid[r][c]` cùng hướng với `heights` (hàng cuối nằm sát vạch cam): 0 là ô trống; ô có khối là 1 ở Mầm, Thường (chỉ tô ô) và là số tầng ở Khó, Siêu khó.
  - `answerIndex`: vị trí thẻ đúng.
- `Answer` (`TopViewAnswer`): số nguyên 0–3, chỉ số thẻ được chạm. `check` đúng khi `answer === answerIndex`; `isAnswer` chỉ nhận `typeof number`, số nguyên, `0 ≤ n < 4`.
- Module export thêm (tên có tiền tố vì `games/index.ts` gom mọi game bằng `export *`):
  - `TOP_VIEW_LEVELS: Record<Difficulty, TopViewLevel>`: cạnh bệ, số tầng cao nhất, số cột, số lựa chọn, `showHeights` của từng mức (FE dùng để dựng bố cục trước khi có câu).
  - `TOP_VIEW_MAX_CHOICES = 4`.
  - `topViewCubes(heights)`: danh sách khối `{ c, r, h }` theo đúng thứ tự vẽ (xem [Ghi chú cho FE](#vẽ-mô-hình-isometric)).
  - `generateTopView(seed, index, difficulty, attempts?)`: chính là `generate`, thêm tham số `attempts` chỉ để test ép dùng mô hình dự phòng. FE và server dùng `topView.generate`.

## Cách sinh câu đố

### Hình học isometric (`iso.ts`)

Điểm (c, r, z) vẽ ra màn hình tại X = c − r, Y = c + r − 2z (X tính bằng nửa bề ngang mặt trên một khối, Y bằng một phần tư chiều cao mặt trên). Màn hình được lát kín bằng các tam giác đều có một cạnh đứng, và mỗi mặt khối (trên, trái, phải) gồm đúng hai tam giác. Vì chiều cao là số nguyên, mọi chỗ che khuất đều trùng biên tam giác, nên "lộ bao nhiêu mặt trên" tính chính xác tới từng nửa mặt, không làm tròn.

- **Thứ tự vẽ:** khối có c + r + h lớn hơn ở gần người nhìn hơn; các khối cùng tổng không chồng nhau trên màn hình.
- **Mặt trên lộ ra:** nửa trái mặt trên của cột (c, r) cao H bị che khi có k ≥ 0 với ô (c + k, r + k + 1) cao ≥ H + k + 1; nửa phải bị che khi có ô (c + k + 1, r + k) cao ≥ H + k + 1; cả mặt bị che khi có k ≥ 1 với ô (c + k, r + k) cao ≥ H + k. Chỉ ô phía trước mới che được.
- **Bức vẽ** = loại mặt (sàn / mặt trên / mặt trái / mặt phải / trống) ở từng tam giác. Hai bảng chiều cao cho cùng bức vẽ thì nhìn y hệt nhau, kể cả các nét viền (các khối trên cùng một đường nhìn có chung hình lục giác, nên nét viền suy ra được từ loại mặt).
- **Đếm cách hiểu** (`isoCountInterpretations`): đếm mọi bảng chiều cao (mỗi ô 0 … giới hạn) mà mọi cột đều lộ ít nhất nửa mặt trên và vẽ ra y hệt mô hình. Quy hoạch động theo đường chéo c − r từ trái sang phải: dải màn hình giữa hai đường đứng X = s − 1 và X = s chỉ phụ thuộc hai đường chéo s − 1 và s. Mỗi ô chỉ thử các chiều cao có "mặt trên" đúng chỗ trong hình đích; ô sàn còn lộ thì chắc chắn trống. Mất khoảng 0,02 ms (3×3) tới 0,2 ms (4×4, 4 tầng).

Vì sao cần đếm cách hiểu: vét cạn mọi bảng 3×3 cao ≤ 3 cho thấy **3,8%** bảng có mọi cột lộ mặt trên vẫn vẽ ra giống hệt một bảng khác cũng đạt luật đó (ví dụ khối ở ô (0, 0) trông y như tầng 2 của ô (1, 1) khi sàn quanh nó bị che kín). Luật "mọi ô lộ ≥ 50% mặt trên" một mình không đủ.

### Kho hình chiếu (`patterns.ts`, tính một lần, không ngẫu nhiên)

Hình chiếu là tập ô có khối trên bệ n × n, liệt kê theo mặt nạ bit tăng dần (bit r·n + c). "Không đối xứng" nghĩa là 8 phép biến đổi của bệ (4 phép xoay × có/không lật) cho 8 hình khác nhau.

| Mức | Kho | Số hình |
| --- | --- | --- |
| Mầm | Mọi cách đặt hình 4 ô liền cạnh họ L, T, S trên bệ 3×3 | L 16 · T 8 · S 8 |
| Thường | Hình 5 hoặc 6 ô liền cạnh, không đối xứng, trên bệ 3×3, kèm các cách "dời 1 ô": bỏ một ô, đặt vào ô trống bất kỳ, được hình B vẫn liền cạnh, không đối xứng và khác bản gương của hình gốc | 5 ô: 24 hình, 164 cách dời · 6 ô: 32 hình, 200 cách dời |
| Khó | Hình 8–10 ô liền cạnh, không đối xứng, trên bệ 4×4 | 1 400 · 1 976 · 2 176 |
| Siêu khó | Hình 11–13 ô liền cạnh, không đối xứng, trên bệ 4×4 | 1 944 · 1 144 · 448 |

Kho 4×4 tính lười ở lần đầu cần (duyệt 65 536 mặt nạ cho mỗi số ô), vài chục ms mỗi mức.

### Một câu đố

`rng = createRng(deriveSeed(roundSeed, index))`. Bộ sinh có vòng thử lại: số lần gọi `rng` đổi theo seed nhưng vẫn tất định.

1. **Chọn trước, ngoài vòng thử lại:** Mầm chọn họ đáp án (`rng.pick` trong L, T, S); các mức khác chọn số cột (`rng.int` trong khoảng của mức). Nhờ vậy ba họ hay các số cột ra đều nhau dù tỉ lệ bị loại khác nhau.
2. **Vòng thử (tối đa 40 lần):**
   1. Chọn hình chiếu: `rng.pick` trong kho của mức (Mầm: các cách đặt của họ đã chọn).
   2. Gán số tầng, **từ ô gần người nhìn nhất (c + r lớn) vào trong**: mỗi ô chọn `rng.pick` trong các chiều cao 1 … tầng cao nhất làm mặt trên của nó lộ ít nhất một nửa, xét các ô phía trước đã gán. Chiều cao lớn nhất luôn hợp lệ nên luôn chọn được, và vì chỉ ô phía trước mới che được, ô gán sau không làm hỏng ô gán trước.
   3. Giữ mô hình nếu: có ít nhất một cột cao đúng tầng cao nhất của mức, và **đếm cách hiểu = 1** với giới hạn tầng cao nhất + 1 (để người chơi không hiểu nhầm cả khi tưởng có cột cao hơn mức cho phép).
   4. Khó, Siêu khó kiểm thêm: mọi lựa chọn sai, coi như một mô hình, vẽ ra khác mô hình thật (Siêu khó: chọn cặp đổi chỗ ở bước 3 dưới đây ngay trong vòng thử).
   5. Hết 40 lần (thực tế không xảy ra: mỗi lần đạt khoảng 78–95%) thì dùng **mô hình dự phòng** cố định của mức, đã kiểm trong test là đạt mọi luật.
3. **Lựa chọn sai** (G là lưới đáp án: Mầm, Thường là lưới tô ô của mô hình; Khó, Siêu khó là chính `heights`):
   - **Mầm:** hai họ còn lại, mỗi họ `rng.pick` một cách đặt. `kind = "other"`.
   - **Thường:** gương của G (`"mirror"`); B = G dời 1 ô (`rng.pick` trong các cách dời của hình, `"shifted"`); gương của B (`"shifted-mirror"`).
   - **Khó:** gương của G (`"mirror"`); G xoay 90°, chiều xoay `rng.int(0, 1)` (theo hay ngược kim đồng hồ, `"rotation"`); gương của bản xoay (`"rotation-mirror"`).
   - **Siêu khó:** gương của G (`"mirror"`); S = G đổi số tầng của hai ô liền cạnh, cả hai có khối và khác số tầng (`"swapped"`; chọn bằng `rng.int` trong danh sách cặp theo thứ tự, bỏ cặp nào đổi xong vẽ ra y hệt mô hình); gương của S (`"swapped-mirror"`).
   - "Gương" luôn là lật trái–phải (c → n − 1 − c), giữ nguyên mép trước.
4. Xếp vị trí: `rng.shuffle` danh sách (đáp án đứng đầu), `answerIndex` là vị trí mới của đáp án.

### Vì sao chắc chắn đúng một đáp án

- Đáp án là đúng lưới hình chiếu (hoặc lưới số tầng) của mô hình.
- Mầm: hai lựa chọn kia khác họ hình nên không trùng hình chiếu ở bất kỳ vị trí nào.
- Thường, Khó: hình chiếu không đối xứng nên gương, bản xoay 90° và gương của bản xoay đều khác đáp án ngay ở tập ô; bản dời 1 ô khác đáp án hai ô; gương của nó khác đáp án vì B khác gương của G.
- Siêu khó: gương khác ở tập ô; bản đổi số tầng cùng tập ô nhưng khác số tầng ở hai ô; gương của nó khác tập ô.
- Bốn lựa chọn đôi một khác nhau (test kiểm trực tiếp).

### Vì sao nhìn hình là suy ra được (công bằng)

- Mọi cột lộ ít nhất nửa mặt trên, nên không có cột nào bị che kín.
- Hình vẽ chỉ hiểu được đúng một cách trong mọi bảng chiều cao mà mọi cột đều lộ mặt trên (kể cả cột cao hơn mức một tầng). Không có trường hợp "khối này có thể là tầng 2 của ô phía trước".
- Khó, Siêu khó: mọi lựa chọn sai nếu đem dựng thành mô hình đều vẽ ra khác.

### Vì sao không lộ đáp án

- Từ Thường, bốn lựa chọn là hai cặp gương nối với nhau thành vòng: G ↔ gương G, G ↔ B (dời/xoay/đổi số), gương G ↔ gương B. Không nhìn mô hình thì vị trí nào trong vòng cũng như nhau. Ở Khó, chiều xoay ngẫu nhiên nên "bản xoay theo chiều nào" cũng không gợi ý.
- Vị trí đáp án đều (`rng.shuffle`); Mầm ba họ L, T, S làm đáp án đều nhau; Khó xoay theo/ngược chiều đều nhau. Mọi thẻ cùng cỡ, cùng màu.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Bệ 3×3 · 4 cột (họ L, T, S) · ≤ 2 tầng · 3 lựa chọn tô ô: đáp án + hai họ còn lại | Vài cột thấp xếp thành chữ; chỉ một thẻ cùng dạng |
| Thường | Bệ 3×3 · 5–6 cột · ≤ 3 tầng · 4 lựa chọn tô ô: đáp án, gương, dời 1 ô, gương của nó | Phải đặt đúng trái–phải theo mép cam và để ý từng ô |
| Khó | Bệ 4×4 · 8–10 cột · ≤ 3 tầng · 4 lựa chọn **ghi số tầng**: đáp án, gương, xoay 90°, gương của bản xoay | Bệ lớn hơn, hình chiếu bị xoay; phải giữ hướng mép trước |
| Siêu khó | Bệ 4×4 · 11–13 cột · ≤ 4 tầng · 4 lựa chọn ghi số tầng: đáp án, gương, đổi số tầng hai ô liền cạnh, gương của nó | Hai thẻ cùng dạng chỉ khác số tầng hai ô: phải đọc chiều cao từng cột |

Số liệu đo trên 10 000 câu mỗi mức (test kiểm):

| Mức | Cột trung bình | Khối trung bình | Cột bị che nửa mặt trên |
| --- | --- | --- | --- |
| Mầm | 4 | 6,4 | 15% |
| Thường | 5,5 | 12,4 | 21% |
| Khó | 9 | 20,5 | 21% |
| Siêu khó | 12 | 36,3 | 24% |

Cột phía sau thường cao hơn cột phía trước (do luật mặt trên phải lộ): mô hình trông như bậc thang lùi về sau, dễ đọc.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một thẻ trùng lưới đáp án (tô ô hoặc số tầng của mô hình), đó là `answerIndex` và có `kind = "answer"`; `check` chỉ đúng ở thẻ đó.
- Các thẻ đôi một khác nhau; số thẻ 3 / 4 / 4 / 4; lưới đúng cỡ; Mầm, Thường chỉ có 0/1.
- Mô hình: đúng cỡ bệ, số cột trong khoảng của mức, các ô có khối liền cạnh, có cột cao đúng tầng cao nhất, **mọi cột lộ ≥ 50% mặt trên**, hình vẽ chỉ hiểu được một cách.
- Quan hệ giữa các thẻ đúng như mô tả: Mầm đủ ba họ L, T, S; gương là lật trái–phải; dời 1 ô khác đúng hai ô và vẫn liền cạnh, không đối xứng; xoay là ±90°; đổi số là hai ô liền cạnh, đều có khối, đổi chỗ số tầng.
- Từ Thường: hình chiếu không đối xứng. Khó, Siêu khó: lựa chọn sai dựng thành mô hình thì vẽ ra khác.
- Không lộ đáp án: mỗi vị trí là đáp án 1/n ± 2%; Mầm mỗi họ 1/3 ± 2%; Khó xoay theo chiều kim đồng hồ 50% ± 2%.
- Tất định: cùng (seed, index, độ khó) cho cùng câu đố.

**Đã kiểm** bằng `top-view.test.ts` (15 test, khoảng 20 giây trên máy dev):

- Kho hình: số lượng như bảng ở trên; họ L/T/S đúng; mọi hình liền cạnh, không đối xứng (viết lại độc lập trong test).
- Hình học: so `iso.ts` với một **bộ vẽ độc lập** dùng toạ độ thật, đa giác và độ sâu điểm trúng trên tia nhìn, trên 1 500 bảng ngẫu nhiên: loại mặt từng tam giác, số nửa mặt trên lộ ra, công thức che khuất đều khớp. Vẽ chồng theo `topViewCubes` cũng ra đúng hình đó. Đếm cách hiểu khớp vét cạn toàn bộ 3⁹ bảng 3×3 cao ≤ 2.
- 10 000 seed × 4 mức (index = seed mod 37): 0 lỗi trên mọi điều trong mục này. Tỉ lệ đo được nằm trong ngưỡng.
- Mô hình dự phòng (ép bằng `attempts = 0`) cũng đạt mọi điều trên.
- Tất định: sinh lại theo thứ tự mức ngược, sau khi nạp lại module, vẫn ra cùng câu; sửa câu đã trả về không ảnh hưởng câu sau; mã băm đầu ra cố định của 200 câu mỗi mức.
- Đã thử làm hỏng bộ sinh (bỏ điều kiện "hiểu được một cách"; bỏ điều kiện "mặt trên lộ"): test đều bắt được.

## Cân bằng

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ sai ước | Số câu dự kiến mỗi vòng 60 s (đúng + sai) |
| --- | --- | --- | --- |
| Mầm | Người lớn 1,5–2,5 s · trẻ 7 tuổi 2–3,5 s | 3% · trẻ 10% | 25 · trẻ 18 |
| Thường | 2,5–4 s | 10% | 16 |
| Khó | 4–5,5 s | 13% | 11 |
| Siêu khó | 5,5–7 s | 17% | 8,4 |

Cách ước lượng: 0,8–1,5 s đọc mô hình (định hướng theo mép cam, nhận ra cột nào ở đâu) + thời gian so thẻ + 0,3 s chạm. Mầm: ba họ khác hẳn nhau, nhìn dạng là ra. Thường: loại cặp gương bằng hướng trái–phải rồi so một ô bị dời. Khó: bệ 4×4, phải xoay lưới trong đầu để loại bản xoay. Siêu khó: loại cặp gương bằng tập ô (≈ 2 s), tìm hai ô khác số giữa hai thẻ còn lại (≈ 1,5 s), đối chiếu hai cột đó trên mô hình (≈ 1,5 s). Các mức của người lớn không chồng nhau. Siêu khó còn khoảng 8,4 câu mỗi vòng (7 đúng + 1,4 sai), đạt mục tiêu ≥ 8 của CR-006; nếu chơi thử thấy chậm hơn 7 s thì giảm số cột Siêu khó xuống 10–12.

**Thưởng tốc độ chung: hợp, không khai báo `speedAllowanceMs`.** Không có pha trình chiếu, một chạm là xong. Tính cả 0,35 s hiệu ứng câu trước: Thường được khoảng 28–40 điểm thưởng mỗi câu, Khó 17–28, Siêu khó 5–17.

### Hệ số độ khó theo game (CR-006)

`difficultyMultiplier` = **Mầm 0,75 · Thường 1 · Khó 1,85 · Siêu khó 2,9** (hệ số chung cũ: 0,8 / 1 / 1,25 / 1,5).

**Cách tính** (cùng cách với Xoay hình): mô phỏng 200 000 vòng mỗi mức theo công thức điểm server: thời gian giải phân bố đều trong khoảng ở bảng trên, sai theo tỉ lệ ở bảng; câu đúng có 0,35 s hiệu ứng tính vào `answerMs` câu sau; câu sai khoá 1,5 s, đồng hồ câu sau tính từ lúc hết khoá; thưởng tốc độ kẹp 1,5–8 s; combo trần × 1,5; vòng 60 s. Điểm vòng S_d(m) = m × A_d + B_d; chọn m_d để S_d(m_d) = S_Thường(1), làm tròn tới 0,05. Mầm lấy mốc trẻ 7 tuổi, theo quy tắc chung **Mầm = min(mô phỏng, 1)**.

| Người chơi | Câu đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn |
| --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 16,5 · 1,8 | 2 086 | 793 | 0,77 | **0,75** |
| Người lớn · Thường | 14,2 · 1,6 | 1 782 | 610 | 1 (mốc, S = 2 392) | **1** |
| Người lớn · Khó | 9,6 · 1,4 | 1 146 | 261 | 1,86 | **1,85** |
| Người lớn · Siêu khó | 7,0 · 1,4 | 796 | 91 | 2,89 | **2,9** |

Điểm vòng ước tính so với người lớn ở Thường:

| Người chơi | Hệ số chung cũ | Hệ số game này |
| --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 103% | 99% |
| Người lớn · Mầm | 171% | 164% |
| Người lớn · Thường | 100% | 100% |
| Người lớn · Khó | 71% | 100% |
| Người lớn · Siêu khó | 54% | 100% |

- Người lớn chọn Mầm vẫn được khoảng 164% điểm Thường: chủ phòng giám sát (CR-006).
- **Độ nhạy:** Khó nhanh/chậm hơn dự kiến 0,75 s thì được khoảng 122% / 84% Thường; Siêu khó nhanh/chậm hơn 1 s thì khoảng 124% / 82%. Cần đo thời gian giải thật ở buổi chơi thử rồi tính lại.

## Ghi chú cho FE

Bám sát bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M8**, các artboard `TopViewMobile` (bố cục điện thoại, mức Thường), `TopViewLevels` (4 mức), `TopViewStates` (đúng, sai, nền tối), `TopViewHowTo` (hình hướng dẫn). Toạ độ dưới đây lấy từ bản mẫu.

### Dữ liệu câu đố

Scene tự sinh câu bằng `topView.generate(seed, index, difficulty)` từ `@brain-rizz/shared`, rồi gửi chỉ số thẻ được chạm. Kiểm cục bộ bằng `topView.check(puzzle, i)` để phản hồi ngay (server chấm lại bằng chính hàm này). Không lật, xoay hay đổi dữ liệu ở FE: lưới trong `choices` đã sẵn đúng hướng để vẽ (hàng 0 ở trên, hàng cuối sát vạch cam). `kind` **chỉ dùng sau khi chạm**.

### Bố cục (khung 720×1280)

| Thành phần | Vị trí (tâm hoặc x, y) | Cỡ | Ghi chú |
| --- | --- | --- | --- |
| Thẻ mô hình | tâm 360, 263 | 560 × 414 | Viền mực dày 7, huy hiệu con mắt (tròn r = 31) giữa cạnh trên + mũi tên chỉ xuống; không nhận chạm |
| Bệ + khối | đỉnh sau của bệ ở 360, 277 | xem mục Vẽ mô hình | 4×4 thu nhỏ × 0,74 (đỉnh sau ở 360, 282) |
| Nhãn "Trước" | tâm ≈ 148, 407 | 104 × 40, bo tròn | Nền cam `#f2a541`, chữ mực, đặt cạnh mép cam phía trước–trái của bệ; chữ đi qua `t()` |
| Dải nhắc | tâm 360, 522 | 240 × 56 | Icon: ô bệ nghiêng có mép cam → lưới có vạch cam (mép cam = vạch cam). Không chữ |
| Thẻ lựa chọn 0 · 1 | tâm 188, 734 · 532, 734 | 320 × 300 | Hàng trên |
| Thẻ lựa chọn 2 · 3 | tâm 188, 1058 · 532, 1058 | 320 × 300 | Hàng dưới. Mầm chỉ có thẻ 2, đặt giữa (tâm 360, 1058) |

- Cả thẻ là vùng chạm (320 × 300, khe 24 px giữa các thẻ). Ghi nhận ở `pointerdown`, một chạm là chốt.
- Lưới trong thẻ: 3×3 ô 64 px (192 × 192), 4×4 ô 50 px (200 × 200), lệch lên trên tâm thẻ (3×3: y từ −108 tới +84; 4×4: −112 tới +88). Dưới lưới là **vạch cam** cao 14, rộng bằng lưới, cách lưới 10 px, có các chấm mực nhỏ ở vạch chia cột (bắt buộc ở mọi thẻ, đó là chỗ người chơi định hướng).
- Ô có khối tô tím `#7768ae`, viền mực 4; ô trống để nền bệ `#f3eadf` với đường lưới mực 30%. Khó, Siêu khó ghi số tầng giữa ô: chữ Baloo 2, đậm 800, cỡ 32, màu trắng.
- Không đánh số hay chữ lên thẻ ngoài số tầng.

### Vẽ mô hình isometric

- Điểm (c, r, z) của mô hình (c, r là toạ độ góc ô, z là độ cao tính bằng khối) vẽ tại **x = x₀ + 48,5 · (c − r)**, **y = y₀ + 28 · (c + r) − 56 · z**, với (x₀, y₀) là đỉnh sau của bệ (góc ô (0, 0)). Mặt trên một khối là hình thoi 97 × 56, khối cao 56.
- Thứ tự vẽ: bệ trước, rồi từng khối theo `topViewCubes(puzzle.heights)` (đã sắp theo c + r + h tăng dần); khối vẽ sau đè khối vẽ trước. Mỗi khối vẽ ba mặt: trên `#b7adea`, trái (quay về mép trước) `#8f82cc`, phải `#7768ae`, viền mực `#1f1b3a` dày 4, nối góc tròn.
- Bệ: mặt trên `#f3eadf` với đường lưới mực 30% (để đếm ô), cạnh trước–trái (mép trước, từ góc (0, n) tới góc (n, n)) là dải cam `#f2a541` cao 14, cạnh trước–phải `#d9cfbd`. Mép cam phải luôn thấy được: không có khối nào che hết nó.
- Cỡ lớn nhất cần chứa (trước khi thu nhỏ): 3×3 cao 3 tầng: rộng 291, cao 350 (từ −168 tới +182 quanh đỉnh sau của bệ). 4×4 cao 4 tầng: rộng 388, cao 462, thu × 0,74 còn 287 × 342. Cả hai vừa thẻ mô hình 560 × 414. Mọi câu của một mức dùng cùng tỉ lệ, không co giãn theo câu.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Khối "rơi" nhẹ xuống bệ theo thứ tự vẽ hoặc chỉ mờ dần (FE chọn, ≤ 150 ms); thẻ hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120–150 ms |
| Chờ chọn | Máy tính: rê chuột thẻ nhấc 4 px, viền đậm hơn. Điện thoại: thẻ lún 0,97 lúc nhấn | — |
| Đúng | Thẻ được chọn: vòng vàng + ✓. Mặt trên mọi cột trong mô hình sáng vàng trong chốc lát, khớp các ô tô màu của thẻ | ≤ 350 ms rồi sang câu mới |
| Sai, khoá | Xem mục dưới | khoá `WRONG_ANSWER_LOCK_MS` |
| Hết giờ | Không nhận chạm nữa | — |

- Giữ hiệu ứng đúng ≤ 350 ms: server tính giờ câu sau từ lúc nhận đáp án trước.

### Hiện đáp án đúng khi sai

1. Chạm sai: `submit` rồi gọi `bridge.unlockDelay(index)`; hết khoá theo số ms nó trả về, không tự đếm. Vòng hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả.
2. Ngay khi chạm: thẻ bị chạm rung ngang ±8 px, viền gạch đứt đỏ + ✗. Thêm icon theo `kind`: `"mirror"` → icon gương; `"rotation"` → icon xoay; các loại khác chỉ ✗.
3. Thẻ `choices[answerIndex]`: vòng vàng + ✓.
4. **Mặt trên mọi cột trong mô hình sáng vàng** suốt lúc khoá, để người chơi đối chiếu với thẻ đúng.
5. Các thẻ còn lại mờ còn 35%.
6. Hết khoá: sang câu mới.

- Huy hiệu khoá che dải giữa trên cùng (tới y ≈ 80, máy thấp tới y ≈ 225), tức phần trên của thẻ mô hình. Thẻ đáp án luôn ở y ≥ 584 nên không bị che; ở máy thấp các cột cao phía sau có thể bị che một phần trong lúc khoá, chấp nhận được vì đáp án đã hiện ở thẻ.
- `prefers-reduced-motion`: không rung, không nhấp nháy, chỉ đổi viền, huy hiệu và tô vàng tĩnh.
- Không chỉ dùng màu: đúng là ✓ + viền liền, sai là ✗ + viền gạch đứt.

### Nền tối

Theo khung cuối của `TopViewStates`: thẻ tím đậm, khối tím nhạt viền mực đậm trên bệ tím, mép trước vẫn cam. Ô có khối trên thẻ `#a99ce0`, số tầng màu `#0e0c1e` (tương phản 7,8:1). ui-designer chốt các sắc còn lại.

### Âm thanh dự kiến (GĐ 2)

- Đúng: "ting" cao dần theo combo. Sai: "bụp" trầm + rung 40 ms. Hiện câu: không có âm.

### Ví dụ để kiểm bản vẽ

Sinh bằng `topView.generate(2026, 0, d)`. Lưới viết theo hàng từ sau ra trước (`/` là xuống hàng, `#` là ô tô, `.` là ô trống, số là số tầng).

| Mức | `heights` | Thẻ (theo thứ tự trên màn hình) | `answerIndex` |
| --- | --- | --- | --- |
| Mầm | `[[2,2,2],[0,0,2],[0,0,0]]` | đáp án `### / ..# / ...` · họ S `.#. / ##. / #..` · họ T `.#. / ##. / .#.` | 0 |
| Thường | `[[3,3,0],[3,3,3],[0,0,0]]` | đáp án `##. / ### / ...` · gương `.## / ### / ...` · gương của bản dời `..# / ### / .#.` · bản dời `#.. / ### / .#.` | 0 |
| Khó | `[[3,0,3,0],[2,3,3,0],[1,0,3,3],[0,0,0,0]]` | gương của bản xoay `.3.. / .333 / ..3. / .123` · gương `.3.3 / .332 / 33.1 / ....` · bản xoay `..3. / 333. / .3.. / 321.` · đáp án `3.3. / 233. / 1.33 / ....` | 3 |
| Siêu khó | `[[0,0,0,2],[4,4,2,3],[4,0,2,1],[2,4,0,2]]` | đáp án `...2 / 4423 / 4.21 / 24.2` · đổi số `...2 / 4423 / 4.12 / 24.2` · gương của bản đổi `2... / 3244 / 21.4 / 2.42` · gương `2... / 3244 / 12.4 / 2.42` | 0 |

## Ghi chú cho BE

Không có xử lý khác thường: không có pha trình chiếu, đáp án một bước, chấm bằng `generate()` + `check()`.

- `isAnswer` nhận số nguyên 0–3; ở Mầm (3 lựa chọn) gửi 3 thì `check` trả sai.
- Khai báo CR-006 trong `topView`: `durationMs: 60_000`; `difficultyMultiplier: { 0: 0.75, 1: 1, 2: 1.85, 3: 2.9 }`; **không** có `speedAllowanceMs`.
- Chi phí `generate`: khoảng 0,04 ms (Mầm), 0,05 ms (Thường), 0,25 ms (Khó), 0,35 ms (Siêu khó) mỗi câu trên máy dev, phần lớn là đếm cách hiểu hình vẽ. Lần gọi đầu mỗi mức dựng kho hình (4×4: vài chục ms). Muốn tránh trễ ở câu đầu thì gọi trước khi vòng bắt đầu.

## Đối chiếu quy tắc thiết kế

Theo checklist ở [Thiết kế game › Quy tắc thiết kế một minigame mới](../01-product/game-design.md#quy-tắc-thiết-kế-một-minigame-mới).

| Quy tắc | Đạt | Căn cứ |
| --- | --- | --- |
| Hiểu cách chơi trong ≤ 5 giây | Có | "Nhìn từ trên, mép cam ở dưới" + hình hướng dẫn chữ L / gương |
| Một câu ở mức Thường giải trong 1–8 giây | Có | Ước 2,5–4 s |
| Đúng một đáp án, kiểm được bằng máy | Có | Mục "Vì sao chắc chắn đúng một đáp án"; test 10 000 seed × 4 mức, 0 lỗi |
| Chỉ số nguyên + `createRng()` | Có | Bảng chiều cao, lưới, toạ độ tam giác đều là số nguyên |
| Bốn mức khác rõ rệt; Mầm chơi được với trẻ 7 tuổi | Có | Bệ 3→4, tầng 2→4, tô ô → ghi số; Mầm chỉ là nhận dạng chữ L/T/S |
| Một ngón tay, khung 720×1280, vùng chạm ≥ 48 px | Có | Thẻ 320 × 300 |
| Không phụ thuộc chữ | Có | Chỉ nhãn "Trước" (đã có mép cam + vạch cam làm dấu không chữ) |
| Không chỉ phân biệt bằng màu | Có | Hướng nhận qua vị trí mép/vạch cam; phản hồi có ✓/✗ và kiểu viền |

## Câu hỏi mở

- Thời gian giải và hệ số độ khó cần đo lại ở buổi chơi thử (độ nhạy ở mục Cân bằng khá lớn).
- Siêu khó 11–13 cột: nếu chơi thử vượt 7 s một câu thì giảm còn 10–12 cột (chỉ đổi `TOP_VIEW_LEVELS` và test).
- Đề xuất kỹ thuật: tách `iso.ts` (và phần vẽ isometric ở web) ra chỗ dùng chung khi `cube-count` cần cùng cách vẽ khối, ví dụ `packages/shared/src/games/_iso/`. Lúc đó cần sửa `docs/02-architecture/folder-structure.md`.
