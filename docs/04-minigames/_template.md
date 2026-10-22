# <Tên minigame> (`<id>`)

- Nhóm: Nhận diện | Ghi nhớ | Phân tích | Tính toán | Hình dung
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; đổi thì ghi lý do ở mục Cân bằng)
- File: `packages/shared/src/games/<id>/` (logic + test), `apps/web/src/games/<id>/` (scene + chữ hiển thị)
- Bản mẫu: (link artboard trên canvas, nếu có)

## Cách chơi

Một đến hai câu người chơi đọc là hiểu.

## Màn hướng dẫn

Nội dung cho màn hướng dẫn trước mỗi vòng (UC-21, canvas khu 7). Viết bằng tiếng Việt; frontend-dev dịch sang tiếng Anh trong `locales.ts`.

- **Cách chơi** (tối đa 3 bước, mỗi bước ≤ 8 từ):
  1. …
  2. …
  3. …
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím (nếu có, ghi rõ phím).
- **Hình minh hoạ:** mô tả một khung hình tĩnh cho thấy cách chơi (vẽ gì, đánh dấu chỗ nào).
- **Câu nhắc lúc đếm ngược** (≤ 6 từ):
- **Câu nhắc theo mức** (tuỳ chọn, ≤ 8 từ): chỉ cho mức đổi luật hoặc có bẫy cần nhớ, vd. Siêu khó: "Nhớ đèn, chạm ngược lại!". Thay câu nhắc chung lúc đếm ngược, hiện dưới ô chọn độ khó khi chọn mức đó.

## Câu đố & đáp án

- `Puzzle`: dữ liệu cần để vẽ câu đố.
- `Answer`: kiểu dữ liệu client gửi lên (một lần cho mỗi câu).

## Cách sinh câu đố

Thuật toán bằng lời: sinh gì trước, sinh gì sau, vì sao chắc chắn có đúng một đáp án. Chỉ dùng số nguyên và `createRng()`.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | | |
| Thường | | |
| Khó | | |
| Siêu khó | | |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng.
- …

Các điều trên phải được kiểm bằng test ≥ 10.000 seed × 4 độ khó.

## Cân bằng

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ sai | Số câu dự kiến mỗi vòng |
| --- | --- | --- | --- |
| Mầm | | | |
| Thường | | | |
| Khó | | | |
| Siêu khó | | | |

Ở Siêu khó vẫn phải còn ≥ 8 câu mỗi vòng.

**Thời gian và tỉ lệ đúng cho bot** ([CR-016](../00-tracking/change-requests.md#cr-016)), khai báo trong định nghĩa game, chép từ bảng trên. Mầm theo trẻ 7 tuổi, các mức khác theo người lớn:

- `expectedSolveMs` (ms, trung vị hoặc giữa khoảng): phải **cộng cả trình chiếu và hiệu ứng chuyển câu** (server đo từ lúc trả lời câu trước), không tính khoá khi sai. Thời gian giảm khi lên mức (Thường → Siêu khó) thì ghi lý do ở đây.
- `expectedAccuracy` (0–0,98] = 1 − tỉ lệ sai ở bảng trên (số lớn hơn 0,98 bị bot kẹp về 0,98). Không tăng từ Thường lên Siêu khó. Bot quy tỉ lệ đúng của mức theo số này; không khai báo thì bot coi như 90 %.

| Mức | `expectedSolveMs` | `expectedAccuracy` | Cách tính |
| --- | --- | --- | --- |
| Mầm | | | |
| Thường | | | |
| Khó | | | |
| Siêu khó | | | |

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong định nghĩa game):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | | | |
| Thường | 1 | | |
| Khó | | | |
| Siêu khó | | | |

- `difficultyMultiplier`: chọn sao cho người chơi đúng sức ở mỗi mức được điểm vòng xấp xỉ người lớn ở Thường (mô phỏng bằng chính `generate()` và công thức điểm của server: trần combo × 1,5, khoá 1,5 giây). Mầm = **min(giá trị mô phỏng cho trẻ 7 tuổi, 1)**. Hệ số không giảm khi lên mức.
- `speedAllowanceMs`: số ms trừ khỏi thời gian trả lời trước khi tính thưởng tốc độ (trọn 50 điểm khi ≤ 1,5 giây, hết từ 8 giây): thời gian trình chiếu không bấm được, thời gian tối thiểu cho nhiều lần chạm… Không cần thì ghi "không khai báo" và lý do.
- Ghi kết quả mô phỏng: điểm vòng mỗi mức so với người lớn ở Thường, và người lớn chọn Mầm được bao nhiêu %.

## Ghi chú cho FE

Bố cục trong khung 720×1280, vùng chạm (≥ 48 px), các trạng thái (đang hiện câu, chờ nhập, đúng, sai/khoá), hiệu ứng, âm thanh dự kiến.

### Hiện đáp án đúng khi sai

Trả lời sai thì trong lúc bị khoá (thời gian lấy từ `bridge.unlockDelay`) phải cho thấy đáp án đúng (CR-006): đánh dấu gì, ở đâu, chỗ chạm sai hiện thế nào. Không đặt đáp án ở dải giữa trên cùng khung mà huy hiệu khoá che (tới y ≈ 80, thẻ thấp nhất tới y ≈ 225).

## Ghi chú cho BE

Server có cần xử lý gì khác thường không (vd. thời gian trình chiếu trước khi cho nhập, đáp án gồm nhiều bước)? Không có thì ghi "Không".

## Câu hỏi mở

- …
