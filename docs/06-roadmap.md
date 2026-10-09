# Lộ trình & checklist

Ước tính cho 1 người làm khoảng 15 giờ/tuần. Chỉ sang giai đoạn sau khi qua **cổng kiểm tra** của giai đoạn trước.

## Giai đoạn 0 — Nền móng (tuần 1–2)

- [x] Monorepo pnpm + Turborepo, TypeScript, Biome, CI GitHub Actions
- [x] Gói `shared`: PRNG có seed, hợp đồng `MinigameDef`, giao thức tin nhắn, tính điểm, mã phòng
- [x] Minigame đầu tiên: Kẻ lạc đàn (bộ sinh câu đố + test 10.000 seed + scene Phaser)
- [x] `PartyRoom`: tạo phòng bằng mã, chủ phòng, sẵn sàng, đếm ngược, chấm điểm, giữ chỗ khi rớt mạng
- [x] Web: màn hình Home / Sảnh (3D tạm) / Chơi / Kết quả, đồng bộ giờ, nối lại sau khi tải lại trang
- [x] Dockerfile + `fly.toml`
- [ ] Đưa repo lên GitHub, CI chạy xanh
- [ ] Thử trên điện thoại thật qua Wi-Fi nhà

**Cổng 0:** hai máy thật vào cùng phòng và thấy cùng một câu đố. _(Đã qua trên trình duyệt giả lập máy tính + iPhone.)_

## Giai đoạn 1 — MVP (tuần 3–7)

- [ ] 4 minigame MVP còn lại: Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình
- [ ] Chủ phòng chọn game cho từng vòng (hoặc ngẫu nhiên) ở màn hình kết quả
- [ ] Màn hình hướng dẫn ngắn trước mỗi minigame
- [ ] Hiển thị đúng/sai + điểm cộng từ `answerResult`
- [ ] QR code mời bạn trên máy tính
- [ ] Deploy: web lên Cloudflare Pages, server lên Fly.io (hoặc Render Free)
- [ ] Test Playwright 4 trình duyệt chơi trọn một trận

**Cổng 1:** 4 người chơi trọn trận 3 vòng qua 4G, không ai bị rớt khỏi phòng.

## Giai đoạn 2 — Đẹp và vui (tuần 8–12)

- [ ] Avatar low-poly thật (.glb) thay capsule, tuỳ biến màu/mũ/kính
- [ ] Bục trao giải 3D ở màn chung cuộc
- [ ] Âm thanh, nhạc nền, rung phản hồi, Wake Lock
- [ ] Thêm 5 minigame (tổng 10)
- [ ] PWA: cài lên màn hình chính, cache asset
- [ ] Theo dõi lỗi bằng Sentry

**Cổng 2:** 60 FPS ổn định trên một Android tầm trung.

## Giai đoạn 3 — Giữ chân (tuần 13–18)

- [ ] Tài khoản Supabase (khách + Google), lưu lịch sử điểm
- [ ] Chế độ Kiểm tra não (chơi một mình, biểu đồ 5 kỹ năng)
- [ ] Đấu bóng ma (đấu lại lượt chơi đã lưu của bạn bè)
- [ ] Mũ phần thưởng khi lập kỷ lục
- [ ] Đủ 15 minigame
- [ ] (Tuỳ chọn) i18n tiếng Anh
