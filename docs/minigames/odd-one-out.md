# Kẻ lạc đàn (`odd-one-out`)

- Nhóm: Nhận diện
- Thời lượng vòng: 45 000 ms
- File: `packages/shared/src/games/odd-one-out.ts`, `apps/web/src/games/odd-one-out/OddOneOutScene.ts`

## Cách chơi

Một lưới hình giống hệt nhau, chỉ một hình khác. Chạm vào hình khác biệt càng nhanh càng tốt.

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

## Giao diện

Lưới vuông ở giữa khung 720×1280, mỗi ô là vùng chạm. Đúng: hình nảy lên rồi sang câu mới. Sai: rung màn hình, làm mờ lưới, khoá 1,5 giây rồi sang câu mới.

## Ý tưởng cải tiến

- Thêm khác biệt về kích thước, viền, hoạ tiết.
- Màu lấy từ bảng thân thiện với người mù màu ở mức Khó.
