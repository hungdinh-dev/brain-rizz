# Âm thanh hiệu ứng

Thả file vào thư mục này là app tự dùng thay cho tiếng tổng hợp sẵn, không phải sửa code
(`src/features/sfx/sfx-files.ts`). Thiếu file nào thì loại đó vẫn dùng tiếng tổng hợp.

## Tên file ↔ lúc phát

Tên file **đúng bằng tên loại**, vd. `click.mp3`.

| File | Lúc phát | Gợi ý từ Kenney Interface Sounds (CC0) |
|---|---|---|
| `click` | Bấm nút thường | `click_001` hoặc `select_001` |
| `toggle` | Nút bật/tắt: Sẵn sàng, theme, ngôn ngữ, nhạc, chọn độ khó, chọn nhân vật… | `toggle_001` |
| `confirm` | Tạo phòng, Vào phòng, Bắt đầu, Đã hiểu, Quay, Chơi game này, Vòng tiếp theo, Chơi lại | `confirmation_001` |
| `back` | Quay lại, Rời phòng, Về phòng chờ | `back_001` |
| `error` | Server báo lỗi (toast theo mã lỗi), không tạo/vào được phòng | `error_004` |
| `tick` | Mỗi giây lúc đếm ngược 5 giây (giây cuối phát cao hơn) | `tick_001` |
| `correct` | Câu trả lời của mình đúng | `confirmation_002` |
| `wrong` | Câu trả lời của mình sai | `error_006` |

Bộ Kenney "Interface Sounds": https://kenney.nl/assets/interface-sounds (CC0).

## Yêu cầu file

- **Định dạng:** `.mp3` (ưu tiên). Safari iOS cũ không phát `.ogg`. Có cả nhiều định dạng cho
  cùng một loại thì app chọn theo thứ tự mp3 → m4a → ogg → wav.
- **Độ dài:** tiếng bấm ≤ ~150 ms, `correct`/`wrong` ≤ ~300 ms; cắt bỏ khoảng lặng đầu file.
- **Dung lượng:** vài KB mỗi file (mono, 64–96 kbps là đủ). File chỉ được tải sau lần chạm đầu tiên.
- **Âm lượng:** chuẩn hoá các file cho to nhỏ gần nhau; app phát ở mức cố định ~0,5.
- **Giấy phép:** ghi nguồn, tác giả và giấy phép vào `assets/LICENSES.md` (gốc repo) trước khi commit.
