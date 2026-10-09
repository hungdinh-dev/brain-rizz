# Hướng dẫn cho AI coding assistant (Claude, Copilot, Cursor…)

Đọc `README.md` và `docs/02-architecture.md` trước khi sửa code. Các quy tắc dưới đây là bắt buộc.

## Bất biến quan trọng nhất

1. **Logic câu đố chỉ nằm trong `packages/shared/src/games/`** và phải **tất định**: cùng `(seed, index, difficulty)` → cùng câu đố. Không dùng `Math.random()`, `Date.now()` hay bất kỳ nguồn ngẫu nhiên nào khác ngoài `createRng()` trong logic câu đố. Server dùng lại chính hàm `generate()` để chấm điểm.
2. **Server là trọng tài.** Client chỉ hiển thị và gửi đáp án; điểm, đồng hồ, thứ tự vòng do `apps/server/src/rooms/PartyRoom.ts` quyết định.
3. **Mọi tin nhắn client → server phải được validate** bằng schema zod trong `packages/shared/src/protocol.ts`.
4. **Mỗi lúc chỉ một canvas WebGL**: lobby 3D (`apps/web/src/three/`) và game Phaser không bao giờ chạy cùng lúc.
5. State đồng bộ ở `apps/server/src/rooms/schema/PartyState.ts` phải khớp hình dạng `PartyStateView` trong shared.

## Lệnh

- Kiểm tra trước khi kết thúc một thay đổi: `pnpm check` (lint + typecheck + test).
- Thêm dependency: `pnpm --filter <tên-package> add <pkg>` (vd `@brain-rizz/web`).
- Định dạng: `pnpm format` (Biome). Không thêm ESLint/Prettier.

## Thêm minigame

Theo checklist ở `docs/03-development-guide.md#thêm-một-minigame`. Bộ sinh câu đố mới **bắt buộc** có test chạy ≥ 10.000 seed kiểm tra tính tất định và đúng một đáp án.

## Quy ước

- Ngôn ngữ giao diện và comment: tiếng Việt. Tên biến, hàm, file: tiếng Anh.
- Import nội bộ không ghi đuôi `.ts`.
- Không commit file `.env`; cập nhật `.env.example` khi thêm biến môi trường.
- Ghi lại quyết định kỹ thuật lớn thành ADR mới trong `docs/adr/`.
- Turborepo: cấu hình theo đúng phiên bản đã cài (`node_modules/turbo/docs/`), không theo trí nhớ.
