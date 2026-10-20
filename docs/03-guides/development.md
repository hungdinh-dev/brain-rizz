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

### Chia sẻ cho bạn bè qua Internet (`pnpm share`)

Cho bạn bè ở xa chơi thử ngay từ máy mình, không cần deploy. Máy chạy lệnh làm host; dùng [Cloudflare Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/), **không cần tài khoản**.

1. Cài một lần: `winget install --id Cloudflare.cloudflared` (macOS: `brew install cloudflared`). Script tự tìm cả khi chưa có trong PATH (`C:\Program Files (x86)\cloudflared\`, thư mục link của winget).
2. Chạy `pnpm share` rồi gửi link `https://….trycloudflare.com` in ra cho bạn bè.

Script (`scripts/share.mjs`) chạy game server (nạp `apps/server/.env`, đặt `NODE_ENV=production` để tắt `/monitor`) — hoặc dùng lại server đang chạy ở cổng 2567 nếu bạn đang `pnpm dev` — mở 2 tunnel (server + web), build web với `VITE_SERVER_URL` = link tunnel server ra thư mục riêng `apps/web/dist-share` (không đụng `apps/web/dist` hay `apps/web/.env`), rồi chạy `vite preview` cho bản build đó. Ctrl+C dừng và dọn mọi tiến trình con.

Giới hạn:

- Máy phải bật và giữ cửa sổ mở suốt lúc chơi; link **đổi mỗi lần chạy**.
- Bản build share dùng sẵn `VITE_SUPABASE_*` trong `apps/web/.env`, nhưng **đăng nhập Google** còn cần thêm `https://*.trycloudflare.com/**` vào Supabase › Authentication › URL Configuration › Redirect URLs. Thiếu dòng này thì Google đăng nhập xong lại đưa người chơi về Site URL, không về link share. Chỉ thêm trong buổi chơi, share xong thì xoá ([Hướng dẫn Supabase › mục 5](supabase-setup.md#5-site-url-và-redirect-urls), rủi ro [R-13](../01-product/vision.md#10-rủi-ro-risk-register)). Chế độ khách, luyện tập và chơi party không bị ảnh hưởng.
- Nếu đang `pnpm dev` thì `/monitor` và `/playground` của server đó cũng ra Internet qua link server; muốn tắt thì dừng `pnpm dev` trước khi chạy `pnpm share`.
- Chỉ để chơi thử; không thay cho deploy thật trên Fly.io ([Triển khai](deployment.md)).

Khác chơi cùng Wi-Fi: cùng Wi-Fi chỉ cần `pnpm dev` và mở `http://<IP-máy-tính>:5173`, nhanh hơn và không qua Internet; `pnpm share` dành cho người ở mạng khác (4G, nhà khác).

## Quy ước

| Chủ đề | Quy ước |
| --- | --- |
| Ngôn ngữ | Giao diện + comment tiếng Việt; tên biến/hàm/file tiếng Anh |
| Định dạng | Biome (`pnpm format`), không dùng ESLint/Prettier |
| Import | Không ghi đuôi `.ts`; import từ shared qua `@brain-rizz/shared`; trong web dùng alias `@/` (= `apps/web/src`); feature khác chỉ import qua `index.ts` của nó |
| Giao diện | Component trong `@/components/ui` (shadcn đã chỉnh); màu qua token (`bg-card`, `text-muted-foreground`, `bg-primary`…) để tự đổi sáng/tối — xem [ADR 0006](../02-architecture/decisions/0006-ui-shadcn-and-theme-tokens.md). Chữ đặt thẳng trên nền bảng phấn dùng `text-chalk`/`text-chalk-muted`, `text-muted-foreground` chỉ dùng trong thẻ — xem [ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md) |
| Chữ hiển thị | Luôn qua `t()` (react-i18next); khoá mới thêm vào `src/i18n/locales/vi.ts` rồi `en.ts` — xem [ADR 0007](../02-architecture/decisions/0007-i18n-inline-resources.md) |
| Ngẫu nhiên | Logic câu đố chỉ dùng `createRng(seed)`; `Math.random()` chỉ được dùng ở server để tạo seed/mã phòng |
| Tin nhắn | Thêm vào `protocol.ts` kèm schema zod, server validate trước khi xử lý |
| Commit | [Conventional Commits](https://www.conventionalcommits.org/): `feat(web): …`, `fix(server): …`, `docs: …` |
| Nhánh | `main` luôn chạy được; làm việc trên `feat/<tên>` rồi gộp vào |

Trước khi commit: `pnpm check`.

## Thêm một minigame

Ví dụ tham khảo: **Kẻ lạc đàn** (`odd-one-out`). Danh sách game dự kiến và ID: [Danh mục minigame](../04-minigames/README.md).

Mỗi game nằm trong **hai thư mục** — chỉ cần mở hai chỗ này khi làm game đó:

```text
packages/shared/src/games/<id>/     LOGIC (server dùng lại để chấm điểm)
├─ <id>.ts                          bộ sinh câu đố: generate / check / isAnswer
└─ <id>.test.ts                     test 10.000 seed
apps/web/src/games/<id>/            HIỂN THỊ (chỉ trình duyệt)
├─ <Name>Scene.ts                   scene Phaser: vẽ, nhận chạm, gọi bridge.submit
├─ locales.ts                       chữ màn hướng dẫn (vi, en): tên, mô tả, 3 bước, điều khiển, câu nhắc, 4 mức độ khó
├─ <Name>HowTo.tsx                  (tuỳ chọn) hình minh hoạ SVG cho màn Hướng dẫn và thẻ game
└─ index.ts                         GameClient: scene (tải lười) + locales + Illustration
```

### Bước 1 — Tạo khung bằng script

```bash
pnpm new-game <id> <nhóm>          # nhóm: identify | memorize | analyze | compute | visualize
# vd. pnpm new-game number-balloons compute
```

Script tạo đủ các file trên + đặc tả `docs/04-minigames/<id>.md`, **tự đăng ký** vào `packages/shared/src/games/index.ts` và `apps/web/src/games/registry.ts`, lấy tên tiếng Việt từ bảng danh mục (nếu đã có dòng dự kiến) và đổi trạng thái thành "🚧 Đang làm". Khung chạy được ngay với câu đố mẫu "chạm vào số lớn nhất" — `pnpm check` xanh, game hiện ngay trong vòng quay và lưới thẻ ở màn Chọn game.

### Bước 2 — Thay câu đố mẫu bằng game thật

1. **Đặc tả** `docs/04-minigames/<id>.md`: cách chơi, cách sinh câu đố theo 4 mức độ khó, cách chấm.
2. **Bộ sinh câu đố** `<id>.ts` — một `MinigameDef<Puzzle, Answer>`:
   - `generate(roundSeed, index, difficulty)`: tạo `rng = createRng(deriveSeed(roundSeed, index))`, mọi lựa chọn ngẫu nhiên đi qua `rng`.
   - `check(puzzle, answer)` và `isAnswer(value)` (kiểm tra kiểu đáp án client gửi).
   - Ưu tiên số nguyên; tránh phép toán số thực có thể lệch giữa các máy. Không chứa chữ hiển thị.
3. **Test** `<id>.test.ts`: tất định, ≥ 10.000 seed đều có đúng một đáp án, độ khó tăng dần. Viết song song bằng `pnpm --filter @brain-rizz/shared test:watch`.
   - **Điểm chuẩn Kiểm tra não:** script đã chèn số giữ chỗ `1500` vào `BRAIN_TEST_REFERENCE_SCORE` trong `packages/shared/src/brain-test.ts`. Thay bằng điểm mô phỏng của người lớn ở Thường trong thời lượng Kiểm tra não của nhóm, theo [Thiết kế game › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não), và bỏ dòng TODO.
4. **Scene Phaser** `<Name>Scene.ts`:
   - `init({ bridge })` nhận `MinigameBridge`; câu đầu là `bridge.startIndex`.
   - Khi người chơi trả lời: chấm ngay ở client để phản hồi tức thì, gọi `bridge.submit(index, answer)`, sang câu tiếp.
   - Trả lời sai: hiện đáp án đúng trong lúc bị khoá (CR-006). Thời gian khoá lấy từ `await bridge.unlockDelay(index)` (khớp `lockedUntil` của server), không ghi cứng 1,5 giây; kiểm `this.sys.isActive()` trước khi dùng kết quả. Không đặt đáp án đúng ở dải giữa trên cùng thẻ (huy hiệu khoá che tới y ≈ 80, thẻ thấp nhất tới y ≈ 225).
   - Khai báo `difficultyMultiplier` và `speedAllowanceMs` trong định nghĩa game nếu bảng Cân bằng của đặc tả cần (CR-006); game mới đặt `durationMs: 60_000`.
   - Thiết kế trong khung 720×1280; vùng chạm ≥ 48 px. Canvas trong suốt: màu vẽ phải nhìn rõ trên cả nền sáng lẫn tối.
5. **Chữ hiển thị** `locales.ts` (kiểu `GameLocale` trong `apps/web/src/games/types.ts`), cho cả `vi` và `en`, lấy từ mục "Màn hướng dẫn" của đặc tả: `title`, `howTo` (một câu), `summary` (mô tả ngắn trên thẻ game), `steps` (đúng 3 bước), `controls` và `hint` (bản chạm / bản chuột), `levels` (mô tả 4 mức độ khó). Đặc tả có câu nhắc riêng cho mức nào (mức đó đổi luật hoặc có bẫy cần nhớ, vd. Siêu khó chạm ngược) thì thêm vào `levelHints` (tuỳ chọn, cũng bản chạm / bản chuột): câu này thay `hint` lúc đếm ngược, hiện dưới ô chọn độ khó ở màn Hướng dẫn và ở cột trái khi chơi trên máy tính; mức không khai báo dùng `hint` chung. Có hình minh hoạ thì thêm component SVG và gán `Illustration` trong `index.ts`: vẽ theo khổ ngang 14:9 như artboard hình hướng dẫn 560×360, `viewBox` cắt sát nội dung; hình nằm giữa khung ở màn Hướng dẫn và cao gần kín dải ảnh thẻ game (không có hình thì hiện biểu tượng nhóm kỹ năng).
6. Chạy `pnpm check`, `pnpm dev`, chơi thử 2 tab (thử cả hai giao diện sáng/tối), đổi trạng thái thành "✅ Đã làm" ở `docs/04-minigames/README.md`.

### Làm nhiều game song song

- Mỗi game chỉ đụng thư mục riêng của nó; chỗ dùng chung duy nhất là hai dòng đăng ký (script tự thêm) → ít xung đột git.
- Thứ tự gợi ý: 4 game MVP còn lại trước (Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình) — mỗi nhóm kỹ năng một game — rồi mới tới các game còn lại theo [lộ trình](../01-product/roadmap.md).
- Hình vẽ/ảnh dùng chung giữa các scene (nút, hiệu ứng đúng/sai) gom vào `apps/web/src/games/` (vd. `games/effects.ts`) khi game thứ hai cần tới, đừng chép lại.

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
| `pnpm share` in link nhưng máy mình báo không tìm thấy trang | DNS của quick tunnel chậm: chờ ít phút hoặc `ipconfig /flushdns`; vẫn mở được link local script in ra (thường `http://127.0.0.1:4173`) |
| `pnpm share` không mở được tunnel | Mạng chặn Cloudflare (thử 4G/mạng khác); tạm đổi tên `~/.cloudflared/config.yml` nếu có |
| `ERR_PNPM_…` khi cài | `corepack enable` rồi cài lại; xoá `node_modules` nếu đổi phiên bản Node |
| Hai máy thấy câu đố khác nhau | Có `Math.random()`/`Date.now()` lọt vào bộ sinh câu đố, hoặc khác độ khó |
| Lỗi CRLF trên Windows | Repo đã có `.gitattributes`; chạy `git add --renormalize .` |
