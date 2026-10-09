# ADR 0003: Câu đố sinh tất định từ seed, server chấm lại

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Mọi người trong phòng phải giải **cùng một bộ câu đố** (theo độ khó riêng), phản hồi đúng/sai phải tức thì kể cả trên 4G, và server phải chấm được mà không tin client.

## Quyết định

- Server phát một **seed 32-bit** cho mỗi vòng. Câu thứ `i` sinh bởi `generate(seed, i, difficulty)` dùng PRNG mulberry32 (`packages/shared/src/rng.ts`) với seed con `deriveSeed(seed, i)`.
- Client tự sinh câu đố, chấm ngay để phản hồi tức thì, rồi gửi `answer { round, index, answer }`.
- Server sinh lại đúng câu đó và chấm lại; điểm trên server là điểm thật.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Seed + sinh tất định (chọn) | Băng thông rất nhỏ, phản hồi tức thì, server chấm được | Client biết trước đáp án nếu đọc code |
| Server gửi từng câu đố | Không lộ đáp án | Thêm một lượt trễ mạng mỗi câu, server phải giữ nhiều state hơn |
| Mỗi máy tự sinh ngẫu nhiên | Đơn giản | Mỗi người một đề, không công bằng, không chấm được |

## Hệ quả

- **Cấm `Math.random()`/`Date.now()` trong logic câu đố.** Vi phạm sẽ làm hai máy ra đề khác nhau.
- Đổi thuật toán PRNG là thay đổi phá vỡ tương thích (có test snapshot canh giữ).
- Mỗi bộ sinh bắt buộc có test ≥ 10.000 seed.
- Gian lận bằng cách đọc code là có thể; chấp nhận được cho nhóm bạn. Nếu công khai cho người lạ, chuyển sang "server gửi từng câu" cho các game nhạy cảm.
