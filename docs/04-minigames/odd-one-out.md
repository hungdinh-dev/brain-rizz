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

- 2026-10-20: Khó đổi từ "khác hẳn màu" sang "cùng sắc độ, lệch độ sáng 14–18 %"; Siêu khó đổi từ "khác góc xoay 15–25°" sang "lệch độ sáng 7–9 %" (yêu cầu chủ dự án: khác màu và xoay quá dễ nhận). Mầm/Thường không đổi.
