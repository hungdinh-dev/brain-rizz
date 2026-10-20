# Đập đúng hình (`whack-right`)

- Nhóm: Nhận diện
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/whack-right/` (logic + test), `apps/web/src/games/whack-right/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M15** (WhackRightMobile bấm thử được, WhackRightLevels, WhackRightStates, WhackRightHowTo). Chờ chủ dự án duyệt.

> Trạng thái: **📝 Có đặc tả** (bản nháp của ui-designer kèm bản mẫu). Luật, tốc độ và cách chấm giờ là đề xuất; game-designer và backend-dev chốt ở `/new-minigame`.

## Cách chơi

Thẻ đề cho biết hình cần đập (vd. ngôi sao vàng). Các hình lần lượt nhô lên từ lỗ rồi thụt xuống: chỉ đập đúng hình trong thẻ đề trước khi nó thụt mất. Đập nhầm hình khác hay để hình đúng trốn mất đều tính sai.

**Một câu = một đợt:** mỗi đợt có đúng một hình đích lẫn trong vài hình mồi, nên mỗi câu có đúng một đáp án rời rạc (số lỗ) mà server kiểm được.

## Màn hướng dẫn

- **Cách chơi:**
  1. Xem hình cần đập trên thẻ
  2. Đập hình đó khi nó nhô
  3. Đừng đập hình gần giống
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng.
- **Hình minh hoạ:** theo artboard WhackRightHowTo (560×360). Trái (biểu tượng mắt): thẻ giấy có búa và ngôi sao vàng. Mũi tên phấn. Phải (biểu tượng búa): sáu lỗ phấn; ngôi sao vàng nhô ở lỗ giữa hàng trên, búa đập trúng, vòng vàng; ngôi sao xanh (cùng hình) và trái tim vàng (cùng màu) cũng nhô nhưng có dấu X. Góc dưới trái: ngôi sao vàng thụt xuống lỗ, mũi tên xuống, dấu X (để trốn mất là sai).
- **Câu nhắc lúc đếm ngược:** "Chỉ đập đúng hình!"
- **Câu nhắc theo mức:** Khó, Siêu khó "Coi chừng cùng màu, cùng hình!".
- **Gợi ý cạnh từng mức:** Mầm "6 lỗ · chậm" · Thường "9 lỗ" · Khó "9 lỗ · nhanh" · Siêu khó "12 lỗ · rất nhanh".

## Câu đố & đáp án

- `Puzzle` (đề xuất `WhackRightPuzzle`):
  - `cols`, `rows`: lưới lỗ (3×2, 3×3, 3×4). Lỗ đánh số theo hàng, lỗ 0 góc trên trái.
  - `target: { shape, color }`: hình cần đập. `shape` ∈ {star, circle, triangle, heart}, `color` ∈ {yellow, blue, purple}.
  - `pops: { hole, shape, color, atMs }[]`: các hình nhô trong đợt theo thứ tự thời gian; các lỗ khác nhau.
  - `answer`: lỗ của hình đích (hình duy nhất trong `pops` trùng `target`).
  - Lịch (ms, số nguyên): `leadMs` (thẻ đề hiện, chưa nhô), `riseMs` 150, `upMs`, `downMs` 150; `endMs` = lúc đích thụt hẳn.
- `Answer`: `number`. Số lỗ chạm (0–11), hoặc **−1 = bỏ lỡ** (client gửi khi tới `endMs` mà chưa đập đích).
- `check`: đúng khi và chỉ khi `answer === puzzle.answer`. `isAnswer`: số nguyên −1…11.
- Client **không gửi** khi chạm lỗ trống (chưa nhô hoặc đã thụt), nên mỗi câu chỉ có một lần gửi.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. Chọn `target` (4 hình × 3 màu = 12 tổ hợp).
3. Sinh `n − 1` mồi: `half` mồi "giống nửa" (cùng hình khác màu, hoặc cùng màu khác hình, mỗi loại 50 %), còn lại khác cả hình lẫn màu. Không mồi nào trùng `target`.
4. Chọn `n` lỗ khác nhau; chèn đích vào vị trí ngẫu nhiên trong dãy (Mầm: vị trí 0 hoặc 1). `atMs` của hình thứ j = `leadMs + j × staggerMs`.
5. `answer` = lỗ của đích; `endMs` = `atMs(đích) + riseMs + upMs + downMs`.

**Vì sao đúng một đáp án:** đích là hình duy nhất trong đợt trùng cả hình lẫn màu với `target`; mỗi lỗ chỉ có một hình trong đợt.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Lưới 3×2 · 2 hình/đợt · 0 mồi giống nửa · nhô 1 600 ms · cách 600 ms | Hình to, chậm, mồi khác hẳn |
| Thường | 3×3 · 3 hình · 1 mồi giống nửa · nhô 1 200 ms · cách 450 ms | Có một hình dễ nhầm |
| Khó | 3×3 · 4 hình · 2 mồi giống nửa · nhô 950 ms · cách 350 ms | Nhanh, nhiều hình gần giống |
| Siêu khó | 3×4 · 5 hình · 3 mồi giống nửa · nhô 750 ms · cách 250 ms | Hình nhô dày, phải soi cả màu lẫn dáng |

`leadMs` 700 (Mầm) / 600 (các mức khác). Có thể đổi đích mỗi đợt; thẻ đề viền vàng nét đứt trong `leadMs` để báo đề mới.

## Đảm bảo khi sinh câu đố

- Đúng một hình trong `pops` trùng `target`; các lỗ trong đợt khác nhau; số hình và số mồi giống nửa đúng mức.
- `atMs` tăng ngặt; đích không bao giờ thụt trước khi hiện đủ `upMs`.
- Vị trí đích trong dãy và lỗ đích phân bố đều (lệch < 15 %).
- Tất định theo `(seed, index, difficulty)`.

Các điều trên phải được kiểm bằng test ≥ 10.000 seed × 4 độ khó.

## Cân bằng

Chưa mô phỏng. Ước lượng: Mầm ~2,6 s/đợt (~20 câu/vòng), Thường ~2,0 s (~27), Khó ~1,7 s (~30), Siêu khó ~1,5 s (~33, tỉ lệ đúng thấp hơn). Siêu khó vẫn ≫ 8 câu.

**Hệ số điểm và miễn trừ thời gian** (CR-006): `speedAllowanceMs` = `atMs` của đích (thời gian chưa thể đập: chuẩn bị + các mồi trước đích). game-designer mô phỏng hệ số.

## Ghi chú cho FE

Bám bản mẫu M15. Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Thẻ đề | x 180–540, y 100–250 | Giấy, viền trong cam Nhận diện; búa gỗ (cán nâu, đầu cam) → hình đích trên đĩa giấy |
| Khung lỗ | x 36–684, y 290–1180 | Giấy, viền trong cam |
| Tâm lỗ | x 150 / 360 / 570; y: 3×2 = 600, 920 · 3×3 = 500, 740, 980 · 3×4 = 460, 650, 840, 1030 | Gò đất elip 98×40, lỗ 84×30 |
| Hình | đĩa giấy r 62, hình màu viền mực | Nhô: tâm y −54 so với tâm lỗ; bị cắt theo mép dưới lỗ |
| Thanh khoá | 420×14 tại (150, 1206) | Khi sai hoặc bỏ lỡ |

- Vùng chạm mỗi lỗ: 200×200 (từ tâm lỗ x ±100, y −150…+50), ~94 px trên điện thoại 390. Chỉ nhận chạm khi lỗ đang có hình (cả lúc đang nhô, đứng, đang thụt).
- Hình phân biệt bằng **dáng** (4 hình) và **độ sáng màu** (vàng `#ffd166` sáng, xanh `#4d9de0` vừa, tím `#5b3fa8` tối) để người mù màu vẫn tách được; đĩa giấy sáng ở cả nền tối nên hình tím vẫn rõ.
- Rê chuột: viền nét đứt quanh lỗ có hình.
- Nền tối: khung `#2f2a52`, gò `#4a4475`, lỗ viền phấn.

| Trạng thái | Hiển thị |
| --- | --- |
| Chuẩn bị | Thẻ đề viền vàng nét đứt, lỗ trống |
| Đang nhô (150 ms) | Hình trượt lên, vạch bay phía trên |
| Nhô | Hình đứng yên |
| Đang thụt (150 ms) | Hình trượt xuống, mũi tên xuống hai bên |
| Đúng | Gửi ngay; hình nổ sao vàng phía sau, búa, dấu tích, hình bẹp nhẹ; ~450 ms sau đợt mới |
| Sai / khoá | X đỏ trên mồi bị đập; đích hiện (nhô) trong vòng vàng; còn lại mờ 35 %; thanh khoá |
| Bỏ lỡ | Gửi −1; đích hiện lại mờ 50 % trong vòng vàng nét đứt + biểu tượng đồng hồ; khoá như sai |

### Hiện đáp án đúng khi sai

Sai hoặc bỏ lỡ: hình đích bật lên tại đúng lỗ của nó (kể cả khi chưa tới lượt nhô) trong vòng vàng, suốt `bridge.unlockDelay`. Mọi lỗ nằm dưới y 290, không bị huy hiệu khoá che.

### Hiệu ứng

Nổ sao 250 ms, búa gõ 120 ms, lắc mồi 200 ms. Giảm chuyển động: hình hiện/ẩn tức thì (không trượt), bỏ nổ sao và lắc; **lịch nhô giữ nguyên** vì là luật chơi.

## Ghi chú cho BE

- Đáp án một số nguyên; thêm giá trị −1 (bỏ lỡ) luôn bị chấm sai.
- Đề xuất kiểm giờ: đáp án đúng chỉ được nhận khi `nhận lúc − shownAt ≤ endMs + LATE_ANSWER_GRACE_MS`; muộn hơn thì chấm như bỏ lỡ. Có thể thêm cận dưới `atMs(đích) − grace` để chặn client gửi trước khi đích hiện.

## Câu hỏi mở

- **Chấm giờ ở server:** có kiểm cửa sổ thời gian của đích (đề xuất ở trên) hay chỉ kiểm số lỗ như các game khác? Không kiểm thì client sửa đổi có thể đập "sớm" nhưng cũng chỉ ăn thưởng tốc độ; kiểm thì mạng lag > 400 ms ở Siêu khó (nhô 750 ms) dễ bị oan.
- **Bỏ lỡ có khoá 1,5 s như sai không?** Bản mẫu: có. Phương án nhẹ hơn: bỏ lỡ chỉ mất combo, không khoá.
- **Đập mồi trước khi đích hiện** tính sai ngay (bản mẫu) hay bỏ qua?
- **Đổi đích mỗi đợt** (bản mẫu) hay giữ một đích vài đợt liền cho Mầm?
- Siêu khó có cho hai hình nhô cùng lúc ở hai lỗ (cách 250 ms nên đã chồng nhau) — có cần giới hạn số hình đứng cùng lúc ≤ 3 không?
