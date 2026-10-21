# Yêu cầu nghiệp vụ (BRD)

| | |
| --- | --- |
| Giai đoạn SDLC | Discovery → đầu vào cho [SRS](srs.md) |
| Phiên bản tài liệu | 1.3 · 2026-10-21 — BR-10 thêm chơi với bot theo [CR-016](../00-tracking/change-requests.md#cr-016) (UC-23); 1.2 · 2026-10-12 — cân bằng điểm theo [CR-006](../00-tracking/change-requests.md#cr-006) (RULE-06, RULE-07, RULE-08); 1.1 · 2026-10-10 — luồng trận mới theo [CR-005](../00-tracking/change-requests.md#cr-005) |
| Đọc trước | [Tầm nhìn & phạm vi](vision.md) |
| Cập nhật khi | Có nhu cầu nghiệp vụ mới hoặc đổi ưu tiên — luôn đi kèm một [yêu cầu thay đổi](../00-tracking/change-requests.md) |

Tài liệu này trả lời **"người chơi cần gì và vì sao"**, chưa nói tới cách làm. Mỗi yêu cầu nghiệp vụ (BR) được [SRS](srs.md) chi tiết hoá thành use case (UC) và yêu cầu chức năng (FR).

## 1. Bối cảnh

Ai cũng có điện thoại, và nhóm bạn thường đã có sẵn kênh Zalo/Messenger/Discord. Thứ còn thiếu là một trò chơi trí tuệ **mở là chơi được ngay**, ngắn gọn, ai cũng có cơ hội thắng. Phân tích thị trường: [Tầm nhìn › Vấn đề & cơ hội](vision.md#2-vấn-đề--cơ-hội).

## 2. Chân dung người dùng (personas)

### P1 — Minh, nhóm bạn công sở (người dùng chính)

- 26 tuổi, nhân viên văn phòng, chơi game điện thoại thường xuyên.
- Bối cảnh: tụ tập cuối tuần hoặc gọi Discord tối thứ Sáu, 4–6 người.
- Muốn: vào nhanh, ván ngắn, có bảng điểm để "cà khịa" nhau.
- Ghét: phải cài app, đăng ký tài khoản, chờ người soạn câu hỏi.

### P2 — Chị Lan và bé Na, gia đình (người dùng phụ)

- Chị Lan 38 tuổi, bé Na 8 tuổi, thêm ông bà thỉnh thoảng chơi cùng.
- Bối cảnh: buổi tối ở nhà, mỗi người một máy (điện thoại, tablet, laptop).
- Muốn: con chơi được, học được chút gì đó, người lớn không "đè" trẻ con.
- Ghét: chữ quá nhiều, nội dung tiếng Anh, giao diện rối.

### P3 — Tuấn, người luyện não một mình (giai đoạn 3)

- 30 tuổi, thích các app luyện trí nhớ, tính nhẩm.
- Muốn: chơi lúc rảnh 5 phút, thấy mình tiến bộ, so điểm với bạn dù không online cùng lúc.

### Vai trò trong một phòng chơi

| Vai trò | Mô tả |
| --- | --- |
| Khách | Người mở game, chưa vào phòng nào |
| Người chơi | Đã vào phòng |
| Chủ phòng | Người chơi tạo phòng (hoặc được chuyển quyền); chọn game, số vòng, bắt đầu |

## 3. Hành trình người dùng

### J1 — Tối thứ Sáu của Minh

1. Minh mở game trên điện thoại, chọn nhân vật, nhập tên → **Tạo phòng**.
2. Bấm **Sao chép** mã phòng hoặc **Mời bạn** → chia sẻ link qua Zalo nhóm.
3. Bạn bè bấm link, vào thẳng phòng chờ, đổi nhân vật ngay tại đó, bấm **Sẵn sàng**. Minh thấy "Sẵn sàng 4/4".
4. Minh đặt 3 vòng → **Bắt đầu**.
5. Mỗi vòng: Minh bấm **Quay!** trên vòng quay (hoặc chọn game mà cả phòng bình chọn nhiều nhất) → cả nhóm đọc hướng dẫn, mỗi người tự chọn độ khó, bấm **Đã hiểu** → đếm ngược 5 giây → chơi 45 giây, điểm mọi người chạy trên đầu màn hình.
6. Hết vòng: bảng điểm vòng, rồi điểm trận cộng cho từng người, ai lên hạng ai tụt hạng.
7. Hết 3 vòng: vinh danh top 3 kiểu Kahoot → **Chơi lại**.

**Điểm đau cần tránh:** link mở ra phải hỏi lại mã; một người rớt mạng làm hỏng cả trận; bảng điểm không rõ ai thắng.

### J2 — Buổi tối của gia đình chị Lan

1. Chị Lan tạo phòng trên laptop, cả nhà quét **mã QR** trên màn hình (GĐ 1).
2. Ở màn hướng dẫn mỗi game, bé Na chọn độ khó **Mầm**, chị Lan chọn **Khó**. Chị Lan (chủ phòng) thấy độ khó của cả nhà; nếu anh trai bé Na lén chọn Mầm, hệ thống đánh dấu "lệch" và chị bấm **Nhắc**.
3. Bé Na trả lời câu dễ hơn nhưng điểm nhân hệ số thấp hơn → cuộc đua vẫn cân bằng.

### J3 — Tuấn chơi một mình (GĐ 3)

1. Tuấn mở **Kiểm tra não**: 5 game, mỗi nhóm kỹ năng một game.
2. Nhận "Điểm Não" và biểu đồ 5 cạnh, lưu vào lịch sử.
3. Gửi lượt chơi cho bạn để bạn **đấu bóng ma** lúc khác.

## 4. Yêu cầu nghiệp vụ

Mức ưu tiên theo MoSCoW cho bản 1.0: **M** = bắt buộc, **S** = nên có, **C** = có thì tốt, **W** = không làm trong 1.0.

| ID | Yêu cầu nghiệp vụ | Vì sao | Ưu tiên | Persona | Chi tiết ở SRS |
| --- | --- | --- | --- | --- | --- |
| BR-01 | Chơi cùng 2–8 người real-time, không cần cài đặt, không cần tài khoản | Trụ cột "Vào là chơi" | M | P1, P2 | UC-01 → UC-03 |
| BR-02 | Vào phòng bằng mã ngắn hoặc link mời, chia sẻ được qua app nhắn tin, mã QR trên máy tính | Bạn bè ở xa hoặc ngồi chung đều vào được trong 30 giây | M | P1, P2 | UC-03, UC-04 |
| BR-03 | Nội dung là minigame trí tuệ thuộc 5 nhóm kỹ năng; câu đố tự sinh, không ai phải soạn | Khác biệt với Kahoot; chơi mãi không hết đề | M | Tất cả | UC-07, [Minigame](../04-minigames/README.md) |
| BR-04 | Người khác trình độ, lứa tuổi chơi chung vẫn công bằng: mỗi người tự chọn độ khó cho từng game, chủ phòng giám sát được lựa chọn của cả phòng | Trụ cột "Công bằng cho mọi lứa tuổi" | M | P2 | UC-21, FR-VC-06, FR-VC-17, FR-VC-18 |
| BR-05 | Kết quả minh bạch, khó gian lận ở mức chơi với bạn bè | Thắng thua phải "phục" | M | P1 | UC-07, NFR-SEC |
| BR-06 | Chơi mượt trên điện thoại tầm trung và mạng 4G; rớt mạng ngắn không mất trận | Người chơi đa số dùng điện thoại | M | Tất cả | UC-10, NFR-PERF, NFR-REL |
| BR-07 | Trận ngắn (khoảng 5 phút), chủ phòng điều khiển nhịp chơi | Trụ cột "Ngắn, gọn, nhiều vòng" | M | P1 | UC-06, UC-08, UC-09 |
| BR-08 | Giao diện tiếng Việt, có tiếng Anh; sáng/tối | Đối tượng là người Việt, mở rộng sau | M | P2 | UC-11 |
| BR-09 | Có bản sắc riêng: vui, thân thiện, nhân vật đáng yêu | Dễ nhớ, trẻ em thích | S | P2 | UC-01, [UI/UX](ui-ux.md) |
| BR-10 | Có lý do quay lại: chơi một mình, chơi với bot khi thiếu bạn, lịch sử điểm, đấu bất đồng bộ với bạn | Giữ chân sau lần chơi đầu | S | P3 | UC-13 → UC-16, UC-23 ([CR-016](../00-tracking/change-requests.md#cr-016)) |
| BR-11 | Cảm giác "game thật": phòng chờ sinh động, vinh danh người thắng kiểu Kahoot, âm thanh, cài lên màn hình chính — nhẹ, không 3D | Trải nghiệm đáng nhớ | S | P1 | UC-05, UC-08, NFR-UX |
| BR-12 | Chi phí vận hành gần 0 | Dự án cá nhân, không có doanh thu | M | Chủ dự án | NFR-COST |
| BR-13 | Không vi phạm sở hữu trí tuệ | Có thể công khai mà không bị gỡ | M | Chủ dự án | NFR-LEGAL |
| BR-14 | Chơi với người lạ, thử thách hằng ngày, bảng xếp hạng | Mở rộng cộng đồng | W (xét ở [CR-003](../00-tracking/change-requests.md#cr-003)); riêng bảng xếp hạng là S từ [CR-009](../00-tracking/change-requests.md#cr-009) | P1, P3 | UC-17 → UC-19 |
| BR-15 | Mỗi vòng có nghi thức rõ ràng kiểu party game: chọn game (vòng quay hoặc chủ phòng chọn theo gợi ý cả phòng), hướng dẫn trước khi chơi, đếm ngược, cộng điểm sau mỗi vòng | Ai cũng hiểu game trước khi chơi; hồi hộp, vui hơn ([CR-005](../00-tracking/change-requests.md#cr-005)) | M | P1, P2 | UC-20, UC-21, UC-08 |

## 5. Quy tắc nghiệp vụ

Các luật này là "hợp đồng" của game; đổi luật nào phải ghi CR và cập nhật [Thiết kế game](game-design.md).

| ID | Quy tắc |
| --- | --- |
| RULE-01 | Một phòng tối đa 8 người; chỉ vào được khi phòng đang ở sảnh (chưa chơi). |
| RULE-02 | Mã phòng 4 ký tự, không dùng ký tự dễ nhầm (0/O, 1/I/L). |
| RULE-03 | Chỉ chủ phòng được đặt số vòng (1–10), bắt đầu trận, quay vòng quay hoặc chọn game, bắt đầu vòng và đưa cả phòng về phòng chờ. |
| RULE-04 | Chủ phòng rời phòng thì quyền chuyển cho người kế tiếp. |
| RULE-05 | Mọi người cùng một bộ câu đố (cùng seed) nhưng mỗi người tự chọn độ khó cho từng game; chủ phòng xem được độ khó của cả phòng và nhắc được người chọn lệch. |
| RULE-06 | Câu đúng: 100 điểm × hệ số độ khó + thưởng tốc độ tối đa 50. Hệ số mặc định Mầm 0,8 · Thường 1 · Khó 1,25 · Siêu khó 1,5; mỗi game được đặt hệ số riêng để người chơi đúng sức ở mức nào cũng được điểm vòng xấp xỉ nhau (không phạt người chọn mức cao). Thời gian không thao tác được (trình chiếu, số lần chạm tối thiểu) không bị tính vào thưởng tốc độ. |
| RULE-07 | Từ câu đúng thứ 3 liên tiếp, mỗi câu được thêm 10% (combo), tối đa × 1,5. |
| RULE-08 | Câu sai không trừ điểm nhưng khoá thao tác 1,5 giây, trong lúc khoá hiện đáp án đúng, rồi sang câu mới. |
| RULE-09 | Hết vòng: xếp hạng theo điểm vòng → điểm trận 10, 8, 6, 5, 4, 3, 2, 1. Tổng điểm trận quyết định chung cuộc. |
| RULE-10 | Người rớt mạng được giữ chỗ 45 giây; quá thời gian thì bị xoá khỏi phòng. |
| RULE-11 | Hai người được chọn trùng nhân vật; màu avatar không trùng (server tự đổi sang màu trống). |
| RULE-12 | Server là trọng tài duy nhất về điểm, đồng hồ và thứ tự vòng. |
| RULE-13 | Trong một trận, game đã chơi không xuất hiện lại cho tới khi đã chơi hết mọi game. |
| RULE-14 | Bình chọn game chỉ là gợi ý cho chủ phòng, không ảnh hưởng vòng quay; mỗi người 1 phiếu mỗi vòng. |
| RULE-15 | Kết quả vòng quay do server quyết định; mọi máy thấy cùng một kết quả. |
| RULE-16 | Trận chỉ bắt đầu khi có ít nhất 2 người và tất cả đã sẵn sàng; mỗi vòng tự bắt đầu sau 20 giây ở màn hướng dẫn. |

## 6. Tiêu chí chấp nhận ở mức nghiệp vụ

Bản 1.0 được coi là đạt khi chủ dự án tự kiểm được tất cả các ý sau trong một buổi chơi thật với ít nhất 4 người:

- [ ] Người chưa từng chơi vào được phòng từ link trong ≤ 30 giây (BR-01, BR-02).
- [ ] Chơi trọn trận 3 vòng qua 4G, không ai bị rớt khỏi phòng (BR-06).
- [ ] Một trẻ em ở mức Mầm có thể đứng trên một người lớn ở mức Khó trong ít nhất một vòng (BR-04).
- [ ] Ai cũng hiểu vì sao mình được hạng đó khi nhìn bảng kết quả (BR-05, BR-07).
- [ ] Đủ 15 minigame, mỗi game có hướng dẫn ngắn bằng tiếng Việt và tiếng Anh (BR-03, BR-08).
- [ ] Chi phí hosting tháng đầu ≤ 1 USD (BR-12).

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
