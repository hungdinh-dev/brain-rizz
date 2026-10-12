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
| Khó | 5×5 | Chỉ khác màu |
| Siêu khó | 6×6 | Chỉ khác góc xoay (15–25°), hình luôn có hướng |

## Đảm bảo khi sinh câu đố

- Đúng một ô khác biệt; các ô còn lại giống nhau hoàn toàn (đã test 10.000 câu).
- Ở mức Siêu khó, hình tròn/lục giác được đổi sang tam giác để xoay mới nhìn thấy.

## Ghi chú cho FE

Lưới vuông ở giữa khung 720×1280, mỗi ô là vùng chạm. Mép trên của lưới nằm dưới dải huy hiệu khoá của khung, nên huy hiệu không che ô nào.

| Trạng thái | Hiển thị | Thời gian |
| --- | --- | --- |
| Đúng | Hình vừa chạm nảy lên (× 1,3) rồi sang câu mới | 180 ms |
| Sai, khoá | Rung màn hình. Mọi ô mờ còn 35 %, ô vừa chạm thêm dấu ✗ màu `destructive`. **Hiện đáp án đúng (CR-006):** ô khác biệt giữ sáng, được khoanh bằng vòng màu `highlight` và nhịp nhẹ (× 1,12) suốt lúc khoá. Chạm trong lúc khoá bị bỏ qua | Rung 200 ms. Hết khoá theo `lockedUntil` của server (`bridge.unlockDelay`), không tự đếm 1,5 giây, rồi sang câu mới |

- Client tự biết đáp án đúng vì sinh câu đố tất định (`puzzle.oddIndex`), không cần chờ server.
- Màu `highlight` và `destructive` đọc từ token CSS lúc vẽ, nên tự đổi theo giao diện sáng/tối.

## Ý tưởng cải tiến

- Thêm khác biệt về kích thước, viền, hoạ tiết.
- Màu lấy từ bảng thân thiện với người mù màu ở mức Khó.
