# Kẻ lạc đàn (`odd-one-out`)

- Nhóm: Nhận diện
- Thời lượng vòng: 45 000 ms
- File: `packages/shared/src/games/odd-one-out/`, `apps/web/src/games/odd-one-out/` (`OddOneOutScene.ts`, `locales.ts`)

## Cách chơi

Một lưới hình giống hệt nhau, chỉ một hình khác. Chạm vào hình khác biệt càng nhanh càng tốt.

**Khi sai:** 0 điểm, mất chuỗi đúng, khoá thao tác 1,5 giây. Trong lúc khoá, máy người chơi **hiện đáp án đúng**: ô khác biệt được khoanh và giữ sáng, ô vừa chạm bị gạch chéo. Hết khoá thì sang câu mới ([CR-006](../00-tracking/change-requests.md#cr-006), RULE-08, FR-VC-05).

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn lưới hình giống nhau
  2. Chạm vào hình duy nhất khác biệt
  3. Đúng và nhanh để được nhiều điểm
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính).
- **Hình minh hoạ:** lưới 4×4 hình giống nhau, một ô khác được khoanh tròn bằng phấn (canvas khu 7).
- **Câu nhắc lúc đếm ngược:** "Chạm vào hình khác biệt!" (máy tính: "Click vào hình khác biệt!").

## Câu đố & đáp án

- `Puzzle`: `{ cols, rows, cells: { shape, color, rotation }[], oddIndex }`
- `Answer`: số nguyên — chỉ số ô được chạm.

## Độ khó

| Mức | Lưới | Kiểu khác biệt |
| --- | --- | --- |
| Mầm | 3×3 | Khác hình hoặc khác màu |
| Thường | 4×4 | Khác hình hoặc khác màu |
| Khó | 5×5 | Cùng hình, cùng sắc độ (hue), ô lạc sáng hơn hoặc tối hơn **14–18** điểm % độ sáng HSL |
| Siêu khó | 6×6 | Như Khó nhưng chỉ lệch **7–9** điểm % độ sáng HSL |

Mầm và Thường giữ nguyên luật cũ (cùng chuỗi số ngẫu nhiên, đã so dấu vân tay 10.000 câu trước/sau khi đổi), nên Kiểm tra não (chơi ở mức Thường) và điểm chuẩn `BRAIN_TEST_REFERENCE_SCORE` không đổi.

### Cách sinh màu ở Khó/Siêu khó

- Chọn một màu gốc trong 6 sắc độ (hồng 350°, cam 25°, xanh lá 140°, xanh dương 210°, tím 265°, tím hồng 300°), mỗi màu có độ bão hoà cố định và một dải độ sáng hợp lệ riêng.
- Chọn độ lệch (số nguyên trong dải của mức) và hướng (sáng hơn/tối hơn, mỗi hướng ~50 %), rồi chọn độ sáng gốc sao cho **cả ô gốc lẫn ô lạc** đều nằm trong dải hợp lệ. Màu tính bằng hàm HSL → hex thuần, tất định (không thư viện).
- Dải hợp lệ được chọn để độ chói tương đối của mọi biến thể nằm khoảng 0,11–0,42, tức tương phản ≥ ~1,8:1 với nền khung game ở cả giao diện sáng (`--muted` #f3eadf) lẫn tối (`--muted` #3a3560). Không dùng màu tối như #2D3047 và bỏ vàng (dải hợp lệ quá hẹp, vàng tối thành ô liu).
- **Người mù màu:** khác biệt chỉ nằm ở độ sáng, không ở sắc độ, nên người mù màu (đỏ–lục, lam–vàng) vẫn phân biệt được như người thường.
- Độ lệch HSL không đều về cảm nhận giữa các sắc độ (cam/xanh lá lệch 8 % trông rõ hơn tím), nhưng hai mức không chồng nhau: lệch lớn nhất của Siêu khó (9) luôn nhỏ hơn lệch nhỏ nhất của Khó (14).

Ví dụ (gốc → lạc):

| Mức | Ví dụ |
| --- | --- |
| Khó | #2680D9 → #6CA8E5 (xanh dương, sáng hơn) · #EF8539 → #C15A10 (cam, tối hơn) · #206F3A → #32AE5C (xanh lá, sáng hơn) |
| Siêu khó | #408FDD → #63A3E3 · #EE7C2B → #D96512 · #C91D39 → #E02947 |

## Đảm bảo khi sinh câu đố

- Đúng một ô khác biệt; các ô còn lại giống nhau hoàn toàn (đã test 10.000 câu).
- Khó/Siêu khó (test 10.000 seed mỗi mức): ô lạc cùng hình, mọi ô góc xoay 0, cùng sắc độ (sai số ≤ 3° do làm tròn hex), độ lệch độ sáng nằm trong dải của mức (nới 0,5 cho làm tròn), mọi màu có độ sáng 27–77 %; có cả ô lạc sáng hơn lẫn tối hơn.
- Không còn kiểu khác góc xoay ở bất kỳ mức nào.

## Cân bằng

**Ước lượng CHƯA ĐO** (thêm 2026-10-21 cho bot, [CR-016](../00-tracking/change-requests.md#cr-016)). Trước đây game chưa có mục này. Số dưới đây chỉ để bot có mốc; phải đo lại ở buổi chơi thử. Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức.

| Mức | Lưới | Thời gian giải mỗi câu | Tỉ lệ sai | Số câu mỗi vòng 45 s (trả lời · đúng) |
| --- | --- | --- | --- | --- |
| Mầm | 3×3 | trẻ 7 tuổi ~1,9 s (người lớn ~0,7 s) | 10 % | ~20 · 18 |
| Thường | 4×4 | ~1,3 s | 4 % | ~29 · 28 |
| Khó | 5×5 | ~2,0 s | 10 % | ~19 · 17 |
| Siêu khó | 6×6 | ~2,9 s | 15 % | ~13 · 11 |

Cách suy ra:

- **Thường:** 1,3 s mỗi câu, sai 4 %, theo giả định của [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não) (điểm chuẩn Kẻ lạc đàn).
- **Khó, Siêu khó:** thời gian tỉ lệ với số ô của `GRID_BY_DIFFICULTY` so với lưới 4×4: 1,3 × 25/16 ≈ 2,0 s và 1,3 × 36/16 ≈ 2,9 s. Đây là mô hình đơn giản nhất cho tìm lần lượt từng ô. Không trừ phần chạm cố định vì ở hai mức này khác biệt chỉ còn ở độ sáng, nên mỗi ô cũng xem lâu hơn. Tỉ lệ sai: Khó 10 % (lệch 14–18 % còn khá rõ, thấp hơn chút so với 11–14 % ở Khó của Hình to hình nhỏ, Tìm bạn, Bóng của ai); Siêu khó 15 % (Hình to hình nhỏ 15 %, Tìm bạn 16 %).
- **Mầm:** người lớn 1,3 × 9/16 ≈ 0,73 s. Trẻ 7 tuổi chậm hơn khoảng 2,6 lần, là trung vị tỉ số trẻ / người lớn ở Mầm của 4 game Nhận diện khác (Luyện ngắm 2,7, Hình to hình nhỏ 2,7, Tìm bạn 2,6, Bóng của ai 2,3), ra ~1,9 s. Sai 10 % như trẻ ở Hình to hình nhỏ, Tìm bạn, Bóng của ai.
- Số câu mỗi vòng: thời gian một câu (cộng 0,2 s chuyển câu) cộng khoá 1,5 s cho phần câu sai.
- Siêu khó còn ~13 câu mỗi vòng (≥ 8). Thời gian các mức người lớn tăng dần, không chồng nhau ở mức ước lượng điểm này (chưa có khoảng dao động).

**Thời gian và tỉ lệ đúng cho bot** (khai báo trong `oddOneOut`):

| Mức | `expectedSolveMs` | `expectedAccuracy` | Cách tính |
| --- | --- | --- | --- |
| Mầm | 2 100 | 0,90 | trẻ 1,9 s + 0,2 s chuyển câu (nảy 180 ms, mục Ghi chú cho FE) |
| Thường | 1 500 | 0,96 | 1,3 + 0,2 s |
| Khó | 2 250 | 0,90 | 2,03 + 0,2 s, làm tròn tới 50 ms |
| Siêu khó | 3 150 | 0,85 | 2,93 + 0,2 s, làm tròn tới 50 ms |

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006)): **chưa khai báo**. Game vẫn dùng hệ số chung 0,8 / 1 / 1,25 / 1,5, không có miễn trừ (chạm được ngay, không có pha trình chiếu).

Với ước lượng trên, mô phỏng 1 000 vòng bằng công thức điểm của server cho điểm vòng so với người lớn ở Thường: trẻ ở Mầm ~50 %, người lớn ở Khó ~63 %, ở Siêu khó ~44 %. Tức là chọn mức cao bị thiệt, trái nguyên tắc "không phạt người chọn mức cao" của GDD. Vì thế bot Khó và Siêu ở game này cũng được ít điểm hơn bot Vừa (Khó 0,72 lần, Siêu 0,62 lần). Test mô phỏng bot ghi game này là ngoại lệ có lý do (`NOT_ORDERED` trong `balance-sim.test.ts`).

**Đề xuất, chưa áp dụng, chờ chủ dự án duyệt:** cân theo CR-006 thì cần hệ số **Mầm 1** (trẻ cần 2,04, chặn ở 1), **Thường 1**, **Khó 2,25**, **Siêu khó 3,85**, ngang các game Nhận diện khác (Hình to hình nhỏ 1 / 1 / 1,9 / 3; Bóng của ai 1 / 1 / 2,55 / 4). Với số này bot lại tăng dần: Dễ 0,36, Khó 1,14, Siêu 1,37 lần Vừa.

- Thường giữ 1 nên Kiểm tra não và `BRAIN_TEST_REFERENCE_SCORE` không đổi.
- Phải sửa kèm test server `PartyRoom.test.ts` (ca `odd-one-out` đang ghi cứng hệ số chung: Mầm 130, Siêu khó 200 điểm).
- Điểm Luyện tập cũ ở Mầm, Khó, Siêu khó không còn so được với điểm mới.
- Nên đo thời gian thật ở buổi chơi thử rồi mới chốt.

## Ghi chú cho FE

Lưới vuông ở giữa khung 720×1280, mỗi ô là vùng chạm. Mép trên của lưới nằm dưới dải huy hiệu khoá của khung, nên huy hiệu không che ô nào.

| Trạng thái | Hiển thị | Thời gian |
| --- | --- | --- |
| Đúng | Hình vừa chạm nảy lên (× 1,3) rồi sang câu mới | 180 ms |
| Sai, khoá | Rung màn hình. Mọi ô mờ còn 35 %, ô vừa chạm thêm dấu ✗ màu `destructive`. **Hiện đáp án đúng (CR-006):** ô khác biệt giữ sáng, được khoanh bằng vòng màu `highlight` và nhịp nhẹ (× 1,12) suốt lúc khoá. Chạm trong lúc khoá bị bỏ qua | Rung 200 ms. Hết khoá theo `lockedUntil` của server (`bridge.unlockDelay`), không tự đếm 1,5 giây, rồi sang câu mới |

- Client tự biết đáp án đúng vì sinh câu đố tất định (`puzzle.oddIndex`), không cần chờ server.
- Màu `highlight` và `destructive` đọc từ token CSS lúc vẽ, nên tự đổi theo giao diện sáng/tối.
- `cell.color` là hex bất kỳ (không chỉ thuộc `PALETTE`): vẽ đúng hex, không thêm viền/bóng làm lệch độ sáng giữa các ô. `rotation` hiện luôn là 0.

## Ý tưởng cải tiến

- Thêm khác biệt về kích thước, viền, hoạ tiết.
- Chuyển sang OKLCH để độ lệch đều về cảm nhận giữa các sắc độ.

## Lịch sử thay đổi

- 2026-10-21: Thêm mục Cân bằng (ước lượng chưa đo) và khai báo `expectedSolveMs`, `expectedAccuracy` cho bot (CR-016). Hệ số điểm chưa đổi; đề xuất hệ số riêng chờ duyệt.
- 2026-10-20: Khó đổi từ "khác hẳn màu" sang "cùng sắc độ, lệch độ sáng 14–18 %"; Siêu khó đổi từ "khác góc xoay 15–25°" sang "lệch độ sáng 7–9 %" (yêu cầu chủ dự án: khác màu và xoay quá dễ nhận). Mầm/Thường không đổi.
