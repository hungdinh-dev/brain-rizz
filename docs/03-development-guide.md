# Hướng dẫn phát triển

## Cài đặt lần đầu

1. Cài **Node.js 22 LTS** (≥ 22.12). Trên Windows nên dùng [fnm](https://github.com/Schniz/fnm) hoặc nvm-windows; file `.nvmrc` đã ghi sẵn phiên bản.
2. Bật pnpm đúng phiên bản: `corepack enable` (pnpm được khoá trong `packageManager` của `package.json`).
3. `pnpm install` ở thư mục gốc.
4. (Tuỳ chọn) Copy `apps/server/.env.example` → `apps/server/.env` và `apps/web/.env.example` → `apps/web/.env`.
5. VS Code: cài các extension được gợi ý (Biome, Tailwind CSS, Vitest).

## Chạy dự án

```bash
pnpm dev            # web http://localhost:5173 + server http://localhost:2567
```

- **Thử trên điện thoại thật:** điện thoại và máy tính cùng Wi-Fi, mở `http://<IP-máy-tính>:5173`. Client tự kết nối tới `http://<IP-máy-tính>:2567` vì `VITE_SERVER_URL` để trống. Trên Windows có thể cần cho Node.js qua tường lửa (Private network).
- **Thử nhiều người trên một máy:** mở thêm tab ẩn danh (mỗi tab giữ phiên riêng).
- **Xem phòng đang mở:** <http://localhost:2567/monitor>.

## Quy ước

| Chủ đề | Quy ước |
| --- | --- |
| Ngôn ngữ | Giao diện + comment tiếng Việt; tên biến/hàm/file tiếng Anh |
| Định dạng | Biome (`pnpm format`), không dùng ESLint/Prettier |
| Import | Không ghi đuôi `.ts`; import từ shared qua `@brain-rizz/shared` |
| Ngẫu nhiên | Logic câu đố chỉ dùng `createRng(seed)`; `Math.random()` chỉ được dùng ở server để tạo seed/mã phòng |
| Tin nhắn | Thêm vào `protocol.ts` kèm schema zod, server validate trước khi xử lý |
| Commit | [Conventional Commits](https://www.conventionalcommits.org/): `feat(web): …`, `fix(server): …`, `docs: …` |
| Nhánh | `main` luôn chạy được; làm việc trên `feat/<tên>` rồi gộp vào |

Trước khi commit: `pnpm check`.

## Thêm một minigame

Ví dụ tham khảo: **Kẻ lạc đàn** (`odd-one-out`).

1. **Đặc tả:** copy `docs/minigames/_template.md` thành `docs/minigames/<id>.md`, ghi cách chơi, cách sinh câu đố theo 4 mức độ khó, cách chấm.
2. **Bộ sinh câu đố** — `packages/shared/src/games/<id>.ts`, export một `MinigameDef<Puzzle, Answer>`:
   - `generate(roundSeed, index, difficulty)`: tạo `rng = createRng(deriveSeed(roundSeed, index))`, mọi lựa chọn ngẫu nhiên đi qua `rng`.
   - `check(puzzle, answer)` và `isAnswer(value)` (kiểm tra kiểu đáp án client gửi).
   - Ưu tiên số nguyên; tránh phép toán số thực có thể lệch giữa các máy.
3. **Test** — `packages/shared/src/games/<id>.test.ts`: tất định, ≥ 10.000 seed đều có đúng một đáp án, độ khó tăng dần.
4. **Đăng ký** trong `packages/shared/src/games/index.ts` (object `GAMES`).
5. **Scene Phaser** — `apps/web/src/games/<id>/<Name>Scene.ts`, `export default class … extends Phaser.Scene`:
   - `init({ bridge })` nhận `MinigameBridge`; câu đầu là `bridge.startIndex`.
   - Khi người chơi trả lời: chấm ngay ở client để phản hồi tức thì, gọi `bridge.submit(index, answer)`, sang câu tiếp.
   - Thiết kế trong khung 720×1280; vùng chạm ≥ 48 px.
6. **Đăng ký scene** trong `apps/web/src/games/registry.ts` — TypeScript báo lỗi nếu quên.
7. Chạy `pnpm check`, chơi thử 2 tab, cập nhật bảng trạng thái ở `docs/minigames/README.md`.

## Test

```bash
pnpm test                                  # tất cả
pnpm --filter @brain-rizz/shared test:watch  # chế độ theo dõi khi viết bộ sinh câu đố
pnpm --filter @brain-rizz/server test      # test PartyRoom với server Colyseus thật
pnpm --filter @brain-rizz/server loadtest  # cần server đang chạy (pnpm dev:server)
```

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
| --- | --- |
| Điện thoại không vào được phòng | Kiểm tra cùng Wi-Fi, tường lửa cho cổng 2567 và 5173 |
| `ERR_PNPM_…` khi cài | `corepack enable` rồi cài lại; xoá `node_modules` nếu đổi phiên bản Node |
| Hai máy thấy câu đố khác nhau | Có `Math.random()`/`Date.now()` lọt vào bộ sinh câu đố, hoặc khác độ khó |
| Lỗi CRLF trên Windows | Repo đã có `.gitattributes`; chạy `git add --renormalize .` |
