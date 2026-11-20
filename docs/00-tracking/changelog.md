# Nhật ký phát hành (Changelog)

Mọi thay đổi đáng kể của Brain Rizz, theo định dạng [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và đánh số theo [Semantic Versioning](https://semver.org/lang/vi/) (quy tắc riêng của dự án: [Quy trình phát triển › Phiên bản](../03-guides/sdlc.md#5-phiên-bản--phát-hành)).

Mỗi mục ghi theo góc nhìn **người chơi** trước, kỹ thuật sau; kèm mã UC/FR/CR nếu có. Nhóm: **Thêm** · **Thay đổi** · **Sửa lỗi** · **Gỡ bỏ** · **Bảo mật**.

## [Chưa phát hành]

_Thêm vào đây ngay khi một thay đổi được merge; khi phát hành thì đổi tiêu đề mục này thành số phiên bản._

Luồng trận mới theo [CR-005](change-requests.md#cr-005), 4 minigame MVP và cân bằng điểm theo [CR-006](change-requests.md#cr-006), làm xong 2026-10-12 (sớm hơn kế hoạch GĐ 1). Nếu kịp Cổng 0 thì gộp vào bản 0.1.0 và sửa các dòng tương ứng ở mục 0.1.0 bên dưới; nếu không thì phát hành thành bản trung gian của GĐ 1.

### Thêm

- **Phấn, máy quay phụ kiện, tủ đồ** ([CR-023](change-requests.md#cr-023), UC-25, [kế hoạch](../01-product/gacha-pets-unlocks.md), [ADR 0016](../02-architecture/decisions/0016-chalk-economy-in-postgres.md)): chơi trận party, Kiểm tra não, luyện tập và nhận quà mỗi ngày để kiếm **phấn** (không có mua bằng tiền thật; mỗi nguồn có trần mỗi ngày). Ở **Máy quay** (`/gacha`) tiêu phấn quay 1 hoặc 10 lần ra phụ kiện: 24 món mũ/kính/khăn, 4 độ hiếm, tỉ lệ và bảo hiểm hiện công khai (10 lần chắc ≥ 1 Hiếm, ≤ 15 lần ra Sử thi, ≤ 60 lần ra Huyền thoại; Huyền thoại không ra trùng tới khi đủ bộ), trùng món đổi lại phấn. **Tủ đồ** (`/wardrobe`) mặc tối đa 1 món mỗi chỗ đầu/mặt/cổ, cả phòng thấy. Kết quả trận và Kiểm tra não hiện "+N phấn". Kỹ thuật: số dư, quay (RNG) và sở hữu tính trong Postgres (migration `20261120000000_gacha.sql`, **chạy trước khi deploy server + web**), server cộng phấn idempotent sau khi ghi kết quả và lọc phụ kiện không sở hữu; shared `cosmetics/` (danh mục, kinh tế, mô phỏng, test đối chiếu hằng số với SQL).
- **6 bạn đồng hành mới mở khoá bằng thành tích** ([CR-024](change-requests.md#cr-024), UC-26): Pin (cánh cụt, chơi 10 trận), Ộp (ếch, kỷ lục Bóng bay số), Thông (cú, trung bình nhóm Phân tích), Gai (nhím, về nhất 5 trận), Mây (koala, Điểm Não), Lửa (rồng con, chơi nhiều + giỏi đều 5 nhóm). Thú khoá hiện xám kèm điều kiện, thanh tiến độ và nút **Luyện ngay**; mở mới có hộp chúc mừng. Server kiểm lại khi vào phòng (chưa mở thì dùng nhân vật mặc định, không bị từ chối). Bot chỉ dùng 6 nhân vật cũ.
- **Game yêu thích** ([CR-020](change-requests.md#cr-020)): ở Luyện tập bấm ⭐ để ghim game hay chơi; mục **Yêu thích** đứng đầu danh sách, có chip lọc riêng, ⭐ cũng có ở màn hướng dẫn. Lưu trên máy ngay, đồng bộ lên tài khoản khi có phiên (khách hay Google). Biểu tượng kỷ lục ở Luyện tập đổi sang cúp. Kỹ thuật: `features/practice/favorites.ts`, bảng `practice_favorites` + RPC `practice_favorites_get/_set/_merge` (migration `20261119100000_practice_favorites.sql`, chạy trước khi deploy web; thiếu RPC thì web chỉ lưu trên máy).
- **Hướng dẫn động** ([CR-021](change-requests.md#cr-021)): màn Hướng dẫn (party, Luyện tập, Kiểm tra não) có khung minh hoạ lớn 16:9, nút **Phóng to** và hình động diễn cách chơi (tay chạm đáp án, ✓, sang câu, có cả lần chạm sai bị khoá) cho 5 game MVP; chạy 3 vòng rồi "Xem lại", chạm để dừng; giảm chuyển động thì hiện hình tĩnh. Kỹ thuật: khung diễn `games/_shared/demo/` (chỉ `transform`/`opacity`, dừng khi ẩn tab hoặc ra khỏi màn), `GameClient.Demo` tải lười (0,9–1,7 KB mỗi game), không thêm canvas.
- **Đường dẫn riêng cho từng màn** ([CR-022](change-requests.md#cr-022)): `/practice`, `/practice/<game>`, `/brain-test`, `/leaderboard`, `/leaderboard/<game>`, `/account`, `/profile`, `/admin/<mục>`. Nút Back/Forward của trình duyệt và F5 giữ đúng màn, gửi được link tới một game; Back trong phòng hỏi "Rời phòng?". Kỹ thuật: `nav.store` đồng bộ History API, không thêm thư viện router.
- **Trang quản trị** ([CR-019](change-requests.md#cr-019), UC-24, [kế hoạch](../01-product/admin-console.md), [ADR 0015](../02-architecture/decisions/0015-admin-console.md)): quản trị viên (tài khoản Google có trong bảng `admins`) mở `/admin` hoặc nút **Trang quản trị** ở màn Tài khoản. 8 mục: **Tổng quan** (người dùng khách/Google, đăng nhập, người hoạt động, trận, Kiểm tra não hôm nay và 14 ngày), **Game** (bật/tắt từng game khỏi trận party, ghi đè hệ số 4 mức theo game, số lần chơi), **Điểm & hệ số** (điểm gốc, thưởng tốc độ, combo, hệ số độ khó, thưởng top 3; xem thử điểm một câu và bảng điểm thứ hạng 2 → 12 người; khôi phục mặc định; lưu kèm ghi chú; lịch sử thay đổi), **Đăng nhập**, **Người chơi**, **Trận đấu**, **Phòng đang mở**, **Quản trị viên** (thêm theo email Google, xoá; không xoá chính mình hay người cuối cùng). Cấu hình chỉ áp dụng cho trận party, nạp khi bắt đầu trận kế tiếp; Luyện tập và Kiểm tra não giữ công thức chuẩn. App ghi sự kiện đăng nhập (tạo khách, đăng nhập/liên kết Google, mở lại app tối đa 1 lần/30 phút, đăng xuất) kèm "trình duyệt · hệ điều hành", **không ghi IP**; "Xoá dữ liệu của tôi" xoá cả phần này. Kỹ thuật: `packages/shared/src/party-config.ts` (`ScoringConfig`, giới hạn zod, `parsePartyConfig` kiểm từng trường), `PartyStateView` thêm `disabledGames`, `scoringJson`, `configVersion`; server đọc `party_settings` (đệm 30 giây, chụp mỗi trận), route `GET /admin/rooms`, `POST /admin/config/reload`; migration `20261119000000_admin_console.sql` (bảng `admins`, `party_settings` (+ lịch sử), `login_events`, cột `match_results.settings_version`, RPC `is_admin`, `log_login`, `admin_*`) — **chạy trên Supabase trước khi deploy server**, rồi thêm admin đầu tiên bằng SQL ([hướng dẫn](../03-guides/supabase-setup.md)); web `features/admin` (tải lười, chunk riêng), `net/admin-api.ts`.
- **Chơi với máy** ([CR-016](change-requests.md#cr-016), UC-23, [kế hoạch](../01-product/bot-players.md)): chưa có bạn vẫn vào trận ngay. Nút **Chơi với máy** ở menu mở hộp thoại chọn số bot (1–7, mặc định 3) và một mức chung (Dễ, Vừa, Khó, Siêu; mặc định Vừa), bấm "Vào phòng" là vào thẳng phòng chờ của một phòng party bình thường, vẫn có mã để bạn bè vào cùng. Ở phòng chờ, chủ phòng bấm ô trống "+ Thêm bot" rồi chọn mức ngay trong ô, bấm nhãn mức để đổi mức, bấm × (điện thoại: bấm cả ô) để bỏ bot; người khác chỉ xem. Bot tên theo nhân vật ("Fen · máy", trùng nhân vật thì "Fen 2 · máy") và có huy hiệu máy ở mọi nơi có tên: hướng dẫn, dải điểm, bảng điểm vòng, tổng điểm, vinh danh, chat. Bot luôn sẵn sàng, tự bấm "Đã hiểu", chơi đủ luồng trận, được chấm như người, thỉnh thoảng gửi biểu cảm ở bảng điểm và vinh danh; không làm chủ phòng, không bỏ phiếu, không tính vào độ khó đa số và không bị nhắc. Phòng đủ 8 ghế mà có bạn vào bằng mã thì bot thêm sau cùng nhường ghế, và những người đã ở trong phòng thấy toast 3 giây "Lan vào phòng · Bắp · máy nhường ghế" (người vừa vào không thấy; nhiều bot nhường liền nhau thì mỗi lần một toast). Lịch sử tài khoản gắn nhãn **Đấu với máy** cho trận có bot. Kỹ thuật: bot chạy trên server và không giải câu đố, model bot bốc thời gian trả lời và đúng/sai rồi chấm bằng `judgeBotAnswer` (cùng đường với `judgeAnswer`) ([ADR 0014](../02-architecture/decisions/0014-server-side-bots.md)); `packages/shared/src/bots/` (4 mức, model `basic`, registry `BOT_MODELS`, `expectedSolveMs` và `expectedAccuracy` cho 30 game, tỉ lệ đúng của bot tính tương đối theo từng game bằng `relativeAccuracy` (tỉ lệ chuẩn của game kẹp tối đa 98 %), mô phỏng cân bằng 1 000 vòng mỗi game và mỗi mức); lệnh `addBot` / `removeBot` / `setBotLevel` và tùy chọn tạo phòng `bots` có schema zod; `PlayerView.isBot` / `botLevel`, `ChatMessagePayload.bot`, tin S → C `botYielded` (web `net/bot-yielded.ts`); `apps/server/src/rooms/BotDriver.ts`; cột `match_results.bot_count` (migration mới, **chạy trên Supabase trước khi deploy server**); web: `components/characters/BotBadge` + tên bot dùng chung, `components/common/BotLevel`, hộp thoại `features/home/components/BotDialog`, ô bot `features/lobby/components/BotSlot`, component `Dialog`, token màu `bot`.
- **Chat trong phòng** ([CR-011](change-requests.md#cr-011), UC-22): nhắn cả phòng ở phòng chờ, chọn game, hướng dẫn, bảng điểm và vinh danh (ẩn lúc đếm ngược và đang chơi, tin mới hiện thành số chưa đọc). Chữ tối đa 120 ký tự hoặc bấm một chạm 😂 🔥 👏 😱 GG "Nhanh lên!" (câu chọn sẵn dịch theo ngôn ngữ người xem); biểu cảm nổi thành bong bóng trên avatar ở phòng chờ, bảng điểm, vinh danh. Từ tục vi/en bị che `***`; chủ phòng bật/tắt chat cả phòng (ở khung chat và Thiết lập trận); mỗi người tự tắt tiếng người khác trên máy mình. Điện thoại: nút chat nổi + khung kéo lên; máy tính: cột phải thu gọn được. Kỹ thuật: `packages/shared/src/chat/` (lọc, làm sạch, giới hạn tần suất), `ChatRelay` giữ 30 tin trong RAM, cờ `chatEnabled` trong state; web `features/chat`, `stores/chat.store.ts`; không lưu DB, không đụng canvas Phaser.
- **Minigame mới Bóng của ai** (nhóm Nhận diện, `shadow-match`): nhìn một đồ vật có màu, chạm vào bóng đen đúng hình dạng; bóng có thể bị xoay hoặc lật. 4 mức độ khó (3 → 6 bóng, mồi khác vật → mồi gần giống, thêm xoay và lật), vòng 60 giây, có màn hướng dẫn và chữ vi/en; chơi được trong phòng party, Luyện tập và Kiểm tra não (điểm chuẩn 2 050; phiên bản luật Kiểm tra não lên 2 nên bảng xếp hạng Điểm Não và từng minigame làm mới). Bộ sinh câu đố tất định, test 10.000 seed ([đặc tả](../04-minigames/shadow-match.md)).
- **Minigame mới Luyện ngắm** (nhóm Nhận diện, `aim-trainer`, [CR-012](change-requests.md#cr-012)): bia tròn hiện ở chỗ bất kỳ, chạm trúng càng nhanh càng tốt. 4 mức độ khó (bia nhỏ dần; từ Thường bia biến mất nếu chậm 1,3–1,5 s, Khó bia co dần, Siêu khó thêm 1–2 bia mồi đỏ), vòng 60 giây, có màn hướng dẫn và chữ vi/en; chơi được trong phòng party, Luyện tập và Kiểm tra não (điểm chuẩn 8 350). Cơ chế chung mới **hạn trả lời** `answerWindowMs` trong `judgeAnswer`: server từ chối đáp án tới sau khi bia đã biến mất. Bộ sinh câu đố tất định, test 10.000 seed ([đặc tả](../04-minigames/aim-trainer.md)).
- **Minigame mới Phấn trượt** (nhóm Phân tích, `chalk-arrows`, [CR-012](change-requests.md#cr-012)): nhóm mũi tên phấn trượt trên bảng; phấn trắng vuốt theo hướng mũi tên chỉ, phấn vàng vuốt theo hướng trượt (vuốt hoặc phím mũi tên). 4 mức độ khó (5 → 10 mũi tên, màu đổi giữa hai câu 0 → 60 %, hai hướng ngày càng hay ngược nhau, Siêu khó thêm nét tẩy mờ và màu gần nhau), vòng 60 giây, có màn hướng dẫn và chữ vi/en; chơi được trong phòng party, Luyện tập và Kiểm tra não (điểm chuẩn 4 900). Bộ sinh câu đố tất định, test 10.000 seed ([đặc tả](../04-minigames/chalk-arrows.md)).
- **14 minigame mới từ kế hoạch mở rộng** ([CR-013](change-requests.md#cr-013), [CR-014](change-requests.md#cr-014), [kế hoạch](../01-product/minigame-expansion.md)): danh mục lên 31 game. Mỗi game có 4 mức độ khó, vòng 60 giây, màn hướng dẫn và hình minh hoạ, chữ vi/en; chơi được trong phòng party, Luyện tập và Kiểm tra não. Bộ sinh câu đố tất định, test 10.000 seed gồm cả kiểm "không có mẹo đoán" (chiến lược không giải câu đố chỉ trúng ở mức may rủi). Chờ QA và chơi thử để chốt hệ số điểm.
  - Nhận diện: **Tráo cốc** (`cup-shuffle`, phấn úp dưới cốc, theo dõi khi cốc tráo; Khó xoay vòng 3 cốc, Siêu khó giấu 2 vật), **Tìm bạn** (`crowd-search`, tìm đúng bạn trong đám đông 9 → 30 bạn; Siêu khó có điều kiện "không"), **Hình to hình nhỏ** (`navon-shapes`, hình to ghép từ hình nhỏ; từ Khó khung tròn hỏi hình to, khung vuông hỏi hình nhỏ).
  - Ghi nhớ: **Xếp lại tháp** (`stack-recall`, nhớ tháp khối rồi xếp lại từ dưới lên), **Nhại nhịp** (`rhythm-echo`, nghe trống rồi gõ lại bằng nửa trái / phải màn hình; mặt trống sáng theo tiếng nên chơi được khi tắt tiếng; 2 tiếng trống Web Audio mới `drum-low`, `drum-high`).
  - Phân tích: **Chuỗi quy luật** (`bead-pattern`, chọn hạt còn thiếu trong chuỗi), **Ô bí ẩn** (`latin-cell`, lưới hình kiểu Sudoku 3×3 → 6×6, Khó / Siêu khó phải suy qua 1–2 ô), **Cổng luật** (`rule-gate`, vuốt cho vào hay mời về theo luật vẽ trên vé; luật đổi giữa vòng, Siêu khó luật ẩn).
  - Tính toán: **Đếm sĩ số** (`head-count`, bạn ra vào lớp, chọn sĩ số còn lại; Siêu khó thầy giáo đi lẫn), **Giỏ hời nhất** (`best-basket`, giỏ nhiều sao nhất mà không lố tiền), **Đường số** (`number-path`, chọn đường tính ra đúng số đích; có ÷, số âm, x², đổi dấu).
  - Hình dung: **Mảnh vừa khít** (`piece-fit`, mảnh lấp vừa khoảng trống, chỉ xoay không lật), **Nối mạch** (`circuit-link`, chọn mảnh dây cho bóng đèn sáng), **Rót vừa vạch** (`pour-line`, giữ để rót, buông đúng vạch; bình loe / thót, Siêu khó nửa trên bị che).
  - Kỹ thuật: Rót vừa vạch và Nhại nhịp là hai game đầu tiên có **đáp án đo thời gian phía client** (thời lượng giữ tay, khoảng cách giữa các lần gõ), đo bằng `event.timeStamp`; giao thức và server không đổi ([ADR 0013](../02-architecture/decisions/0013-client-timed-answers.md)).
- **Kiểm tra não: phiên bản luật lên 4** (`BRAIN_TEST_RULES_VERSION` 3 → 4, CR-013 + CR-014): mỗi nhóm kỹ năng có thêm 2–3 game (điểm chuẩn mới từ 900 tới 4 750, xem [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não)), nên bảng xếp hạng Điểm Não và từng minigame làm mới; lịch sử cá nhân vẫn giữ.
- **Kiểm tra não: phiên bản luật lên 3** (`BRAIN_TEST_RULES_VERSION` 2 → 3, CR-012): nhóm Nhận diện có thêm Luyện ngắm (3 game, mỗi game 1/3), nhóm Phân tích có thêm Phấn trượt (4 game, mỗi game 1/4), nên bảng xếp hạng Điểm Não và từng minigame làm mới; lịch sử cá nhân vẫn giữ.
- **Vinh danh hồi hộp, nút Hiệu ứng, danh hiệu theo thể loại** ([CR-010](change-requests.md#cr-010)):
  - Màn vinh danh lật lần lượt hạng 4 trở đi (từ dưới lên), hạng 3, hạng 2, rồi chờ 2 giây có tiếng trống dồn và chữ "Và hạng nhất là…" trước khi hạng 1 bung lên với vương miện, pháo giấy và tiếng kèn. Nhãn "Bạn về …" chỉ hiện sau khi chỗ của mình lật. Vào lại phòng giữa lúc vinh danh thì hiện hết ngay (FR-GD-06).
  - Thẻ **Giỏi nhất mỗi thể loại** hiện sau hạng 1: mỗi thể loại đã chơi có người điểm cao nhất (hoà thì cùng nhận) (FR-VC-21).
  - Nút **Hiệu ứng** trên hàng nút: "Theo hệ thống" hoặc "Luôn bật" hiệu ứng chuyển động, kể cả khi máy đang tắt hoạt ảnh; có chấm cam khi máy đang giảm chuyển động (FR-GD-12).
  - Tài khoản › Trận party có thẻ **Thế mạnh trong trận party**: số danh hiệu và điểm trung bình theo từng thể loại (FR-MR-16).
  - Kỹ thuật: `features/motion` là nguồn "giảm chuyển động" duy nhất (`useReducedMotion`, `prefersReducedMotion` cho 12 scene Phaser); biến thể Tailwind `motion-safe`/`motion-reduce` viết lại theo `data-motion="on"` trên <html>; lịch hiện vinh danh là hàm thuần `podiumTimeline` có test; 3 tiếng Web Audio mới `reveal`, `drumroll`, `fanfare` (không thêm file âm thanh), `playSfx` trả hàm dừng sớm và nhận `volume`. Server cộng điểm vòng theo thể loại, ghi `match_results.category_scores` / `category_titles` (migration mới).
- **Chơi một mình và tài khoản** ([CR-009](change-requests.md#cr-009), [ADR 0011](../02-architecture/decisions/0011-supabase-accounts-and-solo-modes.md)):
  - **Luyện tập** (UC-13): chọn bất kỳ minigame và độ khó, chơi không giới hạn lượt, lưu kỷ lục, có nhãn "Kỷ lục mới!".
  - **Kiểm tra não** (UC-14): 5 game, mỗi nhóm kỹ năng một game, khoảng 5 phút, server chấm; ra Điểm Não (0–1000) và biểu đồ 5 kỹ năng.
  - **Tài khoản & lịch sử** (UC-16): tự lưu bằng phiên khách, liên kết Google để giữ lịch sử khi đổi máy; xem lịch sử Kiểm tra não, trận party, kỷ lục luyện tập; xoá dữ liệu của mình.
  - **Bảng xếp hạng** (UC-19): Điểm Não và từng minigame, Tuần này / Mọi thời đại, hiện hạng của mình.
  - Kỹ thuật:
    - Phòng solo `BrainTestRoom`; luật chấm một câu dùng chung `judgeAnswer` trong shared.
    - Migration Supabase có RLS và RPC.
    - Party nhận `accessToken` tuỳ chọn và ghi kết quả trận.
    - Thiếu Supabase thì mọi chế độ vẫn chơi được.
    - Chữ màn một mình và minigame tải lười ([ADR 0012](../02-architecture/decisions/0012-i18n-lazy-chunks.md)); JS ban đầu 248 KB gzip.
- 4 minigame mới, đủ 5 game MVP (mỗi nhóm kỹ năng một game), mỗi game 4 mức độ khó, màn hướng dẫn có hình minh hoạ (FR-MG-05):
  - **Theo dấu ánh đèn** (Ghi nhớ): nhớ thứ tự đèn sáng rồi chạm lại; Siêu khó chạm ngược.
  - **Cân não** (Phân tích): nhìn các cân, tìm vật nặng nhất.
  - **Bóng bay số** (Tính toán): nổ bóng từ số nhỏ đến lớn; mức cao có số âm và phép tính.
  - **Xoay hình** (Hình dung): tìm hình giống mẫu sau khi xoay, cẩn thận bản lật gương.
- 8 minigame tiếp theo (2026-10-14, chờ chơi thử để chốt hệ số điểm), mỗi game 4 mức độ khó, màn hướng dẫn có hình minh hoạ (FR-MG-05, mục tiêu GĐ 2):
  - **Ai vừa biến mất** (Ghi nhớ): xem khay đồ vật 3 giây, rèm che, chọn món vừa biến mất; Siêu khó các món còn lại đổi chỗ.
  - **Lật cặp** (Ghi nhớ): xem trước cả bàn rồi thẻ úp lại; mỗi câu game lật sẵn một thẻ, chạm thẻ úp giống nó.
  - **Đếm khối** (Phân tích): đếm mọi khối trong mô hình, kể cả khối bị che.
  - **Bi rơi đâu** (Phân tích): lần theo cần gạt mũi tên, chạm cốc bi rơi vào; từ mức Khó có công tắc tự lật và nhiều bi.
  - **Chạm đích** (Tính toán): chạm 2–3 thẻ số có tổng bằng số đích.
  - **Đếm tiền nhanh** (Tính toán): cộng các tờ tiền, chọn đúng tổng; Siêu khó tính tiền thối lại.
  - **Nhìn từ trên** (Hình dung): chọn hình chiếu nhìn thẳng từ trên xuống của mô hình khối, cẩn thận bản lật gương.
  - **Gấp hộp** (Hình dung): chọn lưới trải phẳng gấp được đúng khối hộp mẫu.
  - Kỹ thuật: mỗi game có bộ sinh câu đố tất định trong `packages/shared/src/games/<id>/` với test 10.000 seed (tất định, đúng một đáp án, độ khó tăng dần đo được) và hệ số điểm theo độ khó riêng (CR-006); test server "không lặp game" chạy được khi số game nhiều hơn số vòng tối đa.
- Trả lời sai thì thấy ngay đáp án đúng trong lúc bị khoá, ở mọi game kể cả Kẻ lạc đàn (CR-006).
- Câu nhắc riêng theo độ khó ở màn đếm ngược và màn hướng dẫn (vd. "Nhớ đèn, chạm ngược lại!").
- Nhạc nền nhiều bài (2026-10-14): thanh nhạc cạnh nút ngôn ngữ/giao diện để phát/dừng, chuyển bài, chỉnh âm lượng (máy tính); nhạc tự phát ở lần chạm đầu, nhỏ lại một nửa khi đếm ngược và đang chơi, dừng khi chuyển tab, nhớ lựa chọn (FR-GD-10, [CR-007](change-requests.md#cr-007)).
  - Kỹ thuật: feature `apps/web/src/features/music/`; bài nhạc lấy tự động từ `apps/web/src/assets/music/` (chỉ tải khi phát); âm lượng qua Web Audio GainNode để chạy được trên iPhone, không có thì dùng `audio.volume`.
- Âm thanh hiệu ứng (2026-10-14): tiếng khi bấm nút (thường, bật/tắt, xác nhận, quay lại), báo lỗi, tích tắc đếm ngược, trả lời đúng/sai; nút chuông bật/tắt riêng, độc lập với nhạc nền (FR-GD-07, [CR-008](change-requests.md#cr-008)).
  - Kỹ thuật: feature `apps/web/src/features/sfx/`; tiếng mặc định tạo bằng Web Audio, có file `apps/web/src/assets/sfx/<loại>.mp3` thì dùng file; một AudioContext dùng chung với nhạc nền (`lib/audio-context.ts`); gắn tiếng bằng một listener chung, nút đặc biệt khai báo `data-sfx`.

- Phòng chờ 2D: 8 ô người chơi, đếm "Sẵn sàng y/x", ẩn/hiện và sao chép mã phòng, đổi nhân vật ngay trong phòng (UC-05, FR-PH-12, FR-PH-13).
- Chọn game mỗi vòng: vòng quay may mắn (server quyết định, mọi máy quay đồng bộ) hoặc chủ phòng chọn, người chơi bình chọn để gợi ý; game đã chơi không lặp lại trong trận (UC-20).
- Màn hướng dẫn trước mỗi game: cách chơi, điều khiển, tính điểm; mỗi người tự chọn độ khó, chủ phòng xem độ khó cả phòng và bấm "Nhắc" người chọn lệch; bấm "Đã hiểu", hết 20 giây thì tự bắt đầu (UC-21).
- Màn chơi có HUD mới: đồng hồ, điểm, chuỗi đúng, số "+điểm" bay lên sau mỗi câu đúng, đếm ngược khi bị khoá (FR-VC-11).
- Bảng điểm vòng → bảng cộng điểm trận (+10/+8/…, mũi tên lên/xuống hạng) → vinh danh top 3 kiểu Kahoot bằng 2D (UC-08, FR-VC-20, FR-GD-06).
- "Chơi lại" vào thẳng chọn game vòng 1, giữ người chơi và số vòng; "Về phòng chờ" để đổi nhân vật hoặc chờ thêm người (UC-09).
- Kỹ thuật: tin nhắn mới `setPickMode`, `voteGame`, `spinWheel`, `pickGame`, `introReady`, `nudgeDifficulty`; mã lỗi `not-ready`; test server phủ các luồng mới, luồng dễ sai và tải lại trang ở từng pha (tổng 39 test server); thêm test cho store phía web.
- Công cụ dev: `pnpm share` cho bạn bè ở xa chơi thử qua Cloudflare Quick Tunnel (không cần tài khoản, máy mình làm host); build riêng ra `apps/web/dist-share`, Vite cho phép host `.trycloudflare.com`.

### Thay đổi

- **Trống quay dọc thay vòng quay** ([CR-017](change-requests.md#cr-017), thay [CR-015](change-requests.md#cr-015)): chế độ Vòng quay may mắn giờ là một trống cuộn dọc vô hạn kiểu bộ chọn giờ iPhone; mỗi dòng một game với hình, tên, màu nhóm, đọc được dù danh mục có 30 game (trước đây 30 lát chữ chồng nhau). Lúc chờ trống trôi chậm, lúc quay nhoè rồi chậm dần, trúng thì dải chọn loé vàng; giảm chuyển động thì hiện thẳng kết quả. Bỏ danh sách "Trong vòng quay" tràn màn bên cạnh. Luật không đổi: server vẫn chọn kết quả, mọi máy dừng cùng game. Kỹ thuật: `features/game-select/drum.ts` + `components/Drum.tsx` (CSS 3D, không WebGL), xoá `LuckyWheel.tsx`; `GameClient.Icon` tuỳ chọn để thay hình bằng biểu tượng riêng sau này.
- **Phòng 12 người, điểm thứ hạng co giãn** ([CR-018](change-requests.md#cr-018)): phòng party nhận tối đa 12 người (gồm bot; Chơi với máy 1–11 bot), thêm 4 màu avatar. Điểm trận mỗi vòng tính theo số ghế: hạng r được max(1, N − r) + thưởng top 3/2/1 (12 người: 15, 13, 11 … 1; 8 người: 11, 9, 7, 5, 4, 3, 2, 1). Phòng chờ, bảng điểm lúc chơi (điện thoại từ 7 người: lưới avatar + điểm), kết quả vòng, tổng điểm, vinh danh hạng 4–12 có bố cục gọn cho phòng đông. Tải thử 12 người. Không đổi seed hay bộ sinh câu đố.
- **Kẻ lạc đàn** mức Khó và Siêu khó: ô lạc giờ cùng hình, cùng màu nhưng sáng hơn hoặc tối hơn (Khó lệch 14–18 %, Siêu khó lệch 7–9 % độ sáng); bỏ kiểu khác hẳn màu và kiểu xoay vì quá dễ nhận. Mầm/Thường và Kiểm tra não không đổi ([đặc tả](../04-minigames/odd-one-out.md)).
- Màn "Chọn bạn đồng hành" thành **Hồ sơ của bạn**: thẻ danh thiếp (nhân vật lớn, tên, trạng thái tài khoản kèm nút Tài khoản & lịch sử) bên cạnh lưới bạn đồng hành; bỏ chọn độ khó ở màn này (độ khó vẫn nhớ ở màn giới thiệu game). Luyện tập · chọn game: thẻ game dọc có hình minh hoạ lớn trên nền màu nhóm kỹ năng; chip lọc đang chọn không còn bị cắt bóng và không nhảy bố cục khi đổi chọn.
- Bắt đầu trận cần ≥ 2 người và tất cả đã sẵn sàng; chơi lại cũng cần ≥ 2 người (FR-PH-11).
- Đếm ngược trước khi chơi từ 3 giây lên 5 giây, hiện tên game và độ khó của mình (FR-VC-02).
- Độ khó chọn theo từng game ở màn hướng dẫn thay vì ở sảnh (FR-VC-12).
- Cân bằng điểm (CR-006): mỗi game có hệ số điểm theo độ khó riêng để chọn mức cao không bị thiệt; thời gian không thao tác được (trình chiếu, nhiều lần chạm) không bị trừ vào thưởng tốc độ; combo tối đa × 1,5; game mới chơi 60 giây mỗi vòng (Kẻ lạc đàn giữ 45 giây). Con số sẽ chỉnh sau buổi chơi thử.
- Kỹ thuật: `MinigameDef` thêm `difficultyMultiplier`, `speedAllowanceMs`; `MinigameBridge` thêm `unlockDelay`; `GameLocale` thêm `levelHints`; `pnpm new-game` sinh khung theo khuôn mới (60 giây, hiện đáp án khi sai). Gói tải đầu khoảng 255 KB JS gzip, mỗi minigame là chunk riêng.

### Sửa lỗi

- **Phòng chờ hiện đủ 12 chỗ:** trước đây phòng dưới 8 người chỉ hiện 8 ô (lưới 4 × 2 cũ) dù thanh trên ghi "Người chơi 1/12", nên trông như phòng chỉ có 8 chỗ. Giờ luôn hiện 12 ô: máy tính 4 cột × 3 hàng (ô rộng hơn, chừa chỗ cho thú và phụ kiện; hàng cao cố định nên bấm "Thêm bot" không xô lệch giao diện), màn lớn (vùng trình duyệt ≥ 1500 × 1020 px, vd. 27 inch) dùng thẻ to cao hơn; điện thoại 2 cột × 6 hàng. Chủ phòng thêm bot ở bất kỳ ô trống nào. Kỹ thuật: `lobbySlotCount` (`apps/web/src/lib/room-size.ts`) luôn trả `MAX_PLAYERS`; `LOBBY_ROOMY_QUERY` chọn thẻ to.
- **Tải lại trang giữa trận không còn mất phòng:** trước đây tải lại lần hai có thể rơi về menu, ghế cũ bị treo và lệnh (Sẵn sàng, thêm bot) đi nhầm phòng. Nguyên nhân: nối lại chạy hai lần cùng một token trong chế độ phát triển (StrictMode), lần thua xoá token lần thắng vừa lưu. Giờ nối lại dùng chung một lần gọi, chỉ xoá token khi chưa đổi, và phòng cũ không ghi đè state (`net/connection.ts`, test `net/resume-party.test.ts`).
- **Bảng điểm vòng:** bấm "Xem lại kết quả vòng" sau khi đã tự sang tổng điểm không còn bị đẩy ngay về tổng điểm.
- Máy tắt "Animation effects" của Windows (trình duyệt báo giảm chuyển động) không thấy vòng quay, bục hiện cùng lúc và mất pháo giấy, khác hẳn người chơi khác. Giờ giảm chuyển động vẫn giữ nhịp hiện lần lượt (chỉ đổi trượt thành mờ dần), và nút Hiệu ứng "Luôn bật" bật lại đủ hiệu ứng ([CR-010](change-requests.md#cr-010)).

### Gỡ bỏ

- Sân khấu 3D ở sảnh và thư viện three.js / React Three Fiber; giờ chỉ Phaser dùng WebGL ([ADR 0010](../02-architecture/decisions/0010-drop-3d-2d-lobby-and-podium.md)).

## [0.1.0] — Prototype · dự kiến 2026-10-18 (Cổng 0)

Bản nền móng: chơi được một trận đầy đủ với một minigame. Gồm commit `c41ec2f` (2026-10-09) và các thay đổi tiếp theo tới 2026-10-10.

### Thêm

- Tạo phòng bằng mã 4 ký tự, vào phòng bằng mã hoặc link `/r/<mã>`, tối đa 8 người (UC-02, UC-03).
- Mời bạn bằng bảng chia sẻ của điện thoại hoặc copy link (UC-04).
- Sảnh chờ có sân khấu 3D, sẵn sàng / huỷ sẵn sàng, đổi độ khó (UC-05).
- Chủ phòng chọn minigame và số vòng, đếm ngược 3 giây cho mọi người cùng lúc (UC-06).
- Minigame đầu tiên **Kẻ lạc đàn** với 4 mức độ khó (UC-07).
- Tính điểm theo độ khó, tốc độ và combo; khoá 1,5 giây khi trả lời sai; dải điểm real-time (UC-07).
- Màn kết quả vòng và chung cuộc, chơi lại (UC-08, UC-09).
- Tự nối lại khi rớt mạng (giữ chỗ 45 giây) và khi tải lại trang (UC-10).
- Màn giới thiệu, menu chính, màn "Chọn bạn đồng hành" với 6 nhân vật, mỗi con 7 biểu cảm (UC-01, [CR-002](change-requests.md#cr-002)).
- Giao diện sáng/tối/theo hệ thống, tiếng Việt và tiếng Anh (UC-11, [CR-001](change-requests.md#cr-001)).
- Hồ sơ người chơi được nhớ cho lần sau.
- Kỹ thuật: monorepo pnpm + Turborepo; gói `shared` (PRNG có seed, giao thức zod, tính điểm, mã phòng); game server Colyseus 0.18; CI GitHub Actions; Dockerfile + `fly.toml`; script `pnpm new-game`; đội 5 AI agent và 3 workflow.

### Thay đổi

- Giao diện chuyển sang shadcn/ui với token màu ngữ nghĩa ([ADR 0006](../02-architecture/decisions/0006-ui-shadcn-and-theme-tokens.md)), rồi sang phong cách bảng phấn ([ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md)).
- Code web tổ chức lại theo feature, mỗi minigame một thư mục ([ADR 0008](../02-architecture/decisions/0008-web-feature-folders-and-game-modules.md), [CR-004](change-requests.md#cr-004)).
- Tài liệu tổ chức lại theo vòng đời SDLC (thư mục `00-tracking/`, `01-product/`).

<!--
Mẫu cho bản mới (copy lên trên, ngay dưới [Chưa phát hành]):

## [x.y.z] — Tên mốc · YYYY-MM-DD

### Thêm
- …

### Sửa lỗi
- …
-->

[← Theo dõi](README.md) · [Mục lục tài liệu](../README.md)
