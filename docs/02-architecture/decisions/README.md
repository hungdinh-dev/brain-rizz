# Architecture Decision Records (ADR)

Mỗi file ghi một quyết định kỹ thuật: bối cảnh, lựa chọn, lý do, hệ quả. Khi đổi ý, **không sửa ADR cũ** — viết ADR mới và đánh dấu ADR cũ là "Bị thay thế bởi …".

| # | Quyết định | Trạng thái |
| --- | --- | --- |
| [0001](0001-monorepo-pnpm-turborepo.md) | Monorepo pnpm + Turborepo, TypeScript toàn bộ | Đã chấp nhận |
| [0002](0002-game-server-colyseus-vs-supabase-realtime.md) | Dùng game server Colyseus thay vì chỉ Supabase Realtime | Đã chấp nhận |
| [0003](0003-seeded-deterministic-puzzles.md) | Câu đố sinh tất định từ seed, server chấm lại | Đã chấp nhận |
| [0004](0004-hosting-strategy.md) | Hosting: Cloudflare Pages + Fly.io tự tắt, Render Free dự phòng | Đã chấp nhận |
| [0005](0005-web-vite-spa-vs-nextjs.md) | Web client là SPA Vite + React, không dùng Next.js | Đã chấp nhận |
| [0006](0006-ui-shadcn-and-theme-tokens.md) | Component UI theo shadcn/ui, màu qua token ngữ nghĩa (sáng/tối) | Đã chấp nhận (phần 3D thay bởi 0010) |
| [0007](0007-i18n-inline-resources.md) | Đa ngôn ngữ bằng i18next, bản dịch viết trong code | Đã chấp nhận (thời điểm tải bổ sung bởi 0012) |
| [0008](0008-web-feature-folders-and-game-modules.md) | Web tổ chức theo feature, mỗi minigame một thư mục | Đã chấp nhận (phần 3D thay bởi 0010) |
| [0009](0009-chalkboard-style-and-characters.md) | Phong cách bảng phấn, thẻ nhãn dán và nhân vật SVG thay chấm màu avatar | Đã chấp nhận (phần 3D thay bởi 0010) |
| [0010](0010-drop-3d-2d-lobby-and-podium.md) | Bỏ 3D: phòng chờ và vinh danh chung cuộc bằng 2D | Đã chấp nhận (đã làm 2026-10-12) |
| [0011](0011-supabase-accounts-and-solo-modes.md) | Tài khoản, lịch sử, bảng xếp hạng trên Supabase; Kiểm tra não chấm trên game server | Đã chấp nhận |
| [0012](0012-i18n-lazy-chunks.md) | Tải lười chữ của màn một mình và minigame (bổ sung 0007) | Đã chấp nhận |
| [0013](0013-client-timed-answers.md) | Đáp án đo thời gian phía client (Rót vừa vạch, Nhại nhịp): tin số đo như Luyện ngắm, chấm thời lượng/khoảng cách, server không đổi (bổ sung 0003) | Đã chấp nhận |
| [0014](0014-server-side-bots.md) | Bot chạy trên game server, mô phỏng kết quả (thời gian nghĩ, đúng/sai) và chấm cùng luật với người, không giải câu đố (CR-016) | Đã chấp nhận |

Mẫu cho ADR mới: [_template.md](_template.md).

[← Kiến trúc](../README.md) · [Mục lục tài liệu](../../README.md)
