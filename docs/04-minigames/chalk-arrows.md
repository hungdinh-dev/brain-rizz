# Phấn trượt (`chalk-arrows`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/chalk-arrows/` (logic + test), `apps/web/src/games/chalk-arrows/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M17** (ui-designer đang vẽ lại theo chủ đề Phấn trượt; nếu bản mẫu khác đặc tả thì đặc tả này thắng về luật và con số, bản mẫu thắng về hình).
- Tham khảo cơ chế: kiểu "Ebb and Flow" (đổi luật theo màu, rèn linh hoạt nhận thức). Chủ đề mũi tên phấn trên bảng, tên, màu, nét vẽ là của Brain Rizz; không dùng lá hay mặt nước.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đặc tả **đã chốt** (chủ dự án, 2026-10-20, mọi câu hỏi mở). Đã có bộ sinh câu đố + test 10 000 seed, scene Phaser `ChalkArrowsScene`, màn hướng dẫn, chữ vi/en, đã đăng ký trong registry và Kiểm tra não (điểm chuẩn 4 900, `BRAIN_TEST_RULES_VERSION` 3); còn QA và buổi chơi thử trên máy thật. Số mũi tên, tốc độ, tỉ lệ và hệ số chỉnh lại sau chơi thử.

**Lịch sử:** 2026-10-20 đổi chủ đề từ **Lá theo dòng** (`leaf-flow`) sang **Phấn trượt** (`chalk-arrows`) theo [CR-012](../00-tracking/change-requests.md#cr-012), vì hình lá trôi trên mặt nước quá giống "Ebb and Flow" của Lumosity. Chỉ đổi hình và tên; cơ chế, bộ sinh, tỉ lệ, hệ số điểm và điểm chuẩn giữ nguyên.

## Cách chơi

Một nhóm mũi tên vẽ bằng phấn trượt trên bảng. Mọi mũi tên trong nhóm cùng màu, cùng hướng chỉ, cùng hướng trượt. **Phấn trắng (nét liền)** → vuốt theo hướng **mũi tên chỉ**. **Phấn vàng (nét đôi)** → vuốt theo hướng **mũi tên trượt**. Ở Siêu khó có thêm vài mũi tên bị tẩy mờ: bỏ qua.

## Màn hướng dẫn

- **Cách chơi:**
  1. Phấn trắng: vuốt theo mũi tên chỉ
  2. Phấn vàng: vuốt theo hướng trượt
  3. Nhìn màu phấn trước rồi vuốt
- **Điều khiển:** Vuốt lên/xuống/trái/phải hoặc chạm 4 nút mũi tên (điện thoại) · Phím mũi tên, phím W A S D hoặc click 4 nút (máy tính).
- **Hình minh hoạ:** hai ô bảng phấn cạnh nhau. Ô trái: ba mũi tên phấn trắng nét liền chỉ lên, vệt bụi phấn phía sau cho thấy đang trượt sang phải; nút "lên" sáng + dấu tích, nút "phải" mờ gạch chéo. Ô phải: ba mũi tên phấn vàng nét đôi (thân là hai nét song song) chỉ lên, trượt sang phải; nút "phải" sáng + dấu tích, nút "lên" mờ gạch chéo. Dưới mỗi ô: biểu tượng nhỏ "mũi tên chỉ" (nét liền) và "vệt trượt" (nét đôi + bụi phấn).
- **Câu nhắc lúc đếm ngược:** "Trắng theo mũi, vàng theo trượt!"
- **Câu nhắc theo mức:** Mầm "Chỉ phấn trắng: vuốt theo mũi" · Khó "Màu đổi liên tục, nhìn kỹ!" · Siêu khó "Mũi tên mờ thì bỏ qua!".
- **Gợi ý cạnh từng mức:** Mầm "5 mũi tên trắng · chậm" · Thường "7 mũi tên · hai màu" · Khó "10 mũi tên · hay ngược chiều" · Siêu khó "Trượt nhanh · có nét tẩy mờ".

## Câu đố & đáp án

Hướng (`Dir`): **0 lên, 1 phải, 2 xuống, 3 trái** (theo chiều kim đồng hồ). Ngược hướng = `(d + 2) mod 4`, vuông góc = `(d ± 1) mod 4`.

**Khung bảng** (hằng số export từ shared: `CHALK_FIELD`, kích thước mũi tên `CHALK_ARROW_SIZE`, bảng mức `CHALK_ARROWS_LEVELS`; màu câu tính riêng được bằng `chalkArrowsColor(seed, index, difficulty)`): **1 000 × 1 200 đơn vị**, gốc góc trên trái, chia lưới **5 × 6 ô**, mỗi ô 200 × 200. Bảng nối vòng (mũi tên trượt ra mép này thì vào lại từ mép đối diện).

- `Puzzle` (`ChalkArrowsPuzzle`, hướng kiểu `ChalkDir`, màu kiểu `ChalkColor`):
  - `color`: `"white" | "yellow"`: màu phấn của mọi mũi tên rõ trong câu.
  - `point`: `Dir`: hướng mũi tên chỉ (của mọi mũi tên rõ).
  - `slide`: `Dir`: hướng trượt của mọi mũi tên rõ.
  - `speed`: tốc độ trượt (đơn vị khung/giây, số nguyên), chung cho mọi mũi tên.
  - `arrows: { x, y }[]`: vị trí lúc câu hiện của các mũi tên rõ (số nguyên).
  - `smudges: { x, y, point, slide }[]`: mũi tên bị tẩy mờ (nhiễu), mỗi cái có hướng riêng. Rỗng trừ Siêu khó.
  - `subtle`: `boolean`: dùng bảng màu "gần nhau" (Siêu khó).
  - `answer`: `Dir` = `color === "white" ? point : slide`.
- `Answer`: `number`, số nguyên 0–3. Gửi một lần mỗi câu. `check`: đúng khi `answer === puzzle.answer`. `isAnswer`: số nguyên 0–3.

**Nhiễu (Siêu khó) = mũi tên bị tẩy mờ.** Nét phấn nhoè như vừa bị khăn lau quệt qua, độ mờ thấp, không phân biệt trắng/vàng, vẽ **dưới** mũi tên rõ; mỗi cái có hướng chỉ và hướng trượt ngẫu nhiên riêng. Luật không bao giờ xét mũi tên tẩy mờ, nên đáp án chỉ do mũi tên rõ quyết định, mà mọi mũi tên rõ đồng nhất màu và hướng → đúng một đáp án. Nét tẩy mờ chỉ làm rối mắt (trượt lộn xộn, chỉ lung tung). Không dùng phương án "vài mũi tên rõ lệch hướng, theo số đông" vì cần đếm và dễ có câu nhập nhằng.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`. Số lần gọi `rng` cố định theo mức, không vòng thử lại.
2. **Màu** (từ Thường): chuỗi đổi màu riêng, không phụ thuộc `rng` của câu. Màu câu 0 = `createRng(deriveSeed(seed, 0, SALT_COLOR)).int(0, 1)`; với mỗi `j = 1 … index`, câu `j` **đổi màu** so với câu `j − 1` khi `createRng(deriveSeed(seed, j, SALT_COLOR)).int(0, 99) < switchPct`. Màu câu `index` = màu câu 0 XOR (số lần đổi, mod 2). Chi phí O(index), index ≤ ~60 mỗi vòng nên không đáng kể; nhờ vậy tỉ lệ đổi màu giữa hai câu liền nhau đúng bằng `switchPct`, còn tỉ lệ trắng/vàng tổng thể ~50/50. Mầm: luôn trắng.
3. `point = rng.int(0, 3)`.
4. **Quan hệ hai hướng:** `u = rng.int(0, 99)` so với bảng mức → trùng (`slide = point`), vuông góc (`slide = point ± 1`, dấu bằng `rng.int(0, 1)`, luôn gọi để số lần gọi cố định), hoặc ngược (`slide = point + 2`).
5. **Vị trí:** `rng.shuffle` 30 ô của lưới, lấy `n` ô đầu cho mũi tên rõ, `m` ô kế cho mũi tên tẩy mờ. Tâm mũi tên = tâm ô + lệch `rng.int(−30, 30)` mỗi trục. Hai mũi tên ở hai ô khác nhau thì tâm cách nhau ≥ 140 đơn vị theo ít nhất một trục (kể cả qua mép nối vòng), mũi tên dài 120 nên không chồng nhau lúc hiện; mũi tên rõ trượt cùng vận tốc nên giữ nguyên khoảng cách suốt câu.
6. **Mũi tên tẩy mờ** (Siêu khó): `point`, `slide` mỗi cái = `rng.int(0, 3)`, độc lập.
7. `answer = color === "white" ? point : slide`.

**Vì sao đúng một đáp án:** mọi mũi tên rõ cùng `color`, `point`, `slide`; luật chỉ đọc mũi tên rõ; `answer` là một hướng duy nhất trong 4. Ba hướng còn lại đều sai.

## Độ khó

| Mức | Mũi tên rõ | Tẩy mờ | Tốc độ (đv/s) | Trắng / vàng | Đổi màu giữa 2 câu liền (`switchPct`) | Trùng / vuông góc / ngược | Bảng màu |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | 5 | 0 | 100 | 100 / 0 | 0 % | 60 / 40 / 0 | rõ |
| Thường | 7 | 0 | 160 | ~50 / 50 | 30 % | 50 / 30 / 20 | rõ |
| Khó | 10 | 0 | 200 | ~50 / 50 | 60 % | 10 / 30 / 60 | rõ |
| Siêu khó | 10 | 3 | 320 | ~50 / 50 | 60 % | 10 / 40 / 50 | gần nhau (`subtle`) |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Ít mũi tên trắng trượt chậm, đôi khi trượt ngang so với hướng chỉ; chỉ cần theo mũi tên |
| Thường | Có cả phấn trắng và vàng, màu thường giữ vài câu liền; một nửa số câu hai hướng trùng nhau nên lỡ quên luật vẫn đúng |
| Khó | Màu đổi gần như mỗi câu, đa số câu hướng chỉ và hướng trượt ngược nhau: bắt buộc nhớ luật |
| Siêu khó | Mũi tên trượt nhanh, trắng ngà / vàng nhạt gần nhau hơn (vẫn tách bằng nét liền / nét đôi), nét tẩy mờ trượt lung tung ở dưới |

Tốc độ: khung rộng 1 000 đơn vị nên Mầm trượt hết bề ngang trong 10 s, Siêu khó trong ~3 s.

**Độ khó đo được** (bộ sinh thật `chalk-arrows.ts`, 10 000 seed × 12 câu liên tiếp mỗi mức, 2026-10-20):

| Mức | Câu xung đột (hai hướng khác nhau) | Câu ngược hướng | Đổi màu giữa 2 câu liền | Phấn vàng | Mũi tên trên bảng | Tốc độ |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 40,0 % | 0 % | 0 % | 0 % | 5 | 100 |
| Thường | 50,0 % | 20,1 % | 30,1 % | 50,2 % | 7 | 160 |
| Khó | 90,0 % | 60,0 % | 60,3 % | 50,0 % | 10 | 200 |
| Siêu khó | 90,0 % | 50,0 % | 60,3 % | 50,0 % | 13 (3 tẩy mờ) | 320 |

Mỗi bước lên mức tăng ít nhất một chỉ số và không chỉ số nào giảm (test `khó dần` kiểm đúng điều này; Siêu khó ít câu ngược hơn Khó một chút nhưng bù bằng vuông góc, tốc độ, màu gần và nét tẩy mờ; tỉ lệ xung đột bằng nhau). Đáp án phân bố đều 4 hướng (24,7–25,3 %).

## Đảm bảo khi sinh câu đố

- Đúng một đáp án: `answer` khớp luật màu (`white → point`, `yellow → slide`); `answer ∈ {0,1,2,3}`; `check` đúng với `answer` và sai với 3 hướng còn lại.
- Mầm: chỉ phấn trắng, không có quan hệ ngược. Từ Thường: tỉ lệ vàng 50 % (lệch < 3 %), tỉ lệ đổi màu giữa hai câu liền đúng `switchPct` (lệch < 3 %).
- Tỉ lệ trùng / vuông góc / ngược đúng bảng mức (lệch < 3 %).
- Số mũi tên rõ, số mũi tên tẩy mờ, `speed`, `subtle` đúng mức; mũi tên tẩy mờ chỉ có ở Siêu khó.
- Mọi mũi tên ở các ô khác nhau, tâm nằm trong khung, hai mũi tên bất kỳ cách nhau ≥ 140 theo ít nhất một trục (tính nối vòng).
- Đáp án phân bố đều 4 hướng (lệch < 5 %).
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random`/`Date.now`.

Các điều trên được kiểm trong `chalk-arrows.test.ts`: 10 000 seed × 12 câu liên tiếp × 4 độ khó (480 000 câu), thêm test màu câu không phụ thuộc thứ tự sinh và nét tẩy mờ không đổi đáp án. Chạy ~4,5 s.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian = nhìn màu (và kiểu nét) + đọc hướng cần dùng (bỏ qua hướng kia) + vuốt/bấm. Câu trùng hướng nhanh nhất, câu ngược chậm nhất và dễ sai nhất; bảng dưới đã tính theo tỉ lệ quan hệ của từng mức. Đổi chủ đề không đổi số liệu: mũi tên đọc hướng chỉ ít nhất nhanh bằng mũi lá, nên các con số dưới đây giữ nguyên và chỉ chỉnh sau chơi thử.

| Mức | Thời gian giải mỗi câu | Tỉ lệ sai | Số câu mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 1,8–2,8 s (người lớn 0,65–0,95 s) | 10 % (người lớn 3 %) | ~22 (19,6 đúng) |
| Thường | 0,9–1,4 s | 6 % | ~39 (36,8 đúng) |
| Khó | 1,4–2,0 s | 12 % | ~28 (24,4 đúng) |
| Siêu khó | 1,9–2,6 s | 15 % | ~22 (18,4 đúng) |

Các mức của người lớn không chồng nhau (Thường ≤ 1,4 s ≤ Khó ≤ 2,0 s; Siêu khó ≥ 1,9 s chỉ chạm Khó ở biên). Siêu khó còn ~18 câu đúng mỗi vòng (≥ 8). Thường nhiều câu hơn khuyến nghị 15–25 câu của GDD vì mỗi câu chỉ là một quyết định 4 hướng, giống Kẻ lạc đàn; vẫn trong khung 1–8 s mỗi câu (đã chốt giữ nguyên, mục 3 ở Câu hỏi mở).

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `chalkArrows`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 2,58 → min(2,58; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **1,95** | không khai báo | Mô phỏng cần 1,96, làm tròn tới 0,05 |
| Siêu khó | **2,9** | không khai báo | Mô phỏng cần 2,89, làm tròn tới 0,05 |

- `speedAllowanceMs`: không cần. Mũi tên trượt ngay từ khung hình đầu nên thấy được cả hai hướng ngay; không có pha trình chiếu.
- **Vuốt và phím:** bấm phím nhanh hơn vuốt ~0,1–0,2 s. Thưởng tốc độ chỉ giảm khi quá 1,5 s và giảm ~1 điểm mỗi 130 ms, nên chênh lệch ≤ 2 điểm mỗi câu; không bù riêng.
- Cách mô phỏng: như Luyện ngắm và Bóng của ai (200 000 vòng 60 s mỗi mức, thời gian đều trong khoảng, câu sai tốn thời gian như câu đúng rồi khoá 1,5 s, giữa hai câu 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau).

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 19,6 · 2,2 | 2 496 | 1 043 | 2,58 | 1 | ~3 540 (47 %) |
| Người lớn · Thường | 36,8 · 2,4 | 4 991 | 2 482 | 1 | 1 | ~7 470 (100 %) |
| Người lớn · Khó | 24,4 · 3,3 | 3 087 | 1 433 | 1,96 | 1,95 | ~7 450 (100 %) |
| Người lớn · Siêu khó | 18,4 · 3,2 | 2 258 | 955 | 2,89 | 2,9 | ~7 500 (100 %) |
| Người lớn chọn Mầm | 51,0 · 1,6 | 7 202 | 3 601 | 0,54 | 1 | ~10 800 (145 %) |

- Trẻ 7 tuổi ở Mầm được ~47 % người lớn ở Thường do trần hệ số Mầm = 1 (quy tắc chung; đã chốt, mục 6 ở Câu hỏi mở).
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **4 900**. Theo cách của GDD: 4 000 lượt người lớn ở Thường, 40 s của nhóm Phân tích, thời gian đều ±20 % quanh 1,15 s, sai 6 %, hiệu ứng 0,25–0,35 s: ~26 câu · 24,5 đúng, trung bình 4 893 điểm. Nhanh hơn 30 % được × 1,31, chậm hơn 40 % được × 0,74. Cao hơn các game Phân tích khác (1 400–2 100) vì nhiều câu hơn; `skillScore` quy về cùng thang nên không lệch Điểm Não. Script mô phỏng không lưu trong repo.
- **Đối chiếu khi viết code** (2026-10-20, cùng công thức `pointsForCorrect`, câu chưa xong khi hết giờ không tính): Kiểm tra não 20 000 lượt ra ~4 850 (24,2 đúng · 1,5 sai), lệch 1 % so với 4 900 nên giữ 4 900 như đã chốt; party 200 000 vòng ra m_d Khó 1,97, Siêu khó 2,90, trẻ Mầm 2,57: hệ số 1,95 / 2,9 / 1 giữ nguyên (lệch ≤ 1 % điểm vòng).

Núm chỉnh sau chơi thử (chỉ sửa số trong `chalk-arrows.ts`, rồi tính lại hệ số):

1. Thường quá dễ (gần như không sai): trùng 50 % → 35 %, thêm vào ngược.
2. Siêu khó sai > 25 %: tốc độ 320 → 260, hoặc mũi tên tẩy mờ 3 → 2.
3. Khó và Siêu khó quá gần: Siêu khó lên 12 mũi tên rõ.

## Ghi chú cho FE

Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Bảng | x 36–684, y 250–1028 (648 × 778 px = 1 000 × 1 200 đơn vị, **0,648 px/đơn vị**) | Mặt bảng màu `--board` có vết phấn cũ lau dở (tĩnh, rất nhạt); khung gỗ mỏng hoặc viền trong xanh dương Phân tích; cắt (mask) theo khung |
| Chip nhắc luật | trên bảng, y 190–236, căn giữa, rộng ≤ 360 | "Trắng → theo mũi · Vàng → theo trượt" kèm mẫu nét liền/nét đôi; **chỉ ở Mầm/Thường**, ẩn từ Khó (đã chốt, mục 7). Thấp hơn dải huy hiệu khoá |
| 4 nút hướng | hàng y 1050–1160, mỗi nút 140×110, tâm x 126 / 282 / 438 / 594: ← ↑ ↓ → | Nút phấn mũi tên; hiện ở cả điện thoại và máy tính |
| Thanh khoá | 420×14 tại (150, 1206) | Khi sai |

- **Vẽ mũi tên:** dài 120 × rộng 64 đơn vị (~78 × 41 px thiết kế), đầu tam giác ở phía `point`, đuôi phẳng. Đầu mũi tên phải đậm và to hơn thân để đọc hướng chỉ ngay cả khi trượt nhanh. Nét phấn có hạt: **vẽ sẵn thành texture** một lần khi scene tạo (mỗi loại nét × màu × `subtle`), không chạy filter mỗi khung hình (đã chốt, mục 9).
- **Trượt:** vị trí = vị trí đầu + `speed × t` theo `slide` (t tính từ lúc câu hiện, đồng hồ scene), lấy mod theo khung (nối vòng); mũi tên đi qua mép thì vẽ cả phần ló ở mép đối diện. Thêm **vệt bụi phấn** mờ kéo dài sau mũi tên theo hướng trượt (gợi ý hướng trượt, không lộ đáp án vì có ở cả hai màu).
- **Phân biệt màu, không chỉ bằng màu** (người mù màu): mỗi màu đi kèm một **kiểu nét** cố định.

| Loại | Màu (rõ) | Màu Siêu khó (`subtle`) | Nét |
| --- | --- | --- | --- |
| Phấn trắng → theo hướng chỉ | `#f6f3ea` (= `--chalk`), L\* 95,8 | trắng ngà `#efe3c2`, L\* 90,4 | **Nét liền**: thân một nét dày |
| Phấn vàng → theo hướng trượt | `#f2b632`, L\* 77,6 | vàng nhạt `#e3c35a`, L\* 79,7 | **Nét đôi**: thân là 2 nét song song với **khe hở giữa hai nét ~14 đơn vị** (tính mép trong, không phải từ tâm nét; khoảng 4–5 px trên điện thoại), đầu mũi tên chỉ vẽ viền (rỗng) |
| Tẩy mờ (nhiễu, Siêu khó) | `--chalk-muted`, độ mờ 30 %, nhoè (blur ~3 px), vết quệt ngang | như cột trái | Một nét mảnh đứt quãng, không đầu tô đặc; vẽ **dưới** mũi tên rõ |

  - Bảng thường: ΔL\* ≈ 18 giữa trắng và vàng. Siêu khó: ΔL\* ≈ 11 (gần nhau hơn nhưng vẫn thấy được), hue xích lại; nét liền / nét đôi giữ nguyên (Siêu khó vẫn dùng đủ, chỉ màu khó hơn).
  - Độ tương phản với mặt bảng (đồ hoạ cần ≥ 3 : 1): bảng sáng `#2d6a54` từ 3,5 : 1 (vàng `#f2b632`) tới 5,7 : 1 (trắng); bảng tối `#24203f` từ 8,5 : 1 tới 14 : 1. Bản `subtle` từ 3,7 : 1 trở lên trên cả hai bảng.
  - Vàng `#f2b632` cố ý sẫm hơn `--primary` (`#ffd166`) để không lẫn với màu sáng của nút/hướng đáp án. ui-designer chốt mã màu cuối; nếu đổi thì giữ ΔL\* ≥ 15 (rõ) / ≥ 10 (`subtle`) và tương phản ≥ 3 : 1 trên cả hai bảng.
- **Nhập:** vuốt bắt đầu ở bất kỳ đâu trong khung 720×1280: pointerdown → pointerup, quãng ≥ 40 px thiết kế và trục chính dài ≥ 1,3 lần trục kia thì nhận hướng; vuốt chéo không rõ thì bỏ qua (không gửi; đã chốt, mục 5). Chạm nút (quãng < 40 px) = chọn hướng của nút. Bàn phím: ← ↑ ↓ → và W A S D. Mỗi câu chỉ nhận một lần. Chi tiết bàn phím (chủ dự án yêu cầu 2026-10-20):
  - Nhận phím ở mọi thiết bị có bàn phím (cả máy tính bảng gắn phím), không chỉ khi màn rộng; `preventDefault` cho 4 phím mũi tên để trang không cuộn; bỏ qua phím lặp do giữ phím (`event.repeat`) và phím kèm Ctrl/Alt/Meta.
  - Không bắt phím khi con trỏ đang ở ô nhập chữ (vd ô chat) để không nuốt chữ người dùng gõ.
  - Trên máy tính, mỗi nút hướng hiện nhãn phím nhỏ (vd "← / A"); bấm phím thì nút tương ứng nhấp sáng như khi click, để người chơi thấy hệ thống đã nhận.
  - Màn hướng dẫn ghi "Phím mũi tên hoặc W A S D" ở dòng Điều khiển (bản máy tính).
- Rê chuột: nút nhấc 4 px.
- Nền tối: bảng `#24203f`; phấn trắng và vàng đều nổi rõ, không cần viền thêm; nét tẩy mờ giữ 30 %.

| Trạng thái | Hiển thị |
| --- | --- |
| Câu mới | Nhóm mũi tên hiện mờ → rõ trong 150 ms tại vị trí đầu (như vừa vẽ phấn) rồi trượt; nhận đáp án ngay |
| Đúng | Gửi ngay; nút/hướng vừa chọn sáng vàng, nhóm mũi tên vụt theo hướng đó ra khỏi bảng để lại bụi phấn; ~300 ms sau nhóm mới |
| Sai / khoá | Xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`: mũi tên dừng trượt; nút đúng sáng vàng (`--primary`) + dấu tích, nút vừa chọn X đỏ. Trên bảng, quanh mũi tên rõ gần tâm nhất: nếu phấn trắng thì khoanh **đầu mũi tên** bằng vòng và vẽ mũi tên chỉ dẫn theo `point`; nếu phấn vàng thì vẽ **mũi tên chỉ dẫn dọc vệt bụi phấn** theo `slide`; hướng còn lại hiện mũi tên mờ gạch chéo. Vòng và mũi tên chỉ dẫn vẽ trên một thẻ nền `--card` (như mẩu giấy dán lên bảng) để không lẫn với mũi tên phấn vàng. Nét tẩy mờ mờ thêm còn 15 %. Bảng và nút đều dưới y 250 (chip nhắc luật y ≥ 190 chỉ là chữ, có thể bị che), không bị huy hiệu khoá che phần đáp án.

### Hiệu ứng

Mũi tên vụt ra 250 ms, rung nút sai 200 ms, bụi phấn bay nhẹ khi đổi câu. Giảm chuyển động (`prefersReducedMotion()`): bỏ vụt, rung, bụi bay; **mũi tên vẫn trượt** vì hướng trượt là luật chơi (có thể giảm khung hình nhưng giữ đúng hướng và tốc độ), **vệt bụi phấn phía sau vẽ tĩnh và đậm hơn** bản thường (là gợi ý hướng, không phải trang trí); mũi tên tẩy mờ ở Siêu khó vẫn trượt, mỗi cái một hướng. Không làm chế độ "đứng yên" thay cho trượt (đã chốt, mục 8). Âm: tiếng phấn "két" ngắn khi đúng, "bụp" trầm khi sai.

## Ghi chú cho BE

Không. Đáp án một số nguyên 0–3, chấm một lần mỗi câu như Kẻ lạc đàn. Màu câu phụ thuộc chuỗi đổi màu từ câu 0 (O(index) lần tạo `createRng` nhỏ), vẫn tất định và rẻ. Game này không cần hook `answerWindowMs` (đề xuất cho Luyện ngắm và Đập đúng hình).

## Tác động Kiểm tra não

Nhóm Phân tích lên 4 game (Cân não, Đếm khối, Bi rơi đâu, Phấn trượt): xác suất bốc mỗi game 1/3 → 1/4. Theo quy tắc ở [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não), commit đăng ký phải **tăng `BRAIN_TEST_RULES_VERSION`** kèm comment lý do, thay số giữ chỗ 1 500 bằng điểm chuẩn **4 900**, và thêm dòng vào bảng điểm chuẩn ở GDD.

**Đã làm (2026-10-20):** `BRAIN_TEST_REFERENCE_SCORE["chalk-arrows"] = 4900`; `BRAIN_TEST_RULES_VERSION` 2 → **3**, chung một lần tăng với Luyện ngắm (comment ghi lý do cả hai game, CR-012); đã thêm dòng vào bảng điểm chuẩn ở GDD.

## Câu hỏi mở

**Đã chốt hết** (chủ dự án, 2026-10-20). Qua CR-012: chủ đề **Phấn trượt** (mũi tên phấn trên bảng); nhiễu Siêu khó = **mũi tên bị tẩy mờ** bỏ qua (thay cho lá khô; luôn đúng một đáp án). Các mục dưới chốt theo đề xuất của game-designer:

1. **"Đổi màu liên tục" ở Khó** — *Đã chốt:* màu đổi **giữa hai câu liền nhau** 60 % (màu cố định trong một câu). Không đổi giữa chừng một câu vì server không biết người chơi thấy màu nào lúc vuốt.
2. **Siêu khó vẫn 10 mũi tên rõ như Khó** (khó thêm bằng tốc độ, màu gần, nét tẩy mờ). *Đã chốt.* Báo ui-designer nếu bản mẫu M17 khác.
3. **Thường ~37 câu đúng mỗi vòng**, nhiều hơn khuyến nghị 15–25 của GDD — *Đã chốt:* giữ nguyên.
4. **Mã màu** trắng `#f6f3ea` / vàng `#f2b632`, Siêu khó trắng ngà `#efe3c2` / vàng nhạt `#e3c35a` — ui-designer chốt mã cuối khi vẽ lại M17 (giữ các ràng buộc ΔL\* và tương phản ở Ghi chú cho FE).
5. **Vuốt chéo không rõ hướng** — *Đã chốt:* bỏ qua, không gửi.
6. **Trẻ 7 tuổi ở Mầm** — *Đã chốt:* theo luật chung (trần hệ số Mầm = 1), không có hệ số riêng.
7. **Chip nhắc luật** ("Trắng → theo mũi · Vàng → theo trượt") — *Đã chốt:* chỉ hiện ở Mầm/Thường; ẩn từ Khó.
8. **Chế độ đứng yên cho người bật giảm chuyển động** — *Đã chốt:* không làm. Mũi tên vẫn trượt (là luật), chỉ bỏ hiệu ứng phụ; vệt bụi phấn tĩnh vẽ **đậm hơn** để hướng trượt dễ đọc. Mũi tên tẩy mờ ở Siêu khó vẫn trượt, mỗi cái một hướng. Máy chủ dự án đang bật giảm chuyển động nên sẽ thấy đúng bản này.
9. **Điều khiển** — *Đã chốt:* điện thoại vuốt hoặc 4 nút; máy tính phím mũi tên (và W A S D) + 4 nút. Nét phấn có hạt vẽ sẵn thành texture trong Phaser (không filter mỗi khung hình).
