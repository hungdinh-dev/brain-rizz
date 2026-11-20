# Cây thư mục

Bản đồ toàn bộ repo `brain-rizz`: mỗi file làm gì, và **muốn sửa một thứ thì mở file nào**. Không liệt kê `node_modules/`, `dist/`, `.turbo/` (sinh tự động, không sửa tay).

Cập nhật: 2026-11-19 (CR-017 trống quay dọc, CR-018 phòng 12 người, CR-019 trang quản trị). Khi thêm, xoá hay đổi tên thư mục thì sửa lại file này.

## Tổng quan

| Thư mục | Vai trò | Ai dùng |
| --- | --- | --- |
| `packages/shared/` | **Logic game dùng chung**: sinh câu đố, tính điểm, giao thức tin nhắn | Cả web và server |
| `apps/server/` | **Game server** (Colyseus): trọng tài — phòng, đồng hồ, chấm điểm | Chạy trên Fly.io / Render |
| `apps/web/` | **Client** trong trình duyệt: giao diện, minigame (không có 3D — ADR 0010) | Người chơi |
| `assets/` | File gốc đồ hoạ, âm thanh (không ship trực tiếp) | Khi làm art |
| `supabase/` | Migration SQL cho tài khoản, lịch sử, bảng xếp hạng (ADR 0011) | Chủ dự án chạy một lần trên Supabase |
| `docs/` | Kế hoạch, kiến trúc, hướng dẫn, quyết định kỹ thuật | Đọc khi cần |

## Cây chi tiết

```text
brain-rizz/
│
├─ packages/shared/src/        ★ LOGIC GAME — dùng chung cho cả web và server
│  ├─ games/
│  │  ├─ types.ts              Khuôn chung cho mọi minigame (MinigameDef), 5 nhóm kỹ năng (CATEGORIES)
│  │  ├─ index.ts              Danh sách minigame (GAMES) — `pnpm new-game` tự đăng ký vào đây
│  │  ├─ odd-one-out/          ★ MỖI GAME MỘT THƯ MỤC (chỉ logic, không có chữ hiển thị)
│  │  │  ├─ odd-one-out.ts     Kẻ lạc đàn: sinh câu đố theo độ khó, chấm đáp án
│  │  │  └─ odd-one-out.test.ts  Test 10.000 seed
│  │  ├─ shadow-match/         Bóng của ai: <id>.ts + items.ts (8 vật × 7 biến thể, phần hình L/R/C) + test
│  │  ├─ aim-trainer/          Luyện ngắm: <id>.ts (vị trí theo khối 8 câu, bia mồi, aimTrainerHitTest, answerWindowMs) + test
│  │  ├─ chalk-arrows/         Phấn trượt: <id>.ts (mũi tên phấn, luật màu, CHALK_FIELD) + test
│  │  ├─ light-trail/          Theo dấu ánh đèn: <id>.ts (+ lightTrailRevealMs dùng chung scene/server) + test
│  │  ├─ balance/              Cân não: <id>.ts (+ BALANCE_ITEMS: mã các vật) + test
│  │  ├─ number-balloons/      Bóng bay số: <id>.ts + test
│  │  ├─ rotate-match/         Xoay hình: <id>.ts, shapes.ts (kho hình, chỉ dùng trong game) + test
│  │  ├─ who-vanished/         Ai vừa biến mất: <id>.ts + test
│  │  ├─ pair-flip/            Lật cặp: <id>.ts (+ PAIR_FLIP_TIMING, lịch xem/úp cho scene) + test
│  │  ├─ cube-count/           Đếm khối: <id>.ts, model.ts (mô hình bậc thang) + test
│  │  ├─ marble-drop/          Bi rơi đâu: <id>.ts (+ simulateMarbleDrop cho scene) + test
│  │  ├─ hit-target/           Chạm đích: <id>.ts + test
│  │  ├─ cash-count/           Đếm tiền nhanh: <id>.ts (+ CASH_DENOMINATIONS) + test
│  │  ├─ top-view/             Nhìn từ trên: <id>.ts, iso.ts (hình học isometric), patterns.ts (kho hình chiếu) + test
│  │  ├─ fold-box/             Gấp hộp: <id>.ts, cube.ts (gấp lưới lập phương, 24 phép quay) + test
│  │  │                        14 game mở rộng (CR-013, CR-014), mỗi game <id>.ts + <id>.test.ts (10.000 seed + kiểm mẹo đoán):
│  │  ├─ cup-shuffle/          Tráo cốc (+ cupShuffleCupOrder, mốc dòng thời gian cho scene)
│  │  ├─ crowd-search/         Tìm bạn (+ matchesCard, crowdSearchMismatch, CROWD_SPECIES)
│  │  ├─ navon-shapes/         Hình to hình nhỏ (+ NAVON_MASKS 7×7)
│  │  ├─ stack-recall/         Xếp lại tháp (+ stackRecallOnTrack chấm từng lần chạm, STACK_RECALL_KINDS)
│  │  ├─ rhythm-echo/          Nhại nhịp (đáp án đo thời gian, ADR 0013; + rhythmEchoFirstMiss, rhythmEchoNextWindow)
│  │  ├─ bead-pattern/         Chuỗi quy luật (thư viện luật + kiểm duy nhất; + beadPatternClues)
│  │  ├─ latin-cell/           Ô bí ẩn: <id>.ts, grid.ts (hình vuông Latin, bộ giải đếm bước), fallback.ts (câu dự phòng)
│  │  ├─ rule-gate/            Cổng luật (luật theo khối câu, luật ẩn ở Siêu khó)
│  │  ├─ head-count/           Đếm sĩ số (+ headCountTally, mốc dòng thời gian)
│  │  ├─ best-basket/          Giỏ hời nhất (+ bestBasketTotals, bestBasketSolve)
│  │  ├─ number-path/          Đường số (+ evaluateNumberPath, traceNumberPath)
│  │  ├─ piece-fit/            Mảnh vừa khít (dùng hình học của rotate-match/shapes.ts)
│  │  ├─ circuit-link/         Nối mạch (bitmask cổng N/E/S/W, BFS pin → đèn)
│  │  └─ pour-line/            Rót vừa vạch (đáp án đo thời gian, ADR 0013; + pourLineLevelAt, mô hình bình số nguyên)
│  │                           Game mới khai báo durationMs 60 giây, difficultyMultiplier và (nếu cần) speedAllowanceMs (CR-006)
│  ├─ protocol.ts              Tên tin nhắn client ↔ server, kiểm tra dữ liệu (zod), hình dạng state
│  │                           (party + phòng Kiểm tra não: BrainJoinOptionsSchema, BrainClientMessage, BrainStateView)
│  ├─ protocol.test.ts         Test schema tài khoản + Kiểm tra não (accessToken, brainReady)
│  ├─ answer-judge.ts          judgeAnswer: luật chấm một câu (index, hết giờ + dung sai, khoá khi sai, chống spam,
│  │                           sinh lại câu, check, điểm, giờ hiện câu, chuỗi) — hàm thuần, nhận `now`; server
│  │                           (AnswerJudge) và Luyện tập trên web dùng chung; judgeBotAnswer (bot, CR-016) đi chung
│  │                           đường tính điểm qua settleAnswer; answer-judge.test.ts
│  ├─ chat/                    Chat trong phòng (CR-011), hàm thuần dùng chung server + web: constants.ts (120 ký tự,
│  │                           30 tin, CHAT_RATE, CHAT_PHASES, CHAT_QUICK_IDS), profanity.ts (lọc từ tục vi + en),
│  │                           sanitize.ts (làm sạch + cắt), rate-limit.ts (token bucket) + chat.test.ts
│  ├─ bots/                    Bot (CR-016, ADR 0014), hàm thuần tất định, không giải câu đố: types.ts (BotLevel 0–3,
│  │                           BotModel.planAnswer → { delayMs, correct }), levels.ts (BOT_LEVEL_SPECS: bảng 4 mức),
│  │                           models/basic.ts (model v1, nhiễu log-normal), simulate.ts (mô phỏng cân bằng), index.ts
│  │                           (registry BOT_MODELS, planBotAnswer, botSeed, botExpectedSolveMs); bots.test.ts,
│  │                           balance-sim.test.ts (1 000 vòng × mỗi game × mỗi mức). Thêm model: file mới + 1 dòng BOT_MODELS
│  ├─ cosmetics/               Phấn, máy quay phụ kiện, bạn đồng hành khoá (CR-023, CR-024; docs/01-product/
│  │                           gacha-pets-unlocks.md): catalog.ts (24 phụ kiện, sanitizeLoadout), economy.ts (giá, tỉ
│  │                           lệ, bảo hiểm, trần ngày, partyChalkReward/brainChalkReward, thuật toán quay tham chiếu
│  │                           rollGachaBatch, ECONOMY_SQL_CONSTANTS), unlocks.ts (BASE/PET_CHARACTER_IDS, UNLOCK_RULES,
│  │                           parseUnlockStats, evaluateUnlock, unlockedCharacters) + test; economy-sim.test.ts (mô
│  │                           phỏng kinh tế), migration.test.ts (đối chiếu migration gacha.sql qua dấu `@economy`)
│  ├─ brain-test.ts            Kiểm tra não: chọn 5 game (pickBrainTestGames), thời lượng, Điểm Não
│  │                           (computeBrainResult), BRAIN_TEST_RULES_VERSION — server và web dùng chung
│  ├─ scoring.ts               Công thức điểm: điểm gốc, thưởng tốc độ, combo (có trần), hệ số và
│  │                           miễn trừ thời gian theo game (CR-006), điểm thứ hạng co giãn theo số ghế (CR-018);
│  │                           mọi hàm nhận `ScoringConfig` tuỳ chọn (mặc định = công thức chuẩn)
│  ├─ party-config.ts          Cấu hình trận party do admin chỉnh (CR-019): ScoringConfig, DEFAULT_SCORING (hằng số
│  │                           điểm gốc…), ScoringConfigSchema (giới hạn), parsePartyConfig/parseScoringJson (kiểm từng
│  │                           trường, không ném), enabledGameIds (game không bị tắt, < 2 → cả danh mục) + test
│  ├─ admin.ts                 Kiểu trả về của route admin trên game server (AdminRoomView, AdminRoomsResponse…)
│  ├─ match.ts                 Luật một trận: xếp hạng có hoà (rankByRound, rankByMatch), game còn chơi
│  │                           được (availableGames), độ khó đa số (majorityDifficulty)
│  ├─ constants.ts             Số người tối đa (12, CR-018), thời gian đếm ngược, hướng dẫn, vòng quay, khoá khi sai,
│  │                           màu avatar, danh sách nhân vật (CHARACTER_IDS: 6 luôn mở + 6 khoá)…
│  ├─ difficulty.ts            4 mức độ khó và hệ số nhân điểm (tên hiển thị nằm ở i18n của web)
│  ├─ rng.ts                   Bộ sinh số ngẫu nhiên theo seed (KHÔNG sửa thuật toán)
│  ├─ rng.test.ts, misc.test.ts  Test cho rng, mã phòng, tính điểm, đồng bộ giờ, schema tin nhắn
│  ├─ match.test.ts            Test xếp hạng có hoà, game khả dụng, độ khó đa số
│  ├─ room-code.ts             Sinh và kiểm tra mã phòng 4 ký tự
│  ├─ clock.ts                 Tính độ lệch giờ client ↔ server
│  └─ index.ts                 Xuất mọi thứ ra ngoài (thêm file mới thì export ở đây)
│
├─ apps/server/                ★ GAME SERVER (Colyseus) — trọng tài
│  ├─ src/
│  │  ├─ rooms/PartyRoom.ts    Luồng một phòng: vào/rời, chủ phòng, chọn game (vòng quay, bình chọn),
│  │  │                        hướng dẫn + độ khó, bắt đầu vòng, chấm điểm, hết giờ, xếp hạng
│  │  │                        + ghi kết quả trận khi vào podium (match_results)
│  │  ├─ rooms/BrainTestRoom.ts  Kiểm tra não (một người, 5 game): pha intro → countdown → playing →
│  │  │                        game-result → … → finished, tính Điểm Não, lưu vào tài khoản
│  │  ├─ rooms/AnswerJudge.ts  Bọc judgeAnswer của shared cho phòng Colyseus: giữ giờ hiện câu, hạn khoá,
│  │  │                        bộ đếm chống spam của từng người — dùng chung cho cả hai phòng
│  │  ├─ rooms/ChatRelay.ts    Chat của một phòng (CR-011): giới hạn tần suất, làm sạch + lọc, gắn danh tính người
│  │  │                        gửi từ PlayerState, giữ 30 tin gần nhất trong RAM (không DB, không vào state)
│  │  ├─ rooms/BotDriver.ts    Bot của một phòng (CR-016): danh sách bot (mức, model, RNG), hành vi theo pha (sẵn sàng,
│  │  │                        "Đã hiểu" sau 1–3 giây, trả lời theo planBotAnswer + judgeBotAnswer, biểu cảm qua
│  │  │                        ChatRelay), hẹn giờ trên this.clock (PartyRoom huỷ cùng clearTimers)
│  │  ├─ rooms/messages.ts     parseMessage (zod → lỗi invalid), sendError, replyPong dùng chung
│  │  ├─ rooms/loadout.ts      Kiểm sở hữu nhân vật + phụ kiện (CR-023, CR-024): resolveLoadout (thú khoá chưa mở
│  │  │                        → khoi, phụ kiện lọc theo món đã có), dùng chung cho cả hai phòng
│  │  ├─ rooms/schema/PartyState.ts   Dữ liệu đồng bộ xuống mọi máy (phòng + người chơi)
│  │  ├─ rooms/schema/BrainState.ts   State phòng Kiểm tra não (khớp BrainStateView)
│  │  ├─ store/ResultStore.ts  Interface ghi kết quả (verifyToken, saveBrainTest, saveMatchResults, loadCosmetics,
│  │  │                        grantChalk, loadPartyConfig, isAdmin), bản rỗng
│  │  │                        (thiếu biến môi trường), bản RAM cho test, getResultStore/setResultStore
│  │  ├─ store/SupabaseResultStore.ts  Bản thật: supabase-js + khoá secret, xác thực token bằng getClaims;
│  │  │                        đọc `party_settings`, `admins` (CR-019); RPC `unlock_stats_for`, `grant_chalk`,
│  │  │                        bảng `user_items` (CR-023, CR-024)
│  │  ├─ store/party-config-cache.ts  Đệm cấu hình trận party 30 giây (loadPartyConfig, invalidatePartyConfig)
│  │  ├─ store/cosmetics-cache.ts     Đệm quyền đồ trang trí (thành tích + món) 60 giây theo người
│  │  ├─ admin/routes.ts       Route admin (CR-019): GET /admin/rooms, POST /admin/config/reload; Bearer token
│  │  │                        Supabase + isAdmin, CORS, 401/403/503
│  │  ├─ app.config.ts         Đăng ký room, route /healthz, /monitor, /playground, /admin/*
│  │  └─ index.ts              Khởi động server (hầu như không cần sửa)
│  ├─ test/PartyRoom.test.ts   Test phòng chơi với server thật
│  ├─ test/PartyChat.test.ts   Test chat: phát tin, lọc, giới hạn tần suất, chat tắt, pha chơi, lịch sử khi nối lại
│  ├─ test/PartyResults.test.ts  Test ghi match_results (một lần mỗi trận, chỉ người có token hợp lệ)
│  ├─ test/PartyConfig.test.ts  Test cấu hình phòng (CR-018/019): điểm câu + điểm thứ hạng theo cấu hình, game tắt,
│  │                           đổi giữa trận → trận sau, settingsVersion, đệm 30 s, 12 người
│  ├─ test/AdminRoutes.test.ts  Test route admin: 503/401/403/200, OPTIONS, reload
│  ├─ test/PartyBots.test.ts  Test bot (CR-016): quyền + pha của addBot/removeBot/setBotLevel, bot nhường ghế (+ tin
│  │                           botYielded), người tạo giữ màu/nhân vật, không làm chủ phòng, hết người thật thì đóng
│  │                           phòng, điểm khớp planBotAnswer, ghi botCount
│  ├─ test/BrainTestRoom.test.ts  Test Kiểm tra não: đủ 5 game, chấm, hết giờ, lưu/guest/no-db/failed, rớt mạng
│  ├─ test/Cosmetics.test.ts  Test resolveLoadout, đệm quyền 60 s, grantChalk của store RAM (CR-023, CR-024)
│  ├─ test/PartyCosmetics.test.ts  Test thú khoá + phụ kiện khi vào phòng / setProfile (có/không token, store lỗi,
│  │                           nạp xong khi đã rời, bot), phấn party (reward đúng người/số, kẹp trần, hai thẻ),
│  │                           phấn + nhân vật ở Kiểm tra não
│  ├─ test/helpers.ts          Tiện ích test: SOLVE (đáp án đúng mọi game), until, advance, freezeNow…
│  ├─ loadtest/party.ts        Thử tải bằng nhiều bot
│  ├─ Dockerfile               Đóng gói để deploy
│  ├─ tsdown.config.ts         Cấu hình build server thành 1 file (gộp luôn shared)
│  ├─ vitest.config.ts         Cấu hình test của server
│  └─ .env.example             Biến môi trường (PORT, NODE_ENV, SUPABASE_URL, SUPABASE_SECRET_KEY)
│
├─ apps/web/                   ★ CLIENT (trình duyệt) — import nội bộ dùng alias `@/` = `src/`
│  ├─ src/
│  │  ├─ main.tsx              Điểm khởi đầu: khởi tạo i18n, theme, CSS rồi render App
│  │  ├─ app/App.tsx           Chọn màn hình theo pha của phòng, ngoài phòng theo nav.store (4 màn một mình tải lười);
│  │  │                        thanh nút nhạc/âm thanh/ngôn ngữ/theme; bật nhạc nền + âm thanh hiệu ứng; khởi tạo phiên
│  │  │                        tài khoản, quay về từ Google → màn Tài khoản; tải trước chunk màn trong phòng; Toaster
│  │  ├─ app/party-screens.tsx Các màn trong phòng party theo pha (lobby → podium), tải lười cùng registry minigame
│  │  ├─ assets/music/         File nhạc nền (.mp3/.ogg/.m4a) — thả vào là tự nhận; README.md: cách đặt tên, dung lượng
│  │  ├─ assets/sfx/           File âm thanh hiệu ứng `<loại>.mp3` (click, toggle, confirm, back, error, tick, correct, wrong,
│  │  │                        reveal, drumroll, fanfare) —
│  │  │                        thiếu thì dùng tiếng tổng hợp; README.md: bảng tên file ↔ lúc phát, gợi ý bộ Kenney (CC0)
│  │  ├─ features/             ★ MỖI MÀN HÌNH MỘT FEATURE — feature khác chỉ import qua index.ts
│  │  │  ├─ home/              HomeScreen (giới thiệu → menu ⇄ chọn bạn đồng hành; bước lưu ở nav.store), profile.ts
│  │  │  │                     (xuất lại `@/lib/profile`), components/IntroScreen, MenuScreen (4 thẻ + thẻ "Chơi với máy", Bảng xếp hạng,
│  │  │  │                     Tài khoản & lịch sử, ô "Sắp có"), MenuCard, GachaMenuCard (máy quay + quà ngày, CR-023), ProfileScreen, SkillChips, BotDialog (hộp thoại
│  │  │  │                     "Chơi với máy": số bot + mức chung, CR-016), bot-setup.ts (mặc định, tùy chọn bots) + test
│  │  │  ├─ lobby/             LobbyScreen — phòng chờ 2D: mã phòng ẩn/hiện + sao chép, 12 ô người chơi (gọn từ 8 người, CR-018),
│  │  │  │                     đổi nhân vật, sẵn sàng, chủ phòng đặt số vòng + bắt đầu trận;
│  │  │  │                     components/RoomCodePanel, ReadyMeter, PlayerSlot (+ ô trống), CharacterPicker,
│  │  │  │                     MatchSetupCard (+ HostStatusCard), BotSlot (ô bot: đổi mức / bỏ; AddBotSlot: ô trống của
│  │  │  │                     chủ phòng thêm bot, CR-016), use-inline-panel.ts (bảng chọn mở trong ô: focus, Esc, bấm ra
│  │  │  │                     ngoài); bot-slot.test.tsx (dựng tĩnh bằng react-dom/server, không cần DOM)
│  │  │  ├─ music/             Nhạc nền (FR-GD-10): music.store.ts (một thẻ <audio> dùng chung, phát lần lượt, nhỏ tiếng
│  │  │  │                     lúc chơi) + test, audio-output.ts (âm lượng qua GainNode Web Audio — chạy cả trên iPhone; không
│  │  │  │                     có Web Audio thì dùng audio.volume), track-list.ts (import.meta.glob src/assets/music), tracks.ts (tên bài, bài kế)
│  │  │  │                     + test, settings.ts (nhớ bật/tắt, âm lượng, bài) + test, use-music-autoplay.ts (phát ở
│  │  │  │                     thao tác đầu tiên, dừng khi ẩn tab), gesture.ts (thao tác nào thì phát/bỏ qua/thôi chờ)
│  │  │  │                     + test, components/MusicBar (đặt cạnh nút ngôn ngữ/theme)
│  │  │  ├─ sfx/               Âm thanh hiệu ứng (FR-GD-07): player.ts (playSfx: file đã giải mã hoặc tiếng tổng hợp, `when` xếp lịch theo AudioContext, sfxNow; gain
│  │  │  │                     riêng, trả hàm dừng sớm), kinds.ts (13 loại, chọn tiếng theo data-sfx / aria-pressed / role),
│  │  │  │                     recipes.ts (nốt + nhiễu qua bộ lọc; trống dồn, kèn vinh danh, drum-low / drum-high của Nhại nhịp), sources.ts + sfx-files.ts (import.meta.glob src/assets/sfx), settings.ts + sfx.store.ts
│  │  │  │                     (bật/tắt, nhớ trên máy), sfx.test.ts + player.test.ts, use-sfx-effects.ts (listener click uỷ quyền, tải trước file khi mở khoá, lỗi server,
│  │  │  │                     đúng/sai), components/SfxToggle
│  │  │  ├─ motion/            Hiệu ứng chuyển động (FR-GD-12, CR-010): motion.store.ts (nguồn "giảm chuyển động" duy nhất:
│  │  │  │                     useReducedMotion cho React, prefersReducedMotion() cho scene Phaser, gắn data-motion="on"
│  │  │  │                     lên <html> cho biến thể CSS motion-safe/motion-reduce), settings.ts ("system" | "on", nhớ
│  │  │  │                     trên máy) + motion.test.ts, components/MotionToggle (đặt sau SfxToggle)
│  │  │  ├─ chat/              Chat trong phòng (CR-011, S16): components/ChatDock (điện thoại: nút nổi + sheet;
│  │  │  │                     máy tính ≥ 1024 px: cột phải thu gọn được), ChatPanel (tiêu đề, dải tắt tiếng / nối lại),
│  │  │  │                     ChatList, ChatComposer (hàng biểu cảm + ô nhập 120 ký tự), MuteMenu, UnreadBadge,
│  │  │  │                     ReactionBubble (bong bóng 2,5 s trên avatar), ChatEnabledSwitch (+ ChatSettingRow cho
│  │  │  │                     MatchSetupCard); quick.ts (mã → emoji / t()), use-keyboard-inset.ts (sheet bám trên bàn phím),
│  │  │  │                     limit-text.ts (cắt bản nháp theo code point, không cắt đôi emoji) + test
│  │  │  ├─ game-select/       GameSelectScreen — chọn game mỗi vòng: trống quay dọc đồng bộ / chủ phòng chọn + bình chọn;
│  │  │  │                     catalog.ts (danh mục 31 game, gom phiếu, dòng trống quay, bỏ game admin tắt) + test,
│  │  │  │                     drum.ts (hình học trống quay CR-017: góc, độ mờ, vị trí dừng, nhoè) + test,
│  │  │  │                     components/ModeSwitch, Drum (trống quay dọc vô hạn), WheelView, PickView, GameCard, GameThumb,
│  │  │  │                     hooks/use-wheel-spin
│  │  │  ├─ game-intro/        GameIntroScreen — hướng dẫn + mỗi người chọn độ khó, "Đã hiểu", chủ phòng nhắc/bắt đầu;
│  │  │  │                     components/GuideCard, DifficultyChooser (index.ts export cho Luyện tập, Kiểm tra não), RoomDifficulty,
│  │  │  │                     DemoFrame (khung minh hoạ 16:9: Demo động hoặc hình tĩnh, 3 vòng rồi Xem lại, chạm để dừng),
│  │  │  │                     GuideZoom (Phóng to: Dialog máy tính / Sheet điện thoại), GameDemo, GuideParts (CR-021)
│  │  │  ├─ play/              CountdownScreen (+ CountdownStage dùng chung: đếm ngược 5 s party / 3 s một mình),
│  │  │  │                     PlayScreen (khung chơi: HUD điện thoại / 3 cột máy tính), SoloPlayView (khung chơi một mình:
│  │  │  │                     không đối thủ, ô kỷ lục / thanh 5 game, nút Thoát),
│  │  │  │                     standings.ts (hạng trong vòng, combo) + test, unlock-delay.ts (chờ hết khoá sau câu sai
│  │  │  │                     theo lockedUntil của server, cho MinigameBridge) + test, components/ScoreGrid (lưới avatar + điểm trên
│  │  │  │                     điện thoại khi ≥ 7 người, CR-018), connection-sync.ts (báo scene lúc
│  │  │  │                     mất / có lại kết nối và câu server đang chờ: bridge.watchConnection, serverSync) + test,
│  │  │  │                     components/GameFrame (thẻ giấy chứa
│  │  │  │                     Phaser), FrameOverlays (khoá, +điểm, hết giờ, mất kết nối, tải/lỗi), RoundTimer,
│  │  │  │                     ScoreStrip, Scoreboard, MyScore, RoundInfo, ComboChip; scoreboard.test.ts (tên bot đủ,
│  │  │  │                     "(bạn)" chỉ cho trình đọc màn hình, nhãn độ khó có title)
│  │  │  ├─ results/           ResultsScreen (bảng điểm vòng → cộng điểm trận), PodiumScreen (vinh danh hồi hộp: hạng 4+ →
│  │  │  │                     3 → 2 → trống → 1), podium-timeline.ts (lịch hiện, hàm thuần) + test, standings.ts (hạng
│  │  │  │                     trước/sau vòng, bục) + test, components/RoundResults, RewardChip ("+N phấn" / "+0" khi chạm trần, CR-023) + reward-chip.test, MatchTotals, CategoryBest (thẻ
│  │  │  │                     Giỏi nhất mỗi thể loại), Confetti (export qua index cho Luyện tập)
│  │  │  ├─ practice/          Luyện tập (UC-13, chạy trên máy): PracticeScreen (chọn game → hướng dẫn → đếm ngược → chơi →
│  │  │  │                     kết quả), practice.store.ts (lượt, hẹn giờ, lưu + đồng bộ kỷ lục), judge.ts (gọi judgeAnswer
│  │  │  │                     của shared — cùng luật với server, cộng dồn điểm/đúng/sai; seed crypto) + test, records.ts (kỷ lục `brain-rizz:practice`, gộp với
│  │  │  │                     tài khoản) + test, favorites.ts (game yêu thích `brain-rizz:favorites`, đồng bộ `practice_favorites`,
│  │  │  │                     CR-020) + test, components/PracticePick (⭐, mục + chip Yêu thích), PracticeSetup, PracticeResult,
│  │  │  │                     FavoriteStar (nút ⭐ dùng chung thẻ + màn hướng dẫn)
│  │  │  ├─ brain-test/        Kiểm tra não (UC-14, phòng `brain-test`): BrainTestScreen (chọn màn theo pha), components/
│  │  │  │                     BrainIntro, BrainGameIntro (hướng dẫn + Sẵn sàng), BrainProgress (thanh 5 đốt), BrainStep
│  │  │  │                     (màn tạm 3 s), BrainResult (Điểm Não, biểu đồ, so lần trước, hạng tuần, trạng thái lưu)
│  │  │  ├─ account/           Tài khoản & lịch sử (UC-16): AccountScreen (phiên khách/Google, liên kết, đăng xuất, xoá dữ
│  │  │  │                     liệu, hộp "Google đã có dữ liệu"), components/HistoryTabs (3 tab + bảng kỷ lục luyện tập),
│  │  │  │                     ScoreTrend (đường tiến bộ SVG), PartyStrengths (thẻ Thế mạnh trong trận party, CR-010);
│  │  │  │                     strengths.ts (danh hiệu, TB điểm theo thể loại) + test
│  │  │  ├─ gacha/             Máy quay phụ kiện `/gacha` (UC-25, CR-023, tải lười): GachaScreen, pulls.ts (gom kết quả
│  │  │  │                     quay) + test, gacha.css, components/{GachaMachine, WalletCards (số dư, bảo hiểm, cách kiếm), Reveal
│  │  │  │                     (mở viên nang lần lượt, Mở hết, Mới!/+N), OddsPanel (tỉ lệ + 24 món + lịch sử)}
│  │  │  ├─ wardrobe/          Tủ đồ `/wardrobe`, `/wardrobe/pets` (CR-023): WardrobeScreen, components/AccessoriesTab (xem
│  │  │  │                     trước, 3 chỗ, Không đeo); tab Bạn đồng hành = PetsTab của features/pets
│  │  │  ├─ pets/              Bạn đồng hành khoá (UC-26, CR-024): pets.store + use-pet-unlocks (my_unlock_stats), unlock-text
│  │  │  │                     + use-unlock-text (chữ điều kiện theo loại luật), pet-info, open-goal (Luyện ngay →
│  │  │  │                     `/practice/<game>?d=`, `/practice?cat=`), seen (thú đã thấy theo người dùng,
│  │  │  │                     `brain-rizz:pets-seen`), components/{PetGrid, PetLockSheet, PetsTab, LockParts,
│  │  │  │                     UnlockCelebration} + test
│  │  │  ├─ admin/             Trang quản trị `/admin` (UC-24, CR-019, tải lười): AdminScreen (cổng quyền + khung), admin.store.ts,
│  │  │  │                     sections.ts, draft.ts (bản nháp cấu hình, kiểm bằng ScoringConfigSchema, ≥ 2 game bật) + test,
│  │  │  │                     format.ts + test, stats.ts, hooks/use-admin-data, components/{kit, AdminChrome, SaveBar, BarChart,
│  │  │  │                     GameIcon}, sections/{Overview, Games, Scoring, Logins, Players, Matches, Rooms, Admins}Section
│  │  │  └─ leaderboard/       Bảng xếp hạng (UC-19): LeaderboardScreen (tab Điểm Não / Theo minigame, kỳ, chọn game),
│  │  │                        components/BoardView (top 3, danh sách 50, dòng của mình), week.ts (đầu tuần giờ VN,
│  │  │                        màu avatar theo user_id) + test
│  │  ├─ games/                ★ MỖI MINIGAME MỘT THƯ MỤC (phần hiển thị; logic ở packages/shared)
│  │  │  ├─ odd-one-out/
│  │  │  │  ├─ OddOneOutScene.ts  Vẽ và xử lý chạm (Phaser)
│  │  │  │  ├─ OddOneOutHowTo.tsx Hình minh hoạ SVG cho màn Hướng dẫn và thẻ game
│  │  │  │  ├─ locales.ts      Chữ màn hướng dẫn (vi, en): tên, mô tả, 3 bước, điều khiển, câu nhắc, 4 mức
│  │  │  │  └─ index.ts        GameClient: scene (tải lười) + locales + Illustration
│  │  │  ├─ shadow-match/    Bóng của ai: ShadowMatchScene, art.ts (hàm vẽ phần hình) + art.test, HowTo, locales, index
│  │  │  ├─ _shared/demo/    Khung diễn hướng dẫn động (CR-021): timeline.ts (mốc ms → trạng thái, hàm thuần) + test,
│  │  │  │                   demo-scripts.test.ts (kịch bản 5 game khớp đặc tả), DemoStage (sân khấu 640×360, dừng khi
│  │  │  │                   ẩn tab / ra khỏi màn / giảm chuyển động), parts.tsx (tay, con trỏ, sóng chạm, ✓/✗/⚡), index.ts.
│  │  │  │                   Demo từng game: games/<id>/<Name>Demo.tsx (đợt đầu: odd-one-out, light-trail, balance,
│  │  │  │                   number-balloons, rotate-match), gán `Demo` (lazy) trong index.ts của game
│  │  │  ├─ _shared/         Phần hiển thị dùng chung giữa nhiều game (không phải một game; game không import chéo
│  │  │  │                   thư mục của nhau, cần dùng lại thì đưa vào đây): icons.ts (mắt, mắt nhắm, bàn tay,
│  │  │  │                   huy hiệu đổi chỗ, dấu tích), items.ts (hình 8 vật của Cân não, dùng lại ở Lật cặp và
│  │  │  │                   Ai vừa biến mất), canvas.ts (makeCanvas, withHalo, roundRectPath), canvas-svg.ts (cây
│  │  │  │                   SVG React → canvas 2D → texture), chalk.ts (nét/hạt phấn, paintArt/placeArt),
│  │  │  │                   card-art.ts (thẻ chọn, vòng ✓, huy hiệu ✓/✗/gương), resync.ts (cách hiện lại câu
│  │  │  │                   khi nối lại, nhận ra câu bị server bỏ qua) + test
│  │  │  ├─ aim-trainer/     Luyện ngắm: AimTrainerScene, sync.ts (chip chỉ đếm câu server chấm đúng) + test,
│  │  │  │                   HowTo, locales, index
│  │  │  ├─ chalk-arrows/    Phấn trượt: ChalkArrowsScene, HowTo, locales, index
│  │  │  ├─ light-trail/, balance/, number-balloons/, rotate-match/, who-vanished/, pair-flip/,
│  │  │  │  cube-count/, marble-drop/, hit-target/, cash-count/, top-view/, fold-box/
│  │  │  │                     Cùng khuôn: <Name>Scene.ts, <Name>HowTo.tsx, locales.ts, index.ts;
│  │  │  │                     light-trail/ có thêm shapes.ts (bóng đèn, tua ngược) — dùng chung cho scene và
│  │  │  │                     hình minh hoạ; cube-count/ có art.ts, who-vanished/ có items.ts + shapes.ts (rèm)
│  │  │  ├─ cup-shuffle/, crowd-search/, navon-shapes/, stack-recall/, rhythm-echo/, bead-pattern/,
│  │  │  │  latin-cell/, rule-gate/, head-count/, best-basket/, number-path/, piece-fit/, circuit-link/,
│  │  │  │  pour-line/         14 game mở rộng (CR-013, CR-014), cùng khuôn Scene + HowTo + locales + index; file thêm
│  │  │  │                     (dùng chung cho scene và hình minh hoạ): cup-shuffle/shapes.ts (cốc, phấn, tẩy),
│  │  │  │                     crowd-search/buddies.tsx (6 loài + phụ kiện SVG),
│  │  │  │                     stack-recall/blocks.ts (8 loại khối), rhythm-echo/shapes.ts (tai, loa, nốt),
│  │  │  │                     bead-pattern/beads.ts (hạt, nhãn chấm), latin-cell/shapes.ts (6 hình),
│  │  │  │                     rule-gate/shapes.ts + art.ts (bạn, phụ kiện, vé) + play-state.ts (sổ cổng, gợi ý) + test,
│  │  │  │                     head-count/figures.tsx (học sinh, thầy) + timeline.ts (dòng thời gian) + test,
│  │  │  │                     best-basket/art.ts (8 món, xu, giỏ), pour-line/vessel.ts (bình → px) + hold.ts (đo ms) + test
│  │  │  ├─ registry.ts        Nối mã game → GameClient — `pnpm new-game` tự đăng ký vào đây
│  │  │  ├─ keyboard.ts        Lọc phím cho scene bắt phím (shouldIgnoreGameKey: đang gõ chữ, đang mở hộp thoại/sheet) + test
│  │  │  ├─ locales.test.ts    Test chữ các game: câu nhắc theo mức đủ ở mọi ngôn ngữ, danh mục i18n khớp tên + summary
│  │  │  ├─ PhaserHost.tsx     Tạo/huỷ game Phaser, báo trạng thái tải, preloadGame (tải trước lúc đếm ngược)
│  │  │  └─ types.ts           MinigameBridge (React ↔ Phaser), GameLocale (+ levelHints: câu nhắc theo mức), GameClient
│  │  │                        (+ Demo tuỳ chọn, DemoProps — CR-021),
│  │  │                        khung 720×1280
│  │  ├─ components/
│  │  │  ├─ ui/                Component shadcn đã chỉnh kiểu nhãn dán (button, input, card, toggle-group, tabs, alert-dialog, dialog, skeleton, slider, sheet, switch…)
│  │  │  ├─ characters/        ★ NHÂN VẬT: Character (6 con vật × 7 biểu cảm, SVG + hoạt ảnh), specs.tsx; BotBadge (huy hiệu
│  │  │  │                     máy, CR-016), bot-name.ts (tên bot "Fen · máy", đánh số khi trùng nhân vật, tin chat có cờ bot)
│  │  │  │                     + test, PlayerName (usePlayerName + tên hai phần: tên cắt được, hậu tố "· máy" luôn giữ;
│  │  │  │                     `compact` cho chỗ chật đã có huy hiệu: ẩn hậu tố khỏi mắt, giữ số "Fen 2") + player-name.test.tsx;
│  │  │  │                     accessories.tsx (CR-023: 24 phụ kiện SVG quanh điểm neo, AccessoryIcon, wornAccessories) + test
│  │  │  ├─ brand/             Logo chữ nhún, linh vật BrainMascot, hình vẽ phấn ChalkDoodle + ChalkDefs
│  │  │  └─ common/            Dùng ở nhiều feature: PlayerAvatar (nhân vật trong khung tròn), DifficultyPicker, ConnectionBanner,
│  │  │                        ThemeToggle, LanguageToggle, RankBadge (huy hiệu hạng), MatchChips (nhãn vòng, nhóm kỹ năng,
│  │  │                        độ khó; màu + biểu tượng nhóm), HostWaitCard ("Chờ chủ phòng…"), AvatarStrip (hàng nhân vật cả phòng),
│  │  │                        ScreenHeader (nút quay lại + tiêu đề phấn), EmptyState + DataProblemState (trống / lỗi + Thử lại /
│  │  │                        chưa kết nối máy chủ dữ liệu), QuitDialog ("Bỏ lượt này?"; tiêu đề/nút tuỳ chọn, dùng cả cho "Rời phòng?" khi Back trong phòng), BrainRadar (biểu đồ 5 cạnh SVG),
│  │  │                        BotLevel (mức bot: BotLevelChip, BotLevelPicker radio, BotLevelButtons thêm bot; CR-016),
│  │  │                        RarityBadge (độ hiếm: màu + hạt ◆ + tên), ChalkChip + ChalkIcon (số phấn, "+N phấn"; CR-023)
│  │  ├─ i18n/
│  │  │  ├─ index.ts           Khởi tạo i18next (chỉ namespace `common` trong gói đầu), chọn ngôn ngữ lần đầu
│  │  │  ├─ admin.ts           Tải lười chữ trang quản trị (locales/admin/)
│  │  │  ├─ gacha.ts           Tải lười chữ máy quay, tủ đồ, 24 phụ kiện, độ hiếm (locales/gacha/, CR-023)
│  │  │  ├─ solo.ts            loadSoloLocales: tải lười chữ 4 màn một mình (locales/solo/) gộp vào `common`
│  │  │  ├─ games.ts           registerGameLocales: gom `src/games/<id>/locales.ts` vào namespace `games` (gọi từ chunk lười)
│  │  │  ├─ languages.ts       Danh sách ngôn ngữ (vi, en)
│  │  │  ├─ locales/vi.ts, en.ts  Bản dịch giao diện (vi là nguồn chuẩn, en bị ép đủ khoá)
│  │  │  ├─ locales/solo/vi.ts, en.ts  Chữ Luyện tập, Kiểm tra não, Tài khoản, Bảng xếp hạng (tải lười, en bị ép đủ khoá)
│  │  │  ├─ locales/admin/vi.ts, en.ts  Chữ trang quản trị (tải lười, en bị ép đủ khoá)
│  │  │  ├─ locales/gacha/vi.ts, en.ts  Chữ máy quay + tủ đồ (tải lười, en bị ép đủ khoá)
│  │  │  └─ i18next.d.ts       Kiểu cho khoá dịch
│  │  ├─ hooks/                use-game-text (chữ của game theo ngôn ngữ, câu nhắc theo mức), use-media-query (bố cục điện thoại/máy tính, chạm/chuột),
│  │  │                        use-number-format (1.180 / 1,2 theo ngôn ngữ), use-server-clock, use-server-time-reached
│  │  │                        (giờ server cho đồng hồ, đếm ngược, hết giờ), use-pending-action (khoá nút gửi lệnh
│  │  │                        tới khi state đổi hoặc server báo lỗi, chống bấm đúp), use-data (tải dữ liệu Supabase:
│  │  │                        đang tải / xong / chưa kết nối / chưa có phiên / lỗi + reload), use-date-format (16/10),
│  │  │                        use-count-up (số đếm lên, tắt khi giảm chuyển động), use-room-scoring (cấu hình điểm
│  │  │                        của phòng từ `scoringJson`, CR-019)
│  │  ├─ lib/                  utils.ts (cn), storage.ts (localStorage an toàn + tên khoá), avatar.ts, profile.ts (hồ sơ
│  │  │                        trên máy: tên, nhân vật, độ khó, phụ kiện — dùng chung, `@/features/home` xuất lại) + test,
│  │  │                        supabase.ts (client tải lười, thiếu biến → null; đọc lỗi quay về từ Google) + test,
│  │  │                        audio-context.ts (một AudioContext dùng chung cho nhạc nền + âm thanh hiệu ứng, mở khoá/resume),
│  │  │                        room-size.ts (bố cục theo số ghế, CR-018) + test, device-label.ts ("trình duyệt · hệ điều
│  │  │                        hành" cho log đăng nhập) + test
│  │  ├─ net/connection.ts     Mọi thứ liên quan mạng: tạo/vào/rời phòng party (kèm accessToken; tạo phòng kèm `bots` và
│  │  │                        huỷ giữa chừng, CR-016), phòng Kiểm tra não (startBrainTest/leaveBrainTest/sendBrain), gửi tin,
│  │  │                        nối lại (dùng chung một lần resume, handler chỉ nhận phòng hiện tại), đồng bộ giờ; rời phòng
│  │  │                        bằng `closeRoom` (gửi LEAVE rồi client tự đóng, không chờ server); create-party.test.ts,
│  │  │                        resume-party.test.ts, leave-room.test.ts (giả lập Colyseus)
│  │  ├─ net/gacha-api.ts      RPC phấn + máy quay (my_wallet, claim_daily_chalk, gacha_pull, my_items, gacha_history) + test
│  │  ├─ net/unlocks-api.ts    RPC my_unlock_stats → parseUnlockStats (CR-024) + test; net/party-cosmetics.test.ts (gửi
│  │  │                        accessories, nhận tin Reward)
│  │  ├─ net/server-url.ts     SERVER_URL (Colyseus) và SERVER_HTTP_URL (route admin) dùng chung
│  │  ├─ net/admin-api.ts      Gọi RPC `admin_*` của Supabase và route admin của game server (DataResult, ánh xạ lỗi
│  │  │                        forbidden / not-found / self / last-admin) + test
│  │  ├─ net/brain-leave.ts    Phòng Kiểm tra não đóng vì để quá lâu ở intro (close code riêng) → về màn giới thiệu + test
│  │  ├─ net/bot-yielded.ts    Câu toast bot nhường ghế (tin `botYielded`, CR-016), tên bot dịch theo `botAvatar`; test gồm
│  │  │                        cả connection nghe tin và hiện toast 3 giây (giả lập Colyseus)
│  │  ├─ net/data-api.ts       Đọc/ghi Supabase: bảng xếp hạng, hạng của mình, lịch sử 3 loại, gửi kỷ lục luyện tập
│  │  │                        (trả DataResult: not-configured / no-session / error, không ném lỗi) + test (thiếu biến môi trường,
│  │  │                        toMatchRow đọc bot_count)
│  │  ├─ stores/
│  │  │  ├─ auth.store.ts      Phiên Supabase (khách lười / Google): ensureSession, linkGoogle, signInGoogle, signOut,
│  │  │  │                     deleteMyData, syncProfile (tên + nhân vật lên `profiles`), ghi sự kiện đăng nhập
│  │  │  │                     (`log_login`, CR-019)
│  │  │  ├─ nav.store.ts       Màn ngoài phòng + URL (CR-022, History API, không thư viện router): screenForPath /
│  │  │  │                     pathForScreen (`/practice[?cat=]`, `/practice/<game>[?d=]`, `/brain-test`, `/leaderboard[/<game>]`, `/account`,
│  │  │  │                     `/profile`, `/admin/<mục>`), push/replace, popstate (Back/Forward/F5), chặn Back trong phòng
│  │  │  │                     (mục `/r/<mã>` + hỏi Rời phòng), danh sách mục quản trị; cờ tập trung khi đang chơi + test
│  │  │  ├─ game.store.ts      State phòng chơi (Zustand): phòng party hoặc Kiểm tra não (`brain`), độ lệch giờ, kết quả
│  │  │  │                     câu gần nhất (Luyện tập cũng dùng)…
│  │  │  │                     (bỏ dữ liệu vòng cũ khi seed trong state đổi)
│  │  │  ├─ game.store.test.ts Test store: tải lại trang, mất tin roundStart khi nối lại
│  │  │  ├─ chat.store.ts      Chat (CR-011): tin nhận (gộp lịch sử, bỏ trùng, giữ 50), số chưa đọc, bong bóng đang hiện,
│  │  │  │                     tắt tiếng theo mã phòng (localStorage), giới hạn tần suất phía client, bản nháp
│  │  │  ├─ chat.store.test.ts Test hàm thuần + store chat
│  │  │  ├─ wallet.store.ts    Số dư phấn, bảo hiểm, quà ngày (CR-023) + test; hook use-claim-daily ở hooks/
│  │  │  └─ theme.store.ts     Giao diện sáng/tối/theo hệ thống
│  │  ├─ styles/
│  │  │  ├─ globals.css        Token màu bảng phấn sáng/tối, màu thương hiệu, font, utility chalkboard/sticker-text
│  │  │  ├─ characters.css     Hoạt ảnh nhân vật, hình vẽ phấn, pháo giấy vinh danh, bong bóng/badge chat (char-*, fx-*, chat-*)
│  │  │  └─ shadcn.css         Keyframes + variant mà component shadcn cần (chép từ package shadcn)
│  │  └─ vite-env.d.ts         Khai báo kiểu cho biến môi trường VITE_* (gồm VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
│  ├─ public/                  File tĩnh: favicon.svg, _redirects (sau này: assets/models, assets/games/<id>)
│  ├─ index.html               Tiêu đề trang, font, meta cho điện thoại, script gắn theme trước khi tải
│  ├─ components.json          Cấu hình shadcn CLI (`pnpm dlx shadcn@latest add <tên>`)
│  ├─ vite.config.ts           Cấu hình Vite (plugin React, Tailwind, alias @/, cổng 5173)
│  └─ .env.example             VITE_SERVER_URL (địa chỉ game server khi deploy), VITE_SUPABASE_URL,
│                              VITE_SUPABASE_PUBLISHABLE_KEY
│
├─ assets/
│  ├─ README.md                Giải thích thư mục asset và quy trình
│  ├─ source/blender/          (Không dùng nữa — bỏ 3D theo ADR 0010; thư mục còn giữ chỗ)
│  ├─ source/figma/            Bản xuất/link Figma (icon, sprite)
│  ├─ source/audio/            Âm thanh gốc, dự án jsfxr
│  ├─ exports/                 Bản xuất trung gian trước khi tối ưu
│  └─ LICENSES.md              Sổ ghi giấy phép asset (bắt buộc cập nhật)
│
├─ supabase/migrations/       SQL tạo bảng, RLS, RPC bảng xếp hạng (chạy theo docs/03-guides/supabase-setup.md)
│  ├─ 20261016000000_accounts.sql  5 bảng (profiles, brain_tests, brain_test_games, match_results,
│  │                           practice_bests), index, RLS, 6 RPC
│  ├─ 20261019000000_match_category_scores.sql  match_results thêm category_scores (jsonb),
│  │                           category_titles (text[]) — CR-010
│  ├─ 20261021000000_match_bot_count.sql  match_results thêm bot_count (smallint, mặc định 0) — CR-016;
│  │                           chạy trước khi deploy server mới
│  ├─ 20261119000000_admin_console.sql  Trang quản trị (CR-019): admins, party_settings (+ history), login_events,
│  │                           match_results.settings_version, RPC is_admin, log_login, admin_*; chạy trước khi
│  │                           deploy server mới
│  ├─ 20261119100000_practice_favorites.sql  Game yêu thích (CR-020): practice_favorites + RPC practice_favorites_get /
│  │                           _set / _merge; chạy trước khi deploy web mới
│  └─ 20261120000000_gacha.sql  Phấn + máy quay + mở khoá thú (CR-023/024, ADR 0016): chalk_ledger, cosmetic_items
│                              (seed 24 món), user_items, gacha_state, gacha_pulls; RPC my_wallet, claim_daily_chalk,
│                              gacha_pull, my_items, gacha_history, my_unlock_stats, grant_chalk + unlock_stats_for
│                              (service role), thay submit_practice_result; hằng số đánh dấu /* @economy … */ (test
│                              shared cosmetics/migration.test.ts so với economy.ts); chạy trước khi deploy server + web
│
├─ docs/                       Tài liệu, chia theo chủ đề — mục lục: docs/README.md
│  ├─ README.md                Mục lục tài liệu, bản đồ SDLC, quy ước đặt tài liệu mới
│  ├─ 00-tracking/             THEO DÕI (tài liệu sống)
│  │  ├─ README.md             Mục lục thư mục
│  │  ├─ status.md             Báo cáo tình trạng hằng tuần
│  │  ├─ features.md           Danh sách tính năng & use case, trạng thái
│  │  ├─ changelog.md          Nhật ký phát hành theo phiên bản
│  │  ├─ change-requests.md    Yêu cầu thay đổi phạm vi (CR)
│  │  └─ reports/              Báo cáo ngày: README.md (danh sách + quy chuẩn), _template.md, YYYY-MM-DD.md
│  ├─ 01-product/              SẢN PHẨM
│  │  ├─ README.md             Mục lục thư mục
│  │  ├─ vision.md             Tầm nhìn & phạm vi, mục tiêu, rủi ro, câu hỏi mở
│  │  ├─ brd.md                Yêu cầu nghiệp vụ: personas, hành trình, BR, quy tắc
│  │  ├─ srs.md                Đặc tả yêu cầu phần mềm: UC, FR, NFR, truy vết
│  │  ├─ game-design.md        GDD: vòng lặp chơi, chế độ, điểm, độ khó, nhân vật
│  │  ├─ ui-ux.md              Bản đồ màn hình, link canvas, hệ thống thiết kế
│  │  ├─ roadmap.md            Mốc thời gian, cổng kiểm tra, checklist giai đoạn
│  │  ├─ minigame-expansion.md Kế hoạch mở rộng minigame 17 → 31 (đề xuất, chưa duyệt)
│  │  └─ bot-players.md        Kế hoạch chơi với bot (đã duyệt CR-016)
│  ├─ 02-architecture/         KIẾN TRÚC
│  │  ├─ README.md             Mục lục thư mục
│  │  ├─ overview.md           Kiến trúc, luồng phòng chơi, giao thức tin nhắn
│  │  ├─ tech-stack.md         Công nghệ, phiên bản, dịch vụ, làm quen cho dev mới
│  │  ├─ folder-structure.md   (file này)
│  │  ├─ server-fallback.md    Kế hoạch dự phòng game server, rủi ro khi bỏ Colyseus
│  │  └─ decisions/            Quyết định kỹ thuật: README.md, ADR 0001–0015, _template.md
│  ├─ 03-guides/               HƯỚNG DẪN
│  │  ├─ README.md             Mục lục thư mục
│  │  ├─ sdlc.md               Quy trình phát triển, DoR/DoD, phiên bản & phát hành
│  │  ├─ testing.md            Kế hoạch kiểm thử, ma trận thiết bị, checklist phát hành
│  │  ├─ development.md        Cài đặt, quy ước, cách thêm minigame
│  │  ├─ deployment.md         Deploy và so sánh hosting
│  │  ├─ supabase-setup.md     Tạo project Supabase, chạy migration, bật đăng nhập khách + Google, biến môi trường
│  │  ├─ assets.md             Nguồn asset, pipeline tối ưu
│  │  └─ ai-agents.md          Đội AI agent theo phòng ban, workflow song song
│  └─ 04-minigames/            MINIGAME
│     ├─ README.md             Danh mục 15 game và trạng thái
│     ├─ _template.md          Mẫu đặc tả game mới
│     ├─ odd-one-out.md        Đặc tả Kẻ lạc đàn
│     ├─ shadow-match.md       Đặc tả Bóng của ai
│     ├─ aim-trainer.md        Đặc tả Luyện ngắm
│     ├─ chalk-arrows.md       Đặc tả Phấn trượt
│     ├─ whack-right.md        Đặc tả Đập đúng hình (📝, code chưa đăng ký)
│     ├─ light-trail.md        Đặc tả Theo dấu ánh đèn (MVP)
│     ├─ balance.md            Đặc tả Cân não (MVP)
│     ├─ number-balloons.md    Đặc tả Bóng bay số (MVP)
│     └─ rotate-match.md       Đặc tả Xoay hình (MVP)
│
└─ (cấu hình ở thư mục gốc — hiếm khi đụng)
   ├─ package.json             Lệnh chung: pnpm dev / build / test / check / new-game / share
   ├─ scripts/new-game.mjs     Tạo khung minigame mới (`pnpm new-game <id> <nhóm>`)
   ├─ scripts/share.mjs        Chia sẻ cho bạn bè qua Cloudflare Quick Tunnel (`pnpm share`; build ra apps/web/dist-share)
   ├─ pnpm-workspace.yaml      Khai báo các package trong monorepo
   ├─ pnpm-lock.yaml           Khoá phiên bản thư viện (không sửa tay)
   ├─ turbo.json               Thứ tự chạy build/test giữa các package
   ├─ tsconfig.base.json       Cấu hình TypeScript chung (mỗi app có tsconfig.json riêng kế thừa)
   ├─ biome.json               Quy tắc lint/format
   ├─ render.yaml              Blueprint deploy game server lên Render Free (ADR 0017)
   ├─ fly.toml                 Deploy server lên Fly.io (dự phòng)
   ├─ .github/workflows/ci.yml Kiểm tra tự động khi push lên GitHub
   ├─ .vscode/                 Cài đặt và extension gợi ý cho VS Code
   ├─ .claude/agents/          5 phòng ban AI agent: game-designer, ui-designer, frontend-dev, backend-dev, qa-tester
   ├─ .claude/workflows/       Quy trình nhiều agent: feature.js, new-minigame.js, qa-fix.js (Biome bỏ qua)
   ├─ .gitignore, .gitattributes, .editorconfig, .dockerignore, .nvmrc, .npmrc
   ├─ README.md                Giới thiệu và bắt đầu nhanh
   └─ AGENTS.md, CLAUDE.md     Quy tắc cho AI hỗ trợ code
```

## Muốn làm gì thì sửa ở đâu

| Muốn làm | Sửa file |
| --- | --- |
| **Thêm minigame mới** | `pnpm new-game <id> <nhóm>` — tạo sẵn `packages/shared/src/games/<id>/` (logic + test), `apps/web/src/games/<id>/` (scene + chữ), đặc tả, và tự đăng ký<br>Chi tiết: [Hướng dẫn phát triển](../03-guides/development.md#thêm-một-minigame) |
| Đổi cách sinh câu đố hoặc độ khó của một game | `packages/shared/src/games/<id>/<id>.ts` |
| Đổi giao diện trong lúc chơi một game (hình vẽ, hiệu ứng, cách chạm) | `apps/web/src/games/<id>/…Scene.ts` |
| Đổi tên / câu hướng dẫn của một game | `apps/web/src/games/<id>/locales.ts` |
| Đổi công thức tính điểm | `packages/shared/src/scoring.ts`; giá trị mặc định + giới hạn admin được chỉnh: `packages/shared/src/party-config.ts` |
| Chỉnh điểm / hệ số / bật tắt game của trận party mà không deploy (CR-019) | Trang `/admin` → Điểm & hệ số, Game (lưu vào `party_settings` trên Supabase; trận kế tiếp áp dụng) |
| Sửa trang quản trị (CR-019) | Web: `apps/web/src/features/admin/`, `net/admin-api.ts`, chữ `i18n/locales/admin/`; RPC: migration mới trong `supabase/migrations/`; route server: `apps/server/src/admin/routes.ts` |
| Đổi số người tối đa, thời gian đếm ngược, thời gian khoá khi sai, màu avatar | `packages/shared/src/constants.ts` |
| Đổi luật phòng (ai được bắt đầu, khi nào hết vòng, chuyển chủ phòng) | `apps/server/src/rooms/PartyRoom.ts` |
| Thêm thông tin cần hiện cho mọi người (vd. số câu đúng) | `apps/server/src/rooms/schema/PartyState.ts` **và** `PlayerView`/`PartyStateView` trong `packages/shared/src/protocol.ts` |
| Sửa bot (CR-016): mức, model, hành vi, giao diện | Thông số 4 mức: `packages/shared/src/bots/levels.ts` (chỉ đổi số, rồi cập nhật bảng 3.1 của `docs/01-product/bot-players.md`); model mới: `bots/models/<id>.ts` + `BOT_MODELS`; hành vi theo pha: `apps/server/src/rooms/BotDriver.ts`; luật ghế / chủ phòng: `PartyRoom.ts`; web: `components/characters/{BotBadge,bot-name,PlayerName}`, `components/common/BotLevel.tsx`, `features/home/components/BotDialog.tsx`, `features/lobby/components/BotSlot.tsx`, khoá i18n `bots.*` |
| Sửa chat trong phòng (CR-011) | Luật/lọc: `packages/shared/src/chat/`; server: `apps/server/src/rooms/ChatRelay.ts` + `handleChat` trong `PartyRoom.ts`; web: `apps/web/src/features/chat/`, `stores/chat.store.ts`, đăng ký tin trong `net/connection.ts` |
| Thêm một hành động mới (vd. đổi avatar) | `protocol.ts` → xử lý trong `PartyRoom.ts` (mục `messages`) → hàm gửi trong `apps/web/src/net/connection.ts` → nút bấm trong `apps/web/src/features/<màn hình>/` |
| Sửa giao diện trang chủ, phòng chờ, chọn game, hướng dẫn, lúc chơi, kết quả, vinh danh | `apps/web/src/features/{home,lobby,game-select,game-intro,play,results}/` |
| Sửa Luyện tập, Kiểm tra não, Tài khoản & lịch sử, Bảng xếp hạng | `apps/web/src/features/{practice,brain-test,account,leaderboard}/`; gọi Supabase ở `apps/web/src/net/data-api.ts`, phiên ở `apps/web/src/stores/auth.store.ts` |
| Thêm màn hình mới | Tạo `apps/web/src/features/<tên>/` (kèm `index.ts`), rẽ nhánh trong `apps/web/src/app/App.tsx` (màn ngoài phòng: thêm vào `Screen` trong `stores/nav.store.ts`) |
| Thêm/sửa chữ hiển thị, thêm ngôn ngữ | `apps/web/src/i18n/locales/vi.ts` trước, rồi `en.ts` (TypeScript báo khoá thiếu); chữ 4 màn một mình: `i18n/locales/solo/{vi,en}.ts`; ngôn ngữ mới: `i18n/languages.ts` (+ `solo.ts`) |
| Thêm component UI (dialog, select, tabs…) | `pnpm dlx shadcn@latest add <tên>` trong `apps/web` → `src/components/ui/` (xem [ADR 0006](decisions/0006-ui-shadcn-and-theme-tokens.md)) |
| Đổi màu (sáng/tối), font | `apps/web/src/styles/globals.css` (font: `apps/web/index.html`) |
| Đổi kiểu nút, ô nhập, thẻ… | `apps/web/src/components/ui/<tên>.tsx` |
| Thêm/sửa nhân vật, biểu cảm | Hình dạng: `apps/web/src/components/characters/specs.tsx`; biểu cảm chung: `Character.tsx`; id mới: `CHARACTER_IDS` trong `packages/shared/src/constants.ts` + tên trong i18n (`characters.<id>`). Phụ kiện: hình ở `components/characters/accessories.tsx` (id theo `COSMETIC_ITEMS`), chỗ đặt theo `anchors` của loài trong `specs.tsx`. Xem [ADR 0009](decisions/0009-chalkboard-style-and-characters.md) |
| Màn giới thiệu, menu chính, chọn nhân vật | `apps/web/src/features/home/components/{IntroScreen,MenuScreen,ProfileScreen}.tsx` |
| Bục vinh danh, pháo giấy, nhịp lật | `apps/web/src/features/results/PodiumScreen.tsx`, `podium-timeline.ts` (mốc ms), `components/Confetti.tsx`, `components/CategoryBest.tsx` (2D, không 3D — ADR 0010); keyframes `fx-*` trong `styles/characters.css` |
| Bật/tắt hiệu ứng chuyển động, đọc "giảm chuyển động" | `apps/web/src/features/motion/` (không tự đọc `matchMedia`); biến thể `motion-safe`/`motion-reduce` trong `styles/globals.css` |
| Hình minh hoạ cách chơi, nội dung màn Hướng dẫn của một game | `apps/web/src/games/<id>/locales.ts` + `…HowTo.tsx` (gán `Illustration` trong `index.ts`) |
| Trống quay dọc chọn game (CR-017) | Hình học: `apps/web/src/features/game-select/drum.ts`; hiển thị: `components/Drum.tsx`; biểu tượng riêng cho game: trường `Icon` của `GameClient` (`games/<id>/index.ts`), không có thì dùng `Illustration` |
| Danh mục 15 game ở màn Chọn game (thẻ "Sắp có") | `apps/web/src/features/game-select/catalog.ts` + tên ở i18n `catalog.<id>` |
| Đổi luật Kiểm tra não (chọn game, thời lượng, Điểm Não) | `packages/shared/src/brain-test.ts` (đổi điểm chuẩn thì tăng `BRAIN_TEST_RULES_VERSION`); luồng phòng: `apps/server/src/rooms/BrainTestRoom.ts` |
| Đổi thưởng phấn, giá / tỉ lệ / bảo hiểm máy quay, điều kiện mở thú | `packages/shared/src/cosmetics/economy.ts`, `unlocks.ts` (`UNLOCK_RULES`); chạy lại `economy-sim.test.ts`, sửa số trong migration Supabase (dấu `@economy`, test `migration.test.ts`), bảng ở `docs/01-product/gacha-pets-unlocks.md` mục 3.2 + 4 và GDD mục Kinh tế |
| Đổi cách chấm một câu (khoá khi sai, chống spam, dung sai) | `packages/shared/src/answer-judge.ts` (party, Kiểm tra não và Luyện tập cùng dùng) |
| Bảng, quyền đọc/ghi, bảng xếp hạng trên Supabase | Thêm migration mới trong `supabase/migrations/` (không sửa file đã chạy); server ghi qua `apps/server/src/store/` |
| Lỗi kết nối, nối lại phòng, đồng hồ lệch | `apps/web/src/net/connection.ts` (client); `onDrop`/`onReconnect`/`onLeave` trong `PartyRoom.ts` (server) |
| Thay tiếng bấm nút, đếm ngược, đúng/sai | Chép `<loại>.mp3` vào `apps/web/src/assets/sfx/` (xem README.md trong đó), ghi nguồn vào `assets/LICENSES.md`; tiếng tổng hợp: `apps/web/src/features/sfx/recipes.ts`; đổi tiếng một nút: thuộc tính `data-sfx` |
| Thêm/bớt bài nhạc nền | Chép file vào `apps/web/src/assets/music/` (xem README.md trong đó), ghi nguồn vào `assets/LICENSES.md`; cách phát: `apps/web/src/features/music/` |
| Thêm model/ảnh/âm thanh | File gốc vào `assets/source/`, bản tối ưu vào `apps/web/public/assets/`, ghi giấy phép vào `assets/LICENSES.md` |
| Đổi địa chỉ server khi deploy | Biến `VITE_SERVER_URL` trên Cloudflare Pages (dev: `apps/web/.env`); cấu hình server: `render.yaml` (Fly: `fly.toml`) |
| Thêm thư viện | `pnpm --filter @brain-rizz/web add <tên>` (hoặc `@brain-rizz/server`, `@brain-rizz/shared`) |
| Ghi lại một quyết định kỹ thuật | Copy `docs/02-architecture/decisions/_template.md` thành ADR mới, thêm vào `docs/02-architecture/decisions/README.md` |
| Thêm tài liệu | Xem bảng "Thêm tài liệu mới vào đâu" trong [docs/README.md](../README.md) |
| Ghi tiến độ, đánh dấu tính năng xong, ghi thay đổi phạm vi | `docs/00-tracking/` — `features.md`, `changelog.md`, `change-requests.md`, `status.md` (xem [Quy trình phát triển](../03-guides/sdlc.md#6-khi-nào-cập-nhật-tài-liệu-nào)) |
| Đổi nhiệm vụ một AI agent, thêm phòng ban, sửa workflow | `.claude/agents/<tên>.md`, `.claude/workflows/<tên>.js` — xem [Đội AI agent](../03-guides/ai-agents.md) |

## Quy tắc khi sửa

1. **Thay đổi luật chơi đi theo thứ tự `shared` → `server` → `web`.** Sửa `shared` trước, chạy `pnpm typecheck`; TypeScript sẽ chỉ ra chỗ ở server và web cần cập nhật theo.
2. **Trong `packages/shared/src/games/` không dùng `Math.random()` hay `Date.now()`**, chỉ dùng `createRng(seed)` — nếu không, hai máy sẽ ra hai đề khác nhau.
3. **`shared` không được import gì từ `apps/`**; web và server chỉ import `shared`, không import lẫn nhau.
4. **Trong web, feature này chỉ import feature khác qua `index.ts`** (vd. `@/features/lobby`); dùng chung thì đưa lên `components/common/`, `hooks/` hoặc `lib/`.
5. **Sửa xong chạy `pnpm check`** (lint + kiểm tra kiểu + test) trước khi commit.

[← Kiến trúc](README.md) · [Mục lục tài liệu](../README.md)
