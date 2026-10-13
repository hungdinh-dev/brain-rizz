# Xoay hình (`rotate-match`)

- Nhóm: Hình dung (`visualize`)
- Thời lượng vòng: 60 000 ms ([CR-006](../00-tracking/change-requests.md#cr-006); bản đầu đề xuất 45 000 ms)
- Trạng thái đặc tả: **mọi đề xuất trong đặc tả đã duyệt 2026-10-12** (chủ dự án), cùng CR-006. Xem [Quyết định](#quyết-định-đã-duyệt-2026-10-12).
- File:
  - `packages/shared/src/games/rotate-match/`: `rotate-match.ts` (bộ sinh, kiểu `RotateMatchPuzzle`/`RotateMatchAnswer`), `shapes.ts` (kho hình, nội bộ, không export ra ngoài package), `rotate-match.test.ts`.
  - `apps/web/src/games/rotate-match/` (scene + `locales.ts`): frontend-dev làm.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, khu M5 (RotateMobile, RotateLevels, RotateStates, RotateHowTo) — đã duyệt 2026-10-12

## Cách chơi

Trên cùng là một hình ghép từ các ô vuông (hình mẫu). Chạm vào lựa chọn duy nhất là hình mẫu đã được **xoay** đi; hình bị **lật gương** hoặc lệch một ô đều sai.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn hình mẫu ở trên cùng
  2. Chạm hình là mẫu đã xoay đi
  3. Hình bị lật hoặc lệch ô là sai
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ:** thẻ mẫu chữ L 4 ô (`#.` / `#.` / `##`) ở trên. Dưới là hai thẻ: trái là chữ L xoay 90° (`###` / `#..`), khoanh phấn tròn + dấu ✓; phải là bản lật gương (chữ J) xoay 90° (`#..` / `###`), gạch chéo phấn ✗ kèm icon gương nhỏ (đường gạch đứt, hai mũi tên ngược chiều). Một mũi tên phấn cong ↻ đi từ thẻ mẫu sang thẻ trái.
- **Câu nhắc lúc đếm ngược:** "Xoay thì đúng, lật thì sai!"

## Câu đố & đáp án

- `Puzzle` (`RotateMatchPuzzle`): `{ model: Figure; choices: Choice[]; answerIndex: number }`
  - `Figure` (`RotateMatchFigure`) = `{ cells: [x, y][]; angle: number }`. `cells` là toạ độ nguyên của các ô: x sang phải, y xuống dưới, đã chuẩn hoá để x, y nhỏ nhất bằng 0, sắp theo (y, x). `angle` là góc vẽ, số nguyên độ, chiều kim đồng hồ, xoay quanh trọng tâm các ô. Hình mẫu luôn có `angle = 0`.
  - `Choice` (`RotateMatchChoice`) = `Figure & { kind: "rotation" | "mirror" | "other" }`: đáp án / bản gương của mẫu / hình khác loại (kể cả bản gương của nó). FE dùng `kind` để chọn phản hồi khi sai.
  - `choices` có 3 phần tử (Mầm) hoặc 4, theo đúng thứ tự ô trên màn hình (trái → phải, trên → dưới).
- `Answer` (`RotateMatchAnswer`): số nguyên, là chỉ số lựa chọn được chạm. `check` đúng khi `answer === answerIndex`; `isAnswer` chỉ nhận `typeof number`, số nguyên, `0 ≤ n < 4` (chuỗi `"1"`, `1.5`, `NaN`, `null`, mảng, object… đều bị từ chối).
- Module export thêm (tên có tiền tố vì `games/index.ts` gom mọi game bằng `export *`, tên chung như `MAX_RADIUS` dễ trùng game khác):
  - `ROTATE_MATCH_MAX_RADIUS: Record<Difficulty, number>` (đơn vị ô, xem [Kho hình](#kho-hình-tính-một-lần-không-ngẫu-nhiên)) để FE chọn cỡ ô. Đặc tả bản đầu gọi là `MAX_RADIUS`.
  - `ROTATE_MATCH_ANGLES: Record<Difficulty, number[]>`: tập góc của mỗi mức.
  - `ROTATE_MATCH_MAX_CHOICES = 4`.

Chi tiết từng trường cho FE: [Ghi chú cho FE › Dữ liệu câu đố](#dữ-liệu-câu-đố).

## Cách sinh câu đố

### Kho hình (tính một lần, không ngẫu nhiên)

Với số ô k của mỗi mức:

1. Liệt kê mọi hình k ô liền cạnh (polyomino): bắt đầu từ 1 ô, mỗi bước thêm 1 ô kề cạnh; chuẩn hoá (dịch cho x, y nhỏ nhất bằng 0, sắp ô theo (y, x)); bỏ trùng theo khoá chuỗi `"x,y;x,y;…"`.
2. Gộp thành **loại hình**: khoá loại là khoá nhỏ nhất trong 8 biến đổi (4 phép xoay 90° × có/không lật). Sắp kho theo khoá loại bằng so sánh chuỗi thường (không dùng `localeCompare`) để mọi máy có cùng thứ tự.
3. Lọc: cạnh khung bao ≤ 4 ô, không có lỗ. Kho mẫu từ mức Thường còn phải:
   - **có tay thuận**: bản lật gương không trùng phép xoay 90° nào của hình;
   - **không đối xứng xoay**: xoay 90°, 180°, 270° đều ra hình khác, để mỗi góc trông khác nhau;
   - (Khó, Siêu khó) có ít nhất một hình gần giống trong kho.

   Kho mẫu của Mầm là các loại 4 ô có khung bao 3×2: họ L, T, S.
4. **Hình gần giống** của một loại: mọi loại trong cùng kho mẫu thu được khi dời đúng một ô (bỏ một ô mà phần còn lại vẫn liền, đặt nó vào một ô trống kề cạnh khác chỗ cũ), khác loại gốc. Danh sách sắp theo khoá.

Kết quả đã đếm:

| Mức | Số ô | Kho mẫu | Hình gần giống mỗi loại | `MAX_RADIUS` (ô) |
| --- | --- | --- | --- | --- |
| Mầm | 4 | 3 (L, T, S) | không dùng | 1,91 |
| Thường | 5 | 5 (F, L, N, P, Y) | 4 (mọi loại còn lại) | 2,41 |
| Khó | 6 | 17 | 7–13 | 2,70 |
| Siêu khó | 7 | 54 | 9–31 | 2,88 |

`MAX_RADIUS` (trong code: `ROTATE_MATCH_MAX_RADIUS`) là khoảng cách lớn nhất từ trọng tâm tới góc ô xa nhất, trên mọi hình có thể xuất hiện ở mức đó, làm tròn lên 0,01. Kho tính lười ở lần gọi `generate` đầu tiên của mỗi mức rồi ghi nhớ (`shapes.ts › getPool`). Đo trên máy dev, lần đầu (chưa JIT): Mầm 3 ms, Thường 3 ms, Khó 8 ms, Siêu khó 24 ms, tổng ≈ 40 ms. Sau đó mỗi câu `generate` mất khoảng 6–14 µs.

Cài đặt: 8 biến đổi tính thẳng bằng công thức toạ độ, và gán khoá loại cho mọi polyomino cố định ngay lúc liệt kê, nên bước tìm hình gần giống chỉ cần tra bảng. Thứ tự kho vẫn đúng như mô tả ở trên (khoá chuỗi `"x,y;…"`, so sánh chuỗi thường). Test có mã băm đầu ra cố định để bắt mọi thay đổi vô tình của kho hay thứ tự gọi `rng`.

### Một câu đố

`rng = createRng(deriveSeed(roundSeed, index))`, lấy số theo đúng thứ tự dưới. Số lần gọi `rng` cố định theo mức, không có vòng lặp thử lại.

**Mầm**

1. Họ mẫu = `rng.pick(kho mẫu)`; lật = `rng.int(0, 1)`; hướng = `rng.int(0, 3)` × 90° (xoay dữ liệu ô, không phải góc vẽ). Được ô của hình mẫu, `angle = 0`.
2. Đáp án: ô như mẫu, góc = `rng.pick` trong {90, 180, 270}, bỏ góc làm hình trông y hệt mẫu (chỉ xảy ra với họ S: bỏ 180°).
3. Hai họ còn lại, theo thứ tự trong kho: mỗi họ lật = `rng.int(0, 1)`, góc = `rng.pick({90, 180, 270})`, `kind = "other"`.
4. Thứ tự = `rng.shuffle([0, 1, 2])` (0 là đáp án), ra `choices`; `answerIndex` là vị trí mới của 0.

**Thường, Khó, Siêu khó** (G là tập góc của mức, xem [Độ khó](#độ-khó))

1. Loại mẫu P = `rng.pick(kho mẫu)`; lật, hướng như Mầm. Được ô của hình mẫu.
2. Đáp án: ô như mẫu, góc = `rng.pick(G)`. Bản gương: ô là gương của mẫu ((x, y) → (−x, y) rồi chuẩn hoá), góc = `rng.pick(G)`.
3. Hình gần giống Q = `rng.pick(danh sách gần giống của P)`; lật = `rng.int(0, 1)`; hướng = `rng.int(0, 3)`; góc = `rng.pick(G)`. Bản gương của Q: góc = `rng.pick(G)`. Cả hai có `kind = "other"`.
4. Thứ tự = `rng.shuffle([0, 1, 2, 3])` (đáp án, gương, Q, gương Q), ra `choices`; `answerIndex` là vị trí mới của đáp án.

Các góc chọn độc lập và có thể trùng nhau: bốn hình thuộc bốn loại khác nhau nên không bao giờ trông giống nhau.

### Vì sao chắc chắn đúng một đáp án

- Đáp án có cùng các ô với hình mẫu, chỉ khác góc vẽ, nên là bản xoay.
- Bản gương: hình mẫu có tay thuận nên gương của nó không trùng phép xoay 90° nào của mẫu. Góc lẻ cũng không làm trùng: hình ghép ô vuông có mọi cạnh nằm ngang hoặc dọc; xoay một góc không chia hết cho 90° thì cạnh bị nghiêng, không thể khớp một hình ghép ô vuông khác. Vì vậy chỉ cần kiểm 4 phép xoay 90°.
- Hình khác (Mầm) và hình gần giống cùng gương của nó (từ Thường): khác loại với mẫu, mà loại đã gồm mọi phép xoay lẫn lật, nên không phải bản xoay.

### Vì sao không lộ đáp án

- Đáp án không bao giờ trông y hệt hình mẫu: không có góc 0°, và mẫu không đối xứng xoay (Mầm: bỏ 180° cho họ S).
- Từ Thường, bốn lựa chọn là **hai cặp gương** (đáp án với gương của nó, Q với gương của Q), không cặp nào là bản xoay của nhau, mọi góc chọn độc lập theo cùng một cách. Không nhìn hình mẫu thì không có dấu hiệu nào cho biết cặp nào chứa đáp án, hay hình nào trong cặp là đáp án.
- Vì sao không dùng "toàn bộ mồi là bản gương": khi đó ba mồi là bản xoay của nhau, đáp án thành hình lạc loài duy nhất, và mọi cặp hình soi gương trái–phải hay trên–dưới thấy được trên màn hình đều chứa đáp án. Ước tính ở Siêu khó khoảng 80% câu có cặp như vậy (thu về còn 2 lựa chọn) và 20% câu lộ hẳn đáp án mà không cần nhìn mẫu.
- Vị trí đáp án đều (`rng.shuffle`); mọi hình cùng màu, cùng cỡ ô, cùng số ô.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 4 ô, họ L/T/S · 3 lựa chọn: đáp án + 2 họ còn lại · góc {90°, 180°, 270°} · không có bản gương | Ba hình 4 ô khác họ, chỉ một hình cùng họ với mẫu; mọi hình nằm thẳng |
| Thường | 5 ô (F, L, N, P, Y) · 4 lựa chọn: đáp án, bản gương, hình gần giống, gương của hình gần giống · góc {90°, 180°, 270°} | Hình 5 ô nằm thẳng, xoay vuông góc; phải phân biệt xoay với lật và một ô bị lệch |
| Khó | 6 ô (17 loại) · 4 lựa chọn như Thường · góc bội 45°, trừ 0° và 180°: {45, 90, 135, 225, 270, 315} | Khoảng 2/3 số hình nằm chéo 45° |
| Siêu khó | 7 ô (54 loại) · 4 lựa chọn như Thường · góc bội 30° không thẳng trục, bỏ ±30°: {60, 120, 150, 210, 240, 300} | Mọi hình nghiêng lẻ, không hình nào nằm thẳng |

Lý do bỏ góc: 180° ở Khó vì bản gương ở 180° chỉ là mẫu lộn ngược, loại ra quá dễ; ±30° ở Siêu khó vì hình gần như chưa xoay.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một lựa chọn là bản xoay của hình mẫu (kiểm độc lập bằng so 4 phép xoay), đó là `answerIndex` và có `kind = "rotation"`.
- `"mirror"` là gương của mẫu; `"other"` khác loại với mẫu. Từ Thường: Q là hình gần giống (dời đúng 1 ô), có đúng 2 cặp gương và không cặp nào là bản xoay của nhau.
- Không hai lựa chọn trông giống nhau; đáp án không trông y hệt mẫu; không có góc 0°; mọi góc thuộc tập góc của mức.
- Ô là số nguyên ≥ 0, đã chuẩn hoá; đúng số ô của mức; cạnh khung bao ≤ 4; không có lỗ; bán kính ≤ `MAX_RADIUS[d]`.
- Từ Thường: hình mẫu có tay thuận và không đối xứng xoay.
- Không lộ đáp án: mỗi vị trí là đáp án với tỉ lệ 1/n ± 2%; từ Thường, ở mỗi góc, tỉ lệ lựa chọn ở góc đó là đáp án 25% ± 2%.
- Độ khó tăng, đo được: số ô 4/5/6/7; số lựa chọn 3/4/4/4; bước góc nhỏ nhất 90°/90°/45°/30°; tỉ lệ lựa chọn nghiêng (góc không chia hết cho 90°) 0/0/≈ 67%/100%; mồi Mầm khác họ, từ Thường gồm bản gương và hình gần giống.
- Kích thước kho đúng 3/5/17/54. Đổi kho là đổi câu đố của mọi seed nên test phải bắt được.
- Tất định: cùng (seed, index, độ khó) cho cùng câu đố.

Các điều trên phải được kiểm bằng test ≥ 10.000 seed × 4 độ khó.

**Đã kiểm** bằng `rotate-match.test.ts` (20 test, chạy khoảng 5 giây):

- Kho hình: kích thước 3/5/17/54; Mầm đúng ba họ L, T, S; mọi loại liền, không lỗ, khung ≤ 4, không trùng nhau; từ Thường có tay thuận, không đối xứng xoay; danh sách gần giống đúng là "dời một ô", đủ, đối xứng hai chiều, số lượng 4 / 7–13 / 9–31; `ROTATE_MATCH_MAX_RADIUS` khớp kho.
- 10 000 seed × 4 mức (index = seed mod 37): 0 lỗi trên mọi điều trong mục này; mỗi câu sinh hai lần ra cùng kết quả; `check` nhận đáp án đúng và từ chối mọi chỉ số khác (kể cả 3 ở Mầm). Các phép kiểm hình học viết lại độc lập trong test, không dùng chung `shapes.ts`.
- Tỉ lệ đo được: mỗi vị trí là đáp án 24,3–25,5% (Mầm 33,0–33,7%); từ Thường, tỉ lệ lựa chọn ở mỗi góc là đáp án 24,5–25,4%.
- Tất định: nạp lại module rồi sinh theo thứ tự mức ngược lại vẫn ra cùng câu; sửa câu đố đã trả về không ảnh hưởng câu sau; mã băm đầu ra cố định của 200 câu mỗi mức.
- Đã thử làm hỏng bộ sinh (bỏ lọc góc 180° cho họ S; lấy Q = chính loại mẫu): test đều bắt được.

## Cân bằng

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ sai ước | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | Người lớn 1,2–2 s · trẻ 7 tuổi 2–3 s | 3% · trẻ 10% | 25–38 · trẻ 17–24 |
| Thường | 2–3,5 s | 10% | 15–24 |
| Khó | 3,5–5 s | 13% | 11–15 |
| Siêu khó | 5–7 s | 17% | 8–11 |

Cách ước lượng thời gian giải: 0,5 s nhìn mẫu + số lần so × thời gian xoay-so một hình + 0,3 s chạm. Số lần so trung bình là 2,25 với 4 lựa chọn (dừng khi gặp đáp án, lựa chọn cuối tự suy ra) và 1,67 với 3 lựa chọn. Thời gian so một hình: ≈ 0,4 s hình khác họ (Mầm); 0,6–1,2 s hình 5 ô góc vuông; 1,2–1,8 s hình 6 ô nghiêng 45°; 1,9–2,7 s hình 7 ô nghiêng lẻ. Số câu = 60 s ÷ (thời gian giải + 0,35 s hiệu ứng đúng + 1,5 s × tỉ lệ sai). Các mức của người lớn không chồng nhau. Siêu khó vẫn còn ≥ 8 câu mỗi vòng (mục tiêu của CR-006). Cần đo lại khi chơi thử và ghi vào đây.

**Thưởng tốc độ chung (trọn 50 điểm khi ≤ 1,5 s, hết từ 8 s): hợp, giữ nguyên, nên game không khai báo `speedAllowanceMs`.** Ở Thường, câu 2–3,5 s được 35–46 điểm thưởng nên nhanh hay chậm vẫn có nghĩa; Khó được 23–35; Siêu khó còn 8–23. Không có pha trình chiếu hay nhiều lần chạm cần trừ. Thử nới riêng cho game này (Khó 2–10 s, Siêu khó 2,5–12 s) chỉ tăng điểm vòng Khó khoảng 5%, Siêu khó khoảng 9%; phần chênh này hệ số độ khó đã bù.

### Hệ số độ khó theo game (CR-006)

`difficultyMultiplier` = **Mầm 0,85 · Thường 1 · Khó 2 · Siêu khó 3,3** (hệ số chung cũ: 0,8 / 1 / 1,25 / 1,5). Con số chốt lại sau buổi chơi thử đủ 5 game MVP; đổi số chỉ cần sửa hằng trong `rotate-match.ts` và test đi kèm.

**Cách tính.** Mục tiêu của CR-006: người chơi đúng sức ở mức nào cũng được điểm vòng xấp xỉ người lớn ở Thường (hệ số 1). Mô phỏng 200 000 vòng cho mỗi mức theo công thức điểm server đã cài:

- thời gian giải phân bố đều trong khoảng ở bảng trên, sai theo tỉ lệ ở bảng trên;
- câu đúng: hiệu ứng 0,35 s ở FE, khoảng này tính vào `answerMs` của câu sau; câu sai: khoá 1,5 s, đồng hồ câu sau tính từ lúc hết khoá;
- thưởng tốc độ: `max(0, answerMs − allowanceMs)` (game này `allowanceMs = 0`) kẹp vào khung 1,5–8 s; combo có trần × 1,5 (đạt từ câu đúng liên tiếp thứ 7); vòng 60 s.

Điểm vòng ở mức d có dạng S_d(m) = m × A_d + B_d, với A_d là tổng (100 × combo) và B_d là tổng (thưởng tốc độ × combo). Chọn m_d sao cho S_d(m_d) = S_Thường(1), tức m_d = (S_Thường − B_d) ÷ A_d, rồi làm tròn tới 0,05. Riêng Mầm, mốc là trẻ 7 tuổi (người chơi đúng sức ở mức này), và hệ số theo **quy tắc chung của PM cho cả 5 game: Mầm = min(giá trị mô phỏng, 1)**. Đây là trần chứ không phải sàn: hệ số Mầm không bao giờ cao hơn Thường, nên hệ số không cho người lớn chọn Mầm thêm lợi.

| Người chơi | Câu đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn |
| --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 17,9 · 2,0 | 2 278 | 909 | 0,86 | **0,85** (min(0,86; 1), làm tròn) |
| Người lớn · Thường | 16,5 · 1,8 | 2 085 | 793 | 1 (mốc, S = 2 878) | **1** |
| Người lớn · Khó | 10,6 · 1,6 | 1 284 | 342 | 1,98 | **2** |
| Người lớn · Siêu khó | 7,3 · 1,5 | 837 | 112 | 3,31 | **3,3** |

Hệ số Siêu khó cao vì mỗi vòng chỉ được khoảng 7 câu đúng (Thường 16–17), thưởng tốc độ chỉ còn khoảng 13 điểm mỗi câu (Thường khoảng 38) và chuỗi combo ngắn hơn.

Điểm vòng ước tính (mô phỏng như trên, so với người lớn ở Thường):

| Người chơi | Hệ số chung cũ 0,8 / 1 / 1,25 / 1,5 | Hệ số game này 0,85 / 1 / 2 / 3,3 |
| --- | --- | --- |
| Trẻ 7 tuổi · Mầm | ≈ 2 730 (95%) | ≈ 2 840 (99%) |
| Người lớn · Mầm | ≈ 5 100 (177%) | ≈ 5 300 (184%) |
| Người lớn · Thường | ≈ 2 880 (100%) | ≈ 2 880 (100%) |
| Người lớn · Khó | ≈ 1 950 (68%) | ≈ 2 910 (101%) |
| Người lớn · Siêu khó | ≈ 1 370 (47%) | ≈ 2 870 (100%) |

- Người lớn chọn Mầm vẫn được khoảng 184% điểm Thường: không công thức nào chặn hẳn được, phần này do chủ phòng giám sát (CR-006). Nếu đặt Mầm = 1 thì con số này lên 205%; trần min(mô phỏng, 1) tránh điều đó.
- **Độ nhạy:** Khó, Siêu khó giải nhanh hơn dự kiến 0,75 s / 1 s thì được khoảng 125% / 123% Thường; chậm hơn chừng ấy thì còn khoảng 84% / 83%. Vì vậy cần đo thời gian giải thật ở buổi chơi thử rồi tính lại theo cách trên.

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `rotateMatch.generate(seed, index, difficulty)` từ `@brain-rizz/shared` (như Kẻ lạc đàn), rồi gửi chỉ số thẻ được chạm. Các kiểu và hằng đều export từ `@brain-rizz/shared`, có comment từng trường trong `packages/shared/src/games/rotate-match/rotate-match.ts`.

```ts
type RotateMatchCell = readonly [x: number, y: number];
interface RotateMatchFigure { cells: readonly RotateMatchCell[]; angle: number }
type RotateMatchChoiceKind = "rotation" | "mirror" | "other";
interface RotateMatchChoice extends RotateMatchFigure { kind: RotateMatchChoiceKind }
interface RotateMatchPuzzle { model: RotateMatchFigure; choices: RotateMatchChoice[]; answerIndex: number }
type RotateMatchAnswer = number; // chỉ số thẻ được chạm, 0–3
```

| Trường | Ý nghĩa |
| --- | --- |
| `cells` | Các ô của hình ở tư thế gốc (chưa xoay). `[x, y]` nguyên ≥ 0, đơn vị ô; x sang phải, y xuống dưới. Đã chuẩn hoá (x, y nhỏ nhất là 0), sắp theo (y, x). Liền cạnh, không có lỗ, khung bao ≤ 4 × 4. Số ô 4 / 5 / 6 / 7 theo mức. |
| `angle` | Góc vẽ, số nguyên độ, **chiều kim đồng hồ** trên màn hình (đúng chiều `setAngle` của Phaser), xoay quanh trọng tâm các ô. Mẫu luôn 0. Lựa chọn lấy từ `ROTATE_MATCH_ANGLES[d]`: Mầm, Thường {90, 180, 270}; Khó {45, 90, 135, 225, 270, 315}; Siêu khó {60, 120, 150, 210, 240, 300}. Không có 0°. |
| `kind` | `"rotation"`: đáp án (cùng `cells` với mẫu, chỉ khác góc). `"mirror"`: bản lật gương trái–phải của mẫu (`cells` đã lật sẵn, không cần FE lật). `"other"`: hình khác loại (Mầm: họ khác; từ Thường: mẫu dời một ô, hoặc gương của nó). **Chỉ dùng sau khi chạm** để chọn phản hồi, không được để lộ trước. |
| `choices` | 3 thẻ (Mầm) hoặc 4, đúng thứ tự trên màn hình: trái → phải, trên → dưới (xem bảng Bố cục). |
| `answerIndex` | Vị trí thẻ đúng trong `choices`. |
| `ROTATE_MATCH_MAX_RADIUS[d]` | Bán kính lớn nhất (ô) của mọi hình ở mức d: 1,91 / 2,41 / 2,70 / 2,88. Dùng để chọn cỡ ô (mục Vẽ hình). |

- Không lật hay xoay dữ liệu ô ở FE: chỉ vẽ `cells` rồi `setAngle(angle)`. Mọi khác biệt xoay/lật đã nằm sẵn trong dữ liệu.
- Kiểm cục bộ bằng `rotateMatch.check(puzzle, i)` để phản hồi ngay (server chấm lại bằng chính hàm này).

### Bố cục (khung 720×1280)

| Thành phần | x, y | Rộng × cao | Ghi chú |
| --- | --- | --- | --- |
| Thẻ mẫu | 180, 56 | 360 × 360 | Viền mực dày hơn thẻ lựa chọn + icon con mắt hoặc ghim nhỏ ở góc trên trái; không nhận chạm |
| Dải nhắc luật (nên có) | 216, 436 | 288 × 56 | Hai chip icon: ↻ ✓ (xoay: được) và ⇋ ✗ (lật: không); không có chữ |
| Lựa chọn 0 · 1 | 28, 520 · 372, 520 | 320 × 320 | Hàng trên |
| Lựa chọn 2 · 3 | 28, 864 · 372, 864 | 320 × 320 | Hàng dưới. Mầm chỉ có lựa chọn 2, đặt giữa ở 200, 864 |

- Cả thẻ lựa chọn là vùng chạm (320 px, rất xa mức tối thiểu 48 px); khe 24 px giữa các thẻ để tránh chạm nhầm. Lựa chọn nằm ở nửa dưới cho dễ với ngón cái.
- Thứ tự `choices` là thứ tự ô trên màn hình. Không đánh số hay chữ lên thẻ.

### Vẽ hình

- Mỗi ô là hình vuông cạnh u, tô màu nhóm Hình dung (`--color-visualize`, `#7768ae`). Ở chế độ tối dùng sắc sáng hơn cho đủ tương phản trên thẻ `#2f2a52`; ui-designer chốt sắc độ. Viền ngoài mực 3 px, đường chia ô mảnh 2 px (mực 40%) để đếm được ô.
- Mọi hình trong một mức (mẫu và lựa chọn) cùng một màu và cùng cỡ ô: u = ⌊140 / `ROTATE_MATCH_MAX_RADIUS[d]`⌋, tối đa 64, tức **64 / 58 / 51 / 48 px** cho Mầm / Thường / Khó / Siêu khó (140 = nửa cạnh thẻ 320 trừ lề 20). Không đổi cỡ theo từng câu, để cỡ hay màu không lộ đáp án.
- Trọng tâm c = (trung bình x + 0,5; trung bình y + 0,5), đơn vị ô. Đặt c vào tâm thẻ, vẽ từng ô tại ((x − cₓ)·u, (y − c_y)·u) trong một container, rồi `container.setAngle(angle)`.
- Bóng đổ (nếu có) lệch theo trục màn hình, không xoay theo hình.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Thẻ và hình hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120 ms |
| Chờ chọn | Máy tính: rê chuột thì thẻ nhấc 4 px, viền đậm hơn. Điện thoại: thẻ co 0,97 lúc nhấn. Ghi nhận ở `pointerdown`, một chạm là chốt (như Kẻ lạc đàn) | — |
| Đúng | Thẻ được chọn có viền màu thành công + huy hiệu ✓. Một "bóng ma" là viền của hình mẫu (mờ 60%) hiện trên thẻ đó ở góc 0°, xoay theo chiều gần nhất (270° thì quay ngược 90°) tới góc của lựa chọn và khớp khít vào hình; sau đó hình nảy 1 → 1,08 → 1 | 250 + 100 ms; sang câu mới sau ≤ 350 ms |
| Sai, khoá 1,5 s | Thẻ bị chạm rung ngang ±8 px, viền gạch đứt + ✗; nếu `kind = "mirror"` thêm icon gương nhỏ. **Hiện đáp án đúng:** thẻ đúng có ✓ và chạy bóng ma xoay khớp như trên; các thẻ khác mờ còn 35% | Rung 200 ms, bóng ma 300 ms; khoá `WRONG_ANSWER_LOCK_MS` rồi sang câu mới |
| Hết giờ | Không nhận chạm nữa (PlayScreen xử lý kết thúc vòng) | — |

- Giữ hiệu ứng đúng ≤ 350 ms: server tính giờ câu sau từ lúc nhận đáp án trước, nên thời gian hiệu ứng bị trừ vào thưởng tốc độ câu sau.

### Khi trả lời sai: hiện đáp án đúng (đã duyệt 2026-10-12, CR-006 mục 4)

Trong 1,5 giây khoá (`WRONG_ANSWER_LOCK_MS`) FE hiện đáp án đúng, để người chơi học phân biệt xoay với lật:

1. Lúc chạm: `rotateMatch.check(puzzle, i)` sai thì `submit` rồi gọi `bridge.unlockDelay(index)`. Hết khoá theo số ms nó trả về (khớp `lockedUntil` của server), không tự đếm 1,5 giây.
2. Ngay khi chạm (không chờ server): thẻ bị chạm rung ±8 px, viền gạch đứt + ✗. `choices[i].kind === "mirror"` thì thêm icon gương nhỏ (đây đúng là bẫy lật); `"other"` thì chỉ ✗.
3. Thẻ `choices[puzzle.answerIndex]`: viền liền màu thành công + ✓. Bóng ma là viền hình mẫu (`model.cells`, mờ 60%) đặt cùng tâm thẻ ở góc 0°, xoay theo chiều gần nhất tới `choices[answerIndex].angle` (vd. 270° thì quay ngược 90°, 225° thì quay ngược 135°), trong 300 ms, rồi khớp khít vào hình.
4. Các thẻ còn lại mờ còn 35%. Thẻ mẫu giữ nguyên để người chơi nhìn lại.
5. Hết khoá: sang câu mới (hiệu ứng "Hiện câu"). Vòng hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả `unlockDelay`.

- `prefers-reduced-motion`: không rung, không chạy bóng ma, chỉ đổi viền + huy hiệu ✓/✗.
- Huy hiệu khoá của khung che dải giữa trên cùng (tới y ≈ 80, máy thấp tới y ≈ 225). Thẻ đáp án luôn nằm ở y ≥ 520 nên không bị che. Hình mẫu (tâm y = 236, mép trên hình ≥ y ≈ 96) không bị che ở máy thường. Ở máy thấp, nửa trên thẻ mẫu có thể bị che trong lúc khoá; bóng ma trên thẻ đáp án vẫn đủ để hiểu, không cần dời bố cục.
- `prefers-reduced-motion`: bỏ rung và bóng ma, chỉ đổi viền và huy hiệu.
- Không chỉ dùng màu: đúng là ✓ + viền liền, sai là ✗ + viền gạch đứt.
- Máy tính: khung dọc thu nhỏ theo FIT (màn 1280×720 còn khoảng 0,45 lần), ô hình còn khoảng 22–29 px, vẫn đọc được; không cần bố cục ngang riêng.

### Âm thanh dự kiến (GĐ 2)

- Đúng: tiếng "vút" ngắn lúc bóng ma xoay + "ting" cao dần theo combo.
- Sai: "bụp" trầm + rung 40 ms.
- Hiện câu: không có âm (câu ra quá dày).

### Ví dụ để vẽ bản mẫu

Toạ độ ô (x, y) nguyên, x sang phải, y xuống dưới. Vẽ ô cạnh u, xoay cả hình quanh trọng tâm theo góc, chiều kim đồng hồ. Cột "Trông như" là hình sau khi xoay (`#` là ô, `/` là xuống dòng); góc lẻ được tách thành phần bội 90° + phần nghiêng thêm. Mỗi ví dụ đã được kiểm có đúng một bản xoay.

**Mầm** (u = 64). Mẫu `[[0,0],[0,1],[0,2],[1,2]]` = `#. / #. / ##` (chữ L), trọng tâm (0,75; 1,75).

| Ô | Loại | Ô của hình | Góc | Trông như |
| --- | --- | --- | --- | --- |
| 0 · trên trái | Hình khác (họ T) | `[[0,0],[1,0],[2,0],[1,1]]` | 180° | `.#. / ###` |
| 1 · trên phải | **Đáp án** | như mẫu | 90° | `### / #..` |
| 2 · dưới giữa | Hình khác (họ S) | `[[1,0],[2,0],[0,1],[1,1]]` | 90° | `#. / ## / .#` |

`answerIndex = 1`

**Thường** (u = 58). Mẫu `[[1,0],[2,0],[0,1],[1,1],[1,2]]` = `.## / ##. / .#.` (chữ F), trọng tâm (1,5; 1,3).

| Ô | Loại | Ô của hình | Góc | Trông như |
| --- | --- | --- | --- | --- |
| 0 · trên trái | Bản gương | `[[0,0],[1,0],[1,1],[2,1],[1,2]]` (`##. / .## / .#.`) | 180° | `.#. / ##. / .##` |
| 1 · trên phải | Hình gần giống (F dời 1 ô) | `[[0,0],[1,0],[0,1],[1,1],[0,2]]` (`## / ## / #.`) | 90° | `### / .##` |
| 2 · dưới trái | **Đáp án** | như mẫu | 270° | `#.. / ### / .#.` |
| 3 · dưới phải | Gương của hình gần giống | `[[0,0],[1,0],[0,1],[1,1],[1,2]]` (`## / ## / .#`) | 270° | `### / ##.` |

`answerIndex = 2`. Ô 1 và ô 3 trông như ảnh soi gương trái–phải của nhau nhưng đều sai: cặp đối xứng không gợi ý đáp án.

**Khó** (u = 51). Mẫu `[[0,0],[0,1],[1,1],[2,1],[2,2],[3,2]]` = `#... / ###. / ..##`, trọng tâm (1,833; 1,667).

| Ô | Loại | Ô của hình | Góc | Trông như |
| --- | --- | --- | --- | --- |
| 0 · trên trái | Hình gần giống (dời ô (3,2) lên (3,1)) | `[[0,0],[0,1],[1,1],[2,1],[3,1],[2,2]]` (`#... / #### / ..#.`) | 225° | `.#.. / #### / ...#` rồi nghiêng thêm 45° |
| 1 · trên phải | Bản gương | `[[3,0],[1,1],[2,1],[3,1],[0,2],[1,2]]` (`...# / .### / ##..`) | 45° | hình ở cột trước nghiêng 45° |
| 2 · dưới trái | Gương của hình gần giống | `[[3,0],[0,1],[1,1],[2,1],[3,1],[1,2]]` (`...# / #### / .#..`) | 90° | `.#. / ##. / .#. / .##` |
| 3 · dưới phải | **Đáp án** | như mẫu | 135° | `.## / .#. / ##. / #..` rồi nghiêng thêm 45° |

`answerIndex = 3`

**Siêu khó** (u = 48). Mẫu `[[0,0],[1,0],[1,1],[2,1],[3,1],[1,2],[3,2]]` = `##.. / .### / .#.#`, trọng tâm (2,071; 1,5).

| Ô | Loại | Ô của hình | Góc | Trông như |
| --- | --- | --- | --- | --- |
| 0 · trên trái | **Đáp án** | như mẫu | 240° | `#.#. / ###. / ..##` rồi nghiêng thêm 60° |
| 1 · trên phải | Gương của hình gần giống | `[[2,0],[3,0],[0,1],[1,1],[2,1],[1,2],[2,2]]` (`..## / ###. / .##.`) | 150° | `.#. / ##. / ### / ..#` rồi nghiêng thêm 60° |
| 2 · dưới trái | Bản gương | `[[2,0],[3,0],[0,1],[1,1],[2,1],[0,2],[2,2]]` (`..## / ###. / #.#.`) | 60° | hình ở cột trước nghiêng 60° |
| 3 · dưới phải | Hình gần giống (dời ô (3,2) sang (2,2)) | `[[0,0],[1,0],[1,1],[2,1],[3,1],[1,2],[2,2]]` (`##.. / .### / .##.`) | 300° | `.#. / .## / ### / #..` rồi nghiêng thêm 30° |

`answerIndex = 0`

Nên vẽ ít nhất bản Mầm và Siêu khó (hai đầu của dải độ khó), mỗi bản thêm một khung trạng thái "Sai" có hiện đáp án đúng.

## Ghi chú cho BE

Không có xử lý khác thường: không có pha trình chiếu, đáp án một bước, chấm bằng `generate()` + `check()` như Kẻ lạc đàn.

- `isAnswer` nhận số nguyên 0–3; ở Mầm (3 lựa chọn) gửi 3 thì `check` trả sai.
- Khai báo CR-006 trong `rotateMatch`: `durationMs: 60_000`; `difficultyMultiplier: { 0: 0.85, 1: 1, 2: 2, 3: 3.3 }`; **không** có `speedAllowanceMs` (server dùng 0). Cách tính ở mục [Cân bằng](#hệ-số-độ-khó-theo-game-cr-006).
- Kho hình tính lười ở lần `generate` đầu tiên của mỗi mức, một lần cho mỗi tiến trình (cả 4 mức ≈ 40 ms, Siêu khó ≈ 24 ms). Muốn tránh trễ ở câu đầu thì gọi trước khi vòng bắt đầu.
- Lưu ý chung, không riêng game này: `answerMs` tính từ lúc server nhận đáp án trước, nên khoảng 350 ms hiệu ứng "đúng" ở FE bị tính vào câu sau (mất khoảng 3 điểm thưởng mỗi câu). Nếu muốn công bằng tuyệt đối có thể thêm hằng chung `CORRECT_FEEDBACK_MS` để server trừ ra. Đây chỉ là đề xuất.

## Đối chiếu quy tắc thiết kế

Theo checklist ở [Thiết kế game › Quy tắc thiết kế một minigame mới](../01-product/game-design.md#quy-tắc-thiết-kế-một-minigame-mới).

| Quy tắc | Đạt | Căn cứ |
| --- | --- | --- |
| Hiểu cách chơi trong ≤ 5 giây | Có | Một câu "Xoay thì đúng, lật thì sai!" + hình minh hoạ L/J |
| Một câu ở mức Thường giải trong 1–8 giây | Có | Ước 2–3,5 s |
| Đúng một đáp án, kiểm được bằng máy | Có | Lập luận ở mục "Vì sao chắc chắn đúng một đáp án"; `rotate-match.test.ts` 10 000 seed × 4 mức: 0 lỗi |
| Chỉ số nguyên + `createRng()` | Có | Ô và góc đều là số nguyên; kho hình liệt kê tất định, không ngẫu nhiên |
| Bốn mức khác rõ rệt; Mầm cho trẻ 7 tuổi | Có | 4/5/6/7 ô; góc vuông → 45° → góc lẻ; Mầm chỉ có 3 hình khác họ, không bẫy lật |
| Một ngón tay, khung 720×1280, vùng chạm ≥ 48 px | Có | Thẻ lựa chọn 320 × 320 |
| Không phụ thuộc chữ | Có | Chỉ có hình và icon |
| Không chỉ phân biệt bằng màu | Có | Mọi hình cùng màu; phản hồi có ✓/✗ và kiểu viền |

## Quyết định (đã duyệt 2026-10-12)

Chủ dự án duyệt mọi đề xuất trong đặc tả đúng như đã viết, cùng [CR-006](../00-tracking/change-requests.md#cr-006):

| Câu hỏi | Quyết định |
| --- | --- |
| Mức cao: "toàn bộ mồi là bản gương" hay **hai cặp gương** (bản gương + hình gần giống và gương của nó)? | Hai cặp gương, như mục "Vì sao không lộ đáp án". Đã duyệt 2026-10-12. |
| Mầm có bẫy lật gương không? | Không. Mầm chỉ cần nhận ra hình cùng họ đã xoay (3 họ L, T, S). Đã duyệt 2026-10-12. |
| Chọn sai có hiện đáp án đúng không? | Có, trong 1,5 giây khoá ([Ghi chú cho FE](#khi-trả-lời-sai-hiện-đáp-án-đúng-đã-duyệt-2026-10-12-cr-006-mục-4)). CR-006 áp dụng cho mọi game. Đã duyệt 2026-10-12. |
| Cân bằng điểm giữa các mức | CR-006: hệ số độ khó theo từng game + trần combo × 1,5. Game này: 0,85 / 1 / 2 / 3,3 (Mầm = min(mô phỏng, 1) theo quy tắc chung của PM). Con số chốt sau buổi chơi thử. Đã duyệt 2026-10-12. |
| Thưởng tốc độ riêng cho game này? | Không, giữ khung chung; không khai báo `speedAllowanceMs`. Đã duyệt 2026-10-12 (CR-006). |
| Dải icon nhắc luật trên màn chơi | Giữ (↻ ✓ và ⇋ ✗), như bảng Bố cục. Đã duyệt 2026-10-12. |
| Thời lượng vòng 45 s hay 60 s? | 60 s (CR-006 mục 3). Đã duyệt 2026-10-12. |

## Câu hỏi mở

- Hằng chung `CORRECT_FEEDBACK_MS` để server trừ khoảng hiệu ứng "đúng" ở FE khỏi `answerMs` (mục Ghi chú cho BE): vẫn chỉ là đề xuất, chưa có CR.
