# Cây thư mục

Bản đồ toàn bộ repo `brain-rizz`: mỗi file làm gì, và **muốn sửa một thứ thì mở file nào**. Không liệt kê `node_modules/`, `dist/`, `.turbo/` (sinh tự động, không sửa tay).

Cập nhật: 2026-10-16. Khi thêm, xoá hay đổi tên thư mục thì sửa lại file này.

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
│  │  └─ fold-box/             Gấp hộp: <id>.ts, cube.ts (gấp lưới lập phương, 24 phép quay) + test
│  │                           Game mới khai báo durationMs 60 giây, difficultyMultiplier và (nếu cần) speedAllowanceMs (CR-006)
│  ├─ protocol.ts              Tên tin nhắn client ↔ server, kiểm tra dữ liệu (zod), hình dạng state
│  │                           (party + phòng Kiểm tra não: BrainJoinOptionsSchema, BrainClientMessage, BrainStateView)
│  ├─ protocol.test.ts         Test schema tài khoản + Kiểm tra não (accessToken, brainReady)
│  ├─ answer-judge.ts          judgeAnswer: luật chấm một câu (index, hết giờ + dung sai, khoá khi sai, chống spam,
│  │                           sinh lại câu, check, điểm, giờ hiện câu, chuỗi) — hàm thuần, nhận `now`; server
│  │                           (AnswerJudge) và Luyện tập trên web dùng chung; answer-judge.test.ts
│  ├─ brain-test.ts            Kiểm tra não: chọn 5 game (pickBrainTestGames), thời lượng, Điểm Não
│  │                           (computeBrainResult), BRAIN_TEST_RULES_VERSION — server và web dùng chung
│  ├─ scoring.ts               Công thức điểm: điểm gốc, thưởng tốc độ, combo (có trần), hệ số và
│  │                           miễn trừ thời gian theo game (CR-006), điểm theo thứ hạng
│  ├─ match.ts                 Luật một trận: xếp hạng có hoà (rankByRound, rankByMatch), game còn chơi
│  │                           được (availableGames), độ khó đa số (majorityDifficulty)
│  ├─ constants.ts             Số người tối đa, thời gian đếm ngược, hướng dẫn, vòng quay, khoá khi sai,
│  │                           màu avatar, danh sách nhân vật (CHARACTER_IDS)…
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
│  │  ├─ rooms/messages.ts     parseMessage (zod → lỗi invalid), sendError, replyPong dùng chung
│  │  ├─ rooms/schema/PartyState.ts   Dữ liệu đồng bộ xuống mọi máy (phòng + người chơi)
│  │  ├─ rooms/schema/BrainState.ts   State phòng Kiểm tra não (khớp BrainStateView)
│  │  ├─ store/ResultStore.ts  Interface ghi kết quả (verifyToken, saveBrainTest, saveMatchResults), bản rỗng
│  │  │                        (thiếu biến môi trường), bản RAM cho test, getResultStore/setResultStore
│  │  ├─ store/SupabaseResultStore.ts  Bản thật: supabase-js + khoá secret, xác thực token bằng getClaims
│  │  ├─ app.config.ts         Đăng ký room, route /healthz, /monitor, /playground
│  │  └─ index.ts              Khởi động server (hầu như không cần sửa)
│  ├─ test/PartyRoom.test.ts   Test phòng chơi với server thật
│  ├─ test/PartyResults.test.ts  Test ghi match_results (một lần mỗi trận, chỉ người có token hợp lệ)
│  ├─ test/BrainTestRoom.test.ts  Test Kiểm tra não: đủ 5 game, chấm, hết giờ, lưu/guest/no-db/failed, rớt mạng
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
│  │  │  │                     (nhớ hồ sơ), components/IntroScreen, MenuScreen (4 thẻ + Bảng xếp hạng, Tài khoản & lịch sử,
│  │  │  │                     ô "Sắp có"), MenuCard, ProfileScreen, SkillChips
│  │  │  ├─ lobby/             LobbyScreen — phòng chờ 2D: mã phòng ẩn/hiện + sao chép, 8 ô người chơi,
│  │  │  │                     đổi nhân vật, sẵn sàng, chủ phòng đặt số vòng + bắt đầu trận;
│  │  │  │                     components/RoomCodePanel, ReadyMeter, PlayerSlot (+ ô trống), CharacterPicker,
│  │  │  │                     MatchSetupCard (+ HostStatusCard)
│  │  │  ├─ music/             Nhạc nền (FR-GD-10): music.store.ts (một thẻ <audio> dùng chung, phát lần lượt, nhỏ tiếng
│  │  │  │                     lúc chơi) + test, audio-output.ts (âm lượng qua GainNode Web Audio — chạy cả trên iPhone; không
│  │  │  │                     có Web Audio thì dùng audio.volume), track-list.ts (import.meta.glob src/assets/music), tracks.ts (tên bài, bài kế)
│  │  │  │                     + test, settings.ts (nhớ bật/tắt, âm lượng, bài) + test, use-music-autoplay.ts (phát ở
│  │  │  │                     thao tác đầu tiên, dừng khi ẩn tab), gesture.ts (thao tác nào thì phát/bỏ qua/thôi chờ)
│  │  │  │                     + test, components/MusicBar (đặt cạnh nút ngôn ngữ/theme)
│  │  │  ├─ sfx/               Âm thanh hiệu ứng (FR-GD-07): player.ts (playSfx: file đã giải mã hoặc tiếng tổng hợp, gain
│  │  │  │                     riêng, trả hàm dừng sớm), kinds.ts (11 loại, chọn tiếng theo data-sfx / aria-pressed / role),
│  │  │  │                     recipes.ts (nốt + nhiễu qua bộ lọc; trống dồn, kèn vinh danh), sources.ts + sfx-files.ts (import.meta.glob src/assets/sfx), settings.ts + sfx.store.ts
│  │  │  │                     (bật/tắt, nhớ trên máy), sfx.test.ts + player.test.ts, use-sfx-effects.ts (listener click uỷ quyền, tải trước file khi mở khoá, lỗi server,
│  │  │  │                     đúng/sai), components/SfxToggle
│  │  │  ├─ motion/            Hiệu ứng chuyển động (FR-GD-12, CR-010): motion.store.ts (nguồn "giảm chuyển động" duy nhất:
│  │  │  │                     useReducedMotion cho React, prefersReducedMotion() cho scene Phaser, gắn data-motion="on"
│  │  │  │                     lên <html> cho biến thể CSS motion-safe/motion-reduce), settings.ts ("system" | "on", nhớ
│  │  │  │                     trên máy) + motion.test.ts, components/MotionToggle (đặt sau SfxToggle)
│  │  │  ├─ game-select/       GameSelectScreen — chọn game mỗi vòng: vòng quay đồng bộ / chủ phòng chọn + bình chọn;
│  │  │  │                     catalog.ts (danh mục 15 game, gom phiếu, lát vòng quay) + test,
│  │  │  │                     components/ModeSwitch, LuckyWheel, WheelView, PickView, GameCard, GameThumb,
│  │  │  │                     hooks/use-wheel-spin
│  │  │  ├─ game-intro/        GameIntroScreen — hướng dẫn + mỗi người chọn độ khó, "Đã hiểu", chủ phòng nhắc/bắt đầu;
│  │  │  │                     components/GuideCard, DifficultyChooser (index.ts export cho Luyện tập, Kiểm tra não), RoomDifficulty
│  │  │  ├─ play/              CountdownScreen (+ CountdownStage dùng chung: đếm ngược 5 s party / 3 s một mình),
│  │  │  │                     PlayScreen (khung chơi: HUD điện thoại / 3 cột máy tính), SoloPlayView (khung chơi một mình:
│  │  │  │                     không đối thủ, ô kỷ lục / thanh 5 game, nút Thoát),
│  │  │  │                     standings.ts (hạng trong vòng, combo) + test, unlock-delay.ts (chờ hết khoá sau câu sai
│  │  │  │                     theo lockedUntil của server, cho MinigameBridge) + test, components/GameFrame (thẻ giấy chứa
│  │  │  │                     Phaser), FrameOverlays (khoá, +điểm, hết giờ, mất kết nối, tải/lỗi), RoundTimer,
│  │  │  │                     ScoreStrip, Scoreboard, MyScore, RoundInfo, ComboChip
│  │  │  ├─ results/           ResultsScreen (bảng điểm vòng → cộng điểm trận), PodiumScreen (vinh danh hồi hộp: hạng 4+ →
│  │  │  │                     3 → 2 → trống → 1), podium-timeline.ts (lịch hiện, hàm thuần) + test, standings.ts (hạng
│  │  │  │                     trước/sau vòng, bục) + test, components/RoundResults, MatchTotals, CategoryBest (thẻ
│  │  │  │                     Giỏi nhất mỗi thể loại), Confetti (export qua index cho Luyện tập)
│  │  │  ├─ practice/          Luyện tập (UC-13, chạy trên máy): PracticeScreen (chọn game → hướng dẫn → đếm ngược → chơi →
│  │  │  │                     kết quả), practice.store.ts (lượt, hẹn giờ, lưu + đồng bộ kỷ lục), judge.ts (gọi judgeAnswer
│  │  │  │                     của shared — cùng luật với server, cộng dồn điểm/đúng/sai; seed crypto) + test, records.ts (kỷ lục `brain-rizz:practice`, gộp với
│  │  │  │                     tài khoản) + test, components/PracticePick, PracticeSetup, PracticeResult
│  │  │  ├─ brain-test/        Kiểm tra não (UC-14, phòng `brain-test`): BrainTestScreen (chọn màn theo pha), components/
│  │  │  │                     BrainIntro, BrainGameIntro (hướng dẫn + Sẵn sàng), BrainProgress (thanh 5 đốt), BrainStep
│  │  │  │                     (màn tạm 3 s), BrainResult (Điểm Não, biểu đồ, so lần trước, hạng tuần, trạng thái lưu)
│  │  │  ├─ account/           Tài khoản & lịch sử (UC-16): AccountScreen (phiên khách/Google, liên kết, đăng xuất, xoá dữ
│  │  │  │                     liệu, hộp "Google đã có dữ liệu"), components/HistoryTabs (3 tab + bảng kỷ lục luyện tập),
│  │  │  │                     ScoreTrend (đường tiến bộ SVG), PartyStrengths (thẻ Thế mạnh trong trận party, CR-010);
│  │  │  │                     strengths.ts (danh hiệu, TB điểm theo thể loại) + test
│  │  │  └─ leaderboard/       Bảng xếp hạng (UC-19): LeaderboardScreen (tab Điểm Não / Theo minigame, kỳ, chọn game),
│  │  │                        components/BoardView (top 3, danh sách 50, dòng của mình), week.ts (đầu tuần giờ VN,
│  │  │                        màu avatar theo user_id) + test
│  │  ├─ games/                ★ MỖI MINIGAME MỘT THƯ MỤC (phần hiển thị; logic ở packages/shared)
│  │  │  ├─ odd-one-out/
│  │  │  │  ├─ OddOneOutScene.ts  Vẽ và xử lý chạm (Phaser)
│  │  │  │  ├─ OddOneOutHowTo.tsx Hình minh hoạ SVG cho màn Hướng dẫn và thẻ game
│  │  │  │  ├─ locales.ts      Chữ màn hướng dẫn (vi, en): tên, mô tả, 3 bước, điều khiển, câu nhắc, 4 mức
│  │  │  │  └─ index.ts        GameClient: scene (tải lười) + locales + Illustration
│  │  │  ├─ light-trail/, balance/, number-balloons/, rotate-match/, who-vanished/, pair-flip/,
│  │  │  │  cube-count/, marble-drop/, hit-target/, cash-count/, top-view/, fold-box/
│  │  │  │                     Cùng khuôn: <Name>Scene.ts, <Name>HowTo.tsx, locales.ts, index.ts;
│  │  │  │                     balance/ có thêm items.ts (hình 8 vật), light-trail/ có thêm shapes.ts (bóng đèn,
│  │  │  │                     mắt, bàn tay, tua ngược) — đều dùng chung cho scene và hình minh hoạ;
│  │  │  │                     cube-count/ có art.ts, who-vanished/ có items.ts + shapes.ts
│  │  │  ├─ registry.ts        Nối mã game → GameClient — `pnpm new-game` tự đăng ký vào đây
│  │  │  ├─ locales.test.ts    Test chữ các game: câu nhắc theo mức đủ ở mọi ngôn ngữ, danh mục i18n khớp tên + summary
│  │  │  ├─ PhaserHost.tsx     Tạo/huỷ game Phaser, báo trạng thái tải, preloadGame (tải trước lúc đếm ngược)
│  │  │  └─ types.ts           MinigameBridge (React ↔ Phaser), GameLocale (+ levelHints: câu nhắc theo mức), GameClient,
│  │  │                        khung 720×1280
│  │  ├─ components/
│  │  │  ├─ ui/                Component shadcn đã chỉnh kiểu nhãn dán (button, input, card, toggle-group, tabs, alert-dialog, skeleton, slider…)
│  │  │  ├─ characters/        ★ NHÂN VẬT: Character (6 con vật × 7 biểu cảm, SVG + hoạt ảnh), specs.tsx
│  │  │  ├─ brand/             Logo chữ nhún, linh vật BrainMascot, hình vẽ phấn ChalkDoodle + ChalkDefs
│  │  │  └─ common/            Dùng ở nhiều feature: PlayerAvatar (nhân vật trong khung tròn), DifficultyPicker, ConnectionBanner,
│  │  │                        ThemeToggle, LanguageToggle, RankBadge (huy hiệu hạng), MatchChips (nhãn vòng, nhóm kỹ năng,
│  │  │                        độ khó; màu + biểu tượng nhóm), HostWaitCard ("Chờ chủ phòng…"), AvatarStrip (hàng nhân vật cả phòng),
│  │  │                        ScreenHeader (nút quay lại + tiêu đề phấn), EmptyState + DataProblemState (trống / lỗi + Thử lại /
│  │  │                        chưa kết nối máy chủ dữ liệu), QuitDialog ("Bỏ lượt này?"), BrainRadar (biểu đồ 5 cạnh SVG)
│  │  ├─ i18n/
│  │  │  ├─ index.ts           Khởi tạo i18next (chỉ namespace `common` trong gói đầu), chọn ngôn ngữ lần đầu
│  │  │  ├─ solo.ts            loadSoloLocales: tải lười chữ 4 màn một mình (locales/solo/) gộp vào `common`
│  │  │  ├─ games.ts           registerGameLocales: gom `src/games/<id>/locales.ts` vào namespace `games` (gọi từ chunk lười)
│  │  │  ├─ languages.ts       Danh sách ngôn ngữ (vi, en)
│  │  │  ├─ locales/vi.ts, en.ts  Bản dịch giao diện (vi là nguồn chuẩn, en bị ép đủ khoá)
│  │  │  ├─ locales/solo/vi.ts, en.ts  Chữ Luyện tập, Kiểm tra não, Tài khoản, Bảng xếp hạng (tải lười, en bị ép đủ khoá)
│  │  │  └─ i18next.d.ts       Kiểu cho khoá dịch
│  │  ├─ hooks/                use-game-text (chữ của game theo ngôn ngữ, câu nhắc theo mức), use-media-query (bố cục điện thoại/máy tính, chạm/chuột),
│  │  │                        use-number-format (1.180 / 1,2 theo ngôn ngữ), use-server-clock, use-server-time-reached
│  │  │                        (giờ server cho đồng hồ, đếm ngược, hết giờ), use-pending-action (khoá nút gửi lệnh
│  │  │                        tới khi state đổi hoặc server báo lỗi, chống bấm đúp), use-data (tải dữ liệu Supabase:
│  │  │                        đang tải / xong / chưa kết nối / chưa có phiên / lỗi + reload), use-date-format (16/10),
│  │  │                        use-count-up (số đếm lên, tắt khi giảm chuyển động)
│  │  ├─ lib/                  utils.ts (cn), storage.ts (localStorage an toàn + tên khoá), avatar.ts,
│  │  │                        supabase.ts (client tải lười, thiếu biến → null; đọc lỗi quay về từ Google) + test,
│  │  │                        audio-context.ts (một AudioContext dùng chung cho nhạc nền + âm thanh hiệu ứng, mở khoá/resume)
│  │  ├─ net/connection.ts     Mọi thứ liên quan mạng: tạo/vào/rời phòng party (kèm accessToken), phòng Kiểm tra não
│  │  │                        (startBrainTest/leaveBrainTest/sendBrain), gửi tin, nối lại, đồng bộ giờ
│  │  ├─ net/brain-leave.ts    Phòng Kiểm tra não đóng vì để quá lâu ở intro (close code riêng) → về màn giới thiệu + test
│  │  ├─ net/data-api.ts       Đọc/ghi Supabase: bảng xếp hạng, hạng của mình, lịch sử 3 loại, gửi kỷ lục luyện tập
│  │  │                        (trả DataResult: not-configured / no-session / error, không ném lỗi) + test (thiếu biến môi trường)
│  │  ├─ stores/
│  │  │  ├─ auth.store.ts      Phiên Supabase (khách lười / Google): ensureSession, linkGoogle, signInGoogle, signOut,
│  │  │  │                     deleteMyData, syncProfile (tên + nhân vật lên `profiles`)
│  │  │  ├─ nav.store.ts       Màn ngoài phòng (giới thiệu, menu, hồ sơ, 4 màn một mình) + cờ tập trung khi đang chơi
│  │  │  ├─ game.store.ts      State phòng chơi (Zustand): phòng party hoặc Kiểm tra não (`brain`), độ lệch giờ, kết quả
│  │  │  │                     câu gần nhất (Luyện tập cũng dùng)…
│  │  │  │                     (bỏ dữ liệu vòng cũ khi seed trong state đổi)
│  │  │  ├─ game.store.test.ts Test store: tải lại trang, mất tin roundStart khi nối lại
│  │  │  └─ theme.store.ts     Giao diện sáng/tối/theo hệ thống
│  │  ├─ styles/
│  │  │  ├─ globals.css        Token màu bảng phấn sáng/tối, màu thương hiệu, font, utility chalkboard/sticker-text
│  │  │  ├─ characters.css     Hoạt ảnh nhân vật, hình vẽ phấn, pháo giấy vinh danh (char-*, fx-*)
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
│  └─ 20261019000000_match_category_scores.sql  match_results thêm category_scores (jsonb),
│                              category_titles (text[]) — CR-010
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
│  │  └─ roadmap.md            Mốc thời gian, cổng kiểm tra, checklist giai đoạn
│  ├─ 02-architecture/         KIẾN TRÚC
│  │  ├─ README.md             Mục lục thư mục
│  │  ├─ overview.md           Kiến trúc, luồng phòng chơi, giao thức tin nhắn
│  │  ├─ tech-stack.md         Công nghệ, phiên bản, dịch vụ, làm quen cho dev mới
│  │  ├─ folder-structure.md   (file này)
│  │  ├─ server-fallback.md    Kế hoạch dự phòng game server, rủi ro khi bỏ Colyseus
│  │  └─ decisions/            Quyết định kỹ thuật: README.md, ADR 0001–0010, _template.md
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
   ├─ fly.toml                 Deploy server lên Fly.io
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
| Đổi công thức tính điểm | `packages/shared/src/scoring.ts` |
| Đổi số người tối đa, thời gian đếm ngược, thời gian khoá khi sai, màu avatar | `packages/shared/src/constants.ts` |
| Đổi luật phòng (ai được bắt đầu, khi nào hết vòng, chuyển chủ phòng) | `apps/server/src/rooms/PartyRoom.ts` |
| Thêm thông tin cần hiện cho mọi người (vd. số câu đúng) | `apps/server/src/rooms/schema/PartyState.ts` **và** `PlayerView`/`PartyStateView` trong `packages/shared/src/protocol.ts` |
| Thêm một hành động mới (vd. chat, đổi avatar) | `protocol.ts` → xử lý trong `PartyRoom.ts` (mục `messages`) → hàm gửi trong `apps/web/src/net/connection.ts` → nút bấm trong `apps/web/src/features/<màn hình>/` |
| Sửa giao diện trang chủ, phòng chờ, chọn game, hướng dẫn, lúc chơi, kết quả, vinh danh | `apps/web/src/features/{home,lobby,game-select,game-intro,play,results}/` |
| Sửa Luyện tập, Kiểm tra não, Tài khoản & lịch sử, Bảng xếp hạng | `apps/web/src/features/{practice,brain-test,account,leaderboard}/`; gọi Supabase ở `apps/web/src/net/data-api.ts`, phiên ở `apps/web/src/stores/auth.store.ts` |
| Thêm màn hình mới | Tạo `apps/web/src/features/<tên>/` (kèm `index.ts`), rẽ nhánh trong `apps/web/src/app/App.tsx` (màn ngoài phòng: thêm vào `Screen` trong `stores/nav.store.ts`) |
| Thêm/sửa chữ hiển thị, thêm ngôn ngữ | `apps/web/src/i18n/locales/vi.ts` trước, rồi `en.ts` (TypeScript báo khoá thiếu); chữ 4 màn một mình: `i18n/locales/solo/{vi,en}.ts`; ngôn ngữ mới: `i18n/languages.ts` (+ `solo.ts`) |
| Thêm component UI (dialog, select, tabs…) | `pnpm dlx shadcn@latest add <tên>` trong `apps/web` → `src/components/ui/` (xem [ADR 0006](decisions/0006-ui-shadcn-and-theme-tokens.md)) |
| Đổi màu (sáng/tối), font | `apps/web/src/styles/globals.css` (font: `apps/web/index.html`) |
| Đổi kiểu nút, ô nhập, thẻ… | `apps/web/src/components/ui/<tên>.tsx` |
| Thêm/sửa nhân vật, biểu cảm | Hình dạng: `apps/web/src/components/characters/specs.tsx`; biểu cảm chung: `Character.tsx`; id mới: `CHARACTER_IDS` trong `packages/shared/src/constants.ts` + tên trong i18n (`characters.<id>`). Xem [ADR 0009](decisions/0009-chalkboard-style-and-characters.md) |
| Màn giới thiệu, menu chính, chọn nhân vật | `apps/web/src/features/home/components/{IntroScreen,MenuScreen,ProfileScreen}.tsx` |
| Bục vinh danh, pháo giấy, nhịp lật | `apps/web/src/features/results/PodiumScreen.tsx`, `podium-timeline.ts` (mốc ms), `components/Confetti.tsx`, `components/CategoryBest.tsx` (2D, không 3D — ADR 0010); keyframes `fx-*` trong `styles/characters.css` |
| Bật/tắt hiệu ứng chuyển động, đọc "giảm chuyển động" | `apps/web/src/features/motion/` (không tự đọc `matchMedia`); biến thể `motion-safe`/`motion-reduce` trong `styles/globals.css` |
| Hình minh hoạ cách chơi, nội dung màn Hướng dẫn của một game | `apps/web/src/games/<id>/locales.ts` + `…HowTo.tsx` (gán `Illustration` trong `index.ts`) |
| Danh mục 15 game ở màn Chọn game (thẻ "Sắp có") | `apps/web/src/features/game-select/catalog.ts` + tên ở i18n `catalog.<id>` |
| Đổi luật Kiểm tra não (chọn game, thời lượng, Điểm Não) | `packages/shared/src/brain-test.ts` (đổi điểm chuẩn thì tăng `BRAIN_TEST_RULES_VERSION`); luồng phòng: `apps/server/src/rooms/BrainTestRoom.ts` |
| Đổi cách chấm một câu (khoá khi sai, chống spam, dung sai) | `packages/shared/src/answer-judge.ts` (party, Kiểm tra não và Luyện tập cùng dùng) |
| Bảng, quyền đọc/ghi, bảng xếp hạng trên Supabase | Thêm migration mới trong `supabase/migrations/` (không sửa file đã chạy); server ghi qua `apps/server/src/store/` |
| Lỗi kết nối, nối lại phòng, đồng hồ lệch | `apps/web/src/net/connection.ts` (client); `onDrop`/`onReconnect`/`onLeave` trong `PartyRoom.ts` (server) |
| Thay tiếng bấm nút, đếm ngược, đúng/sai | Chép `<loại>.mp3` vào `apps/web/src/assets/sfx/` (xem README.md trong đó), ghi nguồn vào `assets/LICENSES.md`; tiếng tổng hợp: `apps/web/src/features/sfx/recipes.ts`; đổi tiếng một nút: thuộc tính `data-sfx` |
| Thêm/bớt bài nhạc nền | Chép file vào `apps/web/src/assets/music/` (xem README.md trong đó), ghi nguồn vào `assets/LICENSES.md`; cách phát: `apps/web/src/features/music/` |
| Thêm model/ảnh/âm thanh | File gốc vào `assets/source/`, bản tối ưu vào `apps/web/public/assets/`, ghi giấy phép vào `assets/LICENSES.md` |
| Đổi địa chỉ server khi deploy | `apps/web/.env` (`VITE_SERVER_URL`), `fly.toml` |
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
