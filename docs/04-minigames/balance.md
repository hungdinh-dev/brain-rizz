# Cân não (`balance`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (thay cho 45 000 ms của mẫu, để Siêu khó còn ~9 câu mỗi vòng); **đã duyệt 2026-10-12** ([CR-006](../00-tracking/change-requests.md#cr-006))
- File: `packages/shared/src/games/balance/` (logic + test), `apps/web/src/games/balance/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, khu M3 (BalanceMobile, BalanceLevels, BalanceStates, BalanceHowTo) — đã duyệt 2026-10-12

## Cách chơi

Mỗi câu có vài chiếc cân đĩa, bên nào thấp hơn là bên nặng hơn. Nhìn các cân, suy ra vật nặng nhất rồi chạm vào vật đó ở hàng bên dưới.

## Màn hướng dẫn

- **Cách chơi:**
  1. Bên cân thấp hơn là bên nặng hơn
  2. Cân thăng bằng: hai bên nặng bằng nhau
  3. Chạm vật nặng nhất ở hàng dưới
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính). Không dùng bàn phím.
- **Hình minh hoạ:** khung dọc giống màn chơi mức Mầm, dùng đúng [ví dụ Mầm](#mầm--trạng-thái-chờ-chọn). Cân trên: táo (thấp) với chuối (cao). Cân dưới: táo (cao) với miếng dưa hấu (thấp). Hàng dưới 3 ô chuối · dưa hấu · táo; ô dưa hấu được khoanh phấn, có bàn tay chỉ vào. Ba số phấn ①②③ khớp ba bước: ① cạnh đĩa thấp của cân trên; ② một cân nhỏ thăng bằng ở góc khung (nấm với cà rốt, dấu "=" trên trụ); ③ cạnh ô dưa hấu.
- **Câu nhắc lúc đếm ngược:** "Tìm vật nặng nhất!" (dùng chung cho điện thoại và máy tính).

## Câu đố & đáp án

Code: `packages/shared/src/games/balance/balance.ts`. Mọi kiểu dưới đây được export từ `@brain-rizz/shared`.

- `Puzzle` (`BalancePuzzle`):
  - `items: BalanceItem[]`: 3–6 vật khác nhau; thứ tự là thứ tự ô ở hàng lựa chọn (trái → phải, trên → dưới).
  - `scales: BalanceScale[]`, với `BalanceScale = { left: number[]; right: number[]; heavier: "left" | "right" | "equal" }`: các cân theo thứ tự hiển thị; số trong `left`/`right` là chỉ số trong `items`. Mỗi đĩa một vật, riêng Siêu khó có đúng một cân "1 vật – 2 vật" (luôn thăng bằng) và cân này luôn đứng cuối mảng. `heavier` là đĩa nằm thấp hơn.
  - `weights: number[]`: khối lượng ẩn (số nguyên 1–12) theo `items`, chỉ để server và test kiểm. **FE không hiển thị, không dùng để vẽ.**
  - `answer: number`: chỉ số trong `items` của vật nặng nhất.
- `Answer` (`BalanceAnswer`): số nguyên, là chỉ số ô được chạm ở hàng lựa chọn (0 … n−1), gửi một lần mỗi câu.
  - `isAnswer`: `typeof === "number"`, số nguyên, 0 ≤ x < 6. Từ chối chuỗi, `NaN`, `Infinity`, số thực, `null`, mảng, object, `bigint`.
  - `check`: `answer === puzzle.answer`. Chỉ số hợp lệ nhưng vượt số vật của mức (vd. 5 ở Mầm) là sai.
- Khai báo CR-006 trong `MinigameDef`: `durationMs: 60_000`, `difficultyMultiplier`, `speedAllowanceMs`. Con số và cách tính ở [Cân bằng](#cân-bằng).

Danh mục vật (export `BALANCE_ITEMS` để FE ánh xạ sang hình; kiểu `BalanceItem`). 8 vật vẽ **cùng cỡ**, nhận ra được chỉ bằng dáng:

| ID | Tên | Dáng nhận diện | Màu gợi ý (chỉ là phụ) |
| --- | --- | --- | --- |
| `apple` | Táo | Tròn, lõm ở đỉnh, cuống + một lá | Đỏ |
| `pear` | Lê | Giọt nước bầu dưới, cuống dài | Vàng chanh |
| `banana` | Chuối | Lưỡi liềm, hai đầu thon | Vàng |
| `carrot` | Cà rốt | Nón ngược có vạch ngang, chùm lá ở trên | Cam |
| `mushroom` | Nấm | Mũ vòm có chấm, chân trụ | Nâu, chấm kem |
| `grapes` | Chùm nho | Chùm quả tròn xếp tam giác ngược, một lá | Tím |
| `strawberry` | Dâu tây | Trái tim ngược, chấm hạt, vương miện lá | Đỏ hồng |
| `watermelon` | Miếng dưa hấu | Múi hình quạt, viền vỏ dày, hạt chấm | Ruột đỏ, vỏ xanh |

Bộ vật là đồ ăn quen thuộc. Không có dưa hấu nguyên quả hay quả dứa vì nhìn là biết nặng, dễ khiến người chơi đoán theo đời thực thay vì đọc cân. Tên chỉ dùng trong tài liệu (trong game không hiện chữ). ID tiếng Anh để khỏi trùng tên nhân vật Cam, Bơ, Bắp.

**Bộ vật (đã duyệt 2026-10-12):** giữ bộ đồ ăn, vẽ cùng cỡ. Nếu chơi thử thấy trẻ bị nhiễu bởi trực giác đời thực thì đổi sang bộ trung tính (khối gỗ khắc hình). Khi đổi chỉ cần thay 8 ID trong `BALANCE_ITEMS` và hình bên web; bộ sinh chỉ dùng số lượng vật (8), không phụ thuộc tên.

## Cách sinh câu đố

Bước chung cho mọi mức:

1. `rng = createRng(deriveSeed(roundSeed, index))`. Độ khó chỉ đổi tham số, nên với cùng (seed, index) mọi người thấy câu "cùng gốc": vật của mức thấp là phần đầu danh sách vật của mức cao.
2. Xáo 8 vật, lấy n vật đầu làm `items` (cũng là thứ tự hàng lựa chọn).
3. Xáo chỉ số 0 … n−1 thành `order` để gán vai ngẫu nhiên. `order[0]` luôn là đáp án.
4. Gán khối lượng nguyên rồi dựng **cây chứng minh**: mỗi vật trừ đáp án (ở Khó: mỗi nhóm vật bằng nhau) được nối với đúng một vật nặng hơn đã có trong cây, mỗi cạnh là một cân. Ở Siêu khó, hai cạnh Y → A và Y → B gộp thành một cân đĩa đôi, rồi thêm một cân mồi. Cây mọc ra từ đáp án, nên từ đáp án đi được tới mọi vật qua chuỗi "nặng hơn".
5. Xáo thứ tự các cân 1–1, rồi trên mỗi cân đặt đĩa nặng sang trái hay phải ngẫu nhiên (50/50). Cân đĩa đôi (nếu có) để cuối; vật đơn sang trái hay phải 50/50, hai vật trong đĩa đôi theo thứ tự ngẫu nhiên.

Mọi lựa chọn ngẫu nhiên đều đi qua `rng` (`int`, `pick`, `shuffle`) trên mảng có thứ tự cố định; không duyệt object hay `Set` để ra quyết định. Sắp theo khối lượng chỉ dùng khi mọi khối lượng khác nhau (Siêu khó), nên kết quả không phụ thuộc cách sắp của trình duyệt.

Riêng từng mức:

- **Mầm, Thường.** `order` xếp theo khối lượng giảm dần: vật nhẹ nhất `order[n−1]` nặng 1–3, mỗi bậc lên cộng thêm 1–3, nên mọi khối lượng khác nhau. Với k = 1 … n−1, vật `order[k]` thua một vật chọn ngẫu nhiên trong `order[0 … k−1]`, ra n−1 cân nghiêng. Vì sao đúng một đáp án: mọi vật trừ đáp án đều ở đĩa nhẹ ít nhất một lần nên không thể nặng nhất; đáp án không bao giờ ở đĩa nhẹ và đi tới được mọi vật nên chắc chắn nặng nhất.
- **Khó.** Như trên, nhưng chọn t ∈ {1, 2, 3} để `order[t]` và `order[t+1]` nặng bằng nhau (bậc giữa hai vật cộng 0); gọi chúng là P và Q (gán ngẫu nhiên). Dựng cây trên 4 nhóm (đáp án, cặp P–Q, hai vật lẻ) theo khối lượng giảm dần: mỗi nhóm thua một nhóm nặng hơn chọn ngẫu nhiên. Khi cặp là bên thua thì đưa **P** lên cân; khi cặp là bên thắng thì dùng **Q**. Thêm cân thăng bằng P = Q, tổng 4 cân. Hệ quả: Q không bao giờ ở đĩa nhẹ (vật "bóng"), nên loại hết vật bị nhấc lên vẫn còn 2 ứng viên. Muốn chọn đúng phải đọc cân thăng bằng: Q bằng P mà P đã thua; hoặc Q bằng P nên không thể là vật nặng nhất duy nhất.
- **Siêu khó.** Rút 50/50 để vật đơn của cân đĩa đôi là **đáp án** hoặc **một vật ở giữa**. Chọn ngẫu nhiên một cặp có thứ tự (a, b), a ≠ b, trong 2–5: A = `order[1]` nặng a, B = `order[2]` nặng b, vật đơn Y nặng a + b.
  - Y là đáp án: cặp phải có a + b ≥ 6 (10 cặp). Ba vật còn lại (`order[3…5]`) nhận ba khối lượng khác nhau trong 1 … a+b−1, trừ a và b (xáo rồi lấy 3 số đầu).
  - Y ở giữa (`order[3]`, 12 cặp): hai vật còn lại nhận hai khối lượng khác nhau trong 1 … 9, trừ a, b, a+b. Đáp án nặng hơn vật nặng nhất trong **cả 5 vật còn lại** (kể cả Y) thêm 1–3.

  Mọi khối lượng khác nhau và ≤ 12. Dựng cây bằng cách duyệt vật theo khối lượng giảm dần: A và B thua Y qua **một** cân đĩa đôi "Y = A + B" (thăng bằng); mỗi vật khác thua một vật nặng hơn đã duyệt, chọn ngẫu nhiên. Ra 3 cân nghiêng + 1 cân đĩa đôi. Sau đó thêm **cân mồi**: một cân nghiêng giữa hai vật không phải đáp án, H nặng hơn L, L đã bị nhấc ở một cân khác (L không phải A, B) và cặp này chưa từng được so (kể cả qua cân đĩa đôi); chọn ngẫu nhiên trong các cặp có H là A hoặc B, nếu không có thì trong mọi cặp hợp lệ. Luôn tìm được cân mồi, vì vật nhẹ nhất trong các vật bị nhấc luôn còn ít nhất một vật nặng hơn chưa so với nó. Tổng 5 cân.

  Vì sao đúng một đáp án: khối lượng dương nên Y = A + B kéo theo Y nặng hơn A và nặng hơn B; các vật khác thua trực tiếp; đáp án đứng đầu mọi chuỗi. Cân mồi là sự thật nên chỉ thêm thông tin, không làm mất tính duy nhất. Vì L vốn đã bị nhấc, sau khi loại vật bị nhấc vẫn còn đúng 3 ứng viên: đáp án, A, B.

**Chốt về cân thừa và cân mồi (đã duyệt 2026-10-12):** Mầm, Thường, Khó dùng đúng số cân tối thiểu, không có cân thừa. Chỉ Siêu khó có một cân mồi; cân này luôn đúng sự thật, không bao giờ đặt đáp án ở đĩa nhẹ, chỉ làm một vật sai trông "mạnh" hơn. Không dùng "cân bẫy" kiểu hai vật thắng một vật đơn trong khi vật đơn mới nặng nhất: đúng logic, nhưng người chơi thấy đáp án bị nhấc lên nên dễ cho là bị lừa khi chỉ có 1–8 giây.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 3 vật · 2 cân 1–1 nghiêng | Hai cân to xếp dọc, ba ô lớn. Nửa số câu vật đúng thắng cả hai cân, nửa còn lại là chuỗi A > B > C |
| Thường | 4 vật · 3 cân 1–1 nghiêng | Ba cân xếp dọc, chuỗi dài tới 3 bước. Khoảng 1/6 số câu có vật sai thắng nhiều cân hơn vật đúng |
| Khó | 5 vật · 4 cân: 3 nghiêng + 1 thăng bằng 1–1 | Lưới 2×2, có cân thăng bằng mang dấu "=". Luôn có một vật chưa từng bị nhấc nhưng nặng bằng một vật đã thua |
| Siêu khó | 6 vật · 5 cân: 3 nghiêng + 1 cân "1 vật = 2 vật" + 1 cân mồi | Bốn cân nhỏ và một cân đĩa đôi rộng ở hàng cuối. Luôn có 3 vật chưa từng bị nhấc. Nửa số câu vật đúng chính là vật đơn trên cân thăng bằng, nên mẹo "bỏ qua vật trên cân thăng bằng" không dùng được |

Chỉ số đo trên bộ sinh thật, 10.000 seed mỗi mức; test kiểm lại từng dòng (tỉ lệ ± 2 điểm %):

| Chỉ số | Mầm | Thường | Khó | Siêu khó |
| --- | --- | --- | --- | --- |
| Số lựa chọn (vật) | 3 | 4 | 5 | 6 |
| Số cân | 2 | 3 | 4 | 5 |
| Ứng viên còn lại sau khi loại mọi vật bị nhấc | 1 | 1 | 2 | 3 |
| Kiểu cân mới | Cân nghiêng | (chỉ thêm vật, thêm cân) | Thăng bằng 1–1 | 1 vật = 2 vật, cân mồi |
| Câu có vật sai thắng nhiều cân nghiêng hơn vật đúng | 0% | 17% | 16% | 26% |
| Số bước suy luận tới vật xa nhất (mỗi ">" hoặc "=" là một bước, đường ngắn nhất) | 1–2 | 1–3 | 2–4 | 1–4 |

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án đúng. Cách kiểm độc lập với bộ sinh: từ mỗi cân suy ra quan hệ chắc chắn đúng (1–1 nghiêng: ">"; 1–1 thăng bằng: "="; vật đơn thắng hoặc thăng bằng với 2 vật: vật đơn ">" từng vật). Duyệt **mọi thứ tự yếu** (cho phép bằng nhau) của n vật: 13 / 75 / 541 / 4.683 thứ tự với n = 3 / 4 / 5 / 6. Giữ những thứ tự thoả mọi quan hệ và khẳng định nhóm đứng đầu luôn chỉ gồm đáp án. Các quan hệ này đúng với mọi bộ khối lượng khớp các cân, nên cách kiểm không bỏ sót câu mơ hồ.
- Mọi cân khớp khối lượng ẩn (so tổng hai đĩa). Khối lượng là số nguyên 1–12. Đáp án nặng nhất và không trùng khối lượng với vật nào.
- Đáp án không bao giờ ở đĩa nhẹ. Ở Mầm, Thường, Khó đáp án không nằm trên cân thăng bằng; ở Siêu khó nó chỉ có thể là vật đơn của cân đĩa đôi.
- Các vật trong một câu khác nhau và thuộc danh mục. Vật nào cũng có mặt ở ít nhất một cân. Không cặp vật nào bị so hai lần, không vật nào xuất hiện hai lần trong cùng một cân.
- Số vật, số cân, số cân thăng bằng, số cân đĩa đôi đúng như bảng Độ khó; cân đĩa đôi đứng cuối `scales`.
- Độ khó tăng thật: số ứng viên còn lại sau khi loại vật bị nhấc đúng bằng 1 / 1 / 2 / 3.
- Phân bố đều: vị trí đáp án trong hàng là 1/n ± 2%; đĩa nặng nằm bên trái 50% ± 2%; ở Siêu khó, đáp án là vật đơn của cân đĩa đôi 50% ± 3%.

Các điều trên phải được kiểm bằng test ≥ 10.000 seed × 4 độ khó.

Đã kiểm trong `packages/shared/src/games/balance/balance.test.ts`: 10.000 seed × 4 mức (seed 0 … 9.999, index = seed mod 37), **0 lỗi** với mọi điều trên. Test còn kiểm:

- tất định (sinh lại từng câu và so nguyên văn) và "cùng gốc" giữa các mức;
- bộ kiểm duy nhất tự kiểm: đếm đủ 13 / 75 / 541 / 4.683 thứ tự yếu, bắt được câu mơ hồ và "cân bẫy", và 4 ví dụ vẽ bản mẫu ở dưới đều hợp lệ;
- `check` chỉ nhận `answer`; `isAnswer` từ chối dữ liệu rác; `speedAllowanceMs` hữu hạn, ≥ 0, tất định; hệ số điểm không giảm khi lên mức.

Cả file test chạy khoảng 2,7 giây (phần nặng nhất là duyệt thứ tự yếu, ~1,1 giây).

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình.

| Mức | Thời gian giải dự kiến mỗi câu | Số câu mỗi vòng 60 s (trả lời · đúng) |
| --- | --- | --- |
| Mầm | 1,5–2,5 s (người lớn) · 3–4 s (trẻ 7 tuổi) | người lớn ~25 · ~24 — trẻ ~15 · ~13–14 |
| Thường | 2,5–3,5 s | ~17–18 · ~16 |
| Khó | 3,5–5 s | ~12–13 · ~11 |
| Siêu khó | 5–7 s | ~9 · ~7–8 |

Đây là ước lượng trước khi chơi thử, cho người đã quen luật, dựa trên số cân phải đọc và số bước suy luận. Giả định tỉ lệ sai 5 / 8 / 12 / 15 % (trẻ ở Mầm 10 %), câu sai tốn thời gian như câu đúng cộng 1,5 s khoá, hiệu ứng chuyển câu 0,25 s. Khoảng thời gian của các mức nối tiếp nhau, không chồng nhau. Mức Thường nằm trong mục tiêu 2–4 s của GDD; Siêu khó còn ~9 câu mỗi vòng (GDD: ≥ 8), nhờ vòng 60 s.

### Con số CR-006

Đã duyệt 2026-10-12 cùng [CR-006](../00-tracking/change-requests.md#cr-006). Đề xuất cũ của đặc tả này ("nhân khung thưởng tốc độ với hệ số độ khó") được gộp vào trường chung `speedAllowanceMs`. Con số chốt lại sau buổi chơi thử đủ 5 game MVP; chỉ cần sửa hai hằng số `MULTIPLIER_BY_DIFFICULTY` và `ALLOWANCE_MS_BY_DIFFICULTY` trong `balance.ts`.

| Mức | Hệ số điểm (`difficultyMultiplier`) | Miễn trừ (`speedAllowanceMs`) | Khung thưởng tốc độ sau miễn trừ (trọn → hết) |
| --- | --- | --- | --- |
| Mầm | × 1 (tính ra × 1,35, chặn bằng Thường) | 0 | 1,5 → 8 s |
| Thường | × 1 | 0 | 1,5 → 8 s |
| Khó | × 1,75 | 1 250 ms | 2,75 → 9,25 s |
| Siêu khó | × 2,85 | 3 000 ms | 4,5 → 11 s |

**Miễn trừ: cách tính.** Giữ hướng của đề xuất cũ: Mầm và Thường không đổi, chỉ bù thời gian suy luận dài hơn của Khó và Siêu khó. Quy về một khoản trừ cố định theo CR-006:

- Miễn trừ = giữa khoảng thời gian giải của mức − giữa khoảng của Thường (3 s), không âm. Khó: 4,25 − 3 = 1,25 s. Siêu khó: 6 − 3 = 3 s.
- Mỗi mức có cấu trúc câu cố định (số vật, số cân, kiểu cân), nên miễn trừ là hằng số cho mỗi mức. Hàm không đọc nội dung câu đố.
- Kết quả: câu điển hình ở mức nào cũng được ~37/50 điểm thưởng (luật cũ: Khó ~27, Siêu khó ~14). Độ dốc của khung không đổi, nên trong cùng một mức người nhanh vẫn hơn người chậm như trước.
- Đề xuất cũ cho Siêu khó khung 2,25–12 s, ~29 điểm/câu. Cách mới bù nhiều hơn một chút, đổi lại câu điển hình mọi mức được thưởng ngang nhau.

**Hệ số: cách tính.**

- Mô phỏng 40.000 vòng 60 s cho mỗi người chơi mục tiêu theo luật CR-006: thưởng tốc độ tính sau miễn trừ, combo tối đa × 1,5, khoá 1,5 s khi sai, hiệu ứng chuyển câu 0,25 s tính vào câu sau. Thời gian giải rải đều trong khoảng ở bảng trên; tỉ lệ sai như trên.
- Điểm vòng = hệ số × 100 × Σ combo + Σ (thưởng × combo). Giải ra hệ số để điểm vòng của người chơi mục tiêu bằng người lớn ở Thường (hệ số 1), làm tròn 0,05. Kết quả: Mầm (trẻ) 1,35, Khó 1,75, Siêu khó 2,85.
- **Mầm chặn ở × 1.** Để trẻ bằng hẳn người lớn ở Thường, Mầm cần × 1,35, cao hơn Thường. Khi đó người lớn chọn Mầm được ~208 % điểm của Thường, và hệ số giảm khi lên mức là phạt người chọn mức cao. Chặn ở × 1 thì trẻ được ~80 %, người lớn chọn Mầm ~167 % (vẫn trông vào "lệch" + "Nhắc" của chủ phòng). Nếu giữ hệ số mặc định × 0,8, trẻ chỉ còn ~68 %.

Điểm vòng 60 s mô phỏng với các con số trên (giả định `scoring.ts` đã có trần combo và trừ miễn trừ trước khi tính thưởng, theo CR-006):

| Người chơi | Câu đúng | Thưởng tốc độ trung bình mỗi câu | Điểm vòng | So với người lớn ở Thường |
| --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 13,6 | 33 | ~2.260 | ~80 % |
| Người lớn · Mầm | 24,3 | 44 | ~4.730 | ~167 % |
| Người lớn · Thường | 16,1 | 37 | ~2.830 | 100 % |
| Người lớn · Khó | 11,0 | 37 | ~2.840 | ~100 % |
| Người lớn · Siêu khó | 7,6 | 37 | ~2.830 | ~100 % |

Trước CR-006 (vòng 45 s, hệ số chung 0,8 / 1 / 1,25 / 1,5, combo không trần, không miễn trừ): người lớn ở Khó chỉ được ~69 % và ở Siêu khó ~48 % so với ở Thường.

**Chỉnh sau chơi thử:** đo thời gian giải thật của từng mức, sửa bảng đầu mục, rồi tính lại miễn trừ (giữa khoảng − giữa khoảng của Thường) và hệ số (mô phỏng như trên).

## Ghi chú cho FE

### Dữ liệu câu đố

Scene tự sinh câu bằng `balance.generate(bridge.seed, index, bridge.difficulty)`, rồi vẽ theo `BalancePuzzle` (định nghĩa đủ ở [Câu đố & đáp án](#câu-đố--đáp-án)):

| Trường | Dùng để |
| --- | --- |
| `items[i]` | Vẽ ô thứ i ở hàng lựa chọn bằng hình của ID đó (`BalanceItem`, một trong `BALANCE_ITEMS`). Chạm ô i thì gửi `bridge.submit(index, i)`: đáp án chỉ là số i |
| `scales[k].left`, `scales[k].right` | Chỉ số trong `items` của các vật trên đĩa trái/phải; vẽ hình `items[left[j]]`. Mảng có 2 phần tử là đĩa đôi: hai vật cạnh nhau trong một đĩa |
| `scales[k].heavier` | `"left"`: đĩa trái thấp. `"right"`: đĩa phải thấp. `"equal"`: đòn ngang + huy hiệu "=" |
| `answer` | Chỉ số ô đúng. Chấm ngay ở client bằng `balance.check(puzzle, i)` cho phản hồi tức thì; server chấm lại để tính điểm |
| `weights` | **Không dùng.** Không vẽ, không suy ra góc nghiêng hay cỡ vật từ đây |

- Bố cục theo số cân: 2 / 3 / 4 / 5 cân tương ứng Mầm / Thường / Khó / Siêu khó (bảng bên dưới). Cân đĩa đôi chỉ có ở Siêu khó và luôn là `scales[4]`, vẽ ở hàng cuối, rộng hết vùng.
- Không có chữ trong màn chơi; `locales.ts` chỉ chứa phần hướng dẫn.

### Hiện đáp án đúng khi trả lời sai (CR-006)

1. Chạm một ô khi chưa khoá: chấm bằng `balance.check`, gửi `bridge.submit(index, i)`.
2. Nếu sai: gọi `bridge.unlockDelay(index)` và giữ trạng thái "Sai, khoá" trong đúng số ms trả về (thường 1,5 giây = `WRONG_ANSWER_LOCK_MS`). Không tự đếm 1,5 giây, để hết khoá cùng lúc với server và huy hiệu khoá của khung. Promise có thể về sau khi hết vòng: kiểm `this.sys.isActive()` trước khi dùng.
3. Trong lúc khoá:
   - ô `items[answer]` được khoanh (nét `primary`, viền `sticker`) và giữ sáng 100 %; đây là dấu hiệu chính;
   - ô người chơi đã chạm rung ngang + dấu ✗ màu `destructive`;
   - mọi chỗ vật đúng xuất hiện trên cân (mọi `scales[k]` có `answer` trong `left` hoặc `right`) được viền sáng, để người chơi thấy vì sao;
   - phần còn lại mờ còn 35 %; chạm trong lúc khoá bị bỏ qua.
4. Hết khoá: hiện ngay câu `index + 1`.

- Hàng lựa chọn (y 920–1248) nằm ngoài dải huy hiệu khoá của khung (tới y ≈ 225 ở thẻ thấp nhất), nên dấu hiệu chính luôn thấy được. Viền trên cân chỉ là phụ: nếu huy hiệu che một phần cân hàng đầu thì vẫn chấp nhận được.
- Khi bật giảm chuyển động: bỏ rung, giữ vòng khoanh, dấu ✗, viền và độ mờ.

### Bố cục trong khung 720×1280

Khung được scale FIT. Trên điện thoại rộng 390 px, khung chỉ hiện khoảng 0,45–0,5 lần, nên **48 px thật ≈ 100 px trong khung**. Quy ước của game này: mọi vùng chạm ≥ 112 × 112 px trong khung (≈ 50–56 px thật). Đồng hồ, điểm và dải đối thủ do `PlayScreen` vẽ ngoài canvas, nên scene dùng trọn khung.

| Vùng | Toạ độ (px trong khung) | Nội dung |
| --- | --- | --- |
| Lề | 32 mỗi cạnh | Để trống |
| Vùng cân | y 32–872, rộng 656 | Các cân theo thứ tự `scales`, đọc trái → phải, trên → dưới. Không nhận chạm |
| Đường ngăn | y ≈ 896 | Một nét phấn ngang |
| Hàng lựa chọn | y 920–1248, rộng 656 | Mỗi vật một ô thẻ giấy viền mực, theo thứ tự `items` |

| Mức | Vùng cân | Hàng lựa chọn |
| --- | --- | --- |
| Mầm | 1 cột × 2 hàng, ô 656×412, hình vật trên đĩa 112 px | 1 hàng, 3 ô 200×200, cách nhau 28 |
| Thường | 1 cột × 3 hàng, ô 656×269, vật 96 px | 1 hàng, 4 ô 152×200, cách nhau 16 |
| Khó | Lưới 2×2, ô 320×412, vật 88 px | 2 hàng (3 + 2 căn giữa), ô 200×148, cách 28 ngang · 16 dọc |
| Siêu khó | 4 cân 1–1 lưới 2×2, ô 320×269; cân đĩa đôi ở hàng 3, rộng 656×269; vật 80 px (đĩa đôi 72 px mỗi vật) | 2 hàng 3 + 3, ô 200×148 |

### Vẽ cân

- Kiểu cân đĩa treo (hình cán cân): trụ + đế, đòn ngang, hai đĩa treo. Với đĩa đôi, hai vật đặt cạnh nhau trong cùng một đĩa, không vẽ dấu "+".
- **Cân nghiêng:** đòn nghiêng 14° (±2°), đĩa nặng thấp hơn đĩa nhẹ ≥ 48 px. **Mọi cân nghiêng cùng một góc**, không phụ thuộc chênh lệch khối lượng (không được để lộ khối lượng ẩn). Vật cũng luôn cùng cỡ.
- **Cân thăng bằng:** đòn nằm ngang, trên trụ có huy hiệu "=" (~40 px). Cân nghiêng không cần thêm ký hiệu: độ nghiêng đã đủ rõ và không phụ thuộc màu.
- Màu nét lấy theo token chủ đề, đọc lúc tạo scene: `card-foreground` (mực đậm trên nền `muted` sáng `#f3eadf`, trắng phấn trên nền `muted` tối `#3a3560`). Không mã cứng màu trắng phấn, vì ở chế độ sáng nền khung chơi là giấy be nên sẽ không thấy nét. Màu nhóm Phân tích `#4d9de0` chỉ làm điểm nhấn (đế cân, huy hiệu "=").
- Hình vật giống hệt nhau ở cân và ở hàng lựa chọn, chỉ khác cỡ. Kiểm bằng ảnh xám: 8 vật vẫn phải phân biệt được ở cỡ 72 px.

### Hàng lựa chọn

- Một lần chạm là một đáp án (chỉ số ô). Chốt chọn ở hàng riêng thay vì chạm trực tiếp trên cân, vì:
  - một vật có mặt ở nhiều cân, tức có nhiều chỗ chạm cho cùng một đáp án;
  - vật trên cân ở Khó và Siêu khó chỉ 72–88 px (~36–44 px thật), dưới mức 48 px;
  - hàng dưới nằm trong tầm ngón cái;
  - tách việc đọc (phía trên) khỏi việc chọn (phía dưới) giúp tránh chạm nhầm khi đang dò cân, mà chạm nhầm thì mất 1,5 giây.
- Chạm vào cân không làm gì, không bị phạt.
- Máy tính: hover nhấc ô lên 4 px + con trỏ bàn tay; khi nhấn, ô thu lại 0,96.

### Trạng thái và hiệu ứng (mỗi hiệu ứng ≤ 400 ms, trừ thời gian khoá)

| Trạng thái | Hiện gì |
| --- | --- |
| Hiện câu | Cân hiện dần trong 120 ms; đòn nghiêng từ ½ góc tới góc cuối trong 180 ms. Không bắt đầu từ vị trí nằm ngang để khỏi thoáng giống cân thăng bằng. Cân thăng bằng chỉ hiện dần. Nhận chạm ngay |
| Chờ chọn | Đứng yên; hover và nhấn như trên |
| Đúng | Ô được chọn nảy 1 → 1,15 → 1 (160 ms), có vòng khoanh quanh ô; sang câu mới sau ≤ 250 ms |
| Sai, khoá | Ô được chọn rung ngang ±8 px (240 ms) + dấu ✗ màu `destructive`. Mọi thứ mờ còn 35%, **trừ ô vật đúng: được khoanh và giữ sáng**; hình vật đúng trên các cân cũng được viền sáng để người chơi thấy vì sao. Khoá tới khi hết số ms của `bridge.unlockDelay(index)` (thường 1,5 giây), chạm trong lúc khoá bị bỏ qua, rồi sang câu mới. Chi tiết ở [mục trên](#hiện-đáp-án-đúng-khi-trả-lời-sai-cr-006) |
| Hết giờ | Dừng nhận chạm; phần còn lại do `PlayScreen` lo |

- Vòng khoanh dùng nét `primary` (vàng) có viền `sticker` (mực), để thấy được trên cả nền giấy sáng lẫn nền tối.
- Server tính thời gian trả lời từ lúc nhận đáp án trước, nên hiệu ứng chuyển câu sau câu đúng bị tính vào thời gian của câu sau. Giữ tổng ≤ 250 ms và hiện câu mới ngay.
- Khi bật giảm chuyển động: bỏ nảy, rung và xoay đòn; chỉ đổi viền, dấu ✓/✗ và độ mờ; cân hiện thẳng ở trạng thái cuối.

### Âm thanh (GĐ 2)

- Đúng: "ting" ngắn, cao dần theo combo (dùng chung).
- Sai: "bụp" trầm + rung ngắn (dùng chung).
- Hiện câu: tiếng "cạch" gỗ rất nhỏ khi đòn hạ xuống. Không bắt buộc; bỏ nếu chơi thử thấy ồn.

### Ví dụ để vẽ bản mẫu

Mỗi ví dụ là một câu hợp lệ: `balance.test.ts` chạy cả bộ kiểm duy nhất lẫn mọi ràng buộc ở trên cho 4 ví dụ này. "Thấp" nghĩa là đĩa nặng hơn. Khối lượng ẩn chỉ để tham khảo, không vẽ. Bốn ví dụ phủ đủ các trạng thái cần vẽ.

#### Mầm — trạng thái chờ chọn

- Hàng lựa chọn: chuối · miếng dưa hấu · táo
- Cân 1: trái táo | phải chuối → trái thấp
- Cân 2: trái táo | phải miếng dưa hấu → phải thấp
- Đáp án: miếng dưa hấu, ô thứ 2 (`answer = 1`). Vì sao: chuối < táo < dưa hấu.
- Khối lượng ẩn: chuối 2, táo 4, dưa hấu 6.

#### Thường — trạng thái sai

- Hàng lựa chọn: lê · chùm nho · táo · cà rốt
- Cân 1: trái táo | phải lê → trái thấp
- Cân 2: trái cà rốt | phải táo → phải thấp
- Cân 3: trái táo | phải chùm nho → phải thấp
- Đáp án: chùm nho, ô thứ 2 (`answer = 1`). Vẽ cảnh người chơi chạm táo (táo thắng 2 cân nhưng thua nho): ô táo có dấu ✗, ô nho được khoanh, phần còn lại mờ.
- Khối lượng ẩn: lê 3, nho 8, táo 6, cà rốt 2.

#### Khó — trạng thái đúng

- Hàng lựa chọn (2 hàng): lê · nấm · chùm nho / chuối · táo
- Cân 1: trái chuối | phải táo → trái thấp
- Cân 2: trái lê | phải nấm → trái thấp
- Cân 3: trái táo | phải lê → thăng bằng (=)
- Cân 4: trái chuối | phải chùm nho → phải thấp
- Đáp án: chùm nho, ô thứ 3 (`answer = 2`). Vì sao: lê chưa từng bị nhấc, nhưng lê = táo < chuối < nho. Vẽ ô nho đang nảy, có vòng khoanh.
- Khối lượng ẩn: lê 5, nấm 2, nho 9, chuối 7, táo 5.

#### Siêu khó — trạng thái chờ chọn

- Hàng lựa chọn (2 hàng): chuối · lê · dâu tây / miếng dưa hấu · nấm · táo
- Cân 1: trái miếng dưa hấu | phải lê → trái thấp
- Cân 2: trái nấm | phải táo → phải thấp
- Cân 3: trái lê | phải dâu tây → trái thấp
- Cân 4: trái dâu tây | phải chuối → phải thấp (cân mồi)
- Cân 5 (hàng cuối, rộng hết vùng): trái chuối + táo | phải miếng dưa hấu → thăng bằng (=)
- Đáp án: miếng dưa hấu, ô thứ 4 (`answer = 3`). Vì sao: ba vật chưa từng bị nhấc là dưa hấu, chuối, táo; dưa hấu = chuối + táo nên nặng hơn từng quả.
- Khối lượng ẩn: chuối 3, lê 6, dâu tây 1, dưa hấu 8, nấm 4, táo 5.

## Ghi chú cho BE

Không có gì riêng. Mỗi câu có một đáp án số nguyên, chấm bằng `generate()` + `check()` như Kẻ lạc đàn; không có giai đoạn trình chiếu trước khi cho nhập; khoá khi sai dùng chung.

Game chỉ khai báo các trường chung của CR-006 trong `MinigameDef`: `durationMs: 60_000`, `difficultyMultiplier` và `speedAllowanceMs(puzzle, difficulty)` (hằng số theo mức, không đọc câu đố). Số liệu ở mục Cân bằng giả định server trừ miễn trừ khỏi thời gian trả lời (không để âm) **trước** khi kẹp vào khung 1,5–8 s, và combo tối đa × 1,5. Nếu cách cài khác, báo game-designer để tính lại hệ số.

## Đối chiếu quy tắc thiết kế (GDD mục 5)

- [x] Hiểu trong ≤ 5 giây: một câu "Tìm vật nặng nhất" + hình hai cân; cân đĩa là kiến thức đời thường.
- [x] Mức Thường giải trong 1–8 giây sau khi trừ miễn trừ: ước lượng 2,5–3,5 s, miễn trừ 0.
- [x] Có bảng Cân bằng: thời gian giải từng mức → hệ số 1 / 1 / 1,75 / 2,85 và miễn trừ 0 / 0 / 1,25 / 3 s (CR-006).
- [x] Đúng một đáp án, kiểm được bằng máy: duyệt mọi thứ tự yếu, 10.000 seed × 4 mức trong `balance.test.ts` (0 lỗi).
- [x] Chỉ số nguyên + `createRng()`: khối lượng 1–12, danh mục 8 vật cố định, không cần dữ liệu ngoài.
- [x] Bốn mức khác nhau rõ rệt: 3/4/5/6 vật, 2/3/4/5 cân, 1/1/2/3 ứng viên. Mầm chỉ có 2 cân to và 3 vật; suy luận bắc cầu với hình nhìn thấy trước mắt vừa sức trẻ 7 tuổi.
- [x] Một ngón tay, khung dọc 720×1280: một lần chạm, mỗi ô ≥ 112 px trong khung (≈ 50 px thật).
- [x] Không phụ thuộc chữ: chỉ có hình vật, độ nghiêng và dấu "=".
- [x] Không chỉ phân biệt bằng màu: các vật khác dáng (kiểm bằng ảnh xám); độ nghiêng là hình học.

## Câu hỏi mở

- **Hệ số Mầm (chờ quyết):** để × 1 như hiện tại (trẻ ~80 %, người lớn chọn Mầm ~167 % so với Thường), hay nâng lên × 1,35 đúng như tính ra (trẻ ~100 %, người lớn chọn Mầm ~208 %, Mầm được nhiều điểm mỗi câu hơn Thường)? Xem [Cân bằng](#con-số-cr-006). Nên chốt chung cho cả 5 game sau buổi chơi thử.
- ~~Có duyệt đề xuất nhân khung thưởng tốc độ theo hệ số độ khó không?~~ **Đã duyệt 2026-10-12** (CR-006), làm bằng miễn trừ `speedAllowanceMs`.
- ~~Cùng một người, chọn mức cao bị thiệt điểm. Có xem lại hệ số độ khó không?~~ **Đã duyệt 2026-10-12** (CR-006): hệ số riêng của game + trần combo × 1,5.
- ~~Giữ vòng 45 s hay cho game suy luận 60 s?~~ **Đã duyệt 2026-10-12** (CR-006): 60 s.
- ~~Bộ vật đồ ăn hay bộ trung tính?~~ **Đã duyệt 2026-10-12**: giữ đồ ăn, vẽ cùng cỡ; đổi sang bộ trung tính (khối gỗ khắc hình) nếu chơi thử thấy trẻ bị nhiễu.
- Để sau, không làm ở bản này: "cân bẫy" (hai vật nặng hơn một vật đơn, nhưng vật đơn vẫn nặng nhất) cho chế độ Luyện tập hoặc Kiểm tra não; chạm vào một vật trên cân để làm sáng mọi chỗ vật đó xuất hiện.

[← Danh mục minigame](README.md)
