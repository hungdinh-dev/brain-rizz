# Xếp lại tháp (`stack-recall`)

- Nhóm: Ghi nhớ
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006; mỗi câu có 2,4–2,9 s xem + che không thao tác được, giống Theo dấu ánh đèn)
- File: `packages/shared/src/games/stack-recall/` (logic + test, đã làm), `apps/web/src/games/stack-recall/` (scene + chữ hiển thị, frontend-dev viết lại theo mục Ghi chú cho FE)
- Nguồn: kế hoạch mở rộng minigame, [mục 3.2](../01-product/minigame-expansion.md#32-xếp-lại-tháp-stack-recall-ghi-nhớ), [CR-013](../00-tracking/change-requests.md#cr-013). Chỉ mượn cơ chế "xem món rồi xếp lại theo thứ tự"; tên, hình, chữ là của Brain Rizz.
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M21** (StackRecallMobile, StackRecallLevels, StackRecallStates, StackRecallHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

## Cách chơi

Một tháp khối hiện vài giây rồi bị khăn lau che mất. Chạm các khối ở khay theo đúng thứ tự **từ dưới lên** để xếp lại tháp y như cũ.

Khác Theo dấu ánh đèn: game đó nhớ *vị trí*, game này nhớ *món gì, theo thứ tự nào*.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nhớ tháp khối từ dưới lên
  2. Khăn lau che mất tháp
  3. Chạm khối ở khay, xếp lại tháp
- **Điều khiển:** Chạm (điện thoại) · Click chuột (máy tính) · Bàn phím: không dùng ở bản này.
- **Hình minh hoạ:** một khung tĩnh ba phần, nối bằng mũi tên phấn:
  - Trái, biểu tượng mắt: tháp 3 tầng trên bệ (từ dưới lên: tim sọc chéo, vuông sọc ngang, tam giác chấm bi), bên cạnh có mũi tên phấn đi từ dưới lên ghi số 1, 2, 3.
  - Giữa: khăn lau phấn đang quét ngang che tháp.
  - Phải, biểu tượng ngón tay: 3 ô tầng nét đứt trên bệ, ô dưới cùng đã có khối tim; dưới là khay 5 khối, ngón tay phấn đang chạm khối vuông, mũi tên nét đứt bay từ khối vuông lên ô tầng thứ 2.
  - Góc dưới, cỡ nhỏ: huy hiệu xáo khay (hai mũi tên đổi chỗ) cạnh khay, nhắc luật Siêu khó.
- **Câu nhắc lúc đếm ngược:** "Nhớ khối từ dưới lên!"
- **Câu nhắc theo mức** (qua `levelHints` của `locales.ts`):
  - Mầm: "Thứ tự nào cũng được!"
  - Khó: "Có thể có khối lặp lại!"
  - Siêu khó: "Khay xáo chỗ: tìm theo hình!"
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "2 tầng · thứ tự tuỳ ý" · Thường "3 tầng · 5 khối" · Khó "4 tầng · có lặp" · Siêu khó "5 tầng · khay xáo".
- **Thẻ game:** tên "Xếp lại tháp" (en "Stack Recall"); mô tả "Nhớ tháp khối, xếp lại từ dưới lên" (en "Memorize the tower, rebuild it bottom up").

## Câu đố & đáp án

- `Puzzle` (kiểu `StackRecallPuzzle`): `{ layers, tray, ordered, trayShuffled, showMs, coverMs }`
  - `layers: StackRecallKind[]`: các tầng **từ dưới lên** (`layers[0]` là tầng đáy), dài 2–5. Hai tầng liền nhau không bao giờ cùng loại.
  - `tray: StackRecallKind[]`: khay, theo thứ tự ô (trái → phải, trên → dưới). Mỗi loại đúng một lần, chạm bao nhiêu lần cũng được.
  - `ordered: boolean`: `false` chỉ ở Mầm (chạm đủ các khối, thứ tự nào cũng được).
  - `trayShuffled: boolean`: `true` chỉ ở Siêu khó (khay xáo chỗ mỗi câu).
  - `showMs`, `coverMs` (ms, số nguyên): tháp hiện trong `showMs`, khăn lau che trong `coverMs = 400`. Người chơi được chạm từ **`stackRecallRevealMs(puzzle)` = `showMs + coverMs`**.
- `StackRecallKind`: số nguyên 0–7, chỉ số trong `STACK_RECALL_KINDS` (xem [Bộ khối](#bộ-khối)).
- `Answer` (kiểu `StackRecallAnswer`): `StackRecallKind[]`, các loại khối đã chạm theo thứ tự chạm (lần chạm đầu là tầng đáy). Client gửi **một lần** mỗi câu:
  - chạm đủ `layers.length` khối, lần nào cũng đúng → gửi cả mảng, vd. `[4, 1, 2]`;
  - **lần chạm sai đầu tiên → gửi ngay** mảng tính tới khối sai, vd. `[4, 1, 0]`. Khoá 1,5 giây bắt đầu ngay.
- `stackRecallOnTrack(puzzle, taps)`: các lần chạm còn đi đúng hướng không (còn nối dài được thành đáp án đúng). Có thứ tự: `taps` là tiền tố của `layers`. Mầm: mỗi lần chạm là một loại còn lại của tháp, đếm theo số lần xuất hiện. Scene gọi hàm này sau mỗi lần chạm để chấm ngay ở client.
- `check(puzzle, answer)`: đúng khi và chỉ khi `answer.length === layers.length` và `stackRecallOnTrack(puzzle, answer)`. Tức là:
  - **Thường, Khó, Siêu khó:** `answer` trùng khít `layers`.
  - **Mầm (so khớp không theo thứ tự):** `answer` là một hoán vị của `layers`, cùng các loại và cùng số lần. Tháp Mầm 2 tầng khác loại nên đúng 2 cách chạm được nhận, cả hai cùng một tập hợp.
  - Thiếu, thừa, có khối sai hay sai thứ tự (trừ Mầm) đều sai.
- `isAnswer(value)`: mảng 1–5 phần tử, mỗi phần tử là số nguyên 0–7 (5 = tháp cao nhất, 8 = số loại; lấy từ bảng tham số, không viết cứng). Duyệt theo chỉ số nên mảng thưa bị từ chối. Mảng có hai phần tử liền nhau trùng loại vẫn qua `isAnswer` (client hợp lệ không gửi; nếu có thì `check` chấm sai).

## Bộ khối

8 loại (`STACK_RECALL_KINDS`). Mỗi loại khác **mọi** loại khác ở cả hình (biểu tượng giữa khối) lẫn hoa văn (nền khối), nên người mù màu, kể cả xem đen trắng, vẫn phân biệt được. Màu chỉ là gợi ý phụ. Mức có K loại dùng K loại đầu bảng.

| Loại | `shape` | `pattern` | Tên gọi khi nói | Có từ mức | Màu gợi ý (phụ) |
| --- | --- | --- | --- | --- | --- |
| 0 | `circle` | `plain` (trơn) | tròn | Mầm | đỏ cam |
| 1 | `square` | `stripes` (sọc ngang) | vuông | Mầm | xanh dương |
| 2 | `triangle` | `dots` (chấm bi) | tam giác | Mầm | vàng |
| 3 | `star` | `checker` (ca rô) | sao | Mầm | tím |
| 4 | `heart` | `diagonal` (sọc chéo) | tim | Thường | hồng |
| 5 | `moon` | `zigzag` (răng cưa) | trăng | Khó | xanh lá |
| 6 | `drop` | `waves` (gợn sóng) | giọt nước | Siêu khó | xanh ngọc |
| 7 | `cross` | `bricks` (gạch) | dấu cộng | Siêu khó | nâu |

4 hình dễ gọi tên nhất đứng đầu cho Mầm (trẻ 7 tuổi). Sọc răng cưa và gợn sóng chỉ cùng xuất hiện ở Siêu khó, và hình giữa khối (trăng, giọt nước) vẫn khác hẳn nhau.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`. Lấy tham số của mức ở bảng [Độ khó](#độ-khó).
2. **Rút tháp:** xáo K loại đầu bộ khối bằng `rng.shuffle` (hoán vị đều).
   - Mầm, Thường: lấy N loại đầu, nên các tầng đôi một khác loại.
   - Khó, Siêu khó: tung đồng xu `rng.int(0, 1)`. Mặt 0 (nửa số câu): lấy N loại đầu như trên. Mặt 1 (nửa còn lại): chọn đều một cặp vị trí **không liền nhau** (Khó 3 cặp, Siêu khó 6 cặp); loại đầu của hoán vị đặt vào cặp đó, N − 2 loại kế lấp các tầng còn lại từ dưới lên. Vậy tháp có đúng một loại lặp đúng hai lần, không bao giờ hai tầng liền nhau cùng loại.
   - Trong mỗi nhánh, mọi tháp hợp lệ đều đồng khả năng.
3. **Hai câu liền nhau không cùng đáp án:** câu chẵn giữ tháp vừa rút. Câu lẻ tính lại tháp "tự do" (lần rút đầu, bước 2) của câu trước và câu sau, đều là câu chẵn, rồi rút lại (tối đa 32 lần) tới khi khác cả hai. So theo luật chấm: có thứ tự thì so cả dãy, Mầm thì so tập hợp. Không cần sinh lại cả chuỗi câu trước, `generate` vẫn không giữ trạng thái. Mầm chỉ có 6 bộ đáp án; không chặn thì cứ khoảng 6 câu lại có một lần lặp liền.
4. **Khay:** Mầm, Thường, Khó: `[0, 1, …, K − 1]` (cố định, loại k ở ô k). Siêu khó: `rng.shuffle` cả 8 loại, rút sau tháp nên không liên quan tới tháp.

- **Tất định:** chỉ phụ thuộc `(roundSeed, index, difficulty)`; mọi ngẫu nhiên đi qua `createRng`; mọi số là số nguyên; không đọc giờ, không `Math.random()`.
- **Đúng một đáp án:** đáp án được nhận chỉ phụ thuộc `layers`, cố định ngay khi sinh. Có thứ tự thì đúng một dãy; Mầm thì đúng một tập hợp. Mọi loại của tháp có trên khay nên đáp án luôn chạm được. Lúc xem không có chỗ mơ hồ: mỗi loại có hình và hoa văn riêng, hai tầng liền nhau không cùng loại (không bị nhìn thành một khối cao), không cho chạm khi đang xem.
- **Hợp với chống chạm đúp:** client bỏ qua lần chạm trùng loại với lần chạm ngay trước. Đáp án đúng không bao giờ có hai lần chạm liền nhau cùng loại (test vét cạn kiểm điều này), nên luật này không bao giờ chặn nhầm đáp án đúng.
- **Không làm "cùng gốc" giữa các mức** (GDD §6): mỗi mức có bộ khối và số tầng khác nhau, rút độc lập. Người chơi khác mức không so tháp với nhau, nên không cần.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 2 tầng · khay 4 loại cố định · **thứ tự tuỳ ý** · không lặp · xem 2,5 s, che 0,4 s | Tháp thấp, khối to; chỉ cần chạm đúng 2 khối đã thấy |
| Thường | 3 tầng · khay 5 loại cố định · đúng thứ tự · không lặp · xem 2,5 s, che 0,4 s | Thêm một tầng và một khối mồi; phải nhớ cả thứ tự |
| Khó | 4 tầng · khay 6 loại cố định · đúng thứ tự · **nửa số câu có một loại lặp** · xem 2 s, che 0,4 s | Tháp cao hơn, xem ngắn hơn; có câu một khối xuất hiện hai lần (không liền nhau) |
| Siêu khó | 5 tầng · khay 8 loại · đúng thứ tự · nửa số câu có lặp · **khay xáo chỗ mỗi câu** · xem 2 s, che 0,4 s | Tháp 5 tầng; khay đổi chỗ nên phải tìm khối theo hình, không bấm theo trí nhớ tay |

Siêu khó giữ luật lặp của Khó (độ khó không giảm ở tham số nào); kế hoạch chỉ ghi phần thêm mới.

Độ khó đo được (10 000 câu mỗi mức, cùng bộ seed với test):

| Mức | Số đáp án có thể có | Thời gian xem mỗi tầng | Đoán mò một đáp án cố định trúng | Câu có tầng lặp | Số đáp án khác nhau thấy được |
| --- | --- | --- | --- | --- | --- |
| Mầm | 6 tập hợp (12 tháp) | 1 250 ms | 1/6 ≈ 16,7 % | 0 % | 6 (đủ) |
| Thường | 60 | 833 ms | 1/60 ≈ 1,7 % | 0 % | 60 (đủ) |
| Khó | 720 (360 không lặp + 360 có lặp) | 500 ms | 1/720 ≈ 0,14 % | 49,6 % | 720 (đủ) |
| Siêu khó | 16 800 (6 720 + 10 080), × 40 320 cách xếp khay | 400 ms | ≤ 1/13 440 ≈ 0,007 % | 50,2 % | 7 495 |

Không mức nào dễ hơn mức trước ở bất kỳ tham số nào; số tầng, số loại trên khay, thời gian xem mỗi tầng và số đáp án đều khó hơn chặt chẽ ở từng bậc. Tầng lặp khó hơn hẳn tháp không lặp: người chơi quen "mỗi khối một lần" từ Mầm, Thường, và nhớ thứ tự một dãy có phần tử lặp kém hơn dãy không lặp (hiệu ứng Ranschburg).

Căn cứ chọn số tầng: trí nhớ ngắn hạn cho dãy hình có thứ tự khoảng 3–4 món ở trẻ 7 tuổi và 4–5 món ở người lớn khi chỉ xem 2–2,5 giây. Mầm 2 tầng (không cần thứ tự) thấp hơn tầm nhớ của trẻ 1–2 món; Siêu khó 5 tầng chạm trần của người lớn.

### Không có mẹo đoán

Đo trên 10 000 câu mỗi mức (test kiểm bằng ngưỡng 4 độ lệch chuẩn):

| Chiến lược / dấu hiệu | Mầm | Thường | Khó | Siêu khó | Mức may rủi |
| --- | --- | --- | --- | --- | --- |
| Chạm khay lần lượt từ trái sang | 16,1 % | 1,5 % | 0,13 % | 0,00 % | 16,7 / 1,7 / 0,14 / ≤ 0,007 % |
| Chạm khay từ phải sang | 16,3 % | 1,8 % | 0,13 % | 0,01 % | như trên |
| Đáp án hay gặp nhất | 17,1 % | 2,1 % | 0,25 % | 0,05 % | 16,7 / 1,7 / 0,14 / 0,007 % (lệch do so nhiều đáp án) |
| Chạm lại đáp án câu trước | 0 % | 0 % | 0 % | 0 % | chặn có chủ đích |
| Tháp "đi theo chiều khay" (tháp không lặp) | 50,5 % | 16,8 % | 4,0 % | 0,82 % | 1/N! = 50 / 16,7 / 4,2 / 0,83 % |
| Tầng đáy là ô khay đầu tiên | 25,0 % | 20,1 % | 16,7 % | 12,1 % | 1/K = 25 / 20 / 16,7 / 12,5 % |
| Đoán "có lặp" / "không lặp" | — | — | 49,6 / 50,4 % | 50,2 / 49,8 % | 50 % |

Loại ở tầng đáy và ô khay của từng tầng phân bố đều (lệch lớn nhất 5,4 %); cặp vị trí của tầng lặp phủ đủ mọi cặp không liền nhau, đều nhau. Vậy thứ tự khay không lộ thứ tự tháp, và không có chiến lược nào tốt hơn đoán mò.

## Đảm bảo khi sinh câu đố

Kiểm bằng `stack-recall.test.ts` (14 ca, chạy khoảng 3 giây):

- **Đúng một đáp án theo luật** (10 000 seed × 4 mức): `check` nhận tháp (Mầm: cả hai thứ tự chạm), và chấm đúng y như luật viết lại độc lập với mọi biến thể: đổi một tầng sang bất kỳ loại nào trong 8 loại, đổi chỗ hai tầng liền nhau, xếp ngược, mọi tiền tố ngắn hơn, thêm một khối, và mảng "các lần chạm còn đúng hướng + một khối lệch" (đúng hình dạng client gửi khi sai, luôn qua `isAnswer`).
- **Vét cạn** mọi cách chạm đủ N khối trên khay (Mầm, Thường, Khó 2 500 seed mỗi mức; Siêu khó 100 seed, mỗi seed 32 768 cách): có thứ tự thì đúng một dãy được nhận; Mầm thì đúng một tập hợp, nhận đủ 2 thứ tự của nó; đáp án được nhận không có hai lần chạm liền nhau cùng loại.
- `stackRecallOnTrack` đúng khi và chỉ khi các lần chạm còn nối thành đáp án đúng (vét cạn mọi dãy chạm dài 0–N trên 200 seed mỗi mức, Siêu khó 30).
- Tháp đúng luật của mức: đúng N tầng, loại trong [0, K), không hai tầng liền nhau cùng loại, mỗi loại tối đa hai lần, tối đa một loại lặp, Mầm và Thường không lặp. Khay đủ K loại, mỗi loại một lần; cố định ở Mầm–Khó, xáo ở Siêu khó; **mọi loại của tháp có trên khay**. Cờ `ordered`, `trayShuffled`, `showMs`, `coverMs`, `stackRecallRevealMs` đúng bảng.
- Bộ khối 8 loại, 8 hình khác nhau, 8 hoa văn khác nhau.
- Hai câu liền nhau không bao giờ cùng đáp án (10 000 cặp × 4 mức, cộng 500 vòng 40 câu).
- Độ khó tăng dần: số đáp án đếm thẳng từ luật 6 → 60 → 720 → 16 800; N, K, thời gian xem mỗi tầng, xác suất đoán trúng khó hơn chặt chẽ ở từng bậc; Mầm, Thường, Khó phủ đủ không gian đáp án.
- Không có mẹo đoán: các số ở [bảng trên](#không-có-mẹo-đoán), mỗi số nằm trong 4 độ lệch chuẩn của mức may rủi; tỉ lệ câu có lặp ở Khó, Siêu khó lệch 50 % không quá 3 điểm.
- Tất định: gọi hai lần cùng tham số ra giống hệt (10 000 seed × 4 mức); vài câu cố định (seed 777 câu 5, seed `0xdeadbeef`, seed 42 câu 0–5) ghi cứng để đổi cách sinh phải là cố ý.
- `isAnswer` nhận mảng hợp lệ, từ chối: không phải mảng (kể cả `Uint8Array`, đối tượng giả mảng), mảng rỗng, dài hơn 5, phần tử không nguyên, âm, ≥ 8, `NaN`, vô cực, chuỗi, `null`, `undefined`, `true`, mảng lồng, mảng thưa.
- `speedAllowanceMs` nguyên, ≥ 0, tất định, bằng bảng dưới, nhỏ hơn thời lượng vòng. `difficultyMultiplier` đúng bảng và không giảm khi lên mức.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức mình. Số liệu ước lượng trên giấy, đo lại sau buổi chơi thử đầu tiên.

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ đúng mục tiêu | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | xem + che 2,9 s + nhập ~2,2 s (trẻ) + chuyển 0,3 s ≈ 5,4 s | ~85 % (trẻ 7 tuổi) | ~10,7 câu (~9,1 đúng) |
| Thường | 2,9 + ~2,0 + 0,3 ≈ 5,2 s | ~90 % | ~11 câu (~9,9 đúng) |
| Khó | 2,4 + ~2,8 + 0,3 ≈ 5,5 s | ~80 % | ~10,6 câu (~8,4 đúng) |
| Siêu khó | 2,4 + ~3,8 + 0,3 ≈ 6,5 s | ~70 % | ~9,2 câu (~6,3 đúng) |

- "Nhập" là từ lúc khăn lau kéo lên tới lần chạm cuối: nhớ lại, tìm khối trên khay, chạm. Cùng một người lớn: Mầm ~1,2 s, Thường ~2,0 s, Khó ~2,8 s, Siêu khó ~3,8 s (khay xáo nên mỗi lần chạm phải dò lại 8 ô). Các mức cách nhau ≥ 0,8 s; dải ±15 % quanh mỗi mức không chồng nhau.
- Ở Thường, sau khi trừ miễn trừ, phần còn tính cho thưởng tốc độ là ~1,4 s nhập + 0,3 s chuyển câu, nằm trong khung 1–8 s của GDD. Siêu khó vẫn còn ~9 câu mỗi vòng (≥ 8).
- Một câu sai tốn gần bằng câu đúng (xem + nhập dở + khoá 1,5 s); số câu ở bảng đã tính theo tỉ lệ đúng mục tiêu.

### Hệ số điểm và miễn trừ thời gian (CR-006)

Khai báo trong `stackRecall` (`packages/shared/src/games/stack-recall/stack-recall.ts`); `scoring.ts` và server dùng các trường này.

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | 3 200 | Mô phỏng trẻ 7 tuổi cần 1,22 → min(1,22; 1) = 1. Miễn trừ: xem + che 2 900 + 300 × 1 lần chạm |
| Thường | 1 | 3 500 | Mốc so sánh. 2 900 + 300 × 2 |
| Khó | **1,4** | 3 300 | Mô phỏng cần 1,41, làm tròn tới 0,05. 2 400 + 300 × 3 |
| Siêu khó | **2,2** | 3 600 | Mô phỏng cần 2,20. 2 400 + 300 × 4 |

- `speedAllowanceMs(puzzle)` = `stackRecallRevealMs(puzzle) + 300 × (layers.length − 1)`: phần xem + che không chạm được, cộng **thời gian tối thiểu cho các lần chạm** (300 ms cho mỗi lần chạm sau lần đầu, đúng núm "phụ cấp mỗi lần chạm" Theo dấu ánh đèn để dành). Không có phụ cấp này thì tháp càng cao càng mất thưởng tốc độ chỉ vì phải chạm nhiều lần.
- Cách mô phỏng (200 000 vòng 60 s mỗi mức, giống Theo dấu ánh đèn, dùng chính `generate()`, `speedAllowanceMs` và `pointsForCorrect`): thời gian nhập ở bảng trên, dao động đều ±30 %; đúng theo tỉ lệ mục tiêu. Câu đúng: 0,25–0,35 s hiệu ứng tính vào câu sau (cả vào thời gian tính thưởng). Câu sai: xem + che + nhập dở (0–100 %) + khoá 1,5 s; câu sau tính từ lúc hết khoá. Câu chưa xong khi hết giờ không tính. Combo trần × 1,5. Điểm vòng tuyến tính theo hệ số nên giải ra hệ số để bằng Thường.

| Mức (người chơi) | Câu/vòng | Đúng/vòng | Σ combo | Thưởng tốc độ TB | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | 10,7 | 9,1 | 10,7 | 45,1 | 1,22 | 1 | ~1 550 (87 %) |
| Thường | 11,0 | 9,9 | 12,1 | 48,2 | 1 | 1 | ~1 790 (100 %) |
| Khó | 10,6 | 8,4 | 9,6 | 45,1 | 1,41 | 1,4 | ~1 785 (100 %) |
| Siêu khó | 9,2 | 6,3 | 6,9 | 40,2 | 2,20 | 2,2 | ~1 790 (100 %) |
| Người lớn chọn Mầm (nhập ~1,2 s, đúng ~97 %) | 13,0 | 12,6 | 16,6 | 50,0 | 0,58 | 1 | ~2 480 (139 %) |

- Hệ số chung cũ (0,8 / 1 / 1,25 / 1,5) làm người chọn mức cao bị thiệt rõ: Khó và Siêu khó ít câu đúng hơn hẳn trong khi thời gian xem gần như cố định.
- Mầm giữ 1 theo luật chung (hệ số không giảm khi lên mức); trẻ còn ~87 % điểm người lớn ở Thường, người lớn chọn Mầm được ~139 % (các game Ghi nhớ khác: 126–158 %).
- Script mô phỏng không lưu trong repo; đổi tham số thì chạy lại theo đúng các bước trên.

### Điểm chuẩn Kiểm tra não

Theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): nhóm Ghi nhớ 45 s, độ khó Thường, 4 000 lượt, thời gian nhập dao động đều ±20 %, câu sai tốn thời gian như câu đúng cộng khoá 1,5 s, chuyển câu 0,25–0,35 s, câu chưa xong khi hết giờ không tính, làm tròn tới 50.

| Giả định ở Thường | Câu · đúng | **Điểm chuẩn** | Nhanh hơn 30 % | Chậm hơn 40 % |
| --- | --- | --- | --- | --- |
| xem + che 2,9 s + nhập 2,0 s · 10 % sai | 8,0 · 7,2 | **1 250** (mô phỏng 1 259) | × 1,16 | × 0,82 |

Nhanh, chậm chỉ đổi phần nhập (xem + che cố định), nên hệ số dồn quanh 1 giống các game Ghi nhớ khác (× 1,15–1,23 / × 0,78–0,84). Số cần ghi vào `BRAIN_TEST_REFERENCE_SCORE["stack-recall"]` (điều phối cập nhật `brain-test.ts`).

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên (đổi tham số thì sửa bảng Độ khó, test, và tính lại hệ số; chỉ sửa số trong `stack-recall.ts`):

1. Siêu khó đúng < 60 %: xem 2,4 s ở Siêu khó (giữ 5 tầng), rồi mới tính bớt còn 4 tầng.
2. Khó và Thường quá gần nhau: tăng tỉ lệ câu có lặp ở Khó lên 2/3 (đổi đồng xu thành `rng.int(0, 2) > 0`).
3. Trẻ ở Mầm đúng < 80 %: xem 3 s ở Mầm.

## Ghi chú cho FE

Scene không vẽ chữ: chỉ khối, biểu tượng, chấm tiến độ, thanh thời gian. Canvas trong suốt trên khung `bg-muted`, nên khối, ô tầng và ô khay tự có nền + viền, đọc token màu lúc tạo scene. `locales.ts`: tên, mô tả thẻ, câu `howTo`, câu nhắc và gợi ý mức như mục [Màn hướng dẫn](#màn-hướng-dẫn).

**Lưu ý:** scene hiện có trong `apps/web/src/games/stack-recall/` là bản nháp cũ (khối là ô màu + chữ số, chấm theo thứ tự ở mọi mức), cần viết lại theo mục này. Hình dạng `Puzzle` có thêm trường `ordered`.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: `StackRecallPuzzle`, `StackRecallAnswer`, `StackRecallKind`, `STACK_RECALL_KINDS`, `stackRecallRevealMs`, `stackRecallOnTrack`, `WRONG_ANSWER_LOCK_MS`. Mọi số là số nguyên.

| Trường | Dùng để |
| --- | --- |
| `layers` | Vẽ tháp pha xem (`layers[0]` sát bệ); số ô tầng trống ở pha nhập = `layers.length`; vẽ đáp án đúng lúc khoá |
| `tray` | Vẽ khay: ô thứ i là loại `tray[i]`, xếp trái → phải, trên → dưới |
| `ordered` | Mầm (`false`): không vẽ số thứ tự trên ô tầng, câu nhắc "thứ tự nào cũng được" |
| `trayShuffled` | Siêu khó: huy hiệu xáo khay cạnh biểu tượng pha, hiện suốt câu |
| `showMs`, `coverMs`, `stackRecallRevealMs()` | Lịch: xem 0–`showMs`, che `showMs`–reveal, nhận chạm từ reveal |
| `stackRecallOnTrack(puzzle, taps)` | Chấm từng lần chạm ở client (đúng cả luật Mầm) |
| `STACK_RECALL_KINDS[k]` | `shape` + `pattern` của loại k để vẽ khối |

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | huy hiệu Ø 112, tâm (360, 140) | Mắt (đang xem) → mắt nhắm (che) → ngón tay (tới lượt). Siêu khó: huy hiệu xáo khay Ø 80, tâm (500, 140). Dải chấm tiến độ tâm y = 245: N chấm Ø 28, cách 20 px. |
| Thanh xem | 420×14, tâm (360, 280) | Pha xem: màu nhóm Ghi nhớ (`--color-memorize`), rút dần trong `showMs`. Ẩn ở pha nhập. |
| Tháp | cột tâm x = 360, bệ 440×20 có mép trên ở y = 900 | Khối 360×110, khe 8 px. Tầng i (0 = đáy) chiếm y từ 900 − 118(i + 1) + 8 tới 900 − 118i: đáy 790–900, tầng 5 (cao nhất) 318–428. Pha nhập: N ô tầng nét đứt cùng cỡ. |
| Thanh khoá | 420×14, tâm (360, 935) | Chỉ hiện khi sai, rút trong `bridge.unlockDelay`. |
| Khay | y 964–1212 | K = 4: một hàng 4 ô 150×150, khe 24 (x bắt đầu 24). K = 5: một hàng 5 ô 128×128, khe 12 (x bắt đầu 16). Hai mức này tâm hàng y = 1088. K = 6: 2 hàng × 3 ô 200×116, khe 16 (x bắt đầu 44). K = 8: 2 hàng × 4 ô 156×116, khe 16 (x bắt đầu 24). Ô khay vẽ khối thu nhỏ y hệt khối trên tháp (cùng hình, hoa văn, màu). |

Vùng chạm = cả ô khay (116–150 px; trên điện thoại ngang 390 px còn ~63–81 px ≥ 48 px). Chạm vào tháp, khe hay ngoài khay thì bỏ qua. Một điểm chạm mỗi lúc, dùng `pointerdown`. Trước reveal bỏ qua mọi lần chạm, không tính sai. Pha xem và che: ô khay là khung nét đứt rỗng (chưa lộ khối), để người chơi nhìn tháp chứ không dò khay trước.

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận chạm |
| --- | --- | --- | --- |
| Đang xem | 0 → `showMs` | Tháp đủ `layers` trên bệ; mắt; thanh xem rút dần; khay là khung nét đứt | Không |
| Che | `showMs` → reveal (400 ms) | Khăn lau phấn quét ngang từ trái sang trong 250 ms, che kín tháp; mắt nhắm. Khăn lau xong thì tháp biến mất, còn N ô tầng nét đứt | Không |
| Tới lượt | từ reveal tới lần chạm đầu | Khăn lau kéo đi (150 ms); khối khay hiện ra; ngón tay nảy 150 ms; chấm rỗng. Máy tính: con trỏ bàn tay, rê chuột ô khay nhấc lên 6 px | Có |
| Đang nhập | sau mỗi lần chạm đúng, chưa đủ N | Khối bay từ ô khay lên ô tầng trống thấp nhất (150 ms), ô đó thành khối thật; chấm tương ứng lấp đặc. Ô khay vẫn còn khối (chạm lại được) | Có; chạm trùng loại với lần chạm ngay trước thì bỏ qua |
| Đúng | lần chạm đúng thứ N | Gửi đáp án; cả tháp nảy 300 ms; sang câu mới | Không |
| Sai / khoá | lần chạm sai đầu tiên | Gửi ngay; xem mục dưới | Không, suốt thời gian khoá |

**Chấm và gửi:** giữ mảng `taps`. Mỗi lần chạm hợp lệ (đã qua reveal, không trùng lần chạm ngay trước), thêm loại vào `taps` rồi gọi `stackRecallOnTrack(puzzle, taps)`. Sai thì `bridge.submit(index, taps)` và vào Sai/khoá; đúng và `taps.length === layers.length` thì `bridge.submit(index, taps)` và vào Đúng. Server chấm lại để tính điểm. Ở Mầm, khối vẫn xếp từ dưới lên theo thứ tự chạm, thứ tự nào cũng đúng.

### Hiện đáp án đúng khi sai (CR-006)

- Vào khoá là hiện ngay (client đã có `layers`), suốt thời gian khoá lấy từ `bridge.unlockDelay`.
- Vùng tháp tách thành hai cột, khối thu còn 260×88, khe 8 px, vẫn đứng trên bệ y = 900:
  - **Trái (tâm x = 200), tháp người chơi xếp:** các khối đã chạm, mờ còn 35 %. Khối chạm sai không mờ, có dấu X hai nét (`--destructive`, viền phấn trắng) và rung ngang ±8 px trong 200 ms.
  - **Phải (tâm x = 520), tháp đúng:** đủ `layers`, không mờ, viền phấn nét đứt quanh cả tháp. Tầng nào người chơi đã xếp đúng có huy hiệu dấu tích nhỏ ở góc phải. Ở tầng chạm sai có mũi tên phấn vàng nối từ khối X sang khối đúng cùng tầng.
- Khay mờ còn 35 %, trừ ô của khối lẽ ra phải chạm có vòng vàng dày: có thứ tự thì là `layers[i]` (i = tầng chạm sai); Mầm thì mọi loại còn thiếu của tháp.
- Mọi thứ trên nằm dưới y = 290, không bị huy hiệu khoá ở dải trên cùng che (tầng cao nhất ở cột so sánh bắt đầu từ y = 428).
- Khi bật *giảm chuyển động*: tách cột ngay, không trượt; bỏ rung, giữ dấu X, dấu tích, mũi tên, vòng vàng.

### Hiển thị khối (không chỉ bằng màu)

- Khối là tấm bo góc 16 px, viền mực 4 px. Nền khối phủ **hoa văn** của loại (`pattern`) bằng nét phấn trắng mờ trên màu nền gợi ý; giữa khối là **hình** của loại (`shape`) cỡ ~70 % chiều cao khối, tô đặc, viền mực dày. Hai thứ cùng nhận diện loại, nên xem đen trắng vẫn phân biệt được.
- Ô tầng trống: khung nét đứt màu phấn; Thường trở lên có số thứ tự 1…N rất mờ ở góc trái (1 ở đáy) để nhắc "từ dưới lên". Mầm không có số.
- Nền tối: ô và khay đổi sang nền mực (`--sticker`), viền phấn; khối giữ nguyên màu và hoa văn.
- Khối tròn dùng đỏ cam, không dùng đỏ tươi, để khỏi lẫn với màu báo sai; dấu X luôn kèm viền phấn trắng.

### Hiệu ứng (đều ≤ 400 ms)

- Khăn lau quét 250 ms rồi giữ, kéo đi 150 ms, nằm gọn trong 400 ms che; kéo xong đúng lúc reveal.
- Chạm đúng: khối bay lên ô tầng 150 ms. Chạm trùng bị bỏ qua: ô khay lắc nhẹ 100 ms, không âm thanh.
- Đúng cả câu: tháp nảy 115 % rồi về, 300 ms (phần này tính vào câu sau như mọi game).
- Câu mới: tháp mờ dần vào 120 ms, thanh xem đầy lại. Siêu khó: khối khay xếp lại chỗ mới khi khay hiện ra, không bay qua lại (khay ẩn trong lúc xem nên người chơi không thấy xáo).
- *Giảm chuyển động*: khăn lau thay bằng mờ dần; bỏ bay, nảy, lắc. Lịch xem/che giữ nguyên vì là luật chơi.

### Âm thanh (GĐ 2)

- Mỗi lần đặt khối: tiếng "cộp" gỗ nhẹ, cao dần theo tầng (giống nhau cho mọi loại, không lộ đúng sai). Khăn lau: tiếng "xoạt". Đúng: "ting" cao dần theo combo. Sai: "bụp" trầm và rung ngắn.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, chiếu câu đó lại từ pha xem.
- Ẩn tab hoặc chuyển app lúc đang xem hoặc che: quay lại thì chiếu lại câu từ đầu. Đang nhập thì giữ nguyên.
- Lịch chạy bằng đồng hồ của scene (`this.time`), bắt đầu sau khung hình đầu tiên để tháp không bị giật.

### Ví dụ để vẽ bản mẫu

Tên loại theo bảng [Bộ khối](#bộ-khối). Tháp ghi từ dưới lên.

| Mức | Câu đố | Khung nên vẽ |
| --- | --- | --- |
| Mầm (`generate(777, 5, 0)`) | `layers = [3, 0]` (sao ca rô, tròn trơn) · khay `[0, 1, 2, 3]` | **Đang xem**, lúc 1 200 ms: tháp 2 tầng, mắt, thanh xem còn một nửa, khay là 4 khung nét đứt. Chơi đúng gửi `[3, 0]` hoặc `[0, 3]`. |
| Thường (`generate(0xdeadbeef, 0, 1)`) | `layers = [4, 1, 2]` (tim, vuông, tam giác) · khay `[0, 1, 2, 3, 4]` | **Đang nhập**: đã xếp tim (tầng 1) và vuông (tầng 2), ô tầng 3 nét đứt; ngón tay; chấm 2 đặc, 1 rỗng. Bản máy tính: chuột rê trên ô tam giác. |
| Khó (ví dụ trong test) | `layers = [0, 4, 0, 1]` (tròn, tim, tròn, vuông) · khay `[0, 1, 2, 3, 4, 5]` | **Đúng**: tháp 4 tầng vừa xếp xong cùng nảy; chấm 4 đặc; vừa gửi `[0, 4, 0, 1]`. Cho thấy khối tròn được chạm hai lần. |
| Siêu khó (`generate(777, 5, 3)`) | `layers = [0, 6, 5, 6, 1]` (tròn, giọt nước, trăng, giọt nước, vuông) · khay `[1, 4, 7, 6, 0, 2, 5, 3]` (hàng trên: vuông, tim, dấu cộng, giọt nước; hàng dưới: tròn, tam giác, trăng, sao) | **Sai / khoá**: đã xếp tròn, giọt nước rồi chạm nhầm tim (lẽ ra là trăng), gửi ngay `[0, 6, 4]`. Cột trái: tròn, giọt nước mờ + tim có X; cột phải: đủ 5 tầng, dấu tích ở tầng 1–2, mũi tên vàng ở tầng 3; ô trăng trên khay có vòng vàng; huy hiệu xáo khay; thanh khoá đang chạy. |

Nếu kịp, vẽ thêm pha **Che** (khăn lau đang quét ngang nửa tháp) và Mầm ở pha **Tới lượt** (2 ô tầng nét đứt không số, 4 khối khay to).

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M21 (ui-designer, 2026-10-20) vẽ đúng 4 câu ví dụ ở trên, thêm pha Che và Mầm ở pha Tới lượt. Toạ độ trên khung 720×1280.

- **Đã chốt, tấm bảng trong canvas cho vùng tháp:** rect x 42.5–677.5, y 298–950, bo 26, lòng #2b604d / #1b1832, viền sticker 5, bóng 7. Tháp, ô tầng, bệ và thanh khoá nằm trên bảng. Huy hiệu, chấm, thanh xem và khay nằm trên nền thẻ `bg-muted`, kiểu nhãn dán.
- **Đã chốt, hoa văn khối vẽ bằng mực** #1f1b3a 30 %, thay cho phấn trắng 72 %: phấn trắng gần như mất trên khối vàng, hồng, mint. Hình giữa khối là giấy #fff8ef viền mực dày 4 % chiều cao khối.
- **Đã chốt, khối dấu cộng giữ #a8693b ở cả hai nền.** Hiện `--color-wood` đổi sang #6b4528 ở nền tối.
- Bệ là gờ gỗ 440×20 (`--wood`, viền mực 4). Khi sai tách thành hai bệ 300 ở x 50 và x 370.
- Ô tầng trống: nét đứt phấn 80 %, dày 4, gạch 16 / 12 (cả hai nền). Số thứ tự Baloo 34, phấn 40 %, tâm x 214.
- Ô khay ở nền tối: `--card` + viền mực 4 + bóng 5 (thay cho `--sticker` + viền phấn). Ở pha xem / che, ô khay chỉ là khung nét đứt màu chữ thẻ 55–60 %.
- Khăn lau: tấm 440×604 bo 32, màu #e85d75, viền mực 5, đường may nét đứt, nếp hồng #f7a8b8, nghiêng −4°. Phía sau để lại vệt lau trắng 10 % trên bảng.
- Huy hiệu trạng thái: `--card` viền mực 5, bóng 6. Mắt và mắt nhắm vẽ nét dày 6; ngón tay là bàn tay trắng viền mực. Huy hiệu xáo khay: #e85d75, hai mũi tên mực.
- Chấm tiến độ: đặc #e85d75, rỗng `--card`, viền mực 3,5. Thanh xem: #e85d75 trên rãnh `--card`, viền mực 3.
- Khi đúng: tháp phóng 1,06 quanh (360, 900), kèm 6 nét phấn toả hai bên đỉnh tháp.
- Khi sai: dấu tích 0,55 tại (644, tâm tầng − 36). Mũi tên vàng từ x 334 tới 384 (mực 15, vàng 7). Vòng vàng quanh ô khay lùi ra 10 (mực 16, vàng 9). Thanh khoá đặt tại (150, 928).
- Hình hướng dẫn: biểu tượng bước (mắt, mắt nhắm, ngón tay) đặt dưới mỗi ô ở y 300, không đặt ở góc ô.

## Ghi chú cho BE

- **Không cần tin nhắn mới.** Đáp án là mảng số nguyên; `AnswerSchema.answer` là `z.unknown()` và `isAnswer` kiểm hình dạng. Mỗi câu chấm một lần, server không theo dõi từng lần chạm.
- `stackRecall.speedAllowanceMs(puzzle)` (3 200 / 3 500 / 3 300 / 3 600 ms) và `difficultyMultiplier` (1 / 1 / 1,4 / 2,2) đã khai báo trong định nghĩa game; server dùng các trường chung của CR-006, không cần sửa.
- Không khai báo `answerWindowMs`: không có vật biến mất trong lúc nhập.
- Không từ chối đáp án đến sớm hơn reveal (lệch mạng); chỉ kẹp thời gian tính thưởng về 0, như Theo dấu ánh đèn.
- Kiểm tra não: điểm chuẩn **1 250** cho `BRAIN_TEST_REFERENCE_SCORE["stack-recall"]` (đổi từ số giữ chỗ 1 500, cùng đợt tăng `BRAIN_TEST_RULES_VERSION` của CR-013).

## Đối chiếu quy tắc thiết kế

| Quy tắc (GDD §5) | Cách đáp ứng |
| --- | --- |
| Hiểu trong ≤ 5 giây | "Nhớ tháp, xếp lại từ dưới lên" + hình ba phần Xem / Che / Chạm |
| Một câu 1–8 giây ở Thường | Nhập ~2,0 s; còn ~1,7 s tính thưởng sau miễn trừ; cả câu ~5,2 s kể cả 2,9 s xem + che |
| Đúng một đáp án, test 10.000 seed | Đáp án chỉ phụ thuộc `layers`; kiểm bằng biến thể trên 10 000 seed × 4 mức và vét cạn mọi cách chạm |
| Chỉ số nguyên + `createRng` | Chỉ dùng `rng.shuffle`, `rng.int`, `rng.pick`; mọi tham số là số nguyên |
| Bốn mức rõ rệt, Mầm cho trẻ 7 tuổi | 2 → 3 → 4 → 5 tầng, 4 → 5 → 6 → 8 loại, xem mỗi tầng 1 250 → 400 ms, thêm thứ tự, tầng lặp, khay xáo; Mầm 2 khối, thứ tự tuỳ ý |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Ô khay 116–150 px (63–81 px trên điện thoại 390 px) |
| Không phụ thuộc chữ | Scene chỉ có khối, biểu tượng, chấm, số thứ tự mờ |
| Không chỉ phân biệt bằng màu | Mỗi loại khác cả hình lẫn hoa văn; sai: dấu X; đúng: dấu tích; xáo khay: huy hiệu |

## Câu hỏi mở

- **Tầng lặp ở Khó, Siêu khó: nửa số câu** (đã chọn) hay luôn có? Luôn có thì thành mẹo ("chắc chắn có một khối hai lần"); nửa số câu thì đoán có/không đều như tung đồng xu. Chơi thử xem có quá ức chế không.
- **Hệ số Mầm 1** theo luật chung: trẻ ~87 % điểm người lớn ở Thường, người lớn chọn Mầm ~139 %. Giữ như các game khác?
- **Khay ẩn trong lúc xem** (đã chọn, giống Ai vừa biến mất): để người chơi nhìn tháp. Nếu chơi thử thấy Siêu khó quá khó vì phải dò khay xáo, có thể cho khay hiện mờ trong lúc xem (đổi cân bằng, cần mô phỏng lại).
- Sau bản này: phím số 1–8 cho khay trên máy tính.
