# Brain Rizz

Web party game gồm các **minigame trí tuệ** (cảm hứng từ Big Brain Academy) cho **2–8 người chơi real-time** cùng bạn bè, chạy trên điện thoại, tablet và máy tính, không cần cài đặt.

> Trạng thái: **Giai đoạn 0 — Nền móng** · 1/15 minigame (Kẻ lạc đàn) · xem [lộ trình](docs/06-roadmap.md)

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

Công cụ dev của server: <http://localhost:2567/monitor> (xem phòng đang mở) và <http://localhost:2567/playground> (gửi tin nhắn thử).

## Cấu trúc thư mục

```text
brain-rizz/
├─ apps/
│  ├─ web/                  # Client: Vite + React 19 + Tailwind 4 + Phaser 4 + React Three Fiber
│  │  └─ src/
│  │     ├─ ui/             # Màn hình & component React (sảnh, kết quả…)
│  │     ├─ games/          # Mỗi minigame một scene Phaser (tải theo nhu cầu)
│  │     ├─ three/          # Cảnh 3D: sân khấu sảnh, avatar, bục trao giải
│  │     ├─ net/            # Kết nối Colyseus, đồng bộ giờ, nối lại
│  │     └─ store/          # State phía client (Zustand)
│  └─ server/               # Game server: Colyseus 0.18 (Node.js)
│     └─ src/rooms/         # PartyRoom: phòng chơi, đồng hồ, chấm điểm
├─ packages/
│  └─ shared/               # Code dùng chung client ↔ server: PRNG, bộ sinh câu đố, giao thức, tính điểm
├─ assets/                  # File nguồn đồ hoạ/âm thanh (Blender, Figma…) — KHÔNG ship trực tiếp
├─ docs/                    # Kế hoạch, kiến trúc, hướng dẫn, quyết định kỹ thuật (ADR)
├─ fly.toml                 # Cấu hình deploy game server lên Fly.io
└─ turbo.json, pnpm-workspace.yaml, biome.json, tsconfig.base.json
```

## Tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [docs/01-project-plan.md](docs/01-project-plan.md) | Kế hoạch dự án đầy đủ: thiết kế game, tech stack, chi phí, rủi ro |
| [docs/02-architecture.md](docs/02-architecture.md) | Kiến trúc, luồng một phòng chơi, giao thức tin nhắn |
| [docs/03-development-guide.md](docs/03-development-guide.md) | Cài đặt, quy ước code, **cách thêm một minigame** |
| [docs/04-deployment.md](docs/04-deployment.md) | Deploy web + server, các lựa chọn hosting miễn phí/giá rẻ |
| [docs/05-assets-guide.md](docs/05-assets-guide.md) | Nguồn model 3D/2D, giấy phép, pipeline tối ưu |
| [docs/06-roadmap.md](docs/06-roadmap.md) | Checklist công việc theo giai đoạn |
| [docs/adr/](docs/adr/) | Các quyết định kỹ thuật và lý do (vì sao Colyseus, vì sao seed…) |
| [docs/minigames/](docs/minigames/) | Đặc tả từng minigame |

## Tech stack

TypeScript 7 · pnpm workspaces + Turborepo · Vite 8 · React 19 · Tailwind CSS 4 · Phaser 4 · three.js + React Three Fiber 9 · Zustand · Colyseus 0.18 · Zod 4 · Vitest 5 · Biome 2.
Lý do chọn từng thứ: [docs/01-project-plan.md#tech-stack](docs/01-project-plan.md#tech-stack).
