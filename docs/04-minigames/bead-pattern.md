# Chuỗi quy luật (`bead-pattern`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/bead-pattern/` (logic + test), `apps/web/src/games/bead-pattern/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M23** (BeadPatternMobile, BeadPatternLevels, BeadPatternStates, BeadPatternHowTo). Chờ chủ dự án duyệt.
- Nguồn cơ chế: "Chuỗi Hạt Kỳ Lạ" của Pumer Party ([kế hoạch mở rộng, mục 3.3](../01-product/minigame-expansion.md#33-chuỗi-quy-luật-bead-pattern-phân-tích)). Chỉ mượn cơ chế cổ điển "điền phần tử còn thiếu của dãy"; tên, hình hạt, chữ và code là của Brain Rizz.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Một chuỗi hạt xâu theo quy luật, có một chỗ trống. Mỗi hạt có **hình**, **hoa văn** và (từ mức Khó) **số chấm**; mỗi thuộc tính đổi theo luật riêng. Chạm vào hạt (trong 4 thẻ) vừa với chỗ trống.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhìn chuỗi hạt, tìm quy luật
  2. Xem hình, hoa văn và số chấm
  3. Chạm hạt vừa với chỗ trống
- **Điều khiển:** Chạm thẻ (điện thoại) · Click thẻ (máy tính) · Bàn phím (tuỳ chọn): phím 1–4 theo thứ tự thẻ trái → phải, trên → dưới.
- **Hình minh hoạ:** chuỗi 6 hạt trên sợi dây phấn: tròn sọc, vuông sọc, tròn sọc, vuông sọc, tròn sọc, rồi một vòng nét đứt có dấu "?". Dưới là 4 thẻ 2 × 2: vuông sọc (viền vàng + dấu tích, mũi tên phấn chỉ lên chỗ "?"), tròn sọc, vuông ca-rô, tròn ca-rô (ba thẻ này mờ).
- **Câu nhắc lúc đếm ngược:** "Hạt nào còn thiếu?"
- **Câu nhắc theo mức:** Khó "Đếm chấm, chỗ trống có thể ở giữa" · Siêu khó "Xen kẽ hai luật, hoặc cộng dồn!".
- **Gợi ý cạnh từng mức:** Mầm "6 hạt · một thứ đổi" · Thường "7 hạt · hình và hoa văn đổi" · Khó "Có số chấm · trống ở giữa" · Siêu khó "Chẵn lẻ khác luật · cộng dồn".

## Câu đố & đáp án

**Hạt** (`BeadPatternBead`), mọi thuộc tính là số nguyên:

| Thuộc tính | Giá trị | Ghi chú |
| --- | --- | --- |
| `shape` | 0 tròn · 1 vuông · 2 tam giác · 3 tim · 4 sao (`BEAD_SHAPE_COUNT` = 5) | Không dùng hình thoi: dễ nhầm với hình vuông xoay |
| `pattern` | 0 trơn · 1 sọc · 2 ca-rô (`BEAD_PATTERN_COUNT` = 3) | Hoa văn tô bên trong thân hạt. Giá trị 2 vẽ ca-rô (không vẽ chấm) để không lẫn với nhãn số chấm |
| `dots` | 1–9 ở Khó, Siêu khó; **0 = không có nhãn chấm** ở Mầm, Thường | Số chấm vẽ trên nhãn riêng dưới hạt (xem Ghi chú cho FE) |

- `Puzzle` (`BeadPatternPuzzle`):
  - `beads: (Bead | null)[]`: chuỗi từ trái sang phải, đúng một `null` là chỗ trống.
  - `blank`: vị trí chỗ trống (không bao giờ là hạt đầu).
  - `options: Bead[4]`: 4 thẻ đôi một khác nhau.
  - `answer`: chỉ số thẻ đúng (0–3). **Biểu thức đáp án cho test server:** `GAMES["bead-pattern"].generate(s, i, d).answer`.
  - `tested: [thuộc tính, thuộc tính]`: hai thuộc tính mà các thẻ khác nhau; thuộc tính thứ ba giống nhau ở cả 4 thẻ.
  - `rules`: luật sinh của từng thuộc tính, để FE vẽ lời giải: `same` · `cycle {period}` · `step {step}` (số chấm cộng đều) · `sum` (cộng dồn) · `alternate {even, odd}` (mỗi bên là `same` hoặc `step`).
- `Answer`: `number`, số nguyên 0–3, gửi một lần mỗi câu. `isAnswer`: số nguyên 0–3. `check`: `answer === puzzle.answer`.
- Hàm phụ export từ shared: `beadPatternClues(puzzle, attr)` trả vị trí các hạt mà luật dựa vào (gần chỗ trống trước), dùng khi hiện lời giải. `beadPatternPredictions(beads)` và `beadPatternIsUnique(beads, bead)` là bộ kiểm thư viện luật (test dùng).

## Cách sinh câu đố

`rng = createRng(deriveSeed(roundSeed, index))`, chỉ số nguyên.

1. **Sinh câu nháp** theo mức (bảng Độ khó): từng thuộc tính một dãy giá trị đầy đủ theo một luật, rồi chọn chỗ trống.
2. **Chạy cả thư viện luật** lên các hạt đang hiện, từng thuộc tính một (`beadPatternPredictions`). Thư viện rộng hơn tập luật dùng để sinh ở mọi mức:
   - lặp chu kỳ `p` với mọi `p` từ 1 tới n − 1 (áp cho cả hình, hoa văn, số chấm);
   - đối xứng gương (hạt thứ i giống hạt thứ i tính từ cuối);
   - chỉ cho số chấm: cộng đều, bước tăng đều (1, 2, 4, 7…), nhân đều (tỉ số bất kỳ, kể cả 3/2), cộng dồn xuôi (a, b, a+b), cộng dồn ngược (a, b, a−b);
   - xen kẽ: dãy con cùng chẵn lẻ với chỗ trống theo một luật ở trên, dãy con còn lại (đầy đủ) khớp một luật bất kỳ.

   **Bằng chứng:** một luật chỉ được xét khi phần nó xét có ít nhất `số tham số + 1` giá trị đang hiện (luật phải được kiểm chứng ít nhất một lần; vd. chu kỳ 2 cần ≥ 3 hạt, cộng đều cần ≥ 3 số). Luật khớp mà không suy ra được chỗ trống (vd. chu kỳ 6 mà lớp của chỗ trống không còn hạt nào) thì bỏ qua. Số chấm giải bằng phân số chính xác, nên luật cho ra 4,5 hay 10 cũng tính là một dự đoán.
3. **Nhận câu nháp** khi ở **mọi** thuộc tính có ít nhất một dự đoán và **mọi** dự đoán đều bằng giá trị của hạt đúng. Không thoả thì sinh câu nháp khác bằng chính `rng`, tối đa 60 lần, rồi dùng câu dự phòng dựng tay của mức (test kiểm câu dự phòng cũng đúng một đáp án). Đo trên 10 000 seed mỗi mức: trung bình 1,00 / 1,09 / 1,21 / 1,37 lần thử, nhiều nhất 1 / 4 / 8 / 7 lần, chưa lần nào dùng câu dự phòng. Ví dụ câu bị loại: dãy chẵn 1, 3, _, 7 (cộng đều → 5, cộng dồn → 4).
4. **Dựng 4 thẻ kiểu lưới 2 × 2** trên hai thuộc tính `tested`: đáp án · sai thuộc tính thứ nhất · sai thuộc tính thứ hai · sai cả hai; thuộc tính thứ ba giữ đúng ở cả 4 thẻ. Xáo thứ tự bằng `rng.shuffle`.
   - Mỗi giá trị có mặt ở đúng hai thẻ, mỗi thẻ chung đúng một thuộc tính với hai thẻ kia: không thẻ nào "lạc loài" hay "giống nhiều nhất", phải giải cả hai thuộc tính.
   - Vì sao chỉ kiểm hai thuộc tính: muốn bắt giải cả ba thì 4 thẻ buộc phải là đáp án + ba thẻ mỗi thẻ sai một thuộc tính, khi đó đáp án mang giá trị đa số ở mọi thuộc tính và mẹo "chọn thẻ giống nhiều thẻ nhất" luôn trúng.
   - Giá trị sai: hình / hoa văn lấy một giá trị khác **có trong chuỗi** (thuộc tính không đổi thì lấy giá trị không có trong chuỗi). Số chấm lấy một lỗi hay gặp của luật: cộng đều → lố một bước / chép hạt kề / lố hai bước; lặp → số của lớp khác / đếm lệch 1; xen kẽ → lấy số của hạt kề (dãy kia) / lệch 1; cộng dồn → tưởng cộng đều / lệch 1.
   - Trong các cặp giá trị sai, chỉ chọn cặp mà thẻ đúng **không phải thẻ duy nhất có (hoặc duy nhất không có) trong chuỗi**, để mẹo "chọn hạt đã thấy" / "chọn hạt mới" không lộ đáp án.

**Vì sao đúng một đáp án:** đáp án được suy ra ở từng thuộc tính bởi mọi luật khớp trong thư viện và các luật đó đồng ý với nhau; 3 thẻ nhiễu đều sai ít nhất một thuộc tính được kiểm, nên không luật nào khớp chọn chúng.

## Độ khó

| Mức | Chuỗi | Hình / hoa văn | Số chấm | Chỗ trống |
| --- | --- | --- | --- | --- |
| Mầm | 6 hạt | Một thuộc tính lặp chu kỳ 2 (hình 2/3 số câu, hoa văn 1/3), thuộc tính kia không đổi | không có | cuối |
| Thường | 7 hạt | Hình và hoa văn đổi độc lập: một bên chu kỳ 2, bên kia chu kỳ 3 (50/50 bên nào); chu kỳ 3 có 1/4 số câu dạng x x y | không có | cuối |
| Khó | 7 hạt | Một thuộc tính lặp chu kỳ 2 hoặc 3, thuộc tính kia không đổi | Cộng / trừ đều 1 (~52 %), lặp chu kỳ 2 (~21 %) hoặc 3 (~26 %) | 40 % cuối, 60 % ở giữa |
| Siêu khó | 8 hạt (xen kẽ) · 5–6 hạt (cộng dồn) | Một thuộc tính lặp chu kỳ 3 hoặc 4 (dạng x y x z, x x y y, x y z y, x y z w), thuộc tính kia không đổi; chuỗi cộng dồn: chu kỳ 2–3 | **Xen kẽ** (~68 %): hạt chẵn một dãy, hạt lẻ một dãy, mỗi dãy cộng đều −2 … 2 (không đứng yên cả hai, không thành một dãy cộng đều chung). **Cộng dồn** (~32 %): 1 1 2 3 5 8, 1 1 2 3 5, 1 2 3 5 8, 2 1 3 4 7, 3 1 4 5 9 | luôn ở giữa |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Hai hạt thay phiên nhau; chỉ cần nhìn hạt trước nữa |
| Thường | Hai thứ cùng đổi nhưng lệch nhịp: hình nhìn lùi 2 hạt, hoa văn nhìn lùi 3 hạt |
| Khó | Có nhãn chấm phải đếm; chỗ trống hay nằm giữa nên phải nhìn cả hai phía |
| Siêu khó | Số chấm nhảy lên xuống (hai dãy lồng nhau) hoặc cộng dồn; hình / hoa văn lặp nhịp dài 3–4 |

**Độ khó đo được** (10 000 seed mỗi mức, test `khó dần theo độ khó` kiểm): "độ phức tạp" = tổng giá luật của ba thuộc tính (không đổi 0, chu kỳ p → p − 1, cộng đều 3, xen kẽ / cộng dồn 5) + 1 nếu chỗ trống ở giữa.

| Mức | Độ phức tạp TB | Thuộc tính đổi | Chỗ trống ở giữa | Phải đọc số chấm | Độ dài TB |
| --- | --- | --- | --- | --- | --- |
| Mầm | 1,00 | 1 | 0 % | 0 % | 6 |
| Thường | 3,00 | 2 | 0 % | 0 % | 7 |
| Khó | 4,39 | 2 | 59,5 % | 100 % | 7 |
| Siêu khó | 8,07 | 2 | 100 % | 100 % | 7,2 |

Mỗi mức tăng độ phức tạp ít nhất 0,9 và không chỉ số nào giảm. Số chấm nhiễu lệch đáp án trung bình 1,8 (Khó) và 1,6 (Siêu khó) chấm.

## Đảm bảo khi sinh câu đố

- Đúng một đáp án, **kiểm lại bằng cả thư viện luật** theo cách vét cạn viết riêng trong test (thử mọi giá trị cho chỗ trống, giữ giá trị làm cả dãy thoả một luật có đủ bằng chứng): ở mỗi thuộc tính chỉ đúng một giá trị được chấp nhận, là giá trị của thẻ đúng. Bộ giải của bộ sinh cũng đồng ý, không thẻ nhiễu nào qua được bộ kiểm.
- 4 thẻ đôi một khác nhau; `check` đúng với đúng một thẻ.
- Chuỗi đúng độ dài và vị trí chỗ trống của mức; hình 0–4, hoa văn 0–2, số chấm 1–9 (Khó, Siêu khó) hoặc 0 (Mầm, Thường); luật trong `rules` sinh lại đúng chuỗi đầy đủ; `beadPatternClues` chỉ trỏ vào hạt đang hiện.
- **Không có mẹo đoán:** thẻ đúng phân bố đều 4 vị trí (lệch < 2 điểm %); ở mọi thuộc tính giá trị của thẻ đúng có ở ≥ 2 thẻ (không bao giờ là thẻ "khác ba thẻ kia"); mọi thẻ chung số giá trị như nhau với ba thẻ kia; thẻ đúng là thẻ duy nhất có / không có trong chuỗi < 2 % số câu (đo được 0 / 0 / 0,7 / 0,3 %); chọn thẻ giống hạt ngay trước hoặc ngay sau chỗ trống trúng < 25 % (đo được 0 / 0 / 0,1 / 1,1 %).
- Tất định theo `(seed, index, difficulty)`; không gọi `Math.random` / `Date.now`.

Các điều trên được kiểm trong `bead-pattern.test.ts` với 10 000 seed × 4 mức (40 000 câu), chạy ~4 s.

**Mẹo còn lại, chấp nhận:** với số chấm cộng đều hoặc xen kẽ, số chấm của đáp án thường chưa có trong chuỗi, còn số chấm nhiễu (hạt kề) thì có. Chọn "số chấm mới" loại được một nửa số thẻ ở ~44 % câu Khó và Siêu khó. Đây là một phần của lời giải (dãy tăng đều không lặp số), người chơi vẫn phải giải thuộc tính thứ hai.

## Cách chấm

Server sinh lại câu bằng `generate(seed, index, difficulty)` và so `answer` với `puzzle.answer`. Một chạm, chấm một lần mỗi câu. Sai thì khoá 1,5 s (luật chung).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian = quét chuỗi + tìm luật từng thuộc tính + so 4 thẻ. Đếm chấm (Khó trở lên) tốn thêm ~0,2–0,3 s mỗi hạt cần đọc, nhờ nhãn chấm xếp kiểu mặt xúc xắc.

| Mức | Thời gian giải mỗi câu | Tỉ lệ sai | Số câu mỗi vòng 60 s (trả lời · đúng) |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 3,0–4,6 s (người lớn 1,3–2,0 s) | 10 % (người lớn 3 %) | trẻ ~13,8 · 12,4 (người lớn ~29,8 · 28,9) |
| Thường | 2,4–3,6 s | 8 % | ~17,2 · 15,8 |
| Khó | 3,8–5,4 s | 12 % | ~11,5 · 10,1 |
| Siêu khó | 5,4–7,4 s | 15 % | ~8,2 · 7,0 |

Các khoảng của người lớn không chồng nhau (Thường ≤ 3,6 s < 3,8 s ≤ Khó ≤ 5,4 s ≤ Siêu khó). Thường ~3 s đúng mục tiêu của kế hoạch (~17 câu). Siêu khó còn ~8,2 câu trả lời mỗi vòng (≥ 8); nếu chơi thử chậm hơn thì vặn núm 2 bên dưới.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `beadPattern`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 1,50 → min(1,50; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **2,05** | không khai báo | Mô phỏng cần 2,03, làm tròn lên 0,05 |
| Siêu khó | **3,35** | không khai báo | Mô phỏng cần 3,34, làm tròn lên 0,05 |

- `speedAllowanceMs`: không cần. Chuỗi và thẻ hiện đủ ngay, chạm được từ khung hình đầu, một chạm là chốt (như Đếm khối, Gấp hộp, Ô bí ẩn). Thời gian suy luận dài hơn ở Khó, Siêu khó được bù bằng hệ số.
- Cách mô phỏng (20 000 vòng 60 s mỗi người chơi, như Phấn trượt): gọi chính `generate()` và `check()`; thời gian giải đều trong khoảng ở bảng trên, sai theo tỉ lệ ở bảng (chọn một thẻ sai bất kỳ); câu sai tốn thời gian như câu đúng rồi khoá 1,5 s; giữa hai câu 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau; câu chưa xong khi hết giờ không tính. Điểm theo `pointsForCorrect` (thưởng tốc độ 1,5–8 s, combo trần × 1,5). S_d(m) = m × A_d + B_d, giải m_d = (S_Thường − B_d) ÷ A_d.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 12,4 · 1,4 | 1 537 | 464 | 1,50 | 1 | ~2 000 (72 %) |
| Người lớn · Thường | 15,8 · 1,4 | 2 025 | 735 | 1 | 1 | ~2 760 (100 %) |
| Người lớn · Khó | 10,1 · 1,4 | 1 216 | 292 | 2,03 | 2,05 | ~2 780 (101 %) |
| Người lớn · Siêu khó | 7,0 · 1,2 | 802 | 83 | 3,34 | 3,35 | ~2 770 (100 %) |
| Người lớn chọn Mầm | 28,9 · 0,9 | 3 998 | 1 863 | 0,22 | 1 | ~5 870 (212 %) |

- Trẻ 7 tuổi ở Mầm được ~72 % người lớn ở Thường, do trần hệ số Mầm = 1 (quy tắc chung). Người lớn chọn Mầm được ~212 %, cao hơn Cân não (167 %) vì câu Mầm rất ngắn; vẫn trông vào "lệch" + "Nhắc" của chủ phòng như các game khác.
- Siêu khó hệ số cao (3,35) vì không có miễn trừ và câu dài nên thưởng tốc độ gần hết (B ≈ 83). Nếu thấy hệ số này quá nhạy với sai số đo, có thể chuyển một phần sang `speedAllowanceMs` (vd. 3 000 ms như Cân não) rồi mô phỏng lại.

**Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`, chưa ghi vào `brain-test.ts`, phiên điều phối ghi): **1 750**. Theo cách của GDD: 4 000 lượt người lớn ở Thường, 40 s của nhóm Phân tích, thời gian đều ±20 % quanh 3,0 s (2,4–3,6 s), sai 8 %, khoá 1,5 s, hiệu ứng 0,25–0,35 s, câu dở khi hết giờ không tính: ~11,3 câu · 10,4 đúng · 0,9 sai, trung bình 1 774 điểm, làm tròn 50 → 1 750. Nhanh hơn 30 % (2,1 s) được 2 616 điểm = **× 1,49**; chậm hơn 40 % (4,2 s) được 1 155 điểm = **× 0,66** (chia cho điểm chuẩn). Cùng tầm Cân não (1 850, 3,0 s · 8 %). Script mô phỏng không lưu trong repo.

Núm chỉnh sau chơi thử (chỉ sửa số trong `bead-pattern.ts`, rồi mô phỏng lại hệ số và điểm chuẩn):

1. Thường quá dễ: tăng tỉ lệ chu kỳ 3 dạng x x y (đang 1/4), hoặc cho chỗ trống ở giữa 20 % số câu.
2. Siêu khó quá chậm (< 8 câu mỗi vòng): bớt chu kỳ 4 (đang 1/2 số câu xen kẽ), hoặc bước xen kẽ chỉ −1 … 1.
3. Khó và Thường quá gần: Khó bỏ chỗ trống ở cuối (đang 40 %).

## Ghi chú cho FE

Toạ độ trong khung 720 × 1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Dải trên | y 0–250 | Để trống cho khung chung và huy hiệu khoá (tới y ≈ 225). Không vẽ gì của câu đố ở đây |
| Chuỗi hạt | tâm hạt y ≈ 420; mỗi hạt một ô 80 px (8 hạt = 640 px, x 40–680); chuỗi ngắn hơn thì căn giữa, ô tối đa 96 px | Sợi dây phấn ngang qua tâm hạt; hạt Ø ~64 px |
| Nhãn chấm | ngay dưới mỗi hạt, y ≈ 470–530, nhãn vuông bo góc 52 × 52 px, nối với hạt bằng một nét dây ngắn | Chỉ vẽ khi `dots > 0` (Khó, Siêu khó) |
| 4 thẻ | lưới 2 × 2: x 45–345 và 375–675, y 690–910 và 940–1160 (mỗi thẻ 300 × 220 px) | Mỗi thẻ: hạt to Ø ~120 px + nhãn chấm 72 px bên dưới (khi có). Cả thẻ là vùng chạm |
| Thanh khoá | 420 × 14 tại (150, 1206) | Khi sai |

- **Hình hạt** (5 hình, tách được bằng đường viền, không cần màu): tròn, vuông (bo góc nhỏ), tam giác đỉnh hướng lên, tim, sao 5 cánh mập. Mỗi hình có một màu cố định (màu chỉ là gợi ý phụ, không mang thông tin riêng; **không được** đổi màu độc lập với hình, vì như vậy thành thuộc tính thứ tư). ui-designer chốt bảng màu, viền phấn sáng để nổi trên cả bảng sáng lẫn tối.
- **Hoa văn** (tô bên trong thân hạt, cắt theo hình): trơn = tô đặc; sọc = 3–4 sọc chéo 45°; ca-rô = bàn cờ 5 × 5 ô theo cỡ hạt (ô ~13 px trên hạt 64 px), cùng màu sẫm hơn của hạt. Không dùng hoa văn chấm để khỏi lẫn với nhãn số chấm.
- **Số chấm**: vẽ trên **nhãn riêng** dưới hạt, không vẽ lên thân hạt, để không lẫn với hoa văn chấm. Nền nhãn `--card`, chấm màu `--foreground` Ø ≥ 9 px (trên thẻ ≥ 12 px), xếp như mặt xúc xắc trong lưới 3 × 3 (1–6 theo mặt xúc xắc quen thuộc; 7 = 6 + giữa; 8 = đủ lưới bỏ giữa; 9 = đủ lưới) để đọc nhanh không cần đếm từng chấm. Không dùng chữ số.
- **Chỗ trống**: vòng nét đứt đúng cỡ hạt có dấu "?" bằng phấn, nhãn chấm nét đứt bên dưới (khi có). Nhịp sáng nhẹ 1,2 s.
- Bàn phím (tuỳ chọn): phím 1–4 chọn thẻ theo thứ tự trái → phải, trên → dưới; bỏ qua phím lặp do giữ phím và khi con trỏ đang ở ô nhập chữ (ô chat).

| Trạng thái | Hiển thị |
| --- | --- |
| Câu mới | Hạt xâu vào dây lần lượt từ trái sang (tổng ≤ 200 ms), thẻ hiện mờ → rõ 120 ms; nhận chạm ngay từ khung hình đầu |
| Đúng | Hạt của thẻ vừa chọn bay lên lấp chỗ trống (200 ms), cả chuỗi nảy nhẹ; ~300 ms sau câu mới |
| Sai / khoá | Xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`:

- Thẻ vừa chạm: X đỏ, rung 200 ms, rồi mờ 50 %. Thẻ đúng: viền `--primary` + dấu tích; hạt đúng hiện ngay vào chỗ trống với viền `--primary`.
- Với **mỗi thuộc tính trong `tested`** có luật khác `same`, khoanh các hạt `beadPatternClues(puzzle, attr)` và nối chúng với chỗ trống bằng nét phấn cong phía dưới nhãn (y 540–600, dưới chuỗi): `cycle` → khoanh hạt cùng nhịp, ghi biểu tượng "↺ p" (số chu kỳ); `step` → ghi "+1" / "−1" giữa các nhãn chấm kề; `sum` → ghi "a + b" dưới hai nhãn được khoanh; `alternate` → tô nhạt mọi hạt cùng chẵn lẻ với chỗ trống. Chỉ dùng số và ký hiệu, không dùng chữ.
- Hai thuộc tính khoanh hai kiểu nét khác nhau (liền cho thuộc tính thứ nhất, đứt cho thứ hai), không chỉ khác màu.
- Mọi thứ nằm dưới y 250, không bị huy hiệu khoá che.

### Hiệu ứng

Âm: tiếng "tách" của hạt khi đúng, "bụp" trầm khi sai. Giảm chuyển động (`prefersReducedMotion()`): bỏ xâu lần lượt, bay, nảy, rung, nhịp sáng của chỗ trống; giữ phần đánh dấu tĩnh (viền, dấu tích, X, nét nối lời giải).

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M23 vẽ câu thật `generate(777, i, d)` và giữ nguyên bố cục ở trên (bảng, chuỗi y 420, nhãn chấm 52, thẻ 300 × 220, thanh khoá). Việc frontend-dev cần chỉnh:

- **Màu hạt 5 bậc sáng (chốt):** thay `SHAPE_TONES` (4 màu gần cùng độ sáng) bằng hằng riêng của game: tròn `#8ec5ff` (L 0,53), vuông `#3fae7a` (0,33), tam giác `#8c74e0` (0,23), tim `#f08ba0` (0,40), sao `#ffd166` (0,68). Ảnh xám vẫn khác nhau; màu vẫn đi theo hình, hình là phân biệt chính. Dùng chung cho `BeadPatternHowTo.tsx`.
- **Hoa văn:** `PATTERN_ALPHA` 0,4 → 0,5 (sọc / ca-rô tương phản 2,1–3,0 : 1 với thân hạt trên cả 5 màu).
- **Cỡ hạt chuỗi:** `min(72, round(ô × 0,8 / 8) × 8)`: Ø 72 khi 6–7 hạt, Ø 64 khi 8 hạt.
- **Vòng lời giải theo cỡ hạt:** hạt r = Ø/2 + 9 (nét liền) / + 16 (nét đứt); nhãn chấm vuông 66 / 74; hạt đúng ở chỗ trống r = Ø/2 + 8, nhãn của nó viền vàng vuông 60.
- **Hình học nét lời giải:** có chấm anchor 540, dip 564 / 606, ký hiệu 590 / 636; không chấm anchor 470, dip 520 / 582, ký hiệu 548 / 612.
- **Ký hiệu lặp:** vẽ mũi tên vòng bằng nét (cung r 12) + số chu kỳ, không dùng ký tự "↺" (font không có).
- **Tô nhạt xen kẽ:** cột rộng ô − 10, y 370, cao 170 / 100, `--chalk` 16 %.
- **Số phím 1–4 trên thẻ (mới, chỉ máy tính có chuột):** ô 38 × 38 bo 9 tại (x + 14, y + 14) của thẻ, nền `--muted`, viền `--card-foreground` 2,5, số Baloo 2 cỡ 24.
- **Thẻ đúng:** viền trong mực 12 + `--primary` 7, huy hiệu ✓ r 24 tại (x + 274, y + 26); thẻ sai ✗ nền `--destructive` cùng chỗ, mờ 50 %; thẻ khác 35 %.
- **`BeadPatternHowTo.tsx`:** viewBox `0 0 560 360`, dây y 72, hạt Ø 56 x 70…406, chỗ trống x 490; thẻ 150 × 92 tâm (190, 196) (370, 196) (190, 302) (370, 302); mũi tên `M262 150 C330 120 420 128 476 106`.

## Ghi chú cho BE

Không. Đáp án một số nguyên 0–3, chấm một lần mỗi câu như Kẻ lạc đàn. `generate` có vòng thử lại nhưng tất định và rẻ (~0,02–0,04 ms một câu).

## Tác động Kiểm tra não

Nhóm Phân tích thêm một game, nên theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não) commit đăng ký phải thay số giữ chỗ 1 500 bằng **1 750**, tăng `BRAIN_TEST_RULES_VERSION` (một lần cho cả đợt CR-013), và thêm dòng vào bảng điểm chuẩn ở GDD: "Phân tích · Chuỗi quy luật · 40 s · 3,0 s · 8 % · 11,3 · 10,4 · **1 750** · × 1,49 · × 0,66".

## Chỗ khác kế hoạch (mục 3.3)

1. **Khó bỏ "nhân đôi":** trong 1–9 chỉ có đúng một dãy 1, 2, 4, 8 (4 hạt). Thay bằng cộng / trừ đều 1 trên 7 hạt và lặp chu kỳ 2–3. Thư viện kiểm vẫn có luật nhân đều.
2. **Siêu khó cộng dồn ngắn hơn:** trong 1–9 chỉ có 5 dãy cộng dồn dài ≥ 5 hạt, nên chuỗi cộng dồn dài 5–6 hạt; chuỗi xen kẽ 8 hạt.
3. **Số chấm chỉ có từ Khó** (Mầm, Thường `dots = 0`), đúng tinh thần bảng của kế hoạch.
4. **Khó, Siêu khó chỉ hai thuộc tính đổi** (số chấm + hình hoặc hoa văn), thuộc tính thứ ba không đổi: thẻ chỉ kiểm được hai thuộc tính mà không lộ mẹo đa số (mục Cách sinh, bước 4).
5. **Thường:** bên nào chu kỳ 2, bên nào chu kỳ 3 chia 50/50 (kế hoạch ghi hình 2, hoa văn 3).
6. `Puzzle` có thêm `blank`, `answer`, `tested`, `rules` ngoài `beads`, `options`.

## Câu hỏi mở

1. ~~**Hoa văn "chấm" và nhãn số chấm** dễ nhầm.~~ **Đã chốt (2026-10-20, điều phối):** hoa văn thứ ba vẽ **ca-rô** ngay từ đầu (chỉ đổi cách vẽ ở FE, bộ sinh không đổi).
2. **Hệ số Siêu khó 3,35** cao nhất các game Phân tích. Giữ, hay chuyển một phần sang `speedAllowanceMs`? Đề xuất: giữ tới buổi chơi thử.
3. **Người lớn chọn Mầm được ~212 %** điểm Thường. Theo luật chung (Mầm ≤ 1) không hạ thêm được; nếu thấy lạm dụng thì cân nhắc Mầm 7 hạt.
