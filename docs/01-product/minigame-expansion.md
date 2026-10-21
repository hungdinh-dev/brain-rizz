# Kế hoạch mở rộng minigame (17 → 31 game)

| | |
| --- | --- |
| Giai đoạn SDLC | Lập kế hoạch: **đã duyệt cả 14 game** (2026-10-20), chia hai đợt 7 game theo [CR-013](../00-tracking/change-requests.md#cr-013) và [CR-014](../00-tracking/change-requests.md#cr-014) |
| Phiên bản tài liệu | 0.2 · 2026-10-20 · chủ dự án duyệt, đang làm |
| Nguồn ý tưởng | 21 trò của Pumer Party (pumgames.vercel.app/games/pumer-party), đọc từ bundle JS ngày 2026-10-20 |
| Liên quan | [GDD](game-design.md) (luật, quy tắc thiết kế minigame), [Danh mục minigame](../04-minigames/README.md), [Yêu cầu thay đổi](../00-tracking/change-requests.md), [Lộ trình](roadmap.md) |
| Cập nhật khi | Chủ dự án duyệt hoặc đổi danh sách game, xong một đợt, hoặc đặc tả chốt khác với bản này |

> Cả 14 game đã vào phạm vi: CR-013 (Tráo cốc, Xếp lại tháp, Chuỗi quy luật, Đếm sĩ số, Mảnh vừa khít, Ô bí ẩn, Nối mạch) và CR-014 (7 game còn lại), SRS 1.10. Chủ dự án chọn làm luôn, chơi thử sau, nên khuyến nghị "chơi thử xong mới làm đợt sau" ở mục 4 không áp dụng cho lần này. ID, tên và tham số độ khó là gợi ý; game-designer chốt khi viết đặc tả.

## 1. Tóm tắt

Pumer Party có 21 trò, mỗi trò 5 mức "ớt". Lọc theo [quy tắc thiết kế minigame](game-design.md#quy-tắc-thiết-kế-một-minigame-mới) của Brain Rizz:

| Kết luận | Số trò | Trò Pumer |
| --- | --- | --- |
| **Làm game mới** (chuyển thành câu đố ngắn, mỗi câu một đáp án) | 14 | Úp Nón Tìm Kẹo, Tìm Bạn Lạc, Mực Lừa, Quán Chè Tí Hon, Trống Hội, Chuỗi Hạt Kỳ Lạ, Mâm Ngũ Quả, Gác Cổng Xóm, Đếm Vịt Vào Chuồng, Đi Chợ Tết, Đường Về Đúng Số, Gói Quà Vừa Khít, Dẫn Nước Vào Ruộng, Rót Trà Đầy Chén |
| **Đã có game tương đương**, chỉ mượn ý cho mức khó | 5 | Ai Đổi Chỗ?, Theo Chân Mèo Mun, Thối Tiền Chợ Quê, Cân Đĩa Trái Cây, Bắt Đom Đóm |
| **Không làm** | 2 | Thuyền Thúng Vượt Thác, Sắp Chữ Thư Pháp |

Làm đủ 14 game thì danh mục lên **31 game**, chia 3 đợt. Đợt 1 có đúng một game cho mỗi nhóm kỹ năng và ít rủi ro nhất.

| Nhóm | Hiện có | Thêm | Sau mở rộng |
| --- | --- | --- | --- |
| Nhận diện | 4 (Kẻ lạc đàn, Bóng của ai, Đập đúng hình, Luyện ngắm) | Tráo cốc, Tìm bạn, Hình to hình nhỏ | 7 |
| Ghi nhớ | 3 (Theo dấu ánh đèn, Ai vừa biến mất, Lật cặp) | Xếp lại tháp, Nhại nhịp | 5 |
| Phân tích | 4 (Cân não, Đếm khối, Bi rơi đâu, Phấn trượt) | Chuỗi quy luật, Ô bí ẩn, Cổng luật | 7 |
| Tính toán | 3 (Bóng bay số, Chạm đích, Đếm tiền nhanh) | Đếm sĩ số, Giỏ hời nhất, Đường số | 6 |
| Hình dung | 3 (Xoay hình, Nhìn từ trên, Gấp hộp) | Mảnh vừa khít, Nối mạch, Rót vừa vạch | 6 |

Đập đúng hình hiện đang hoãn (mới có đặc tả, code để trong `git stash`) nhưng vẫn được tính vào cột "Hiện có".

## 2. Nguyên tắc chuyển từ Pumer sang Brain Rizz

Pumer và Brain Rizz chấm theo hai kiểu khác nhau. Mọi game trong kế hoạch này đã được chuyển sang kiểu của Brain Rizz:

| | Pumer Party | Brain Rizz |
| --- | --- | --- |
| Đơn vị chơi | Một màn dài 30–75 giây, điểm = % so với mục tiêu | Nhiều câu ngắn, mỗi câu **1–8 giây ở mức Thường**, đúng hoặc sai |
| Đáp án | Thao tác tự do (kéo, xếp, lái), có điểm nửa câu | **Đúng một đáp án**, `check()` trả về đúng/sai, kiểm bằng test 10.000 seed |
| Độ khó | 5 ớt, có ngưỡng qua, ngôi sao cược điểm | 4 mức: Mầm / Thường / Khó / Siêu khó; hệ số điểm riêng từng game (CR-006) |
| Ai chấm | — | Server dùng lại `generate()`; câu đố sinh chỉ từ `(seed, index, difficulty)` |

Cách chuyển một trò:

1. **Cắt màn dài thành câu ngắn.** Màn xếp kín cả hộp (Gói Quà) thành "chọn mảnh lấp vừa một khoảng trống"; màn giải cả mâm Sudoku (Mâm Ngũ Quả) thành "ô dấu ? là hình gì".
2. **Chọn đáp án thay vì thao tác tự do**, thường là 1 trong 3–4 thẻ. Thẻ dễ bảo đảm đúng một đáp án, chơi được bằng một ngón tay, và giữ được thưởng tốc độ.
3. **5 ớt → 4 mức:** ớt 1 thành Mầm (trẻ 7 tuổi chơi được), ớt 2–3 gộp thành Thường, ớt 4 thành Khó, ớt 5 thành Siêu khó. Ý tưởng mức 5 của Pumer thường là bỏ bớt gợi ý; giữ ý đó khi nó vẫn chấm được bằng máy.
4. **Thời gian trình chiếu không bấm được** (tráo cốc, bạn ra vào lớp, xem tháp, nghe nhịp) khai báo qua `speedAllowanceMs` để không ăn mất thưởng tốc độ.
5. **Chỉ lấy cơ chế.** Trang Pumer không ghi giấy phép mã nguồn mở nào, nên không chép tên, chữ, hình hay code. Tên, nhân vật và chủ đề (bảng phấn, lớp học, phòng thí nghiệm) là của Brain Rizz, giống cách đã xử lý Phấn trượt so với Ebb and Flow ([CR-012](../00-tracking/change-requests.md#cr-012)). Các cơ chế mượn ở đây đều là cơ chế cổ điển: tráo cốc, Navon, hình vuông Latin, nối ống, polyomino.
6. **Không chỉ phân biệt bằng màu, không phụ thuộc chữ.** Thuộc tính quan trọng luôn có thêm hình hoặc hoa văn; điều kiện viết bằng biểu tượng, không viết bằng chữ.

## 3. Danh sách game theo đợt

Mỗi game có: nguồn ý tưởng, cách chơi một câu, `Puzzle` / `Answer`, cách bảo đảm đúng một đáp án, 4 mức độ khó, thời gian dự kiến ở Thường và rủi ro. Thời lượng vòng mặc định 60 giây (CR-006).

### Đợt 1: mỗi nhóm một game, ít rủi ro

#### 3.1 Tráo cốc (`cup-shuffle`, Nhận diện)

- **Nguồn:** Úp Nón Tìm Kẹo.
- **Cách chơi:** cục phấn được úp dưới một chiếc cốc, các cốc tráo chỗ; hết tráo thì chạm vào cốc có phấn.
- **Câu đố / đáp án:** `Puzzle = { cups, start, moves: [[a, b] | [a, b, c]], moveMs }`; `Answer = số thứ tự cốc`. Đáp án tính ra bằng cách cho phấn đi theo từng bước tráo, nên luôn có đúng một.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 3 cốc · tráo 3 lần · 700 ms mỗi lần |
  | Thường | 3 cốc · 5 lần · 500 ms |
  | Khó | 4 cốc · 6 lần · 420 ms · có lượt 3 cốc xoay vòng cùng lúc |
  | Siêu khó | 5 cốc · 7 lần · 360 ms · có xoay vòng · giấu **2 vật** (phấn và tẩy, khác hình), hết tráo mới hỏi vật nào |

- **Thời gian ở Thường:** tráo khoảng 2,5 s (miễn trừ) + chọn khoảng 0,8 s → khoảng 15 câu mỗi vòng.
- **Rủi ro:** chuyển động là nội dung câu đố, nên chế độ giảm chuyển động **không được bỏ** phần tráo, chỉ bỏ hiệu ứng phụ (máy chủ dự án đang bật giảm chuyển động, cần thử trên máy đó). Scene chạy theo dòng thời gian của `Puzzle`, không đếm khung hình, để máy chậm không bị lệch.

#### 3.2 Xếp lại tháp (`stack-recall`, Ghi nhớ)

- **Nguồn:** Quán Chè Tí Hon.
- **Cách chơi:** một tháp khối hình hiện vài giây rồi bị che; chạm các khối ở khay theo đúng thứ tự từ dưới lên.
- **Khác Theo dấu ánh đèn:** game đó nhớ *vị trí*, game này nhớ *món gì, theo thứ tự nào*.
- **Câu đố / đáp án:** `Puzzle = { layers: kind[], tray: kind[], showMs }`; `Answer = kind[]`. Thứ tự đã cố định nên đúng một đáp án; ở Mầm so khớp không theo thứ tự.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 2 tầng · xem 2,5 s · không cần đúng thứ tự · 4 loại khối |
  | Thường | 3 tầng · đúng thứ tự · xem 2,5 s · 5 loại |
  | Khó | 4 tầng · xem 2 s · có tầng lặp loại · 6 loại |
  | Siêu khó | 5 tầng · xem 2 s · khay đổi chỗ mỗi câu · 8 loại (khác cả hình lẫn hoa văn) |

- **Thời gian ở Thường:** xem + che khoảng 2,9 s (miễn trừ, cộng thời gian tối thiểu cho 3 lần chạm như Theo dấu ánh đèn) + nhập khoảng 2 s → khoảng 11 câu.
- **Rủi ro:** thấp. Khối phân biệt bằng hình, màu chỉ là phụ.

#### 3.3 Chuỗi quy luật (`bead-pattern`, Phân tích)

- **Nguồn:** Chuỗi Hạt Kỳ Lạ.
- **Cách chơi:** chuỗi hạt xâu theo một quy luật, có một chỗ trống; chọn hạt đúng trong 4 thẻ.
- **Câu đố / đáp án:** hạt có 3 thuộc tính: hình, hoa văn (trơn / sọc / chấm) và số chấm 1–9. `Puzzle = { beads: (Bead | null)[], options: Bead[4] }`; `Answer = 0–3`.
- **Đúng một đáp án:** sinh quy luật từ một thư viện luật, rồi **cho mọi luật trong thư viện chạy lại trên các hạt đang hiện**. Mọi luật khớp với phần đã hiện phải cho ra cùng một hạt, và hạt đó phải nằm trong 4 thẻ. Đây là chỗ dễ sai nhất của game, test 10.000 seed phải kiểm điều này.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Lặp chu kỳ 2 theo một thuộc tính · chỗ trống ở cuối |
  | Thường | Hai thuộc tính đổi độc lập (hình theo chu kỳ 2, hoa văn theo chu kỳ 3) · chỗ trống ở cuối |
  | Khó | Số chấm tăng đều, nhân đôi hoặc theo chu kỳ · chỗ trống có thể ở giữa |
  | Siêu khó | Hai luật xen kẽ (vị trí chẵn / lẻ) hoặc cộng dồn kiểu Fibonacci · chỗ trống ở giữa |

- **Thời gian ở Thường:** khoảng 3 s → khoảng 17 câu.
- **Để sau:** bảng 3×3 kiểu đề IQ (mức 5 của Pumer) mất quá 8 giây; có thể làm thành game riêng.

#### 3.4 Đếm sĩ số (`head-count`, Tính toán)

- **Nguồn:** Đếm Vịt Vào Chuồng.
- **Cách chơi:** lớp học có sẵn vài bạn; các bạn đi vào, đi ra qua cửa; cửa đóng thì chọn số bạn còn trong lớp.
- **Câu đố / đáp án:** `Puzzle = { start, events: { in, out, teacher? }[], stepMs, options: number[4] }`; `Answer = 0–3`. Số đúng = `start + Σin − Σout`, các thẻ nhiễu lệch ±1, ±2. Chọn thẻ thay vì gõ số để chơi bằng một ngón tay.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Bắt đầu 2 bạn · 3 lượt · mỗi lượt 1 bạn · 900 ms |
  | Thường | Bắt đầu 3–5 · 5 lượt · có lượt 2 bạn · 700 ms |
  | Khó | 6 lượt · 550 ms · có lượt vừa vào vừa ra |
  | Siêu khó | 7 lượt · 450 ms · **thầy giáo** (dáng to, đeo kính, ôm sách) đi lẫn vào, không đếm |

- **Thời gian ở Thường:** trình chiếu khoảng 3,5 s (miễn trừ) + chọn khoảng 1,5 s → khoảng 12 câu.
- **Rủi ro:** giống Tráo cốc, chuyển động là nội dung câu đố. Số bạn trong lớp không bao giờ âm; test kiểm điều này.

#### 3.5 Mảnh vừa khít (`piece-fit`, Hình dung)

- **Nguồn:** Gói Quà Vừa Khít.
- **Cách chơi:** hộp lưới còn một khoảng trống; chọn mảnh (trong 4 thẻ) lấp vừa khít khoảng trống đó.
- **Luật lật:** giống Xoay hình, **chỉ xoay, không lật gương**. Mảnh lật gương là thẻ nhiễu.
- **Câu đố / đáp án:** `Puzzle = { box, gap: cell[], options: Piece[4] }`; `Answer = 0–3`. Đúng một đáp án: chuẩn hoá mỗi mảnh theo 4 góc xoay, chỉ đúng một thẻ cùng dạng chuẩn với khoảng trống.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Khoảng trống 3 ô · mảnh đúng không cần xoay · 3 thẻ |
  | Thường | 4 ô (tetromino) · mảnh đúng xoay 90° hoặc 180° · 4 thẻ |
  | Khó | 5 ô (pentomino) · góc xoay bất kỳ · có thẻ là bản lật gương của đáp án |
  | Siêu khó | 5–6 ô · cả 4 thẻ cùng số ô · nhiễu gồm bản lật gương và bản lệch 1 ô |

- **Thời gian ở Thường:** khoảng 3 s → khoảng 17 câu.
- **Rủi ro:** pentomino có hình đối xứng (lật gương trùng chính nó); bộ sinh phải bỏ các hình này ra khỏi loại nhiễu "bản lật gương".

### Đợt 2: thêm chiều sâu cho từng nhóm

#### 3.6 Tìm bạn (`crowd-search`, Nhận diện)

- **Nguồn:** Tìm Bạn Lạc.
- **Cách chơi:** thẻ "tìm người" vẽ một bạn (loài + mũ + đồ cầm + kính); chạm đúng bạn đó giữa đám đông.
- **Câu đố / đáp án:** `Puzzle = { crowd: Buddy[], card: Partial<Buddy> & { not?: Attr } }`; `Answer = chỉ số trong đám đông`. Đúng một đáp án: sinh đám đông xong mới kiểm, có đúng một bạn khớp mọi điều kiện của thẻ.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 9 bạn · khác loài hết, chỉ cần nhận ra loài |
  | Thường | 16 bạn · có bạn cùng loài, khác 1 phụ kiện |
  | Khó | 25 bạn · nhiều bạn chỉ khác đáp án ở 1 chi tiết nhỏ |
  | Siêu khó | 30 bạn · thẻ có điều kiện "không" (biểu tượng gạch chéo, vd. không đội mũ) |

- **Thời gian ở Thường:** khoảng 2,5 s → khoảng 20 câu.
- **Rủi ro:** tốn công vẽ nhất. Cần bộ phụ kiện SVG cho 6 nhân vật (ui-designer). Đám đông **đứng yên**: Pumer cho đám đông đi lại, nhưng như Luyện ngắm, vật đứng yên thì server chấm chính xác hơn và không bất lợi cho điện thoại. 30 bạn trên khung 720×1280 là lưới 5×6, mỗi ô khoảng 120 px, vẫn trên mức 48 px.

#### 3.7 Ô bí ẩn (`latin-cell`, Phân tích)

- **Nguồn:** Mâm Ngũ Quả.
- **Cách chơi:** lưới hình kiểu Sudoku nhỏ (mỗi hàng, mỗi cột có đủ mỗi hình đúng một lần); chọn hình cho ô dấu ?.
- **Câu đố / đáp án:** `Puzzle = { size, block?, givens, target: cell }`; `Answer = loại hình`. Sinh hình vuông Latin bằng cách xáo hàng, cột và ký hiệu của một bảng gốc, rồi xoá ô. Bộ giải phải xác nhận **ô ? bị ép giá trị** (đúng một đáp án) và **số bước suy luận đúng với mức** đang chọn.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 3×3 · suy ra ngay từ một hàng (đã có 2 hình kia) |
  | Thường | 4×4 · phải kết hợp hàng và cột |
  | Khó | 4×4 có khối 2×2 · phải suy qua một ô trung gian |
  | Siêu khó | 6×6 khối 2×3 · suy 2 bước |

- **Thời gian ở Thường:** khoảng 3,5 s → khoảng 15 câu.
- **Rủi ro:** đo "số bước suy luận" cần một bộ giải nhỏ trong `shared`. Lưới nhỏ nên chạy 10.000 seed vẫn nhanh.

#### 3.8 Giỏ hời nhất (`best-basket`, Tính toán)

- **Nguồn:** Đi Chợ Tết.
- **Cách chơi:** túi có X xu; căng tin bày 4 giỏ đồ ăn vặt, mỗi món có giá và số sao ngon; chọn giỏ nhiều sao nhất mà không lố tiền.
- **Câu đố / đáp án:** `Puzzle = { budget, baskets: Item[][] }`; `Answer = 0–3`. Đúng một đáp án: trong các giỏ không lố tiền, đúng một giỏ có tổng sao lớn nhất. Luôn có ít nhất một giỏ **lố tiền mà nhiều sao hơn** để bẫy người chỉ đếm sao.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 3 giỏ · mỗi giỏ 1 món · 1 giỏ lố tiền |
  | Thường | 4 giỏ · mỗi giỏ 2 món · phải cộng cả giá lẫn sao |
  | Khó | 4 giỏ · 3 món · có cặp món đi kèm được thêm sao (biểu tượng nối) |
  | Siêu khó | 4 giỏ · 3–4 món · thêm ưu đãi "mua 2 món cùng loại giảm giá" |

- **Thời gian ở Thường:** khoảng 5 s → khoảng 11 câu.
- **Rủi ro:** chồng ý với Đếm tiền nhanh và Chạm đích (đều là cộng). Khác ở chỗ phải *so sánh* sau khi cộng; chơi thử xem có quá giống không.

#### 3.9 Nối mạch (`circuit-link`, Hình dung)

- **Nguồn:** Dẫn Nước Vào Ruộng.
- **Cách chơi:** dây nối từ pin tới bóng đèn còn thiếu một ô; chọn mảnh dây (đúng hướng) trong 4 thẻ để đèn sáng.
- **Câu đố / đáp án:** `Puzzle = { grid, tiles, missing: cell, options: Tile[4] }`; `Answer = 0–3`. Đúng một đáp án: thử từng thẻ vào ô trống rồi kiểm đường thông từ pin tới đèn, chỉ đúng một thẻ thông (mảnh chữ T cũng phải thử, vì có thể thông bằng đường vòng).
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 3×3 · đường thẳng hoặc 1 khúc cua · 3 thẻ |
  | Thường | 4×4 · 3–4 khúc cua · thẻ nhiễu là đúng loại mảnh nhưng sai hướng |
  | Khó | 5×5 · có nhánh cụt và mảnh chữ T |
  | Siêu khó | 5×5 · thiếu 2 ô, đáp án là 1 trong 4 *cặp* mảnh |

- **Thời gian ở Thường:** khoảng 3 s → khoảng 17 câu.
- **Rủi ro:** thấp. Vẽ bằng Phaser Graphics, không cần asset.

#### 3.10 Rót vừa vạch (`pour-line`, Hình dung)

- **Nguồn:** Rót Trà Đầy Chén.
- **Cách chơi:** giữ để rót nước vào bình thí nghiệm, buông tay khi nước chạm vạch.
- **Vì sao xếp vào Hình dung:** ở mức Khó trở lên, bình có hình loe hoặc thót nên nước dâng không đều; người chơi phải hình dung thể tích theo hình bình.
- **Câu đố / đáp án:** `Puzzle = { vessel, target, flow }`; `Answer = holdMs` (số nguyên, client đo). `check`: mức nước tính từ `holdMs` theo hàm tất định của `vessel` và `flow`, lệch vạch không quá dung sai.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Ống thẳng · rót chậm · dung sai ±8 % chiều cao |
  | Thường | Ống thẳng · rót vừa · ±5 % |
  | Khó | Bình loe hoặc thót · ±5 % |
  | Siêu khó | Bình hình lạ · tốc độ rót tăng dần · nửa trên bình bị che, phải ước theo tốc độ dâng |

- **Thời gian ở Thường:** khoảng 2,5 s → khoảng 20 câu.
- **Rủi ro:** đây là **kiểu đáp án mới**, thời lượng do client đo. Mức tin cậy ngang Luyện ngắm (server tin toạ độ do client gửi). Độ trễ nhả tay trên điện thoại khoảng 16–50 ms nên dung sai phải lớn hơn mức đó. Bỏ ý "chén đục, chỉ nghe tiếng" của Pumer vì người tắt tiếng (điều thường gặp khi chơi chung) sẽ không chơi được.

### Đợt 3: chồng ý với game có sẵn hoặc cần thử trên máy thật

#### 3.11 Hình to hình nhỏ (`navon-shapes`, Nhận diện)

- **Nguồn:** Mực Lừa (hiệu ứng Stroop).
- **Vì sao đổi luật:** Stroop gốc dùng chữ tên màu, phạm hai quy tắc "không phụ thuộc chữ" và "không chỉ phân biệt bằng màu". Thay bằng **hình Navon**: một hình lớn ghép từ nhiều hình nhỏ khác loại (vd. tam giác lớn ghép từ các hình tròn). Vẫn giữ được sự giằng co giữa hai đáp án mà không cần chữ hay màu.
- **Cách chơi:** chọn hình *lớn* (hoặc hình *nhỏ*, tuỳ khung) trong các nút.
- **Câu đố / đáp án:** `Puzzle = { global, local, ask: "global" | "local", buttons }`; `Answer = loại hình`.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Luôn hỏi hình lớn · hình nhỏ thường trùng hình lớn · 3 loại |
  | Thường | Luôn hỏi hình lớn · hình nhỏ thường khác · 4 loại |
  | Khó | Khung tròn hỏi hình lớn, khung vuông hỏi hình nhỏ · đổi theo câu |
  | Siêu khó | Như Khó · nút đổi chỗ mỗi câu · 5 loại |

- **Thời gian ở Thường:** khoảng 1,3 s → khoảng 40 câu.
- **Rủi ro:** đổi luật theo khung giống Phấn trượt, nên để đợt 3 và chơi thử xem hai game có quá giống nhau không. Nếu chủ dự án muốn giữ Stroop chữ màu thì cần CR ngoại lệ quy tắc thiết kế.

#### 3.12 Nhại nhịp (`rhythm-echo`, Ghi nhớ)

- **Nguồn:** Trống Hội.
- **Cách chơi:** trống gõ một câu nhịp (có tiếng và mặt trống sáng theo từng tiếng); gõ lại đúng câu đó bằng nửa trái / nửa phải màn hình.
- **Câu đố / đáp án:** `Puzzle = { hits: { side, atMs }[], tolMs }`; `Answer = { side, atMs }[]`, tính từ lần gõ đầu tiên. `check`: đúng thứ tự trái/phải, và **khoảng cách giữa các tiếng** lệch không quá dung sai. Chỉ chấm khoảng cách, không chấm thời điểm tuyệt đối, để độ trễ cố định của từng máy tự triệt tiêu.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 3 tiếng · một mặt trống · nhịp đều · ±150 ms |
  | Thường | 4 tiếng · hai mặt · ±120 ms |
  | Khó | 5–6 tiếng · có chỗ nghỉ và nốt ngắn · ±100 ms |
  | Siêu khó | 6 tiếng · nghịch phách · ±80 ms |

- **Thời gian ở Thường:** nghe khoảng 2,5 s (miễn trừ) + gõ khoảng 2,5 s → khoảng 10 câu.
- **Rủi ro:** độ trễ chạm và âm thanh khác nhau giữa các máy; phải thử trên Android tầm trung trước khi chốt dung sai. Phải chơi được khi tắt tiếng (có đèn nháy). Đáp án do client đo thời gian, giống Rót vừa vạch.

#### 3.13 Cổng luật (`rule-gate`, Phân tích)

- **Nguồn:** Gác Cổng Xóm.
- **Cách chơi:** từng bạn đi tới cổng; vuốt trái (cho vào) hoặc phải (mời về) theo luật vẽ trên bảng (vd. biểu tượng mũ → vào).
- **Câu đố / đáp án:** `Puzzle = { buddy, rule, ruleShown }`; `Answer = "in" | "out"`. Luật của câu thứ `index` tính từ khối `floor(index / k)` bằng `deriveSeed(seed, khối)`, nên `generate` không cần giữ trạng thái và người nhanh, người chậm gặp luật mới ở cùng số thứ tự câu.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | Một luật cả vòng · một thuộc tính |
  | Thường | Luật đổi mỗi 6 câu, có báo "luật mới" |
  | Khó | Luật ghép VÀ / HOẶC, có luật phủ định · đổi mỗi 4–6 câu |
  | Siêu khó | **Luật ẩn** (kiểu trắc nghiệm Wisconsin): chỉ biết luật qua đúng/sai, đổi ngầm mỗi 6–8 câu |

- **Thời gian ở Thường:** khoảng 1,2 s → khoảng 40 câu.
- **Rủi ro:** chồng ý đổi luật với Phấn trượt. Ở Siêu khó, câu đầu sau mỗi lần đổi luật ngầm chắc chắn bị sai và bị khoá 1,5 giây; cần chơi thử xem có quá ức chế không (có thể hiện gợi ý luật sau 2 câu sai liền).

#### 3.14 Đường số (`number-path`, Tính toán)

- **Nguồn:** Đường Về Đúng Số.
- **Vì sao đổi luật:** tự vạch đường trên lưới mất quá 8 giây và khó bảo đảm chỉ có một đường đúng. Đổi thành: lưới đã vẽ sẵn vài con đường, chọn đường cho ra đúng số đích.
- **Câu đố / đáp án:** `Puzzle = { start, target, paths: Op[][] }`; `Answer = chỉ số đường`. Sinh đường đúng trước, rồi sinh các đường nhiễu và kiểm chúng không ra số đích.
- **Độ khó:**

  | Mức | Tham số |
  | --- | --- |
  | Mầm | 2 đường · mỗi đường 2 phép cộng/trừ |
  | Thường | 3 đường · 3 phép · có ×2 |
  | Khó | 3 đường · 4 phép · có ÷ (luôn chia hết) và số âm |
  | Siêu khó | 4 đường đan nhau, dùng chung ô · 4–5 phép · có bình phương và đổi dấu |

- **Thời gian ở Thường:** khoảng 6 s → khoảng 9 câu.
- **Rủi ro:** chồng ý với Chạm đích và Bóng bay số; để cuối danh sách, chơi thử Đợt 1–2 xong mới quyết làm hay bỏ.

## 4. Các bước cho mỗi đợt

| Bước | Việc | Ai làm | Ghi chú |
| --- | --- | --- | --- |
| 0 | Mở **CR-013** (thêm 14 game, hoặc mỗi đợt một CR), chủ dự án duyệt | Điều phối + chủ dự án | Bắt buộc theo `AGENTS.md`, vì các game này chưa có trong SRS |
| 1 | Cập nhật SRS (FR-MG-05: 17 → 22 → 27 → 31), GDD §5, [Danh mục minigame](../04-minigames/README.md), `features.md`, lộ trình | Điều phối | Làm ngay khi CR được duyệt |
| 2 | `pnpm new-game <id> <nhóm>` cho cả đợt | Điều phối | Tạo khung shared + web + chỗ giữ điểm chuẩn |
| 3 | Đặc tả `04-minigames/<id>.md`, bộ sinh câu đố + test 10.000 seed × 4 mức (tất định, đúng một đáp án, độ khó tăng dần), bảng Cân bằng | game-designer | Song song với bước 4 |
| 4 | Bản mẫu trên canvas (M18 trở đi), asset (riêng Tìm bạn cần bộ phụ kiện) | ui-designer | |
| 5 | Scene Phaser, màn hướng dẫn, `locales.ts` vi/en, đăng ký `registry.ts` và `CATALOG` | frontend-dev | |
| 6 | Chỉ khi cần: schema zod cho kiểu đáp án mới (đáp án thời gian của Rót vừa vạch, Nhại nhịp) | backend-dev | Hạn trả lời `answerWindowMs` đã có từ CR-012 |
| 7 | QA: `pnpm check`, soát bất biến, chạy Chrome headless | qa-tester | |
| 8 | Điểm chuẩn Kiểm tra não (`BRAIN_TEST_REFERENCE_SCORE`) mô phỏng lại cho từng game; **tăng `BRAIN_TEST_RULES_VERSION` một lần cho mỗi đợt** | game-designer | Thêm game vào nhóm là đổi cách đo kỹ năng của nhóm (GDD §3) |
| 9 | Chơi thử trên máy thật, chốt hệ số điểm và thời gian, đổi trạng thái 🚧 → ✅, changelog | Chủ dự án + điều phối | |

Mỗi đợt chạy workflow `/new-minigame` với `{ games: [...] }` để các game làm song song. Rút kinh nghiệm ngày 2026-10-20 (workflow dừng giữa chừng): đăng ký vào `registry.ts` chỉ sau khi scene đã chạy được.

### Ước lượng

Theo nhịp CR-012 (2 game trong 2–3 ngày):

| Đợt | Game | Ước lượng | Ghi chú |
| --- | --- | --- | --- |
| 1 | Tráo cốc, Xếp lại tháp, Chuỗi quy luật, Đếm sĩ số, Mảnh vừa khít | 4–6 ngày | Danh mục lên 22 game |
| 2 | Tìm bạn, Ô bí ẩn, Giỏ hời nhất, Nối mạch, Rót vừa vạch | 5–7 ngày | Tìm bạn tốn công vẽ; Rót vừa vạch có kiểu đáp án mới. Lên 27 game |
| 3 | Hình to hình nhỏ, Nhại nhịp, Cổng luật, Đường số | 4–6 ngày + thử trên máy thật | Quyết làm hay bỏ từng game sau khi chơi thử Đợt 1–2. Lên 31 game |

Chưa nên bắt đầu Đợt 1 trước khi 11 game đang 🚧 được chơi thử và chốt; nếu không, việc chơi thử sẽ dồn quá nhiều.

## 5. Việc chung phải làm khi danh mục lớn lên

- **Màn Chọn game và vòng quay:** 31 lát trên vòng quay quá nhỏ (CR-012 đã nêu). Cần ui-designer xem lại, vd. quay chọn nhóm trước rồi mới quay chọn game, hoặc vòng quay chỉ lấy 8 game ngẫu nhiên chưa chơi. Thay đổi này cần CR riêng vì đổi luật chọn game ở GDD §2.
- **Kiểm tra não:** mỗi nhóm có 5–7 game, nên điểm chuẩn ước sai ở một game ảnh hưởng ít hơn tới Điểm Não. Nhưng điểm Ghi nhớ dồn quanh 100 (đã ghi ở GDD, mục Hạn chế); hai game Ghi nhớ mới đều có pha trình chiếu nên không giải quyết được điểm này.
- **Kiểu đáp án đo thời gian phía client** (Rót vừa vạch, Nhại nhịp): nên ghi một ADR nhỏ về mức tin cậy và dung sai trước Đợt 2.
- **Kích thước gói:** mỗi game là một chunk riêng 4–5 KB và tải khi cần, nên gói ban đầu (NFR-PERF-01) chỉ tăng phần siêu dữ liệu trong `CATALOG`.
- **Giảm chuyển động:** Tráo cốc và Đếm sĩ số cần chuyển động để chơi. Ghi rõ trong đặc tả là chỉ bỏ hiệu ứng phụ, không bỏ chuyển động chính (FR-GD-12).

## 6. Trò đã có game tương đương

Kiểm tra não chỉ dùng mức Thường, nên chỉ sửa mức Khó / Siêu khó của game cũ thì không làm lệch Điểm Não, chỉ cần cân lại hệ số điểm party. Các ý dưới đây không bắt buộc, mỗi ý cần một CR đổi luật riêng.

| Trò Pumer | Game Brain Rizz | Đã có | Ý có thể mượn |
| --- | --- | --- | --- |
| Ai Đổi Chỗ? | Ai vừa biến mất | Siêu khó đã đổi chỗ món và có cặp bẫy | Thêm thẻ "Không mất gì" (có câu không món nào biến mất). Ưu tiên thấp |
| Theo Chân Mèo Mun | Theo dấu ánh đèn | Siêu khó đã bấm ngược | Đèn mồi khác hình sáng xen kẽ, chỉ nhớ đèn tròn |
| Thối Tiền Chợ Quê | Đếm tiền nhanh | Siêu khó đã có tiền thối, luôn mượn ≥ 2 lần | Không cần thêm |
| Cân Đĩa Trái Cây | Cân não | Hỏi vật nặng nhất, đã có cân "1 vật = 2 vật" | Kiểu hỏi "cần mấy quả để thăng bằng" là game khác; không làm, để khỏi đông nhóm Phân tích |
| Bắt Đom Đóm | Đập đúng hình, Luyện ngắm | Chỉ đập hình được gọi; bia biến mất, bia mồi | Bia phải chạm 2 lần cho Luyện ngắm Siêu khó. Ưu tiên thấp |

## 7. Trò không làm

| Trò Pumer | Lý do |
| --- | --- |
| Thuyền Thúng Vượt Thác | Lái liên tục, không chia được thành câu có một đáp án; server không chấm được nếu không chạy mô phỏng vật lý; chơi bằng chuột và bằng tay trên điện thoại chênh nhau nhiều |
| Sắp Chữ Thư Pháp | Phụ thuộc chữ và cần kho từ soạn sẵn (phạm quy tắc "không cần dữ liệu ngoài"); `packages/shared` không được chứa chữ giao diện; bản tiếng Anh phải soạn kho riêng. Muốn làm thì phải mở nhóm kỹ năng thứ 6 "Ngôn ngữ", kéo theo đổi Kiểm tra não (biểu đồ 5 cạnh, thang 0–1 000), nên cần CR lớn riêng |

## 8. Ngoài phạm vi kế hoạch này

Cách chơi của Pumer có vài ý về luật trận, không phải về minigame. Nếu muốn thì xem trong CR riêng:

- **Ngôi sao hi vọng:** từ mức Khó trở lên được cược, đạt thì ×2, trượt thì bị trừ điểm.
- **Chọn độ khó cả phòng:** tự chọn, chủ phòng khoá chung một mức, hoặc tăng dần theo vòng.
- **Bộ game có sẵn:** "Cho bé", "Thiên về trí", "Thiên về tay" để lọc vòng quay.

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
