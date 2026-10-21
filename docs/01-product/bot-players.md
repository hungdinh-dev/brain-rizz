# Kế hoạch chơi với bot

| | |
| --- | --- |
| Giai đoạn SDLC | Lập kế hoạch: **đã duyệt** [CR-016](../00-tracking/change-requests.md#cr-016) (2026-10-21), chưa làm |
| Phiên bản tài liệu | 0.2 · 2026-10-21 · chủ dự án duyệt cả mặc định ở mục 2 và bảng thông số ở mục 3.1 |
| Liên quan | [GDD](game-design.md) (độ khó, tính điểm), [SRS](srs.md) (UC-05, UC-06, UC-21, UC-22), [Kiến trúc](../02-architecture/overview.md), [CR-006](../00-tracking/change-requests.md#cr-006) (hệ số theo game) |
| Cập nhật khi | Chủ dự án duyệt hoặc đổi CR-016, chốt số liệu sau chơi thử, thêm model bot mới |

## 1. Tóm tắt

Người chơi thêm **bot** vào ghế trống của phòng party, hoặc bấm **Chơi với máy** ở menu để có ngay một phòng kèm bot. Bot chạy trên game server, đi đủ luồng trận (vòng quay, hướng dẫn, đếm ngược, chơi, bảng điểm, vinh danh) và được chấm theo đúng luật của người.

- **Vì sao:** BR-10, có lý do quay lại khi không có bạn chơi cùng. Trụ cột "Vào là chơi": một mình vẫn vào trận ngay. Phòng 2 người cũng có thêm đối thủ cho vui.
- **Cách làm:** bot **không giải câu đố**. Với mỗi câu, server bốc xem bot trả lời sau bao lâu và đúng hay sai, rồi chấm qua cùng hàm của người (thưởng tốc độ, combo, khoá khi sai). Nhờ vậy không phải viết hàm giải cho 30 game, và game mới tự có bot.
- **Công sức:** khoảng 3,5–4,5 ngày công. Chạy song song các phòng ban thì mất 2,5–3 ngày.

## 2. Quyết định của chủ dự án (2026-10-21)

| Câu hỏi | Chọn |
| --- | --- |
| Gặp bot ở đâu | **Cả hai**: nút "Chơi với máy" ở menu và chủ phòng thêm bot trong phòng party. Chỉ có một cơ chế bot trong `PartyRoom`. |
| Độ khó bot | **4 mức cố định**: Dễ, Vừa, Khó, Siêu. Mỗi bot có mức riêng. |
| Tính cách theo nhóm kỹ năng | **Không**. Bot mạnh đều ở mọi game. Code chừa chỗ cắm **nhiều model bot** để sau này thêm. |
| Lịch sử tài khoản | **Lưu, gắn nhãn có bot**: `match_results` thêm cột số bot, màn lịch sử hiện nhãn "Đấu với máy". |
| Mức Siêu | **Người giỏi cố gắng vẫn thắng**, không phải bất bại. |
| Phòng "Chơi với máy" | **Là phòng party bình thường**, vẫn có mã. Ô trống có nút thêm bot, **chọn mức ngay trong ô đó**. |
| Cấu hình trước khi vào | Hộp thoại nhỏ: **số bot (1–7) và một mức chung**. Vào phòng chờ rồi vẫn chỉnh từng bot. |
| Bot chat | **Biểu cảm nhanh** ở bảng điểm vòng và vinh danh. Chủ phòng tắt chat thì bot im. |

### Mặc định điều phối đề xuất (chủ dự án đã duyệt)

1. **Người thật được ưu tiên ghế:** phòng đủ 8 ghế mà có bot, người thật vào bằng mã thì server bỏ bot được thêm gần nhất để nhường chỗ. Việc này chỉ xảy ra ở phòng chờ, vì giữa trận vẫn không cho vào như hiện nay. Không có luật này thì phòng "Chơi với máy" 7 bot không có chỗ cho bạn vào.
2. **Bot không bao giờ làm chủ phòng.** Người thật cuối cùng rời phòng (hết 45 giây giữ chỗ) thì phòng đóng.
3. **Bot không bỏ phiếu** chọn game và không bị nhắc độ khó. Độ khó của bot không tính vào "độ khó đa số" và không bị đánh dấu "lệch".
4. **Bot tính đủ người để bắt đầu:** 1 người thật + 1 bot là bắt đầu được (`MIN_PLAYERS_TO_START` = 2 giữ nguyên).
5. **Thêm, bớt, đổi mức bot** chỉ làm ở phòng chờ, và chỉ chủ phòng làm được (giống `setRounds`).

## 3. Luật của bot

### 3.1 Bốn mức

Mốc so sánh là **người chơi chuẩn**: người lớn chọn đúng sức, giải mỗi câu hết đúng "thời gian giải dự kiến" `T(game, độ khó)` ở bảng Cân bằng của đặc tả game, đúng khoảng 90 %.

| Mức | Độ khó câu đố bot chơi | Thời gian nghĩ | Tỉ lệ đúng | Ý đồ |
| --- | --- | --- | --- | --- |
| Dễ | 0 Mầm | T × 1,5 | 70 % | Trẻ em, người mới thắng được |
| Vừa | 1 Thường | T × 1,15 | 82 % | Người lớn chơi bình thường thắng khoảng nửa số vòng |
| Khó | 2 Khó | T × 0,95 | 88 % | Người đã quen phải tập trung |
| Siêu | 3 Siêu khó | T × 0,8 | 92 % | Người giỏi cố gắng vẫn thắng được |

Các con số trên là **điểm xuất phát**. game-designer chỉnh lại bằng mô phỏng (mục 6), rồi chỉnh tiếp sau buổi chơi thử. Khi chỉnh chỉ đổi hằng số, không sửa cơ chế. Điểm của bot vẫn nhân hệ số độ khó của game như người ([CR-006](../00-tracking/change-requests.md#cr-006)). Vì hệ số đã cân điểm giữa các mức, độ khó câu đố chủ yếu quyết định bot "trông" như đang chơi mức nào. Sức mạnh thật của bot nằm ở thời gian nghĩ và tỉ lệ đúng.

### 3.2 Một câu của bot

1. Câu hiện ra: câu 0 lúc `startAt`, các câu sau lúc trả lời câu trước, hoặc lúc hết khoá nếu câu trước sai. Đây cũng là giờ hiện câu mà `AnswerJudge` dùng cho người.
2. Server sinh câu bằng `generate(seed, index, độ khó của bot)`. Không cần đáp án, chỉ cần câu để tính `speedAllowanceMs`, `answerWindowMs` và thời gian dự kiến.
3. Model bot trả về `{ delayMs, correct }`:
   - `delayMs` = thời gian dự kiến × hệ số của mức × nhiễu log-normal (σ khoảng 0,25), không dưới `miễn trừ + 600 ms` (thời gian phản xạ).
   - `correct` bốc theo tỉ lệ đúng của mức.
4. Hẹn giờ `delayMs` trên `this.clock` của phòng, tới giờ thì chấm bằng `judgeBotAnswer` (mục 5.1). Bot trả lời sau hạn (`answerWindowMs`, như bia Luyện ngắm) thì bị chấm sai như người. Không cần luật riêng.
5. Lần hẹn kế tiếp rơi sau `endsAt` thì bot dừng.

Bot dùng `createRng` với seed ghép từ `(seed vòng, mã bot, index)`, nên cùng vòng thì bot chơi giống hệt nhau. Nhờ vậy test lặp lại được và không cần `Math.random` trong shared. RNG của bot **không** đụng tới seed câu đố (bất biến 1).

### 3.3 Bot ở các pha khác

| Pha | Bot làm gì |
| --- | --- |
| `lobby` | Luôn sẵn sàng |
| `game-select` | Không làm gì (không bỏ phiếu) |
| `game-intro` | Bấm "Đã hiểu" sau 1–3 giây ngẫu nhiên. Độ khó lấy theo mức, không đổi được |
| `countdown`, `playing` | Trả lời theo mục 3.2 |
| `round-results`, `podium` | Mỗi bot có khoảng 35 % khả năng gửi **một** biểu cảm sau 0,8–3 giây. Thắng vòng thì chọn `fire`, `laugh`. Thua thì `shock`, `gg`. Ở vinh danh thì `gg`, `clap`. Tin đi qua `ChatRelay` (giới hạn tần suất, `chatEnabled`) như người |

## 4. Trải nghiệm (bản mẫu do ui-designer làm)

- **Menu:** thêm nút **Chơi với máy**, mở hộp thoại: số bot 1–7 (mặc định 3), một mức chung (mặc định Vừa), nút **Vào phòng**. Hộp thoại tạo phòng party kèm bot rồi vào thẳng phòng chờ.
- **Phòng chờ, ô trống:**
  - Chủ phòng thấy nút **+ Thêm bot**. Bấm vào thì ô mở ra 4 chip mức (Dễ, Vừa, Khó, Siêu), bấm một chip là thêm bot ở mức đó.
  - Người khác vẫn thấy "Mời bạn" như hiện nay.
- **Phòng chờ, ô bot:** nhân vật kèm huy hiệu máy và chip mức. Chủ phòng bấm chip để đổi mức, bấm × để bỏ bot.
- **Tên bot:** web dịch theo nhân vật (vd. "Bơ · máy"). Hai bot trùng nhân vật thì thêm số. Server không chứa chữ giao diện.
- **Huy hiệu máy ở mọi nơi có tên người chơi:** hướng dẫn (danh sách "Đã hiểu"), dải điểm khi chơi, bảng điểm vòng, vinh danh, bong bóng chat.
- **Lịch sử tài khoản:** trận có bot hiện nhãn "Đấu với máy".

Mọi chữ mới đi qua `t()` (`vi.ts` rồi `en.ts`).

## 5. Thay đổi kỹ thuật

Quyết định kỹ thuật chính ghi thành **ADR 0014** khi làm: bot chạy trên server và mô phỏng kết quả, không giải câu đố. Các phương án đã cân nhắc nằm ở mục 5.5.

### 5.1 Shared (`packages/shared`)

| File | Thay đổi |
| --- | --- |
| `src/bots/` (mới) | `types.ts`: `BotLevel` (0–3), `BotModel { id, planAnswer(ctx) → { delayMs, correct } }`. `levels.ts`: bảng mục 3.1. `models/basic.ts`: model v1. `index.ts`: registry `BOT_MODELS`. Thêm model mới chỉ cần thêm file và đăng ký, không sửa server |
| `src/games/types.ts` | `MinigameDef` thêm trường tuỳ chọn `expectedSolveMs?: Record<Difficulty, number>` (trung vị ở bảng Cân bằng của đặc tả). Game chưa khai báo thì dùng ước lượng `BOT_BASE_SOLVE_MS × hệ số game + miễn trừ` |
| `src/games/<id>/` | Khai báo `expectedSolveMs` cho 30 game chơi được, chép từ đặc tả |
| `src/answer-judge.ts` | Tách phần sau `check()` thành hàm nội bộ dùng chung. Thêm `judgeBotAnswer(round, state, { index, correct }, difficulty, now)`: bỏ qua `isAnswer`/`check`, còn lại (giờ hiện câu, thưởng tốc độ, combo, khoá, hạn trả lời) **cùng đường** với người |
| `src/protocol.ts` | Lệnh mới `addBot { level }`, `removeBot { playerId }`, `setBotLevel { playerId, level }` (schema zod, bất biến 3). Tùy chọn tạo phòng `bots?: { count: 1–7, level }`. `PlayerView` thêm `isBot`, `botLevel`. `ChatMessagePayload` thêm `bot?: true` để web dịch tên bot kể cả khi bot đã bị bỏ |
| `src/constants.ts` | `BOT_BASE_SOLVE_MS`, `BOT_MIN_REACTION_MS`, `BOT_INTRO_READY_MS` (khoảng), `BOT_CHAT_CHANCE` |

### 5.2 Server (`apps/server`)

- **`rooms/BotDriver.ts` (mới):** giữ danh sách bot của phòng (mức, model, RNG), làm hành vi theo pha (mục 3.3), hẹn giờ trả lời trên `this.clock`. `PartyRoom` huỷ hẹn giờ của bot cùng lúc với `clearTimers` khi đổi pha. Tách riêng để `PartyRoom.ts` (707 dòng) không phình thêm.
- **`PartyRoom.ts`:**
  - Handler `addBot`, `removeBot`, `setBotLevel` (chủ phòng, pha `lobby`). `onCreate` đọc `bots` từ tùy chọn tạo phòng.
  - `onJoin`: đủ 8 ghế, tính cả bot, thì bỏ bot thêm gần nhất. Không còn bot thì từ chối "Phòng đã đầy".
  - `setHost` và chuyển quyền bỏ qua bot. Hết người thật thì `disconnect()`.
  - `StartRound` không chờ bot. `nudge` vào bot trả `invalid`. `majorityDifficulty` chỉ tính người thật.
  - `recordMatch` ghi `botCount`.
- **`schema/PartyState.ts`:** `Player` thêm `isBot`, `botLevel`, khớp `PlayerView` (bất biến 5). Test "state khớp hình dạng" tự bắt nếu thiếu.
- **`store/ResultStore.ts`:** `MatchResultRecord.botCount`, ghi vào cột mới.
- **Migration mới** `supabase/migrations/<ngày>_match_bot_count.sql`: `alter table match_results add column bot_count smallint not null default 0 check (bot_count >= 0)`. Dòng cũ tự là 0.

### 5.3 Web (`apps/web`)

- `features/home/`: nút và hộp thoại "Chơi với máy". `net/connection.ts` tạo phòng với tùy chọn `bots`.
- `features/lobby/components/PlayerSlot.tsx`: `EmptySlot` có nút thêm bot kèm chip mức. `PlayerSlot` vẽ ô bot (huy hiệu, chip mức, nút bỏ).
- Huy hiệu máy và tên dịch: một component dùng chung, ví dụ `components/characters/BotBadge`, dùng ở game-intro, play, results, chat.
- `features/account/`: nhãn "Đấu với máy" khi `bot_count > 0`.
- i18n: khoá `bots.*` trong `vi.ts`, `en.ts`.

### 5.4 Không đổi

Seed và bộ sinh câu đố, luật chấm của người, tin `answer`, `BrainTestRoom`, Luyện tập, bảng xếp hạng (không đọc `match_results`).

### 5.5 Phương án đã loại

| Phương án | Vì sao không chọn |
| --- | --- |
| Mỗi game viết `solve()` và hàm sinh đáp án sai, bot gửi đáp án thật qua `check()` | 30 hàm, game mới nào cũng phải viết thêm. Bot "giải đúng" không làm điểm thật hơn, vì điểm chỉ phụ thuộc đúng/sai và thời gian |
| Bot chạy trên trình duyệt (như Luyện tập) | Không trộn được với người thật trong phòng party, và phá bất biến "server là trọng tài" |
| Room riêng `BotRoom` | Phải chép lại cả luồng trận (vòng quay, hướng dẫn, vinh danh) |

## 6. Kiểm thử

- **Shared:**
  - Cùng seed thì bot ra cùng kế hoạch.
  - `judgeBotAnswer` cho đúng số điểm của `judgeAnswer` khi cùng thời gian và cùng đúng/sai.
  - **Mô phỏng cân bằng** trên mọi game (≥ 1 000 vòng mỗi game và mỗi mức), kiểm:
    - Điểm vòng trung bình tăng dần: Dễ < Vừa < Khó < Siêu.
    - Người chơi chuẩn thắng bot Vừa khoảng 40–60 % số vòng.
    - "Người giỏi" (Siêu khó, nhanh hơn chuẩn 20 %, đúng 95 %) thắng bot Siêu ≥ 50 % số vòng.
  - Mọi game chơi được đều có `expectedSolveMs`, hoặc được liệt kê rõ là dùng ước lượng.
- **Server (`PartyRoom.test.ts`, tách `PartyBots.test.ts` nếu dài):**
  - Quyền và pha của 3 lệnh mới.
  - Phòng đầy thì bot nhường ghế. Bot không làm chủ phòng. Người thật cuối rời thì phòng đóng.
  - Bot có điểm sau một vòng.
  - Về phòng chờ giữa vòng thì không còn hẹn giờ của bot.
  - `recordMatch` ghi `botCount`. Hình dạng state khớp.
- **Web:** test hộp thoại và ô bot. Kiểm Chrome headless ở 390 và 1280 px: tạo phòng 3 bot, chơi trọn 2 vòng, thêm/bỏ/đổi mức bot, bạn vào phòng đầy bot.

## 7. Chia việc (sau khi duyệt CR-016)

Chạy bằng `/feature`. Hợp đồng `BotModel` và các trường mới của `PlayerView` đã chốt ở mục 5.1, nên đợt A làm song song được.

| Đợt | Phòng ban | Việc | File chính | Ước lượng |
| --- | --- | --- | --- | --- |
| A | `game-designer` | `src/bots/`, `expectedSolveMs` cho 30 game, mô phỏng cân bằng, mục "Bot" trong GDD | `packages/shared/src/bots/`, `games/*/` | 1 ngày |
| A | `backend-dev` | `judgeBotAnswer`, giao thức, state, `BotDriver`, `PartyRoom`, migration, `ResultStore`, test | `answer-judge.ts`, `protocol.ts`, `apps/server/`, `supabase/` | 1–1,5 ngày |
| A | `ui-designer` | Bản mẫu: hộp thoại "Chơi với máy", ô trống thêm bot, ô bot, huy hiệu máy | canvas UI-UX | 0,5 ngày |
| B | `frontend-dev` | Mục 5.3 theo bản mẫu (cần đợt A xong) | `apps/web/` | 1–1,5 ngày |
| C | `qa-tester` | `pnpm check`, soát bất biến 1, 3, 5, kiểm trình duyệt | — | 0,5 ngày |

`game-designer` và `backend-dev` cùng đụng `packages/shared/src/index.ts` (chỉ thêm dòng export), nên chạy `backend-dev` với `isolation: worktree` hoặc ghép tay khi xong.

**Thứ tự với việc đang dở:** nhánh `feat/minigame-wave-1` (14 game) và [CR-015](../00-tracking/change-requests.md#cr-015) cùng sửa `PartyRoom.ts`, `PartyState.ts`, `protocol.ts`. Nên merge wave 1 trước rồi làm bot trên nhánh mới `feat/bot-players`. CR-015 làm trước hay sau đều được, nhưng không làm song song.

## 8. Rủi ro

| Rủi ro | Cách giảm |
| --- | --- |
| Bot trông "máy móc" vì nhịp trả lời đều | Nhiễu log-normal, thỉnh thoảng có câu chậm, bấm "Đã hiểu" và chat có độ trễ ngẫu nhiên |
| Số liệu bảng Cân bằng là mô hình, chưa đo thật | Mô phỏng bảo đảm thứ tự các mức. Sau chơi thử chỉ chỉnh hằng số trong `levels.ts` |
| Chép `expectedSolveMs` của 30 game bị sai | Test kiểm giá trị dương và tăng dần theo mức. Game thiếu thì rơi về ước lượng chung |
| Thêm bot Dễ để "cày" hạng trong lịch sử | Lịch sử gắn nhãn "Đấu với máy". Bảng xếp hạng không dùng `match_results` |
| Tải server | Mỗi bot khoảng 1 hẹn giờ mỗi 2–8 giây, sinh lại một câu mỗi lần. Không đáng kể so với người thật |

## 9. Ngoài phạm vi lần này

Model bot thứ hai (mạnh yếu theo nhóm kỹ năng, tự cân bằng theo người chơi), chọn model trên giao diện, bot trong Kiểm tra não, bot bỏ phiếu chọn game, chơi với bot khi không có mạng.

## 10. Tài liệu kéo theo

Đã cập nhật khi duyệt: [SRS](srs.md) 1.11 (UC-23, FR-PH-20 → FR-PH-26), [BRD](brd.md) 1.3 (BR-10), `features.md`, [Lộ trình](roadmap.md). Còn lại cập nhật khi làm:

- **GDD:** mục Bot.
- **UI-UX:** màn hộp thoại, ô bot.
- **Kỹ thuật:** ADR 0014, [Kiến trúc](../02-architecture/overview.md) (giao thức, state, `BotDriver`), [Cây thư mục](../02-architecture/folder-structure.md).
- **Theo dõi:** `features.md`, changelog.

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
