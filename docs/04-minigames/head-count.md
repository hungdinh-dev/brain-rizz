# Đếm sĩ số (`head-count`)

- Nhóm: Tính toán
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/head-count/` (logic + test, đã làm), `apps/web/src/games/head-count/` (scene + chữ hiển thị, đã làm)
- Nguồn: [CR-013](../00-tracking/change-requests.md#cr-013), [kế hoạch mở rộng minigame § 3.4](../01-product/minigame-expansion.md#34-đếm-sĩ-số-head-count-tính-toán). Chỉ mượn cơ chế "đếm vào, đếm ra" của trò Đếm Vịt Vào Chuồng (Pumer). Tên, nhân vật và chủ đề lớp học bảng phấn là của Brain Rizz.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M26** (HeadCountMobile, HeadCountLevels, HeadCountStates, HeadCountHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Lớp học có sẵn vài bạn, rồi tường che lớp lại. Các bạn đi vào, đi ra qua cửa. Cửa đóng thì chạm thẻ số bạn còn trong lớp. Ở Siêu khó có thầy giáo đi lẫn vào, thầy không tính.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhớ số bạn trong lớp
  2. Bạn vào thì cộng, ra thì trừ
  3. Chạm số bạn còn lại
- **Điều khiển:** Chạm thẻ số (điện thoại) · Click chuột vào thẻ (máy tính) · Bàn phím: không dùng ở MVP.
- **Hình minh hoạ:** ba khung nối bằng mũi tên phấn.
  - Trái: lớp mở, 3 bạn ngồi ở bàn, bảng đen ghi "3".
  - Giữa: tường đã che lớp, cửa mở. Bên trái, 2 bạn đi về phía cửa (mũi tên vào cửa, nhãn "+2"). Bên phải, 1 bạn từ cửa đi ra (mũi tên rời cửa, nhãn "−1").
  - Phải: cửa đóng, hàng thẻ 2 3 4 5. Thẻ 4 khoanh phấn vàng, có bàn tay chỉ vào.
  - Góc dưới, cỡ nhỏ: dáng thầy giáo (cao, đeo kính, ôm sách) có dấu gạch chéo, nhắc luật Siêu khó.
- **Câu nhắc lúc đếm ngược:** "Vào thì cộng, ra thì trừ!"
- **Câu nhắc theo mức** (qua `levelHints`):
  - Khó: "Có lượt vừa vào vừa ra!"
  - Siêu khó: "Thầy giáo không tính vào sĩ số!"
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "3–4 lượt · từng bạn" · Thường "5 lượt · có cặp" · Khó "6 lượt · vừa vào vừa ra" · Siêu khó "7 lượt · có thầy giáo".
- **Thẻ game** (màn Chọn game, ≤ 8 từ):
  - vi: **Đếm sĩ số**, "Bạn vào, bạn ra: còn mấy bạn?"
  - en: **Head Count**, "Kids in, kids out: how many left?"

## Câu đố & đáp án

`Puzzle` (kiểu `HeadCountPuzzle`) = `{ start, teacherAtStart, events, showMs, stepMs, options, answerIndex }`:

| Trường | Ý nghĩa |
| --- | --- |
| `start` | Số bạn trong lớp lúc đầu, không tính thầy. Bảng đen trong lớp ghi số này. |
| `teacherAtStart` | Chỉ Siêu khó có thể `true`: thầy đứng trong lớp từ đầu, lượt có thầy là thầy đi ra. |
| `events: HeadCountEvent[]` | Các lượt theo thứ tự. Mỗi lượt là `{ in, out, teacher? }`. `in` là số bạn đi vào (0–2), `out` là số bạn đi ra (0–2). `teacher` có giá trị `"in"` hoặc `"out"` khi thầy cũng đi qua cửa ở lượt đó; không có trường này nghĩa là không có thầy. |
| `showMs` | Thời gian xem lớp lúc đầu, gồm cả lúc tường hạ: 1 200 ms ở Mầm, 1 000 ms ở các mức khác. |
| `stepMs` | Thời gian một lượt, mọi lượt như nhau: 900 / 700 / 550 / 450 ms. |
| `options` | 4 thẻ từ trái sang phải. Là 4 số nguyên liên tiếp tăng dần trong [1, 9] và có đáp án. |
| `answerIndex` | Chỉ số thẻ đúng (0–3). |

- **Dòng thời gian** (ms, tính từ lúc scene hiện câu):
  - pha xem lớp: `[0, showMs)`;
  - lượt `k`: `[headCountEventStartMs(p, k), … + stepMs)`, với `headCountEventStartMs(p, k)` = `showMs + k × stepMs`;
  - từ `headCountInputAtMs(p)` = `showMs + events.length × stepMs`: cửa đóng, hiện thẻ, được chạm.
- **Đáp án đúng** = `start + Σin − Σout`. Thầy không tính. `headCountTally(p)` trả về sĩ số sau từng lượt (phần tử 0 là `start`, phần tử cuối là đáp án), dùng để hiện đáp án khi sai.
- **Hằng số:**
  - `HEAD_COUNT_MIN_IN_ROOM = 1`, `HEAD_COUNT_MAX_IN_ROOM = 9`: lớp có 9 bàn (3 × 3), không bao giờ trống.
  - `HEAD_COUNT_OPTIONS = 4`.
  - `HEAD_COUNT_LEVELS`: bảng tham số ở mục Độ khó.
- **`Answer`** (kiểu `HeadCountAnswer`) là `number`: chỉ số thẻ đã chạm (0–3). Chạm một lần là nộp.
- `check(p, a)` đúng khi và chỉ khi `a === p.answerIndex`. `isAnswer(v)` nhận số nguyên 0–3.
- Test phía server lấy đáp án đúng bằng `GAMES["head-count"].generate(s, i, d).answerIndex`. Số bạn còn lại là `.options[.answerIndex]`.

## Cách sinh câu đố

Mọi bước dùng `rng = createRng(deriveSeed(roundSeed, index))` và chỉ dùng số nguyên.

1. Bốc số lượt `n`, sĩ số đầu `start` và (chỉ Siêu khó) `teacherAtStart` với xác suất 1/2.
2. **Xếp loại cho từng lượt.** Vị trí các lượt đặc biệt chọn đều trong `n` lượt:
   - **vừa vào vừa ra**: vào `i`, ra `j`, `i ≠ j`. Lượt loại này luôn đổi sĩ số, nên bỏ sót một dòng là sai;
   - **có thầy**;
   - **bắt buộc 2 bạn**: 2 bạn cùng vào hoặc cùng ra;
   - **thường**: 1 bạn, hoặc 2 bạn với trọng số 30 %, đi vào hoặc đi ra.

   Lượt có thầy: thầy đi một mình (1/2), hoặc có 1–2 bạn đi cùng hướng với thầy. Hướng của thầy đổi luân phiên: đang trong lớp thì ra, ở ngoài thì vào.
3. **Bảng với tới.** Đi ngược từ lượt cuối, tính các sĩ số cuối có thể đạt được từ mỗi (lượt, sĩ số). Chỉ cho phép cách đi giữ sĩ số trong [1, 9] **ở mọi thời điểm**: số bạn ra ≤ sĩ số − 1 và số bạn vào ≤ 9 − sĩ số, kể cả khi lượt vừa vào vừa ra có dòng ra đi trước hay dòng vào đi trước.
4. **Chọn thẻ trước, rồi mới cho các bạn đi.** Liệt kê mọi cặp (thẻ nhỏ nhất `lo`, vị trí đáp án `r`) mà `lo + r` đạt được từ `start`, rồi chọn đều một cặp. `lo` nằm trong [1, 3] ở Mầm, [1, 6] ở các mức khác. Nhờ vậy thẻ đúng nằm đều ở 4 vị trí, và đáp án không dính với `start`.
5. **Đi xuôi.** Ở mỗi lượt, chọn theo trọng số một cách đi hợp lệ mà từ đó vẫn tới được đáp án đã chọn. Bảng ở bước 3 bảo đảm luôn còn ít nhất một cách đi.
6. `options = [lo, lo + 1, lo + 2, lo + 3]`, `answerIndex = r`.

- **Đúng một đáp án:** 4 thẻ là 4 số liên tiếp khác nhau. Bước 5 dừng đúng ở `lo + r` nên chỉ một thẻ bằng `start + Σin − Σout`.
- **Vì sao nhiễu lệch tới ±3, không chỉ ±1/±2 như kế hoạch:** nếu 3 thẻ nhiễu chỉ lệch ±1, ±2 thì đáp án không bao giờ là số nhỏ nhất hay lớn nhất trong 4 thẻ. Người chơi bỏ ngay 2 thẻ đầu mút và đoán đúng 50 %. 4 số liên tiếp thì đáp án ở đâu cũng được. Thẻ nhiễu luôn có ít nhất một số lệch đúng 1 (đếm sót hoặc đếm thừa một bạn), và lệch xa nhất là 3.
- **Thầy đúng một lượt** (số lẻ): nếu thầy vào rồi ra thì người lỡ đếm cả thầy vẫn ra đúng số, bẫy mất tác dụng. Với một lượt, đếm nhầm thầy luôn lệch đúng 1, và số lệch đó có trong thẻ ở ~76 % số câu.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | Sĩ số đầu 2–3 · 3–4 lượt · mỗi lượt đúng 1 bạn · 900 ms/lượt · xem 1,2 s · thẻ thấp nhất 1–3 | Từng bạn một đi vào hoặc đi ra, chậm |
| Thường | Sĩ số đầu 3–5 · 5 lượt · ≥ 1 lượt 2 bạn (còn lại 2 bạn với trọng số 30 %) · 700 ms · xem 1 s · thẻ 1–9 | Có lượt 2 bạn đi cùng |
| Khó | Sĩ số đầu 3–6 · 6 lượt · 1–2 lượt **vừa vào vừa ra** · ≥ 1 lượt 2 bạn · 550 ms | Có lúc một nhóm vào và một nhóm ra cùng lúc |
| Siêu khó | Sĩ số đầu 4–7 · 7 lượt · 2 lượt vừa vào vừa ra · ≥ 1 lượt 2 bạn · **thầy giáo** đi đúng 1 lượt (một mình hoặc kèm 1–2 bạn cùng hướng) · 450 ms | Nhanh nhất; thầy đi lẫn vào, có khi đứng trong lớp từ đầu rồi đi ra |

**Khác kế hoạch:**

- **Mầm có 3–4 lượt, sĩ số đầu 2–3** (kế hoạch: 3 lượt, 2 bạn). Ở Mầm mỗi lượt đúng 1 bạn đi, nên chẵn/lẻ của đáp án bằng chẵn/lẻ của (sĩ số đầu + số lượt). Nếu cố định 2 bạn và 3 lượt thì đáp án **luôn lẻ**, và chỉ có ~12 câu khác nhau. Bản hiện tại có 81 câu khác nhau trên 10 000 seed.
- Nhiễu lệch tới ±3, và thầy đi đúng một lượt (giải thích ở mục trên).
- Có thêm pha xem lớp `showMs` (kế hoạch chỉ tính thời gian các lượt).

Độ khó đo được (10 000 câu mỗi mức):

| Mức | Lượt / giây | Bạn qua cửa mỗi câu | Người qua cửa / giây, min–max (TB) | Phép cộng/trừ mỗi câu (TB) | Lượt vừa vào vừa ra (TB) | Thầy | Trình chiếu | Câu khác nhau |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | 1,11 | 3–4 | 1,11 | 3,5 | 0 | 0 | 3,9–4,8 s (TB 4,34) | 81 |
| Thường | 1,43 | 6–10 (TB 7,4) | 1,71–2,86 (2,11) | 5,0 | 0 | 0 | 4,5 s | 4 130 |
| Khó | 1,82 | 9–14 (TB 11,2) | 2,73–4,24 (3,40) | 7,5 | 1,5 | 0 | 4,3 s | 9 566 |
| Siêu khó | 2,22 | 11–16 (TB 12,8) | 3,81–5,40 (4,38) | 8,5 | 2 | 1 | 4,15 s | 9 969 |

- **Các mức không chồng nhau** ở nhịp lượt (cố định theo mức), số lượt (mức sau luôn có nhiều lượt hơn mức trước ở mọi câu) và loại lượt: mỗi mức thêm đúng một thứ mới (2 bạn → vừa vào vừa ra → thầy).
- Số người qua cửa mỗi giây chỉ chồng nhẹ ở đầu mút giữa hai mức kề nhau.
- Trình chiếu ở Khó và Siêu khó **ngắn hơn** Thường: độ khó nằm ở nhịp và mật độ, không ở thời gian xem.

## Đảm bảo khi sinh câu đố

Kiểm bằng `head-count.test.ts` (12 ca, ~6 s). Bộ mẫu: 2 500 câu mỗi mức × 4 mức = 10 000 câu; riêng ca "mẹo đoán" dùng thêm 4 000 câu mỗi mức.

- **Tất định:** cùng (seed, index, độ khó) thì ra cùng câu. Bộ mẫu đủ đa dạng: ≥ 60 câu khác nhau ở Mầm, ≥ 1 500 ở Thường, ≥ 2 000 ở Khó và Siêu khó.
- **Đúng một đáp án:** `check` chỉ đúng ở `answerIndex`. `options[answerIndex]` = `start + Σin − Σout` = phần tử cuối của `headCountTally`.
- **Thẻ:** 4 số nguyên liên tiếp tăng dần, đôi một khác nhau, trong [1, 9] (không âm). Thẻ nhiễu lệch 1–3 và luôn có thẻ lệch đúng 1.
- **Sĩ số không bao giờ âm**, không bao giờ quá 9 bàn, **ở mọi thời điểm**, kể cả giữa lượt vừa vào vừa ra. **Không lượt nào ra nhiều hơn số đang có** (ra < sĩ số đang có).
- **Luật từng mức:**
  - mỗi lượt có ít nhất 1 bạn hoặc có thầy; số bạn mỗi hướng ≤ 2 (Mầm: đúng 1 bạn);
  - lượt vừa vào vừa ra thì vào ≠ ra; số lượt loại này và số lượt 2 bạn đúng bảng tham số;
  - thầy chỉ có ở Siêu khó, đúng 1 lượt, đúng hướng luân phiên, bạn đi cùng thì cùng hướng.
- **Không có mẹo đoán** (đoán mò = 25 %):
  - mỗi vị trí là thẻ đúng 21–29 % số câu; hai thẻ giữa 45–55 %;
  - "lấy sĩ số đầu", "chỉ đếm bạn vào", "chỉ đếm bạn ra" đều đúng < 30 %. Cách tính: thẻ có số đó thì chạm, không có thì chạm bừa;
  - Siêu khó: "đếm cả thầy" không bao giờ ra đúng số (đúng < 10 %, chỉ nhờ chạm bừa), và thẻ bẫy có mặt > 65 % số câu.
- **Khó dần (đo được):** theo mức, số lượt (min mức sau ≥ max mức trước), nhịp lượt, người qua cửa mỗi giây và số phép cộng/trừ đều tăng; lượt vừa vào vừa ra, cỡ nhóm và số lượt có thầy không giảm. Hệ số điểm không giảm, Thường = 1.
- **Dòng thời gian:** `speedAllowanceMs` = `headCountInputAtMs` = `showMs + n × stepMs`, nhỏ hơn 1/8 vòng.
- **`isAnswer`** nhận 0–3. Nó từ chối −1, 4, 1,5, `NaN`, vô cực, chuỗi, `null`, `undefined`, `true`, mảng, đối tượng. `check` từ chối chỉ số ngoài thẻ.

Tỉ lệ đúng của các cách đoán (10 000 câu mỗi mức):

| Mức | Thẻ đúng ở vị trí 0 / 1 / 2 / 3 | Lấy sĩ số đầu | Chỉ đếm vào | Chỉ đếm ra | Đếm lượt thay vì đếm bạn | Đếm cả thầy |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 25,0 / 25,7 / 24,4 / 24,9 % | 25,0 % | 20,6 % | 15,8 % | (mỗi lượt 1 bạn nên đây là cách đếm đúng) | — |
| Thường | 24,4 / 25,5 / 25,2 / 25,0 % | 25,2 % | 21,3 % | 24,3 % | 33,4 % | — |
| Khó | 24,6 / 26,0 / 24,7 / 24,7 % | 25,1 % | 25,0 % | 25,0 % | 30,6 % | — |
| Siêu khó | 24,1 / 26,2 / 25,5 / 24,2 % | 25,4 % | 25,0 % | 25,0 % | 29,5 % | 6,1 % (thẻ bẫy có mặt 75,8 %) |

- "Đếm lượt thay vì đếm bạn" đúng hơn đoán mò một chút ở Thường, vì có câu mà lượt 2 bạn vào và lượt 2 bạn ra bù nhau. Đây là cách đếm đúng một nửa, vẫn phải theo dõi hướng đi, nên giữ.
- **Mầm có mẹo chẵn/lẻ:** biết số lượt thì loại được 2 thẻ, vì mỗi lượt đúng 1 bạn theo luật đã duyệt. Đây cũng là một phép tính đúng; trẻ 7 tuổi hầu như không dùng. Chấp nhận.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Mọi số dưới đây là mô hình và mô phỏng, phải đo lại sau buổi chơi thử.

| Mức | Thời gian mỗi câu | Tỉ lệ sai mục tiêu | Câu / vòng 60 s | Đúng / vòng |
| --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | trình chiếu 3,9–4,8 s + chọn ~2,2 s + chuyển 0,3 s ≈ 6,9 s | 10 % | 8,1 | 7,3 |
| Thường | 4,5 + ~1,5 + 0,3 ≈ 6,3 s | 8 % | 9,0 | 8,2 |
| Khó | 4,3 + ~1,8 + 0,3 ≈ 6,4 s | 15 % | 8,7 | 7,4 |
| Siêu khó | 4,15 + ~2,1 + 0,3 ≈ 6,6 s | 25 % | 8,2 | 6,2 |

- "Chọn" là phần sau khi cửa đóng: cộng nốt lượt cuối, tìm số trên 4 thẻ xếp tăng dần, chạm một lần. Phần lớn phép tính đã làm trong lúc xem.
- Các mức không chồng nhau ở phần chọn (2,2 s ở trẻ em; 1,5 / 1,8 / 2,1 s ở người lớn) và ở tải theo dõi (bảng Độ khó).
- Siêu khó vẫn còn ~8,2 câu mỗi vòng (≥ 8).
- Thời gian mỗi câu gần như bằng nhau ở mọi mức, vì trình chiếu chiếm ~70 %. Khó hơn thì sai nhiều hơn, chứ không chậm hơn nhiều.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `headCount`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | `showMs + n × stepMs` = 3 900–4 800 | Mô phỏng trẻ 7 tuổi cần 1,29 → min(1,29; 1) = 1 |
| Thường | 1 | 4 500 | Mốc so sánh |
| Khó | **1,25** | 4 300 | Mô phỏng cần 1,254, làm tròn tới 0,05 |
| Siêu khó | **1,75** | 4 150 | Mô phỏng cần 1,728, làm tròn tới 0,05 |

- **`speedAllowanceMs(puzzle)`** = `headCountInputAtMs(puzzle)`: toàn bộ pha xem lớp và các lượt, lúc chưa có thẻ để chạm. Thưởng tốc độ chỉ tính từ lúc cửa đóng.
- **Cách mô phỏng:** 20 000 vòng 60 s mỗi người chơi.
  - Câu đố sinh bằng chính `generate()`. Điểm tính bằng `pointsForCorrect` (miễn trừ, trần combo × 1,5).
  - Thời gian chọn ở bảng trên, dao động đều ±25 %. Giữa hai câu có 0,25–0,35 s hiệu ứng, tính vào thời gian trả lời của câu sau.
  - Câu sai tốn trọn thời gian rồi khoá 1,5 s. Câu dở khi hết giờ không tính.
  - Điểm vòng tuyến tính theo hệ số, nên giải ra hệ số để bằng điểm người lớn ở Thường.

| Người chơi | Câu · đúng / vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Điểm vòng với hệ số của game | Với hệ số chung 0,8 / 1 / 1,25 / 1,5 |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi ở Mầm | 8,1 · 7,3 | 8,6 | 42,6 | 1,29 | ~1 220 (83 %) | ~1 050 (71 %) |
| Người lớn ở Thường | 9,0 · 8,2 | 10,0 | 47,9 | 1 | ~1 470 (100 %) | ~1 470 (100 %) |
| Người lớn ở Khó | 8,7 · 7,4 | 8,6 | 45,7 | 1,25 | ~1 470 (100 %) | ~1 470 (100 %) |
| Người lớn ở Siêu khó | 8,2 · 6,2 | 6,8 | 43,4 | 1,73 | ~1 490 (101 %) | ~1 320 (89 %) |
| Người lớn chọn Mầm (chọn ~1,0 s, sai 2 %) | 10,1 · 9,9 | 12,7 | 50,0 | 0,66 | ~1 900 (129 %) | ~1 650 (112 %) |

- **Độ nhạy** (cùng hệ số, % điểm người lớn ở Thường):
  - trẻ ở Mầm sai 5 % được 91 %, sai 15 % được 76 %;
  - Thường sai 4 % được 108 %, sai 12 % được 93 %;
  - Khó sai 10 % được 110 %, sai 20 % được 90 %;
  - Siêu khó sai 20 % được 111 %, sai 30 % được 92 %.
- **Trẻ ở Mầm chỉ được ~83 %** dù hệ số 1, vì trình chiếu Mầm dài (900 ms mỗi lượt). Luật "Mầm = min(mô phỏng, 1)" không cho nâng hệ số. Giống Ai vừa biến mất (78 %).
- Script mô phỏng không lưu trong repo. Đổi tham số thì chạy lại theo đúng các bước trên.

### Điểm chuẩn Kiểm tra não

**Đề xuất `BRAIN_TEST_REFERENCE_SCORE["head-count"]` = 1 050.** Điều phối điền vào `brain-test.ts` và thêm dòng vào bảng ở GDD.

- **Cách tính** theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não):
  - 4 000 lượt người lớn ở Thường, trong 45 s của nhóm Tính toán;
  - câu đố từ `generate()`, miễn trừ từ `speedAllowanceMs` (4 500 ms);
  - trình chiếu 4,5 s (cố định) + chọn 1,5 s dao động đều ±20 %, sai 8 %;
  - câu sai tốn trọn thời gian rồi khoá 1,5 s, giữa hai câu 0,25–0,35 s, câu dở khi hết giờ không tính.
- **Kết quả:**
  - ~6,7 câu · 6,2 đúng · 0,5 sai mỗi lượt, trung bình 1 068 điểm. Một luồng ngẫu nhiên khác ra 1 061; 20 000 lượt ra 1 059.
  - Làm tròn tới 50 được **1 050**. Các game Tính toán khác được 1 100–1 250.
- **Nhanh hơn 30 % được × 1,06, chậm hơn 40 % được × 0,84.** Chỉ phần chọn nhanh hay chậm được, còn 4,5 s trình chiếu là cố định. Vì thế khoảng cách giữa người nhanh và người chậm hẹp hơn cả các game Ghi nhớ (× 1,15–1,23). Ở game này kỹ năng thể hiện qua **tỉ lệ đúng**: sai 4 % thay vì 8 % được ~108 %, sai 12 % được ~93 %. Xem "Câu hỏi mở".

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên. Chỉ sửa số trong `HEAD_COUNT_LEVELS`; đổi thì sửa bảng Độ khó, chạy lại test và tính lại hệ số:

1. Khó hoặc Siêu khó sai quá nhiều (> 25 % / > 35 %): giảm `pairPct` từ 30 xuống 15–20, rồi mới tăng `stepMs` (Khó 600, Siêu khó 500).
2. Trẻ ở Mầm sai > 15 %: `stepMs` Mầm 1 000.
3. Thường quá dễ (sai < 4 %): `pairPct` Thường 40 hoặc `stepMs` 650.

## Ghi chú cho FE

Scene không vẽ chữ, chỉ vẽ hình người, cửa, chữ số trên bảng và trên thẻ, biểu tượng. `locales.ts`: tên, các bước và câu nhắc như mục Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `HeadCountPuzzle`, `HeadCountEvent`, `HeadCountAnswer`, `HEAD_COUNT_MAX_IN_ROOM` (9 bàn), `HEAD_COUNT_OPTIONS`, `headCountEventStartMs`, `headCountInputAtMs`, `headCountTally`, `WRONG_ANSWER_LOCK_MS`.

### Scene chạy theo dòng thời gian của Puzzle

- Lấy mốc `t0` khi câu hiện ra (sau khung hình đầu tiên). Mỗi khung hình tính `t = now − t0` và **suy ra trạng thái từ `t`**: pha xem lớp, đang ở lượt `k = floor((t − showMs) / stepMs)` với tiến độ trong lượt, hay đã tới `headCountInputAtMs`.
- Không cộng dồn theo khung hình, không xếp tween nối đuôi nhau. Máy chậm hay rớt khung thì nhảy tới đúng trạng thái, không trễ dần.
- Trước `headCountInputAtMs(p)` thì bỏ qua mọi lần chạm, không tính sai.
- Ẩn tab giữa lúc trình chiếu: quay lại thì chiếu lại câu từ đầu (người chơi đã lỡ lượt). Đang chờ chọn thì giữ nguyên.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, chiếu câu đó từ đầu. Hết giờ vòng giữa câu: dừng, không gửi gì.

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Dải trên cùng | y 0–225 | Để trống cho huy hiệu khoá; chỉ có biểu tượng pha nhỏ (mắt → bước chân → ngón tay) ở góc trái trên. |
| Lớp học | x 40–680, y 260–760 | Bảng đen trên cùng ghi `start`. 9 bàn 3 × 3; `start` bạn ngồi ở `start` bàn đầu theo thứ tự cố định (hàng giữa trước). Thầy đứng cạnh bảng nếu `teacherAtStart`. |
| Tường trước + cửa | phủ đúng vùng lớp; cửa x 300–420, y 560–760 | Tường hạ xuống che lớp ở cuối pha xem. Cửa mở suốt các lượt, đóng ở `headCountInputAtMs`. |
| Hành lang | y 770–910 | Bạn **vào** đi từ bên trái (x ≈ 110) tới cửa rồi khuất vào trong; bạn **ra** từ cửa đi sang phải (x ≈ 610) rồi mờ đi. Sàn có mũi tên phấn mờ: bên trái chỉ vào cửa, bên phải chỉ ra xa cửa. |
| Hàng thẻ | 4 thẻ 152×180 tại x 32 / 200 / 368 / 536, y 990–1170 | Chữ số to (~96 px). Trong lúc trình chiếu chỉ có 4 khung nét đứt rỗng; số chỉ lộ ra khi cửa đóng. |

- Vùng chạm là cả thẻ: 152 px trên khung 720, tức ~82 px trên điện thoại 390 px (≥ 48 px).
- Một điểm chạm mỗi lúc, dùng `pointerdown`. Máy tính: rê chuột lên thẻ thì thẻ nhấc lên 8 px.

### Một lượt trong `stepMs`

- Người đi chuyển động trong ~70 % đầu của lượt. 30 % còn lại để trống, để hai lượt liền nhau không dính vào nhau. Ở 450 ms, ~315 ms đi và ~135 ms nghỉ.
- **2 bạn cùng hướng** đi so le: lệch ~40 px ngang và ~24 px dọc, không che nhau quá 1/3, để đếm được ngay là 2.
- **Vừa vào vừa ra:** nhóm vào và nhóm ra đi cùng lúc, ở hai phía của cửa.
- **Thầy giáo** đi cùng đường với các bạn, cùng hướng với nhóm trong lượt đó.

### Phân biệt bằng dáng, không chỉ bằng màu

- **Bạn học sinh:** thấp, đầu tròn, đeo cặp. Màu áo và tóc thay đổi cho vui; FE tự chọn theo chỉ số câu và lượt, không cần dữ liệu từ shared.
- **Thầy giáo:** cao gấp ~1,4 lần, đeo kính, ôm sách, thắt cà vạt, không đeo cặp. Nhận ra bằng dáng kể cả khi xem đen trắng.
- **Hướng đi** nhận ra bằng ba thứ cùng lúc, không chỉ màu:
  - phía: vào ở bên trái, ra ở bên phải;
  - chiều di chuyển;
  - hướng mặt: bạn vào quay lưng (thấy cặp), bạn ra quay mặt.

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Xem lớp | `[0, showMs)` | Lớp mở, `start` bạn ngồi, bảng ghi `start`. 250 ms cuối: tường hạ che lớp. | Không |
| Các lượt | `[showMs, headCountInputAtMs)` | Cửa mở, người đi vào/ra theo `events`. Hàng thẻ là khung nét đứt rỗng. | Không |
| Chờ chọn | từ `headCountInputAtMs` | Cửa đóng (100 ms), 4 thẻ lật hiện số (≤ 150 ms) | Có, một lần |
| Đúng | chạm `answerIndex` | Gửi đáp án. Thẻ có vòng vàng và dấu tích, nảy nhẹ. Tổng ≤ 300 ms vì phần này tính vào câu sau. | Không |
| Sai / khoá | chạm thẻ khác | Gửi ngay; xem mục dưới | Không, suốt thời gian khoá |

### Hiện đáp án đúng khi sai (CR-006)

Khoá bắt đầu là hiện ngay (client đã có `answerIndex`), và giữ suốt thời gian khoá lấy từ `bridge.unlockDelay`.

- **Tường kéo lên (200 ms):** lớp hiện ra với đúng `options[answerIndex]` bạn ngồi ở bàn, bảng đen đổi sang số đúng.
- Siêu khó, nếu cuối câu thầy còn trong lớp: thầy đứng cạnh bảng, mờ 50 %, có dấu gạch chéo (thầy không tính).
- **Thẻ đúng:** vòng vàng dày, không mờ. **Thẻ chạm sai:** dấu X hai nét (`--destructive`, viền trắng) và rung ngang ±8 px trong 200 ms. Hai thẻ còn lại mờ 35 %.
- **Tuỳ chọn** (ui-designer quyết theo bản mẫu): dải nhỏ dưới tường ghi các bước bằng số và dấu, vd. `3 +2 −1 +1 = 5`, lấy từ `headCountTally`. Không dùng chữ.
- Mọi thứ trên nằm dưới y 260, không bị huy hiệu khoá ở dải trên cùng che.

### Hiệu ứng và giảm chuyển động

- Hiệu ứng phụ, đều ≤ 300 ms: tường hạ 250 ms, cửa mở/đóng 100 ms, thẻ lật 150 ms, nảy khi đúng, rung khi sai, các bạn nhún nhẹ khi đứng yên.
- **Giảm chuyển động (`prefers-reduced-motion`) KHÔNG bỏ chuyển động chính.** Bạn và thầy vẫn đi vào/ra đúng như thường, vì đó là nội dung câu đố.
- Chỉ bỏ hiệu ứng phụ:
  - tường hạ/kéo lên đổi thành hiện hoặc ẩn ngay (hoặc mờ dần 100 ms);
  - cửa đổi trạng thái ngay;
  - thẻ hiện ngay, không lật;
  - bỏ nảy, rung, nhún.
- Giữ dấu tích, dấu X, vòng vàng. Dòng thời gian (`showMs`, `stepMs`) giữ nguyên vì là luật chơi.

### Âm thanh (GĐ 2)

Tiếng bước chân ngắn cho mỗi người qua cửa (thầy trầm hơn), tiếng cửa kẹt khi mở/đóng, "ting" cao dần theo combo khi đúng, "bụp" trầm khi sai. Game phải chơi được khi tắt tiếng: mọi thông tin đều có trên hình.

### Chỉnh scene theo bản mẫu

Bố cục hiện tại (lớp, bảng, 9 bàn, tường, cửa, hành lang, thẻ, dải bước, biểu tượng pha) đã khớp bản mẫu M26, giữ nguyên. Đổi bộ màu nhân vật (dùng chung với Cổng luật): ba tầng độ sáng, áo sáng có hoa văn, cặp tầng giữa, thầy tầng tối; không dùng vàng `#ffd166` (đúng) và đỏ/hồng đỏ `#c93a55`, `#f07a90`, `#e85d75` (sai).

- `SHIRTS` → xanh trời `#8ec5ff`, cam `#f2a541`, bạc hà `#7fd1ae`, kem `#fff8ef`, nâu sữa `#e8b48a`, xanh trời `#8ec5ff` (bỏ vàng `#ffd166`, hồng `#f7a8b8`, tím `#c3a6ff`).
- Thêm hoa văn áo theo kiểu 0–5: trơn · kẻ ngang `#c2711f` · chấm bi `#2f9a6e` · kẻ ngang `#4d9de0` · trơn · chấm bi `#4d9de0`, cắt theo `KID_SHIRT` (4 sọc y −64…−34; 8 chấm r 3,4).
- `BAGS` → `#f2a541`, `#4d9de0`, `#a8693b`, `#3bb273`, `#4d9de0`, `#a8693b` (bỏ `#e85d75` và tím: tím chỉ cho thầy).
- `HAIRS` → `#1f1b3a`, `#6b4528`, `#1f1b3a`, `#a8693b`, `#6b4528`, `#1f1b3a`.
- Thầy: vest `#7768ae` → `#8a7cc4` (người duy nhất mặc tím; mã cũ chỉ 2,35:1 trên nền khung tối `#3a3560`, mã mới ≥ 3:1 trên cả `#f3eadf` và `#3a3560`), cà vạt `#e85d75` → `#f2a541`, sách `#4d9de0`, tóc `#8e94a7`.
- Viền ngoài người đi: thêm ở nền sáng (`#ffffff`), giữ `--chalk-muted` ở nền tối; `HALO_PX` 3 → 4.
- Nhóm 2 người cùng hướng: chân tại (x, 904) và (x + 40, 880); vào x 190–260 quay lưng, ra x 470–520 quay mặt; thầy chân y 908.
- Thẻ đúng: vòng lệch 9 px bo 32 (mực 16 dưới, vàng 9 trên), tích ở (x + 146, 992), nảy ×1,08. Thẻ sai: X ×0,62 ở (x + 140, 1000), hai thẻ còn lại mờ 35 %.
- Thầy không tính: mờ 50 % + gạch (548, 300) → (628, 410), phấn 18 dưới, `--destructive` 10 trên.
- Dải bước quá 640 px thì xuống dòng thứ hai cách 70 px (bản mẫu Siêu khó). Chọn làm dải này (Tuỳ chọn ở mục Hiện đáp án): **có**.
- Màn hướng dẫn: cập nhật màu theo bộ mới; nhãn +2 / −1 là chip kem viền mực.
- Đang tải / lỗi / trống: lớp phủ chung của khung chơi.

## Ghi chú cho BE

- **Không cần tin nhắn mới.** Đáp án là một số nguyên; `isAnswer` kiểm hình dạng; mỗi câu chấm một lần.
- `headCount.speedAllowanceMs(puzzle)` = `headCountInputAtMs(puzzle)` và `difficultyMultiplier` = 1 / 1 / 1,25 / 1,75 đã khai báo; server dùng các trường chung của CR-006, không cần sửa.
- Không từ chối đáp án đến sớm hơn `headCountInputAtMs` (lệch mạng); chỉ kẹp thời gian tính thưởng về 0, như Ai vừa biến mất.

## Câu hỏi mở

- **Khoảng cách nhanh/chậm hẹp ở Kiểm tra não** (× 1,06 / × 0,84), vì trình chiếu cố định chiếm ~70 % thời gian. Khi bốc trúng game này, kỹ năng Tính toán dồn quanh 100 hơn các game Tính toán khác. Chấp nhận như với game Ghi nhớ, hay muốn rút `showMs` / `stepMs` ở Thường?
- **Người lớn chọn Mầm được ~129 % điểm Thường** (luật Mầm = min(mô phỏng trẻ, 1) giữ hệ số 1). Giống các game khác; chủ phòng giám sát (GDD § 6).
- **Bảng đen ghi sẵn `start`** ở mọi mức. Siêu khó có nên bỏ con số để người chơi tự đếm bạn ngồi (theo ý "bỏ bớt gợi ý" của mức 5 Pumer) không? Hiện giữ con số cho dễ đọc trong 1 s xem.
- **Mật độ ở Khó và Siêu khó** (trung bình 3,4 và 4,4 người qua cửa mỗi giây) chưa thử trên máy thật. Núm chỉnh ở mục Cân bằng.
