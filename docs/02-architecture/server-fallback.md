# Kế hoạch dự phòng game server

| | |
| --- | --- |
| Dành cho | Chủ dự án khi muốn cắt chi phí hoặc đổi nơi chạy server; developer/AI agent khi làm tính năng chạm tới phòng chơi |
| Trạng thái | Kế hoạch dự phòng, **chưa làm**. Đang dùng Colyseus trên Fly.io ([ADR 0004](decisions/0004-hosting-strategy.md)) |
| Số liệu | Giá, hạn mức và số đo lấy ngày 2026-10-13 |
| Cập nhật khi | Đổi nơi chạy server; thêm tính năng phòng chơi ngoài khuôn "mỗi người tự giải rồi gửi đáp án"; nhà cung cấp đổi giá/hạn mức |

## 1. Khi nào dùng kế hoạch này

- Hoá đơn Fly.io sau 1–2 tuần chơi thật vượt mức chấp nhận được (xem Billing trên dashboard Fly).
- Fly.io đổi giá, ngừng dịch vụ hoặc không ổn định ở region Singapore.

## 2. Các phương án, thử theo thứ tự

Độ trễ **không** phải yếu tố quyết định: mỗi người tự giải câu đố, mỗi câu chỉ một tin `answer`, vòng tính bằng giây — dịch vụ real-time nào chuyển tin trong vài chục đến vài trăm mili-giây cũng đủ. Khác biệt nằm ở chỗ **ai làm trọng tài** (phát seed, giữ đồng hồ, chấm điểm, giữ chỗ khi rớt mạng).

| # | Phương án | Chi phí | Sửa code | Cảm giác khi chơi | Điểm trừ |
| --- | --- | --- | --- | --- | --- |
| 1 | **Render Free** | 0 USD | Không — chạy đúng `apps/server/Dockerfile` | Như hiện tại khi server đang thức | Ngủ sau 15 phút không ai vào; người đầu tiên mở game chờ khoảng 1 phút |
| 2 | **Cloudflare Durable Objects** | 0 USD trong hạn mức ngày | Viết lại lớp phòng chơi (mục 4) | Như hiện tại — vẫn có server làm trọng tài | Tốn công viết lại; có hạn mức theo ngày (mục 3) |
| 3 | Chỉ Supabase Realtime | 0 USD | Viết lại và đổi mô hình | Độ trễ như nhau, nhưng mất trọng tài | Phòng treo khi máy chủ phòng chạy nền, dễ gian lận, tự làm đồng hồ/nối lại. **Không khuyên** ([ADR 0002](decisions/0002-game-server-colyseus-vs-supabase-realtime.md)) |

- Chọn **1** trước: không tốn công, chỉ đổi nơi chạy container. Các bước: [Triển khai › Render](../03-guides/deployment.md#deploy-game-server-lên-render-phương-án-0-đồng).
- Chọn **2** khi chờ 1 phút của Render quá phiền, hoặc muốn 0 đồng lâu dài mà vẫn giữ trọng tài.

## 3. Hạn mức Cloudflare gói Free so với nhu cầu

| Hạn mức | Con số | Với game này |
| --- | --- | --- |
| Request | 100.000/ngày; mở WebSocket tính 1 request, tin gửi lên tính 20 tin = 1 request, tin server gửi xuống không tính | Khoảng 2 triệu tin gửi lên mỗi ngày — dư |
| Thời gian chạy | 13.000 GB-s/ngày; mỗi Durable Object luôn tính 128 MB | Khoảng 28 giờ phòng mở mỗi ngày, kể cả khi không dùng hibernation — dư cho một nhóm bạn |
| CPU | 30 giây mỗi lần gọi, mỗi tin mới tính lại từ đầu | `generate()` đo ngày 2026-10-13: trung bình dưới 0,04 ms, chậm nhất 24 ms (lần chạy đầu) — dư |
| Lưu trữ | Chỉ Durable Object loại SQLite; 5 GB tổng | Phòng chơi không cần lưu lâu — dư |
| Vượt hạn mức | Thao tác loại đó báo lỗi tới 00:00 UTC (7 giờ sáng giờ Việt Nam) | Rủi ro thấp ở quy mô hiện tại |

Nguồn: [Cloudflare – DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Cloudflare – DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/). Kiểm tra lại trước khi chuyển.

## 4. Rủi ro khi chuyển sang Cloudflare sau này

### Phần dính Colyseus nhỏ và không lớn lên theo số game

Colyseus chỉ có trong 7 file:

| File | Khi chuyển |
| --- | --- |
| `apps/server/src/rooms/PartyRoom.ts` (~600 dòng) | Viết lại phần vỏ (vào/ra phòng, gửi tin, hẹn giờ, nối lại). Luật pha giữ nguyên, chỉ bê sang |
| `apps/server/src/rooms/schema/PartyState.ts` | Bỏ — dùng thẳng `PartyStateView` (JSON thường) |
| `apps/server/src/app.config.ts`, `index.ts` | Thay bằng Worker định tuyến theo mã phòng tới Durable Object |
| `apps/web/src/net/connection.ts` (~130 dòng) | Viết lại bằng WebSocket thường. Màn React không đổi vì chỉ gọi `send()`/`createParty()`/`joinParty()` và đọc store |
| `apps/server/test/PartyRoom.test.ts`, `apps/server/loadtest/party.ts` | Viết lại theo công cụ test của Workers |

Những phần **không** dính Colyseus nên chuyển sang dùng lại nguyên:

- Logic câu đố `packages/shared/src/games/` — TypeScript thuần, không dùng API riêng của Node.
- Tính điểm, xếp hạng, mã phòng, seed (`pointsForCorrect`, `rankByRound`, `placementPoints`, `generateRoomCode`, `randomSeed`…) đã nằm trong `packages/shared`.
- `PartyRoom` không có code riêng cho từng game: chỉ gọi `getGame(gameId)` rồi dùng `generate`/`check`/`isAnswer`/hệ số điểm.
- Scene Phaser `apps/web/src/games/<id>/` chỉ import `@brain-rizz/shared` và đọc store.

**Kết luận:** thêm game theo đúng hợp đồng `MinigameDef` **không làm tăng** công chuyển đổi — 5 game hay 30 game thì phần phải viết lại vẫn là 7 file trên, cỡ một tính năng lớn (server + web + test). Rủi ro chỉ tăng khi tính năng mới phá khuôn này (bảng dưới).

### Bảng rủi ro

| # | Rủi ro | Khả năng | Ảnh hưởng | Phòng tránh từ bây giờ |
| --- | --- | --- | --- | --- |
| 1 | Game mới cần người chơi tác động lẫn nhau trong vòng (giành ô, ai bấm trước, tấn công) → thêm tin nhắn và state riêng từng game trong `PartyRoom` | Trung bình | **Cao** — mỗi game kiểu này cộng thêm code phải viết lại | Giữ game trong khuôn `MinigameDef`. Nếu buộc phải có state chung, viết luật thành hàm thuần trong `shared` (state + hành động → state mới) để server chỉ việc gọi |
| 2 | Dùng tính năng riêng của Colyseus: state khác nhau cho từng người (`StateView`/`@view`), danh sách phòng công khai (`LobbyRoom`), `filterBy`, chạy nhiều máy bằng Presence/Redis | Thấp–trung bình | **Cao** | Mọi người thấy chung một `PartyStateView`; tin nhắn mới đi qua `protocol.ts`. Cần dùng thì viết ADR trước |
| 3 | Hẹn giờ: Colyseus đặt được nhiều `clock.setTimeout`; Durable Object chỉ có **một alarm** mỗi lúc, và nếu dùng hibernation thì state trong RAM bị xoá | Chắc chắn khi chuyển | Trung bình | Hẹn giờ mới thì ghi mốc thời gian vào state (như `endsAt`, `introEndsAt`, `wheelSpinAt` đã làm), không chỉ giữ trong RAM — khi chuyển chỉ cần một alarm cho mốc gần nhất |
| 4 | Nối lại khi rớt mạng (`allowReconnection` 45 giây, `reconnectionToken`) phải tự làm | Chắc chắn khi chuyển | Trung bình | Không cần làm trước; đã tính vào công chuyển |
| 5 | Đồng bộ state: Colyseus tự gửi phần thay đổi, tự làm thì phải gửi state | Chắc chắn khi chuyển | Thấp | Tối đa 8 người, state vài KB — gửi cả state sau mỗi thay đổi là đủ |
| 6 | Code dùng API riêng Node (`fs`, `Buffer`, `node:crypto`, `process`) trong `shared` hoặc luật phòng | Thấp | Trung bình | `shared` giữ thuần như hiện tại |
| 7 | `generate()` của game mới nặng (dò nghiệm, quay lui) — server chạy lại mỗi lần chấm | Thấp | Thấp | Giữ `generate()` dưới vài ms mỗi câu |
| 8 | Cloudflare đổi hạn mức gói Free | Thấp | Trung bình | Kiểm tra lại mục 3 trước khi chuyển |

### Có thể làm trước (chưa làm, tuỳ chọn)

Tách luật phòng (chuyển pha, nhận đáp án, hết giờ) khỏi Colyseus thành module thuần, để `PartyRoom` chỉ còn lớp vỏ chuyển tin; khi chuyển chỉ viết vỏ mới cho Durable Object. Đổi lại phải sửa ~600 dòng khi chưa cần, nên chỉ làm khi đã quyết định chuyển hoặc khi `PartyRoom` phình to khó sửa.

## 5. Quy tắc giữ đường lui khi thêm game và tính năng

1. Game mới chỉ dùng hợp đồng `MinigameDef`; không thêm tin nhắn hay state riêng cho một game trong `PartyRoom` khi chưa có ADR.
2. State đồng bộ giống nhau cho mọi người (`PartyStateView`); không dùng state lọc theo từng người.
3. `packages/shared` không dùng API riêng của Node.
4. UI và Phaser chỉ nói chuyện với server qua `apps/web/src/net/connection.ts`.
5. Hẹn giờ mới ghi mốc thời gian vào state.

[← Kiến trúc](README.md) · [Mục lục tài liệu](../README.md)
