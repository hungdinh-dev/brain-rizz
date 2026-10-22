# ADR 0014: Bot chạy trên game server, mô phỏng kết quả thay vì giải câu đố

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-21
- Bổ sung cho: [ADR 0003](0003-seeded-deterministic-puzzles.md) (seed và bộ sinh câu đố không đổi; bot có RNG riêng), [ADR 0002](0002-game-server-colyseus-vs-supabase-realtime.md) (server vẫn là trọng tài)
- Liên quan: [CR-016](../../00-tracking/change-requests.md#cr-016), [Kế hoạch chơi với bot](../../01-product/bot-players.md), [SRS](../../01-product/srs.md) UC-23, FR-PH-20 → FR-PH-26

## Bối cảnh

CR-016 cho người chơi thêm **bot** vào phòng party (chủ phòng thêm vào ô trống, hoặc nút "Chơi với máy" tạo phòng kèm bot). Bot phải đi đủ luồng trận (vòng quay, hướng dẫn, đếm ngược, chơi, bảng điểm, vinh danh) và được chấm **đúng luật của người** để điểm so được với nhau.

Ràng buộc:

- Có 30 minigame chơi được, mỗi game một kiểu đáp án (chỉ số, thứ tự, toạ độ, thời lượng ms, chuỗi gõ…). `MinigameDef` chỉ có `generate`, `check`, `isAnswer`, không có hàm giải hay hàm sinh đáp án sai. Game mới còn được thêm thường xuyên.
- Bất biến 1: logic câu đố tất định theo `(seed, index, difficulty)`, không thêm nguồn ngẫu nhiên nào vào câu đố. Bất biến 2: server quyết định điểm, đồng hồ, thứ tự vòng.
- Điểm chỉ phụ thuộc **đúng hay sai** và **thời điểm trả lời** (thưởng tốc độ sau miễn trừ, hệ số độ khó của game, combo, khoá khi sai, hạn trả lời).
- Mức Siêu phải để người giỏi cố gắng vẫn thắng được, tức là bot cần "yếu có chủ đích", chỉnh được bằng vài hằng số.

## Quyết định

Bot chạy **trên game server, trong chính `PartyRoom`**, và **không giải câu đố**: mỗi câu, model bot của shared (`planBotAnswer`) bốc thời gian nghĩ và đúng/sai, server hẹn giờ trên `this.clock` của phòng rồi chấm qua `judgeBotAnswer`, dùng chung phần chấm với `judgeAnswer` của người.

### Cách làm

- **Shared (`packages/shared`):**
  - `bots/`: `BotModel { id, planAnswer(ctx) → { delayMs, correct } }`, bảng 4 mức `BOT_LEVEL_SPECS` (Dễ, Vừa, Khó, Siêu), registry `BOT_MODELS`. Model chỉ cần câu đố để biết miễn trừ, hạn trả lời và thời gian dự kiến (`expectedSolveMs` của game hoặc ước lượng chung).
  - RNG của bot là `createRng(botSeed(seed vòng, mã bot, index))`, tách hẳn khỏi seed câu đố. Cùng vòng thì bot chơi giống hệt nhau, test lặp lại được.
  - `answer-judge.ts`: phần sau `check()` (giờ hiện câu, hạn trả lời, thưởng tốc độ, hệ số + miễn trừ, combo, khoá khi sai, sang câu kế) tách thành một hàm nội bộ dùng chung. `judgeBotAnswer(round, difficulty, state, { index, correct }, now)` bỏ qua `isAnswer`/`check` và bộ chống spam; còn lại đi cùng đường với người. Test kiểm hai hàm cho cùng điểm khi cùng thời gian và cùng đúng/sai.
- **Server (`apps/server`):**
  - `rooms/BotDriver.ts` giữ danh sách bot (mức, model, thứ tự thêm) và làm hành vi theo pha. `PartyRoom` chỉ lo quyền, pha, ghế, chủ phòng.
  - Bot là một `Player` trong state với `isBot = true`, `botLevel`, id `bot-<n>`, `name = ""` (web dịch tên theo nhân vật). Không có `Client` Colyseus, nên không gửi tin và không chiếm `maxClients`.
  - Mỗi câu: giờ hiện câu lấy từ `AnswerJudge` (chung map với người), giờ trả lời theo kế hoạch `at = shownAt + delayMs`. `at > endsAt` thì bot dừng. Tới giờ thì chấm với `now = at`, nên điểm không phụ thuộc độ trễ của hẹn giờ. Kết quả cộng bằng **cùng hàm** `applyOutcome` của người.
  - Mọi hẹn giờ của bot bị huỷ cùng `clearTimers` mỗi lần đổi pha, về phòng chờ, chơi lại, dispose.
  - Ghế tính cả bot (≤ `MAX_PLAYERS`). Người thật vào phòng đủ ghế ở `lobby` thì bot thêm gần nhất nhường chỗ, và những người đã ở trong phòng nhận tin một lần `botYielded` (web hiện toast). Bot không làm chủ phòng; hết người thật (kể cả người đang giữ chỗ) thì dọn bot và `disconnect()`.
  - Bot của "Chơi với máy" (`bots` lúc tạo phòng) được thêm ngay sau khi người tạo vào (`onJoin`), không phải trong `onCreate`: bot chọn màu và nhân vật còn trống sau người tạo, nên người tạo giữ đúng hồ sơ của mình.
  - `match_results.bot_count` ghi số bot; `players` vẫn là tổng ghế, bot không có dòng riêng.
- **Giao thức:** `addBot { level }`, `removeBot { playerId }`, `setBotLevel { playerId, level }` (chủ phòng, pha `lobby`, schema zod), tùy chọn tạo phòng `bots?: { count, level }` (sai thì bỏ như không gửi), `PlayerView.isBot`/`botLevel`, `ChatMessagePayload.bot`, tin S → C `botYielded { botId, botAvatar, playerId, playerName }` (không chứa chữ giao diện; web dịch tên bot theo `botAvatar`).

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Bot trên server, mô phỏng kết quả `{ delayMs, correct }`, chấm bằng `judgeBotAnswer` (chọn) | Một cơ chế cho mọi game, game mới tự có bot; luật điểm dùng chung với người; tất định theo seed; chỉnh độ mạnh bằng hằng số; server vẫn là trọng tài | Bot không "giải thật" nên không thấy được trên màn hình bot đã chọn gì (không cần, web chỉ hiện điểm) |
| Mỗi game viết `solve()` và hàm sinh đáp án sai, bot gửi đáp án thật qua `check()` | Bot đi đúng đường `judgeAnswer` của người | 30 hàm giải, game mới nào cũng phải viết thêm; bot "giải đúng" không làm điểm thật hơn vì điểm chỉ phụ thuộc đúng/sai và thời gian |
| Bot chạy trên trình duyệt (như Luyện tập) | Không tốn CPU server | Không trộn được với người thật trong phòng party; phá bất biến "server là trọng tài" (client tự khai điểm của bot) |
| Room riêng `BotRoom` | Không đụng `PartyRoom` | Phải chép lại cả luồng trận (vòng quay, hướng dẫn, vinh danh, chat); hai nơi lệch nhau theo thời gian |

## Hệ quả

- **Dễ hơn:**
  - Game mới có bot ngay, chỉ cần khai báo `expectedSolveMs` để bot đúng nhịp (không khai báo thì dùng ước lượng chung).
  - Thêm model bot mới (vd. mạnh yếu theo nhóm kỹ năng) chỉ cần một file trong `bots/models/` và đăng ký vào `BOT_MODELS`, không sửa server.
  - Test server lặp lại được: điểm của bot sau một vòng bằng đúng kết quả chạy lại `planBotAnswer` + `judgeBotAnswer` với cùng seed (`PartyBots.test.ts`).
- **Khó hơn / chấp nhận:**
  - Có hai hàm chấm công khai. Mọi thay đổi luật điểm phải nằm trong phần dùng chung (`settleAnswer`), không sửa riêng một bên; test "cùng điểm" trong `answer-judge.test.ts` bắt lệch.
  - `PartyRoom` thêm một loại ghế không có `Client`: mọi chỗ duyệt `players` để chờ người (Đã hiểu, bỏ phiếu, độ khó đa số, chủ phòng) phải nhớ bỏ qua bot.
  - Tải server: mỗi bot khoảng một hẹn giờ mỗi 2–8 giây và sinh lại một câu mỗi lần, không đáng kể so với người thật.
  - Nhịp "Đã hiểu", chọn biểu cảm và nhân vật của bot dùng `Math.random` ở server: không ảnh hưởng điểm, không nằm trong shared.
- **Khi nào xem lại:**
  - Muốn bot chơi Kiểm tra não, bot bỏ phiếu chọn game, hay chơi với bot khi không có mạng (ngoài phạm vi CR-016).
  - Bot cần phản ứng theo nội dung câu đố (vd. bot "nhìn" người khác để chơi), lúc đó mô phỏng kết quả không còn đủ.
  - Phòng party chạy trên nhiều tiến trình hay đổi kiểu đồng bộ: kiểm lại việc hẹn giờ bot trên `this.clock` của phòng.
