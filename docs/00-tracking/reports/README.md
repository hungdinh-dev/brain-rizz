# Báo cáo ngày

Nhật ký công việc từng ngày: ai làm gì, lúc mấy giờ, sửa file nào, lỗi nào được tìm ra và sửa ra sao. Mỗi ngày làm việc một file `YYYY-MM-DD.md`.

Khác với các tài liệu theo dõi khác:

| Tài liệu | Góc nhìn | Độ chi tiết |
| --- | --- | --- |
| **Báo cáo ngày** (thư mục này) | Việc đã làm trong ngày, theo giờ | Từng việc, từng file, từng lỗi |
| [Tình trạng dự án](../status.md) | Sức khoẻ dự án theo tuần | Tổng hợp, rủi ro, việc chờ quyết |
| [Danh sách tính năng](../features.md) | Use case nào xong | Theo tính năng |
| [Nhật ký phát hành](../changelog.md) | Người chơi thấy gì mới ở mỗi bản | Theo phiên bản |

## Danh sách

| Ngày | Mã | Giai đoạn | Nội dung chính |
| --- | --- | --- | --- |
| [2026-10-09](2026-10-09.md) | DR-20261009 | GĐ 0 | Sửa lỗi cài đặt, commit đầu, shadcn + sáng/tối + i18n, cấu trúc web theo feature, `pnpm new-game`, ADR 0005–0008 |
| [2026-10-10](2026-10-10.md) | DR-20261010 | GĐ 0 | Bảng phấn + 6 nhân vật vào code, đội 5 AI agent + 3 workflow, bộ tài liệu SDLC, duyệt luồng trận mới (CR-005, ADR 0010), đặc tả 4 minigame MVP |
| [2026-10-12](2026-10-12.md) | DR-20261012 | GĐ 0 (làm sớm GĐ 1) | Luồng trận mới CR-005 (phòng chờ 2D, chọn game, vinh danh, gỡ 3D), cân bằng điểm CR-006, đủ 5 minigame MVP, QA 4 vòng, 6 commit + push nhánh `feat/match-flow-and-mvp-games` |
| [2026-10-13](2026-10-13.md) | DR-20261013 | GĐ 0 | Merge PR #1, làm rõ CI/deploy và hosting real-time, kế hoạch dự phòng game server, chặn lỗi cấu hình Fly, bản mẫu UI 4 minigame |
| [2026-10-14](2026-10-14.md) | DR-20261014 | GĐ 1–2 | Bản mẫu 4 game cuối, 8 minigame mới qua `/new-minigame` (3 vòng QA), 12 commit nhánh `feat/beta-minigames`, nhạc nền (CR-007) + 2 bài nhạc, âm thanh hiệu ứng (CR-008), lập bộ báo cáo ngày, merge vào `main` |
| [2026-10-16](2026-10-16.md) | DR-20261016 | GĐ 1 | CR-009: Luyện tập, Kiểm tra não, Tài khoản Supabase, Bảng xếp hạng (ADR 0011, 0012); QA PASS, chờ kiểm với Supabase thật; chưa commit |
| [2026-10-19](2026-10-19.md) | DR-20261019 | GĐ 1 | CR-010: nút Hiệu ứng, vinh danh hồi hộp, điểm/danh hiệu theo thể loại; Supabase thật đã nối; `pnpm share`; merge vào `main`, tạo `dev` |
| [2026-10-20](2026-10-20.md) | DR-20261020 | GĐ 1 | Bóng của ai, Kẻ lạc đàn khó bằng sắc độ, chat real-time (CR-011), Luyện ngắm + Phấn trượt (CR-012, 17 game), hạn trả lời + đồng bộ khi nối lại; merge vào `dev`/`main` |
| [2026-10-21](2026-10-21.md) | DR-20261021 | GĐ 1 | Chơi với bot (CR-016, UC-23): kế hoạch, duyệt, code shared/server/web bằng `/feature`, cân bằng bằng mô phỏng, 2 đợt sửa QA |
| [2026-11-19](2026-11-19.md) | DR-20261119 | GĐ 1 | Trống quay dọc (CR-017), phòng 12 người + điểm thứ hạng co giãn (CR-018), trang quản trị + ghi đăng nhập (CR-019, ADR 0015); 2 đợt song song, QA 3 vòng; chưa commit, migration chưa chạy thử |
| [2026-11-20](2026-11-20.md) | DR-20261120 | GĐ 1 | Game yêu thích, hướng dẫn động 5 game, tách URL (CR-020 → 022); phấn, máy quay phụ kiện, tủ đồ, 6 bạn đồng hành mở khoá (CR-023/024, ADR 0016); QA 4 vòng; 2 migration chờ áp |
| [2026-11-21](2026-11-21.md) | DR-20261121 | GĐ 1 | Gói JS ban đầu 331,0 → 251,4 KiB gzip: tách Colyseus + zod khỏi gói đầu (`net/lazy-connection.ts`, NFR-PERF-01) |

Ngày 2026-10-11 không có phiên làm việc.

## Quy chuẩn

### Khi nào viết

- Cuối mỗi ngày có làm việc, hoặc cuối phiên nếu phiên kết thúc trong ngày. Ngày có nhiều phiên thì gộp vào một file.
- Phiên chính (điều phối) viết. Agent không tự viết báo cáo, nhưng báo cáo trả về của agent là nguồn cho mục 3 và 4.
- Báo cáo đã viết thì không sửa nội dung cũ, chỉ bổ sung. Phát hiện sai thì thêm dòng "Đính chính" ở cuối.

### Cấu trúc

Copy [_template.md](_template.md). Đủ 10 mục, mục nào không có gì thì ghi "Không phát sinh":

1. **Tóm tắt** — 3–5 dòng, đọc mỗi mục này là nắm được ngày.
2. **Kết quả bàn giao** — sản phẩm cuối ngày, kèm link file/CR/UC/ADR.
3. **Nhật ký công việc** — bảng theo giờ: `Giờ | Ai | Việc | Kết quả / file thay đổi`.
4. **Lỗi và sự cố** — mức, nguyên nhân, cách xử lý, ai sửa, trạng thái.
5. **Quyết định** — kèm link ADR/CR.
6. **Kiểm thử và chất lượng** — kết quả `pnpm check`, số test, những gì chưa kiểm được.
7. **Tài liệu đã cập nhật.**
8. **Rủi ro và vướng mắc.**
9. **Việc tồn và kế hoạch tiếp theo** — checklist.
10. **Commit trong ngày** — hoặc ghi rõ "chưa commit".

### Cách ghi

- **Giờ** là giờ Việt Nam (UTC+7), lấy từ lúc việc thực sự diễn ra, không lấy giờ commit (commit thường gom nhiều ngày).
- **Ai**: `Chủ dự án`, `Điều phối` (phiên Claude chính) hoặc tên agent trong backtick (`qa-tester`, `frontend-dev`, `backend-dev`, `game-designer`, `ui-designer`). Workflow ghi tên lệnh (`/new-minigame`, `/qa-fix`).
- **Link file** dùng đường dẫn tương đối từ thư mục này: code `../../../apps/...`, tài liệu `../../01-product/...`; chỉ đến dòng thì thêm `#L28`. File đã xoá hoặc đổi tên sau đó thì ghi bằng `code`, không link.
- **Mức lỗi**: `blocker` (không chạy/không build được), `major` (sai chức năng, sai điểm, hỏng bất biến), `minor` (giao diện, chữ, a11y, tài liệu).
- **Trạng thái**: ✅ Xong · 🔄 Đang làm · ⏸ Hoãn · ⏳ Tồn. Tình trạng ngày: 🟢 đúng kế hoạch · 🟡 cần để ý · 🔴 có vấn đề.
- Chỉ ghi điều đã xảy ra và kiểm được. Không chắc thì ghi "Chưa rõ".

### Nguồn dữ liệu

Báo cáo 09–14/10 được dựng lại ngày 2026-10-14 từ lịch sử phiên Claude Code trên máy chủ dự án (`~/.claude/projects/…`) và `git log`. Phần trước 09/10 làm trong Claude Desktop, không có nhật ký; xem mục "Bối cảnh" của [báo cáo 09/10](2026-10-09.md).

[← Theo dõi](../README.md)
