# Danh sách tính năng & use case

Bảng theo dõi **cái gì đã xong, cái gì chưa** ở mức người dùng nhìn thấy. Mỗi dòng trỏ về use case (UC) hoặc yêu cầu (FR) trong [SRS](../01-product/srs.md); muốn biết chi tiết hành vi thì mở SRS, muốn biết tiến độ thì xem ở đây.

Cập nhật lần cuối: **2026-10-14** · Phiên bản code: 0.1.0 (chưa gắn tag)

## Tổng quan

| Nhóm | Xong | Một phần | Chưa làm | Ý tưởng / chờ duyệt |
| --- | --- | --- | --- | --- |
| E1 Hồ sơ & vào game | 1 | 0 | 0 | 0 |
| E2 Phòng chơi | 8 | 1 | 0 | 0 |
| E3 Vòng chơi & chấm điểm | 6 | 0 | 0 | 0 |
| E4 Minigame | 5 game | 8 game (🚧 chờ chơi thử) | 2 game | 0 |
| E5 Giao diện & trải nghiệm | 5 | 0 | 2 | 0 (+1 huỷ) |
| E6 Vận hành & chất lượng | 3 | 1 | 3 | 0 |
| E7 Chế độ mở rộng & tài khoản | 0 | 0 | 4 | 3 |

**Chú thích trạng thái:** ✅ Xong (chạy được, có test hoặc đã kiểm tay) · 🟡 Một phần · 🚧 Đang làm · ⏳ Chưa làm (đã có trong kế hoạch) · 💡 Ý tưởng, chờ [yêu cầu thay đổi](change-requests.md) được duyệt · ❌ Huỷ

**Cột "Có từ bản":** phiên bản đầu tiên có tính năng này (xem [Nhật ký phát hành](changelog.md)). Bản 0.1.0 sẽ gắn tag khi qua Cổng 0.

## E1 — Hồ sơ & vào game

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-01 | Thiết lập hồ sơ: tên, 6 nhân vật, độ khó; lưu trên máy; làm tiếp thao tác dở | 0 | ✅ | 0.1.0 | `features/home/profile.test.ts`; FR-HS-01 → 04 |

## E2 — Phòng chơi

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-02 | Tạo phòng riêng, mã 4 ký tự, người tạo là chủ phòng | 0 | ✅ | 0.1.0 | `PartyRoom.test.ts` "tạo phòng với mã 4 ký tự…" |
| UC-03 | Vào phòng bằng mã hoặc link `/r/<mã>`; từ chối khi đang chơi/đầy/hồ sơ sai | 0 | ✅ | 0.1.0 | `PartyRoom.test.ts` "từ chối tên không hợp lệ", "từ chối nhân vật lạ" |
| UC-04 | Mời bạn: chia sẻ (điện thoại) / copy link (máy tính) | 0 | 🟡 | 0.1.0 | Chia sẻ và copy ✅ · QR code ⏳ (FR-PH-09, GĐ 1) |
| UC-05 | Chuẩn bị ở phòng chờ 2D: sẵn sàng, đổi nhân vật trong phòng | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "setProfile đổi nhân vật…không huỷ sẵn sàng"; kiểm tay 3 tab ([CR-005](change-requests.md#cr-005)) |
| UC-10 | Nối lại khi rớt mạng (giữ chỗ 45 giây, tải lại trang vẫn vào lại) | 0 | ✅ | 0.1.0 | `PartyRoom.test.ts` "tải lại trang ở game-select…, game-intro, round-results: vào lại đúng chỗ"; rớt mạng giữa chừng mới kiểm tay |
| UC-12 | Rời phòng, chuyển quyền chủ phòng | 0 | ✅ | 0.1.0 | Kiểm tay |
| FR-PH-11 | Số người tối thiểu để bắt đầu và chơi lại = 2 | 1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "không bắt đầu trận khi chưa đủ người…", "chơi lại cần ≥ 2 người…" |
| FR-PH-12 | Phòng chờ 2D: 8 ô người chơi, đếm sẵn sàng x/y, gỡ sân khấu 3D | 1 | ✅ | 0.1.0 | Kiểm tay; đã gỡ three.js (ADR 0010) |
| FR-PH-13 | Ẩn/hiện + sao chép mã phòng; đổi nhân vật trong phòng chờ | 1 | ✅ | 0.1.0 | Kiểm tay |

## E3 — Vòng chơi & chấm điểm

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-06 | Chủ phòng đặt số vòng và bắt đầu trận (≥ 2 người, tất cả sẵn sàng) | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "chỉ chủ phòng đặt số vòng…", "không bắt đầu trận khi chưa đủ người…" |
| UC-20 | Chọn game mỗi vòng: vòng quay (server quyết định), chủ phòng chọn + bình chọn, không lặp game | 1 | ✅ | 0.1.0 | `PartyRoom.test.ts` nhóm "chọn game" (5 test) · FR-VC-13 → 16 |
| UC-21 | Màn hướng dẫn + mỗi người tự chọn độ khó, chủ phòng giám sát/nhắc, "Đã hiểu", tự bắt đầu sau 20 giây | 1 | ✅ | 0.1.0 | `PartyRoom.test.ts` nhóm "hướng dẫn + độ khó" (6 test) · FR-VC-12, FR-VC-17 → 19 |
| UC-07 | Chơi một vòng: đếm ngược 5 giây, sinh câu từ seed, server chấm lại, điểm/combo/khoá khi sai, hiện "+điểm", dải điểm real-time | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "cả hai máy nhận cùng seed…", `misc.test.ts` scoring; HUD kiểm tay |
| UC-08 | Bảng điểm vòng, cộng điểm trận, vinh danh top 3 kiểu Kahoot 2D | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "hoà điểm vòng thì cùng hạng…", "nhiều vòng: điểm trận cộng dồn…"; màn hình kiểm tay |
| UC-09 | Chơi lại (→ Chọn game vòng 1) / về phòng chờ | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "vòng cuối vẫn qua round-results…playAgain…", "về phòng chờ từ podium…", "về phòng chờ từ round-results…" |

## E4 — Minigame

Trạng thái từng game theo dõi ở **[Danh mục minigame](../04-minigames/README.md)** (nguồn duy nhất, script `pnpm new-game` tự cập nhật). Tóm tắt:

| Mục tiêu | Cần | Đã có | Trạng thái |
| --- | --- | --- | --- |
| MVP (GĐ 1) | 5 game, mỗi nhóm một game | **5/5** (2026-10-12): Kẻ lạc đàn, Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình · test 10.000 seed mỗi game, `PartyRoom.test.ts` "5 minigame MVP trên server" · cân bằng điểm [CR-006](change-requests.md#cr-006) đã có cơ chế, con số chốt sau chơi thử · **chưa chơi thử trên máy thật** | ✅ |
| Beta (GĐ 2) | 10 game | 5 ✅ + 8 🚧 (2026-10-14): Ai vừa biến mất, Lật cặp, Đếm khối, Bi rơi đâu, Chạm đích, Đếm tiền nhanh, Nhìn từ trên, Gấp hộp · đủ bộ sinh câu đố + test 10.000 seed, scene, màn hướng dẫn, chữ vi/en, đã đăng ký · chờ QA và chơi thử để chốt hệ số điểm | 🚧 |
| Release (GĐ 3) | 15 game | 5 ✅ + 8 🚧 · còn thiếu Bóng của ai, Đập đúng hình | ⏳ |

## E5 — Giao diện & trải nghiệm

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-11 | Sáng/Tối/Theo hệ thống; tiếng Việt/tiếng Anh; nhớ lựa chọn | 0 | ✅ | 0.1.0 | `pnpm typecheck` ép đủ khoá en |
| FR-GD-03 | Phong cách bảng phấn, 6 nhân vật SVG, 7 biểu cảm | 0 | ✅ | 0.1.0 | [ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md) |
| FR-GD-04 | Menu hiện các chế độ chưa làm với nhãn "Sắp có" | 0 | ✅ | 0.1.0 | |
| FR-GD-09 | Lỗi server hiện thành thông báo theo mã | 0 | ✅ | 0.1.0 | |
| FR-GD-05 | Sân khấu 3D ở sảnh | — | ❌ Huỷ | | Thay bằng FR-PH-12 (ADR 0010); đã gỡ khỏi code 2026-10-12 |
| FR-GD-06 | Vinh danh top 3 kiểu Kahoot, 2D | 1 | ✅ | 0.1.0 | Kiểm tay (CR-005) |
| FR-GD-07 | Âm thanh, nhạc, rung, Wake Lock | 2 | ⏳ | | |
| FR-GD-08 | PWA cài lên màn hình chính | 2 | ⏳ | | |

## E6 — Vận hành & chất lượng

| Hạng mục | GĐ | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| CI GitHub Actions (lint, typecheck, test, build) | 0 | 🟡 | File `ci.yml` có sẵn; chưa chạy vì repo chưa lên GitHub |
| Docker + `fly.toml` cho game server | 0 | ✅ | Chưa deploy thật |
| Script tải thử (`loadtest`) 8 người | 0 | ✅ | |
| Test 10.000 seed cho bộ sinh câu đố | 0 | ✅ | Bắt buộc với mọi minigame mới |
| Deploy web (Cloudflare Pages) + server (Fly.io) | 1 | ⏳ | [Triển khai](../03-guides/deployment.md) |
| Test Playwright nhiều trình duyệt | 1 | ⏳ | |
| Theo dõi lỗi Sentry | 2 | ⏳ | |

## E7 — Chế độ mở rộng & tài khoản

| ID | Tính năng | GĐ | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| UC-13 | Luyện tập | 3 | ⏳ | Đã có mục "Sắp có" ở menu |
| UC-14 | Kiểm tra não | 3 | ⏳ | |
| UC-15 | Đấu bóng ma | 3 | ⏳ | |
| UC-16 | Tài khoản, lịch sử điểm, mũ phần thưởng | 3 | ⏳ | |
| UC-17 | Thử thách hôm nay | — | 💡 | [CR-003](change-requests.md#cr-003) |
| UC-18 | Tìm trận với người lạ | — | 💡 | CR-003 |
| UC-19 | Bảng xếp hạng | — | 💡 | CR-003 |

## Cách cập nhật

1. Bắt đầu làm một dòng → đổi sang 🚧.
2. Xong (đạt [Definition of Done](../03-guides/sdlc.md#3-definition-of-ready--done)) → ✅, ghi "Có từ bản" là phiên bản sắp phát hành, ghi bằng chứng (tên test hoặc "kiểm tay"), thêm một dòng vào mục `[Chưa phát hành]` của [Nhật ký phát hành](changelog.md).
3. Tính năng mới chưa có trong SRS → **không thêm thẳng vào đây**; mở [yêu cầu thay đổi](change-requests.md) trước, duyệt xong mới thêm dòng 💡 → ⏳.
4. Cập nhật bảng "Tổng quan" và ngày cập nhật ở đầu file.

[← Theo dõi](README.md) · [Mục lục tài liệu](../README.md)
