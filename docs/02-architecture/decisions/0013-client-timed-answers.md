# ADR 0013: Đáp án đo thời gian phía client

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-20
- Bổ sung cho: [ADR 0003](0003-seeded-deterministic-puzzles.md) (server vẫn sinh lại câu và chấm lại; ADR này nói phần đáp án là một thời lượng do trình duyệt đo)
- Liên quan: [CR-014](../../00-tracking/change-requests.md#cr-014), [kế hoạch mở rộng minigame › mục 5](../../01-product/minigame-expansion.md#5-việc-chung-phải-làm-khi-danh-mục-lớn-lên), NFR-SEC-02 ([SRS](../../01-product/srs.md)), tiền lệ Luyện ngắm ([CR-012](../../00-tracking/change-requests.md#cr-012))

## Bối cảnh

Hai minigame của CR-014 có đáp án là **thời gian do trình duyệt đo**, không phải một lựa chọn:

- **Rót vừa vạch** (`pour-line`): `Answer = holdMs`, số nguyên ms giữ tay. Server tính lại mức nước bằng `pourLineLevelAt(puzzle, holdMs)` và so với dải vạch ([đặc tả › Cách chấm](../../04-minigames/pour-line.md#cách-chấm)).
- **Nhại nhịp** (`rhythm-echo`): `Answer = { side, atMs }[]`, `atMs` tính từ lần gõ đầu. Server so mặt trống từng tiếng và **khoảng cách** giữa hai tiếng liền nhau với dung sai `tolMs` ([đặc tả › Cách chấm](../../04-minigames/rhythm-echo.md#cách-chấm)).

Server không thấy tay người chơi. Muốn chấm đúng cho người thật trên điện thoại thì phải đo ở client. Câu hỏi của ADR: tin số client gửi tới mức nào, đo thế nào cho công bằng giữa các máy, dung sai bao nhiêu là đủ, và server có phải đổi gì không.

Ràng buộc có sẵn: client đã biết seed nên tự giải được mọi câu (hạn chế đã biết NFR-SEC-02, ADR 0003, ADR 0011). Luyện ngắm (`aim-trainer`) đã là tiền lệ: server tin toạ độ chạm client gửi, chỉ kiểm hạn trả lời `answerWindowMs` bằng đồng hồ server.

## Quyết định

Client đo thời lượng bằng `event.timeStamp` của chính các sự kiện nhập, gửi một tin `answer` mỗi câu qua `answer: z.unknown()` + `isAnswer` của game; server sinh lại câu bằng `generate()` và chấm bằng `check()` trên đúng số client gửi, **không đổi giao thức, `judgeAnswer`, `AnswerJudge`, `PartyRoom` hay `BrainTestRoom`**.

### Mức tin cậy: ngang Luyện ngắm

- Server tin số ms client gửi như tin toạ độ của Luyện ngắm. Server chỉ kiểm **hình dạng và miền** (`isAnswer`) rồi chấm bằng luật của game.
- Không thêm lỗ hổng mới. Bot biết seed gửi thẳng `idealHoldMs` hay `hits` là đúng, như gửi đúng chỉ số ở mọi game khác. Không có cách gian lận nào bằng số đo thời gian mà lợi hơn con bot đó.
- Chặn chung vẫn giữ như mọi game: chỉ server tính điểm, tối đa `MAX_ANSWERS_PER_SECOND` (10) đáp án/giây, bỏ đáp án sau `endsAt + LATE_ANSWER_GRACE_MS`, khoá 1,5 s sau câu sai.
- Vì server chấm trên chính số client gửi bằng cùng hàm (`check`, và `rhythmEchoFirstMiss` cho phản hồi tức thì), client và server **luôn cùng kết quả**. Không có chuyện máy báo ✓ còn server chấm ✗ do mạng.

### Cách đo ở client

- Lấy `event.timeStamp` của sự kiện DOM gốc: Rót dùng `pointer.upTime − pointer.downTime` (Phaser 4 gán hai trường này từ `event.timeStamp`) hoặc `KeyboardEvent.timeStamp`. Nhại nhịp dùng `pointerdown` / `keydown`, `atMs = Math.round(t_k − t_0)`.
- **Không đếm khung hình, không dùng giờ vòng lặp game** (`this.time.now`, `delayedCall`, `performance.now()` trong handler): các giờ đó dính độ giật khung hình 16–50 ms và khác nhau giữa máy 30, 60 và 120 Hz.
- Vẽ dùng `performance.now()`, cùng gốc giờ với `event.timeStamp`. Ví dụ Rót vẽ mặt nước bằng `pourLineLevelAt(puzzle, performance.now() − lúc nhấn)`, chỉ để hiển thị.
- Client làm tròn ms và kẹp trước khi gửi: Rót gửi `Math.min(holdMs, POUR_LINE_MAX_HOLD_MS)` và tự buông ở `fullMs`. Nhại nhịp gửi ngay ở lần gõ sai đầu tiên hoặc khi quá hạn tiếng kế, nên mảng không bao giờ dài hơn số tiếng của câu (≤ 6).

### Chấm thời lượng và khoảng cách, không chấm thời điểm

- **Hai đầu của mỗi phép đo dùng cùng một đồng hồ**, nên phần trễ cố định của máy bị trừ ở cả hai đầu: đường chạm (30–100 ms), trễ màn hình, trễ loa (tai nghe Bluetooth 150–300 ms). Máy chậm hay tai nghe Bluetooth không bị thiệt.
- Nhại nhịp chỉ chấm khoảng giữa hai tiếng liền nhau. Chấm thời điểm tuyệt đối thì phải so giờ gõ với giờ phát tiếng, tức là dính trễ loa và trễ hình khác nhau ở mỗi máy (hàng trăm ms, lớn hơn hẳn dung sai 80 ms). Thêm nữa, một lần chạm lệch chỉ làm sai hai khoảng kề nó, không kéo sai mọi tiếng sau. Hệ quả có chủ ý: không kiểm trôi nhịp cộng dồn, cả câu hơi nhanh hay hơi chậm vẫn đúng.
- Không chấm theo đồng hồ server: lệch mạng dao động 20–200 ms (4G, WebSocket trên TCP có lúc trễ cả giây khi gửi lại gói), lớn hơn dung sai.

### Dung sai và cách quy đổi

Phần còn lại sau khi trễ cố định đã triệt tiêu là **trễ dao động**: trễ nhả tay **16–50 ms** trên điện thoại (cảm ứng quét 60–120 Hz, khung hình 16 ms), cộng phần người chơi thấy hình muộn hơn thật một chút (một lệch đều, người chơi tự quen). Quy tắc: **dung sai tính ra ms phải lớn hơn trễ dao động lớn nhất của phép đo**, phần còn lại dành cho độ chính xác của tay người.

**Rót vừa vạch:** tốc độ dâng tại vạch là `flow / vessel[lát]` đơn vị mức nước mỗi ms, nên nửa khoảng đúng ≈ `tol × vessel[lát] / flow` ms và 50 ms trễ quy ra `50 × (2·tol + 1) / (độ rộng khoảng đúng)` đơn vị mức nước.

| Mức | Dung sai `tol` | Khoảng đúng tối thiểu (chốt) | Nửa khoảng nhỏ nhất | 50 ms trễ quy ra (tối đa) | Dung sai ÷ trễ 50 ms |
| --- | --- | --- | --- | --- | --- |
| Mầm | ±80 (±8 %) | 300 ms (đo ≥ 450) | ≥ 150 ms | 18 đơn vị (1,8 %) | ≥ 4,4 lần |
| Thường | ±50 (±5 %) | 160 ms (đo ≥ 181) | ≥ 80 ms | 28 đơn vị (2,8 %) | ≥ 1,8 lần |
| Khó | ±50 (±5 %) | 140 ms | ≥ 70 ms | 36 đơn vị (3,6 %) | ≥ 1,4 lần |
| Siêu khó | ±70 (±7 %) | 200 ms (trần 450) | ≥ 100 ms | 35 đơn vị (3,5 %) | ≥ 2,0 lần |

Ở mọi mức, nửa khoảng đúng nhỏ nhất (≥ 70 ms) lớn hơn trễ nhả tay lớn nhất (50 ms), nên người chơi điện thoại không bị chấm oan vì phần cứng.

**Nhại nhịp:** mỗi khoảng có hai đầu, mỗi đầu lệch tối đa một chu kỳ quét cảm ứng (≤ 8–17 ms). Đèn nháy cho người tắt tiếng lệch ≤ 17 ms ở 60 Hz; tiếng trống xếp lịch theo đồng hồ `AudioContext`, sai số dưới 1 ms. Tổng lại ước ≤ 20–30 ms mỗi khoảng trên Android tầm trung, tức ≤ 40 % dung sai hẹp nhất.

| Mức | `tolMs` mỗi khoảng | Khoảng ngắn nhất | Dung sai ÷ trễ 30 ms |
| --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | ±150 | 500 ms | 5 lần |
| Thường | ±120 | 400 ms | 4 lần |
| Khó | ±100 | 260 ms | 3,3 lần |
| Siêu khó | ±80 | 260 ms | 2,7 lần |

Khung nhận của hai độ dài nốt cách nhau ≥ 60 ms (khoảng ngắn nhất và chênh giữa hai loại khoảng đều ≥ `2·tolMs + 60`). Bộ lọc chạm nảy 100 ms nhỏ hơn khoảng nhỏ nhất còn được nhận (≥ 160 ms).

Các số trễ là **giả định**. Phải đo lại trên một máy Android tầm trung trước khi chốt (rủi ro của kế hoạch). Nếu cần nới thì nới **cho mọi người** theo núm chỉnh trong đặc tả, không chia dung sai theo thiết bị.

### Phía server: không cần đổi gì

Đã soát `protocol.ts`, `answer-judge.ts` (shared), `AnswerJudge.ts`, `PartyRoom.ts`, `BrainTestRoom.ts` (hai phòng chấm chung qua `AnswerJudge` → `judgeAnswer`).

1. **Kích thước tin `answer` đã có giới hạn ở hai lớp.**
   - *Tầng truyền tải:* `WebSocketTransport` của Colyseus 0.18 (`@colyseus/ws-transport`, transport mặc định của `@colyseus/tools`) đặt `maxPayload` 4 KB. `app.config.ts` không ghi đè. Tin lớn hơn bị `ws` từ chối và đóng kết nối trước khi giải mã. Giới hạn này chung cho mọi tin, không riêng hai game.
   - *Game:* `isAnswer` của Nhại nhịp kiểm `Array.isArray` và độ dài 1–6 **trước khi** duyệt phần tử, rồi kiểm từng phần tử (mảng thưa, `side` lạ, `atMs` không nguyên, âm, > 60 000 hay giảm dần đều bị từ chối). `isAnswer` của Rót chỉ nhận số nguyên 0–10 000.
   - Đáp án lớn nhất hợp lệ (6 lần gõ) chỉ khoảng 150 byte msgpack. Đáp án sai miền bị `judgeAnswer` bỏ qua sau khi đã đếm vào giới hạn 10 đáp án/giây.
   - Không cần schema zod riêng cho từng game.
2. **Không kiểm "đồng hồ server đã đủ cho số ms giữ tay".** Phép kiểm sẽ là: Rót bỏ đáp án nếu `now − shownAt < holdMs − LATE_ANSWER_GRACE_MS`; Nhại nhịp chặn đáp án đúng tới sớm hơn `shownAt + listenMs + span − (N−1)·tolMs`. Đồng ý với hai designer là không làm:
   - Nó chỉ chặn bot ngây thơ gửi ngay. Bot chờ đủ `idealHoldMs` vẫn qua, và vẫn thắng người thật vì luôn đúng.
   - `shownAt` của server là lúc đáp án trước **tới server**. Client thì sang câu kế ngay khi tự chấm. Nên thời gian server đo = thời gian thật + (trễ tin này − trễ tin trước). Khi mạng giật (chuyển trạm 4G, TCP gửi lại gói làm một tin trễ 0,5–1 s rồi các tin sau tới dồn), người thật có thể bị coi là "nhanh quá".
   - Hậu quả chặn oan rất nặng. `judgeAnswer` bỏ qua thì không gửi `answerResult`; client đã sang câu kế nên `index` lệch `progress` của server, và **mọi đáp án sau bị bỏ qua tới hết vòng** (chỉ khớp lại khi nối lại). Chấm sai thay vì bỏ qua thì không lệch câu, nhưng vẫn phạt oan người thật.
3. **`speedAllowanceMs` không bị lạm dụng.**
   - Miễn trừ (`holdMinMs` của Rót, `listenMs + span` của Nhại nhịp) tính từ câu **server tự sinh lại** (`gameSpeedAllowanceMs`), không từ số client gửi.
   - `answerMs` dùng để tính thưởng là `now − shownAt` theo đồng hồ server. Số ms client đo chỉ quyết định đúng hay sai, **không bao giờ vào công thức điểm**.
   - Miễn trừ chỉ bỏ phần phạt chậm. Thưởng tốc độ vẫn có trần `MAX_SPEED_BONUS` (50, đạt khi còn ≤ 1,5 s sau miễn trừ). Người chơi thật vốn đã gần như luôn được trọn 50 điểm, nên trả lời sớm hơn thời gian vật lý (chỉ bot làm được) không cho thêm điểm mỗi câu. Bot chỉ lợi ở số câu mỗi vòng, như bot ở mọi game, và vẫn bị chặn ở 10 đáp án/giây.
   - Hệ số cao của Nhại nhịp (2,45 / 2,7) làm bot được nhiều điểm hơn mỗi câu, nhưng không đổi kết luận: bot biết seed đã thắng tuyệt đối ở mọi game.
4. **Không khai báo `answerWindowMs`** ở cả hai game: không có vật biến mất. Chờ lâu trước khi nhấn hay trước lần gõ đầu chỉ mất thưởng tốc độ, không làm đúng thêm.
5. Chi phí CPU không đổi: mỗi đáp án được chấm gọi `generate()` một lần, như mọi game, và bị giới hạn 10 lần/giây mỗi người.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Client đo bằng `event.timeStamp`, gửi thời lượng/khoảng; server chấm lại bằng `check` và tin số đo (chọn) | Không đổi giao thức; trễ cố định của máy tự triệt tiêu; không phụ thuộc mạng; client và server luôn cùng kết quả; một tin mỗi câu | Server không xác minh được người chơi thật sự giữ/gõ (bot biết seed, như NFR-SEC-02) |
| Server đo theo giờ nhận tin (gửi tin lúc nhấn/buông, mỗi lần gõ một tin) | Không tin số client | Lệch mạng 20–200 ms, lớn hơn dung sai 80–100 ms; tốn 2 hoặc N tin mỗi câu; người mạng yếu thiệt; client không chấm ngay được |
| Client đo + server kiểm thời gian vật lý tối thiểu | Chặn bot gửi ngay | Bot chờ đủ vẫn qua; chặn oan khi mạng giật; bỏ qua làm lệch `progress` cả vòng |
| Chấm thời điểm tuyệt đối (Nhại nhịp: so giờ gõ với lịch phát tiếng) | Bắt được cả trôi nhịp | Dính trễ loa/màn hình khác nhau mỗi máy (Bluetooth 150–300 ms); phải đồng bộ đồng hồ âm thanh với đồng hồ nhập; người dùng tai nghe bị thiệt |
| Đo bằng đếm khung hình / giờ vòng lặp game | Dễ viết trong Phaser | Giật khung 16–50 ms; máy 30 Hz và 120 Hz cho số khác nhau; chấm oan ngẫu nhiên |
| Client gửi kèm hiệu chỉnh trễ hoặc loại thiết bị để nới dung sai | Có thể công bằng hơn với máy chậm | Client tự khai nên tự nới được; chấm khoảng đã triệt tiêu trễ cố định nên không cần |
| Client gửi dấu vết đầy đủ (mọi sự kiện pointer) để server phân tích | Có dữ liệu để soát sau | Bot giả dấu vết dễ như giả một số; tốn băng thông; phức tạp, không chặn được gì thêm |

## Hệ quả

- **Dễ hơn:** hai game mới chỉ là code trong `packages/shared/src/games/<id>/` và `apps/web/src/games/<id>/`. Server, giao thức và luật chấm chung giữ nguyên. Người dùng máy chậm, mạng chậm hay tai nghe Bluetooth chơi ngang người khác.
- **Khó hơn / chấp nhận:**
  - Server không tự kiểm được người chơi có thật sự giữ đúng hay gõ đúng nhịp. Đây là hạn chế đã biết NFR-SEC-02, áp dụng cả cho Kiểm tra não (bảng xếp hạng), như ADR 0011 đã ghi.
  - Sai cách đo ở client (vd. dùng giờ khung hình) không bị server phát hiện mà chỉ làm người chơi bị chấm oan. QA phải soát cách đo trong scene.
  - Dung sai dựa trên số trễ giả định, phải đo trên máy thật.
- **Quy tắc cho game đo thời gian sau này:**
  1. Đo bằng `event.timeStamp`, hai đầu cùng một đồng hồ.
  2. Chấm thời lượng hoặc khoảng cách, không chấm thời điểm tuyệt đối.
  3. Mọi thời gian là số nguyên ms.
  4. `isAnswer` kẹp miền (số nguyên, có trần) và kiểm độ dài mảng trước khi duyệt.
  5. Dung sai tính ra ms lớn hơn trễ dao động lớn nhất (≥ 50 ms cho thời lượng giữ tay).
  6. `speedAllowanceMs` bằng phần thời gian bắt buộc, tính từ câu đố.
  7. Chỉ khai báo `answerWindowMs` khi có vật biến mất.
- **Khi nào xem lại:**
  - Bảng xếp hạng Kiểm tra não bị lạm dụng, hoặc mở cho người lạ (cùng điều kiện ở ADR 0003/0011): thêm kiểm tra hợp lý **sau lượt**, vd. không lưu lên bảng xếp hạng lượt có câu đúng tới sớm hơn thời gian vật lý tối thiểu trừ một biên rộng (~1 s). Không chặn trong lúc chơi.
  - Có game cần chấm thời điểm tuyệt đối hoặc thời gian phản xạ (hiện kích thích → chạm): trễ cố định không còn triệt tiêu, cần ADR mới.
  - Đo trên máy thật thấy trễ dao động > 50 ms (Rót) hoặc > 30 ms mỗi khoảng (Nhại nhịp): nới dung sai theo núm chỉnh trong đặc tả.
  - Nâng Colyseus: kiểm lại mặc định `maxPayload` của transport, hoặc đặt tường minh.
