# Đếm khối (`cube-count`)

- Nhóm: Phân tích (`analyze`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- Trạng thái đặc tả: bản đầu 2026-10-14, bám bản mẫu M12 đã duyệt. Các điểm còn mở ở [Câu hỏi mở](#câu-hỏi-mở).
- File:
  - `packages/shared/src/games/cube-count/`: `cube-count.ts` (bộ sinh, kiểu `CubeCountPuzzle`/`CubeCountAnswer`, export lại phần dùng chung của `model.ts`), `model.ts` (tham số mức, thống kê mô hình, bộ sinh mô hình), `cube-count.test.ts`.
  - `apps/web/src/games/cube-count/` (scene, màn hướng dẫn, `locales.ts`): đã làm theo bản mẫu (2026-10-14), chờ chơi thử.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M12** (CubeCountMobile, CubeCountLevels, CubeCountStates, CubeCountHowTo), đã duyệt.

## Cách chơi

Một mô hình khối lập phương xếp trên bệ, vẽ góc nhìn chéo. Đếm **tất cả** khối, kể cả khối bị che phía sau và bên dưới, rồi chạm vào thẻ ghi đúng số đó.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn mô hình khối trên bệ
  2. Đếm cả khối bị che khuất
  3. Chạm thẻ đúng tổng số khối
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ** (artboard CubeCountHowTo): bên trái là thẻ mô hình trên bệ 2×2: cột sau 3 tầng, cột phải 2 tầng, cột trái 1 tầng, ô trước trống. Mặt trên của ba cột sáng vàng, ghi số tầng 3, 2, 1. Khối dưới cùng của cột sau (bị che) vẽ nét đứt như nhìn xuyên qua. Một mũi tên phấn đi sang bốn thẻ 4, 5, 6, 7; thẻ 6 được khoanh phấn vàng, có bàn tay chỉ vào. Ba số thứ tự phấn 1, 2, 3 đánh dấu thứ tự các bước.
- **Câu nhắc lúc đếm ngược:** "Đừng quên khối bị che!"
- **Câu nhắc theo mức:** không có (mọi mức cùng luật).

## Câu đố & đáp án

- `Puzzle` (`CubeCountPuzzle`): `{ depth, width, heights, options, kinds, answerIndex }`, xem bảng ở [Ghi chú cho FE](#dữ-liệu-câu-đố).
- `Answer` (`CubeCountAnswer`): chỉ số thẻ người chơi chạm, số nguyên 0–3. Một chạm là chốt.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. **Mô hình** (`sampleCubeCountHeights` trong `model.ts`): đi từng ô theo hàng (r rồi c), số tầng chọn đều trong `0…min(ô ngay sau theo r, ô ngay sau theo c, tầng tối đa)`. Cách đi này luôn cho mô hình **bậc thang**: không khối lơ lửng, cột trước không cao hơn cột sau. Thử lại tới khi mô hình thoả ràng buộc của mức (khoảng tổng khối, khoảng số khối bị che, khoảng số cột có khối). Trung bình cần 12 / 14 / 77 / 151 lượt (Mầm → Siêu khó), lượt nhiều nhất trong 10 000 seed là 1 988; quá 5 000 lượt thì dùng mô hình dự phòng (chính câu ví dụ trong bản mẫu). Xác suất cần tới dự phòng dưới 1e-14 mỗi câu, và test kiểm 40 000 câu chưa câu nào cần.
3. **Số khối bị che** của cột (r, c) cao h = `max(0, min(h − 1, cao(r + 1, c), cao(r, c + 1)))`. Một khối bị che hoàn toàn khi có khối nằm trên nó, có khối ở ô trước-trái và có khối ở ô trước-phải cùng tầng. Với mô hình bậc thang, mặt nào không có khối liền kề áp vào thì cũng không bị khối nào xa hơn che. Test vẽ thật mô hình trên lưới tam giác isometric để kiểm công thức này.
4. **Bốn thẻ số** (`buildOptions`): đặt t = tổng khối, v = số khối thấy = t − số khối che. Vị trí của đáp án sau khi xếp tăng dần (rank) chọn đều trong 0–3.
   - Các số nhỏ hơn t (rank số): nếu rank ≥ 1 thì luôn có **v** (bẫy "chỉ đếm khối thấy"), rồi lấy t − 1, t − 2 (xáo thứ tự, bỏ số trùng v), thiếu thì lấy t − 3.
   - Các số lớn hơn t (3 − rank số): lấy từ t + 1, t + 2, và t + số khối che (bẫy "đếm trùng", chỉ có khi số khối che ≥ 3 để không trùng lệch 1–2), xáo thứ tự; thiếu thì lấy t + 3.
   - Xếp tăng dần. Thẻ đúng là thẻ duy nhất bằng t.

**Vì sao đúng một đáp án:** bốn số đôi một khác nhau và chỉ một số bằng t. Còn t là duy nhất theo hình vì: (a) mặt trên mọi cột luôn thấy trọn, nên đọc được số tầng từng cột; (b) mô hình bậc thang có cùng một tập ô trên bệ thì hình vẽ isometric khác nhau. Test kiểm (b) bằng cách vẽ **mọi** mô hình bậc thang trên bệ của Mầm (50 mô hình), Thường (980) và Khó (24 696): không có hai mô hình nào cho cùng một hình. Bệ Siêu khó có 1,6 triệu mô hình nên test không vẽ hết, nhưng đây là cùng một tính chất (song ánh giữa mô hình bậc thang và cách lát hình thoi).

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Bệ 2×3 (depth 2, width 3), cột ≤ 2 tầng, 4–6 khối, **đúng 1** khối bị che, 3–5 cột | Vài khối, một khối đỡ bị che. Có 11 mô hình khác nhau |
| Thường | Bệ 3×3, cột ≤ 3 tầng, 8–12 khối, 2–4 khối bị che, 5–8 cột | Bậc thang nhỏ, vài khối che ở góc sau. 218 mô hình |
| Khó | Bệ 3×4 (depth 3, width 4), cột ≤ 4 tầng, 13–18 khối, 5–7 khối bị che, 7–10 cột | Bậc thang cao, nhiều khối che. Khoảng 1 600 mô hình |
| Siêu khó | Bệ 4×4, cột ≤ 5 tầng, 20–26 khối, 8–12 khối bị che, 9–13 cột (nên luôn có 3–7 ô trống) | Khối dày, ô trống dọc mép trước. Hơn 8 500 mô hình |

Đo trên 10 000 seed mỗi mức (test kiểm các trung bình tăng dần, và khoảng tổng khối, khoảng khối che của hai mức liền nhau không chồng nhau):

| Mức | Tổng khối (TB) | Khối bị che (TB) | Số cột (TB) | Cột cao nhất (TB) | Thẻ "đếm trùng" xuất hiện |
| --- | --- | --- | --- | --- | --- |
| Mầm | 4–6 (5,4) | 1 (1,0) | 3–5 (3,7) | 2 (2,0) | 0% |
| Thường | 8–12 (10,2) | 2–4 (2,4) | 5–8 (5,9) | 2–3 (2,6) | 15% |
| Khó | 13–18 (16,7) | 5–7 (5,3) | 7–10 (8,0) | 2–4 (3,5) | 50% |
| Siêu khó | 20–26 (24,0) | 8–12 (8,6) | 9–13 (10,2) | 2–5 (4,3) | 50% |

Ở mọi mức, đáp án nằm ở mỗi vị trí 0–3 khoảng 25% (test: lệch dưới 10%), và thẻ "chỉ đếm khối thấy" xuất hiện trong 75% số câu (mọi câu mà đáp án không phải số nhỏ nhất).

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng, và đáp án bằng tổng số khối.
- Bốn thẻ đôi một khác nhau, nguyên, ≥ 1, xếp tăng dần.
- Mô hình bậc thang, thoả mọi ràng buộc của mức (`isValidCubeCountModel`); số khối bị che ≥ 1 ở mọi mức.
- Số khối bị che theo công thức khớp với hình vẽ thật; mặt trên mọi cột luôn thấy trọn.
- Thẻ có `kind = "visible"` có mặt khi và chỉ khi đáp án không phải số nhỏ nhất.
- Tất định: cùng (seed, index, mức) thì ra cùng câu, không phụ thuộc thứ tự gọi; có test đầu ra cố định.

Các điều trên được kiểm bằng test 10 000 seed × 4 mức (`cube-count.test.ts`).

## Cân bằng

Thời gian giải ước lượng bằng mô hình đếm theo cột: **t ≈ 0,8 s + 0,4 s × số cột + 0,06 s × tổng khối** (nhìn tổng thể, đọc số tầng từng cột, cộng nhẩm, tìm thẻ và chạm), nhân thêm nhiễu đều ±15%. Trẻ 7 tuổi chậm hơn 1,6 lần. Số liệu dưới đây lấy từ mô phỏng bằng chính `generate()` (3 000 vòng mỗi dòng).

| Mức | Thời gian giải mỗi câu: trung vị (P20–P80) | Tỉ lệ sai ước | Số câu mỗi vòng 60 s (đúng + sai) |
| --- | --- | --- | --- |
| Mầm | Người lớn 2,6 s (2,3–2,9) · trẻ 7 tuổi 4,1 s (3,7–4,7) | 3% · trẻ 12% | 19,7 · trẻ 12,5 |
| Thường | 3,7 s (3,3–4,2) | 8% | 13,8 |
| Khó | 5,0 s (4,5–5,5) | 12% | 10,5 |
| Siêu khó | 6,3 s (5,7–6,9) | 15% | 8,4 |

Các khoảng P20–P80 của người lớn không chồng nhau. Phần đuôi (P10–P90) chạm nhau khoảng 0,2–0,4 s giữa Thường/Khó và Khó/Siêu khó: một mô hình nhiều cột ở mức dưới có thể lâu ngang một mô hình ít cột ở mức trên. Siêu khó vẫn còn 8,4 câu mỗi vòng (≥ 8). Cần đo lại khi chơi thử.

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong `cube-count.ts`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | 1 | không khai báo | Mô phỏng trẻ 7 tuổi ra 1,28 → min(1,28; 1) = 1 |
| Thường | 1 | không khai báo | Mốc |
| Khó | 1,7 | không khai báo | Mô phỏng 1,68 → 1,7 |
| Siêu khó | 2,45 | không khai báo | Mô phỏng 2,45 |

- **Cách mô phỏng** (giống Xoay hình): câu đúng tính thêm 0,35 s hiệu ứng vào `answerMs` câu sau; câu sai khoá 1,5 s, chuỗi combo về 0; thưởng tốc độ trọn 50 điểm khi ≤ 1,5 s, hết từ 8 s; combo trần × 1,5. Điểm vòng S_d(m) = m × A_d + B_d; chọn m_d = (S_Thường − B_d) ÷ A_d rồi làm tròn tới 0,05.
- `speedAllowanceMs`: **không khai báo.** Không có pha trình chiếu, một chạm là chốt. Thời gian giải dài hơn ở Khó và Siêu khó đã được hệ số bù.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | Hệ số chung cũ 0,8 / 1 / 1,25 / 1,5 | Hệ số game này 1 / 1 / 1,7 / 2,45 |
| --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 11,0 · 1,5 | 1 344 | 366 | ≈ 1 440 (69%) | ≈ 1 710 (82%) |
| Người lớn · Mầm | 19,1 · 0,6 | 2 596 | 1 012 | ≈ 3 090 (148%) | ≈ 3 610 (173%) |
| Người lớn · Thường | 12,7 · 1,1 | 1 604 | 484 | 2 088 (100%) | 2 088 (100%) |
| Người lớn · Khó | 9,2 · 1,3 | 1 107 | 231 | ≈ 1 615 (77%) | ≈ 2 110 (101%) |
| Người lớn · Siêu khó | 7,1 · 1,3 | 817 | 90 | ≈ 1 320 (63%) | ≈ 2 090 (100%) |

- Trẻ 7 tuổi ở Mầm chỉ đạt 82% vì hệ số Mầm bị chặn ở 1 theo quy tắc chung (không cao hơn Thường). Người lớn chọn Mầm được khoảng 173% điểm Thường. Không công thức nào chặn được hoàn toàn chuyện này, phần còn lại do chủ phòng giám sát (CR-006).
- **Độ nhạy:** người lớn giải Khó, Siêu khó nhanh hơn 15% thì được khoảng 123% / 124% điểm Thường; chậm hơn 15% thì còn khoảng 85% / 84%.

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `cubeCount.generate(seed, index, difficulty)` từ `@brain-rizz/shared`, rồi gửi chỉ số thẻ được chạm. Kiểm cục bộ bằng `cubeCount.check(puzzle, i)` để phản hồi ngay; server chấm lại bằng chính hàm này.

```ts
type CubeCountOptionKind = "answer" | "visible" | "double" | "near";
interface CubeCountPuzzle {
  depth: number; width: number;
  heights: number[][];       // heights[r][c], r < depth, c < width
  options: number[];         // 4 số, tăng dần
  kinds: CubeCountOptionKind[];
  answerIndex: number;
}
type CubeCountAnswer = number; // 0–3
```

| Trường | Ý nghĩa |
| --- | --- |
| `depth`, `width` | Cỡ bệ. `width` = số ô dọc cạnh bệ đi xuống bên **phải**, `depth` = số ô dọc cạnh đi xuống bên **trái**. Mầm 2 × 3, Thường 3 × 3, Khó 3 × 4, Siêu khó 4 × 4 (depth × width). |
| `heights[r][c]` | Số tầng cột ở ô (r, c), 0 = ô trống. Ô (0, 0) là góc sau cùng (đỉnh trên của bệ). |
| `options` | 4 thẻ số, **đã xếp tăng dần**, theo thứ tự trái → phải, trên → dưới (2 × 2). |
| `kinds[i]` | `"visible"`: chỉ đếm khối thấy (thêm icon con mắt khi chạm sai). `"double"`: đếm trùng khối che. `"near"`: lệch 1–3. `"answer"`: đáp án. **Chỉ dùng sau khi chạm**, không được để lộ trước. |
| `answerIndex` | Vị trí thẻ đúng; `options[answerIndex]` là tổng số khối, dùng để ghi vào ô "=" khi đúng hoặc khi khoá. |

Export kèm theo: `cubeCountStats(heights)` → `{ total, hidden, visible, columns, empty, tallest }`, `CUBE_COUNT_LEVELS[d]` (cỡ bệ, tầng tối đa của mức), `CUBE_COUNT_OPTIONS` (= 4).

### Vẽ mô hình (bám artboard CubeCountMobile / CubeCountLevels)

- Khung 720 × 1280. Thẻ mô hình: (32, 32), 656 × 688, bo 32, viền mực 7 px, bóng đặc lệch 10 px.
- Một khối ở tỉ lệ 1: mặt trên là hình thoi rộng 97 px, cao 56 px; cạnh đứng 56 px (cùng góc chiếu và cỡ khối với Nhìn từ trên). Gốc của một khối là **đỉnh trên của mặt trên**.
- Gốc mô hình là đỉnh trên của bệ, đặt tại **x = 360 + 48,5 × (depth − width) ÷ 2, y = 285 + 14 × (depth + width)**: Mầm (335,75; 355), Thường (360; 369), Khó (335,75; 383), Siêu khó (360; 397).
- Khối ở ô (r, c), tầng k (k = 0 sát bệ) đặt gốc tại **(48,5 × (c − r); 28 × (c + r) − 56 × (k + 1))** so với gốc mô hình.
- **Thứ tự vẽ:** bệ trước, rồi các khối theo **r + c + k tăng dần** (cùng tổng thì thứ tự nào cũng được). Khối gần mắt vẽ sau, đè lên khối xa.
- Bệ: mặt trên `#f3eadf` có đường chia ô mảnh (mực 30%, 2,5 px); hai mặt bên dày 14 px: trái `#e2d5bf`, phải `#cdbfa6`; viền mực 4 px.
- Khối, nền sáng: mặt trên `#aed3f4`, mặt trái `#78b5ea`, mặt phải `#4d9de0`, viền `#1f1b3a` 4 px, nối góc tròn. Nền tối: `#c9e3f9` / `#98c8f0` / `#74b3ea`, viền `#0e0c1e`, thẻ mô hình `#2f2a52` (ui-designer chốt bệ tối theo artboard CubeCountStates).
- Mọi câu trong một mức dùng cùng cỡ khối và cùng màu, không đổi theo câu.

### Bố cục

| Thành phần | x, y | Rộng × cao | Ghi chú |
| --- | --- | --- | --- |
| Thẻ mô hình | 32, 32 | 656 × 688 | Không nhận chạm |
| Hàng phép tính | 219–525, 748–832 | — | Icon một khối (tỉ lệ 0,5) tại (219, 762), dấu "=" ở x 255–285, ô kết quả (309, 748) 216 × 84 bo 20, nét đứt, chữ "?" 60 px. Khi đúng hoặc khi khoá, ô ghi tổng số khối |
| Thẻ số 0 · 1 | 32, 864 · 376, 864 | 312 × 160 | Bo 28, viền mực 4 px, bóng đặc 6 px; số Baloo 2 đậm 88 px, chữ số đều |
| Thẻ số 2 · 3 | 32, 1048 · 376, 1048 | 312 × 160 | Hàng dưới |

- Cả thẻ số là vùng chạm (312 × 160, rất xa mức tối thiểu 48 px), khe 32 px theo chiều ngang, 24 px theo chiều dọc. Không đánh chữ cái lên thẻ.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Mô hình và thẻ hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120 ms |
| Chờ chọn | Máy tính: rê chuột thì thẻ nhấc 4 px. Nhấn: thẻ thu còn 0,96. Ghi nhận ở `pointerdown` | — |
| Đúng | Thẻ đúng phóng 1,05 rồi về, vòng vàng `#ffd166` + dấu ✓; ô "=" ghi tổng số khối; mô hình giữ nguyên | ≤ 350 ms rồi sang câu mới |
| Sai, khoá | Xem mục dưới | Theo `bridge.unlockDelay` |
| Hết giờ | Không nhận chạm nữa (PlayScreen xử lý kết thúc vòng) | — |

- Giữ hiệu ứng đúng ≤ 350 ms: server tính giờ câu sau từ lúc nhận đáp án trước.
- Âm thanh (nếu có): tiếng "tách" khi chạm, chuông ngắn khi đúng, tiếng trầm khi sai.

### Hiện đáp án đúng khi sai

1. Lúc chạm: `cubeCount.check(puzzle, i)` sai thì `submit`, rồi gọi `bridge.unlockDelay(index)` và hết khoá theo số ms nó trả về. Không tự đếm 1,5 s.
2. Ngay khi chạm: thẻ bị chạm rung ±8 px, viền gạch đứt đỏ (nền tối: hồng) + ✗. Nếu `kinds[i] === "visible"` thì thêm icon con mắt nhỏ (người chơi quên khối bị che).
3. Thẻ `options[answerIndex]`: vòng vàng + ✓. Hai thẻ còn lại mờ còn 35%.
4. Trên mô hình: **mặt trên của khối cao nhất mỗi cột đổi sang vàng `#ffd166`** (mặt bên giữ màu) và ghi số tầng của cột đó ở giữa mặt trên (Baloo 2 đậm 40 px, màu mực, cả ở nền tối). Ô trống không ghi. Ô "=" ghi tổng (màu kem ở nền tối). Người chơi cộng các số tầng sẽ ra đáp án.
5. Hết khoá: sang câu mới. Vòng hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả `unlockDelay`.

- Thẻ số và ô "=" nằm ở y ≥ 748, không bị huy hiệu khoá che. Cột sau cùng của Siêu khó (5 tầng) có mặt trên ở y ≈ 117–173, nên ở máy thấp (huy hiệu che tới y ≈ 225) số tầng của cột này có thể bị che trong lúc khoá. Ô "=" vẫn cho thấy tổng, nên không cần dời bố cục.
- `prefers-reduced-motion`: không rung, không phóng; chỉ đổi viền, huy hiệu, mặt trên vàng và số.
- Không chỉ dùng màu: đúng là ✓ + vòng liền, sai là ✗ + viền gạch đứt.

## Ghi chú cho BE

Không. Một câu một chạm, chấm bằng `check()` như các game chọn thẻ khác; không có pha trình chiếu.

## Câu hỏi mở

- **Mầm chỉ có 11 mô hình** (bệ 2×3, ≤ 2 tầng, 4–6 khối, đúng 1 khối che). Một vòng khoảng 12–20 câu nên mô hình sẽ lặp lại, dù bộ thẻ số đổi theo câu. Nếu chơi thử thấy nhàm, có hai hướng: cho thêm bệ xoay 3×2 (FE vẽ thêm một bệ), hoặc cho phép câu không có khối che ở Mầm (khi đó bỏ thẻ "khối thấy").
- **Hệ số Mầm = 1** theo quy tắc min(mô phỏng, 1). Mô phỏng trẻ 7 tuổi ra 1,28 vì đếm khối chậm hơn hẳn với trẻ, nên trẻ chỉ đạt 82% điểm Thường. Cần PM xác nhận có giữ trần 1 cho game này không.
- **Cột cao nhất không luôn chạm trần tầng của mức** (vd. Siêu khó trung bình 4,3 tầng, có câu chỉ 2 tầng). Muốn mỗi mức luôn có một cột cao đúng trần thì thêm ràng buộc `tallest = maxHeight` (số lượt thử khi sinh sẽ tăng, cần đo lại).
