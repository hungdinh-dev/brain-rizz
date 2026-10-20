# Bóng của ai (`shadow-match`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/shadow-match/` (`items.ts` bộ vật, `shadow-match.ts` bộ sinh, test), `apps/web/src/games/shadow-match/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M14** (ShadowMatchMobile bấm thử được, ShadowMatchLevels, ShadowMatchStates, ShadowMatchHowTo).

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Bộ sinh + test 10 000 seed, scene, art, màn hướng dẫn, chữ vi/en xong, đã đăng ký (party, Luyện tập, Kiểm tra não); chờ QA và buổi chơi thử để chốt hệ số điểm và thời gian giải.

## Cách chơi

Trên cùng là một đồ vật có màu. Bên dưới là các bóng đen: chạm vào bóng có đúng hình dạng của đồ vật đó. Bóng có thể bị xoay hoặc lật, nhưng hình dạng phải giống hệt.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn đồ vật có màu
  2. Tìm bóng giống hệt hình dạng
  3. Bóng xoay hay lật vẫn đúng
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** theo artboard ShadowMatchHowTo (560×360). Nửa trái (biểu tượng mắt): thẻ giấy có ấm trà màu xanh. Mũi tên phấn. Nửa phải (biểu tượng ngón tay): ba bóng đen trên thẻ phấn (ấm không vòi, ấm đúng, cây xương rồng); ngón tay chạm bóng ấm đúng, có vòng vàng. Góc dưới phải: bóng ấm → mũi tên xoay → cùng bóng nằm ngang, chữ "90°".
- **Câu nhắc lúc đếm ngược:** "Bóng nào của đồ vật?"
- **Câu nhắc theo mức:** Khó "Bóng có thể bị xoay!" · Siêu khó "Bóng xoay và lật, soi chi tiết!".
- **Gợi ý cạnh từng mức:** Mầm "3 bóng" · Thường "4 bóng" · Khó "6 bóng · xoay" · Siêu khó "6 bóng · xoay + lật".

## Luật đã chốt

- **Bóng lật gương của ĐÚNG vật vẫn là ĐÚNG** (chủ dự án chốt: lật coi như xoay). Vì vậy mồi luôn phải khác về **hình** (thiếu, thừa hoặc đổi một phần), không bao giờ chỉ khác hướng.
- Bộ vật không có biến thể nào là ảnh gương của hình gốc hay của biến thể khác cùng vật (test kiểm).

## Câu đố & đáp án

- `ShadowMatchPuzzle`:
  - `item: ShadowItem`: đồ vật có màu ở thẻ đề, luôn vẽ hình gốc, thẳng đứng, không lật.
  - `options: ShadowMatchOption[]`: 3 / 4 / 6 / 6 bóng theo thứ tự ô (trái → phải, trên → dưới). Mỗi bóng `{ item, variant, rotation, flipped }`: `variant` 0 là hình gốc, 1–2 mồi chi tiết lớn, 3–6 mồi chi tiết nhỏ; `rotation` ∈ {0, 90, 180, 270} (độ, chiều kim đồng hồ); `flipped` = lật gương ngang.
  - `answerIndex`: ô của bóng đúng (bóng duy nhất có `item = puzzle.item` và `variant = 0`).
- `Answer`: `number`, chỉ số ô chạm, gửi một lần mỗi câu. `check`: đúng khi `answer === answerIndex`. `isAnswer`: số nguyên 0–5.
- Hàm phụ cho FE (export từ shared): `shadowParts(item, variant)` danh sách khoá phần hình cần vẽ; `shadowDiff(item, variant)` phần thiếu/thừa so với hình gốc (để khoanh chi tiết khi sai); `shadowDetailSize`; `shadowMatchItem(seed, index)`.

## Bộ vật

Mỗi vật là danh sách **phần hình** dạng `"<tên>@<phía>"` (`@L`/`@R` = nằm hoặc quay về trái/phải, `@C` = tự đối xứng). Lật gương cả vật = đổi mọi `@L` ↔ `@R`; xoay không đổi danh sách phần. Hai bóng cùng vật trông giống hệt nhau (sau xoay/lật) khi và chỉ khi danh sách phần bằng nhau, trực tiếp hoặc sau khi đổi phía. Dữ liệu: `SHADOW_ITEM_DEFS` trong `items.ts`.

8 vật × 7 biến thể (1 gốc + 2 mồi lớn + 4 mồi nhỏ):

| Vật | Hình gốc | Mồi lớn (1, 2) | Mồi nhỏ (3–6) |
| --- | --- | --- | --- |
| Ấm trà `teapot` | thân, nắp, núm, đế, vòi phải, quai trái | mất vòi · mất quai | mất núm · vòi ngắn · mất đế · nắp cao |
| Cá `fish` | quay phải, đuôi chẻ, vây lưng, vây bụng, vây hậu môn | mất đuôi · mất vây lưng | mất vây bụng · mất vây hậu môn · đuôi tròn · vây lưng nhỏ |
| Mèo `cat` | ngồi, 2 tai, đuôi cong phải, ria | mất đuôi · mất cả hai tai | mất ria · mất tai trái · đuôi ngắn · thêm chuông |
| Xương rồng `cactus` | chậu loe, thân, nhánh cao trái, nhánh thấp phải, hoa | mất nhánh cao · mất nhánh thấp | mất hoa · chậu thẳng · nhánh cao ngắn · thêm nụ phải |
| Ô `umbrella` | tán 4 múi, chóp, cán, móc phải, dây buộc trái | cán thẳng không móc · tán phẳng | mất chóp · mất dây buộc · móc nhỏ · dây buộc sang phải |
| Gà `chicken` | quay phải, mào, mỏ, yếm, đuôi trái, 2 chân | mất đuôi · cánh dang lên | mất mào · mất yếm · mỏ há · đứng một chân |
| Giày `shoe` | mũi phải, đế, thân, gờ gót trái, nơ dây | cổ cao như bốt · đế có gót cao | mất nơ dây · mất gờ gót · đinh dưới đế · dây thõng dài |
| Đèn bàn `lamp` | đế, cần gập + khớp + chụp hướng phải, nút và dây điện trái | cần thẳng đứng · đế cao khối | mất nút · mất khớp · mất dây điện · bóng đèn ló dưới chụp |

## Cách sinh câu đố

1. **Vật đề** (`shadowMatchItem`): mỗi khối 8 câu liên tiếp là một hoán vị của 8 vật (luồng `createRng(deriveSeed(seed, khối, muối))`), nối khối không để hai câu liền nhau trùng vật. Chỉ phụ thuộc (seed, index), không phụ thuộc mức.
2. `rng = createRng(deriveSeed(roundSeed, index))`, chọn mồi theo mức (bảng Độ khó). Số lần gọi `rng` cố định theo mức, không vòng thử lại.
3. Từ Khó: mỗi bóng (kể cả bóng đúng) nhận `rotation` ngẫu nhiên trong {90, 180, 270}, nên không bóng nào nằm thẳng để lộ đáp án. Siêu khó: thêm `flipped` ngẫu nhiên 50 %.
4. Xáo vị trí ô; `answerIndex` = ô của hình gốc.

**Vì sao đúng một đáp án:** mồi vật khác luôn khác hình; mồi cùng vật là biến thể có danh sách phần khác hình gốc cả trực tiếp lẫn sau khi lật (test kiểm cho mọi cặp biến thể), nên không mồi nào khớp đề dù xoay hay lật. Các biến thể trong một câu đôi một khác nhau nên cũng không có hai bóng giống nhau.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 bóng · đúng + hình gốc của 2 vật khác · không xoay | Ba dáng khác hẳn nhau |
| Thường | 4 bóng · đúng + 2 mồi lớn cùng vật + 1 vật khác · không xoay | Phải nhìn vòi, quai, đuôi |
| Khó | 6 bóng · đúng + 2 mồi lớn + 3/4 mồi nhỏ · mọi bóng xoay 90/180/270° | Xoay trong đầu rồi so chi tiết |
| Siêu khó | 6 bóng · đúng + 1/2 mồi lớn + cả 4 mồi nhỏ · xoay + lật gương | Chi tiết nhỏ trên bóng đã xoay lật |

Độ khó đo được (test, 10 000 seed): chênh lệch trung bình của mồi (vật khác 3, chi tiết lớn 2, chi tiết nhỏ 1) giảm **3 → 2,33 → 1,4 → 1,2**; số hướng vẽ khác nhau tăng **1 → 1 → 3 → 6**; số bóng **3 → 4 → 6 → 6**.

## Đảm bảo khi sinh câu đố

- Đúng một bóng khớp đồ vật đề khi xét mọi phép xoay 90°·k và lật gương; mọi bóng đôi một khác hình.
- Cấu trúc mồi đúng mức (bảng trên); mồi vật khác luôn là hình gốc.
- Mầm, Thường: không xoay, không lật. Khó: không lật, mọi bóng xoay ≠ 0. Siêu khó: góc xoay và lật phân bố đều (lệch < 5 %).
- Vị trí đáp án phân bố đều (lệch < 15 %).
- Mỗi khối 8 câu đủ 8 vật; hai câu liền nhau không trùng vật.
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random`/`Date.now`.

Tất cả nằm trong `shadow-match.test.ts` (10 000 seed × 4 mức).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Ước lượng trên giấy theo cách của Xoay hình: nhìn đề ~0,4 s + số lần so × thời gian so một bóng + chạm 0,3 s (số lần so trung bình ~1,7 với 3 bóng, ~2,3 với 4, ~3,3 với 6). So một bóng: ~0,3 s khác vật; ~0,4 s chi tiết lớn thẳng đứng; 0,7–1,0 s bóng xoay; 1,0–1,4 s bóng xoay + lật, chi tiết nhỏ.

| Mức | Thời gian giải mỗi câu | Tỉ lệ đúng | Số câu mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 1,8–2,8 s (người lớn 0,8–1,2 s) | 90 % (người lớn 97 %) | ~22 (~20 đúng) |
| Thường | 1,6–2,4 s | 92 % | ~25 (~23 đúng) |
| Khó | 3,0–4,2 s | 86 % | ~14 (~12 đúng) |
| Siêu khó | 4,0–5,5 s | 80 % | ~11 (~9 đúng) |

Các mức của người lớn không chồng nhau (Thường ≤ 2,4 s < Khó ≥ 3,0 s; Khó ≤ 4,2 s ≈ Siêu khó ≥ 4,0 s, chỉ chạm nhau ở biên). Siêu khó vẫn còn ~11 câu mỗi vòng (≥ 8).

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `shadowMatch`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 1,29 → min(1,29; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **2,55** | không khai báo | Mô phỏng cần 2,56, làm tròn tới 0,05 |
| Siêu khó | **4** | không khai báo | Mô phỏng cần 3,98, làm tròn tới 0,05 |

- `speedAllowanceMs`: không cần, câu hiện là chạm được ngay, một chạm là xong.
- Cách mô phỏng (200 000 vòng 60 s mỗi mức, như Xoay hình): thời gian giải phân bố đều trong khoảng ở bảng trên, đúng theo tỉ lệ ở bảng; câu đúng thêm 0,3 s hiệu ứng tính vào `answerMs` câu sau; câu sai khoá 1,5 s. Điểm theo `scoring.ts` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, giải m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 19,6 · 2,2 | 2 506 | 1 048 | 1,29 | 1 | ~3 550 (83 %) |
| Người lớn · Thường | 22,8 · 2,0 | 2 979 | 1 313 | 1 | 1 | ~4 290 (100 %) |
| Người lớn · Khó | 12,3 · 2,1 | 1 493 | 476 | 2,56 | 2,55 | ~4 280 (100 %) |
| Người lớn · Siêu khó | 8,8 · 2,2 | 1 018 | 237 | 3,98 | 4 | ~4 310 (100 %) |
| Người lớn chọn Mầm | 43,4 · 1,4 | 6 095 | 3 048 | 0,20 | 1 | ~9 140 (213 %) |

- Siêu khó cần hệ số cao hơn các game khác (Xoay hình 3,3) vì Thường của game này rất nhanh (~23 câu đúng mỗi vòng) nên mốc cao, trong khi Siêu khó chỉ ~9 câu đúng và thưởng tốc độ còn ~27 điểm mỗi câu.
- Người lớn chọn Mầm được ~213 %: Mầm quá dễ với người lớn, giống mọi game Nhận diện; hệ số Mầm đã ở trần 1. Script mô phỏng không lưu trong repo.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): **2 050**. Cùng cách mô phỏng (200 000 lượt, người lớn ở Thường) nhưng 30 s của nhóm Nhận diện: ~11,2 đúng · 1,0 sai, trung bình 2 027 điểm, làm tròn tới 50. Kiểm chứng: cùng script ở 60 s ra ~4 295, khớp bảng trên.

Núm chỉnh sau chơi thử (chỉ sửa số trong `shadow-match.ts`, rồi tính lại hệ số):

1. Siêu khó đúng < 70 %: đổi lại như Khó (2 mồi lớn + 3 mồi nhỏ) nhưng giữ lật.
2. Khó và Siêu khó quá gần: Siêu khó bỏ hẳn mồi lớn (cần thêm mồi nhỏ thứ 5 cho mỗi vật).
3. Thường quá dễ: thay mồi vật khác bằng một mồi nhỏ.

## Ghi chú cho FE

Bám bản mẫu M14. Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Thẻ đề | x 150–570, y 96–488 | Giấy, viền mực 5, viền trong cam Nhận diện (`--color-identify`), bóng sàn mờ; đồ vật có màu, scale 2 |
| Mũi tên | (360, 514–544) | Chữ V nét mực (nền tối: kem) |
| Khung lựa chọn | x 36–684, y 568–1180 | Giấy, viền mực, viền trong cam |
| Thẻ bóng | 3: 184×268, tâm x 150/360/570, y 874 · 4: 284×250, tâm x 204/516, y 740/1016 · 6: 184×250, tâm x 150/360/570, y 740/1016 | Nền giấy, bóng mực đặc (`--foreground` của thẻ) |
| Thanh khoá | 420×14 tại (150, 1206) | Chỉ khi sai |

- **Vẽ vật:** mỗi vật vẽ bằng đồ hoạ Phaser đơn giản (Graphics), phong cách bảng phấn, ghép từ các khoá phần hình trong `shadowParts(item, variant)`. Mỗi khoá là một hàm vẽ riêng; `@L`/`@R` của cùng tên phải là ảnh gương chính xác của nhau qua trục dọc giữa khung vẽ vật (điều kiện để "lật gương = đổi phía" đúng). Khung vẽ vật vuông, tâm ở giữa, để xoay 90° không tràn thẻ.
- **Thứ tự biến đổi:** vẽ thẳng → nếu `flipped` thì scaleX = −1 → xoay `rotation` độ chiều kim đồng hồ quanh tâm khung vẽ.
- Chi tiết khác nhau nhỏ nhất ≥ 20 đơn vị khung (~10 px trên điện thoại 390) sau khi thu vào thẻ bóng, nhất là núm nắp, vây bụng, chóp ô, nút đèn.
- Vùng chạm = cả thẻ (nhỏ nhất 184×250 → ~87×118 px trên điện thoại 390).
- Rê chuột: thẻ nhấc 6 px, viền nét đứt.
- Nền tối: thẻ tím `#3a3560`, bóng `#0e0c1e` thêm viền phấn `#c9c6dc` dày ~5 đơn vị để bóng không chìm.
- Đúng: gửi ngay; đồ vật có màu lấp vào bóng đúng (cùng xoay/lật), vòng vàng (`--primary`) + dấu tích, nảy 108 %; ~300 ms sau câu mới.

### Hiện đáp án đúng khi sai

Khoá như các game khác, suốt `bridge.unlockDelay`: bóng chạm nhầm có X đỏ (`--destructive`) viền trắng, **đồ vật có màu mờ 45 % đè lên bóng sai** (cùng xoay/lật của bóng đó) để thấy phần thừa/thiếu, kèm vòng đỏ nét đứt quanh chi tiết khác (lấy từ `shadowDiff(item, variant)`; bóng vật khác thì không khoanh); **bóng đúng được tô màu** (đồ vật có màu lấp vào) trong vòng vàng; thẻ đề và các bóng khác mờ 35 %. Mọi thẻ bóng nằm dưới y 568, không bị huy hiệu khoá che.

### Hiệu ứng

Lắc thẻ sai 200 ms, nảy thẻ đúng 300 ms, câu mới: thẻ đề phóng từ 90 % lên, các bóng hiện lần lượt 40 ms. Tôn trọng nút Hiệu ứng: kiểm `prefersReducedMotion()` (`features/motion`); khi giảm chuyển động thì bỏ lắc, nảy, hiện lần lượt, chỉ đổi trạng thái tĩnh.

## Ghi chú cho BE

Không. Đáp án một số nguyên, chấm một lần mỗi câu như Kẻ lạc đàn.

## Câu hỏi đã chốt

- Bóng lật gương của đúng vật: tính là đúng (chủ dự án chốt).
- Bộ vật 8 vật: ấm trà, cá, mèo, xương rồng, ô, gà, giày, đèn bàn.
- Đúng thì chờ ~300 ms hiệu ứng rồi mới hiện câu mới (đã tính vào mô phỏng).
