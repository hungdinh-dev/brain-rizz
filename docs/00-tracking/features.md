# Danh sách tính năng & use case

Bảng theo dõi **cái gì đã xong, cái gì chưa** ở mức người dùng nhìn thấy. Mỗi dòng trỏ về use case (UC) hoặc yêu cầu (FR) trong [SRS](../01-product/srs.md); muốn biết chi tiết hành vi thì mở SRS, muốn biết tiến độ thì xem ở đây.

Cập nhật lần cuối: **2026-10-21** · Phiên bản code: 0.1.0 (chưa gắn tag)

## Tổng quan

| Nhóm | Xong | Một phần | Chưa làm | Ý tưởng / chờ duyệt |
| --- | --- | --- | --- | --- |
| E1 Hồ sơ & vào game | 1 | 0 | 0 | 0 |
| E2 Phòng chơi | 9 | 1 | 1 | 0 |
| E3 Vòng chơi & chấm điểm | 7 | 0 | 0 | 0 |
| E4 Minigame | 5 game | 8 game (🚧 chờ chơi thử) | 2 game | 0 |
| E5 Giao diện & trải nghiệm | 8 | 0 | 2 | 0 (+1 huỷ) |
| E6 Vận hành & chất lượng | 3 | 1 | 3 | 0 |
| E7 Chế độ mở rộng & tài khoản | 0 | 5 (CR-009, CR-010, chờ Supabase thật) | 2 | 3 |

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
| UC-22 | Chat trong phòng: chữ 120 ký tự + 6 biểu cảm/câu chọn sẵn, bong bóng trên avatar, lọc từ tục, chủ phòng tắt chat, tắt tiếng trên máy mình, 30 tin gần nhất khi vào/nối lại; ẩn lúc đếm ngược/đang chơi (FR-PH-14 → 19, NFR-SEC-04) | 1 | ✅ | chưa phát hành | [CR-011](change-requests.md#cr-011) · `packages/shared/src/chat/chat.test.ts`, `PartyChat.test.ts`, `stores/chat.store.test.ts`; kiểm Chrome headless 390/1280 px với bot Colyseus (gửi, lọc, giới hạn tần suất, tắt tiếng, tắt chat, ẩn ở countdown/playing) · **chưa thử 2 điện thoại thật, chưa thử bàn phím ảo iOS** |
| UC-23 | Chơi với bot: chủ phòng thêm bot 4 mức (Dễ, Vừa, Khó, Siêu) vào ô trống, nút "Chơi với máy" ở menu (1–7 bot, một mức chung), bot nhường ghế cho người thật, biểu cảm nhanh, lịch sử gắn nhãn "Đấu với máy" (FR-PH-20 → 26) | 1 | ⏳ | — | [CR-016](change-requests.md#cr-016) duyệt 2026-10-21 · [Kế hoạch chơi với bot](../01-product/bot-players.md) |

## E3 — Vòng chơi & chấm điểm

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-06 | Chủ phòng đặt số vòng và bắt đầu trận (≥ 2 người, tất cả sẵn sàng) | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "chỉ chủ phòng đặt số vòng…", "không bắt đầu trận khi chưa đủ người…" |
| UC-20 | Chọn game mỗi vòng: vòng quay (server quyết định), chủ phòng chọn + bình chọn, không lặp game | 1 | ✅ | 0.1.0 | `PartyRoom.test.ts` nhóm "chọn game" (5 test) · FR-VC-13 → 16 |
| UC-21 | Màn hướng dẫn + mỗi người tự chọn độ khó, chủ phòng giám sát/nhắc, "Đã hiểu", tự bắt đầu sau 20 giây | 1 | ✅ | 0.1.0 | `PartyRoom.test.ts` nhóm "hướng dẫn + độ khó" (6 test) · FR-VC-12, FR-VC-17 → 19 |
| UC-07 | Chơi một vòng: đếm ngược 5 giây, sinh câu từ seed, server chấm lại, điểm/combo/khoá khi sai, hiện "+điểm", dải điểm real-time | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "cả hai máy nhận cùng seed…", `misc.test.ts` scoring; HUD kiểm tay |
| UC-08 | Bảng điểm vòng, cộng điểm trận, vinh danh top 3 kiểu Kahoot 2D | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "hoà điểm vòng thì cùng hạng…", "nhiều vòng: điểm trận cộng dồn…"; màn hình kiểm tay |
| FR-VC-21 | Điểm theo thể loại trong trận + thẻ "Giỏi nhất mỗi thể loại" ở màn vinh danh (hoà thì cùng nhận, thể loại cả phòng 0 điểm thì ẩn) | 1–2 | ✅ | chưa phát hành | [CR-010](change-requests.md#cr-010) · `match.test.ts` (`categoryLeaders`), `PartyRoom.test.ts` cộng dồn 3 vòng + reset; thẻ kiểm Chrome headless 390/1100/1440 px với state giả |
| UC-09 | Chơi lại (→ Chọn game vòng 1) / về phòng chờ | 0–1 | ✅ | 0.1.0 | `PartyRoom.test.ts` "vòng cuối vẫn qua round-results…playAgain…", "về phòng chờ từ podium…", "về phòng chờ từ round-results…" |

## E4 — Minigame

Trạng thái từng game theo dõi ở **[Danh mục minigame](../04-minigames/README.md)** (nguồn duy nhất, script `pnpm new-game` tự cập nhật). Tóm tắt:

| Mục tiêu | Cần | Đã có | Trạng thái |
| --- | --- | --- | --- |
| MVP (GĐ 1) | 5 game, mỗi nhóm một game | **5/5** (2026-10-12): Kẻ lạc đàn, Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình · test 10.000 seed mỗi game, `PartyRoom.test.ts` "5 minigame MVP trên server" · cân bằng điểm [CR-006](change-requests.md#cr-006) đã có cơ chế, con số chốt sau chơi thử · **chưa chơi thử trên máy thật** | ✅ |
| Beta (GĐ 2) | 10 game | 5 ✅ + 8 🚧 (2026-10-14): Ai vừa biến mất, Lật cặp, Đếm khối, Bi rơi đâu, Chạm đích, Đếm tiền nhanh, Nhìn từ trên, Gấp hộp · đủ bộ sinh câu đố + test 10.000 seed, scene, màn hướng dẫn, chữ vi/en, đã đăng ký · chờ QA và chơi thử để chốt hệ số điểm | 🚧 |
| Release (GĐ 3) | 31 game (FR-MG-05: 15 game ban đầu + Luyện ngắm, Phấn trượt theo [CR-012](change-requests.md#cr-012) + 14 game mở rộng theo [CR-013](change-requests.md#cr-013), [CR-014](change-requests.md#cr-014)) | 5 ✅ + 25 🚧 · 2026-10-20: Bóng của ai, Luyện ngắm, Phấn trượt 🚧 (Kiểm tra não `BRAIN_TEST_RULES_VERSION` 3) · 2026-10-20 (tối): 14 game mở rộng 🚧 (Tráo cốc, Tìm bạn, Hình to hình nhỏ, Xếp lại tháp, Nhại nhịp, Chuỗi quy luật, Ô bí ẩn, Cổng luật, Đếm sĩ số, Giỏ hời nhất, Đường số, Mảnh vừa khít, Nối mạch, Rót vừa vạch): bộ sinh + test 10.000 seed + kiểm mẹo đoán, scene, màn hướng dẫn, chữ vi/en, đã đăng ký, chờ QA và chơi thử; `BRAIN_TEST_RULES_VERSION` 4 · còn thiếu Đập đúng hình | ⏳ |

## E5 — Giao diện & trải nghiệm

| ID | Tính năng | GĐ | Trạng thái | Có từ bản | Bằng chứng / ghi chú |
| --- | --- | --- | --- | --- | --- |
| UC-11 | Sáng/Tối/Theo hệ thống; tiếng Việt/tiếng Anh; nhớ lựa chọn | 0 | ✅ | 0.1.0 | `pnpm typecheck` ép đủ khoá en |
| FR-GD-03 | Phong cách bảng phấn, 6 nhân vật SVG, 7 biểu cảm | 0 | ✅ | 0.1.0 | [ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md) |
| FR-GD-04 | Menu hiện các chế độ chưa làm với nhãn "Sắp có" | 0 | ✅ | 0.1.0 | |
| FR-GD-09 | Lỗi server hiện thành thông báo theo mã | 0 | ✅ | 0.1.0 | |
| FR-GD-05 | Sân khấu 3D ở sảnh | — | ❌ Huỷ | | Thay bằng FR-PH-12 (ADR 0010); đã gỡ khỏi code 2026-10-12 |
| FR-GD-06 | Vinh danh kiểu Kahoot 2D, hồi hộp: hạng 4+ → 3 → 2 → trống dồn → hạng 1 (pháo giấy, kèn) | 1 | ✅ | 0.1.0 | Kiểm tay (CR-005) · nhịp mới [CR-010](change-requests.md#cr-010): `features/results/podium-timeline.test.ts`, kiểm Chrome headless 390/1100/1440 px với state giả · **chưa xem trận thật 2 máy, chưa nghe trống/kèn bằng tai** |
| FR-GD-10 | Nhạc nền nhiều bài + thanh nhạc trên header: phát/dừng, bài kế, âm lượng (máy tính); tự phát ở lần chạm đầu, nhỏ lại khi chơi, nhớ lựa chọn | 1 | ✅ | 0.1.0 | `features/music/*.test.ts` (tên bài, cài đặt lưu, store); kiểm Chrome headless 360/800/1280 px + vào pha chơi ([CR-007](change-requests.md#cr-007)) · đã có 2 bài nhạc (`8c2bfcf`, ghi ở `assets/LICENSES.md`) · **chưa thử iPhone** |
| FR-GD-07 | Âm thanh hiệu ứng: bấm nút, lỗi, đếm ngược, đúng/sai; nút bật/tắt riêng | 1 | ✅ | 0.1.0 | `features/sfx/sfx.test.ts`; kiểm Chrome headless chơi thật một vòng 2 tab (đúng/sai, lỗi server, 5 tiếng tick) ([CR-008](change-requests.md#cr-008)) · tiếng mặc định tạo bằng code, **chưa nghe thử bằng tai, chưa thử iPhone** |
| FR-GD-12 | Nút Hiệu ứng: Theo hệ thống / Luôn bật; một nguồn "giảm chuyển động" cho React, CSS, scene minigame | 1 | ✅ | chưa phát hành | [CR-010](change-requests.md#cr-010) · `features/motion/motion.test.ts`; kiểm Chrome headless có `--force-prefers-reduced-motion` (chấm cam, bấm → `data-motion="on"`, nhớ lựa chọn) |
| FR-GD-11 | Rung phản hồi, Wake Lock | 2 | ⏳ | | Tách từ FR-GD-07 (CR-008) |
| FR-GD-08 | PWA cài lên màn hình chính | 2 | ⏳ | | |

## E6 — Vận hành & chất lượng

| Hạng mục | GĐ | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| CI GitHub Actions (lint, typecheck, test, build) | 0 | 🟡 | Repo đã lên GitHub (`hungdinh-dev/brain-rizz`); chưa xác nhận lần chạy CI đầu xanh |
| Docker + `fly.toml` cho game server | 0 | ✅ | Chưa deploy thật |
| Script tải thử (`loadtest`) 8 người | 0 | ✅ | |
| Test 10.000 seed cho bộ sinh câu đố | 0 | ✅ | Bắt buộc với mọi minigame mới |
| Deploy web (Cloudflare Pages) + server (Fly.io) | 1 | ⏳ | [Triển khai](../03-guides/deployment.md) |
| Test Playwright nhiều trình duyệt | 1 | ⏳ | |
| Theo dõi lỗi Sentry | 2 | ⏳ | |

## E7 — Chế độ mở rộng & tài khoản

| ID | Tính năng | GĐ | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| UC-13 | Luyện tập: chọn game + độ khó, chơi trên máy, kỷ lục | 1–2 | 🟡 Code xong, chờ kiểm với Supabase thật | [CR-009](change-requests.md#cr-009) · FR-MR-01, FR-MR-07 |
| UC-14 | Kiểm tra não: 5 game server chấm, Điểm Não, biểu đồ 5 kỹ năng | 1–2 | 🟡 Code xong, chờ kiểm với Supabase thật | CR-009 · FR-MR-02, FR-MR-08 · phòng `BrainTestRoom` |
| UC-15 | Đấu bóng ma | 3 | ⏳ | |
| UC-16 | Tài khoản Supabase (khách + Google), lịch sử 3 loại, xoá dữ liệu | 1–2 | 🟡 Code xong, chờ kiểm với Supabase thật + Google | CR-009 · FR-MR-04, FR-MR-09 → 11, FR-MR-15 · [ADR 0011](../02-architecture/decisions/0011-supabase-accounts-and-solo-modes.md) |
| FR-MR-16 | Lưu điểm + danh hiệu theo thể loại của trận party; thẻ "Thế mạnh trong trận party" ở Tài khoản | 1–2 | 🟡 Code xong, chờ chạy migration trên Supabase thật | [CR-010](change-requests.md#cr-010) · `PartyResults.test.ts`, `features/account/strengths.test.ts` · migration `20261019000000_match_category_scores.sql` |
| FR-MR-05 | Mũ phần thưởng khi lập kỷ lục | 3 | ⏳ | Tách khỏi UC-16 đợt CR-009 |
| UC-17 | Thử thách hôm nay | — | 💡 | [CR-003](change-requests.md#cr-003) |
| UC-18 | Tìm trận với người lạ | — | 💡 | CR-003 |
| UC-19 | Bảng xếp hạng Điểm Não + từng minigame, tuần / mọi thời đại | 1–2 | 🟡 Code xong, chờ kiểm với Supabase thật | CR-009 (tách khỏi CR-003) · FR-MR-12, FR-MR-13 |
| FR-MR-14 | Bảng xếp hạng bạn bè | — | 💡 | Chờ tính năng kết bạn (CR mới) |

## Cách cập nhật

1. Bắt đầu làm một dòng → đổi sang 🚧.
2. Xong (đạt [Definition of Done](../03-guides/sdlc.md#3-definition-of-ready--done)) → ✅, ghi "Có từ bản" là phiên bản sắp phát hành, ghi bằng chứng (tên test hoặc "kiểm tay"), thêm một dòng vào mục `[Chưa phát hành]` của [Nhật ký phát hành](changelog.md).
3. Tính năng mới chưa có trong SRS → **không thêm thẳng vào đây**; mở [yêu cầu thay đổi](change-requests.md) trước, duyệt xong mới thêm dòng 💡 → ⏳.
4. Cập nhật bảng "Tổng quan" và ngày cập nhật ở đầu file.

[← Theo dõi](README.md) · [Mục lục tài liệu](../README.md)
