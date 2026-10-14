# Hướng dẫn cho AI coding assistant (Claude, Copilot, Cursor…)

Các quy tắc dưới đây là bắt buộc. Cần tìm file thì tra `docs/02-architecture/folder-structure.md` (muốn sửa gì thì mở file nào); cần hiểu luồng phòng chơi thì đọc `docs/02-architecture/overview.md`. Chỉ đọc khi cần, không đọc trước cho mọi việc.

## Bất biến quan trọng nhất

1. **Logic câu đố chỉ nằm trong `packages/shared/src/games/`** và phải **tất định**: cùng `(seed, index, difficulty)` → cùng câu đố. Không dùng `Math.random()`, `Date.now()` hay bất kỳ nguồn ngẫu nhiên nào khác ngoài `createRng()` trong logic câu đố. Server dùng lại chính hàm `generate()` để chấm điểm.
2. **Server là trọng tài.** Client chỉ hiển thị và gửi đáp án; điểm, đồng hồ, thứ tự vòng do `apps/server/src/rooms/PartyRoom.ts` quyết định.
3. **Mọi tin nhắn client → server phải được validate** bằng schema zod trong `packages/shared/src/protocol.ts`.
4. **Mỗi lúc chỉ một canvas WebGL**: hiện chỉ game Phaser dùng WebGL. Không thêm three.js hay canvas WebGL thứ hai; phòng chờ và vinh danh vẽ bằng React + SVG (ADR 0010).
5. State đồng bộ ở `apps/server/src/rooms/schema/PartyState.ts` phải khớp hình dạng `PartyStateView` trong shared.

## Đội agent (Claude Code)

Phiên chính là **điều phối**: chia việc, giao cho phòng ban trong `.claude/agents/`, ghép kết quả, ít tự viết code chi tiết. Hướng dẫn đầy đủ: `docs/03-guides/ai-agents.md`.

- Phòng ban: `game-designer`, `ui-designer`, `frontend-dev`, `backend-dev`, `qa-tester`.
- Việc của các phòng khác nhau, không chung file → giao **song song** trong cùng một lượt. Chung file → tuần tự, hoặc dùng `isolation: worktree`.
- Mọi thay đổi code kết thúc bằng `qa-tester` trước khi báo xong.
- Việc lớn dùng workflow có sẵn: `/feature`, `/new-minigame`, `/qa-fix` (`.claude/workflows/`).

## Lệnh

- Kiểm tra trước khi kết thúc một thay đổi: `pnpm check` (lint + typecheck + test).
- Thêm dependency: `pnpm --filter <tên-package> add <pkg>` (vd `@brain-rizz/web`).
- Định dạng: `pnpm format` (Biome). Không thêm ESLint/Prettier.

## Thêm minigame

Chạy `pnpm new-game <id> <nhóm>` rồi làm theo checklist ở `docs/03-guides/development.md#thêm-một-minigame`. Mỗi game có hai thư mục: `packages/shared/src/games/<id>/` (logic + test) và `apps/web/src/games/<id>/` (scene Phaser + `locales.ts`). Bộ sinh câu đố mới **bắt buộc** có test chạy ≥ 10.000 seed kiểm tra tính tất định và đúng một đáp án.

## Giao diện web

- Cấu trúc theo feature (`apps/web/src/features/<tên>/`); feature khác chỉ import qua `index.ts`. Import nội bộ dùng alias `@/`.
- Dùng component trong `@/components/ui` (shadcn đã chỉnh) và class token (`bg-card`, `text-muted-foreground`, `bg-primary`…) để tự đổi theo sáng/tối; không dùng `text-white/…`, `bg-ink`… cho nền/chữ thông thường. Nền app là bảng phấn (ADR 0009): chữ đặt thẳng trên bảng dùng `text-chalk`/`text-chalk-muted`, còn `text-muted-foreground` chỉ dùng bên trong thẻ. Inline `style` chỉ cho giá trị tính lúc chạy (vd. màu avatar).
- Không cài package `shadcn` (kéo zod@3, làm hỏng Colyseus); thêm component bằng `pnpm dlx shadcn@latest add <tên>` trong `apps/web`.
- Mọi chữ hiển thị đi qua `t()` của react-i18next: thêm khoá vào `src/i18n/locales/vi.ts` rồi `en.ts`. `packages/shared` không chứa chữ giao diện.

## Quy ước

- Ngôn ngữ giao diện và comment: tiếng Việt. Tên biến, hàm, file: tiếng Anh.
- Import nội bộ không ghi đuôi `.ts`.
- Không commit file `.env`; cập nhật `.env.example` khi thêm biến môi trường.
- Ghi lại quyết định kỹ thuật lớn thành ADR mới trong `docs/02-architecture/decisions/` (copy `_template.md`).
- Turborepo: cấu hình theo đúng phiên bản đã cài (`node_modules/turbo/docs/`), không theo trí nhớ.
- Xong một tính năng/use case: đổi trạng thái trong `docs/00-tracking/features.md` và thêm một dòng vào mục `[Chưa phát hành]` của `docs/00-tracking/changelog.md`. Tính năng chưa có trong `docs/01-product/srs.md` thì phải có yêu cầu thay đổi (`docs/00-tracking/change-requests.md`) được duyệt trước khi làm. Chi tiết: `docs/03-guides/sdlc.md`.
- Cuối mỗi ngày làm việc (hoặc cuối phiên), phiên điều phối viết/bổ sung báo cáo ngày `docs/00-tracking/reports/YYYY-MM-DD.md` theo `_template.md`: việc theo giờ, ai làm (chủ dự án/điều phối/agent), link file đã sửa, lỗi QA tìm ra và cách sửa, commit. Quy chuẩn: `docs/00-tracking/reports/README.md`.
- Tài liệu mới đặt theo bảng "Thêm tài liệu mới vào đâu" trong `docs/README.md`. Thêm/xoá/đổi tên thư mục hoặc file code thì cập nhật `docs/02-architecture/folder-structure.md`.
