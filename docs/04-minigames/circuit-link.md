# Nối mạch (`circuit-link`)

- Nhóm: Hình dung (`visualize`)
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo [CR-006](../00-tracking/change-requests.md#cr-006))
- Nguồn: [CR-013](../00-tracking/change-requests.md#cr-013), [kế hoạch mở rộng minigame](../01-product/minigame-expansion.md) mục 3.9 (cơ chế nối ống cổ điển; tên, hình và chữ là của Brain Rizz).
- Trạng thái đặc tả: bản đầu 2026-10-20. Thời gian giải và hệ số điểm là ước lượng, chốt lại sau buổi chơi thử.
- File:
  - `packages/shared/src/games/circuit-link/`: `circuit-link.ts` (bộ sinh, kiểu dữ liệu, hàm BFS dùng chung cho FE), `circuit-link.test.ts`.
  - `apps/web/src/games/circuit-link/` (scene, màn hướng dẫn, `locales.ts`): việc của frontend-dev.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M30** (CircuitLinkMobile, CircuitLinkLevels, CircuitLinkStates, CircuitLinkHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Lưới mảnh dây phấn nối từ **pin** tới **bóng đèn** ở mép bảng, còn thiếu một ô (Siêu khó: hai ô). Chạm thẻ mảnh dây (Siêu khó: thẻ có một *cặp* mảnh) làm đèn sáng. Chỉ đúng một thẻ làm được.

## Màn hướng dẫn

- **Cách chơi:**
  1. Tìm ô dây còn trống
  2. Chọn mảnh nối pin tới bóng đèn
  3. Dây cụt không dẫn điện đâu!
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không có.
- **Hình minh hoạ:** lưới 3 × 3 trên bảng phấn. Pin ở mép trái hàng trên, hai mảnh dây thẳng nằm ngang, ô thứ ba là ô trống viền nét đứt có dấu "?", bóng đèn ở mép phải ô trống. Dưới lưới ba thẻ: dây thẳng ngang, khúc cua, khúc cua. Thẻ dây thẳng được khoanh phấn vàng kèm ✓, một mũi tên phấn cong đi từ thẻ lên ô trống, bóng đèn vẽ tia sáng. Không có chữ.
- **Câu nhắc lúc đếm ngược:** "Nối dây cho đèn sáng!"
- **Câu nhắc theo mức:**
  - Khó: "Lần dây từ pin, coi chừng dây cụt!"
  - Siêu khó: "Hai ô trống, chọn đúng cặp mảnh!"

## Câu đố & đáp án

- `Puzzle` (`CircuitLinkPuzzle`):

  | Trường | Kiểu | Ý nghĩa |
  | --- | --- | --- |
  | `size` | số nguyên | Cạnh lưới: 3 (Mầm), 4 (Thường), 5 (Khó, Siêu khó) |
  | `tiles` | `number[]` (`size²` phần tử) | Mảnh từng ô theo hàng: ô (x, y) là `tiles[y * size + x]`, (0, 0) ở góc trên trái. Bitmask cổng: Bắc `CIRCUIT_N` = 1, Đông `CIRCUIT_E` = 2, Nam `CIRCUIT_S` = 4, Tây `CIRCUIT_W` = 8. 0 = ô không có dây. Ô thiếu cũng là 0 |
  | `battery`, `bulb` | `{ cell, side }` | Pin và bóng đèn gắn ngoài lưới, cạnh ô `cell`, phía `side` (một cổng hướng ra ngoài lưới) |
  | `missing` | `number[]` | Ô thiếu: 1 ô (Mầm, Thường, Khó) hoặc 2 ô (Siêu khó), theo thứ tự dọc đường từ pin tới đèn |
  | `options` | `number[][]` | Thẻ: 3 (Mầm) hoặc 4. Mỗi thẻ là mảng `missing.length` mảnh; `options[k][j]` đặt vào ô `missing[j]`. Thứ tự thẻ là thứ tự trên màn hình |
  | `answerIndex` | số nguyên | Thẻ duy nhất làm đèn sáng |
  | `path` | `number[]` | Các ô của đường chính theo thứ tự pin → đèn (kể cả ô thiếu), để vẽ dòng điện chạy |

- `Answer` (`CircuitLinkAnswer`): số nguyên, chỉ số thẻ được chạm. `check` đúng khi `answer === answerIndex`. `isAnswer` chỉ nhận số nguyên `0 ≤ n < 4` (`CIRCUIT_LINK_MAX_OPTIONS`); ở Mầm gửi 3 thì hợp kiểu nhưng chấm sai.
- Hai ô kề nhau **thông** khi cả hai cùng mở cổng về phía nhau. Đèn sáng khi đi loang (BFS) từ ô gắn pin (ô đó phải mở cổng phía pin) tới được ô gắn đèn (ô đó mở cổng phía đèn).
- Module export thêm cho FE và test: `circuitTileKind(t)` (`blank`, `end`, `straight`, `corner`, `tee`, `cross`), `circuitLinkPowered(size, tiles, terminal)` (ô nào có điện tính từ pin hoặc từ đèn), `circuitLinkFill(puzzle, fills)`, `circuitLinkLights(puzzle, fills)`, `circuitLinkDecoyPorts(puzzle, answer, j)`, `circuitLinkFallback(d)`, `circuitLinkGenerateWithStats(...)`.

## Cách sinh câu đố

Mọi thứ ngẫu nhiên đi qua `createRng(deriveSeed(seed, index))`; mọi giá trị là số nguyên. Một lần thử:

1. **Đường chính.** Chọn ngẫu nhiên một chỗ gắn pin ở mép lưới, đi ngẫu nhiên không cắt mình (ưu tiên đi thẳng theo `straightBias`) đủ số ô theo mức, ô cuối phải nằm ở mép để gắn đèn. Mỗi ô nhận mảnh 2 cổng: cổng về ô trước và cổng sang ô sau (ô đầu là cổng phía pin, ô cuối là cổng phía đèn). Số khúc cua trên đường (tính cả chỗ vào từ pin và chỗ ra đèn) phải nằm trong khoảng của mức.
2. **Ô thiếu.** Thường: một khúc cua bất kỳ trên đường. Mức khác: chọn ngẫu nhiên 1 ô (Siêu khó: 2 ô) trên đường.
3. **Nhánh cụt** (Khó, Siêu khó). Mỗi ô thiếu có xác suất mọc một nhánh (Khó 30 %, Siêu khó 25 %), nên đáp án ở ô đó thành **ngã ba**. Thêm 1–2 nhánh mọc từ ô 2 cổng khác trên đường. Nhánh dài 1–2 ô trống, ô cuối là đầu cụt (1 cổng). Gốc nhánh thành ngã ba.
4. **Kiểm luật gốc:** đặt đáp án thì đèn sáng; bỏ trống bất kỳ ô thiếu nào thì đèn tắt.
5. **Mảnh nhiễu ở ô trống.** Thường: tối đa 2 mảnh thẳng/cua **đứng riêng** (không chạm dây nào, không chĩa vào ô thiếu), chỉ để lưới bớt trống. Khó, Siêu khó: tối đa 5 / 6 mảnh bất kỳ (đầu cụt, thẳng, cua, ngã ba), được chạm nhau và chĩa vào ô thiếu, miễn luật gốc ở bước 4 vẫn đúng. Mảnh nhiễu (và dây mồi ở bước 6) không bao giờ có cổng chĩa ra ngoài lưới: chỉ pin và đèn nối ra mép.
6. **Dây mồi** (Khó, Siêu khó). Mỗi ô thiếu phải có ≥ 1 *dây mồi*: dây chĩa vào ô thiếu nhưng không nối về pin hay đèn (đầu nhánh cụt, mảnh nhiễu). Ô nào chưa có thì đặt một mảnh 2 cổng ở ô trống kề, chĩa vào ô thiếu. Vì thế người chơi phải lần dây từ pin và từ đèn mới biết dây nào thật.
7. **Thẻ.** Thử **mọi** mảnh trong kho của mức (Mầm: 2 thẳng + 4 cua; Thường: 4 cua; Khó, Siêu khó: thêm 4 ngã ba) vào ô thiếu và BFS từ pin. Thẻ nhiễu chỉ lấy trong các mảnh **không** làm đèn sáng. Ngã ba bao trọn hai cổng của đáp án (thông bằng đường vòng hay bằng chính hai cổng đó) cũng sáng nên bị loại. Chọn thẻ nhiễu theo cách không đoán được bằng cách đếm loại mảnh (mục [Không đoán mò được](#không-đoán-mò-được)), ưu tiên mảnh chạm ít nhất một dây đang chĩa vào ô thiếu.
8. Kiểm lại toàn bộ: đúng một thẻ làm đèn sáng. Xáo vị trí thẻ.

Không thoả ở bước nào thì thử lại với chính `rng` đó, tối đa 400 lần; quá số đó thì dùng **câu dự phòng** cố định của mức (chép từ chính bộ sinh, seed 42 câu 0) với thứ tự thẻ xáo bằng `rng`. Đo 200 000 seed mỗi mức: trung bình 3–16 lần thử, nhiều nhất 181 lần (Siêu khó), chưa lần nào phải dùng câu dự phòng. Bộ sinh mất khoảng 15–110 µs mỗi câu.

### Vì sao chắc chắn đúng một đáp án

- Đáp án dựng từ chính đường chính nên luôn làm đèn sáng (bước 4).
- Mọi thẻ nhiễu đã được thử bằng BFS là không làm đèn sáng; ở Siêu khó, thẻ "sai cả hai" cũng được thử (hai mảnh sai có thể thông qua đường vòng bằng nhau).
- Test viết lại BFS độc lập, thử từng thẻ của 10 000 câu: đúng một thẻ sáng và trùng `answerIndex`; chưa đặt thẻ thì đèn tắt; Siêu khó chỉ đặt một nửa đáp án thì đèn vẫn tắt.

### Không đoán mò được

| Mức | Cách chọn thẻ nhiễu | Hệ quả |
| --- | --- | --- |
| Mầm | 3 thẻ thuộc 2 loại (thẳng, cua). 1/3 số câu đáp án là thẻ lẻ loại (2 thẻ nhiễu cùng loại kia); 2/3 còn lại đáp án nằm trong cặp cùng loại | "Chọn thẻ lẻ loại" chỉ trúng 1/3 như đoán bừa |
| Thường | Đủ 4 hướng khúc cua | Mọi thẻ cùng loại, chỉ khác hướng |
| Khó | 4 thẻ đủ 3 loại (thẳng, cua, ngã ba), một loại có 2 thẻ. 1/2 số câu đáp án nằm trong cặp cùng loại, 1/2 là một trong hai thẻ lẻ | Đếm loại không giúp gì; luôn có ít nhất một ngã ba |
| Siêu khó | Bảng 2 × 2: mỗi ô thiếu có đáp án và 1 mảnh sai; 4 thẻ là 4 cách ghép. Mảnh sai cùng loại với đáp án ½ (đáp án ngã ba) hoặc ⅖ (đáp án 2 cổng), ngã ba ⅕ | Mảnh nào cũng nằm trên đúng 2 thẻ; "cặp nhiều cổng nhất" không trúng hơn đoán bừa |

Đo 10 000 câu mỗi mức (test kiểm, ngưỡng 1/số thẻ + 6 %):

| Cách đoán chỉ nhìn thẻ | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Đoán bừa | 0,33 | 0,25 | 0,25 | 0,25 |
| Chọn thẻ loại hiếm nhất | 0,34 | 0,25 | 0,25 | 0,25 |
| Chọn thẻ loại nhiều nhất | 0,33 | 0,25 | 0,25 | 0,25 |
| Chọn thẻ nhiều cổng nhất | 0,33 | 0,25 | 0,25 | 0,25 |
| Chọn thẻ ít cổng nhất | 0,33 | 0,25 | 0,25 | 0,25 |

Vị trí thẻ đúng phân bố đều (lệch < 4 % mỗi vị trí).

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 × 3 · đường 3–5 ô, 0–1 khúc cua · 1 ô thiếu · 3 thẻ (thẳng, cua) · không nhiễu | Hai dây chĩa vào ô trống, chọn mảnh nối hai dây đó |
| Thường | 4 × 4 · đường 6–10 ô, 3–4 khúc cua · ô thiếu luôn là khúc cua · 4 thẻ là 4 hướng khúc cua · ≤ 2 mảnh nhiễu đứng riêng | Phải chọn đúng hướng rẽ |
| Khó | 5 × 5 · đường 8–12 ô, 4–5 khúc cua · 1–2 nhánh cụt + 30 % ô thiếu mọc nhánh · ≥ 1 dây mồi chĩa vào ô thiếu · ≤ 5 mảnh nhiễu · 4 thẻ đủ thẳng, cua, ngã ba | 3 dây trở lên chĩa vào ô trống; phải lần từ pin và đèn xem dây nào thật. Đáp án đôi khi là ngã ba |
| Siêu khó | 5 × 5 · đường 9–13 ô, 5–6 khúc cua · **2 ô thiếu**, mỗi ô ≥ 1 dây mồi, 25 % mỗi ô mọc nhánh · ≤ 6 mảnh nhiễu · 4 thẻ là 4 cặp mảnh | Hai chỗ đứt, mỗi chỗ có bẫy riêng; thẻ chỉ đúng khi cả hai mảnh đúng |

Độ khó tăng đo được (test, trung bình 2 500–10 000 câu mỗi mức):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Cạnh lưới · số thẻ · số ô thiếu | 3 · 3 · 1 | 4 · 4 · 1 | 5 · 4 · 1 | 5 · 4 · 2 |
| Ô có dây trên lưới | 2,4 | 6,6 | 14,3 | 15,3 |
| Độ dài đường chính (ô) | 3,4 | 7,2 | 9,2 | 10,1 |
| Khúc cua trên đường chính | 0,6 | 3,6 | 4,6 | 5,6 |
| Dây mồi chĩa vào ô thiếu (cả câu) | 0 | 0 | 1,0 | 2,1 |
| Ô thiếu có đáp án là ngã ba | 0 % | 0 % | 34 % | 28 % |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một thẻ làm đèn sáng (BFS cổng khớp hai phía), trùng `answerIndex`.
- Chưa đặt thẻ thì đèn tắt; Siêu khó đặt thiếu một mảnh của đáp án đèn cũng tắt.
- Thẻ đôi một khác nhau; mỗi thẻ có đúng `missing.length` mảnh, mỗi mảnh 2–3 cổng (không có thẻ đầu cụt hay chữ thập).
- Pin và đèn nằm ở mép, cổng phía ngoài; không mảnh nào khác có cổng chĩa ra ngoài lưới.
- Đường chính liền, từ ô gắn pin tới ô gắn đèn, đi qua mọi ô thiếu, có điện trọn vẹn khi đặt đáp án.
- Đúng luật từng mức: Mầm ≤ 1 khúc cua và thẻ toàn mảnh 2 cổng; Thường 3–4 khúc cua, 4 thẻ khúc cua, không có dây mồi; Khó/Siêu khó mỗi ô thiếu ≥ 1 dây mồi, lưới có đầu cụt và ngã ba; Khó thẻ đủ 3 loại; Siêu khó là bảng 2 × 2.
- Không đoán mò được (bảng trên); câu dự phòng cũng đúng mọi luật.
- Tất định: cùng `(seed, index, difficulty)` ra cùng câu.

Các điều trên được kiểm bằng test 10 000 câu (2 500 seed × 4 mức).

## Cân bằng

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ sai ước | Số câu mỗi vòng 60 s (mô phỏng: đúng + sai) |
| --- | --- | --- | --- |
| Mầm | Người lớn 1,2–1,9 s · trẻ 7 tuổi 2,5–4,0 s | 3 % · trẻ 12 % | 31,4 (30,4 + 1,0) · trẻ 15,7 (13,8 + 1,9) |
| Thường | 2,3–3,3 s | 8 % | 18,3 (16,8 + 1,5) |
| Khó | 3,5–4,9 s | 12 % | 12,4 (10,9 + 1,5) |
| Siêu khó | 5,0–6,8 s | 15 % | 8,9 (7,6 + 1,3) |

Cách ước lượng: 0,4 s tìm ô trống + đọc các dây chĩa vào + lần dây (nếu có mồi) + dò thẻ + 0,3 s chạm. Mầm: 2 dây, 3 thẻ, không mồi. Thường: 2 dây nhưng phải so hướng 4 khúc cua (khoảng 1–1,5 s). Khó: thêm 1–1,5 s lần từ pin và từ đèn để loại dây mồi, thẻ trộn 3 loại. Siêu khó: làm hai lần cho hai ô thiếu, mỗi lần chỉ 2 mảnh để chọn. Các mức của người lớn không chồng nhau. Siêu khó vẫn còn khoảng 8,9 câu mỗi vòng.

Mô phỏng: 20 000 vòng 60 s mỗi người chơi bằng chính `generate()`, `check()` và `pointsForCorrect`: thời gian giải phân bố đều trong khoảng ở bảng; sai theo tỉ lệ ở bảng; giữa hai câu có 0,25–0,35 s hiệu ứng, cộng vào `answerMs` câu sau; câu sai khoá 1,5 s; combo trần × 1,5.

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong định nghĩa game):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | min(1,40 mô phỏng cho trẻ 7 tuổi, 1) |
| Thường | 1 | không khai báo | mốc |
| Khó | **1,95** | không khai báo | 1,97 mô phỏng, làm tròn 0,05 |
| Siêu khó | **3,25** | không khai báo | 3,25 mô phỏng |

Điểm vòng S_d(m) = m × A_d + B_d (A: phần 100 điểm × combo, B: thưởng tốc độ × combo); m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Câu đúng · sai mỗi vòng | A_d | B_d | m_d tính ra |
| --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 13,8 · 1,9 | 1 708 | 587 | 1,40 |
| Người lớn · Thường | 16,8 · 1,5 | 2 165 | 818 | 1 (mốc, S ≈ 2 983) |
| Người lớn · Khó | 10,9 · 1,5 | 1 329 | 360 | 1,97 |
| Người lớn · Siêu khó | 7,6 · 1,3 | 881 | 124 | 3,25 |

Điểm vòng ước tính so với người lớn ở Thường:

| Người chơi | Hệ số chung cũ (0,8 / 1 / 1,25 / 1,5) | Hệ số game này |
| --- | --- | --- |
| Trẻ 7 tuổi · Mầm | ≈ 1 950 (65 %) | ≈ 2 300 (77 %) |
| Người lớn · Mầm | ≈ 5 370 (180 %) | ≈ 6 220 (209 %) |
| Người lớn · Thường | ≈ 2 980 (100 %) | ≈ 2 980 (100 %) |
| Người lớn · Khó | ≈ 2 020 (68 %) | ≈ 2 950 (99 %) |
| Người lớn · Siêu khó | ≈ 1 450 (48 %) | ≈ 2 990 (100 %) |

- `speedAllowanceMs` không khai báo: không có pha trình chiếu, một chạm là xong.
- Trẻ 7 tuổi ở Mầm chỉ được khoảng 77 % vì hệ số Mầm bị chặn ở 1 theo luật CR-006. Người lớn chọn Mầm được khoảng 209 % điểm Thường; chủ phòng giám sát như các game khác.
- **Độ nhạy:** Khó nhanh/chậm hơn 0,75 s → khoảng 123 % / 82 % Thường; Siêu khó nhanh/chậm hơn 1 s → khoảng 124 % / 83 %, và chậm hơn 1 s thì chỉ còn khoảng 7,7 câu mỗi vòng (xem Câu hỏi mở).

**Kiểm tra não** (Hình dung, 40 s, Thường; cách tính ở [GDD](../01-product/game-design.md#kiểm-tra-não)): giả định 2,8 s mỗi câu (±20 %), sai 8 %, 4 000 lượt → 12,1 câu, 11,1 đúng, trung bình 1 913 điểm → **điểm chuẩn 1 900**. Nhanh hơn 30 % → × 1,47; chậm hơn 40 % → × 0,66. Số này để thay số giữ chỗ 1 500 trong `BRAIN_TEST_REFERENCE_SCORE` (backend/điều phối sửa `brain-test.ts`).

## Ghi chú cho FE

Scene tự sinh câu bằng `circuitLink.generate(seed, index, difficulty)` từ `@brain-rizz/shared`, gửi chỉ số thẻ được chạm, kiểm cục bộ bằng `circuitLink.check(puzzle, i)` để phản hồi ngay. Không tự viết lại BFS: dùng `circuitLinkFill` + `circuitLinkPowered` để biết ô nào có điện.

### Bố cục (khung 720 × 1280)

| Thành phần | Vị trí | Kích thước | Ghi chú |
| --- | --- | --- | --- |
| Dải nhắc luật | giữa, y ≈ 150 | 260 × 56 | Viên thuốc kem: icon pin → mũi tên → icon bóng đèn; không chữ. Huy hiệu khoá được phép che |
| Bảng mạch | giữa, y 250–900 | lưới + lề 64 px mỗi phía cho pin/đèn | Ô 140 px (3 × 3), 120 px (4 × 4), 104 px (5 × 5). Không nhận chạm |
| Thẻ 0–3 | một hàng, y 960–1120 | 152 × 160, khe 16 px (Mầm 3 thẻ đặt giữa) | Cả thẻ là vùng chạm. Thứ tự `options` là thứ tự trái → phải |

- Bảng mạch bắt đầu từ y ≥ 250 để ô thiếu (kể cả hàng trên cùng) và đáp án hiện khi sai không bị huy hiệu khoá che (tới y ≈ 80, máy thấp tới y ≈ 225).
- Thẻ: nền kem `#fff8ef`, viền mực 4 px, bo 24, bóng đặc 8 px. Thẻ 1 ô: một mảnh 96 px ở giữa. Thẻ Siêu khó: hai mảnh 64 px cạnh nhau, mảnh trái cho ô thiếu thứ nhất (`missing[0]`), mảnh phải cho ô thứ hai.
- **Siêu khó, nối thẻ với ô:** ô thiếu thứ nhất có huy hiệu tròn ●, ô thứ hai có huy hiệu tam giác ▲ (góc trên trái ô trống); trên thẻ, dưới mỗi mảnh vẽ đúng huy hiệu đó. Không chỉ phân biệt bằng màu.

### Vẽ mảnh dây

- Mỗi cổng là một nét phấn dày 14 px từ tâm ô ra **sát mép ô** (để hai ô thông nhau nối liền thành một dây). Tâm ô có nút tròn 18 px cho ngã ba, chữ thập và đầu cụt; khúc cua bo tròn góc trong.
- **Mọi dây cùng một kiểu nét và một màu**: dây trên đường chính, nhánh cụt, mảnh nhiễu và dây mồi phải trông giống hệt nhau, nếu không người chơi đoán được đường chính mà không cần lần dây.
- Dây chĩa vào ô kề không mở cổng ngược lại: nét vẫn tới mép ô, kết thúc bằng đầu tròn nhỏ (đầu hở). Ô kề vẽ bình thường nên nhìn thấy rõ hai dây không chạm nhau.
- Ô không có dây (0): chấm phấn mờ ở tâm để thấy lưới. Ô thiếu: viền nét đứt vàng nhạt, dấu "?" vẽ bằng nét (không phải chữ), giữ nguyên các dây ô kề chĩa vào.
- Pin: ở lề ngoài, sát cạnh `battery.side` của ô `battery.cell`, nối vào ô bằng một nét dây ngắn; ký hiệu +/− vẽ bằng nét. Bóng đèn: ở lề ngoài phía `bulb.side` của ô `bulb.cell`, tắt là bóng phấn trắng rỗng, sáng là vàng `#ffd166` có tia.
- Dùng `circuitTileKind(t)` khi cần chọn cách vẽ nút; vẽ theo bitmask là đủ cho mọi mảnh 0–15.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms)

| Trạng thái | Hiển thị | Thời lượng |
| --- | --- | --- |
| Hiện câu | Bảng và thẻ hiện mờ dần, phóng 0,96 → 1; nhận chạm ngay | 120 ms |
| Chờ chọn | Máy tính: rê chuột thì thẻ nhấc 4 px và mảnh trên thẻ hiện mờ 40 % vào ô thiếu (xem trước, **không** chạy điện hay bật đèn, nếu không rê qua 4 thẻ là biết đáp án). Điện thoại: thẻ co 0,97 lúc nhấn, không xem trước. Ghi nhận ở `pointerdown`, một chạm là chốt | — |
| Đúng | Mảnh của thẻ bay vào ô thiếu; dòng điện vàng chạy dọc `path` từ pin tới đèn (mỗi ô ~25 ms), đèn sáng; thẻ có vòng vàng + ✓ | ≤ 350 ms rồi sang câu mới |
| Sai, khoá | Xem mục dưới | `bridge.unlockDelay` |
| Hết giờ | Không nhận chạm nữa | — |

Giữ hiệu ứng đúng ≤ 350 ms vì thời gian này bị tính vào câu sau (dòng điện 5 × 5 dài tới 13 ô: chạy nhanh hơn nếu cần, tổng không quá 350 ms).

### Hiện đáp án đúng khi sai

1. `circuitLink.check(puzzle, i)` sai thì `submit` rồi gọi `bridge.unlockDelay(index)`; hết khoá theo số ms nó trả về, không tự đếm 1,5 s. Hết giờ trong lúc khoá thì kiểm `this.sys.isActive()` trước khi dùng kết quả.
2. Thẻ bị chạm: rung ngang ±8 px, viền gạch đứt đỏ `#e85d75` (tối: hồng) + ✗.
3. Ô thiếu trên bảng: hiện mảnh **đáp án** (`options[answerIndex]`) viền vàng; dòng điện chạy từ pin dọc `path` tới đèn, đèn sáng. Dây mồi chĩa vào ô thiếu (lấy bằng `circuitLinkDecoyPorts(puzzle, options[answerIndex], j)`) nháy đỏ một lần để người chơi thấy bẫy.
4. Thẻ `options[answerIndex]`: vòng vàng + ✓. Các thẻ còn lại mờ còn 35 %.
5. Hết khoá: sang câu mới.

- Bảng mạch ở y ≥ 250 và thẻ ở y ≥ 960 nên huy hiệu khoá không che đáp án.
- `prefers-reduced-motion`: bỏ rung và dòng điện chạy, chỉ đổi viền, hiện mảnh đáp án và bật đèn.
- Không chỉ dùng màu: đúng là ✓ + viền liền, sai là ✗ + viền gạch đứt.

### Âm thanh dự kiến (GĐ 2)

- Đúng: tiếng "tách" công tắc + "ting" bóng đèn, cao dần theo combo.
- Sai: "bụp" trầm + rung 40 ms.

### Ví dụ để vẽ và kiểm (seed 42, câu 0, cũng là câu dự phòng)

Ký hiệu: `─ │` thẳng, `└ ┌ ┐ ┘` cua, `├ ┤ ┬ ┴` ngã ba, `╵ ╶ ╷ ╴` đầu cụt (chĩa lên/phải/xuống/trái), `·` trống, `?1 ?2` ô thiếu. Hàng cách nhau bằng `/`.

| Mức | Lưới | Pin · đèn | Thẻ (đáp án in đậm) |
| --- | --- | --- | --- |
| Mầm | `─ ─ ?1 / · · · / · · ·` | ô 0 phía Tây · ô 2 phía Đông | **0: `─`** · 1: `┌` · 2: `┐` |
| Thường | `┌ ┘ · · / │ · · · / ?1 ─ ─ ─ / · · · ·` | ô 1 phía Bắc · ô 11 phía Đông | 0: `┘` · 1: `┌` · **2: `└`** · 3: `┐` |
| Khó | `· · ?1 ─ · / · ┌ ┘ · · / ╵ ├ ┬ ┐ ┘ / · ╵ ╵ │ · / · · · └ ─` | ô 24 phía Đông · ô 2 phía Bắc | **0: `│`** · 1: `┴` · 2: `┬` · 3: `┌` |
| Siêu khó | `│ · ┐ · · / │ │ · · · / └ ?1 ┬ ─ ╴ / ╵ ┌ ┘ ╷ · / └ ?2 ┬ ┘ ·` | ô 0 phía Bắc · ô 22 phía Nam | **0: `─ └`** · 1: `├ ┘` · 2: `─ ┘` · 3: `├ └` |

Khó: `─` ở ô 3 chĩa sang ô thiếu là dây mồi; `┴` nối đèn với dây mồi, `┬` nối đường từ pin với dây mồi, cả hai không sáng. Siêu khó: `│` ở ô 6 (chĩa xuống ô thiếu 1) và `└` ở ô 20 (chĩa sang ô thiếu 2) là dây mồi.

### Chỉnh scene theo bản mẫu

Toạ độ trên khung 720×1280; bản đầy đủ do ui-designer bàn giao cùng bản mẫu hàng M30. Bản mẫu vẽ đúng 4 câu ở bảng ví dụ trên.

- Giữ gần hết scene hiện có: dải nhắc luật ở (360, 150), dây phấn một kiểu, đầu hở, ô thiếu vàng nét đứt, thẻ 152 × 160 ở y 960–1120, vòng vàng + ✓, ✗ + viền gạch đứt, huy hiệu ● ▲, xem trước khi rê 40 %, pha đặt thử khi sai.
- `slateArt` + `SLATE`: đổi mặt bảng phẳng sang khung gỗ như Phấn trượt / Ô bí ẩn: khung x 22–698, y 237–913, bo 30, gỗ #a8693b (tối #6b4528), viền `--sticker` 5, bóng 8; mặt bảng inset 14 (x 36–684, y 251–899, 648 × 648, bo 18) màu `--board`, viền mực 3, viền nhóm Hình dung #bcacf6 6 px (token trên bảng, cả sáng lẫn tối). `BOARD` (360, 575) và cỡ ô giữ nguyên.
- `wireArt` tone `wrong` (dây mồi, ô đặt thử sai): #e85d75 trên bảng xanh sáng chỉ ~1,8:1 và đỏ/xanh lá khó với người mù màu → thêm nét `--sticker` rộng 14 + 8 (chấm r + 4) dưới nét đỏ, giữ quầng 40 %.
- `CircuitLinkHowTo.tsx`: hình vuông đặt trong khung 14:9 theo kiểu **lưới trái + 3 thẻ xếp dọc phải**. `viewBox` đổi thành `"4 4 552 352"`. Lưới 3 × 3 ô 76 ở x 72–300, y 66–294; dây hàng trên nét 10 (quầng 18 mờ 15 %) từ x 72 tới đầu hở r 7 ở (217, 104).
- `CircuitLinkHowTo.tsx` pin, ô, đèn: pin ở (72, 104) hướng Tây scale 0,8; ô trống x 229, y 71, 66 × 66, bo 10, nét đứt vàng 3,5 (dash 9 7); dấu ? scale 0,77 ở (262, 104); đèn sáng ở (300, 104) hướng Đông scale 0,8.
- `CircuitLinkHowTo.tsx` thẻ: 3 thẻ 116 × 84 (bo 14, viền 3,5, bóng 5), tâm x 466, y 76 / 174 / 272, thứ tự `─` (đáp án), `┌`, `┐`, mảnh 52. Vòng thẻ `─`: x 400, y 26, 132 × 100, bo 20 (mực 9 + vàng 5); ✓ ở (524, 36) scale 0,6. Mũi tên phấn `M396 58 C370 18 300 16 270 56`, đầu `M283 53 L270 57 L270 43`, nét 5 (vòng qua trên bóng đèn).

## Ghi chú cho BE

Không có xử lý khác thường: không có pha trình chiếu, đáp án một bước, chấm bằng `generate()` + `check()`.

- Đáp án đúng cho test server: `GAMES["circuit-link"].generate(s, i, d).answerIndex`.
- Khai báo CR-006 trong `circuitLink`: `durationMs: 60_000`; `difficultyMultiplier: { 0: 1, 1: 1, 2: 1.95, 3: 3.25 }`; không có `speedAllowanceMs`, không có `answerWindowMs`.
- Kiểm tra não: điểm chuẩn **1 900** (thay số giữ chỗ 1 500).

## Câu hỏi mở

- Thời gian giải là ước lượng. Nếu chơi thử thấy Siêu khó chậm hơn 7 s mỗi câu (dưới 8 câu mỗi vòng), đề xuất bỏ mảnh nhiễu ở Siêu khó (giữ dây mồi) trước khi giảm thẻ, rồi tính lại hệ số.
- Thường luôn thiếu ở khúc cua để 4 thẻ cùng loại. Nếu chơi thử thấy đơn điệu, có thể thêm câu thiếu ở đoạn thẳng với thẻ "2 thẳng + 2 cua", nhưng khi đó phải trộn cả câu thiếu khúc cua có thẻ thẳng để thành phần thẻ không lộ đáp án.
- Trẻ 7 tuổi ở Mầm chỉ được khoảng 77 % điểm người lớn ở Thường vì hệ số Mầm bị chặn ở 1. Nếu đo thật thấy trẻ chậm hơn ước lượng, cân nhắc bỏ thêm nhánh rẽ ở Mầm (chỉ đường thẳng) thay vì đổi luật chặn.
