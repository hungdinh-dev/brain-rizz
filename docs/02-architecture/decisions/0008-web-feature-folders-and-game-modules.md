# ADR 0008: Web tổ chức theo feature, mỗi minigame một thư mục

- Trạng thái: Đã chấp nhận — phần nói về 3D (sân khấu sảnh) bị thay thế bởi [ADR 0010](0010-drop-3d-2d-lobby-and-podium.md)
- Ngày: 2026-10-09

## Bối cảnh

`apps/web/src` trước đây chia theo loại file (`ui/screens`, `ui/components`, `three/`, `store/`). Dự kiến có 15 minigame và nhiều màn hình hơn; một game nằm rải ở nhiều nơi (`shared/src/games/<id>.ts`, test cạnh đó, scene ở web, tên game ở shared). Mục tiêu: **làm game nào thì chỉ mở thư mục game đó**, làm màn hình nào thì chỉ mở feature đó.

Tham khảo cấu trúc frontend dự án LogiX (Next.js): `features/<tên>/{components,hooks,pages,…}` + barrel `index.ts`, `components/ui` (shadcn), `components/common`, `lib/`, `stores/`. Phần backend của LogiX (Express + Prisma) không áp dụng vì server ở đây là Colyseus, không có CSDL.

## Quyết định

```text
apps/web/src/
├─ app/            Khung app: App.tsx chọn màn hình theo pha của phòng
├─ features/       Mỗi màn hình một feature: home, lobby, play, results
│  └─ <feature>/   <Feature>Screen.tsx, components/, hooks/, index.ts (barrel)
├─ games/          Mỗi minigame một thư mục <id>/ (scene Phaser + locales.ts + index.ts)
├─ components/ui/  Component shadcn (ADR 0006)
├─ components/common/  Component dùng ở nhiều feature (avatar, chọn độ khó, nút theme/ngôn ngữ)
├─ hooks/, lib/, stores/, i18n/, net/, styles/
```

- Feature khác chỉ import qua `index.ts` của feature (vd. `@/features/lobby`), không import sâu vào file con.
- Import nội bộ dùng alias `@/` (= `apps/web/src`), cấu hình ở `tsconfig.json` (`paths`) và Vite (`resolve.tsconfigPaths`).
- `packages/shared/src/games/<id>/` chứa `<id>.ts` (bộ sinh câu đố) và `<id>.test.ts`. Logic vẫn **bắt buộc** ở shared vì server dùng lại để chấm điểm (AGENTS.md, bất biến 1).
- Phần web của game là một `GameClient` (`scene` tải lười + `locales`), đăng ký ở `src/games/registry.ts`; `satisfies Record<GameId, GameClient>` bắt quên đăng ký.
- Script `pnpm new-game <id> <nhóm>` tạo khung đủ hai nửa (shared + web + đặc tả), tự đăng ký và chạy được ngay với câu đố mẫu.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| **Theo feature + games/<id>/** (chọn) | Sửa một màn hình/game chỉ đụng một thư mục; ít xung đột khi nhiều người làm song song | Nhiều thư mục hơn; cần quy ước barrel |
| Giữ theo loại file | Quen thuộc, ít thư mục | Một tính năng rải nhiều nơi; khó tìm khi có 15 game |
| Gộp logic + scene của một game vào một package riêng (`packages/games/<id>`) | Một game đúng một thư mục | Server sẽ phụ thuộc gói có Phaser, hoặc phải tách entry; quá phức tạp ở quy mô hiện tại |

## Hệ quả

- Màn hình mới: tạo `features/<tên>/` + `index.ts`, rẽ nhánh trong `app/App.tsx`.
- 3D: sân khấu sảnh nằm ở `features/lobby/components/LobbyStage.tsx`; khi bục trao giải (results) dùng chung avatar 3D thì tách phần chung ra `components/three/`.
- Một game vẫn có **hai** thư mục (shared cho logic, web cho hiển thị) — đây là ranh giới cố ý giữa phần server cần và phần chỉ trình duyệt cần.
