# Luyện ngắm (`aim-trainer`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/aim-trainer/` (logic + test), `apps/web/src/games/aim-trainer/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M16**.
- Tham khảo cơ chế: humanbenchmark.com/tests/aim (chỉ lấy ý tưởng, hình và tên là của Brain Rizz).

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có bộ sinh câu đố `aim-trainer.ts` + test 10 000 seed × 4 mức, hạn trả lời chung `answerWindowMs` trong `judgeAnswer`, scene Phaser `AimTrainerScene`, màn hướng dẫn, chữ vi/en, đã đăng ký trong registry và Kiểm tra não (điểm chuẩn 8 350, `BRAIN_TEST_RULES_VERSION` 3). Còn QA và buổi chơi thử trên máy thật. Chủ dự án đã chốt mọi câu hỏi mở ngày 2026-10-20; kích thước, thời gian và hệ số vẫn chỉnh được sau buổi chơi thử.

## Cách chơi

Một tấm bia tròn hiện ở chỗ bất kỳ trong khung: chạm trúng bia càng nhanh càng tốt, trúng thì bia mới hiện ngay ở chỗ khác. Bia không di chuyển. Ở mức cao bia biến mất nếu chạm chậm, và có bia mồi đỏ không được bắn.

**Một câu = một tấm bia.** Đáp án là toạ độ chạm; server kiểm toạ độ nằm trong bia.

## Màn hướng dẫn

- **Cách chơi:**
  1. Chạm thật nhanh vào hồng tâm
  2. Trúng là bia mới hiện ngay
  3. Đừng để bia kịp biến mất
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** khung phấn chữ nhật đứng. Một bia hồng tâm (3 vòng đồng tâm) có ngón tay/con trỏ chạm vào giữa, sao vàng nhỏ bung ra. Mũi tên phấn cong từ bia đó sang một bia mới ở góc đối diện (nét đứt, "hiện ngay"). Góc dưới phải: một bia đỏ viền răng cưa có dấu X trắng, gạch chéo đỏ bên cạnh (mồi, không bắn).
- **Câu nhắc lúc đếm ngược:** "Chạm thật nhanh, thật trúng!" (máy tính: "Click thật nhanh, thật trúng!").
- **Câu nhắc theo mức:** Khó "Bia co dần rồi biến mất!" · Siêu khó "Né bia đỏ có dấu X!".
- **Gợi ý cạnh từng mức:** Mầm "Bia to · không giới hạn giờ" · Thường "Bia vừa · 1,5 giây" · Khó "Bia nhỏ · co dần" · Siêu khó "Bia nhỏ · có bia mồi".

## Câu đố & đáp án

**Hệ toạ độ khung chơi** (hằng số `AIM_FIELD` export từ shared): chữ nhật **1 000 × 1 400 đơn vị** (rộng × cao, tỉ lệ 5 : 7), gốc ở góc trên trái, y hướng xuống. Cạnh ngắn = 1 000 đơn vị nên "x % cạnh ngắn" = 10·x đơn vị. Mọi toạ độ, bán kính là **số nguyên**. Khung có tỉ lệ cố định trong khung thiết kế 720×1280 nên điện thoại và máy tính thấy cùng một hình, chỉ khác tỉ lệ phóng.

- `Puzzle` (`AimTrainerPuzzle`):
  - `x`, `y`: tâm bia (đơn vị khung).
  - `r`: bán kính vẽ lúc bia hiện.
  - `hitR`: bán kính chấm = `r + 25` (dung sai chạm, giống nhau cho chuột và ngón tay).
  - `lifeMs`: thời gian bia tồn tại; `0` = không giới hạn (Mầm).
  - `shrinkTo`: bán kính vẽ lúc biến mất, tính theo % của `r` (100 = không co; Khó, Siêu khó = 40). Chỉ để vẽ, **không** ảnh hưởng chấm.
  - `decoys: { x, y }[]`: tâm bia mồi đỏ (cùng `r`, cùng `hitR`, cùng `lifeMs`, cùng co). Rỗng trừ Siêu khó.
- `Answer`: `{ x: number; y: number }`, số nguyên, `0 ≤ x ≤ 1 000`, `0 ≤ y ≤ 1 400`; hoặc **`{ x: −1, y: −1 }` = bỏ lỡ** (hằng số `AIM_TRAINER_MISS`; client gửi khi hết `lifeMs` mà chưa trúng).
- `check`: đúng khi và chỉ khi không phải bỏ lỡ và `(x − puzzle.x)² + (y − puzzle.y)² ≤ hitR²` (so số nguyên, không căn). Chạm vào bia mồi tự nhiên rơi ngoài vùng bia thật nên sai.
- `isAnswer`: object (không phải mảng) có đúng hai trường `x`, `y` số nguyên trong miền trên, hoặc cả hai bằng −1.
- `answerWindowMs(puzzle)`: `lifeMs` (Mầm: `undefined` = không giới hạn). Server chấm sai đáp án tới muộn, xem Ghi chú cho BE.
- **Chạm hụt (chỗ trống) không gửi, không tính sai** (đã chốt), giống Đập đúng hình: client chỉ gửi khi chạm rơi vào vùng chấm (`hitR`) của bia thật hoặc của một bia mồi, hoặc khi bỏ lỡ. Mỗi câu chỉ một lần gửi. Client sửa đổi có gửi chạm hụt thì server chấm sai, không có lợi gì.

## Cách sinh câu đố

Bia mới phải cách bia trước một khoảng tối thiểu, nên vị trí câu `i` phụ thuộc câu `i − 1`. Để `generate(seed, i)` không phải lần lại từ câu 0, vị trí sinh theo **khối 8 câu**:

1. Khối `b = ⌊i / 8⌋`, vị trí trong khối `k = i mod 8`. `rngB = createRng(deriveSeed(seed, b, SALT_POS))`.
2. Lần rút đầu tiên của `rngB` luôn là **bia cuối khối** (`k = 7`), rút tự do. Vì vậy bia cuối khối `b − 1` tính được chỉ bằng một lần rút đầu của khối `b − 1`.
3. Rút lần lượt `k = 0 … 6`: mỗi bia cách bia trước ≥ `minJump` (bia `k = 0` so với bia cuối khối `b − 1`; câu 0 của vòng không có ràng buộc). Bia `k = 6` còn phải cách bia cuối khối (`k = 7`) ≥ `minJump`, để bước 6 → 7 cũng đạt.
4. Mỗi lần rút: tâm là số nguyên đều trong vùng cho phép (cách mép khung ≥ `hitR + 15`, để cả vùng chấm nằm trong khung). Thử tối đa 40 lần; hết lượt thì lấy điểm tốt nhất trong lưới cố định 5 × 7 điểm của vùng cho phép (điểm có khoảng cách nhỏ nhất tới các điểm cần tránh lớn nhất). Mọi thứ đi qua `rngB`, không có nguồn ngẫu nhiên khác.
5. Siêu khó, bia mồi: `rngD = createRng(deriveSeed(seed, i, SALT_DECOY))`, số mồi = `rngD.int(1, 2)`. Mỗi mồi rút như bước 4, cách tâm bia thật và các mồi khác ≥ **220**, cách **bia của câu trước** ≥ **300** (để cú chạm dư ở chỗ cũ không trúng mồi).

Chi phí: `generate` gọi tối đa 2 khối × 8 lần rút (Siêu khó thêm một lần sinh câu `i − 1` để lấy vị trí bia trước), không phụ thuộc `i`.

**Vì sao đúng một đáp án:** đáp án là một vùng (đĩa `hitR`), không phải một giá trị. "Đúng một đáp án" nghĩa là: có đúng một vùng chấm đúng (bia thật), vùng này nằm trọn trong khung, và **không giao** vùng chấm của bia mồi nào (tâm cách ≥ 220 > 2 × `hitR` = 160). Mọi điểm ngoài đĩa đó, kể cả tâm mồi và bỏ lỡ, đều sai.

## Độ khó

Kích thước tính theo **% cạnh ngắn khung chơi** (đường kính).

| Mức | Bia (đường kính vẽ · `r`) | Vùng chấm `hitR` | Tồn tại `lifeMs` | Co dần | Cách bia trước `minJump` | Mồi |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 22 % · r 110 | 135 | không giới hạn | không | ≥ 250 (25 %) | 0 |
| Thường | 16 % · r 80 | 105 | 1 500 ms | không | ≥ 300 (30 %) | 0 |
| Khó | 13 % · r 65 | 90 | 1 300 ms | 100 % → 40 % | ≥ 500 (50 %) | 0 |
| Siêu khó | 11 % · r 55 | 80 | 1 500 ms | 100 % → 40 % | ≥ 500 (50 %) | 1–2 (đều 50/50), cách bia ≥ 220 |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Bia to, đứng yên tới khi chạm trúng; bia mới hiện không quá gần ngón tay |
| Thường | Bia vừa, vòng đếm giờ quanh bia; chậm 1,5 s là bia biến mất |
| Khó | Bia nhỏ co dần trong vòng mờ rồi biến mất, bia mới thường ở phía bên kia khung |
| Siêu khó | Như Khó, thêm 1–2 bia đỏ viền răng cưa dấu X hiện cùng lúc: phải chọn đúng bia rồi mới chạm |

- Siêu khó cho 1 500 ms (dài hơn Khó) vì thêm bước nhận ra bia thật giữa các mồi.
- Co dần chỉ là đồng hồ bằng hình: vùng chấm giữ nguyên `hitR` suốt đời bia, và vẫn vẽ một vòng mờ nét đứt bằng cỡ ban đầu. Lý do: server không biết chính xác lúc chạm theo đồng hồ máy khách, chấm theo bán kính lúc chạm sẽ oan cho người mạng chậm.

**Độ khó đo được** (bộ sinh thật, 4 000 seed × 24 câu mỗi mức, đo 2026-10-20; test kiểm Fitts tăng ngặt trên 10 000 seed × 12 câu):

| Mức | Bước nhảy trung bình (min) | Chỉ số Fitts trung bình `log2(d / 2hitR + 1)` | Mồi mỗi câu |
| --- | --- | --- | --- |
| Mầm | 552 (250) | 1,56 | 0 |
| Thường | 604 (300) | 1,91 | 0 |
| Khó | 733 (500) | 2,32 | 0 |
| Siêu khó | 741 (500) | 2,47 | 1,5 |

Chỉ số Fitts tăng ngặt theo mức; Siêu khó còn thêm quyết định chọn bia. Test 10 000 seed × 4 mức × 18 câu (phủ ranh giới khối 7 → 8, 15 → 16, cả đầu vòng lẫn câu 40–137) không vi phạm ràng buộc nào, kể cả khi rơi vào nhánh dự phòng (bước 4).

## Đảm bảo khi sinh câu đố

- Đúng một vùng chấm đúng: tâm bia → `check` đúng; điểm cách tâm `hitR + 1` theo 8 hướng → sai; tâm mỗi mồi → sai; `{ −1, −1 }` → sai.
- Vùng chấm bia và mồi nằm trọn trong khung (cách mép ≥ `hitR`).
- Bia câu `i` cách bia câu `i − 1` ≥ `minJump` của mức (kể cả ở ranh giới khối 8 câu).
- Siêu khó: 1–2 mồi (câu 1 mồi và câu 2 mồi mỗi loại ~50 %, lệch < 5 %), mồi cách bia thật và cách nhau ≥ 220, cách bia câu trước ≥ 300. Mức khác: không có mồi.
- `r`, `hitR`, `lifeMs`, `shrinkTo` đúng bảng mức; toạ độ là số nguyên.
- Chỉ số Fitts trung bình tăng ngặt Mầm → Thường → Khó → Siêu khó.
- Vị trí bia phân bố đều theo 4 phần tư khung (lệch < 15 %).
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random`/`Date.now`.

Các điều trên phải được kiểm bằng test ≥ 10.000 seed × 4 độ khó (mỗi seed vài chục câu liên tiếp để phủ ranh giới khối).

## Cân bằng

Người chơi mục tiêu (trẻ ở Mầm theo luật chung, đã chốt): Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian mỗi bia là thời gian phản xạ + di chuyển (tham khảo trung bình ~0,6 s mỗi bia của bài aim trên humanbenchmark, bia cỡ vừa, có chuột). "Sai" chỉ đến từ bỏ lỡ (hết `lifeMs`) và bắn mồi; chạm hụt không gửi nên không tính sai, chỉ tốn thời gian.

| Mức | Thời gian mỗi bia | Tỉ lệ sai | Số bia mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 1,0–2,0 s (người lớn 0,45–0,65 s) | 0 % (không có cách sai) | ~39 (người lớn ~104) |
| Thường | 0,55–0,80 s | 2 % (bỏ lỡ) | ~80 (78,5 trúng) |
| Khó | 0,80–1,05 s | 5 % (bỏ lỡ) | ~57 (54,4 trúng) |
| Siêu khó | 1,00–1,30 s | 8 % (nửa bỏ lỡ, nửa bắn mồi) | ~46 (41,9 trúng) |

Các mức của người lớn không chồng nhau (Thường ≤ 0,80 s ≤ Khó ≤ 1,05 s, Siêu khó ≥ 1,00 s chỉ chạm Khó ở biên). Siêu khó còn ~42 câu đúng mỗi vòng (≫ 8).

**Ngoại lệ quy tắc "1–8 giây mỗi câu"** ([GDD](../01-product/game-design.md#quy-tắc-thiết-kế-một-minigame-mới)), **đã chốt 2026-10-20**: mỗi câu ở Thường chỉ ~0,7 s. Đây là bản chất game phản xạ; thưởng tốc độ nằm ở **số bia trúng mỗi vòng** chứ không ở điểm từng câu (xem dưới).

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `aimTrainer`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 2,52 → min(2,52; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **1,75** | không khai báo | Mô phỏng cần 1,75 |
| Siêu khó | **2,55** | không khai báo | Mô phỏng cần 2,53, làm tròn tới 0,05 |

- **Thưởng tốc độ:** gần như mọi bia trúng trong ≤ 1,5 s nên luôn được trọn 50 điểm; người nhanh hơn được thưởng bằng cách trúng nhiều bia hơn trong 60 s. `speedAllowanceMs` không cần (bia hiện là chạm được ngay). Đã cân nhắc thêm "hệ số tốc độ riêng theo game" nhưng phải đổi `scoring.ts` cho mọi game: không đề xuất.
- Cách mô phỏng (200 000 vòng 60 s mỗi mức, như Bóng của ai): thời gian mỗi bia đều trong khoảng ở bảng; bỏ lỡ tốn trọn `lifeMs`, bắn mồi tốn thời gian ngắm; sai khoá 1,5 s; bia mới hiện ngay (0–0,05 s). Điểm theo `scoring.ts` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 38,9 · 0 | 5 632 | 2 757 | 2,52 | 1 | ~8 390 (49 %) |
| Người lớn · Thường | 78,5 · 1,6 | 11 306 | 5 653 | 1 | 1 | ~16 960 (100 %) |
| Người lớn · Khó | 54,4 · 2,8 | 7 523 | 3 762 | 1,75 | 1,75 | ~16 930 (100 %) |
| Người lớn · Siêu khó | 41,9 · 3,6 | 5 590 | 2 795 | 2,53 | 2,55 | ~17 050 (101 %) |
| Người lớn chọn Mầm | 103,9 · 0 | 15 385 | 7 692 | 0,60 | 1 | ~23 080 (136 %) |

- Điểm vòng (~17 000) gấp ~4 lần các game khác (~4 300) vì số câu nhiều. Trong phòng party không sao (điểm trận theo thứ hạng trong vòng, mọi người cùng game); bảng xếp hạng từng minigame chỉ so trong game này. Đã chốt (mục Câu hỏi đã chốt, 1).
- Trẻ 7 tuổi ở Mầm chỉ được ~49 % người lớn ở Thường vì trần hệ số Mầm = 1 (quy tắc chung). Người lớn chọn Mầm được 136 %, nhẹ hơn các game Nhận diện khác (Bóng của ai 213 %).
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **8 350** (đã đăng ký; `BRAIN_TEST_RULES_VERSION` lên 3, chung với Phấn trượt). Theo cách của GDD: 4 000 lượt người lớn ở Thường, 30 s của nhóm Nhận diện, thời gian mỗi bia đều ±20 % quanh 0,675 s, tỉ lệ sai 2 % (bỏ lỡ tốn trọn 1,5 s rồi khoá 1,5 s), giữa hai bia 0–0,05 s: ~39,8 bia · 39,1 trúng, trung bình 8 310–8 330 điểm tuỳ luồng ngẫu nhiên. Người nhanh hơn 30 % được × 1,38, chậm hơn 40 % được × 0,72 (tương đương các game khác). Script mô phỏng không lưu trong repo.

Núm chỉnh sau chơi thử (chỉ sửa số trong `aim-trainer.ts`, rồi tính lại hệ số):

1. Điện thoại thua máy tính rõ ở Khó/Siêu khó: tăng dung sai `hitR − r` từ 25 lên 35 (cho mọi người).
2. Thường quá dễ (gần như không bỏ lỡ): giảm `lifeMs` Thường còn 1 200 ms.
3. Siêu khó bắn mồi > 10 %: mồi cách bia ≥ 300 thay vì 220.

## Ghi chú cho FE

Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Khung chơi | x 36–684, y 250–1157 (648 × 907 px = 1 000 × 1 400 đơn vị, **0,648 px/đơn vị**) | Giấy hoặc phấn tối, viền trong cam Nhận diện |
| Chip "trúng + ms TB" (đã chốt) | trên khung, y 150–230, lệch trái/phải | Số bia trúng trong vòng và thời gian trung bình mỗi bia (ms), vd. "23 trúng · 612 ms"; không đặt ở dải giữa trên cùng (huy hiệu khoá). Thời gian đo bằng đồng hồ scene, chỉ để hiển thị |
| Thanh khoá | 420×14 tại (150, 1206) | Khi sai hoặc bỏ lỡ |

- **Đổi toạ độ:** `ux = round((px − 36) / 0.648)`, `uy = round((py − 250) / 0.648)`, kẹp vào khung. Lấy toạ độ ở **pointerdown** (cả chuột lẫn chạm), chỉ con trỏ đầu tiên; bỏ qua cảm ứng đa điểm.
- **Gửi:** gọi `aimTrainerHitTest(puzzle, ux, uy)` export từ shared (không tự viết lại công thức), trả `"target" | "decoy" | "none"`. `target` → gửi `{ x: ux, y: uy }`, đúng. `decoy` → gửi, sai. `none` → không gửi, không tính sai, vẽ chấm phấn nhỏ tan trong 200 ms (phản hồi "hụt").
- Cỡ trên màn: bia Siêu khó vẽ đường kính 71 px thiết kế (~39 px CSS trên điện thoại 390), vùng chấm 104 px thiết kế (~56 px CSS, ≥ 48).
- **Bia thật:** hồng tâm 3 vòng đồng tâm (trắng ngà / cam Nhận diện / chấm giữa vàng `--primary`), viền tròn trơn nét mực. **Bia mồi:** đĩa đỏ sẫm (`--destructive`, tối hơn bia thật rõ rệt), **viền răng cưa** (mép khía như bánh răng / tem bưu chính, ~16 khía), có dấu X trắng dày, không có vòng đồng tâm. Răng cưa nằm trong bán kính `r` (không làm bia mồi trông to hơn bia thật) và co theo bia ở Khó/Siêu khó. Phân biệt bằng **hình (vòng tròn trơn vs viền răng cưa + X) và độ sáng**, không chỉ bằng màu.
- **Đồng hồ:** Thường vẽ cung phấn quanh bia giảm dần theo `lifeMs`. Khó/Siêu khó: đĩa co tuyến tính từ `r` về `shrinkTo` %, vòng mờ nét đứt cỡ `r` giữ nguyên (vùng chấm). Mầm không có đồng hồ; bia đứng quá 3 s thì nhịp nhẹ để trẻ chú ý.
- **Bỏ lỡ:** đúng `lifeMs` kể từ lúc bia hiện (đồng hồ scene), gửi `AIM_TRAINER_MISS` (`{ x: −1, y: −1 }`). Server tự chấm sai đáp án tới muộn hơn `lifeMs` + 400 ms nên scene không cần chặn thêm.
- **Mất kết nối giữa vòng:** scene dừng đồng hồ bia (bia đứng hình dưới lớp "mất kết nối"), không nhận chạm, không gửi bỏ lỡ (SDK xếp hàng tin gửi lúc rớt mạng rồi phát khi nối lại, server sẽ lệch câu). Nối lại xong (state đầy đủ của server đã về) thì hiện bia của câu `progress` theo server với đồng hồ bia đếm lại từ đầu, khớp `AnswerJudge.resume` phía server; server còn khoá sau câu trước bị chấm sai thì hiện câu đó như bỏ lỡ tới hết khoá. Dùng `bridge.watchConnection` (`features/play/connection-sync.ts`), game có đồng hồ riêng khác (Đập đúng hình) dùng lại được.
- **Chip "trúng + ms TB"** chỉ đếm câu server đã chấm đúng (`answerResult`), cộng sau khi kết quả về; nhãn ms vẫn hiện ngay lúc chạm.
- **Nhãn ms sau mỗi lần trúng** (đã chốt): số ms của bia vừa trúng (vd. "540 ms") bật lên tại chỗ bia cũ, bay lên và tan trong ~600 ms; không chặn chạm. Giảm chuyển động: hiện tĩnh rồi tắt.
- Rê chuột: con trỏ hình tâm ngắm (crosshair) trong khung.
- Nền tối: khung `#2f2a52`, bia vẫn sáng trên đĩa giấy nên nổi rõ; bia mồi thêm viền phấn để không chìm.

| Trạng thái | Hiển thị |
| --- | --- |
| Bia hiện | Bật từ 80 % lên 100 % trong 80 ms; chạm được ngay, `lifeMs` đếm từ lúc bắt đầu bật |
| Trúng | Gửi ngay; sao vàng bung tại chỗ cũ 200 ms, **bia mới hiện ngay cùng khung hình** |
| Bắn mồi (sai) | Mồi rung, X đỏ; xem mục dưới |
| Bỏ lỡ | Bia mờ 50 % trong vòng vàng nét đứt + biểu tượng đồng hồ; xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`: bia thật hiện lại đủ cỡ `r` trong vòng vàng (`--primary`) dày, nhấp nháy nhẹ; bia mồi bị bắn có X đỏ viền trắng; mồi còn lại mờ 35 %. Bỏ lỡ: bia thật hiện mờ 50 % trong vòng vàng nét đứt + đồng hồ. Mọi bia nằm trong khung (y ≥ 250), không bị huy hiệu khoá che. Hết khoá thì bia câu kế hiện.

### Hiệu ứng

Bung sao 200 ms, rung mồi 200 ms, bật bia 80 ms, nhãn ms bay lên ~600 ms. Giảm chuyển động (`prefersReducedMotion()` của `@/features/motion`, đã gồm nút Hiệu ứng trong cài đặt lẫn tuỳ chọn hệ điều hành): bia hiện/ẩn tức thì, bỏ bung sao và rung; **đồng hồ (co dần, cung giờ) giữ nguyên** vì là luật chơi. Âm: "tách" ngắn khi trúng (cao dần theo combo), "bụp" trầm khi bắn mồi, tiếng tích tắc nhẹ ở 300 ms cuối của bia (tuỳ chọn).

## Ghi chú cho BE

- `Answer` là object `{ x, y }` (không phải số như các game khác); `isAnswer` kiểm. Giao thức đã cho `answer: z.unknown()` nên không đổi schema.
- Nhịp gửi: ~1,3–2 đáp án/giây ở Thường, dưới giới hạn `MAX_ANSWERS_PER_SECOND` = 10.
- **Hạn trả lời (đã làm, 2026-10-20):** `MinigameDef` có hook tuỳ chọn `answerWindowMs?(puzzle, difficulty): number | undefined` (`games/types.ts`); `gameAnswerWindowMs` trong `answer-judge.ts` kẹp giá trị không hợp lệ về "không giới hạn". Luyện ngắm trả `lifeMs` (Mầm: `undefined`). `judgeAnswer` chấm **sai như bỏ lỡ** khi `now − shownAt > answerWindowMs + LATE_ANSWER_GRACE_MS` (400 ms), dù `check` đúng; khoá và mất chuỗi như câu sai thường. `shownAt` là lúc server nhận đáp án câu trước (hoặc lúc hết khoá; câu 0 là `startAt`), lệch với lúc bia hiện trên máy chỉ bằng chênh lệch độ trễ hai chiều. Vì `judgeAnswer` dùng chung nên phòng party, Kiểm tra não và Luyện tập đều áp dụng, không đổi tin nhắn hay schema. Game cũ không khai báo hook nên chấm như trước. Đập đúng hình (`whack-right`) chỉ cần khai báo hook.
- Bot giải được trivially (client biết seed, NFR-SEC-02); game này dễ bị bot hơn các game khác vì đáp án chỉ là toạ độ. Chấp nhận như hạn chế đã biết.

## Tác động Kiểm tra não

Đăng ký game là thêm game vào nhóm Nhận diện (Kẻ lạc đàn, Bóng của ai, Luyện ngắm, và Đập đúng hình khi có): xác suất bốc mỗi game đổi từ 1/2 thành 1/3 (hoặc 1/4). Theo quy tắc ở [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não), **đã làm (2026-10-20):** `BRAIN_TEST_RULES_VERSION` tăng 2 → 3 (một lần chung cho Luyện ngắm và Phấn trượt, có comment lý do), điểm chuẩn **8 350** thay số giữ chỗ 1 500, thêm dòng vào bảng điểm chuẩn ở GDD.

## Câu hỏi đã chốt

Chủ dự án chốt mọi đề xuất ngày 2026-10-20 (sau CR-012 chốt nhóm, cơ chế và mồi đỏ ở Siêu khó):

1. **Ngoại lệ "1–8 giây mỗi câu"** (~0,7 s/câu ở Thường) **và điểm vòng ~17 000** (gấp ~4 lần game khác): *Đã chốt:* chấp nhận cả hai. Không làm phương án "một câu = loạt 3 bia".
2. **Chạm hụt vào chỗ trống:** *Đã chốt:* không gửi, không tính sai.
3. **Server kiểm hạn trả lời:** *Đã chốt:* hook chung `answerWindowMs` trong `MinigameDef`, server chấm sai khi đáp án tới muộn hơn lúc câu bắt đầu + `lifeMs` + 400 ms (đồng hồ server); bỏ lỡ `{ −1, −1 }` = sai. Đã làm cùng bộ sinh (xem Ghi chú cho BE).
4. **Vùng chấm cố định khi bia co:** *Đã chốt:* cố định `hitR`, có vòng mờ cỡ ban đầu.
5. **Siêu khó:** *Đã chốt:* tồn tại 1 500 ms, co dần, 1–2 mồi đỏ (đĩa đỏ sẫm có ✕, viền răng cưa).
6. **Công bằng điện thoại / máy tính:** *Đã chốt:* một dung sai chung +25 đơn vị, không phân biệt thiết bị. Núm chỉnh 1 dùng nếu chơi thử thấy điện thoại thua rõ.
7. **Trẻ 7 tuổi ở Mầm:** *Đã chốt:* theo luật chung (trần hệ số Mầm = 1), không có hệ số riêng.
8. **Chip "trúng + ms TB" và nhãn ms (~600 ms) sau mỗi lần trúng:** *Đã chốt:* giữ cả hai. Chữ hiển thị do frontend-dev thêm vào `locales.ts`.
