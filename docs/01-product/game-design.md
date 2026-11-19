# Thiết kế game (GDD)

| | |
| --- | --- |
| Giai đoạn SDLC | Thiết kế — phần luật chơi và cảm giác chơi |
| Phiên bản tài liệu | 1.7 · 2026-11-19 — phòng 12 người, điểm thứ hạng co giãn theo số người ([CR-018](../00-tracking/change-requests.md#cr-018)); công thức điểm + hệ số + game bật/tắt của trận party do quản trị viên chỉnh ([CR-019](../00-tracking/change-requests.md#cr-019)) |
| Liên quan | [SRS](srs.md) (yêu cầu), [UI/UX](ui-ux.md) (màn hình), [Minigame](../04-minigames/README.md) (đặc tả từng game) |
| Cập nhật khi | Đổi luật, điểm, độ khó, chế độ chơi — đổi luật nào cũng phải ghi [CR](../00-tracking/change-requests.md) |

## 1. Khái niệm

Party game trí tuệ trên trình duyệt. Mỗi trận gồm vài vòng ngắn; mỗi vòng là một minigame mà mọi người cùng giải một bộ câu đố trong 45–60 giây, ai đúng nhiều và nhanh nhất thắng vòng. Cảm hứng thể loại từ Big Brain Academy (5 nhóm kỹ năng), nhưng toàn bộ tên, hình, nhân vật là của dự án.

Trụ cột thiết kế: [Tầm nhìn › Trụ cột](vision.md#3-trụ-cột-thiết-kế-design-pillars).

## 2. Vòng lặp chơi (core loop)

```mermaid
flowchart LR
  A["1 · Phòng chờ<br/>nhân vật, sẵn sàng"] --> B["2 · Chủ phòng<br/>chọn số vòng"]
  B --> C["3 · Chọn game<br/>vòng quay / chủ phòng chọn"]
  C --> D["4–5 · Hướng dẫn<br/>+ tự chọn độ khó"]
  D --> E["6 · Đếm ngược<br/>5 giây"]
  E --> F["7 · Chơi<br/>45–60 giây"]
  F --> G["8 · Bảng điểm vòng"]
  G --> H["9 · Cộng điểm trận"]
  H -->|"còn vòng"| C
  H -->|"hết vòng"| I["Vinh danh top 3<br/>kiểu Kahoot"]
  I -->|"Chơi lại"| C
  I -->|"Về phòng chờ"| A
```

Một trận mặc định 3 vòng; mỗi vòng khoảng 1,5 phút kể cả chọn game, hướng dẫn và xem điểm, nên một trận 3 vòng khoảng 5 phút. Cảm hứng nhịp chơi: Pummel Party (mỗi minigame có màn hướng dẫn, ai đọc xong bấm sẵn sàng) và Kahoot (bảng điểm sau mỗi câu, vinh danh top 3).

### Chọn game mỗi vòng

- **Vòng quay may mắn:** mỗi lát là một game chưa chơi trong trận; server quyết định kết quả, mọi máy quay cùng lúc và dừng cùng chỗ.
- **Chủ phòng chọn:** chủ phòng chọn bất kỳ game nào còn lại. Người chơi khác bình chọn để gợi ý ("Cả phòng đang muốn: Cân não · 3 phiếu"); phiếu không ràng buộc chủ phòng và không ảnh hưởng vòng quay.
- **Không lặp:** game đã chơi bị loại khỏi các vòng sau; chơi hết mọi game thì làm mới danh sách.
- **Game bị tắt** ([CR-019](../00-tracking/change-requests.md#cr-019)): game quản trị viên tắt không lên vòng quay, không chọn hay bầu được. Luôn còn ít nhất 2 game (tắt tới mức còn dưới 2 thì coi như bật cả danh mục).

## 3. Chế độ chơi

| Chế độ | Mô tả | Số người | Giai đoạn |
| --- | --- | --- | --- |
| **Đấu nhóm** (chính) | Chủ phòng chọn 1–10 vòng (mặc định 3), mỗi vòng một minigame chọn bằng vòng quay hoặc chủ phòng chọn | 2–12, cùng lúc ([CR-018](../00-tracking/change-requests.md#cr-018)) | GĐ 0–1 |
| **Luyện tập** | Chơi tự do từng minigame, chọn độ khó; client tự chấm nên không lên bảng xếp hạng | 1 | GĐ 1–2 ([CR-009](../00-tracking/change-requests.md#cr-009)) |
| **Kiểm tra não** | 5 game, mỗi nhóm kỹ năng một game, độ khó cố định, server chấm → "Điểm Não" + biểu đồ 5 cạnh. Luật: [mục dưới](#kiểm-tra-não) | 1 | GĐ 1–2 (CR-009) |
| **Chơi với máy** | Phòng Đấu nhóm có bot ngồi ghế trống, 4 mức Dễ · Vừa · Khó · Siêu. Luật: [mục dưới](#bot) | ≥ 1 người thật, tổng ≤ 12 tính cả bot | GĐ 1 ([CR-016](../00-tracking/change-requests.md#cr-016)) |
| **Đấu bóng ma** | Lưu lượt chơi; bạn bè đấu lại bất cứ lúc nào, không cần online cùng lúc | 1 vs bản ghi | GĐ 3 |
| **Bảng xếp hạng** | Điểm Não toàn cầu và từng minigame, lấy từ các lượt Kiểm tra não | — | GĐ 1–2 (CR-009) |
| Thử thách hôm nay, Tìm trận | Có trong bản thiết kế menu, chưa nằm trong phạm vi 1.0 | — | Chờ [CR-003](../00-tracking/change-requests.md#cr-003) |

### Kiểm tra não

Chế độ chơi một mình (UC-14, [CR-009](../00-tracking/change-requests.md#cr-009)), ra **Điểm Não** và điểm 5 kỹ năng, lên bảng xếp hạng. Mọi người chơi cùng một luật để điểm so được với nhau. Cài đặt: `packages/shared/src/brain-test.ts`; server (`BrainTestRoom`) và web dùng chung.

**Luật một lượt**

- 5 game, mỗi nhóm kỹ năng một game, luôn theo thứ tự Nhận diện → Ghi nhớ → Phân tích → Tính toán → Hình dung (`CATEGORIES`).
- Mỗi game: hướng dẫn ngắn → người chơi bấm **Sẵn sàng** → đếm ngược 3 giây → chơi → màn kết quả game giữ 3 giây → sang game kế.
- Server phát seed, giữ đồng hồ và chấm từng câu **y như vòng party** ([§7](#7-tính-điểm)): điểm câu đúng theo `pointsForCorrect`, hệ số và miễn trừ thời gian của từng game, combo trần × 1,5, sai thì khoá 1,5 giây. Chuỗi đúng tính lại từ 0 ở đầu mỗi game.
- **Điểm game** = tổng điểm các câu đúng trong game đó (điểm thô). Server lưu điểm game cùng số câu đúng. Bảng xếp hạng từng minigame dùng thẳng điểm thô này, vì mọi lượt chơi game đó cùng độ khó, cùng thời lượng.

**Độ khó cố định: Thường (`BRAIN_TEST_DIFFICULTY = 1`)**

- Thường là mốc so sánh của CR-006: hệ số × 1 ở mọi game và là mức dành cho người lớn chơi đúng sức, nên điểm chuẩn ở dưới tính thẳng được từ bảng Cân bằng của từng đặc tả.
- Không cho tự chọn độ khó: hệ số độ khó cân điểm *trung bình* giữa các mức, không làm điểm từng người so được với nhau trên bảng xếp hạng.
- Trẻ em vẫn chơi được nhưng điểm thấp hơn người lớn. Bảng xếp hạng không chia theo lứa tuổi; muốn chơi vừa sức thì dùng Luyện tập hoặc phòng party.

**Thời lượng (`BRAIN_TEST_DURATION_MS_BY_CATEGORY`)**

Thời lượng đặt theo nhóm, không theo game. Mỗi nhóm có đúng một game nên lượt nào cũng dài như nhau, dù bốc trúng game nào. Game không bao giờ dài hơn vòng party của nó.

| Nhóm | Thời lượng | Vì sao |
| --- | --- | --- |
| Nhận diện | 30 s | Kẻ lạc đàn ~1,5 s mỗi câu (~17 câu trong 30 s), Bóng của ai ~2 s mỗi câu (~12 câu), Luyện ngắm ~0,7 s mỗi bia (~40 bia) |
| Ghi nhớ | 45 s | Mỗi câu có 3–3,4 s trình chiếu không bấm được; 45 s còn 7–12 câu |
| Phân tích | 40 s | 2,5–3,7 s mỗi câu → 9–13 câu |
| Tính toán | 45 s | ~5 s mỗi câu; 45 s còn ~8 câu |
| Hình dung | 40 s | 2,7–3,3 s mỗi câu → 10–12 câu |

Tổng **200 giây chơi**. Cộng 5 × (≈ 12 s đọc hướng dẫn + 3 s đếm ngược + 3 s kết quả) ra khoảng **4 phút 50 giây** một lượt (`BRAIN_TEST_ESTIMATED_TOTAL_MS`, để hiện ở màn giới thiệu). Vòng party 45–60 s thì 5 game đã hết 5 phút chỉ riêng phần chơi, vượt mục tiêu 4–5 phút.

**Cách chọn game (`pickBrainTestGames(seed, available?)`)**

- Server tạo `seed` cho lượt. Nhóm thứ `i` bốc **đều** một game trong các game đã đăng ký của nhóm, bằng luồng ngẫu nhiên riêng `createRng(deriveSeed(seed, i))`. Cùng seed → cùng 5 game, trên mọi máy.
- Mọi game đã đăng ký đều được vào, kể cả game còn chờ chơi thử. Hiện tại: Nhận diện có Kẻ lạc đàn, Bóng của ai và Luyện ngắm (mỗi game 1/3); Phân tích có thêm Phấn trượt (4 game, mỗi game 1/4); ba nhóm còn lại mỗi game có xác suất 1/3.
- `available` (tuỳ chọn) giới hạn danh sách game. Id lạ, id trùng và thứ tự trong `available` không ảnh hưởng kết quả. Nhóm không còn game nào trong `available` thì bốc từ mọi game của nhóm đó, để lượt luôn đủ 5 game. Mỗi nhóm có luồng riêng nên giới hạn một nhóm không làm đổi game được bốc ở nhóm khác.

**Quy điểm game về điểm kỹ năng (`skillScore`)**

Các game ăn điểm rất khác nhau: ở cùng mức Thường, người chơi bình thường được ~3 350 điểm Kẻ lạc đàn trong 30 s nhưng chỉ ~1 050 điểm Theo dấu ánh đèn trong 45 s. Cộng thẳng điểm thô thì Điểm Não phụ thuộc vào việc bốc trúng game nào. Vì vậy mỗi game có một **điểm chuẩn** (bảng dưới), và với `r = điểm game / điểm chuẩn`:

- `r ≤ 1`: **kỹ năng = 100 × r** (đạt đúng điểm chuẩn = 100).
- `r > 1`: **kỹ năng = 200 − 100 / r**, tăng chậm dần và không vượt 200.
- Làm tròn số nguyên, kẹp trong 0–200. Điểm âm, NaN hay vô cực coi như 0.

| r (so với điểm chuẩn) | 0 | 0,5 | 0,8 | 1 | 1,25 | 1,5 | 2 | 3 | 5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kỹ năng | 0 | 50 | 80 | 100 | 120 | 133 | 150 | 167 | 180 |

Hai nhánh nối trơn tại `r = 1` (cùng độ dốc). Nhánh trên giảm dần vì ba lẽ: một game điểm chuẩn ước sai không kéo lệch cả Điểm Não; một game xuất sắc không lấn át bốn game còn lại; bot giải câu đố (hạn chế NFR-SEC-02) không vượt quá 200 mỗi kỹ năng. Chỉ dùng phép cộng, nhân, chia nên server và trình duyệt ra cùng một số.

**Điểm Não (`computeBrainResult`)**

- **Điểm Não = tổng 5 kỹ năng**, thang **0–1 000** (`BRAIN_SCORE_MAX`). Người lớn chơi bình thường ở cả 5 game được khoảng 500.
- Nhóm không có kết quả (thiếu game) thì kỹ năng đó = 0. Lượt bị huỷ thì không tính (UC-14).
- Kết quả có id game lạ thì bỏ qua. Một nhóm có nhiều kết quả (không xảy ra khi chơi đúng luồng) thì lấy kỹ năng cao nhất.

**Điểm chuẩn từng game (`BRAIN_TEST_REFERENCE_SCORE`) — SỐ TẠM, chốt sau buổi chơi thử**

Điểm chuẩn là điểm kỳ vọng của người lớn chơi đúng sức ở Thường, trong thời lượng Kiểm tra não của game đó. Cách tính: mô phỏng 4 000 lượt mỗi game bằng chính `generate()`, `speedAllowanceMs` và `pointsForCorrect`. Thời gian thao tác mỗi câu dao động đều ±20 % quanh giả định; câu sai tốn thời gian như câu đúng cộng khoá 1,5 s; câu chưa xong khi hết giờ không tính; giữa hai câu có 0,25–0,35 s hiệu ứng (Lật cặp: 0). Kết quả làm tròn tới 50. Hai cột cuối là điểm của người nhanh hơn 30 % và chậm hơn 40 % so với giả định, chia cho điểm chuẩn.

| Nhóm | Game | Thời lượng | Giả định ở Thường (theo đặc tả): thời gian mỗi câu · tỉ lệ sai | Câu · đúng | **Điểm chuẩn** | Nhanh hơn 30 % | Chậm hơn 40 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nhận diện | Kẻ lạc đàn | 30 s | 1,3 s · 4 % (ước, chưa đo; đặc tả › Cân bằng) | 17,4 · 16,7 | **3 350** | × 1,33 | × 0,73 |
| Nhận diện | Bóng của ai | 30 s | 2,0 s · 8 % | 12,2 · 11,2 | **2 050** | × 1,41 | × 0,68 |
| Nhận diện | Luyện ngắm | 30 s | 0,675 s · 2 % (bỏ lỡ tốn trọn 1,5 s; bia mới hiện ngay, 0–0,05 s) | 39,8 · 39,1 | **8 350** | × 1,38 | × 0,72 |
| Nhận diện | Tìm bạn | 30 s | 2,5 s · 7 % | 10,0 · 9,3 | **1 600** | × 1,47 | × 0,66 |
| Nhận diện | Hình to hình nhỏ | 30 s | 1,25 s · 5 % | 18,4 · 17,5 | **3 450** | × 1,34 | × 0,72 |
| Nhận diện | Tráo cốc | 30 s | xem + tráo 3,4 s (miễn trừ) + chọn 0,8 s · 10 % | 6,0 · 5,4 | **900** | × 1,14 | × 0,96 |
| Ghi nhớ | Theo dấu ánh đèn | 45 s | trình chiếu ~3,0 s + nhập 2,3 s · 10 % | 7,2 · 6,4 | **1 050** | × 1,23 | × 0,78 |
| Ghi nhớ | Ai vừa biến mất | 45 s | xem + che 3,4 s + chọn 1,5 s · 10 % | 8,0 · 7,2 | **1 250** | × 1,15 | × 0,84 |
| Ghi nhớ | Lật cặp | 45 s | phần xem của bàn + chạm 1,5 s · 12 % | 12,2 · 10,8 | **1 950** | × 1,22 | × 0,84 |
| Ghi nhớ | Xếp lại tháp | 45 s | xem + che 2,9 s (miễn trừ) + nhập 2,0 s · 10 % | 8,0 · 7,2 | **1 250** | × 1,16 | × 0,82 |
| Ghi nhớ | Nhại nhịp | 45 s | chờ 0,6 s + nghe câu nhịp + gõ lại · ~4 % (mô hình gõ chạy trên `check`) | 8,3 · 7,9 | **1 450** | × 1,05 | × 0,95 |
| Phân tích | Cân não | 40 s | 3,0 s · 8 % | 11,6 · 10,6 | **1 850** | × 1,48 | × 0,65 |
| Phân tích | Đếm khối | 40 s | 3,7 s · 8 % | 9,3 · 8,5 | **1 400** | × 1,53 | × 0,63 |
| Phân tích | Bi rơi đâu | 40 s | 2,5 s · 10 % | 13,2 · 11,9 | **2 100** | × 1,43 | × 0,68 |
| Phân tích | Phấn trượt | 40 s | 1,15 s · 6 % | ~26 · 24,5 | **4 900** | × 1,31 | × 0,74 |
| Phân tích | Chuỗi quy luật | 40 s | 3,0 s · 8 % | 11,3 · 10,4 | **1 750** | × 1,49 | × 0,66 |
| Phân tích | Ô bí ẩn | 40 s | 3,25 s · 8 % | 10,5 · 9,7 | **1 600** | × 1,50 | × 0,65 |
| Phân tích | Cổng luật | 40 s | 1,15 s · 4 % (câu đầu khối luật mới 1,65 s · 10 %) | 24,8 · 23,6 | **4 750** | × 1,32 | × 0,73 |
| Tính toán | Bóng bay số | 45 s | 4,9 s · 6 % | 8,0 · 7,6 | **1 250** | × 1,57 | × 0,61 |
| Tính toán | Chạm đích | 45 s | 5,2 s · 6 % | 7,6 · 7,2 | **1 100** | × 1,61 | × 0,58 |
| Tính toán | Đếm tiền nhanh | 45 s | 5,0 s · 7 % | 7,9 · 7,4 | **1 200** | × 1,59 | × 0,60 |
| Tính toán | Đếm sĩ số | 45 s | trình chiếu ~4,5 s (miễn trừ) + chọn 1,5 s · 8 % | 6,7 · 6,2 | **1 050** | × 1,06 | × 0,84 |
| Tính toán | Giỏ hời nhất | 45 s | 5,3 s · 7 % (miễn trừ 1,5 s) | 7,5 · 7,0 | **1 100** | × 1,62 | × 0,57 |
| Tính toán | Đường số | 45 s | 4,5 s · 8 % | 8,7 · 8,0 | **1 200** | × 1,58 | × 0,60 |
| Hình dung | Xoay hình | 40 s | 2,75 s · 10 % | 12,1 · 10,9 | **1 900** | × 1,45 | × 0,67 |
| Hình dung | Nhìn từ trên | 40 s | 3,25 s · 10 % | 10,4 · 9,4 | **1 550** | × 1,49 | × 0,66 |
| Hình dung | Gấp hộp | 40 s | 3,05 s · 10 % | 11,0 · 9,9 | **1 700** | × 1,48 | × 0,66 |
| Hình dung | Mảnh vừa khít | 40 s | 2,8 s · 8 % | 12,1 · 11,1 | **1 900** | × 1,48 | × 0,67 |
| Hình dung | Nối mạch | 40 s | 2,8 s · 8 % | 12,1 · 11,1 | **1 900** | × 1,47 | × 0,66 |
| Hình dung | Rót vừa vạch | 40 s | bấm 0,55 s + giữ tới vạch (lệch tay σ 50 ms, trễ 20 ms) · ~6 % | 18,8 · 17,6 | **3 450** | × 1,09 | × 0,90 |

Đối chiếu: các con số này khớp điểm vòng 60 s đã ghi trong đặc tả sau khi quy về thời lượng mới (vd. Bi rơi đâu ~3 220 điểm / 60 s ≈ 2 150 / 40 s; Theo dấu ánh đèn ~1 550 / 60 s ≈ 1 160 / 45 s, thấp hơn một chút vì 45 s mất trọn phần câu dở cuối vòng).

- **Thêm game mới:** `pnpm new-game` chèn số giữ chỗ 1 500 kèm `TODO`; game designer mô phỏng lại theo cách trên và thay số trước khi đổi trạng thái game sang ✅. Bỏ sót thì TypeScript báo lỗi (bảng có kiểu `Record<GameId, number>`), test kiểm mọi game đều có điểm chuẩn dương.
- **Chốt sau chơi thử:** đo trung vị điểm game của người lớn ở Thường trong Kiểm tra não, lấy làm điểm chuẩn mới (làm tròn tới 50).
- **Đổi số sau khi đã có người chơi:** đổi điểm chuẩn làm Điểm Não cũ và mới không còn so được; đổi thời lượng, độ khó hay luật chấm thì cả điểm từng game cũng lệch; **thêm game vào một nhóm** cũng đổi cách đo kỹ năng của nhóm đó. Mọi thay đổi loại này phải có CR và **tăng `BRAIN_TEST_RULES_VERSION`**. Cả bảng Điểm Não lẫn bảng từng minigame chỉ xếp các lượt cùng phiên bản luật, nên tăng phiên bản là làm mới cả hai bảng (để đơn giản, kể cả khi chỉ đổi điểm chuẩn); lịch sử cá nhân vẫn giữ.

**Hạn chế đã biết**

- Game Ghi nhớ có pha trình chiếu cố định nên người nhanh kéo điểm lên ít hơn (× 1,15–1,23 so với × 1,33–1,61 ở các game). Kỹ năng Ghi nhớ vì thế dồn quanh 100 hơn các kỹ năng khác. Chấp nhận ở bản này; xem lại khi có số đo thật. Hai game ngoài nhóm Ghi nhớ cũng có pha trình chiếu là Tráo cốc (× 1,14) và Đếm sĩ số (× 1,06), nên điểm chuẩn ước sai ở hai game này ảnh hưởng tới kỹ năng Nhận diện / Tính toán ít hơn các game khác cùng nhóm.
- Nhóm Nhận diện có ba game nhưng điểm chuẩn ước theo cách khác nhau (Kẻ lạc đàn chưa có bảng Cân bằng). Luyện ngắm ăn điểm thô gấp ~2,5–4 lần hai game kia vì mỗi bia ~0,7 s (ngoại lệ đã chốt 2026-10-20); điểm chuẩn riêng của game đã bù phần này trong kỹ năng, nhưng bảng xếp hạng từng minigame của Luyện ngắm không so được với game khác. Cần đối chiếu lại khi có số đo thật.
- Hai game có đáp án đo thời gian phía client (Rót vừa vạch, Nhại nhịp; [ADR 0013](../02-architecture/decisions/0013-client-timed-answers.md)) phân biệt người chơi gần như chỉ bằng độ chính xác (× 1,05–1,09 khi nhanh hơn 30 %), vì thời gian giữ tay / gõ nhịp là bắt buộc. Dung sai chốt sau khi đo trễ chạm trên Android tầm trung.

**Biểu đồ 5 cạnh (màn kết quả)**

- 5 trục theo thứ tự `CATEGORIES`: Nhận diện ở đỉnh trên, rồi theo chiều kim đồng hồ Ghi nhớ, Phân tích, Tính toán, Hình dung. Đầu trục ghi tên nhóm (màu nhóm, §4) và điểm kỹ năng.
- Bán kính **tuyến tính 0 → 200** (`BRAIN_SKILL_MAX`), lưới đồng tâm ở 50, 100, 150, 200. Vòng **100 = chuẩn** vẽ nét đứt, đậm hơn các vòng khác.
- Đa giác lượt này tô màu trong mờ, viền đậm. Có lượt trước thì vẽ thêm đa giác lượt trước chỉ bằng viền nét đứt để so.
- Điểm Não hiện to ở giữa hoặc trên biểu đồ, kèm "/ 1 000".
- Biểu đồ vẽ bằng React + SVG (bất biến 4, ADR 0010), không dùng canvas.

### Bot

Bot là người chơi máy do game server điều khiển, ngồi một ghế trong phòng Đấu nhóm ([CR-016](../00-tracking/change-requests.md#cr-016)). Kế hoạch đầy đủ, luật phòng và giao diện: [Kế hoạch chơi với bot](bot-players.md).

**Bot mô phỏng kết quả, không giải câu đố.** Với mỗi câu, server bốc bot trả lời sau bao lâu và đúng hay sai, rồi chấm qua cùng luật của người: thưởng tốc độ sau miễn trừ, combo, khoá 1,5 giây khi sai, hạn trả lời (bia Luyện ngắm). Vì thế game mới tự có bot, không cần viết hàm giải.

- **Thời gian nghĩ** = thời gian một câu dự kiến của game (`expectedSolveMs`, chép từ bảng Cân bằng của đặc tả) × hệ số của mức × nhiễu log-normal (σ = 0,25, cắt ở ±3σ). Không bao giờ sớm hơn miễn trừ của câu + 0,6 giây phản xạ, để bot không trả lời khi câu còn đang trình chiếu.
- **Đúng hay sai** bốc theo tỉ lệ đúng của mức, **quy theo từng game** (dưới bảng). Bot trả lời quá hạn thì bị chấm sai như người.
- **Tất định:** RNG của bot lấy seed từ (seed vòng, mã bot, số câu), tách khỏi seed câu đố (bất biến 1). Cùng vòng thì bot chơi giống hệt nhau.
- **Mạnh đều ở mọi game so với người chơi của game đó:** chưa có tính cách theo nhóm kỹ năng. Code có registry model (`BOT_MODELS`) để thêm model sau.

**Bốn mức** (`BOT_LEVEL_SPECS` trong `packages/shared/src/bots/levels.ts`). Mốc là người chơi mục tiêu ở độ khó đó: Mầm theo trẻ 7 tuổi, các mức khác theo người lớn chọn đúng sức, giống cách tính hệ số điểm. `T` là thời gian một câu (`expectedSolveMs`), `A` là tỉ lệ đúng (`expectedAccuracy`, 1 − tỉ lệ sai ở bảng Cân bằng; game không khai báo thì 90 %).

| Mức bot | Độ khó câu đố | Thời gian nghĩ | Tỉ lệ đúng ở game có `A` = 90 % | Hệ số sai | Ý đồ |
| --- | --- | --- | --- | --- | --- |
| Dễ | Mầm | T × 1,2 | 78 % | × 2,2 | Trẻ em, người mới thắng được |
| Vừa | Thường | T × 1 | 90 % | × 1 | Đúng bằng người lớn chơi bình thường: thắng khoảng nửa số vòng |
| Khó | Khó | T × 0,9 | 90 % | × 1 | Người đã quen phải tập trung |
| Siêu | Siêu khó | T × 0,8 | 92 % | × 0,8 | Người giỏi cố gắng vẫn thắng được |

**Tỉ lệ đúng quy theo game** (`relativeAccuracy`): bot sai bằng "hệ số sai" lần người chuẩn của game, tức tỉ lệ đúng = 1 − (1 − `A`) × hệ số sai, kẹp trong [0, 99 %]. `A` được kẹp về tối đa 98 % (`BOT_MAX_BASE_ACCURACY`) trước khi nhân, để game khai báo người chuẩn gần như không sai (như Luyện ngắm) vẫn có khoảng cách giữa các mức bot. Ví dụ Lật cặp ở Siêu khó có `A` = 68 % thì bot Siêu đúng 74,4 %; Luyện ngắm ở Siêu khó có `A` = 92 % thì bot Siêu đúng 93,6 %. Cách này giữ thứ tự các mức ở mọi game và không bao giờ vượt 100 %.

**Mô phỏng cân bằng** (`packages/shared/src/bots/balance-sim.test.ts`, 1 000 vòng mỗi game và mỗi mức, chấm bằng chính các hàm điểm của server; người mô phỏng cũng quy tỉ lệ đúng theo game):

- Người chơi chuẩn (Thường, `T`, `A`) thắng bot Vừa 48,6–52,3 % số vòng.
- "Người giỏi" (Siêu khó, 0,8 `T`, sai bằng nửa người chuẩn: 95 % ở game chuẩn 90 %, Lật cặp 84 %) thắng bot Siêu 60–80 % (trung vị 65 %).
- Trẻ 7 tuổi (Mầm, `T` và `A` của Mầm) thắng bot Dễ 89–96 % (trung vị 93 %).
- Người chuẩn thắng bot Khó 18–48 %, bot Siêu 3–25 % số vòng.
- Điểm vòng trung bình so với bot Vừa, 29 game: Dễ 0,48 (0,29–0,66), Khó 1,13 (1,05–1,18), Siêu 1,40 (1,24–1,46).
- Kẻ lạc đàn là ngoại lệ (Khó 0,72, Siêu 0,62 lần Vừa), xem hạn chế dưới.

**Hạn chế đã biết**

- **Kẻ lạc đàn:** thời gian và tỉ lệ đúng là ước lượng chưa đo, và game còn dùng hệ số điểm chung 0,8 / 1 / 1,25 / 1,5. Theo ước lượng, người đúng sức ở Khó, Siêu khó chỉ được ~63 %, ~44 % điểm ở Thường, nên bot Khó và Siêu ở game này được ít điểm hơn bot Vừa. Hệ số riêng đề xuất (Mầm 1, Khó 2,25, Siêu khó 3,85) ở [đặc tả › Cân bằng](../04-minigames/odd-one-out.md#cân-bằng), chờ chủ dự án duyệt.
- Khó chỉ hơn Vừa ~13 % điểm, vì bot Khó sai như người đúng sức ở Khó của từng game. Nếu chơi thử thấy khó phân biệt Khó với Vừa, núm chỉnh là Khó T × 0,85 (mô phỏng: 1,09–1,28 lần Vừa, các tiêu chí khác vẫn đạt).
- Ở game có thời gian trình chiếu thay đổi theo câu (Lật cặp: câu đầu bàn phải xem bàn), `T` là trung bình nên bot đi đều tay hơn người: câu đầu bàn bị chặn ở miễn trừ + 0,6 giây, các câu sau chậm hơn người. Điểm trung bình vẫn sát.

Chỉnh số sau chơi thử: chỉ sửa `BOT_LEVEL_SPECS`, chạy lại mô phỏng, cập nhật bảng trên và bảng 3.1 của kế hoạch. Game chưa khai báo `expectedSolveMs` (hiện không có) dùng ước lượng chung `BOT_BASE_SOLVE_MS` (2,8 giây) × hệ số độ khó của game + miễn trừ; chưa khai báo `expectedAccuracy` thì dùng 90 % (`BOT_BASE_ACCURACY`).

## 4. Năm nhóm kỹ năng

| Nhóm | ID | Rèn | Màu nhận diện (token `--color-<id>`) |
| --- | --- | --- | --- |
| Nhận diện | `identify` | Quan sát, phát hiện khác biệt | Cam `#f2a541` |
| Ghi nhớ | `memorize` | Trí nhớ ngắn hạn, thứ tự | Đỏ hồng `#e85d75` |
| Phân tích | `analyze` | Suy luận, so sánh | Xanh dương `#4d9de0` |
| Tính toán | `compute` | Tính nhẩm, ước lượng | Xanh lá `#3bb273` |
| Hình dung | `visualize` | Xoay, gấp, nhìn không gian | Tím `#7768ae` |

## 5. Danh mục minigame

Đây là **ý đồ thiết kế**. Trạng thái làm và đặc tả chi tiết của từng game nằm ở [Danh mục minigame](../04-minigames/README.md) (bảng đó được script `pnpm new-game` tự cập nhật).

| Nhóm | ID | Minigame | Cách chơi | Khó dần bằng cách | MVP |
| --- | --- | --- | --- | --- | --- |
| Nhận diện | `odd-one-out` | Kẻ lạc đàn | Lưới hình, chạm vào hình khác biệt | Lưới lớn hơn, khác biệt tinh tế hơn | Có |
| Nhận diện | `shadow-match` | Bóng của ai | Chọn bóng đen khớp với đồ vật | Thêm lựa chọn, bóng bị xoay | |
| Nhận diện | `whack-right` | Đập đúng hình | Hình nhô lên từ các lỗ, chỉ đập hình được yêu cầu | Nhanh hơn, thêm hình mồi nhử | |
| Nhận diện | `aim-trainer` | Luyện ngắm | Bia tròn hiện ở chỗ bất kỳ, chạm trúng càng nhanh càng tốt | Bia nhỏ hơn, biến mất nếu chậm, co dần, thêm bia mồi đỏ | |
| Nhận diện | `cup-shuffle` | Tráo cốc | Phấn úp dưới một cốc, các cốc tráo chỗ; hết tráo thì chạm cốc có phấn | Nhiều cốc, tráo nhanh hơn, xoay vòng 3 cốc, giấu 2 vật | |
| Nhận diện | `crowd-search` | Tìm bạn | Thẻ vẽ một bạn (loài, mũ, đồ cầm, kính); chạm đúng bạn đó trong đám đông | Đám đông đông hơn, bạn gần giống chỉ khác 1 chi tiết, điều kiện "không" | |
| Nhận diện | `navon-shapes` | Hình to hình nhỏ | Hình lớn ghép từ nhiều hình nhỏ khác loại; chọn hình lớn (hoặc hình nhỏ) | Hình nhỏ khác hình lớn, khung đổi câu hỏi, nút đổi chỗ | |
| Ghi nhớ | `light-trail` | Theo dấu ánh đèn | Các ô sáng theo thứ tự, bấm lặp lại | Chuỗi dài hơn, bấm ngược | Có |
| Ghi nhớ | `who-vanished` | Ai vừa biến mất | Xem nhóm đồ vật 3 giây, một món biến mất | Nhiều đồ hơn, đồ đổi chỗ | |
| Ghi nhớ | `pair-flip` | Lật cặp | Lật thẻ tìm cặp giống nhau | Nhiều thẻ hơn, thời gian ngắn hơn | |
| Ghi nhớ | `stack-recall` | Xếp lại tháp | Xem tháp khối rồi bị che; chạm khối ở khay theo thứ tự từ dưới lên | Tháp cao hơn, xem ngắn hơn, tầng lặp loại, khay đổi chỗ | |
| Ghi nhớ | `rhythm-echo` | Nhại nhịp | Trống gõ một câu nhịp (mặt trống sáng theo tiếng); gõ lại bằng nửa trái / nửa phải màn hình | Nhiều tiếng hơn, hai mặt trống, chỗ nghỉ, nghịch phách, dung sai hẹp | |
| Phân tích | `balance` | Cân não | Nhìn các cân thăng bằng, chọn vật nặng nhất | Nhiều cân và nhiều vật hơn | Có |
| Phân tích | `cube-count` | Đếm khối | Đếm khối lập phương, kể cả khối bị che | Chồng cao và rộng hơn | |
| Phân tích | `marble-drop` | Bi rơi đâu | Bi lăn qua ống rẽ nhánh, đoán lối ra | Nhiều nhánh, có công tắc đổi hướng | |
| Phân tích | `chalk-arrows` | Phấn trượt | Nhóm mũi tên phấn trượt trên bảng: phấn trắng vuốt theo hướng mũi tên chỉ, phấn vàng vuốt theo hướng trượt | Nhiều mũi tên hơn, đổi màu thường hơn, hai hướng hay ngược nhau, thêm nét tẩy mờ | |
| Phân tích | `bead-pattern` | Chuỗi quy luật | Chuỗi hạt xâu theo quy luật còn một chỗ trống; chọn hạt đúng | Hai thuộc tính đổi độc lập, số chấm tăng đều, hai luật xen kẽ, chỗ trống ở giữa | |
| Phân tích | `latin-cell` | Ô bí ẩn | Lưới hình, mỗi hàng và mỗi cột có đủ mỗi hình một lần; chọn hình cho ô ? | Lưới lớn hơn, có khối, phải suy qua ô trung gian | |
| Phân tích | `rule-gate` | Cổng luật | Từng bạn tới cổng; cho vào hay mời về theo luật vẽ trên bảng | Luật đổi giữa vòng, luật ghép VÀ / HOẶC, luật ẩn | |
| Tính toán | `number-balloons` | Bóng bay số | Nổ bóng theo thứ tự số tăng dần | Số âm, phép tính trên bóng | Có |
| Tính toán | `hit-target` | Chạm đích | Chọn các số cộng lại đúng số đích | Số lớn hơn, thêm phép trừ | |
| Tính toán | `cash-count` | Đếm tiền nhanh | Cộng tổng tờ tiền mệnh giá VNĐ | Nhiều tờ hơn, tính tiền thối | |
| Tính toán | `head-count` | Đếm sĩ số | Các bạn ra vào lớp; cửa đóng thì chọn số bạn còn trong lớp | Nhiều lượt hơn, nhanh hơn, vừa vào vừa ra, thầy giáo đi lẫn | |
| Tính toán | `best-basket` | Giỏ hời nhất | Chọn giỏ đồ ăn vặt nhiều sao nhất mà không lố tiền | Nhiều món hơn, cặp món thêm sao, ưu đãi mua 2 | |
| Tính toán | `number-path` | Đường số | Các đường vẽ sẵn mang phép tính; chọn đường ra đúng số đích | Nhiều đường và phép hơn, ×2, ÷, số âm, đường đan nhau | |
| Hình dung | `rotate-match` | Xoay hình | Hình nào là bản xoay (không phải lật gương) của hình mẫu | Hình phức tạp hơn, góc lẻ | Có |
| Hình dung | `top-view` | Nhìn từ trên | Chọn hình chiếu từ trên xuống của khối 3D | Khối nhiều tầng hơn | |
| Hình dung | `fold-box` | Gấp hộp | Hình trải phẳng nào gấp được thành khối đã cho | Mặt có hoạ tiết cần khớp | |
| Hình dung | `piece-fit` | Mảnh vừa khít | Hộp lưới còn một khoảng trống; chọn mảnh lấp vừa khít (chỉ xoay, không lật) | Mảnh nhiều ô hơn, góc xoay bất kỳ, nhiễu là bản lật gương | |
| Hình dung | `circuit-link` | Nối mạch | Dây từ pin tới bóng đèn còn thiếu một ô; chọn mảnh dây đúng hướng | Lưới lớn hơn, nhánh cụt, mảnh chữ T, thiếu 2 ô | |
| Hình dung | `pour-line` | Rót vừa vạch | Giữ để rót nước vào bình, buông tay khi nước chạm vạch | Dung sai hẹp hơn, bình loe hoặc thót, rót nhanh dần, nửa trên bị che | |

Thứ tự làm: 5 game MVP (mỗi nhóm một game) → thêm 5 game ở GĐ 2 → 7 game cuối ở GĐ 3 (5 game ban đầu + Luyện ngắm, Phấn trượt theo [CR-012](../00-tracking/change-requests.md#cr-012); tổng 17 game) → 14 game của [kế hoạch mở rộng](minigame-expansion.md), hai đợt 7 game ([CR-013](../00-tracking/change-requests.md#cr-013), [CR-014](../00-tracking/change-requests.md#cr-014); tổng 31 game). Minigame hình khối (Đếm khối, Nhìn từ trên, Gấp hộp) vẽ isometric 2D trong Phaser, không dùng engine 3D.

### Quy tắc thiết kế một minigame mới

Một đặc tả minigame chỉ được duyệt khi trả lời "có" cho tất cả:

- [ ] Hiểu cách chơi trong ≤ 5 giây chỉ với một câu hướng dẫn và hình minh hoạ.
- [ ] Một câu giải được trong 1–8 giây ở mức Thường, sau khi trừ miễn trừ thời gian (khớp khung thưởng tốc độ).
- [ ] Có bảng Cân bằng: thời gian giải dự kiến từng mức → hệ số điểm riêng và miễn trừ thời gian của game (CR-006).
- [ ] Mỗi câu có **đúng một** đáp án, kiểm được bằng máy (test 10.000 seed).
- [ ] Sinh câu đố chỉ bằng số nguyên + `createRng()`; không cần dữ liệu ngoài.
- [ ] Bốn mức độ khó khác nhau rõ rệt; mức Mầm chơi được với trẻ 7 tuổi.
- [ ] Chơi được bằng một ngón tay trên khung dọc 720×1280, vùng chạm ≥ 48 px.
- [ ] Không phụ thuộc chữ (ngoài câu hướng dẫn) để người không đọc giỏi vẫn chơi được.
- [ ] Không chỉ phân biệt bằng màu (người mù màu vẫn chơi được).

Mẫu đặc tả: [04-minigames/_template.md](../04-minigames/_template.md).

## 6. Độ khó

Mỗi người **tự chọn độ khó cho từng game** ở màn hướng dẫn trước vòng chơi (mặc định là mức đã chọn lần trước). Mọi người dùng chung seed nhưng bộ sinh nhận thêm tham số độ khó, nên mỗi người thấy câu đố "cùng gốc" nhưng khác độ phức tạp. Điểm được nhân hệ số để cân bằng: bảng dưới là **hệ số mặc định**; từ CR-006 mỗi game được đặt hệ số riêng (ghi ở mục Cân bằng của đặc tả game) tính từ thời gian giải dự kiến từng mức.

**Giám sát của chủ phòng:** chủ phòng thấy độ khó của từng người. Ai chọn khác mức mà nhiều người đang chọn nhất được đánh dấu "lệch"; chủ phòng bấm **Nhắc** để gửi thông báo nhẹ. Đây chỉ là nhắc nhở xã giao, không chặn chơi — vì có khi cả phòng cố ý để trẻ em chơi Mầm.

| Mức | Tên | Hệ số mặc định | Dành cho |
| --- | --- | --- | --- |
| 0 | Mầm | × 0,8 | Trẻ em, người mới |
| 1 | Thường | × 1 | Mặc định |
| 2 | Khó | × 1,25 | Người đã quen |
| 3 | Siêu khó | × 1,5 | Thử thách |

## 7. Tính điểm

Cài đặt ở `packages/shared/src/scoring.ts` (client và server dùng chung). Các con số dưới đây là **công thức chuẩn** (`DEFAULT_SCORING` trong `party-config.ts`): Luyện tập và Kiểm tra não luôn dùng; trận party dùng cấu hình của quản trị viên nếu có ([mục dưới](#cấu-hình-trận-party-của-quản-trị-viên)).

**Điểm một câu đúng** = `(100 × hệ số độ khó của game + thưởng tốc độ) × hệ số combo`, làm tròn.

- **Thưởng tốc độ:** tối đa 50. Trả lời trong ≤ 1,5 giây được trọn 50; từ 8 giây trở đi được 0; ở giữa giảm tuyến tính. Thời gian tính từ lúc câu hiện ra (sau câu sai thì tính từ lúc hết khoá), **trừ đi miễn trừ thời gian** của game: thời gian trình chiếu không bấm được, thời gian tối thiểu cho nhiều lần chạm… (`speedAllowanceMs`, CR-006).
- **Combo:** từ câu đúng thứ 3 liên tiếp, mỗi câu thêm 10% (câu thứ 3: × 1,1; thứ 4: × 1,2…), **tối đa × 1,5** (CR-006).
- **Câu sai:** 0 điểm, chuỗi đúng về 0, khoá thao tác 1,5 giây (trong lúc khoá hiện đáp án đúng), rồi sang câu mới.

Ví dụ (hệ số mặc định, không miễn trừ thời gian — như Kẻ lạc đàn):

| Tình huống | Tính | Điểm |
| --- | --- | --- |
| Thường, trả lời sau 1,2 giây, câu đúng đầu tiên | (100 + 50) × 1 | 150 |
| Mầm, trả lời sau 4,75 giây | (80 + 25) × 1 | 105 |
| Siêu khó, 1 giây, câu đúng thứ 3 liên tiếp | (150 + 50) × 1,1 | 220 |

**Điểm trận** (co giãn theo số người, [CR-018](../00-tracking/change-requests.md#cr-018)): hết mỗi vòng xếp hạng theo điểm vòng; hạng `r` (0 = nhất) trong phòng `N` ghế (tính cả bot và người đang rớt mạng được giữ chỗ) được `max(1, N − r) + thưởng top[r]` điểm trận, thưởng top mặc định 3 / 2 / 1 cho nhất / nhì / ba. Hoà điểm vòng thì cùng hạng, cùng điểm trận. Tổng điểm trận quyết định chung cuộc. Cách này giữ trận hấp dẫn tới vòng cuối: một vòng thắng đậm không quyết định cả trận; phòng đông thì khoảng cách giữa các hạng vẫn đều, ai cũng có ít nhất 1 điểm.

| Số người | Điểm trận hạng 1 → N |
| --- | --- |
| 12 | 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1 |
| 8 | 11, 9, 7, 5, 4, 3, 2, 1 |
| 4 | 7, 5, 3, 1 |
| 2 | 5, 3 |

### Cấu hình trận party của quản trị viên

[CR-019](../00-tracking/change-requests.md#cr-019), kế hoạch: [admin-console.md](admin-console.md). Quản trị viên chỉnh ở trang `/admin` (bảng `party_settings` trên Supabase); **chỉ áp dụng cho trận party**, Luyện tập và Kiểm tra não giữ công thức chuẩn để bảng xếp hạng không lệch.

| Mục chỉnh được | Mặc định | Giới hạn |
| --- | --- | --- |
| Điểm gốc một câu | 100 | số nguyên 10 – 1 000 |
| Thưởng tốc độ tối đa | 50 | số nguyên 0 – 500 |
| Trọn thưởng khi trả lời trong | 1 500 ms | số nguyên 0 – 10 000 |
| Hết thưởng sau | 8 000 ms | số nguyên, lớn hơn mốc trọn thưởng, tối đa 30 000 |
| Combo bắt đầu từ câu đúng liên tiếp thứ | 3 | số nguyên 1 – 10 |
| Mỗi câu combo cộng thêm | 0,1 | 0 – 1 |
| Trần combo | × 1,5 | 1 – 5 |
| Hệ số chung theo độ khó (Mầm, Thường, Khó, Siêu khó) | 0,8 / 1 / 1,25 / 1,5 | mỗi số (0, 5] |
| Ghi đè hệ số của từng game | không có | mỗi số (0, 5] |
| Thưởng top 3 điểm trận | 3 / 2 / 1 | số nguyên 0 – 50 |
| Game bị tắt | không có | luôn còn ≥ 2 game bật |

- **Hệ số của một game** lấy theo thứ tự: ghi đè của quản trị viên → hệ số game khai báo trong đặc tả ([CR-006](../00-tracking/change-requests.md#cr-006)) → hệ số chung của cấu hình. Miễn trừ thời gian, hạn trả lời và khoá 1,5 giây khi sai không chỉnh được.
- **Khi nào áp dụng:** server nạp cấu hình lúc tạo phòng và mỗi lần bắt đầu trận (từ phòng chờ hoặc Chơi lại); cả trận dùng một bản chụp, đổi giữa trận thì trận sau mới áp dụng. Phòng hiện đúng hệ số và điểm thứ hạng của trận đang chơi.
- **Bot** chấm theo cùng cấu hình với người, nhưng thời gian nghĩ của bot vẫn theo bảng Cân bằng của game, không đổi theo cấu hình.
- **An toàn:** server không tin dữ liệu đọc từ DB, kiểm từng mục theo bảng trên; mục nào sai thì về mặc định của mục đó (mốc hết thưởng không lớn hơn mốc trọn thưởng thì cả hai về mặc định). Câu đố và seed không đổi theo cấu hình.

### Nguyên tắc cân bằng

- Một câu ở mức Thường nên mất trung bình 2–4 giây → khoảng 12–20 câu mỗi vòng 45 giây (Kẻ lạc đàn) hoặc 15–25 câu mỗi vòng 60 giây (game mới, CR-006). Ở Siêu khó vẫn phải còn ≥ 8 câu mỗi vòng.
- **Không phạt người chọn mức cao:** người chơi đúng sức ở bất kỳ mức nào được điểm vòng xấp xỉ nhau. Không công thức nào chặn hẳn người lớn chọn mức dễ; phần đó do chủ phòng giám sát (nút Nhắc).
- Con số hệ số và miễn trừ của từng game chốt sau buổi chơi thử đủ 5 game MVP; chỉnh số không cần sửa code, ghi lại ở mục Cân bằng của đặc tả minigame.
- Khoá 1,5 giây khi sai đủ làm bấm bừa thiệt hơn suy nghĩ.

## 8. Nhân vật & phong cách hình ảnh

- **Phong cách:** "bảng phấn lớp học" — nền bảng xanh trong khung gỗ, nội dung trên thẻ giấy dán viền mực, chữ phấn. Quyết định: [ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md). Hệ thống thiết kế: [UI/UX](ui-ux.md).
- **Linh vật:** "Bộ não" giáo sư dẫn dắt ở menu và mẹo chơi.
- **Bạn đồng hành:** 6 nhân vật chibi, người chơi chọn một; được phép trùng nhau, màu avatar phân biệt người chơi.

| ID | Tên | Loài |
| --- | --- | --- |
| `khoi` | Khói | Mèo tai cụp (mặc định) |
| `bo` | Bơ | Cún tai xù |
| `mochi` | Mochi | Thỏ trắng |
| `bap` | Bắp | Gà con |
| `cam` | Cam | Cáo lửa |
| `tron` | Tròn | Gấu trúc |

Mỗi nhân vật có 7 biểu cảm dùng chung (`idle` bình thường, `happy` vui, `sad` buồn, `surprised` ngạc nhiên, `angry` tức, `thinking` suy nghĩ, `win` chiến thắng), hoạt ảnh CSS, tự tắt khi người dùng bật giảm chuyển động.

- **Không dùng 3D** ([ADR 0010](../02-architecture/decisions/0010-drop-3d-2d-lobby-and-podium.md)): phòng chờ và vinh danh dùng nhân vật SVG + hoạt ảnh CSS. Sảnh 3D hiện có trong code sẽ được gỡ.
- **Minigame:** 2D phẳng, mỗi nhóm kỹ năng một màu chủ đạo.

## 9. Âm thanh & cảm giác chơi (game feel)

| Sự kiện | Hình | Âm (GĐ 2) | Rung (GĐ 2) |
| --- | --- | --- | --- |
| Trả lời đúng | Hình nảy lên, cộng điểm bay lên | "ting" ngắn, cao dần theo combo | — |
| Trả lời sai | Rung màn hình, lưới mờ đi, khoá 1,5 giây | "bụp" trầm | Rung ngắn |
| Combo ≥ 3 | Nhãn "Combo ×N" | Âm combo | — |
| 5 giây cuối vòng | Đồng hồ đổi màu, nhấp nháy | Tích tắc | — |
| Cộng điểm trận | Số "+10" bay vào thanh điểm, mũi tên lên/xuống hạng | "Ting" theo từng người | — |
| Vòng quay | Vòng xoay chậm dần, lát thắng phát sáng | Tiếng tạch tạch, chậm dần | — |
| Vinh danh | Lần lượt hạng 3 → 2 → 1 lên bục 2D, pháo giấy, nhân vật biểu cảm `win` | Trống dồn rồi nhạc chiến thắng | — |

Âm thanh trong minigame do Phaser phát; nhạc nền và âm giao diện dùng Howler.js. Nguồn âm thanh: [Asset](../03-guides/assets.md#âm-thanh).

## 10. Giữ chân người chơi (GĐ 3)

- Lịch sử điểm theo từng minigame và biểu đồ 5 kỹ năng.
- Mũ phần thưởng khi lập kỷ lục, đội trên nhân vật ở phòng chờ.
- Đấu bóng ma để thách bạn bè dù không online cùng lúc.

## 11. Lịch sử thay đổi tài liệu

| Phiên bản | Ngày | Thay đổi | CR |
| --- | --- | --- | --- |
| 1.0 | 2026-10-10 | Tách từ kế hoạch dự án; thêm quy tắc thiết kế minigame, ví dụ tính điểm, nhân vật | — |
| 1.1 | 2026-10-10 | Vòng lặp chơi 9 bước, chọn game mỗi vòng, độ khó chọn theo từng game + chủ phòng giám sát, bỏ 3D | [CR-005](../00-tracking/change-requests.md#cr-005) |
| 1.2 | 2026-10-12 | Hệ số điểm theo từng game, miễn trừ thời gian cho thưởng tốc độ, trần combo × 1,5, vòng 60 giây cho game mới, hiện đáp án đúng khi sai | [CR-006](../00-tracking/change-requests.md#cr-006) |
| 1.3 | 2026-10-16 | Luật Kiểm tra não: độ khó cố định Thường, thời lượng theo nhóm, cách chọn game, điểm chuẩn từng game, thang kỹ năng 0–200 và Điểm Não 0–1 000, biểu đồ 5 cạnh; Luyện tập và Bảng xếp hạng lên GĐ 1–2 | [CR-009](../00-tracking/change-requests.md#cr-009) |
| 1.4 | 2026-10-20 | Danh mục §5 thêm 14 game của kế hoạch mở rộng (tổng 31); bảng điểm chuẩn Kiểm tra não thêm 14 dòng, phiên bản luật 4; hạn chế đã biết về game đo thời gian phía client và game có pha trình chiếu ngoài nhóm Ghi nhớ | [CR-013](../00-tracking/change-requests.md#cr-013), [CR-014](../00-tracking/change-requests.md#cr-014) |
| 1.5 | 2026-10-21 | Chế độ Chơi với máy và mục Bot: bot mô phỏng kết quả (không giải câu đố), 4 mức Dễ · Vừa · Khó · Siêu, `expectedSolveMs` theo bảng Cân bằng, kết quả mô phỏng và hạn chế đã biết | [CR-016](../00-tracking/change-requests.md#cr-016) |
| 1.6 | 2026-10-21 | Bot: tỉ lệ đúng tương đối theo `expectedAccuracy` của từng game (giữ tỉ số tỉ lệ sai so với người chuẩn), Dễ nới thành T × 1,2 / 78 %, Kẻ lạc đàn có thời gian ước lượng; hạn chế mới: hệ số điểm chung của Kẻ lạc đàn | [CR-016](../00-tracking/change-requests.md#cr-016) |
| 1.7 | 2026-11-19 | Đấu nhóm 2–12 người; điểm trận theo hạng co giãn `max(1, N − hạng) + thưởng top`; cấu hình trận party của quản trị viên (công thức điểm, hệ số, thưởng top, game bật/tắt), game bị tắt không lên vòng quay | [CR-018](../00-tracking/change-requests.md#cr-018), [CR-019](../00-tracking/change-requests.md#cr-019) |

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
