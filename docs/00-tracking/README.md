# 00 · Theo dõi

Tài liệu "sống": dự án đang ở đâu, đã xong gì, đã đổi gì. Đây là thư mục mở ra đầu tiên khi muốn xem tiến độ.

docs/
├─ README.md                  -> Mục lục chung: bản đồ SDLC, "bạn là ai thì đọc gì", quy ước đặt tài liệu mới
│
├─ 00-tracking/               THEO DÕI: tài liệu cập nhật liên tục, xem tiến độ thì mở đây
│  ├─ README.md               -> Mục lục thư mục
│  ├─ status.md               -> Báo cáo tình trạng hằng tuần: đang ở giai đoạn nào, sức khoẻ dự án, rủi ro, việc chờ bạn quyết
│  ├─ features.md             -> Theo dõi tính năng/use case đã xong hay chưa (khác srs.md: srs nói "phải làm gì", file này nói "làm tới đâu")
│  ├─ changelog.md            -> Nhật ký phát hành: mỗi phiên bản (0.1.0, 0.5.0…) thay đổi gì
│  ├─ change-requests.md      -> Sổ yêu cầu thay đổi (CR): muốn thêm/đổi/bỏ tính năng thì bắt đầu ở đây
│  └─ reports/                -> Báo cáo ngày: mỗi ngày làm việc một file YYYY-MM-DD.md, việc theo giờ, file đã sửa, lỗi đã sửa
│
├─ 01-product/                SẢN PHẨM: làm gì, cho ai, chơi thế nào, khi nào xong
│  ├─ README.md               -> Mục lục thư mục
│  ├─ vision.md               -> Tầm nhìn & phạm vi: mục tiêu, chỉ số thành công, trong/ngoài phạm vi, sổ rủi ro, câu hỏi mở
│  ├─ brd.md                  -> Yêu cầu nghiệp vụ: chân dung người chơi, hành trình, BR-xx, quy tắc nghiệp vụ RULE-xx
│  ├─ srs.md                  -> Đặc tả yêu cầu phần mềm (BẢN GỐC): use case UC-xx, chức năng FR-xx, phi chức năng NFR-xx, truy vết
│  ├─ game-design.md          -> Thiết kế game (GDD): vòng lặp chơi, chế độ, cách tính điểm, độ khó, nhân vật, âm thanh
│  ├─ ui-ux.md                -> Thiết kế giao diện: bản đồ màn hình, màn nào đã thiết kế/đã code, link canvas, màu & font
│  └─ roadmap.md              -> CÁC GIAI ĐOẠN: mốc thời gian, Gantt, cổng kiểm tra, checklist từng giai đoạn
│
├─ 02-architecture/           KIẾN TRÚC: xây thế nào, bằng gì
│  ├─ README.md               -> Mục lục thư mục
│  ├─ overview.md             -> Sơ đồ hệ thống, vòng đời phòng chơi, giao thức tin nhắn, đồng bộ giờ, mất kết nối
│  ├─ tech-stack.md           -> Công nghệ + phiên bản, dịch vụ hosting, biến môi trường, lộ trình làm quen cho dev mới
│  ├─ folder-structure.md     -> Cây thư mục code + "muốn sửa X thì mở file nào"
│  └─ decisions/              Quyết định kỹ thuật (ADR): vì sao chọn cái này mà không chọn cái kia
│     ├─ README.md            -> Danh sách ADR và trạng thái
│     ├─ _template.md         -> Mẫu viết ADR mới
│     ├─ 0001-…               -> Monorepo pnpm + Turborepo
│     ├─ 0002-…               -> Game server Colyseus thay vì Supabase Realtime
│     ├─ 0003-…               -> Câu đố sinh từ seed, server chấm lại
│     ├─ 0004-…               -> Hosting: Cloudflare Pages + Fly.io
│     ├─ 0005-…               -> Web là SPA Vite, không dùng Next.js
│     ├─ 0006-…               -> Giao diện shadcn/ui + token màu sáng/tối
│     ├─ 0007-…               -> Đa ngôn ngữ i18next
│     ├─ 0008-…               -> Code web chia theo feature, mỗi minigame một thư mục
│     └─ 0009-…               -> Phong cách bảng phấn + nhân vật SVG
│
├─ 03-guides/                 HƯỚNG DẪN: làm từng việc cụ thể
│  ├─ README.md               -> Mục lục thư mục
│  ├─ sdlc.md                 -> Quy trình làm việc: điều kiện bắt đầu/xong, git, đánh số phiên bản, các bước phát hành, khi nào cập nhật file nào
│  ├─ testing.md              -> Kế hoạch kiểm thử: các tầng test, kịch bản kiểm tay, thiết bị cần thử, checklist trước phát hành
│  ├─ development.md          -> Cài đặt, chạy dự án, quy ước code, cách thêm minigame, xử lý sự cố
│  ├─ deployment.md           -> Đưa web và server lên mạng, so sánh hosting miễn phí/giá rẻ
│  ├─ assets.md               -> Nguồn hình/model 3D/âm thanh miễn phí, giấy phép, cách tối ưu
│  └─ ai-agents.md            -> Đội 5 AI agent theo phòng ban, cách giao việc, chạy song song
│
└─ 04-minigames/              MINIGAME
   ├─ README.md               -> Danh sách 15 minigame + trạng thái từng game (nguồn duy nhất, script tự cập nhật)
   ├─ _template.md            -> Mẫu đặc tả minigame mới
   └─ odd-one-out.md          -> Đặc tả "Kẻ lạc đàn" (game đã làm)

| Tài liệu | Trả lời câu hỏi | Cập nhật khi |
| --- | --- | --- |
| [status.md](status.md) | Tuần này dự án thế nào? Có gì cần quyết? | Mỗi tuần, mỗi lần qua cổng |
| [features.md](features.md) | Use case / tính năng nào đã xong, bản nào có? | Bắt đầu và xong mỗi tính năng |
| [changelog.md](changelog.md) | Mỗi phiên bản thay đổi gì? | Mỗi thay đổi được merge, mỗi lần phát hành |
| [change-requests.md](change-requests.md) | Phạm vi đã đổi gì so với kế hoạch, vì sao? | Mỗi khi muốn thêm/đổi/bỏ tính năng |
| [reports/](reports/README.md) | Hôm đó ai làm gì, lúc mấy giờ, sửa file nào, lỗi nào? | Cuối mỗi ngày làm việc |

[← Mục lục tài liệu](../README.md)
