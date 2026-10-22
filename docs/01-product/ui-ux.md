# Thiết kế UI/UX

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế — phần giao diện và trải nghiệm |
| Phiên bản tài liệu | 1.6 · 2026-10-21 — chơi với bot theo [CR-016](../00-tracking/change-requests.md#cr-016) |
| Bản mẫu (canvas) | **[Brain Rizz — Màn chờ & Menu](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ)** |
| Liên quan | [Thiết kế game](game-design.md), [ADR 0006 — shadcn & token](../02-architecture/decisions/0006-ui-shadcn-and-theme-tokens.md), [ADR 0009 — bảng phấn & nhân vật](../02-architecture/decisions/0009-chalkboard-style-and-characters.md) |
| Cập nhật khi | Thêm màn hình, đổi luồng, thêm artboard vào canvas, đổi token màu/font |

## 1. Nguyên tắc trải nghiệm

1. **Điện thoại trước.** Thiết kế khung 390×844 trước rồi mới mở rộng ra máy tính 1280×720. Minigame luôn ở khung dọc 720×1280, scale `FIT`.
2. **Một ngón tay.** Nút chính nằm nửa dưới màn hình; vùng chạm ≥ 48×48 px; không thao tác kéo thả bắt buộc.
3. **Ít chữ.** Mỗi màn hình một việc chính, một nút chính (màu `primary`). Trẻ 7 tuổi phải đoán được nên bấm gì.
4. **Luôn biết chuyện gì đang xảy ra.** Mất kết nối, đang chờ chủ phòng, đang tải sân khấu — đều có thông báo rõ.
5. **Không số liệu giả.** Tính năng chưa làm hiện nhãn "Sắp có", không hiện số người chơi hay bảng xếp hạng bịa.
6. **Tôn trọng người dùng.** Hỗ trợ giảm chuyển động, sáng/tối, tương phản ≥ 4,5:1, không chỉ phân biệt bằng màu.

## 2. Bản đồ màn hình

App không dùng router: màn hình được chọn theo pha của phòng (`apps/web/src/app/App.tsx`). Link mời `/r/<mã>` chỉ để điền sẵn mã.

```mermaid
flowchart TD
  I["Giới thiệu<br/>Chạm để bắt đầu"] --> M["Menu chính"]
  L0(["Mở link /r/ABCD"]) --> M
  M <--> P["Chọn bạn đồng hành<br/>(hồ sơ)"]
  M -->|"Tạo phòng / Vào phòng"| LB["Phòng chờ 2D<br/>sẵn sàng, đổi nhân vật,<br/>chủ phòng đặt số vòng,<br/>thêm / đổi mức / bỏ bot"]
  M -->|"Chơi với máy"| BD["Hộp thoại Chơi với máy<br/>số bot 1–7, mức chung"]
  BD -->|"Vào phòng"| LB
  M -.->|"Sắp có"| X["Tìm trận · Đấu bóng ma ·<br/>Thử thách hôm nay"]
  M --> PK["Luyện tập: chọn game<br/>(nhóm theo 5 kỹ năng)"]
  PK --> PI["Hướng dẫn + độ khó<br/>(dùng lại S11, bản một mình)"]
  PI --> PP["Đếm ngược 3 giây → chơi"]
  PP --> PR["Kết quả luyện tập<br/>kỷ lục / Kỷ lục mới!"]
  PR -->|"Chơi lại"| PP
  PR -->|"Đổi độ khó"| PI
  PR -->|"Chọn game khác"| PK
  M --> BI["Kiểm tra não: giới thiệu"]
  BI -->|"Bắt đầu"| BG["5 game: hướng dẫn ngắn → Sẵn sàng →<br/>đếm ngược 3 giây → chơi → màn tạm 3 giây"]
  BG --> BR["Kết quả: Điểm Não,<br/>biểu đồ 5 cạnh, hạng tuần"]
  BR -->|"Làm lại"| BI
  BR -->|"Xem bảng xếp hạng"| LBD["Bảng xếp hạng<br/>Điểm Não / Theo minigame"]
  M --> LBD
  M --> AC["Tài khoản & lịch sử<br/>3 tab, liên kết Google"]
  LB -->|"Chủ phòng bấm Bắt đầu"| GS["Chọn game<br/>vòng quay / chủ phòng chọn"]
  GS --> GI["Hướng dẫn<br/>+ tự chọn độ khó"]
  GI --> CD["Đếm ngược 5 giây"]
  CD --> PL["Chơi minigame"]
  PL -->|"Hết giờ"| R["Bảng điểm vòng"]
  R --> MP["Cộng điểm trận"]
  MP -->|"Vòng tiếp theo"| GS
  MP -->|"Xem người thắng"| PD["Vinh danh top 3<br/>kiểu Kahoot"]
  PD -->|"Chơi lại"| GS
  PD -->|"Về phòng chờ"| LB
  LB -->|"Thoát"| M
  PD -->|"Rời phòng"| M
```

## 3. Danh mục màn hình

| # | Màn hình | Thư mục code | Bản mẫu trên canvas | Đã làm trong code | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| S1 | Giới thiệu | `features/home/components/IntroScreen.tsx` | ✅ Desktop + Điện thoại | ✅ | |
| S2 | Menu chính | `features/home/components/MenuScreen.tsx` | ✅ Khu 2 (cũ) · Khu 12 (CR-009) | ✅ | Theo khu 12: thẻ Luyện tập, Kiểm tra não ("Cao nhất …"), dòng Bảng xếp hạng, Tài khoản & lịch sử (trạng thái phiên); còn "Sắp có": Tìm trận, Đấu bóng ma (ô nét đứt), Thử thách hôm nay. Bỏ linh vật + câu gợi ý ở cột phải cho vừa 1280×720 |
| S3 | Chọn bạn đồng hành (hồ sơ) | `features/home/components/ProfileScreen.tsx` | ✅ "Chọn bạn đồng hành" (tương tác) | ✅ | |
| S4 | Phòng chờ 2D | `features/lobby/LobbyScreen.tsx` | ✅ Khu 5 · Khu 23 (CR-016) | ✅ (bot: ❌) | Đã gỡ 3D (ADR 0010). Chưa có mã QR như bản máy tính. CR-016: ô trống thêm bot, ô bot đổi mức / bỏ ngay trong ô ([mục 6.6](#66-chơi-với-máy-s17-cr-016)) |
| S10 | Chọn game (vòng quay / chủ phòng chọn + bình chọn) | `features/game-select/` | ✅ Khu 6 | ✅ | CR-005 |
| S11 | Hướng dẫn & độ khó | `features/game-intro/` | ✅ Khu 7 | ✅ | CR-005; lời nhắc của chủ phòng hiện bằng toast |
| S5 | Chơi (đếm ngược 5 giây, dải điểm, khung minigame) | `features/play/CountdownScreen.tsx`, `PlayScreen.tsx` | ✅ Khu 8 + trang Minigame M1 | ✅ | |
| S6 | Bảng điểm vòng + cộng điểm trận | `features/results/ResultsScreen.tsx` | ✅ Khu 9, 10 | ✅ | Tự sang bảng tổng điểm sau 5 giây |
| S7 | Vinh danh top 3 kiểu Kahoot | `features/results/PodiumScreen.tsx` | ✅ Khu 11 · Khu 19–20 (CR-010) | ✅ (nhịp CR-010: ❌) | 2D, không 3D; pháo giấy CSS. CR-010: hạng 4+ → 3 → 2 → trống dồn → 1, thẻ Giỏi nhất mỗi thể loại ([mục 6.2](#62-vinh-danh-s7-cr-010), [6.3](#63-thẻ-giỏi-nhất-mỗi-thể-loại-cr-010)) |
| S8 | Minigame (mỗi game một scene) | `games/<id>/` | ✅ Trang Minigame: khung chung M1 + 4 game MVP (M2–M5) | 1/15 | Kẻ lạc đàn chưa có bản mẫu riêng (dùng làm ví dụ trong M1) |
| S9 | Banner mất kết nối, thông báo (toast) | `components/common/ConnectionBanner.tsx`, `components/ui/sonner` | ✅ M1 · Trạng thái | ✅ | |
| — | Bảng nhân vật (sticker sheet) | `components/characters/` | ✅ Mèo Khói, Chó Bơ | ✅ 6 nhân vật | 4 nhân vật còn lại chưa có bảng trên canvas |
| S12 | Luyện tập (chọn game, kết quả) | `features/practice/` | ✅ Khu 13 | ✅ | UC-13. Hướng dẫn + độ khó dùng lại S11, khác biệt ghi trên canvas |
| S13 | Kiểm tra não (giới thiệu, màn tạm, kết quả) | `features/brain-test/` | ✅ Khu 14 | ✅ | UC-14. Biểu đồ 5 cạnh SVG tự vẽ |
| S14 | Tài khoản & lịch sử | `features/account/` | ✅ Khu 15 · Khu 21 (CR-010) | ✅ (thẻ thế mạnh: ❌) | UC-16. 3 tab, Liên kết Google, Xoá dữ liệu. CR-010: thẻ Thế mạnh trong trận party đầu tab Trận party ([mục 6.4](#64-thế-mạnh-trong-trận-party-s14-cr-010)) |
| S15 | Bảng xếp hạng | `features/leaderboard/` | ✅ Khu 16 | ✅ | UC-19. Điểm Não / Theo minigame, Tuần này / Mọi thời đại |
| — | Trạng thái chung (tải, trống, lỗi, chưa kết nối máy chủ dữ liệu, hộp xác nhận) | dùng chung 4 màn trên | ✅ Khu 17 | ❌ | FR-MR-15 |
| — | Hàng nút trên cùng · nút Hiệu ứng | `app/App.tsx`, `IntroScreen.tsx`, `MenuScreen.tsx`, `features/motion/` | ✅ Khu 18 (CR-010) | ❌ | Theo hệ thống / Luôn bật ([mục 6.1](#61-hàng-nút-trên-cùng--nút-hiệu-ứng-cr-010)) |
| S16 | Chat trong phòng (nút nổi + sheet điện thoại, cột phải máy tính, bong bóng biểu cảm) | `features/chat/` | ✅ Khu 22 (CR-011) | ❌ | Hiện ở 5 pha, ẩn lúc đếm ngược/đang chơi ([mục 6.5](#65-khung-chat-trong-phòng-s16-cr-011)) |
| S17 | Chơi với máy (thẻ menu + hộp thoại) | `features/home/` | ✅ Khu 23 (CR-016) | ❌ | Số bot 1–7, một mức chung, trạng thái đang tạo / lỗi ([mục 6.6](#66-chơi-với-máy-s17-cr-016)) |
| — | Huy hiệu máy (`BotBadge`), chip mức bot, tên bot | `components/characters/BotBadge` (đề xuất), `components/common/MatchChips.tsx` | ✅ Khu 23 (CR-016) | ❌ | Dùng ở phòng chờ, hướng dẫn, dải điểm, bảng điểm, vinh danh, chat, lịch sử |

Thứ tự thiết kế tiếp theo (đề xuất): bảng nhân vật cho 4 con còn lại; 5 minigame của giai đoạn 2 khi tới lúc.

## 4. Bản mẫu trên canvas

Canvas [Brain Rizz — Màn chờ & Menu](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) có 3 trang.

### Trang "Màn chờ & luồng trận" (47 artboard)

| Khu | Artboard | Kích thước |
| --- | --- | --- |
| 1 · Màn giới thiệu | Giới thiệu · Desktop / Giới thiệu · Điện thoại | 1280×720 / 390×844 |
| 2 · Menu chính | Menu chính · Desktop / Menu chính · Điện thoại | 1280×720 / 390×844 |
| 3 · Nhân vật & biểu cảm sticker | Nhân vật · Mèo Khói / Nhân vật · Chó Bơ | 1280×860 |
| 4 · Bộ sưu tập nhân vật | Chọn bạn đồng hành (tương tác) | 1280×720 |
| 5 · Phòng chờ | Desktop chủ phòng (tương tác) / Điện thoại người chơi | 1280×720 / 390×844 |
| 6 · Chọn game | Vòng quay: Desktop (tương tác) + Điện thoại · Chủ phòng chọn: Desktop (tương tác) + Bình chọn điện thoại | 1280×720 / 390×844 |
| 7 · Hướng dẫn & độ khó | Desktop chủ phòng (tương tác) / Điện thoại người chơi | 1280×720 / 390×844 |
| 8 · Đếm ngược | Desktop / Điện thoại | 1280×720 / 390×844 |
| 9 · Kết quả vòng | Desktop / Điện thoại | 1280×720 / 390×844 |
| 10 · Cộng điểm trận | Desktop (tương tác, công tắc vòng cuối) / Điện thoại | 1280×720 / 390×844 |
| 11 · Vinh danh chung cuộc | Desktop (tương tác) / Điện thoại | 1280×720 / 390×844 |
| 18 · Nút Hiệu ứng (CR-010) | Desktop (bấm thử 3 trạng thái) / Điện thoại (bấm thử với vòng quay) | 1280×720 / 390×844 |
| 19 · Vinh danh hồi hộp (CR-010) | Desktop chủ phòng (tự chạy) / Điện thoại Na (tự chạy, cuộn) / Lịch hiện · đặc tả nhịp | 1280×720 / 390×1320 / 1280×860 |
| 20 · Giỏi nhất mỗi thể loại (CR-010) | Trạng thái & bố cục / Điện thoại · Tối (đã cuộn) | 1280×1040 / 390×844 |
| 22 · Chat trong phòng (CR-011) | Điện thoại Na (bấm thử) / Điện thoại · Tối (chủ phòng) / Desktop chủ phòng (bấm thử, thu gọn) / Nút nổi theo 6 pha · Điện thoại / Bong bóng biểu cảm & chuyển động / Trạng thái (8 ô) | 390×844 / 1280×720 / 2540×940 / 1280×720 / 1280×1000 |
| 23 · Chơi với máy (CR-016) | Hàng 1: Menu + hộp thoại · Desktop (bấm thử) / Hộp thoại · Điện thoại (bấm thử) / Menu có thẻ mới · Điện thoại · Tối / Trạng thái hộp thoại + thẻ menu. Hàng 2: Phòng chờ có bot · Desktop chủ phòng (bấm thử) / Điện thoại chủ phòng (bấm thử, cuộn) / Điện thoại · Tối (người chơi Lan) / Đặc tả huy hiệu, chip mức, tên, trạng thái ô. Hàng 3: Huy hiệu máy ở mọi nơi (sáng, tối) / Bot nhường ghế | 1280×720 / 390×844 / 390×844 / 1600×940 · 1280×720 / 390×844 / 390×844 / 1280×1300 · 1280×1330 ×2 / 1280×840 |

Khu 5–11 kể một câu chuyện liền mạch: phòng 4 người (Hưng chủ phòng, Lan, Minh, Na), vòng 2/3 chơi Kẻ lạc đàn sau khi vòng 1 đã chơi Cân não. Bản điện thoại luôn là góc nhìn của Na. Mỗi khu có ghi chú cam mô tả trạng thái đang tải / lỗi / trống / mất kết nối. Các màn có link nối với nhau theo đúng luồng.

Khu 18–20 (CR-010) dùng trận 6 người, 5 vòng (Hưng 42, Na 40, Minh 33, Lan 29, Bảo 24, Vy 18) để có đủ hạng 4+ và đủ 5 thể loại; bản "Điện thoại · Tối" ở khu 20 dùng lại trận 4 người, 3 vòng của khu 5–11 (chỉ 3 thể loại đã chơi). Artboard vinh danh tự chạy lặp lại; Tweaks: `stage` (dừng ở một nhịp), `reduced` (giảm chuyển động), `dark`. Artboard nút Hiệu ứng: Tweaks `osReduce` (máy đang giảm chuyển động), `dark`.

Khu 22 (CR-011) dùng lại phòng 4 người của khu 5–11; điện thoại là góc nhìn Na, máy tính là chủ phòng Hưng. Artboard chat bấm thử có Tweaks `host` (hiện công tắc chủ phòng), `variant` (`normal` / `empty` / `chatOff`), `dark`; artboard bong bóng có Tweaks `reduced`.

Khu 23 (CR-016) kể chuyện Na chơi với máy: Na bấm "Chơi với máy", giữ mặc định 3 bot mức Vừa, rồi đổi một bot sang Khó; bạn Lan vào bằng mã. Phòng chờ có Na (chủ phòng), Fen · máy, Si · máy, Fen 2 · máy (trùng nhân vật nên có số), Lan và 3 ô trống. Tên nhân vật theo `vi.ts` hiện tại (Si, Fen, Mochi, Bắp, Cam, Tròn); màu avatar theo `AVATAR_COLORS`. Artboard hộp thoại có Tweaks `dark`, `state` (`normal` / `loading` / `error`), `open`; bấm thử: lần đầu giả lập lỗi, Thử lại thì thành công và nối sang phòng chờ. Artboard phòng chờ có Tweaks `dark`, `host` (tắt = góc nhìn Lan), `full` (đủ 8 ghế); bấm thử được thêm bot, đổi mức, bỏ bot, Sẵn sàng.

### Trang "Minigame" (20 artboard)

| Khu | Artboard | Kích thước |
| --- | --- | --- |
| M1 · Khung chơi chung | Điện thoại / Điện thoại chế độ tối / Desktop / Trạng thái (10 giây cuối, bị khoá, mất kết nối, hết giờ) | 390×844 / 1280×720 |
| M2 · [Theo dấu ánh đèn](../04-minigames/light-trail.md) | Điện thoại (Thường) / 4 mức độ khó / Trạng thái & chế độ tối / Hình hướng dẫn | 390×844 / 1280×720 / 560×360 |
| M3 · [Cân não](../04-minigames/balance.md) | Điện thoại (Thường) / 4 mức độ khó / Trạng thái & bộ vật / Hình hướng dẫn | như trên |
| M4 · [Bóng bay số](../04-minigames/number-balloons.md) | Điện thoại (Thường) / 4 mức độ khó / Trạng thái & chế độ tối / Hình hướng dẫn | như trên |
| M5 · [Xoay hình](../04-minigames/rotate-match.md) | Điện thoại (Thường) / 4 mức độ khó / Trạng thái & chế độ tối / Hình hướng dẫn | như trên |

Dữ liệu câu đố trên bản mẫu lấy đúng mục "Ví dụ để vẽ bản mẫu" của từng đặc tả. "Hình hướng dẫn" dùng ở màn Hướng dẫn & độ khó (khu 7).

### Trang "Một mình & tài khoản" (20 artboard, [CR-009](../00-tracking/change-requests.md#cr-009))

| Khu | Artboard | Kích thước |
| --- | --- | --- |
| 12 · Menu & lối vào | Menu chính (CR-009) · Desktop / Điện thoại (cuộn) | 1280×720 / 390×1040 |
| 13 · Luyện tập | Chọn game · Desktop / Điện thoại · Kết quả (kỷ lục mới) · Desktop · Kết quả (chưa phá kỷ lục, đồng bộ lỗi) · Điện thoại | 1280×720 / 390×844 |
| 14 · Kiểm tra não | Giới thiệu · Desktop (có lượt trước) / Điện thoại (lần đầu, chưa kết nối máy chủ dữ liệu) · Màn tạm giữa game · Desktop / Điện thoại · Kết quả (đã lưu, hạng tuần) · Desktop / Kết quả (chưa lưu) · Điện thoại · Tối | 1280×720 / 390×844 |
| 15 · Tài khoản & lịch sử | Desktop (khách, bấm thử 3 tab) / Điện thoại (đã liên kết Google, tab Luyện tập) | 1280×720 / 390×844 |
| 16 · Bảng xếp hạng | Desktop (bấm thử tab + kỳ; Mọi thời đại có dòng ghim) / Điện thoại · Theo minigame · Tối | 1280×720 / 390×844 |
| 17 · Trạng thái chung | 8 ô: đang tải, trống (bảng xếp hạng, tab party), lỗi mạng, chưa kết nối máy chủ dữ liệu, 3 hộp xác nhận / Tài khoản khi chưa kết nối · Điện thoại | 1280×860 / 390×844 |
| 21 · Thế mạnh trong trận party ([CR-010](../00-tracking/change-requests.md#cr-010)) | Desktop (tab Trận party, Tweaks `state`: bình thường / rỗng / đang tải) / Điện thoại | 1280×720 / 390×844 |

Mọi artboard của trang này có nút **Tweaks › dark** để xem chế độ tối. Câu chuyện chung: người chơi Na (nhân vật Khói), Điểm Não cao nhất 742, hạng 12 tuần này. Số Kiểm tra não tính đúng công thức ở [Thiết kế game › Kiểm tra não](game-design.md#kiểm-tra-não). Mỗi khu có ghi chú cam mô tả hành vi và trạng thái; khu 2 (menu cũ) có ghi chú trỏ sang khu 12.

Quy ước: mỗi màn hình mới có **cả bản điện thoại và bản máy tính**; thêm vào canvas thành một khu mới đánh số tiếp; xong thì cập nhật bảng ở mục 3 và mục này. Việc thiết kế giao cho agent `ui-designer` ([Đội AI agent](../03-guides/ai-agents.md)).

## 5. Hệ thống thiết kế

Nguồn chuẩn là code: token ở `apps/web/src/styles/globals.css`, component ở `apps/web/src/components/ui/` (shadcn đã chỉnh). Bảng dưới chỉ là tóm tắt để tra nhanh.

### Màu

| Token | Sáng | Tối | Dùng cho |
| --- | --- | --- | --- |
| `background` (mặt bảng) | `#2d6a54` xanh bảng | `#24203f` tím than | Nền app |
| `chalk` / `chalk-muted` | Trắng phấn | Trắng phấn | Chữ viết thẳng lên bảng |
| `card` | `#fff8ef` giấy | `#2f2a52` | Thẻ nhãn dán |
| `muted-foreground` | `#5a5578` | `#b9b5d2` | Chữ phụ **bên trong thẻ** |
| `primary` | `#ffd166` vàng sun | `#ffd166` | Nút chính, điểm nhấn |
| `sticker` + `shadow-sticker` | Mực đậm | Mực đậm | Viền và bóng đổ của thẻ, nút |
| `destructive` | `#c93a55` | `#f07a90` | Lỗi, thao tác nguy hiểm |
| `destructive-foreground` | `#fff8ef` | `#1f1b3a` | Chữ trên nút xoá đặc (`Button variant="destructive"`); cùng `destructive` làm badge số tin chưa đọc của chat (4,7:1 sáng, 6,2:1 tối) |
| `bubble-mine` / `bubble-mine-foreground` | `#ffecc6` / `#1f1b3a` (14:1) | `#5c4b22` / `#fff8ef` (8:1) | Bong bóng tin của chính mình trong khung chat (CR-011). Tin người khác dùng `bg-muted` + `text-card-foreground` |
| `bot` / `bot-foreground` | `#b9c7dc` thép nhạt / `#1f1b3a` (9,6:1) | Giữ như sáng (nền so với thẻ tối 7,8:1) | Huy hiệu máy, nhãn "Đấu với máy", thẻ "Chơi với máy" (CR-016). Luôn kèm viền `border-sticker` vì nền chỉ 1,6:1 so với thẻ giấy |
| `identify` … `visualize` | Xem [Thiết kế game › 5 nhóm](game-design.md#4-năm-nhóm-kỹ-năng) | | Màu nhóm kỹ năng |
| Màu avatar (8 màu) | `AVATAR_COLORS` trong `packages/shared/src/constants.ts` | | Phân biệt người chơi |

Quy tắc: chỉ dùng class token (`bg-card`, `text-chalk`, `bg-primary`…), không dùng `text-white`, `bg-ink` cho nền/chữ thông thường. Inline `style` chỉ cho giá trị tính lúc chạy (màu avatar).

### Chữ

| Font | Dùng cho | Class |
| --- | --- | --- |
| Baloo 2 (600–800) | Tiêu đề, nút, logo | `font-display` |
| Be Vietnam Pro (400–800) | Chữ thường | `font-sans` (mặc định) |

Cả hai tải từ Google Fonts trong `apps/web/index.html`, đủ dấu tiếng Việt.

### Component

- **UI cơ bản** (`components/ui/`): AlertDialog, Badge, Button, Card, Dialog (CR-016: như AlertDialog nhưng đóng được bằng Esc / lớp phủ / nút ×; nút đóng chỉ hiện khi truyền `closeLabel`; giảm chuyển động chỉ mờ; cao quá màn thì cuộn trong hộp), DropdownMenu, Input, Label, Sheet (CR-011: viền mực 4 px, bo 3xl ở cạnh hướng vào màn, giảm chuyển động chỉ mờ; nút đóng chỉ hiện khi truyền `closeLabel` đã dịch), Skeleton, Slider, Sonner (toast), Switch (CR-011: rãnh 48×28 viền mực, bật = `primary`, vùng chạm 64×44), Tabs (`variant` "folder" kiểu bìa hồ sơ / "pill" trên bảng), Toggle, ToggleGroup; thêm bằng `pnpm dlx shadcn@latest add <tên>` trong `apps/web`. Lưu ý (2026-10-16): CLI hiện sinh `import { cn } from "cn"` và đòi ghi đè `button.tsx`; chạy kèm `--dry-run --view`, chép mã về rồi sửa import thành `@/lib/utils`.
- **Dùng chung** (`components/common/`): `PlayerAvatar`, `DifficultyPicker`, `LanguageToggle`, `ThemeToggle`, `ConnectionBanner`, `RankBadge`, `MatchChips` (`RoundChip`, `CategoryChip`, `DifficultyChip`), `HostWaitCard`, `AvatarStrip`.
- **Hàng nút trên cùng** (thứ tự cố định): `MusicBar` · `SfxToggle` · nút Hiệu ứng (CR-010, `features/motion/`) · `LanguageToggle` · `ThemeToggle`. Mọi nút là `Button variant="chalk" size="icon-chalk"` (44×44).
- **Thương hiệu** (`components/brand/`): `Logo`, `BrainMascot`, `ChalkDoodle`.
- **Nhân vật** (`components/characters/`): `<Character id mood size animated />`.

### Chuyển động

- Hoạt ảnh nhân vật bằng CSS (`styles/characters.css`), tắt khi giảm chuyển động.
- Minigame: đúng → nảy; sai → rung + mờ. Thời lượng hiệu ứng ≤ 400 ms để không chậm nhịp chơi.
- **Một nguồn "giảm chuyển động"** (CR-010): giảm khi nút Hiệu ứng ở "Theo hệ thống" **và** máy báo `prefers-reduced-motion: reduce`; "Luôn bật" thì luôn đầy đủ. React, CSS (`motion-safe:`/`motion-reduce:`, `@media` trong `characters.css`) và scene Phaser đều đọc nguồn này, không tự đọc `matchMedia`.
- **Giảm chuyển động không phải bỏ nhịp**: thứ tự và thời điểm hiện giữ nguyên, chỉ thay trượt/nảy/xoay bằng mờ dần (≤ 400 ms); bỏ pháo giấy, nhân vật đứng yên, vòng quay dừng ngay ở kết quả. Âm thanh đi theo nút Âm thanh, không theo nút Hiệu ứng.

## 6. Đặc tả chi tiết

Thông số để frontend-dev làm theo. Câu chữ ghi ở đây là đề xuất: frontend-dev thêm vào `vi.ts` trước rồi `en.ts`, tên khoá có thể đổi cho khớp nhóm sẵn có. Mục 6.1–6.4 chỉ dùng token sẵn có; mục 6.5 thêm token `bubble-mine`; mục 6.6 thêm token `bot` và component `Dialog`.

### 6.1 Hàng nút trên cùng · nút Hiệu ứng (CR-010)

Bản mẫu: [canvas khu 18](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) (Desktop bấm thử 3 trạng thái; Điện thoại bấm thử với vòng quay).

- **Vị trí:** ngay sau `SfxToggle` ở cả 3 chỗ có hàng nút: `App.tsx` (mọi màn trong phòng và màn một mình), `IntroScreen.tsx`, `MenuScreen.tsx`. Menu điện thoại có 7 nút (hỏi đáp, nhạc ×2, âm thanh, hiệu ứng, ngôn ngữ, giao diện) = 356 px: vừa khít 390 px; màn hẹp hơn thì xuống dòng, căn phải như hiện nay, không thu nhỏ nút.
- **Hình dạng:** `Button variant="chalk" size="icon-chalk"` (44×44, vùng chạm đạt chuẩn), icon lucide **`SparklesIcon`** cho mọi trạng thái; trạng thái báo bằng nền và chấm, không chỉ bằng màu.

| Trạng thái | Khi nào | Hình | `title` (vi / en) |
| --- | --- | --- | --- |
| Theo hệ thống | Mặc định, máy bình thường | Như các nút phấn khác (`border-chalk/70 bg-board-shade text-chalk`) | "Hiệu ứng: theo cài đặt của máy" / "Effects: following your device" |
| Theo hệ thống · máy giảm | Mặc định, máy báo `reduce` | Như trên + chấm 12 px góc trên phải: `bg-identify`, viền 2 px `border-sticker` | "Máy đang giảm chuyển động — bấm để luôn bật hiệu ứng" / "Your device reduces motion — tap to always show effects" |
| Luôn bật | Người dùng đã bấm | Nền phấn đặc: `bg-chalk text-background border-chalk` (tương phản icon 5,9:1 sáng, 14:1 tối) | "Hiệu ứng: luôn bật — bấm để theo cài đặt của máy" / "Effects: always on — tap to follow your device" |

- **Trợ năng:** `aria-label` cố định "Luôn bật hiệu ứng" / "Always show effects" + `aria-pressed` (true khi Luôn bật); `title` đổi theo bảng trên; `data-sfx="toggle"`.
- **Phản hồi:** bấm → toast (sonner) 2,5 s: "Đã luôn bật hiệu ứng" / "Effects always on", hoặc "Hiệu ứng theo cài đặt của máy" / "Effects follow your device". Điện thoại không có `title` khi chạm nên toast là phản hồi chính.
- **Lưu:** trên máy (localStorage, bọc try/catch), mặc định "Theo hệ thống"; đổi giữa trận áp dụng ngay cho hiệu ứng bắt đầu sau đó.
- **Khoá i18n gợi ý:** `motion.toggle`, `motion.titleSystem`, `motion.titleReduced`, `motion.titleOn`, `motion.toastOn`, `motion.toastSystem`.

### 6.2 Vinh danh (S7, CR-010)

Bản mẫu: [canvas khu 19](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) (Desktop chủ phòng, Điện thoại Na, artboard "Lịch hiện vinh danh").

**Lịch hiện** (ms tính từ lúc vào màn; N = số người hạng 4+; nên tách thành hàm thuần có test):

| Nhịp | Thời điểm | Ví dụ 6 người (N = 3) |
| --- | --- | --- |
| Hàng hạng 4+ thứ i, đếm **từ dưới lên** (i = 0…N−1) | `600 + 450·i` | hạng 6: 600 · hạng 5: 1.050 · hạng 4: 1.500 |
| Hạng 3 | hàng cuối + 900; không có hạng 4+: 600 | 2.400 |
| Hạng 2 | hạng 3 + 1.400 | 3.800 |
| Trống dồn (chờ) | hạng 2 + 900, dài 2.000 | 4.700 → 6.700 |
| Hạng 1 | hết trống | 6.700 |
| Thẻ Giỏi nhất mỗi thể loại | hạng 1 + 1.600; mỗi hàng + 120 | 8.300 → 8.780 |

- Thiếu bục (2 người, đồng hạng làm một bậc trống): nhịp sau dời lên chỗ của bậc trống, không chờ. Đồng hạng trên cùng bậc: lật cùng lúc. Ví dụ: 4 người → hạng 1 lúc 5,8 s; 8 người → 7,6 s.
- **Trước khi lật:** bục đứng sẵn từ đầu (màu `rankBg`, số hạng hiện, chưa có tên/điểm); chỗ nhân vật là vòng phấn nét đứt có "?" (`border-chalk/55`, chữ `text-chalk-muted`). Danh sách hạng 4+ có khung thẻ và tiêu đề từ đầu, hàng chưa lật để `opacity-0` (giữ chỗ). Không phần nào làm nhảy bố cục khi lật.
- **Lúc chờ trống:** trên bục 1 hiện chữ "Và hạng nhất là…" / "And the winner is…" (`font-display`, `text-primary`, ba chấm chạy); vòng "?" bục 1 phập phồng.
- **Nhãn "Bạn về …"** (`results.youPlace`, chỉ điện thoại): giữ chỗ bằng `invisible`/`opacity-0` từ đầu, hiện lúc **chỗ của mình lật + 300 ms** (ở hạng 4+ thì theo hàng của mình). Không có trong bảng xếp hạng (khán giả) thì không có nhãn.
- **Nút chủ phòng** (Chơi lại, Về phòng chờ) và Rời phòng bấm được ngay từ 0 ms; bấm giữa chừng thì sang màn mới, không đợi hết nhịp.
- **Vào lại phòng giữa lúc vinh danh** (mất kết nối rồi vào lại, hoặc màn mở khi pha `podium` đã chạy lâu): hiện hết ngay, không phát trống/fanfare.
- **Trình đọc màn hình:** một vùng `role="status"` đọc từng nhịp: "Hạng 3: Minh, 33 điểm" … "Và hạng nhất là…" … "Hạng 1: Hưng, 42 điểm".

**Chuyển động:**

| Phần tử | Bình thường | Giảm chuyển động |
| --- | --- | --- |
| Hàng hạng 4+ | Trượt từ phải 24 px + hiện, 320 ms, `cubic-bezier(.2,.8,.3,1)` | Mờ dần 320 ms |
| Hạng 3, hạng 2 | Nhân vật nhô lên 40 px, scale .8→1, 520 ms, `cubic-bezier(.34,1.56,.64,1)`; tên + điểm mờ dần 300 ms trễ 150 ms | Mờ dần 320 ms |
| Chờ trống | Vòng "?" bục 1 scale 1→1,08, 400 ms, lặp qua lại | Chữ hiện, không phập phồng |
| Hạng 1 | Bung 760 ms: translateY 60→−18→0 px, scale .6→1,12→,96→1, `cubic-bezier(.34,1.56,.64,1)`; vương miện rơi từ −48 px, xoay −25°→0, 480 ms trễ 200 ms; viền bục loé (outline `primary` 10 px → 0, 600 ms); pháo giấy: 12 mảnh rơi cùng lúc rồi 12 mảnh rơi rải; nhân vật lắc lư (`animated`) sau 1 s | Mờ dần 400 ms; không pháo giấy, không nảy, nhân vật đứng yên (`animated={false}`) |
| Thẻ thể loại | Trượt lên 16 px + hiện, 400 ms; mỗi hàng trượt từ phải như hàng hạng 4+ | Mờ dần |
| Nhãn "Bạn về …" | Xoay −6°→−2°, scale .85→1, 360 ms, `cubic-bezier(.34,1.56,.64,1)` | Mờ dần |

**Bố cục máy tính** khi có thẻ thể loại: ≥ 1280 px ba cột `[320 px thẻ thể loại] [bục, mỗi bậc 160 px] [330 px hạng 4+ và nút]`; 1024–1279 px: thẻ xuống dưới hàng bục + cột phải, rộng hết, hàng xếp 2 cột. Bậc bục giữ cao 210/150/112 px (hạng 1/2/3), nhân vật 150/120 px. Điện thoại: nhãn → bục → hạng 4+ → thẻ thể loại → chờ chủ phòng → Rời phòng (trang cuộn).

**Âm thanh** (Web Audio, recipe mới trong `features/sfx/recipes.ts` + `kinds.ts`, không thêm file; theo nút Âm thanh, kể cả khi giảm chuyển động):

| Loại | Lúc phát | Âm sắc mong muốn |
| --- | --- | --- |
| `tick` (có sẵn) | Mỗi hàng hạng 4+ | Giữ nguyên, nhỏ hơn ~50% |
| `reveal` (mới) | Hạng 3, hạng 2 | "Ba-dum" đi lên, ~220 ms: tam giác (triangle) E5 659 Hz 80 ms rồi B5 988 Hz 140 ms (bắt đầu ở 70 ms); attack 5 ms, tắt dần theo hàm mũ; đỉnh ~0,22 |
| `drumroll` (mới) | Đúng 2.000 ms chờ hạng 1 | Trống snare dồn nhanh dần: nhiễu trắng → highpass 700 Hz → bandpass 2 kHz (Q 0,7); mỗi tiếng gõ attack 2 ms, tắt 60 ms; khoảng cách gõ 85 ms → 38 ms (≈ 12 → 26 tiếng/giây); đỉnh tăng 0,12 → 0,38 (crescendo), xen kẽ ±15% như hai tay. Dưới nền: rền timpani sine 73 Hz + 110 Hz, gain 0 → 0,18 trong 2 s, tremolo 6 Hz sâu 30%. Dừng gọn lúc hạng 1 |
| `fanfare` (mới) | Lúc lật hạng 1 | ~1,3 s, kèn đồng vui: tiếng xèng (nhiễu → highpass 5 kHz, tắt 1,1 s, đỉnh 0,3) + tiếng thùng (sine 120→50 Hz, 120 ms); giai điệu G4–C5–E5 (392/523/659 Hz, mỗi nốt 120 ms) rồi hợp âm C5+E5+G5+C6 giữ 840 ms, vibrato 5,5 Hz ±8 cent từ 600 ms, nhả 300 ms. Mỗi nốt 2 sawtooth lệch ±7 cent → lowpass (900 → 3.200 Hz trong 40 ms rồi 1.800 Hz), mỗi giọng ~0,08 để tổng ≤ 0,3 |

**Khoá i18n gợi ý:** `results.drumroll` ("Và hạng nhất là…" / "And the winner is…"), `results.revealLive` ("Hạng {{rank}}: {{name}}, {{count}} điểm" / "Place {{rank}}: {{name}}, {{count}} pts").

### 6.3 Thẻ Giỏi nhất mỗi thể loại (CR-010)

Bản mẫu: [canvas khu 20](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) (trạng thái & bố cục; điện thoại tối) và trong khu 19 (khi tự chạy).

- **Nội dung:** chỉ thể loại **đã chơi** trong trận, thứ tự cố định Nhận diện → Ghi nhớ → Phân tích → Tính toán → Hình dung (không theo thứ tự vòng). Người nhận = `categoryLeaders()`: điểm vòng cao nhất của thể loại, phải > 0; hoà thì cùng nhận.
- **Một hàng (74 px, 2 dòng):** dòng 1 `CategoryChip` + tổng điểm vòng căn phải (`font-display` 18 px, định dạng số theo ngôn ngữ); dòng 2 avatar 28 px (`PlayerAvatar`, chồng −9 px) + tên (`font-display` 16 px, cắt "…"). Nền `bg-card`, viền 3 px `border-sticker`, bo 14 px.
- **Hoà:** tối đa 2 avatar và 2 tên. 1 người: "Na"; 2 người: "Minh & Lan"; từ 3 người: "Hưng, Minh +2" kèm chip tròn "+2" 28 px (`bg-muted text-card-foreground`, viền `border-sticker`) sau 2 avatar. `aria-label` của hàng đọc đủ: "Phân tích: Minh & Lan, 1.240 điểm vòng".
- **Hàng có mình:** nền `bg-primary/30` (như hàng của mình ở danh sách hạng 4+) và "(bạn)" sau tên mình — không chỉ phân biệt bằng màu.
- **Ẩn:** thể loại cả phòng 0 điểm thì không có hàng; không còn hàng nào thì không hiện thẻ lẫn khung giữ chỗ (bố cục máy tính về 2 cột như cũ).
- **Khung giữ chỗ** (trước khi lật hạng 1): cùng kích thước, viền nét đứt 3 px `border-chalk/55`, nền `bg-board-shade`, tiêu đề `text-chalk`, dòng phụ "Lật sau hạng nhất…" `text-chalk-muted`, mỗi hàng chỉ có chip + vòng nét đứt + "?". Tới lúc hiện thì thay bằng thẻ thật (mờ/trượt như mục 6.2).
- **Điện thoại:** khi thẻ hiện mà người chơi chưa tự cuộn, cuộn nhẹ tới thẻ (`scrollIntoView({ block: "nearest" })`, giảm chuyển động thì không mượt).
- **Câu chữ:** tiêu đề "Giỏi nhất mỗi thể loại" / "Best in each category"; dòng phụ "Tổng điểm vòng theo thể loại trong trận" / "Total round points per category this match"; "Lật sau hạng nhất…" / "Revealed after 1st place…"; tên của mình "{{name}} (bạn)" / "{{name}} (you)"; hai người "{{a}} & {{b}}"; nhiều người "{{a}}, {{b}} +{{count}}".

### 6.4 Thế mạnh trong trận party (S14, CR-010)

Bản mẫu: [canvas khu 21](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) (trang "Một mình & tài khoản").

- **Vị trí:** đầu tab Trận party, trên bảng lịch sử; tab chưa có trận nào thì vẫn dùng EmptyState sẵn có (không hiện thẻ).
- **Số liệu** (từ `match_results` của chính mình): mỗi thể loại — *số danh hiệu* = số trận có thể loại đó trong `category_titles`; *TB* = trung bình `category_scores[thể loại]` trên các trận **có chơi** thể loại đó (cần `category_scores` chỉ chứa khoá thể loại đã chơi — xem Chuyển giao); *số trận* = số trận có chơi.
- **"Mạnh nhất":** nhiều danh hiệu nhất; hoà → TB cao hơn; chưa có danh hiệu nào → TB cao nhất. Nhãn nhỏ `bg-primary text-ink` viền `border-sticker` trên góc ô + nền ô `bg-primary/30`.
- **Máy tính:** khung `bg-muted` viền 3 px `border-sticker` bo 18 px, 5 ô lưới 5 cột, mỗi ô: `CategoryChip`; vương miện 20 px (tô `fill-primary` khi có danh hiệu, chỉ viền khi 0) + "4 danh hiệu"; "TB 1.460 điểm"; "trong 5 trận" (`text-muted-foreground`). **Điện thoại:** 5 hàng ≥ 50 px: chip (92 px) · vương miện + "4 danh hiệu" · "TB 1.460" / "5 trận" căn phải.
- **Chưa chơi thể loại:** ô viền nét đứt `border-muted-foreground`, chữ "Chưa chơi" — vẫn hiện để biết còn thiếu gì.
- **Trạng thái:** đang tải → khung + 5 ô `Skeleton` cùng kích thước; rỗng (chỉ có trận cũ chưa có điểm thể loại) → khung viền đứt, vương miện trên ô vàng, "Chơi thêm một trận party để biết bạn giỏi thể loại nào. Các trận cũ chưa có điểm theo thể loại."; lỗi/chưa kết nối → trạng thái sẵn có của tab.
- **Câu chữ:** "Thế mạnh trong trận party" / "Party strengths"; "Danh hiệu = giỏi nhất thể loại đó trong một trận · TB = điểm vòng trung bình mỗi trận" / "Title = best in that category in a match · Avg = average round points per match"; "{{count}} danh hiệu" / "{{count}} title(s)" (en `_one` "1 title", `_other` "{{count}} titles"); "TB {{n}} điểm" / "Avg {{n}} pts"; "trong {{count}} trận" / "in {{count}} match(es)"; "Chưa chơi" / "Not played yet"; "Mạnh nhất" / "Top skill"; câu rỗng en: "Play a party match to see which category you shine in. Older matches have no category points."

### 6.5 Khung chat trong phòng (S16, CR-011)

Bản mẫu: [canvas khu 22](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ) (điện thoại Na bấm thử, điện thoại tối chủ phòng, desktop chủ phòng bấm thử, nút nổi theo 6 pha, bong bóng & chuyển động, 8 trạng thái). Mục này có **token mới** `bubble-mine` và **component mới** `Sheet`, `Switch` (mục 5).

**Theo pha** (`Phase` của phòng):

| Pha | Điện thoại | Máy tính (≥ 1024 px) | Bong bóng trên avatar |
| --- | --- | --- | --- |
| `lobby` | Nút nổi + sheet | Cột phải 320 px | Ô người chơi (`PlayerSlot`) |
| `game-select` | Nút nổi + sheet | Cột phải | Không (màn không có avatar) |
| `game-intro` | Nút nổi + sheet | Cột phải | Không |
| `countdown`, `playing` | **Ẩn hẳn**, không chừa chỗ; sheet đang mở thì tự đóng | **Ẩn hẳn** cột, nội dung dùng cả bề ngang | Không |
| `round-results` | Nút nổi + sheet; badge nảy 1 lần + nhãn "N tin mới" 3 giây | Cột phải (badge trên thanh thu gọn nếu đang thu gọn) | Hàng bảng điểm vòng, cộng điểm trận |
| `podium` | Nút nổi + sheet | Cột phải | Nhân vật trên bục, hàng hạng 4+ |

Tin đến lúc `countdown`/`playing`: cộng vào số chưa đọc, không âm thanh, không bong bóng.

**Điện thoại (< 1024 px):**

- **Nút nổi:** 56×56, `bg-card`, viền 3 px `border-sticker`, bo 18 px, `shadow-sticker-sm`, icon lucide `MessageCircleIcon` 26 px; `fixed`, `right`/`bottom` = `max(16px, env(safe-area-inset-*))`. Badge: tròn cao 26 px, `bg-destructive text-destructive-foreground`, viền `border-sticker`, góc trên phải lệch −10 px; quá 9 ghi "9+". Chat bị tắt: icon `MessageCircleOffIcon`, không badge, vẫn bấm được để đọc tin cũ. `aria-label` đọc cả số: "Mở chat · 3 tin chưa đọc".
- **Không che nút chính:** khi nút nổi hiện, khung cuộn của màn có đệm đáy để lúc cuộn tới cuối, mép dưới nút chính (Sẵn sàng, Bắt đầu, Quay, Vòng tiếp, Chơi lại, Rời phòng…) cách đáy màn ≥ 80 px (16 + 56 + 8). Gợi ý: `pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0`. Giữa lúc cuộn, nút nổi có thể đè lên thẻ nội dung bên phải; không sao, nút chính luôn tới được.
- **Sheet:** `Sheet side="bottom"`, cao 60% màn (tối thiểu 440, tối đa 560 px), lớp phủ nhạt hơn mặc định (`bg-ink/30`) để còn thấy bong bóng ở nửa trên; bấm lớp phủ hoặc nút X (44 px, `closeLabel`) để đóng. Thứ tự từ trên: thanh kéo (trang trí) → tiêu đề "Chat phòng" + "4 người" (+ công tắc nếu là chủ phòng) → dải đã tắt tiếng → danh sách tin → dòng lỗi → hàng biểu cảm → ô nhập. Bàn phím mở thì sheet bám trên bàn phím (`visualViewport`), danh sách co lại.
- **Hàng biểu cảm:** 1 hàng, 6 nút cao 44 (emoji rộng 44; GG, "Nhanh lên!" theo chữ), cách 6 px; vừa 354 px bên trong sheet.

**Máy tính (≥ 1024 px):** cột phải 320 px nằm trong mặt bảng, thẻ `bg-card` viền 3 px, bo 22 px, cao hết mặt bảng. Nút thu gọn (44 px, `PanelRightCloseIcon`) → thanh 68 px có nút chat 48 px + badge + chữ "Chat" + nút mở rộng; nhớ trên máy (localStorage, bọc try/catch). Hàng biểu cảm là lưới 3×2. Từ 768 đến 1023 px dùng kiểu điện thoại.

**Tin trong danh sách** (`role="log"`, `aria-live="polite"`, cuộn bám đáy; có tin mới khi người xem đã cuộn lên thì không tự kéo xuống):

| Loại | Người khác | Của mình |
| --- | --- | --- |
| Chữ tự do | Avatar 32 + tên (`font-display` 15 px, vương miện nếu là chủ phòng) + bóng `bg-muted text-card-foreground`, viền 2,5 px, bo `4 16 16 16`, chữ 15 px | Căn phải, không avatar/tên, bóng `bg-bubble-mine text-bubble-mine-foreground`, bo `16 4 16 16` |
| Câu chọn sẵn (GG, "Nhanh lên!") | Nhãn `bg-primary text-ink`, `font-display` 18 px, bóng `shadow-sticker-sm`, nghiêng −2° | Như bên trái, nghiêng 2° |
| Emoji lẻ | 34 px, không bóng | 34 px, căn phải |

Tin bị lọc hiện `***` đúng như máy chủ gửi, không đánh dấu thêm. Không có tin hệ thống (vào/rời phòng), không có giờ gửi.

**Ô nhập:** `Input` 1 dòng, chữ 16 px (iPhone không tự phóng to), đệm phải 66 px cho bộ đếm "n/120" (`text-muted-foreground`, chuyển `text-destructive` từ 100). Chặn gõ quá 120 ở client (`maxLength`), máy chủ vẫn cắt. Enter để gửi; nút Gửi 48×48 `bg-primary`, `SendIcon`, `aria-label="Gửi"`, tắt khi ô rỗng/chỉ có khoảng trắng.

**Tắt tiếng:** bấm avatar (vùng chạm 44 px) hoặc tên của người khác → `DropdownMenu` một mục "Tắt tiếng {{name}}" (`VolumeXIcon`) + dòng giải thích "Chỉ ẩn trên máy bạn, {{name}} không biết…". Lưu trên máy theo id người chơi (localStorage, try/catch). Người bị tắt: ẩn cả tin cũ, tin mới, bong bóng, không tính vào số chưa đọc. Đầu danh sách có dải `bg-muted` "Đã tắt tiếng {{name}}" (hoặc "Đã tắt tiếng {{count}} người") + nút "Bật lại" cao 44 (bật lại tất cả người đang bị tắt). Tin của mình không có menu.

**Công tắc chủ phòng:** `Switch` ở hai chỗ, cùng cờ `chatEnabled`: (1) tiêu đề khung chat, chỉ chủ phòng thấy, kèm chữ "Bật"/"Tắt" (trạng thái không chỉ bằng màu); (2) hàng "Chat trong phòng" trong `MatchSetupCard` kèm câu giải thích. Tắt chat: hàng biểu cảm + ô nhập thay bằng khối viền nét đứt `border-muted-foreground`: người chơi thấy "Chủ phòng đã tắt chat · Bạn vẫn xem được tin cũ."; chủ phòng thấy "Bạn đã tắt chat cho cả phòng · Bật lại bằng công tắc ở trên hoặc trong Thiết lập trận. Tin cũ vẫn còn.". Tiêu đề khung có nhãn nét đứt "Đã tắt". Bong bóng cũng ngừng.

**Bong bóng biểu cảm trên avatar:** chỉ cho emoji và câu chọn sẵn (chữ tự do không). `bg-card` (câu chọn sẵn: `bg-primary`), viền 2,5 px, bo 14 px, cao 36 px, đuôi nhọn xuống avatar; nằm trên avatar, tràn ra ngoài ô, không đẩy bố cục; bảng điểm thì lệch góc trên phải avatar. Hiện 2,5 giây; mỗi người một bong bóng, cái mới thay cái cũ. `pointer-events: none`, `aria-hidden` (nội dung đã có trong danh sách tin).

**Chuyển động** (một nguồn giảm chuyển động của `features/motion`, mục 5):

| Phần tử | Bình thường | Giảm chuyển động |
| --- | --- | --- |
| Bong bóng | Nảy vào 200 ms (scale .6 → 1,1 → 1, `cubic-bezier(.34,1.56,.64,1)`), giữ, ra 300 ms mờ + bay lên 10 px | Mờ vào 150 ms, mờ ra 300 ms; thời điểm giữ nguyên |
| Badge số chưa đọc | Nảy 1 lần khi số tăng (scale 0 → 1,25 → 1, 350 ms) | Hiện thẳng |
| Nhãn "N tin mới" (round-results) | Trượt từ phải 8 px + mờ vào, 3 giây rồi mờ ra | Chỉ mờ |
| Sheet | Trượt lên + mờ 200 ms (đã có trong `Sheet`) | Chỉ mờ |
| Thu gọn cột máy tính | Đổi bề rộng 200 ms | Đổi ngay |

**Trạng thái & lỗi** (mã lỗi máy chủ như các lỗi khác):

| Tình huống | Hiển thị |
| --- | --- |
| Trống | Ô vuông viền mực có icon chat + "Chưa có tin nào" + "Chào cả phòng một câu, hoặc bấm một biểu cảm bên dưới." |
| Gửi nhanh quá | Dòng `text-destructive` `role="status"` trên hàng biểu cảm: "Gửi chậm lại chút nhé, thử lại sau 1 giây." 1,5 giây; hàng biểu cảm + nút Gửi mờ 45% và khoá; giữ bản nháp |
| Chat bị tắt | Như mục Công tắc chủ phòng |
| Gửi vào pha chơi | Không xảy ra (khung ẩn); nếu máy chủ vẫn từ chối thì bỏ qua im lặng |
| Mất kết nối / vào lại | Dải `bg-muted` "Đang kết nối lại…" (`RefreshCwIcon`), ô nhập khoá, giữ bản nháp; danh sách cũ để `Skeleton` cho tới khi máy chủ gửi lại tối đa 30 tin gần nhất |

**Câu chữ gợi ý** (vi / en): "Chat phòng" / "Room chat"; "{{count}} người" / "{{count}} players"; "Nhắn cả phòng…" / "Message the room…"; "Gửi" / "Send"; "Mở chat" / "Open chat"; "{{count}} tin chưa đọc" / "{{count}} unread"; "{{count}} tin mới" / "{{count}} new messages"; "Thu gọn chat" / "Collapse chat"; "Mở rộng chat" / "Expand chat"; "Đóng chat" / "Close chat"; "Chưa có tin nào" / "No messages yet"; "Chào cả phòng một câu, hoặc bấm một biểu cảm bên dưới." / "Say hi to the room, or tap a reaction below."; "Gửi chậm lại chút nhé, thử lại sau 1 giây." / "Slow down a little, try again in a second."; "Chủ phòng đã tắt chat" / "The host turned chat off"; "Bạn vẫn xem được tin cũ." / "You can still read earlier messages."; "Bạn đã tắt chat cho cả phòng" / "You turned chat off for the room"; "Chat trong phòng" / "Room chat"; "Bật" / "On"; "Tắt" / "Off"; "Đã tắt" / "Off"; "Tắt tiếng {{name}}" / "Mute {{name}}"; "Chỉ ẩn trên máy bạn, {{name}} không biết." / "Only hidden on your device. {{name}} won't know."; "Đã tắt tiếng {{name}}" / "{{name}} is muted"; "Bật lại" / "Unmute"; "Tuỳ chọn cho {{name}}" / "Options for {{name}}"; "Đang kết nối lại…" (khoá sẵn có). Nhãn trình đọc màn hình cho biểu cảm: "Gửi biểu cảm cười ra nước mắt / cháy quá / vỗ tay / hoảng hốt" / "Send reaction: tears of joy / fire / clap / scream". "GG" và "Nhanh lên!" / "Hurry up!" là câu chọn sẵn, dịch theo ngôn ngữ người xem nếu máy chủ gửi mã câu thay vì chữ (đề xuất cho backend-dev).

### 6.6 Chơi với máy (S17, CR-016)

Bản mẫu: [canvas khu 23](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang "Màn chờ & luồng trận" (menu + hộp thoại, trạng thái hộp thoại, phòng chờ chủ phòng / người chơi, đặc tả ô, huy hiệu ở mọi nơi, bot nhường ghế). Luật bot: [Kế hoạch chơi với bot](bot-players.md). Mục này có **token mới** `bot` / `bot-foreground` và **component mới** `Dialog` (mục 5).

**Thẻ ở menu:** nút "Chơi với máy" là thẻ đầu tiên của cột phải trên máy tính, và nằm ngay dưới lưới 4 thẻ trên điện thoại (cùng phần tử `<aside>`, chỉ đổi thứ tự). Cao 80 / 72 px, `bg-bot text-bot-foreground`, viền 4 / 3,5 px `border-sticker`, `shadow-sticker`, ô icon giấy 54 / 44 px với `BotIcon`, ba mặt bot nhỏ chồng nhau (trang trí, `aria-hidden`), mũi tên phải. `aria-haspopup="dialog"`. Để vừa 1280×720, cột phải giảm khoảng cách còn 12 px, các dòng MenuRow cao 60 px, ô "?" của Thử thách hôm nay cao 36 px.

**Hộp thoại** (`Dialog`, rộng 480 px máy tính, `w-[calc(100%-2rem)]` điện thoại):

| Phần | Thông số |
| --- | --- |
| Đầu | Ô icon 54 / 48 px `bg-bot` nghiêng −4°; tiêu đề `font-display` 30 / 26 px; mô tả 14 / 13 px `text-muted-foreground`. Nút × 44 px (`closeLabel`) |
| Số bot | Như bộ chỉnh số vòng của `MatchSetupCard`: nút − / + 56 / 52 px (`aria-label` riêng), ô số `output aria-live="polite"`. Từ 1 đến 7, mặc định 3; chạm biên thì nút khoá (`disabled`, mờ 40%) |
| Dải 8 ghế | 8 vòng 32 px cách 8 / 6 px, `aria-hidden`: ghế đầu là mình (vòng vàng 3 px), N ghế bot (nhân vật + huy hiệu xs), còn lại vòng nét đứt `border-muted-foreground`. Dòng dưới 13 px: "Bạn + 3 bot · còn 4 ghế cho bạn bè"; 7 bot thì nói rõ bot sẽ nhường ghế |
| Mức chung | `ToggleGroup type="single"` (như `DifficultyPicker`, không cho bỏ chọn), 4 chip ô chọn cao 54 / 50 px chia đều; mặc định Vừa. Ô mô tả ngay dưới (`bg-muted`, bo 14, `aria-live="polite"`): dòng 1 "**Vừa** · chơi câu độ `DifficultyChip`", dòng 2 câu mô tả |
| Nút chính | `Button` cao 62 / 58 px, "Vào phòng →". Mở hộp thoại thì focus vào nút này (`onOpenAutoFocus`), một chạm là chơi với mặc định |

| Trạng thái | Hiển thị |
| --- | --- |
| Đang tạo phòng | Nút thành "Đang tạo phòng…" + `LoaderCircleIcon` quay, khoá; −/+ và chip khoá (mờ 45%). Nút × vẫn bấm được: huỷ, nếu phòng đã tạo xong thì rời phòng |
| Lỗi kết nối | Khung `role="alert"` viền 2,5 px `border-destructive`, nền `bg-destructive/10`, `WifiOffIcon`: "Chưa tạo được phòng" + "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."; giữ lựa chọn; nút thành "Thử lại" + `RefreshCwIcon` |
| Thành công | Đóng hộp thoại, vào thẳng phòng chờ (không có màn trung gian) |

**Chip mức bot** (`BotLevelChip`, đề xuất đặt cạnh `DifficultyChip` trong `MatchChips.tsx`). Màu giữ nguyên ở sáng / tối, chữ mực, viền `border-sticker`, kèm 4 vạch "độ mạnh" (cao 4 / 6 / 8 / 10 px, rộng 3 px, số vạch đậm = mức 1–4, vạch nhạt `ink/22`) nên không chỉ phân biệt bằng màu:

| Mức | Màu | Tương phản chữ | Bot chơi câu độ |
| --- | --- | --- | --- |
| Dễ | `bg-mint` | 9,1:1 | Mầm |
| Vừa | `bg-sky` | 9,1:1 | Thường (không dùng nền giấy như `DifficultyChip` vì lẫn vào thẻ) |
| Khó | `bg-identify` | 8,0:1 | Khó |
| Siêu | `bg-pink` | 8,8:1 | Siêu khó |

- **Nhãn** (trên ô bot): cao 24 px (điện thoại) / 26 px (máy tính), chữ 12 / 13 px đậm, viền 2 px. Chủ phòng thì thêm `ChevronDownIcon` 13 px.
- **Ô chọn** (hộp thoại, chọn mức trong ô): cao 44 px (trong ô) / 50–54 px (hộp thoại), bo 12–14, viền 2,5 px, `shadow-[0_3px_0]`, chữ `font-display` 16–19 px trên vạch. **Đang chọn:** vòng `0 0 0 4px primary, 0 0 0 6.5px sticker` (như chọn nhân vật ở phòng chờ) + dấu tích tròn 20–22 px góc trên phải (`bg-ink text-primary`). Vùng chứa chừa ≥ 7 px để vòng không bị cắt.

**Huy hiệu máy** (`BotBadge`, đề xuất `components/characters/BotBadge`): vòng tròn `bg-bot text-bot-foreground` viền `border-sticker`, `BotIcon` (lucide), luôn `aria-hidden` vì tên đã có "· máy". Góc dưới phải avatar, lệch ra ngoài (vương miện chủ phòng và huy hiệu hạng ở góc trên trái nên không đè nhau; bot không bao giờ là chủ phòng).

| Cỡ | Khung / viền / icon | Lệch | Dùng ở |
| --- | --- | --- | --- |
| `xs` | 16 / 2 / 10 px | −3 px | Avatar 32: `ScoreStrip` (dải điểm điện thoại), tin trong khung chat, dải 8 ghế của hộp thoại |
| `sm` | 20 / 2 / 12 px | −4 px | Avatar 36–48: ô phòng chờ điện thoại (44), danh sách "Đã hiểu" ở `RoomDifficulty` (36), bảng điểm vòng (40 điện thoại, 48 máy tính), `Scoreboard` máy tính (44) |
| `md` | 28 / 3 / 16 px | −5 px | Avatar 68: ô phòng chờ máy tính |
| `inline` | `sm` khi chữ 16–22 px, `md` khi ≥ 26 px | — | Đứng trước tên khi không có avatar tròn: vinh danh (nhân vật đứng trên bục) |

**Tên bot:** web dịch `characters.<id>.name` + hậu tố "· máy" (en "· bot"); ví dụ trong kế hoạch "Bơ · máy" nay là "Fen · máy" theo tên nhân vật hiện tại. Hai bot trùng nhân vật thì số đứng sau tên, đánh theo thứ tự ghế: "Fen · máy", "Fen 2 · máy". Hiển thị như "(bạn)": tên `truncate`, hậu tố `shrink-0 text-muted-foreground` (trên bảng phấn: `text-chalk-muted`), nên khi chật chỉ tên bị cắt. Tin chat của bot đã bị bỏ (cờ `bot` trong tin) chỉ ghi "Fen · máy", không số. Bot không bao giờ có "(bạn)".

**Phòng chờ · ô trống** (`EmptySlot`):

| Ai xem | Hiển thị | Bấm |
| --- | --- | --- |
| Người chơi khác | Như hiện nay: "Chỗ trống" + "Mời bạn" | Mở chia sẻ |
| Chủ phòng | Vòng nét đứt có `BotIcon` (thay dấu +), "Chỗ trống" + dòng gạch chân "+ Thêm bot"; `aria-label` "Chỗ trống, thêm bot", `aria-expanded` | Mở chọn mức ngay trong ô |

- **Chọn mức trong ô:** viền liền 3 px `border-chalk`, nền `bg-board-shade` đậm hơn (≈ `rgb(0 0 0 / .32)`), `role="group"` "Chọn mức cho bot mới". Điện thoại: hàng đầu cao 44 px "Thêm bot" + "Chọn mức" và nút × (44 px, vòng 30 px); dưới là lưới 2×2 ô chọn 44 px; ô cao 156 px, lưới ô dùng `items-start` để ô bên cạnh giữ 60 px. Máy tính: ô giữ 194×148 px, dòng "Thêm bot · chọn mức" 16 px, lưới 2×2 ô chọn 44 px, nút × 44 px (vòng 32 px) đặt lệch ra góc trên phải (−16 px, nằm trong khe lưới). Mở thì focus vào chip Vừa; Esc hoặc × đóng và trả focus về ô; mỗi lúc chỉ mở một ô; bấm chỗ khác cũng đóng.
- **Bấm chip:** gửi `addBot { level }`; trong lúc chờ, chip đó thay chữ bằng vòng xoay (`sr-only` "Đang thêm bot"), các chip khác mờ 45% và khoá. Máy chủ từ chối (vd. vừa đủ người) thì đóng ô + toast "Không thêm được bot, phòng vừa đủ người."
- **Hết ô trống:** không còn "+ Thêm bot". Phòng đủ 8 ghế mà có bot thì dưới lưới có dòng phấn `role="note"` (`InfoIcon`, `text-chalk-muted`, 13 / 14 px) cho mọi người: "Phòng đủ 8 ghế. Bạn bè vẫn vào được bằng mã: bot thêm sau cùng sẽ nhường ghế." Nút "Mời bạn" vẫn bấm được.

**Phòng chờ · ô bot** (`PlayerSlot` khi `isBot`): nhân vật + huy hiệu (sm điện thoại, md máy tính), tên "Fen · máy", chip mức thay cho nhãn trạng thái (bot luôn sẵn sàng và được tính vào "Sẵn sàng n/m"). Không có vương miện, không "(bạn)".

| | Điện thoại (166×60) | Máy tính (194×148) |
| --- | --- | --- |
| Người khác xem | Chỉ xem: nhãn mức không mũi tên, không nút | Như điện thoại |
| Chủ phòng | **Cả ô là một nút** (lớp nút trong suốt phủ ô, `aria-label` "Fen · máy, mức Vừa. Đổi mức hoặc bỏ bot", `aria-expanded`), nhãn mức có mũi tên. Ô quá hẹp để đặt cả chip lẫn × đủ 44 px, nên dồn vào một chạm | Nhãn mức là nút (vùng chạm cao 44 px, lấn lề trên/dưới bằng margin âm), `aria-label` "Đổi mức Fen · máy, đang Vừa". Nút × 44 px (vòng 30 px) góc trên phải trong ô, `aria-label` "Bỏ Fen · máy", bỏ ngay không hỏi lại |
| Đang đổi mức | Ô mở rộng tại chỗ (cao ≈ 208 px): hàng đầu "Đổi mức" + tên + ×; lưới 2×2 ô chọn (mức hiện tại có vòng vàng + tích, `role="radio"`); nút "Bỏ bot" cao 44 px viền mực, chữ `text-destructive`, `XIcon` | Ô giữ kích thước: dòng "Mức cho Fen · máy" + lưới 2×2 ô chọn, × ở góc như khi thêm. Bỏ bot dùng nút × trên ô |

Chọn mức là gửi `setBotLevel` và đóng ô ngay (không có nút Lưu). Bot mới vào và bot đổi mức không đổi vị trí ghế. `MatchSetupCard`: dòng "Bắt đầu khi" đổi thành "Từ 2 người (tính cả bot), tất cả sẵn sàng"; máy tính thêm dòng "Bot trong phòng: 3 · thêm ở ô trống". `HostStatusCard` (điện thoại, người chơi): thêm "· chỉ chủ phòng thêm hoặc bỏ bot".

**Huy hiệu ở các màn khác:**

| Nơi | Thay đổi |
| --- | --- |
| Hướng dẫn & độ khó (`RoomDifficulty`) | Hàng bot: huy hiệu sm trên avatar 36, dòng phụ "Độ khó theo mức Vừa" (`text-muted-foreground` 11,5 px) ở chỗ nhãn "Lệch". Bot **không** bị viền cam, **không** có nút Nhắc dù độ khó khác đa số; đa số chỉ tính người thật. "Đã hiểu" tính cả bot |
| Dải điểm khi chơi (`ScoreStrip`) | Huy hiệu xs góc dưới phải, hạng giữ góc trên trái. Tên dùng `PlayerName compact`: "· máy" chỉ còn `sr-only` (huy hiệu đã báo là bot), `title` giữ đủ "Fen 2 · máy"; chật thì cắt chữ, số của bot trùng nhân vật giữ lại ("Fe… 2"). Lửa combo (14 px) đè góc trên phải avatar thay vì đứng sau điểm, để điểm 5 chữ số vừa cột chữ 53 px của thẻ 108 px |
| `Scoreboard` máy tính | Áp dụng cho mọi người chơi. Huy hiệu sm trên avatar; tên dùng `PlayerName compact` như dải điểm, **không co theo tỉ lệ** (`shrink-0`), chỉ cắt khi dài hơn trần `min(7rem, cột, max(cột − 1,125rem, 4,75rem))`: tối đa 112 px, chừa 18 px cho viên màu độ khó trừ khi chừa vậy làm tên hẹp hơn 76 px (khoảng 6 ký tự, rộng hơn mọi tên bot như "Ember 2" 66 px). "(bạn)" chỉ còn `sr-only` (hàng của mình đã tô nền). Nhãn độ khó lấy phần còn lại (khung `@container`): đủ chỗ thì cắt chữ ("Siê…"), hẹp hơn 44 px thành viên màu 12 px, hẹp hơn 18 px thì chỉ còn cho trình đọc màn hình; `title` giữ tên mức. Điểm và lửa combo cố định (`shrink-0`) |
| Bảng điểm vòng, cộng điểm trận | Huy hiệu sm trên avatar; tên + "· máy" |
| Vinh danh | Huy hiệu `inline` sm trước tên dưới nhân vật. Bot lên bục, nhận vương miện, vào thẻ Giỏi nhất mỗi thể loại như người |
| Khung chat | Avatar 32 + xs; tên "Fen · máy" 15 px. Bot chỉ gửi biểu cảm nhanh; bong bóng trên avatar như người (CR-011). Tắt tiếng bot dùng menu sẵn có |
| Lịch sử tài khoản · Trận party | Khi `bot_count > 0`: nhãn "Đấu với máy" dưới mã phòng (cột thứ 2, nên điện thoại cuộn ngang vẫn thấy): cao 22 px, `bg-bot text-bot-foreground`, viền 2 px `border-sticker`, `BotIcon` 13 px + chữ 11,5 px đậm; `title` và phần `sr-only` "(3 bot)". Hạng "/ 5 người" tính tổng số ghế gồm cả bot |

**Bot nhường ghế** (phòng đủ 8 ghế có bot, người thật vào bằng mã). **Đề xuất: có báo**, bằng toast 3 giây (sonner, `role="status"`) cho những người đã ở trong phòng: "Lan vào phòng · Bắp · máy nhường ghế". Người mới vào không thấy toast. Lý do: bot do chủ phòng thêm và chọn mức, một ô tự biến mất mà không lời giải thích trông như lỗi. Không hỏi xác nhận (luật đã chốt, hỏi lại thì bạn bè phải đứng ngoài chờ), không tự thêm lại bot, không có âm thanh riêng. Nhiều bot nhường liền nhau thì mỗi lần một toast. Dòng phấn "Phòng đủ 8 ghế…" đã báo trước luật này.

**Chuyển động** (một nguồn giảm chuyển động của `features/motion`):

| Phần tử | Bình thường | Giảm chuyển động |
| --- | --- | --- |
| Hộp thoại | Mờ + phóng 95% → 100%, 150 ms (đã có trong `Dialog`) | Chỉ mờ |
| Mở chọn mức trong ô, ô bot mới | Nảy vào 220 ms (scale .9 → 1, `cubic-bezier(.34,1.56,.64,1)`) + mờ | Mờ 200 ms |
| Bỏ bot, bot nhường ghế | Mờ + co còn 95%, 200 ms; ô người mới nảy vào như trên | Chỉ mờ, thứ tự giữ nguyên |
| Vòng xoay đang tạo / đang thêm | Quay 0,9 s / vòng | Đứng yên, chữ vẫn báo trạng thái |
| Toast | Mặc định của sonner | Chỉ mờ |

**Câu chữ gợi ý** (vi / en; khoá `bots.*`, riêng nhãn lịch sử nằm cùng nhóm `account` trong `locales/solo/*.ts`):

| Khoá gợi ý | vi | en |
| --- | --- | --- |
| `bots.menuTitle` | Chơi với máy | Play with bots |
| `bots.menuDesc` | Chưa có bạn? Vào trận ngay với bot | No friends around? Jump in with bots |
| `bots.dialogTitle` | Chơi với máy | Play with bots |
| `bots.dialogDesc` | Phòng có sẵn bot, vẫn có mã để bạn bè vào cùng. | A room with bots ready. It still has a code so friends can join. |
| `bots.countLabel` / `bots.countRange` | Số bot / Từ 1 đến 7 | Bots / 1 to 7 |
| `bots.countUnit` | bot | bot / bots (`_one` / `_other`) |
| `bots.decrease` / `bots.increase` (aria) | Bớt một bot / Thêm một bot | One fewer bot / One more bot |
| `bots.seatsFree` (`_one` / `_other`) | Bạn + {{count}} bot · còn {{free}} ghế cho bạn bè | You + {{count}} bot · seats left for friends: {{free}} / You + {{count}} bots · seats left for friends: {{free}} |
| `bots.seatsFull` | Bạn + 7 bot · đủ 8 ghế. Bạn bè vào bằng mã thì bot nhường ghế. | You + 7 bots · all 8 seats taken. If a friend joins with the code, a bot gives up its seat. |
| `bots.levelLabel` / `bots.levelHint` | Mức của bot / Vào phòng rồi vẫn đổi từng bot | Bot level / You can change each bot in the lobby |
| `bots.level.0`…`3` | Dễ · Vừa · Khó · Siêu | Easy · Medium · Hard · Super |
| `bots.levelDesc.0` | Nghĩ chậm, hay nhầm. Hợp với bé và người mới. | Thinks slowly, often wrong. Great for kids and beginners. |
| `bots.levelDesc.1` | Như người chơi bình thường, thắng thua ngang ngửa. | Plays like a regular player. An even match. |
| `bots.levelDesc.2` | Nhanh và chắc tay. Phải tập trung mới thắng. | Quick and steady. You'll need to focus. |
| `bots.levelDesc.3` | Rất nhanh, hiếm khi sai. Cố hết sức vẫn thắng được. | Very fast, rarely wrong. Beatable at your best. |
| `bots.playsAt` (Trans, `<chip/>` là `DifficultyChip`) | `chơi câu độ <chip/>` | `plays <chip/> puzzles` |
| `bots.start` | Vào phòng | Enter room |
| `bots.creating` | Đang tạo phòng… | Creating room… |
| `bots.errorTitle` / `bots.errorBody` | Chưa tạo được phòng / Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại. | Couldn't create the room / Can't reach the server. Check your connection and try again. |
| `bots.retry` | Thử lại | Try again |
| `bots.close` (aria, nút ×) | Đóng | Close |
| `bots.addBot` | + Thêm bot | + Add bot |
| `bots.emptyAddLabel` (aria) | Chỗ trống, thêm bot | Empty seat, add a bot |
| `bots.pickTitle` / `bots.pickHint` | Thêm bot / Chọn mức | Add a bot / Pick a level |
| `bots.pickTitleWide` (máy tính) | Thêm bot · chọn mức | Add bot · pick a level |
| `bots.pickGroup` (aria) | Chọn mức cho bot mới | Choose a level for the new bot |
| `bots.addAt` (aria từng chip) | Thêm bot mức {{level}} | Add bot: {{level}} |
| `bots.adding` (sr-only) | Đang thêm bot | Adding bot |
| `bots.addFailed` (toast) | Không thêm được bot, phòng vừa đủ người. | Couldn't add a bot. The room just filled up. |
| `bots.suffix` | · máy | · bot |
| `bots.numbered` | {{name}} {{n}} | {{name}} {{n}} |
| `bots.editLabel` (aria, ô bot điện thoại) | {{name}}, mức {{level}}. Đổi mức hoặc bỏ bot | {{name}}, {{level}}. Change level or remove |
| `bots.chipLabel` (aria, chip máy tính) | Đổi mức {{name}}, đang {{level}} | Change level for {{name}}, now {{level}} |
| `bots.editTitle` / `bots.editTitleWide` | Đổi mức / Mức cho {{name}} | Change level / Level for {{name}} |
| `bots.editGroup` (aria) | Đổi mức cho {{name}} | Change level for {{name}} |
| `bots.remove` | Bỏ bot | Remove bot |
| `bots.removeLabel` (aria, nút ×) | Bỏ {{name}} | Remove {{name}} |
| `bots.full` | Phòng đủ 8 ghế. Bạn bè vẫn vào được bằng mã: bot thêm sau cùng sẽ nhường ghế. | All 8 seats are taken. Friends can still join with the code: the last bot added gives up its seat. |
| `bots.yielded` (toast) | {{name}} vào phòng · {{bot}} nhường ghế | {{name}} joined · {{bot}} gave up a seat |
| `bots.inRoom` | Bot trong phòng · {{count}} · thêm ở ô trống | Bots in room · {{count}} · add in empty seats |
| `bots.meterHint` (máy tính) | tính cả bot · bot luôn sẵn sàng | bots included · bots are always ready |
| `bots.hostOnly` | chỉ chủ phòng thêm hoặc bỏ bot | only the host can add or remove bots |
| `bots.introLevel` | Độ khó theo mức {{level}} | Difficulty set by level: {{level}} |
| `lobby.setup.startWhenValue` (sửa khoá sẵn có) | Từ {{min}} người (tính cả bot), tất cả sẵn sàng | {{min}}+ players (bots count), everyone ready |
| `account.vsBots` | Đấu với máy | Vs bots |
| `account.vsBotsCount` (`title`, sr-only) | Có {{count}} bot trong trận | {{count}} bots in this match |

## 7. Đa ngôn ngữ & nội dung

- Mọi chữ qua `t()`: khoá thêm vào `apps/web/src/i18n/locales/vi.ts` trước, rồi `en.ts`. Tên/cách chơi minigame ở `apps/web/src/games/<id>/locales.ts`.
- Giọng văn: thân thiện, ngắn, xưng "bạn"; câu hướng dẫn minigame ≤ 12 từ.
- Chữ tiếng Anh thường dài hơn 20–30%: chừa chỗ trong nút và thẻ.

## 8. Lịch sử thay đổi tài liệu

| Phiên bản | Ngày | Thay đổi | CR |
| --- | --- | --- | --- |
| 1.0 | 2026-10-10 | Bản đầu: bản đồ màn hình, danh mục màn hình, tóm tắt hệ thống thiết kế | — |
| 1.1 | 2026-10-10 | Luồng trận mới: bản đồ màn hình, thêm S10, S11, sửa S4–S7, canvas khu 5–11 | [CR-005](../00-tracking/change-requests.md#cr-005) |
| 1.2 | 2026-10-12 | Trang Minigame trên canvas: khung chơi chung + 4 game MVP | — |
| 1.3 | 2026-10-16 | Trang canvas "Một mình & tài khoản" (khu 12–17): menu mới, Luyện tập, Kiểm tra não, Tài khoản & lịch sử, Bảng xếp hạng, trạng thái chung; bản đồ màn hình, S12–S15; component Tabs, AlertDialog, Skeleton; token `destructive-foreground` | [CR-009](../00-tracking/change-requests.md#cr-009) |
| 1.4 | 2026-10-19 | Canvas khu 18–21: nút Hiệu ứng, vinh danh hồi hộp (lịch hiện, chuyển động, âm thanh), thẻ Giỏi nhất mỗi thể loại, thẻ Thế mạnh trong trận party; mục 6 Đặc tả chi tiết; quy tắc một nguồn giảm chuyển động | [CR-010](../00-tracking/change-requests.md#cr-010) |
| 1.5 | 2026-10-20 | Canvas khu 22: khung chat trong phòng (S16), mục 6.5; token `bubble-mine`; component Sheet, Switch | [CR-011](../00-tracking/change-requests.md#cr-011) |
| 1.6 | 2026-10-21 | Canvas khu 23: chơi với bot (S17 thẻ menu + hộp thoại, ô thêm bot và ô bot ở phòng chờ, huy hiệu máy ở mọi nơi, nhãn "Đấu với máy", bot nhường ghế); bản đồ màn hình, S4, S17, mục 6.6; token `bot`; component Dialog | [CR-016](../00-tracking/change-requests.md#cr-016) |

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
