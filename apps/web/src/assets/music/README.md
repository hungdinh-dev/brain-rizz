# Nhạc nền

Thả file nhạc vào thư mục này là app tự nhận, không phải sửa code (`src/features/music/track-list.ts`).
Thư mục không có bài nào thì thanh nhạc tự ẩn.

## Thêm một bài

- **Định dạng:** `.mp3` (ưu tiên, chạy mọi trình duyệt), `.m4a` hoặc `.ogg`.
- **Dung lượng:** ≤ ~3 MB mỗi bài; nén 128 kbps stereo là đủ (nhạc chỉ được tải khi bắt đầu phát).
- **Tên file:** chữ thường, không dấu, nối bằng `-`, có tiền tố số để sắp thứ tự phát:
  `01-happy-chalk.mp3`, `02-brain-party.mp3`… Tên hiển thị tự suy ra: `01-happy-chalk.mp3` → "Happy Chalk".
- **Thứ tự:** phát lần lượt theo tên file, hết danh sách quay về bài đầu.
- **Giấy phép:** ghi nguồn, tác giả và giấy phép của bài vào `assets/LICENSES.md` (gốc repo) trước khi commit.

Đổi tên file thì người chơi đang nghe bài đó sẽ được đưa về bài đầu (app nhớ bài theo tên file).
