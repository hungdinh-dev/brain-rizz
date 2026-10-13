# Tài liệu dự án Brain Rizz

Tài liệu tổ chức theo vòng đời phát triển (SDLC): từ tầm nhìn, yêu cầu, thiết kế, kế hoạch, tới xây dựng, kiểm thử, phát hành và theo dõi. Cách các tài liệu nối với nhau và khi nào cập nhật: [Quy trình phát triển](03-guides/sdlc.md).

```text
docs/
├─ 00-tracking/        THEO DÕI — đang ở đâu, đã xong gì, đã đổi gì (tài liệu sống)
├─ 01-product/         SẢN PHẨM — làm gì, cho ai, chơi thế nào, khi nào xong
├─ 02-architecture/    KIẾN TRÚC — xây thế nào, bằng gì, vì sao chọn vậy
│  └─ decisions/       Quyết định kỹ thuật (ADR)
├─ 03-guides/          HƯỚNG DẪN — làm từng việc cụ thể thế nào
└─ 04-minigames/       MINIGAME — đặc tả từng game
```

## Bắt đầu từ đâu

| Bạn là | Đọc |
| --- | --- |
| **Chủ dự án muốn xem tiến độ** | [Tình trạng dự án](00-tracking/status.md) → [Danh sách tính năng](00-tracking/features.md) → [Lộ trình](01-product/roadmap.md) |
| **Developer mới tham gia** | [Tech stack › Lộ trình làm quen](02-architecture/tech-stack.md#10-lộ-trình-làm-quen-cho-developer-mới) |
| **Muốn thêm tính năng sau khi đã phát hành** | [Quy trình phát triển › Đường đi của một tính năng](03-guides/sdlc.md#2-đường-đi-của-một-tính-năng) → [Yêu cầu thay đổi](00-tracking/change-requests.md) |
| **AI agent** | `AGENTS.md` ở thư mục gốc, rồi [Cây thư mục](02-architecture/folder-structure.md) khi cần tìm file |

## Bản đồ SDLC

| Giai đoạn | Tài liệu | Trả lời câu hỏi |
| --- | --- | --- |
| Khởi tạo | [Tầm nhìn & phạm vi](01-product/vision.md) | Làm gì, vì sao, thành công đo bằng gì, rủi ro gì? |
| Discovery | [Yêu cầu nghiệp vụ (BRD)](01-product/brd.md) | Người chơi là ai, cần gì, luật nghiệp vụ là gì? |
| Yêu cầu | [Đặc tả yêu cầu phần mềm (SRS)](01-product/srs.md) | Hệ thống phải làm gì (use case, FR, NFR)? |
| Thiết kế | [Thiết kế game (GDD)](01-product/game-design.md) | Chơi thế nào, tính điểm ra sao, độ khó, nhân vật? |
| | [Thiết kế UI/UX](01-product/ui-ux.md) | Có những màn hình nào, trông thế nào? Link bản mẫu canvas |
| | [Tổng quan kiến trúc](02-architecture/overview.md) | Các phần nói chuyện với nhau thế nào, tin nhắn nào đi đâu? |
| | [Tech stack](02-architecture/tech-stack.md) | Dùng công nghệ gì, phiên bản nào, dịch vụ nào? |
| | [Quyết định kỹ thuật (ADR)](02-architecture/decisions/README.md) | Vì sao chọn Colyseus, seed, hosting, shadcn…? |
| | [Đặc tả minigame](04-minigames/README.md) | Từng game chơi thế nào, sinh câu đố ra sao? |
| Kế hoạch | [Lộ trình & mốc thời gian](01-product/roadmap.md) | Khi nào xong, cổng kiểm tra là gì? |
| Xây dựng | [Hướng dẫn phát triển](03-guides/development.md), [Cây thư mục](02-architecture/folder-structure.md), [Đội AI agent](03-guides/ai-agents.md), [Asset](03-guides/assets.md) | Cài đặt, quy ước, thêm minigame, sửa gì mở file nào? |
| Kiểm thử | [Kiểm thử](03-guides/testing.md) | Test gì, trên máy nào, khi nào được phát hành? |
| Phát hành | [Triển khai](03-guides/deployment.md), [Nhật ký phát hành](00-tracking/changelog.md) | Deploy ở đâu, bản nào có gì? |
| Vận hành | [Tình trạng dự án](00-tracking/status.md), [Danh sách tính năng](00-tracking/features.md), [Yêu cầu thay đổi](00-tracking/change-requests.md) | Đang ở đâu, đã xong gì, đã đổi phạm vi gì? |

## Thêm tài liệu mới vào đâu

| Loại tài liệu | Đặt ở |
| --- | --- |
| Báo cáo tiến độ, theo dõi tính năng, nhật ký phát hành, yêu cầu thay đổi | `00-tracking/` (sửa file có sẵn, không tạo file mới cho mỗi tuần) |
| Tầm nhìn, yêu cầu, thiết kế game/UI, kế hoạch | `01-product/` |
| Thiết kế kỹ thuật | `02-architecture/` |
| Quyết định kỹ thuật (ADR) | `02-architecture/decisions/` — copy từ [_template.md](02-architecture/decisions/_template.md) |
| Hướng dẫn làm một việc (cài đặt, deploy, test, xử lý lỗi) | `03-guides/` |
| Đặc tả minigame | `04-minigames/<id>.md` — copy từ [_template.md](04-minigames/_template.md) (hoặc để `pnpm new-game` tạo) |

Quy ước:

- Tên file tiếng Anh, chữ thường, nối bằng gạch ngang (`kebab-case.md`); nội dung tiếng Việt.
- Chỉ thư mục mới đánh số; file bên trong không đánh số để thêm/bớt không phải đổi tên hàng loạt.
- Link giữa các tài liệu dùng đường dẫn tương đối và ghi tên tài liệu, không ghi tên file (vd. `[Triển khai](../03-guides/deployment.md)`).
- Mã định danh (`BR-`, `UC-`, `FR-`, `NFR-`, `CR-`, `R-`, `T-`) đã cấp thì không dùng lại; mục bị bỏ ghi "Huỷ".
- Tài liệu có bảng đầu trang (giai đoạn, phiên bản, khi nào cập nhật) và mục "Lịch sử thay đổi tài liệu" nếu là tài liệu đã chốt (vision, BRD, SRS, GDD, UI/UX).
- Thêm file xong nhớ thêm một dòng vào README của thư mục đó, bảng tương ứng ở trên và [Cây thư mục](02-architecture/folder-structure.md).
