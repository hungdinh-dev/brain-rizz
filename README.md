# Brain Rizz

Web party game gồm các **minigame trí tuệ** (cảm hứng từ Big Brain Academy) cho **2–8 người chơi real-time** cùng bạn bè, chạy trên điện thoại, tablet và máy tính, không cần cài đặt.

> Trạng thái: **Giai đoạn 0 — Nền móng** · 5/15 minigame (đủ 5 game MVP) · xem [tình trạng dự án](docs/00-tracking/status.md) và [lộ trình](docs/01-product/roadmap.md)

## Bắt đầu nhanh

Yêu cầu: **Node.js ≥ 22.12** và **pnpm 10** (bật bằng `corepack enable`).

```bash
corepack enable          # bật pnpm đúng phiên bản khai báo trong package.json
pnpm install             # cài toàn bộ workspace
pnpm dev                 # chạy song song web (5173) + game server (2567)
```

Mở <http://localhost:5173>, tạo phòng, rồi mở thêm một tab (hoặc điện thoại cùng Wi-Fi qua `http://<IP-máy-tính>:5173`) để vào bằng mã phòng.

| Lệnh | Việc làm |
| --- | --- |
| `pnpm dev` | Chạy web + server ở chế độ dev (hot reload) |
| `pnpm dev:web` / `pnpm dev:server` | Chạy riêng từng phần |
| `pnpm build` | Build production (web → `apps/web/dist`, server → `apps/server/dist`) |
| `pnpm test` | Chạy unit test (Vitest) |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript toàn repo |
| `pnpm lint` / `pnpm format` | Kiểm tra / tự sửa định dạng bằng Biome |
| `pnpm check` | lint + typecheck + test (chạy trước khi commit) |
| `pnpm new-game <id> <nhóm>` | Tạo khung minigame mới (shared + web + đặc tả), tự đăng ký |

Công cụ dev của server: <http://localhost:2567/monitor> (xem phòng đang mở) và <http://localhost:2567/playground> (gửi tin nhắn thử).

## Cấu trúc thư mục

```text
brain-rizz/
├─ apps/
│  ├─ web/                  # Client: Vite + React 19 + Tailwind 4 + shadcn/ui + Phaser 4
│  │  └─ src/
│  │     ├─ app/            # Khung app: chọn màn hình theo pha của phòng
│  │     ├─ features/       # Mỗi màn hình một feature: home, lobby, game-select, game-intro, play, results
│  │     ├─ games/<id>/     # Mỗi minigame một thư mục: scene Phaser (tải theo nhu cầu) + tên/cách chơi
│  │     ├─ components/     # ui/ (shadcn đã chỉnh) + common/ (dùng ở nhiều feature)
│  │     ├─ i18n/           # Tiếng Việt + tiếng Anh (i18next)
│  │     ├─ net/            # Kết nối Colyseus, đồng bộ giờ, nối lại
│  │     └─ stores/         # State phía client (Zustand): phòng chơi, theme sáng/tối
│  └─ server/               # Game server: Colyseus 0.18 (Node.js)
│     └─ src/rooms/         # PartyRoom: phòng chơi, đồng hồ, chấm điểm
├─ packages/
│  └─ shared/src/           # Code dùng chung client ↔ server: PRNG, giao thức, tính điểm
│     └─ games/<id>/        # Bộ sinh câu đố của từng minigame (tất định theo seed) + test
├─ assets/                  # File nguồn đồ hoạ/âm thanh (Blender, Figma…) — KHÔNG ship trực tiếp
├─ docs/
│  ├─ 00-tracking/          # Tình trạng, danh sách tính năng, changelog, yêu cầu thay đổi
│  ├─ 01-product/           # Tầm nhìn, BRD, SRS, thiết kế game, UI/UX, lộ trình
│  ├─ 02-architecture/      # Kiến trúc, tech stack, cây thư mục, quyết định kỹ thuật (decisions/)
│  ├─ 03-guides/            # Quy trình SDLC, kiểm thử, phát triển, triển khai, asset, AI agent
│  └─ 04-minigames/         # Danh mục và đặc tả từng minigame
├─ fly.toml                 # Cấu hình deploy game server lên Fly.io
└─ turbo.json, pnpm-workspace.yaml, biome.json, tsconfig.base.json
```

## Tài liệu

Mục lục đầy đủ: [docs/README.md](docs/README.md). Hay dùng nhất:

| Tài liệu | Nội dung |
| --- | --- |
| [Tình trạng dự án](docs/00-tracking/status.md) | Tuần này dự án thế nào, cần quyết định gì |
| [Danh sách tính năng](docs/00-tracking/features.md) | Use case nào đã xong, bản nào có |
| [Tầm nhìn & phạm vi](docs/01-product/vision.md) | Làm gì, cho ai, mục tiêu, rủi ro |
| [SRS](docs/01-product/srs.md) · [Thiết kế game](docs/01-product/game-design.md) · [UI/UX](docs/01-product/ui-ux.md) | Yêu cầu, luật chơi, màn hình |
| [Lộ trình](docs/01-product/roadmap.md) | Mốc thời gian, cổng kiểm tra, checklist |
| [Quy trình phát triển](docs/03-guides/sdlc.md) | Làm một tính năng từ ý tưởng tới phát hành |
| [Tổng quan kiến trúc](docs/02-architecture/overview.md) | Luồng một phòng chơi, giao thức tin nhắn |
| [Cây thư mục](docs/02-architecture/folder-structure.md) | File nào làm gì, **muốn sửa gì thì mở file nào** |
| [Quyết định kỹ thuật (ADR)](docs/02-architecture/decisions/README.md) | Vì sao Colyseus, vì sao seed, vì sao host ở đó |
| [Hướng dẫn phát triển](docs/03-guides/development.md) | Cài đặt, quy ước code, **cách thêm một minigame** |
| [Triển khai](docs/03-guides/deployment.md) | Deploy web + server, hosting miễn phí/giá rẻ |
| [Asset](docs/03-guides/assets.md) | Nguồn model 3D/2D, giấy phép, pipeline tối ưu |
| [Minigame](docs/04-minigames/README.md) | Danh mục và đặc tả từng game |

## Tech stack

TypeScript 7 · pnpm workspaces + Turborepo · Vite 8 · React 19 · Tailwind CSS 4 · Phaser 4 · Zustand · Colyseus 0.18 · Zod 4 · Vitest 5 · Biome 2.
Phiên bản, vai trò và lý do chọn từng thứ: [Tech stack](docs/02-architecture/tech-stack.md).
