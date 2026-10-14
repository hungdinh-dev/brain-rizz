# Gấp hộp (`fold-box`)

- Nhóm: Hình dung (`visualize`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo [CR-006](../00-tracking/change-requests.md#cr-006))
- Trạng thái đặc tả: bản đầu 2026-10-14, bám bản mẫu đã duyệt. Hệ số điểm và thời gian giải là ước lượng, chốt lại sau buổi chơi thử.
- File:
  - `packages/shared/src/games/fold-box/`: `fold-box.ts` (bộ sinh, kiểu dữ liệu, `foldBoxMatches`), `cube.ts` (hình học: gấp lưới, 24 phép quay, kho hình; nội bộ), `fold-box.test.ts`.
  - `apps/web/src/games/fold-box/` (scene, màn hướng dẫn, `locales.ts`): đã làm theo bản mẫu (2026-10-14), chờ chơi thử.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng M9: `FoldBoxMobile`, `FoldBoxLevels`, `FoldBoxStates`, `FoldBoxHowTo` (đã duyệt).

## Cách chơi

Trên cùng là một khối hộp nhìn thấy 3 mặt (trên, trái, phải), mỗi mặt có thể có một ký hiệu. Chạm vào **lưới trải phẳng duy nhất gấp được đúng khối hộp đó**: ký hiệu phải nằm đúng mặt và đúng hướng.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn khối hộp ở trên cùng
  2. Chạm lưới gấp được đúng hộp
  3. Ký hiệu phải đúng mặt, đúng hướng
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ:** theo artboard `FoldBoxHowTo`. Trên: thẻ khối mẫu (chấm ở trên, vòng tròn bên trái, dấu cộng bên phải). Dưới trái: lưới chữ thập 6 ô có vòng tròn, chấm, dấu cộng ở ba ô kề nhau, đường gấp nét đứt; khoanh phấn vàng + dấu ✓, một mũi tên phấn cong đi từ lưới lên khối mẫu kèm icon gấp. Dưới phải: cùng dáng lưới nhưng chấm nằm cách vòng tròn một ô (hai mặt đối diện), gạch chéo đỏ ✗ kèm icon "mặt đối diện" (ba ô, ô giữa nét đứt).
- **Câu nhắc lúc đếm ngược:** "Gấp trong đầu rồi chạm!"
- **Câu nhắc theo mức:**
  - Mầm: "Chọn hình gấp được thành hộp"
  - Khó: "Coi chừng hình soi gương!"
  - Siêu khó: "Sáu mặt đều có ký hiệu!"

## Câu đố & đáp án

- `Puzzle` (`FoldBoxPuzzle`): `{ cube: FoldBoxCube; choices: FoldBoxChoice[]; answerIndex: number }`
  - `FoldBoxCube` = `{ top, left, right }`, mỗi mặt là `FoldBoxMark | null` (`null` = mặt trơn).
  - `FoldBoxMark` = `{ symbol: FoldBoxSymbol; rot: number }`.
  - `FoldBoxChoice` = `{ cells: FoldBoxCell[]; kind: FoldBoxChoiceKind; focus: number[] }`, với `FoldBoxCell` = `{ x; y; mark: FoldBoxMark | null }`.
  - `choices` có 3 phần tử (Mầm) hoặc 4, theo thứ tự ô trên màn hình (trái → phải, trên → dưới).
- `Answer` (`FoldBoxAnswer`): số nguyên, chỉ số lựa chọn được chạm. `check` đúng khi `answer === answerIndex`. `isAnswer` chỉ nhận `typeof number`, số nguyên, `0 ≤ n < 4`.
- Module export thêm: `FOLD_BOX_SYMBOLS`, `FOLD_BOX_MAX_CHOICES = 4`, `foldBoxMatches(cells, cube)` (gấp thật một lưới và trả về các phép quay khớp khối mẫu; FE không cần, dùng cho test và kiểm tra).

Chi tiết từng trường cho FE: [Ghi chú cho FE › Dữ liệu câu đố](#dữ-liệu-câu-đố).

## Cách sinh câu đố

### Ký hiệu

6 ký hiệu kem viền mực, phân biệt bằng **hình** (không chỉ bằng màu):

| `symbol` | Hình | Đối xứng xoay | `rot` hợp lệ |
| --- | --- | --- | --- |
| `dot` | chấm tròn đặc | 90° | 0 |
| `ring` | vòng tròn rỗng | 90° | 0 |
| `plus` | dấu cộng | 90° | 0 |
| `diamond` | hình thoi | 90° | 0 |
| `bar` | sọc (thanh dài) | 180° | 0 = ngang, 1 = dọc |
| `triangle` | tam giác | không | 0–3 |

`rot` là số phần tư vòng xoay **theo chiều kim đồng hồ, nhìn từ ngoài mặt**, so với tư thế gốc: tam giác đỉnh chỉ **lên** (về phía −y của mặt), sọc **nằm ngang** (dọc theo x của mặt). Dữ liệu luôn đã chuẩn hoá: ký hiệu không hướng có `rot = 0`, sọc 0–1, tam giác 0–3.

### Kho hình (tính một lần, không ngẫu nhiên)

`cube.ts` liệt kê đủ 35 hình 6 ô tự do (polyomino), gấp thật từng hình, rồi chia:

- **11 lưới gấp được** (`nets`), thứ tự cố định theo khoá: 6 lưới dạng 1-4-1, 3 lưới dạng 2-3-1, 1 lưới 2-2-2 (bậc thang), 1 lưới 3-3.
- **3 hình hàng 5 ô** (`runs`): hàng thẳng 5 ô + 1 ô gắn cạnh ô đầu, ô thứ hai hoặc ô giữa. Không gấp được vì ô đầu và ô cuối hàng chồng nhau.
- **8 hình có khối 2 × 2** (`blocks`), kể cả khối 2 × 3. Không gấp được vì bốn ô của khối vuông không thể thành bốn mặt khác nhau.
- Bỏ hàng 6 ô (quá dài cho thẻ) và 12 hình không gấp được khác (sai khó thấy, không hợp với Mầm).

Mọi hình trong kho có khung bao ≤ 5 × 3 (hoặc 3 × 5) nên vừa thẻ 320 px với ô 56 px.

### Gấp lưới (khung 3D)

Lưới nằm phẳng, mặt in hướng về người nhìn; các ô gập **ra sau** nên ký hiệu nằm ở mặt ngoài hộp. Đi loang từ ô đầu tiên, mỗi bước gập ô kề 90° quanh cạnh chung, ghi lại cho mỗi ô một khung (pháp tuyến ra ngoài `n`, hướng phải `ex`, hướng xuống `ey`, toàn số nguyên −1/0/1). Hình gấp được khi 6 ô rơi vào 6 mặt khác nhau và mọi cặp ô kề đều khớp sau khi gập; nếu không, hai ô chồng nhau được ghi lại (dùng cho `focus` của mồi Mầm). Test kiểm đúng 11 trong 35 hình gấp được.

Khung của 3 mặt nhìn thấy trên khối mẫu (trái × phải = trên): trên `n = +z`, trái `n = +x`, phải `n = +y`. Hướng "lên" của ký hiệu trên một mặt với `rot = r` là `−ey, ex, ey, −ex` theo r = 0, 1, 2, 3.

### Một câu đố

**Mầm:** khối mẫu trơn cả 3 mặt. Ba lựa chọn: 1 lưới bất kỳ trong 11 lưới, 1 hình trong `runs`, 1 hình trong `blocks`; mỗi hình đặt ở một trong 8 tư thế (xoay/lật) ngẫu nhiên, mọi ô trơn. Xáo vị trí.

**Thường → Siêu khó:**

1. **Khối mẫu.** Thường: 3 ký hiệu không hướng khác nhau (chọn 3 trong 4), mặt khuất trơn. Khó: tam giác + sọc + 1 ký hiệu không hướng, xếp ngẫu nhiên vào trên/trái/phải; tam giác `rot` 0–3, sọc 0–1. Siêu khó: như Khó, thêm 3 ký hiệu không hướng còn lại lên 3 mặt khuất (đủ 6 ký hiệu, mỗi cái một mặt).
2. **Biến thể** (khối 3D đầy đủ, mỗi ký hiệu có mặt và hướng "lên"):
   - `answer`: chính khối mẫu.
   - `opposite`: lấy cặp ký hiệu thấy được (A, B), dời B sang mặt đối diện A; thứ đang ở đó (trơn hoặc ký hiệu khuất) về chỗ cũ của B. Hướng của ký hiệu bị dời chọn ngẫu nhiên.
   - `mirror`: bản soi gương qua mặt phẳng x = y (đổi trái ↔ phải, hướng ký hiệu cũng soi theo).
   - `rotated`: xoay ký hiệu có hướng (tam giác hoặc sọc) trên mặt của nó đi ±90°.
3. **Đặt lên lưới.** Chọn 4 dáng lưới **khác nhau** trong 11 (xáo rồi lấy 4). Với mỗi biến thể: đặt dáng lưới ở tư thế ngẫu nhiên (8), gấp thật để có khung từng ô, chọn ngẫu nhiên 1 trong 24 phép quay của khối; mỗi ô nhận ký hiệu của mặt mà nó rơi vào, `rot` tính sao cho hướng "lên" sau khi gấp và quay trùng hướng trong biến thể.
4. **Kiểm bằng cách gấp thật.** `answerIndex` = lựa chọn duy nhất mà `foldBoxMatches` (gấp lưới, thử đủ 24 phép quay, so 3 mặt thấy được: cùng ký hiệu, cùng hướng theo đối xứng của ký hiệu) trả về ít nhất một phép quay. Bộ sinh không dò "mặt đối diện" theo mẫu hình lưới.
5. Xáo vị trí lựa chọn.

### Vì sao chắc chắn đúng một đáp án

- Đáp án dựng từ chính khối mẫu nên luôn khớp.
- `notNet`: không gấp được.
- `opposite`: hai ký hiệu thấy cùng lúc trên khối mẫu (hai mặt kề nhau) lại nằm ở hai mặt đối diện; phép quay giữ quan hệ kề/đối nên không khớp được.
- `mirror`: 3 ký hiệu thấy được khác nhau, thứ tự vòng quanh góc bị đảo chiều; phép quay giữ chiều nên không khớp.
- `rotated`: mỗi ký hiệu chỉ xuất hiện một lần, nên phép quay duy nhất đưa 3 ký hiệu về đúng 3 mặt là phép quay giữ nguyên 3 mặt đó; khi ấy ký hiệu bị xoay 90° lệch hướng (tam giác không đối xứng 90°, sọc chỉ đối xứng 180°).
- Test chạy 10 000 câu, gấp thật từng lựa chọn: đúng 1 lựa chọn khớp và trùng `answerIndex`.

### Vì sao không lộ đáp án

- Mỗi lựa chọn một dáng lưới khác nhau, tư thế ngẫu nhiên, nên không so được hai lựa chọn với nhau để đoán.
- Mọi lưới có cùng số ô có ký hiệu và cùng bộ ký hiệu với khối mẫu (Thường, Khó: 3; Siêu khó: 6).
- Vị trí đáp án và dáng lưới đáp án phân bố đều (test: lệch ≤ 4% mỗi vị trí, đủ 11 dáng).

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 lựa chọn; khối trơn; mồi: 1 hình hàng 5 ô + 1 hình có khối 2 × 2 | Tìm hình 6 ô gấp được thành hộp. Hai hình kia chồng ô thấy ngay |
| Thường | 4 lựa chọn; 3 ký hiệu không hướng ở 3 mặt thấy được, mặt khuất trơn; 3 mồi `opposite` dùng 3 cặp khác nhau | Tìm lưới mà 3 ký hiệu nằm ở 3 mặt kề nhau (không cặp nào cách một ô thẳng hàng) |
| Khó | 4 lựa chọn; tam giác + sọc + 1 ký hiệu không hướng; mồi: `mirror`, `rotated` (tam giác hoặc sọc), `opposite` | Phải kiểm cả chiều vòng quanh góc và hướng của tam giác/sọc |
| Siêu khó | 4 lựa chọn; như Khó và 3 mặt khuất cũng có ký hiệu (6 ký hiệu); mồi: `mirror`, `rotated` tam giác, `rotated` sọc | Lưới nào cũng đủ 6 ký hiệu, không loại nhanh được bằng "mặt đối diện"; phải gấp kỹ |

Độ khó tăng đo được (test, trung bình 2 500 câu mỗi mức):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Số lựa chọn | 3 | 4 | 4 | 4 |
| Số ô có ký hiệu mỗi lưới | 0 | 3 | 3 | 6 |
| Ký hiệu có hướng trên khối mẫu | 0 | 0 | 2 | 2 |
| Mồi khó (`mirror`/`rotated`) | 0 | 0 | 2 | 3 |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng, kiểm bằng gấp thật + 24 phép quay.
- Mỗi lựa chọn một dáng lưới khác nhau (khác nhau cả khi xoay/lật).
- Mỗi lưới đúng 6 ô, đã chuẩn hoá (x, y nhỏ nhất bằng 0), sắp theo (y, x), khung bao ≤ 5 × 3.
- Mỗi ký hiệu xuất hiện tối đa một lần trong một lưới; lưới nào cũng chứa đủ ký hiệu của khối mẫu.
- `rot` đã chuẩn hoá theo đối xứng của ký hiệu.
- Đúng loại mồi theo mức (bảng trên); `focus` trỏ đúng ô: `opposite`/`rotated`/`mirror` trỏ vào ô có ký hiệu, `notNet` trỏ vào hai ô chồng nhau (gấp lại vẫn thất bại), đáp án trỏ vào 3 ô thành mặt trên/trái/phải.
- Tất định: chỉ dùng `createRng(deriveSeed(seed, index))`, toàn số nguyên, kho hình sắp theo khoá chuỗi cố định.

Các điều trên được kiểm bằng test 10 000 câu (2 500 seed × 4 mức). Bộ sinh mất khoảng 40–85 µs mỗi câu.

## Cân bằng

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ sai ước | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | Người lớn 1,2–2,2 s · trẻ 7 tuổi 2–3,5 s | 3% · trẻ 10% | 23–38 · trẻ 15–24 |
| Thường | 2,3–3,8 s | 10% | 14–22 |
| Khó | 3,8–5,2 s | 15% | 10–14 |
| Siêu khó | 5,2–7,2 s | 20% | 7,7–10,4 (trung bình khoảng 8,4) |

Cách ước lượng: 0,4 s nhìn khối mẫu + số lưới phải xét × thời gian xét một lưới + 0,3 s chạm. Số lưới phải xét trung bình 2,25 với 4 lựa chọn, 1,67 với 3. Xét một lưới: Mầm ≈ 0,5 s (thấy ô chồng); Thường 0,7–1,3 s (tìm cặp ký hiệu cách một ô); Khó 1,4–2 s (chiều vòng quanh góc + hướng tam giác/sọc); Siêu khó 2–2,8 s (như Khó, thêm 3 ký hiệu nhiễu). Số câu = 60 s ÷ (thời gian giải + 0,35 s hiệu ứng đúng + 1,5 s × tỉ lệ sai). Các mức của người lớn không chồng nhau. Siêu khó trung bình còn khoảng 8,4 câu mỗi vòng (mô phỏng: 6,7 đúng + 1,7 sai).

**Thưởng tốc độ chung giữ nguyên, game không khai báo `speedAllowanceMs`:** không có pha trình chiếu, một chạm là xong. Thường được khoảng 30–41 điểm thưởng mỗi câu; Siêu khó còn khoảng 4–20.

### Hệ số độ khó theo game (CR-006)

`difficultyMultiplier` = **Mầm 0,85 · Thường 1 · Khó 1,95 · Siêu khó 3,25** (hệ số chung cũ: 0,8 / 1 / 1,25 / 1,5).

**Cách tính** (như `rotate-match`): mô phỏng 200 000 vòng 60 s mỗi mức theo công thức điểm server: thời gian giải phân bố đều trong khoảng ở bảng trên, sai theo tỉ lệ ở bảng; câu đúng cộng 0,35 s hiệu ứng vào `answerMs` câu sau; câu sai khoá 1,5 s; combo trần × 1,5. Điểm vòng S_d(m) = m × A_d + B_d; chọn m_d = (S_Thường − B_d) ÷ A_d, làm tròn 0,05. Mầm = min(giá trị mô phỏng cho trẻ 7 tuổi, 1).

| Người chơi | Câu đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn |
| --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 16,5 · 1,8 | 2 087 | 793 | 0,85 | **0,85** |
| Người lớn · Thường | 15,0 · 1,7 | 1 894 | 677 | 1 (mốc, S ≈ 2 571) | **1** |
| Người lớn · Khó | 9,8 · 1,7 | 1 165 | 288 | 1,96 | **1,95** |
| Người lớn · Siêu khó | 6,7 · 1,7 | 761 | 91 | 3,26 | **3,25** |

Điểm vòng ước tính so với người lớn ở Thường:

| Người chơi | Hệ số chung cũ | Hệ số game này |
| --- | --- | --- |
| Trẻ 7 tuổi · Mầm | ≈ 2 460 (96%) | ≈ 2 570 (100%) |
| Người lớn · Mầm | ≈ 4 810 (187%) | ≈ 5 000 (194%) |
| Người lớn · Thường | ≈ 2 570 (100%) | ≈ 2 570 (100%) |
| Người lớn · Khó | ≈ 1 750 (68%) | ≈ 2 560 (100%) |
| Người lớn · Siêu khó | ≈ 1 230 (48%) | ≈ 2 560 (100%) |

- Người lớn chọn Mầm được khoảng 194% điểm Thường; chủ phòng giám sát (CR-006), như các game khác.
- **Độ nhạy:** Khó giải nhanh/chậm hơn 0,75 s → khoảng 122% / 83% Thường; Siêu khó nhanh/chậm hơn 1 s → khoảng 122% / 82%, và chậm hơn 1 s thì chỉ còn khoảng 7,4 câu mỗi vòng. Cần đo ở buổi chơi thử rồi tính lại.

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `foldBox.generate(seed, index, difficulty)` từ `@brain-rizz/shared` (như Xoay hình), gửi chỉ số thẻ được chạm, kiểm cục bộ bằng `foldBox.check(puzzle, i)` để phản hồi ngay.

```ts
type FoldBoxSymbol = "dot" | "ring" | "plus" | "diamond" | "bar" | "triangle";
interface FoldBoxMark { symbol: FoldBoxSymbol; rot: number }
interface FoldBoxCube { top: FoldBoxMark | null; left: FoldBoxMark | null; right: FoldBoxMark | null }
interface FoldBoxCell { x: number; y: number; mark: FoldBoxMark | null }
type FoldBoxChoiceKind = "answer" | "notNet" | "opposite" | "mirror" | "rotated";
interface FoldBoxChoice { cells: FoldBoxCell[]; kind: FoldBoxChoiceKind; focus: number[] }
interface FoldBoxPuzzle { cube: FoldBoxCube; choices: FoldBoxChoice[]; answerIndex: number }
type FoldBoxAnswer = number; // 0–3
```

| Trường | Ý nghĩa |
| --- | --- |
| `cube.top/left/right` | Ký hiệu trên 3 mặt thấy được; `null` là mặt trơn (Mầm cả 3 đều `null`). |
| `mark.rot` | Phần tư vòng xoay theo chiều kim đồng hồ so với tư thế gốc (tam giác đỉnh lên, sọc ngang), **trong khung của mặt** (xem Vẽ khối mẫu). |
| `cells` | 6 ô của lưới, `x`, `y` nguyên ≥ 0 (x sang phải, y xuống), sắp theo (y, x). Vẽ đúng như dữ liệu, không xoay/lật thêm. |
| `kind` | Loại lựa chọn. **Chỉ dùng sau khi chạm** để chọn icon phản hồi. |
| `focus` | Chỉ số ô trong `cells` cần khoanh khi phản hồi: đáp án → 3 ô thành mặt trên/trái/phải (Mầm rỗng); `notNet` → 2 ô chồng nhau; `opposite` → 2 ô đối diện; `mirror` → 2 ô bị đảo trái/phải; `rotated` → 1 ô bị xoay. |
| `answerIndex` | Vị trí thẻ đúng trong `choices`. |

### Bố cục (khung 720×1280, theo `FoldBoxMobile`/`FoldBoxLevels`)

| Thành phần | x, y | Rộng × cao | Ghi chú |
| --- | --- | --- | --- |
| Thẻ khối mẫu | 180, 56 | 360 × 360 | Viền mực 7 px, bóng 10 px, icon con mắt ở góc trên trái; không nhận chạm |
| Dải nhắc luật | 250, 436 | 220 × 56 | Viên thuốc kem: icon lưới chữ thập → mũi tên → icon hộp; không có chữ |
| Lựa chọn 0 · 1 | 28, 520 · 372, 520 | 320 × 320 | Hàng trên |
| Lựa chọn 2 · 3 | 28, 864 · 372, 864 | 320 × 320 | Hàng dưới. Mầm chỉ có lựa chọn 2, đặt giữa ở 200, 864 |

- Cả thẻ là vùng chạm (320 px), khe 24 px giữa các thẻ. Thứ tự `choices` là thứ tự ô trên màn hình. Không đánh số hay chữ lên thẻ.
- Thẻ: nền kem `#fff8ef`, viền mực `#1f1b3a` 4 px, bo 28, bóng đặc 8 px.

### Vẽ lưới

- Ô vuông cạnh **56 px** ở mọi mức (lưới dài nhất 5 ô = 280 px, vừa thẻ 320). Đặt tâm khung bao lưới vào tâm thẻ.
- Ô tô màu nhóm Hình dung `#7768ae` (tối: sắc sáng hơn, ui-designer chốt), viền ngoài mực 6 px, bóng đặc lệch xuống 7 px.
- **Đường gấp:** mọi cạnh chung giữa hai ô kề nhau vẽ nét đứt mực 70%, 2,5 px, gạch 8/6. FE tự tìm cạnh chung từ `cells`.
- Ký hiệu đặt ở tâm ô, cỡ khoảng nửa ô, kem `#fff8ef` viền mực (theo `<g id="fb-l-…">` trong `FoldBoxLevels`: chấm r 10,5; vòng r 12,5 nét dày; cộng tay 14; thoi bán kính 15; sọc dài 32; tam giác đỉnh (0, −16), đáy (±14, 9)). Xoay ký hiệu `rot × 90°` theo chiều kim đồng hồ quanh tâm ô.

### Vẽ khối mẫu

Khối isometric trong thẻ mẫu, cạnh E = 136 px: mặt trên là hình thoi (360, 104) · (477,78, 172) · (360, 240) · (242,22, 172); mặt trái (360, 240) · (242,22, 172) · (242,22, 308) · (360, 376); mặt phải đối xứng. Màu mặt: trên `#9d90d4`, trái `#7768ae`, phải `#5d508f`; viền mực 6 px, bóng đặc lệch xuống 7 px.

**Khung của từng mặt** (bắt buộc dùng đúng, vì `rot` của khối được tính theo khung này). Một điểm (px, py) của ký hiệu vẽ ở cỡ ô 56 px (đã xoay `rot`) được đưa lên mặt bằng: `màn hình = tâm mặt + px·X + py·Y`, với k = 136 / 56 ≈ 2,43:

| Mặt | Tâm mặt | X (hướng phải của mặt) | Y (hướng xuống của mặt) |
| --- | --- | --- | --- |
| Trên | 360, 172 | (0,866k, −0,5k) phải-lên | (0,866k, 0,5k) phải-xuống |
| Trái | 301,11, 274 | (0,866k, 0,5k) phải-xuống | (0, k) xuống |
| Phải | 418,89, 274 | (0,866k, −0,5k) phải-lên | (0, k) xuống |

- Phaser: biến đổi các điểm của ký hiệu bằng ma trận trên rồi `fillPoints`/`strokePoints` (hình tròn → lấy đa giác 24 điểm), hoặc vẽ ký hiệu vào container rồi dùng ma trận affine. Không xoay khối, không đổi khung theo câu.
- Ví dụ: tam giác `rot = 3` trên mặt phải chỉ về hướng −X = trái-xuống, tức về phía mặt trái.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Thẻ và hình hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120 ms |
| Chờ chọn | Máy tính: rê chuột thì thẻ nhấc 4 px, viền đậm hơn (như `FoldBoxLevels` mức Thường). Điện thoại: thẻ co 0,97 lúc nhấn. Ghi nhận ở `pointerdown`, một chạm là chốt | — |
| Đúng | Thẻ chọn có vòng vàng `#ffd166` + ✓; 3 ô `focus` viền vàng (Mầm: các đường gấp sáng vàng); nảy 1 → 1,06 → 1 | ≤ 350 ms rồi sang câu mới |
| Sai, khoá | Xem mục dưới | `bridge.unlockDelay` |
| Hết giờ | Không nhận chạm nữa | — |

Giữ hiệu ứng đúng ≤ 350 ms vì thời gian này bị tính vào câu sau.

### Hiện đáp án đúng khi sai (CR-006, theo `FoldBoxStates`)

1. `foldBox.check(puzzle, i)` sai thì `submit` rồi gọi `bridge.unlockDelay(index)`; hết khoá theo số ms nó trả về, không tự đếm 1,5 s. Hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả.
2. Thẻ bị chạm: rung ngang ±8 px, viền gạch đứt đỏ `#e85d75` (tối: hồng) + ✗, kèm icon theo `kind`: `notNet` hai ô chồng nhau; `opposite` ba ô, ô giữa nét đứt; `mirror` icon gương; `rotated` mũi tên xoay ↻. Các ô `focus` của thẻ này khoanh nét đứt đỏ.
3. Thẻ `choices[answerIndex]`: vòng vàng + ✓; 3 ô `focus` viền vàng (Mầm: đường gấp sáng vàng).
4. Các thẻ còn lại mờ còn 35%. Thẻ khối mẫu giữ nguyên để nhìn lại.
5. Hết khoá: sang câu mới.

- Thẻ đáp án luôn ở y ≥ 520 nên huy hiệu khoá (tới y ≈ 80, máy thấp tới y ≈ 225) không che. Máy thấp có thể che nửa trên thẻ mẫu, nhưng mặt trên khối (y ≥ 104) chỉ bị che một phần; không cần dời bố cục.
- `prefers-reduced-motion`: bỏ rung và nảy, chỉ đổi viền và huy hiệu.
- Không chỉ dùng màu: đúng là ✓ + viền liền, sai là ✗ + viền gạch đứt.

### Âm thanh dự kiến (GĐ 2)

- Đúng: tiếng "sột" gấp giấy ngắn + "ting" cao dần theo combo.
- Sai: "bụp" trầm + rung 40 ms.

### Ví dụ để vẽ và kiểm (seed 42, index 0)

Ký hiệu viết tắt: C chấm, V vòng, + cộng, T thoi, S sọc (số sau là `rot`), A tam giác (số sau là `rot`), □ ô trơn, · trống. Hàng cách nhau bằng `/`.

**Mầm** (khối trơn), `answerIndex = 0`:

| Ô | `kind` | Lưới | `focus` |
| --- | --- | --- | --- |
| 0 | answer | `□ □ · / · □ · / · □ □ / · · □` | — |
| 1 | notNet | `□ □ □ □ □ / · · □ · ·` | 0, 4 |
| 2 | notNet | `· □ □ / □ □ □ / · □ ·` | 3, 4 |

**Thường**: trên +, trái V, phải T. `answerIndex = 3`:

| Ô | `kind` | Lưới | `focus` |
| --- | --- | --- | --- |
| 0 | opposite | `□ V · · / · + □ □ / · · T ·` | 1, 5 (V đối diện T) |
| 1 | opposite | `· + □ / V □ · / · T · / · □ ·` | 4, 0 (T đối diện +) |
| 2 | opposite | `· · V / · □ T / · + · / □ □ ·` | 0, 3 (V đối diện +) |
| 3 | answer | `· □ · / · T · / · V · / + □ □` | 3, 2, 1 |

**Khó**: trên C, trái S1 (sọc dọc), phải A3 (tam giác chỉ về mặt trái). `answerIndex = 2`:

| Ô | `kind` | Lưới | `focus` |
| --- | --- | --- | --- |
| 0 | rotated | `□ · · · / □ S1 C · / · · A3 □` | 2 |
| 1 | opposite | `· □ · / □ A2 · / · S1 □ / · C ·` | 5, 2 (C đối diện A) |
| 2 | answer | `□ □ · · / · A1 S1 □ / · · C ·` | 5, 3, 2 |
| 3 | mirror | `· S0 · / · A0 · / · □ · / C □ □` | 1, 0 |

**Siêu khó**: trên C, trái S1, phải A3; mặt khuất +, V, T. `answerIndex = 1`:

| Ô | `kind` | Lưới | `focus` |
| --- | --- | --- | --- |
| 0 | rotated | `+ S0 A3 · · / · · V T C` | 1 (sọc) |
| 1 | answer | `· · · A1 / S0 V T C / · + · ·` | 4, 1, 0 |
| 2 | rotated | `· A1 · · / C S0 V T / · · + ·` | 0 (tam giác) |
| 3 | mirror | `+ V · · / · S1 A3 T / · · · C` | 3, 2 |

## Ghi chú cho BE

Không có xử lý khác thường: không có pha trình chiếu, đáp án một bước, chấm bằng `generate()` + `check()`.

- `isAnswer` nhận số nguyên 0–3; ở Mầm (3 lựa chọn) gửi 3 thì `check` trả sai.
- Khai báo CR-006 trong `foldBox`: `durationMs: 60_000`; `difficultyMultiplier: { 0: 0.85, 1: 1, 2: 1.95, 3: 3.25 }`; không có `speedAllowanceMs`.
- Kho hình (35 hình 6 ô) tính lười ở lần `generate` đầu tiên của tiến trình, vài ms; kết quả gấp từng tư thế được nhớ lại.

## Câu hỏi mở

- Thời gian giải Khó/Siêu khó là ước lượng; gấp hình trong đầu chênh lệch giữa người chơi rất lớn. Nếu chơi thử thấy Siêu khó chậm hơn 7,5 s mỗi câu (dưới 8 câu mỗi vòng), đề xuất đổi mồi `rotated` sọc thành `opposite` thay vì giảm số lựa chọn. Sau đó tính lại hệ số.
- Mầm dùng 2 nhóm mồi dễ thấy (hàng 5 ô, khối 2 × 2). 12 hình không gấp được khó thấy hơn (vd. hai ô cùng gắn một phía hàng 4) có thể dùng cho một biến thể sau này, chưa dùng bây giờ.
