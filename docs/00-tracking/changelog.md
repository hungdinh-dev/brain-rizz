# Nhật ký phát hành (Changelog)

Mọi thay đổi đáng kể của Brain Rizz, theo định dạng [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và đánh số theo [Semantic Versioning](https://semver.org/lang/vi/) (quy tắc riêng của dự án: [Quy trình phát triển › Phiên bản](../03-guides/sdlc.md#5-phiên-bản--phát-hành)).

Mỗi mục ghi theo góc nhìn **người chơi** trước, kỹ thuật sau; kèm mã UC/FR/CR nếu có. Nhóm: **Thêm** · **Thay đổi** · **Sửa lỗi** · **Gỡ bỏ** · **Bảo mật**.

## [Chưa phát hành]

_Thêm vào đây ngay khi một thay đổi được merge; khi phát hành thì đổi tiêu đề mục này thành số phiên bản._

Luồng trận mới theo [CR-005](change-requests.md#cr-005), 4 minigame MVP và cân bằng điểm theo [CR-006](change-requests.md#cr-006), làm xong 2026-10-12 (sớm hơn kế hoạch GĐ 1). Nếu kịp Cổng 0 thì gộp vào bản 0.1.0 và sửa các dòng tương ứng ở mục 0.1.0 bên dưới; nếu không thì phát hành thành bản trung gian của GĐ 1.

### Thêm

- **Minigame mới Bóng của ai** (nhóm Nhận diện, `shadow-match`): nhìn một đồ vật có màu, chạm vào bóng đen đúng hình dạng; bóng có thể bị xoay hoặc lật. 4 mức độ khó (3 → 6 bóng, mồi khác vật → mồi gần giống, thêm xoay và lật), vòng 60 giây, có màn hướng dẫn và chữ vi/en; chơi được trong phòng party, Luyện tập và Kiểm tra não (điểm chuẩn 2 050; phiên bản luật Kiểm tra não lên 2 nên bảng xếp hạng Điểm Não và từng minigame làm mới). Bộ sinh câu đố tất định, test 10.000 seed ([đặc tả](../04-minigames/shadow-match.md)).
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

- **Kẻ lạc đàn** mức Khó và Siêu khó: ô lạc giờ cùng hình, cùng màu nhưng sáng hơn hoặc tối hơn (Khó lệch 14–18 %, Siêu khó lệch 7–9 % độ sáng); bỏ kiểu khác hẳn màu và kiểu xoay vì quá dễ nhận. Mầm/Thường và Kiểm tra não không đổi ([đặc tả](../04-minigames/odd-one-out.md)).
- Bắt đầu trận cần ≥ 2 người và tất cả đã sẵn sàng; chơi lại cũng cần ≥ 2 người (FR-PH-11).
- Đếm ngược trước khi chơi từ 3 giây lên 5 giây, hiện tên game và độ khó của mình (FR-VC-02).
- Độ khó chọn theo từng game ở màn hướng dẫn thay vì ở sảnh (FR-VC-12).
- Cân bằng điểm (CR-006): mỗi game có hệ số điểm theo độ khó riêng để chọn mức cao không bị thiệt; thời gian không thao tác được (trình chiếu, nhiều lần chạm) không bị trừ vào thưởng tốc độ; combo tối đa × 1,5; game mới chơi 60 giây mỗi vòng (Kẻ lạc đàn giữ 45 giây). Con số sẽ chỉnh sau buổi chơi thử.
- Kỹ thuật: `MinigameDef` thêm `difficultyMultiplier`, `speedAllowanceMs`; `MinigameBridge` thêm `unlockDelay`; `GameLocale` thêm `levelHints`; `pnpm new-game` sinh khung theo khuôn mới (60 giây, hiện đáp án khi sai). Gói tải đầu khoảng 255 KB JS gzip, mỗi minigame là chunk riêng.

### Sửa lỗi

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
