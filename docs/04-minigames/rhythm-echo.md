# Nhại nhịp (`rhythm-echo`)

- Nhóm: Ghi nhớ
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/rhythm-echo/` (logic + test, đã làm), `apps/web/src/games/rhythm-echo/` (scene + chữ hiển thị, frontend-dev)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M22** (RhythmEchoMobile, RhythmEchoLevels, RhythmEchoStates, RhythmEchoHowTo). Chờ chủ dự án duyệt.
- Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.
- Nguồn: [CR-014](../00-tracking/change-requests.md#cr-014), [kế hoạch mở rộng › 3.12](../01-product/minigame-expansion.md#312-nhại-nhịp-rhythm-echo-ghi-nhớ). Chỉ mượn cơ chế "nghe nhịp, gõ lại" (trò nhại nhịp vỗ tay cổ điển của lớp nhạc), không lấy tên, hình, chữ hay code của trò nguồn.

## Cách chơi

Trống gõ một câu nhịp ngắn: nghe tiếng và nhìn mặt trống sáng lên theo từng tiếng. Tới lượt mình, gõ lại đúng câu đó: đúng trống trái hay phải, đúng nhịp nhanh chậm. Mức Mầm chỉ có một trống, chạm chỗ nào cũng được.

## Màn hướng dẫn

- **Cách chơi:**
  1. Nghe và nhìn trống gõ nhịp
  2. Gõ lại đúng trống trái, phải
  3. Giữ đúng khoảng cách giữa các tiếng
- **Điều khiển:** Chạm nửa trái / nửa phải vùng trống, một ngón hoặc hai ngón cái (điện thoại) · Click vào trống (máy tính) · Bàn phím: `←`, `A` hoặc `F` = trống trái; `→`, `D` hoặc `J` = trống phải; ở Mầm mọi phím trên và `Space` đều là trống duy nhất.
- **Hình minh hoạ:** một khung tĩnh chia hai nửa, giữa là mũi tên phấn.
  - Nửa trái, *Nghe* (biểu tượng tai phía trên): hai trống, trống trái đang sáng (vàng, viền phấn dày, vòng sóng lan ra) và có nốt nhạc phấn bay lên; dưới hai trống là dải nhịp nhỏ: 4 chấm trên một vạch, khoảng cách khác nhau, chấm thứ 2 đang sáng.
  - Nửa phải, *Gõ lại* (biểu tượng ngón tay): cùng hai trống, ngón tay phấn chạm trống phải, trống đó sáng; dải chấm tiến độ 2 đặc, 2 rỗng.
  - Góc dưới phải, cỡ nhỏ: biểu tượng loa gạch chéo cạnh trống đang sáng, nhắc "tắt tiếng vẫn chơi được".
- **Câu nhắc lúc đếm ngược:** "Nghe kỹ, gõ lại y hệt!"
- **Câu nhắc theo mức** (qua `levelHints`):
  - Mầm: "Một trống, chạm đâu cũng được!"
  - Khó: "Có chỗ nghỉ, đừng gõ vội!"
  - Siêu khó: "Có tiếng lệch phách, nghe kỹ!"
- **Gợi ý cạnh từng mức** ở bộ chọn độ khó: Mầm "1 trống · 3 tiếng đều" · Thường "2 trống · 4 tiếng đều" · Khó "5–6 tiếng · có nghỉ" · Siêu khó "6 tiếng · lệch phách".

## Câu đố & đáp án

Kiểu xuất từ `@brain-rizz/shared`: `RhythmEchoPuzzle`, `RhythmEchoAnswer`, `RhythmEchoHit`, `RhythmEchoSide`. Mọi thời gian là số nguyên ms.

- `Puzzle` (`RhythmEchoPuzzle`): `{ drums, hits, tolMs, unitMs, leadMs, tailMs }`
  - `drums: 1 | 2`: số mặt trống (1 ở Mầm).
  - `hits: { side: "left" | "right", atMs }[]`: câu nhịp, 3–6 tiếng. `hits[0].atMs = 0`, `atMs` tăng ngặt. Ở Mầm mọi `side` là `"left"`.
  - `tolMs`: dung sai cho **mỗi khoảng cách** giữa hai tiếng liền nhau (150 / 120 / 100 / 80).
  - `unitMs`: đơn vị nhịp = nửa phách; mọi khoảng cách là bội của nó. Scene dùng để vẽ vạch phách ở dải nhịp.
  - `leadMs = 500`: chờ từ lúc câu hiện tới tiếng đầu. `tailMs = 400`: lặng sau tiếng cuối rồi mới tới lượt gõ.
  - Lịch: tiếng `k` vang lúc `leadMs + hits[k].atMs`; được gõ từ **`rhythmEchoListenMs(p) = leadMs + span + tailMs`**, với `span = rhythmEchoSpanMs(p) = hits[N−1].atMs`.
- `Answer` (`RhythmEchoAnswer`): `{ side, atMs }[]`, các lần gõ theo thứ tự gõ; `atMs` đo ở client, **tính từ lần gõ đầu** (lần đầu = 0), làm tròn ms. Gửi một lần mỗi câu (xem [Gửi đáp án](#gửi-đáp-án)). Ở Mầm client ghi mọi lần gõ là `"left"`.
- `check(p, a)`: đúng khi và chỉ khi `a.length = N`, `a[k].side = hits[k].side` với mọi k, và với mọi k ≥ 1: `|(a[k].atMs − a[k−1].atMs) − (hits[k].atMs − hits[k−1].atMs)| ≤ tolMs`. Không xét thời điểm tuyệt đối nên dời cả đáp án đi bao nhiêu cũng vậy. Một đáp án đúng để test server dùng: chính `generate(s, i, d).hits`.
- `isAnswer(v)`: mảng 1–6 phần tử (6 = câu dài nhất ở mọi mức); mỗi phần tử là object có `side` là `"left"` hoặc `"right"` và `atMs` là số nguyên trong [0, 60 000]; `atMs` **không giảm**. Hai lần gõ cùng ms (hai ngón chạm cùng lúc) vẫn hợp lệ để server không vứt câu và lệch `progress` với client; `check` chấm sai vì khoảng 0 ms luôn ngoài khung. Khoá thừa trong object được bỏ qua. Mảng thưa, mảng lồng, chuỗi, `NaN`, `Infinity`, `atMs` âm hay lẻ đều bị từ chối.
- Hàm phụ cho client (shared, thuần): `rhythmEchoFirstMiss(p, taps)` trả vị trí lần gõ sai đầu tiên (thừa, sai mặt, lệch nhịp) hoặc −1; `check` dùng chính hàm này nên client và server không bao giờ chấm khác nhau. `rhythmEchoNextWindow(p, taps)` trả `{ fromMs, toMs }` mà lần gõ kế phải rơi vào (hai đầu tính đúng), `undefined` khi chưa gõ lần nào hoặc đã đủ. Hằng `RHYTHM_ECHO_DEBOUNCE_MS = 100`.

## Cách sinh câu đố

1. `rng = createRng(deriveSeed(roundSeed, index))`.
2. Lấy tham số mức ở bảng [Độ khó](#độ-khó). Bốc đều lần lượt: số tiếng N, đơn vị nhịp `unitMs`, một **câu nhịp** (dãy N − 1 khoảng cách tính bằng đơn vị), một **dãy mặt trống**. Chỉ dùng `rng.pick`.
3. Danh sách câu nhịp và dãy mặt trống hợp lệ được **liệt kê hết một lần lúc nạp module** theo thứ tự cố định (không dùng `rng`), nên bốc đều và tất định:
   - Mầm, Thường: một câu nhịp duy nhất, mọi khoảng = 2 đơn vị (1 phách).
   - Khó: khoảng ∈ {1, 2, 4} đơn vị (móc đơn, nốt đen, nốt đen + nghỉ 1 phách); nốt ngắn luôn đi **đôi** ("ti-ti"); có ít nhất một đôi ti-ti và một chỗ nghỉ; dài ≤ 10 đơn vị (5 phách). Được 9 câu nhịp 5 tiếng và 13 câu nhịp 6 tiếng.
   - Siêu khó: khoảng ∈ {1, 2, 3, 4} đơn vị; không quá 2 nốt ngắn liền nhau; có ít nhất một tiếng **nghịch phách**; dài ≤ 10 đơn vị. Được 135 câu nhịp 6 tiếng.
   - Dãy mặt trống: Mầm toàn `"left"`; các mức khác là mọi dãy N mặt có ít nhất 1 (Thường, Khó) hoặc 2 (Siêu khó) lần đổi mặt giữa hai tiếng liền nhau: 14 dãy (4 tiếng), 30 (5 tiếng), 62 (6 tiếng, Khó), 52 (6 tiếng, Siêu khó).
4. `hits[0].atMs = 0`, `hits[k].atMs = hits[k−1].atMs + khoảng[k−1] × unitMs`.

**Nghịch phách** (định nghĩa dùng trong code và test): vị trí tiếng tính bằng đơn vị từ tiếng đầu, tiếng đầu coi là đúng phách, phách = 2 đơn vị. Tiếng `k` (không tính tiếng đầu và cuối) nghịch phách khi nó rơi vào nửa phách (vị trí lẻ) và phách ngay sau nó không có tiếng (khoảng kế ≥ 2 đơn vị), tức nốt lệch phách được ngân qua phách. Ở Khó, tiếng ở nửa phách chỉ có ở giữa một đôi ti-ti nên không bao giờ nghịch phách.

- **Tất định:** chỉ phụ thuộc `(roundSeed, index, difficulty)`; mọi số là số nguyên; không đọc giờ, không `Math.random()`.
- **Đúng một đáp án.** Ở game này "một đáp án" là **một câu nhịp**: đúng một dãy mặt trống được nhận, và phần thời gian chỉ cho phép xê dịch ±`tolMs` quanh câu nhịp đó.
  - Mặt trống so từng tiếng, nên trong 2^N dãy mặt trống chỉ một dãy được nhận (test duyệt hết 2^N dãy trên 2 500 seed mỗi mức).
  - Khoảng ngắn nhất ≥ `2·tolMs + 60` ms, nên mọi khoảng được nhận đều ≥ `tolMs + 60` > 0: thứ tự hai lần gõ không bao giờ mơ hồ, và hai ngón chạm cùng lúc luôn sai.
  - Các loại khoảng cách trong cùng một mức cách nhau ≥ `2·tolMs + 60` ms, nên khung nhận của hai độ dài nốt không bao giờ chạm nhau (cách ≥ 60 ms): một lần gõ chỉ có thể khớp **một** độ dài nốt. Gõ "nửa vời" giữa nốt đen và nốt nghỉ là sai, đổi chỗ hai khoảng khác nhau là sai.
  - Đáp án tham chiếu là chính `hits` (đã dời về 0). Dời cả câu, hoặc lệch mỗi khoảng đúng tới ±`tolMs`, vẫn đúng; lệch `tolMs + 1`, sai mặt, thiếu, thừa, bỏ một tiếng giữa đều sai.
- **Mầm, một trống: chốt** client quy mọi lần gõ về `"left"` (chạm đâu trong vùng trống cũng được, mọi phím trống cũng được), còn `check` vẫn so mặt chặt. Người chơi thấy "gõ bên nào cũng được", trên đường truyền chỉ có một dãy `"left"…` được nhận. Không nới `check` cho Mầm vì như vậy có 2^3 dãy cùng đúng, phá bất biến "đúng một đáp án" và làm test khó đọc.

## Độ khó

| Mức | Tham số | Người chơi thấy gì |
| --- | --- | --- |
| Mầm | 1 trống · 3 tiếng · nhịp đều · phách 500–800 ms (7 tốc độ, bước 50) · ±150 ms | Một trống to giữa màn; "tùng · tùng · tùng" đều, nhanh chậm khác nhau giữa các câu |
| Thường | 2 trống · 4 tiếng · nhịp đều · phách 400–700 ms (7 tốc độ) · đổi trống ≥ 1 lần · ±120 ms | Hai trống; nhớ thứ tự trái/phải, giữ nhịp đều |
| Khó | 2 trống · 5 hoặc 6 tiếng · nửa phách 260 / 280 / 300 ms · có đôi ti-ti (nốt ngắn) và chỗ nghỉ (khoảng 2 phách) · ±100 ms | Câu có nhịp: "tùng · ti-ti · tùng — · tùng"; phải chờ đủ chỗ nghỉ |
| Siêu khó | 2 trống · 6 tiếng · nửa phách 260 / 280 ms · nốt ngắn đứng lẻ, khoảng 1,5 phách, có thể có nghỉ · ≥ 1 tiếng nghịch phách · đổi trống ≥ 2 lần · ±80 ms | Tiếng rơi lệch phách, khó đếm; dung sai hẹp nhất |

**Khoảng cách tối thiểu (chốt).** Quy tắc: khoảng ngắn nhất và chênh lệch giữa hai loại khoảng đều ≥ `2·tolMs + 60` ms. Thêm giới hạn nháy: không quá 3 tiếng trong một giây bất kỳ (`hits[k+3] − hits[k] > 1 000` ms), dưới ngưỡng 3 lần nháy/giây của WCAG 2.3.1 vì mỗi tiếng làm một mặt trống lớn sáng lên.

| Mức | `tolMs` | `2·tol + 60` | Khoảng ngắn nhất thật | Khoảng dài nhất | Độ dài câu (`span`) | Pha nghe |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 150 | 360 | **500** | 800 | 1 000–1 600 | 1 900–2 500 |
| Thường | 120 | 300 | **400** | 700 | 1 200–2 100 | 2 100–3 000 |
| Khó | 100 | 260 | **260** | 1 200 | 2 080–3 000 | 2 980–3 900 |
| Siêu khó | 80 | 220 | **260** | 1 120 | 1 820–2 800 | 2 720–3 700 |

Ở Khó và Siêu khó, ba khoảng liền nhau nhỏ nhất là 1 + 1 + 2 đơn vị = 4 × 260 = 1 040 ms > 1 000 ms, nên giới hạn nháy luôn giữ (test kiểm trên 10 000 seed mỗi mức).

**Độ khó đo được** (10 000 seed mỗi mức, `rhythm-echo.test.ts`). Mỗi mức khó hơn mức trước ở mọi chỉ số, không chỉ số nào giảm:

| Mức | Số tiếng TB | Loại khoảng cách TB mỗi câu | Tiếng ở nửa phách | Tiếng nghịch phách TB | Câu khác nhau có thể có · gặp trên 10 000 seed | Tỉ lệ qua của "người gõ giả" cố định |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | 3 | 1 | 0 % | 0 | 7 · 7 | 99,8 % |
| Thường | 4 | 1 | 0 % | 0 | 98 · 98 | 99,2 % |
| Khó | 5,5 | 2,80 | 18,8 % | 0 | 3 228 · 2 894 | 81,9 % |
| Siêu khó | 6 | 2,85 | 46,5 % | 1,60 | 14 040 · 7 066 | 78,1 % |

"Người gõ giả" của test: luôn đúng mặt, nhịp cả câu lệch chuẩn 4 %, mỗi khoảng lệch thêm 4 %, khoảng dài/ngắn bị kéo 5 % về khoảng trung bình, mỗi lần chạm lệch 15 ms. Mầm ít câu khác nhau (chỉ đổi tốc độ) là cố ý: trẻ 7 tuổi chỉ cần giữ nhịp đều; độ đa dạng tăng từ Thường.

## Đảm bảo khi sinh câu đố

- Luôn có đúng một đáp án theo nghĩa ở trên: `check(p, p.hits)` đúng; dời cả câu (1, 137, 5 000 ms) đúng; mỗi khoảng lệch đúng ±`tolMs` hoặc ngẫu nhiên trong ±`tolMs` đúng; một khoảng bất kỳ lệch ±(`tolMs` + 1) sai; trong 2^N dãy mặt trống đúng một dãy được nhận (Mầm: chỉ toàn `"left"`); mọi tiền tố ngắn hơn, thừa một tiếng (cả hai mặt), bỏ một tiếng giữa, đổi chỗ hai khoảng liền nhau khác nhau đều sai.
- `rhythmEchoFirstMiss` khớp `check` trên đáp án lệch ngẫu nhiên tới 1,5 × `tolMs` và sai mặt 5 %; `rhythmEchoNextWindow` rộng đúng `2·tolMs`, hai đầu được nhận, ra ngoài 1 ms là sai ngay ở lần gõ đó.
- Đúng bảng tham số: `drums`, N, `tolMs`, `unitMs`, `leadMs`, `tailMs`; `hits[0].atMs = 0`, `atMs` nguyên, tăng ngặt; khoảng là bội của `unitMs` trong bộ khoảng của mức; độ dài ≤ trần; số lần đổi mặt ≥ mức tối thiểu.
- Luật câu nhịp: Mầm/Thường đều; Khó nốt ngắn chỉ đi đôi, luôn có ti-ti và nghỉ, không nghịch phách; Siêu khó không quá 2 nốt ngắn liền, luôn ≥ 1 tiếng nghịch phách.
- Khoảng cách tối thiểu và giới hạn nháy như bảng trên; khoảng ngắn nhất thật từng mức được chốt bằng test (500 / 400 / 260 / 260).
- Bộ lọc chạm nảy `RHYTHM_ECHO_DEBOUNCE_MS` (100 ms) nhỏ hơn khoảng nhỏ nhất còn được nhận ở mọi mức (`khoảng − tol` ≥ 160 ms), nên không bao giờ chặn nhầm một lần gõ đúng.
- Độ khó tăng dần: bảng Độ khó đo được ở trên (test kiểm từng cột tăng, dung sai giảm, nghịch phách chỉ ở Siêu khó, nửa phách chỉ từ Khó, tỉ lệ qua của người gõ giả giảm ngặt).
- `isAnswer` nhận mọi đáp án client hợp lệ có thể gửi (đủ câu, mọi tiền tố, tiền tố + một lần gõ sai mặt, hai lần gõ cùng ms) và từ chối rác: không phải mảng, mảng rỗng, dài hơn 6, phần tử `null`/mảng/số/chuỗi, `side` lạ (`"up"`, `""`, `0`, `"LEFT"`), thiếu trường, `atMs` âm, lẻ, chuỗi, `NaN`, `Infinity`, > 60 000, giảm dần, mảng thưa.
- `speedAllowanceMs` nguyên, tất định, bằng pha nghe + `span`, nằm trong khoảng ở bảng Cân bằng, nhỏ hơn thời lượng vòng.
- Tất định: sinh hai lần giống hệt trên 10 000 seed × 4 mức; câu cố định seed 777 câu 5 ghi cứng trong test.

Các điều trên được kiểm bằng test 10 000 seed × 4 mức; các ca nặng (duyệt mọi dãy mặt, mọi biến thể) chia đều 10 000 seed cho 4 mức (`rhythm-echo.test.ts`, 13 ca, ~1,3 giây).

## Cách chấm

**Luật:** như `check` ở trên. Client chấm từng lần gõ bằng `rhythmEchoFirstMiss` để phản hồi ngay; server chấm lại cả mảng bằng `check` (dùng cùng hàm), nên hai bên luôn cùng kết quả.

**Cách client đo** (bắt buộc, chi tiết ở [Ghi chú cho FE](#đo-thời-gian-lần-gõ)): lấy `event.timeStamp` của `pointerdown` / `keydown` gốc (giờ phần cứng ghi nhận sự kiện), không lấy giờ lúc handler chạy hay giờ khung hình Phaser; `atMs = Math.round(t_k − t_0)`.

**Mức tin cậy: đáp án đo thời gian phía client, server tin số client gửi** (giống Rót vừa vạch). backend-dev dựa vào mục này viết ADR "đáp án đo thời gian phía client".

1. **Không thêm lỗ hổng mới.** Client đã biết seed (hạn chế NFR-SEC-02) nên bot gửi chính `hits` là đúng, như gửi đúng chỉ số ở mọi game khác. Đo thời gian ở client không làm game dễ gian lận hơn; nó chỉ có nghĩa là server không tự kiểm được người chơi có thật sự gõ đúng nhịp. Chấp nhận như hạn chế đã biết.
2. **Không đo ở server.** Server ghi giờ nhận từng lần gõ sẽ dính lệch mạng dao động 20–200 ms (≫ dung sai 80 ms) và tốn N tin nhắn mỗi câu. Loại.
3. **Độ trễ cố định tự triệt tiêu** vì chỉ chấm khoảng cách: đường chạm của máy (30–100 ms), trễ loa (tai nghe Bluetooth 150–300 ms), trễ màn hình đều dời cả câu nghe lẫn câu gõ đi một lượng như nhau. Người dùng tai nghe Bluetooth không bị thiệt.
4. **Độ trễ dao động còn lại** (phần làm lệch khoảng cách): lấy mẫu cảm ứng 60–120 Hz (≤ 8–17 ms), khung hình của đèn nháy cho người tắt tiếng (≤ 17 ms ở 60 Hz), giật khung hình (tránh được bằng `event.timeStamp`), tiếng trống xếp lịch theo đồng hồ `AudioContext` (sai số dưới 1 ms). Ước ≤ 20–30 ms mỗi khoảng trên Android tầm trung, tức ≤ 40 % dung sai hẹp nhất. **Phải đo lại trên một máy Android tầm trung trước khi chốt dung sai** (rủi ro của kế hoạch).
5. **Dung sai từng mức và lý do.** `tolMs` đặt ≈ 1,6–3,5 lần độ lệch chuẩn ước của một khoảng gõ (người chơi mục tiêu + máy) ở khoảng điển hình của mức; chỗ khó nhất mỗi mức là khoảng dài nhất vì sai số gõ tăng theo độ dài khoảng.

   | Mức (người chơi) | Khoảng điển hình | σ ước một khoảng | `tolMs` | tol / σ |
   | --- | --- | --- | --- | --- |
   | Mầm (trẻ 7 tuổi) | 650 ms | ~70 ms | 150 | ~2,1 |
   | Thường (người lớn) | 550 ms | ~35 ms | 120 | ~3,4 |
   | Khó | ti 280 ms · nghỉ 1 120 ms | ~26 ms · ~63 ms | 100 | ~3,8 · ~1,6 |
   | Siêu khó | ti 260 ms · 1,5 phách 810 ms | ~25 ms · ~49 ms | 80 | ~3,2 · ~1,6 |

   σ gồm: sai số nhịp trong đầu ~4 % khoảng (trẻ ~7 %), nhịp cả câu nhớ lệch ~3,5 % (trẻ ~6 %), lệch tay mỗi lần chạm ~12 ms (trẻ ~25 ms, tính hai lần chạm), máy ~10 ms. Dung sai là con số tuyệt đối của kế hoạch (không tỉ lệ theo khoảng) cho dễ hiểu và dễ vẽ; nếu chơi thử thấy chỗ nghỉ ở Khó sai quá nhiều thì dùng núm chỉnh 2 ở [Cân bằng](#cân-bằng).
6. **Vì sao chấm khoảng chứ không chấm thời điểm:** ngoài việc triệt tiêu trễ cố định, một lần chạm lệch chỉ ảnh hưởng hai khoảng kề nó, không kéo sai mọi tiếng sau. Hệ quả có chủ ý: không kiểm trôi nhịp cộng dồn (mỗi khoảng chậm 90 ms ở Khó vẫn đúng); giữ đúng "hình" câu nhịp là đủ, cả câu hơi nhanh hay hơi chậm vẫn được.
7. **Không cần `answerWindowMs` (hạn trả lời).** Không có vật biến mất; `atMs` tính từ lần gõ đầu nên chờ lâu rồi mới gõ không làm đúng thêm, chỉ mất thời gian và thưởng tốc độ. Trong câu, client tự gửi khi quá hạn tiếng kế (`rhythmEchoNextWindow`) nên người chơi không bị kẹt. Server giữ như mọi game: không từ chối đáp án đến sớm (lệch mạng), chỉ kẹp thời gian tính thưởng về 0.
8. Một kiểm tra hợp lý có thể ghi vào ADR (không đề xuất làm): đáp án đúng không thể tới sớm hơn `shownAt + listenMs + span − (N−1)·tolMs` trừ lệch mạng. Bot biết seed chỉ cần chờ đủ lâu nên kiểm này không chặn được gì.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn chọn đúng sức. Số liệu ước lượng trên giấy và mô phỏng, đo lại sau buổi chơi thử đầu tiên.

**Giả định người chơi** (mô hình gõ dùng để ước tỉ lệ đúng, chạy trên chính `generate()` và `check`): mỗi khoảng gõ = khoảng nghe × (1 + lệch nhịp cả câu) + sai số trong đầu, cộng lệch tay và máy ở mỗi lần chạm; khoảng dài/ngắn bị kéo về khoảng trung bình (người lớn 5 %, trẻ 10 %). Thêm tỉ lệ nhớ sai hình câu (mặt trống, chỗ nghỉ, nốt lệch phách): người lớn 1 / 4 / 8 / 12 %, trẻ 3 % ở Mầm.

| Mức | Thời gian giải dự kiến mỗi câu | Tỉ lệ đúng (mô hình) | Số câu dự kiến mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm (trẻ 7 tuổi) | nghe 2,2 s + chờ ~1,0 s + gõ 1,3 s + chuyển 0,3 s ≈ 4,8 s | ~91 % (nhịp 93 %) | ~12 (~11 đúng) |
| Thường | 2,55 + ~0,6 + 1,65 + 0,3 ≈ 5,1 s | ~96 % (nhịp 99,6 %) | ~11 (~11 đúng) |
| Khó | 3,5 + ~0,7 + 2,6 + 0,3 ≈ 7,1 s | ~78 % (nhịp 85 %) | ~8 (~6 đúng) |
| Siêu khó | 3,4 + ~0,8 + 2,5 + 0,3 ≈ 7,0 s | ~73 % (nhịp 83 %) | ~8 (~6 đúng) |

- "Nghe" là pha không gõ được, "gõ" là chính độ dài câu nhịp (không làm nhanh hơn được). Ở Thường phần thao tác thật (chờ + gõ) ~2,3 s, nằm trong khung 1–8 s của GDD.
- Siêu khó còn ~8,2 câu mỗi vòng (≥ 8). Khó và Siêu khó gần bằng nhau về thời gian vì cùng trần 5 phách; Siêu khó khó hơn nhờ nghịch phách và dung sai hẹp, không nhờ câu dài hơn.
- Một câu sai tốn: nghe + gõ dở + khoá 1,5 s (client gửi ngay khi chắc chắn sai).

**Hệ số điểm và miễn trừ thời gian** ([CR-006](../00-tracking/change-requests.md#cr-006), khai báo trong `rhythmEcho`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` (khoảng) | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | 2 900–4 100 ms | Trẻ 7 tuổi cần 1,04 → min(1,04; 1) = 1 |
| Thường | 1 | 3 300–5 100 ms | Mốc so sánh |
| Khó | **2,45** | 5 060–6 900 ms | Mô phỏng cần 2,44, làm tròn tới 0,05 |
| Siêu khó | **2,7** | 4 540–6 500 ms | Mô phỏng cần 2,71 |

- `speedAllowanceMs(p) = rhythmEchoListenMs(p) + rhythmEchoSpanMs(p)` = pha nghe + thời gian gõ bắt buộc (= `leadMs + tailMs + 2 × span`). Phần còn lại tính thưởng tốc độ chỉ là lúc chờ trước lần gõ đầu (+ 0,3 s hiệu ứng câu trước + mạng), thường ~1 s, nên **gần như mọi câu đúng được trọn 50 điểm tốc độ**; chần chừ quá ~1,2 s trước tiếng đầu mới bắt đầu mất (~1 điểm mỗi 130 ms). Game thưởng nhịp chuẩn, không thưởng tay nhanh.
- Cách tính `difficultyMultiplier`: mô phỏng 50 000 vòng 60 s mỗi mức bằng chính `generate()`, `speedAllowanceMs` và `pointsForCorrect` (trần combo × 1,5). Mỗi câu: nghe đúng pha nghe; chờ trước tiếng đầu dao động đều ±30 % quanh giả định; gõ đúng `span`; đúng với xác suất ở bảng trên. Câu đúng: 0,3 s hiệu ứng tính vào câu sau. Câu sai: nghe + gõ dở (0–100 %) + khoá 1,5 s. Câu chưa xong khi hết giờ không tính. Điểm vòng tuyến tính theo hệ số nên giải ra hệ số để điểm vòng bằng Thường.

| Người chơi | Câu · đúng mỗi vòng | Hệ số cần | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 12,1 · 10,9 | 1,04 | 1 | ~2 020 (98 %) |
| Người lớn · Thường | 11,3 · 10,8 | 1 | 1 | ~2 070 (100 %) |
| Người lớn · Khó | 8,2 · 6,3 | 2,44 | 2,45 | ~2 070 (100 %) |
| Người lớn · Siêu khó | 8,2 · 5,9 | 2,71 | 2,7 | ~2 070 (100 %) |
| Người lớn chọn Mầm | 13,5 · 13,4 | 0,66 | 1 | ~2 690 (130 %) |

- Khó và Siêu khó cần hệ số cao (như Luyện ngắm 1,75 / 2,55) vì câu dài gấp rưỡi Thường nên mỗi vòng chỉ ~8 câu so với ~11, lại đúng ít hơn. Ít nhạy với giả định: bỏ phần kéo về khoảng trung bình trong mô hình thì hệ số cần là 2,33 / 2,60; bỏ dao động thời gian chờ thì 2,45 / 2,71.
- Hệ số chung cũ 0,8 / 1 / 1,25 / 1,5 cho ~85 / 100 / 59 / 62 %: chọn mức cao bị thiệt nặng.
- Người lớn chọn Mầm được 130 % (Theo dấu ánh đèn 144 %).
- Script mô phỏng không lưu trong repo; khi đổi số thì chạy lại theo đúng các bước trên.

**Điểm chuẩn Kiểm tra não: 1 450** (đề xuất cho `BRAIN_TEST_REFERENCE_SCORE["rhythm-echo"]`, điều phối điền vào `brain-test.ts`). Theo cách của [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): 4 000 lượt người lớn ở Thường, 45 s của nhóm Ghi nhớ; chờ trước tiếng đầu dao động đều ±20 % quanh 0,6 s (độ dài câu nhịp cố định theo câu, không dao động); đúng 95,7 % (mô hình); câu sai tốn như câu đúng + khoá 1,5 s; giữa hai câu 0,25–0,35 s hiệu ứng. Kết quả ~8,3 câu · 7,9 đúng, 1 450–1 456 điểm tuỳ luồng ngẫu nhiên, làm tròn tới 50. Người nhanh hơn 30 % được × 1,05, chậm hơn 40 % được × 0,95; đúng 90 % thì × 0,90, đúng 85 % thì × 0,82, đúng 99 % thì × 1,07.

- Hạn chế: tốc độ gần như không đổi điểm (nhịp cố định), chỉ độ chính xác phân biệt người chơi; người lớn bình thường đã đúng ~96 % nên kỹ năng Ghi nhớ từ game này dồn quanh 100 và khó vượt ~107. Mạnh hơn "Hạn chế đã biết" của GDD (Ghi nhớ × 1,15–1,23). Xem núm chỉnh 1.

Núm chỉnh sau chơi thử, theo thứ tự ưu tiên (đổi tham số thì sửa bảng Độ khó, test, và tính lại hệ số theo cách trên; chỉ sửa số trong `rhythm-echo.ts`):

1. **Thường quá dễ** (người lớn đúng > 95 %, điểm Kiểm tra não ít phân biệt): cho Thường một nốt dài 2 phách (bộ khoảng {2, 4}, phách 400–550 ms) để có "hình nhịp" ngay từ Thường.
2. **Chỗ nghỉ ở Khó sai quá nhiều** (> 30 % câu sai do khoảng nghỉ): đổi dung sai thành `tolMs + 5 % × khoảng` (vẫn giữ khung các loại khoảng không chạm nhau), hoặc bỏ đơn vị 300 ms ở Khó.
3. **Siêu khó đúng < 60 %:** nới `tolMs` lên 90 (khoảng ngắn nhất 260 vẫn ≥ 2·90 + 60 = 240).
4. **Trẻ ở Mầm đúng < 80 %:** bỏ hai tốc độ chậm nhất (750, 800 ms), trẻ khó giữ nhịp chậm.
5. **Điện thoại thua máy tính rõ:** đo lại trễ chạm trên Android tầm trung trước, rồi mới nới dung sai cho mọi người (không chia theo thiết bị).

## Ghi chú cho FE

Scene không vẽ chữ: chỉ biểu tượng, trống, chấm. Canvas trong suốt đặt trên khung `bg-muted`, nên trống tự có nền và viền rõ ở cả hai giao diện (đọc token màu lúc tạo scene). `locales.ts`: tên "Nhại nhịp", câu `howTo` từ mục Cách chơi, nội dung màn hướng dẫn và `levelHints` từ mục Màn hướng dẫn.

### Dữ liệu từ shared

Import từ `@brain-rizz/shared`: kiểu `RhythmEchoPuzzle`, `RhythmEchoAnswer`, `RhythmEchoHit`, `RhythmEchoSide`; hàm `rhythmEchoListenMs`, `rhythmEchoSpanMs`, `rhythmEchoFirstMiss`, `rhythmEchoNextWindow`; hằng `RHYTHM_ECHO_DEBOUNCE_MS`, `WRONG_ANSWER_LOCK_MS`.

| Trường / hàm | Dùng để |
| --- | --- |
| `drums` | 1: một trống to giữa, mọi lần gõ là `"left"`; 2: hai trống trái/phải |
| `hits` | Trình chiếu: tiếng k vang lúc `leadMs + hits[k].atMs` trên trống `hits[k].side`; vẽ dải nhịp đáp án khi sai |
| `unitMs` | Vạch phách trên dải nhịp (mỗi `2 × unitMs` một vạch) |
| `rhythmEchoListenMs(p)` | Hết pha nghe, bắt đầu nhận gõ |
| `rhythmEchoFirstMiss(p, taps)` | Chấm từng lần gõ: ≠ −1 là sai, gửi ngay |
| `rhythmEchoNextWindow(p, taps)` | Hạn tiếng kế (`toMs`): quá hạn chưa gõ thì gửi ngay; vẽ khung nhận khi sai |

### Bố cục (khung 720×1280)

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Trạng thái | y 72–330 | Biểu tượng pha 112×112, tâm (360, 160): **tai** khi đang nghe, **ngón tay** khi tới lượt. Dải chấm tiến độ tâm y = 290: N chấm Ø 28 px, cách 20 px, không mang thông tin trái/phải. |
| Vùng trống | y 360–1240, cả bề ngang | 2 trống: vùng chạm là **cả nửa trái** (x 0–360) và **cả nửa phải** (x 360–720); mặt trống tròn Ø 300, tâm (180, 700) và (540, 700). Mầm: cả vùng là một vùng chạm, một trống Ø 400 tâm (360, 700). |
| Dải nhịp (chỉ khi sai) | y 940–1160, x 40–680 | Xem [Hiện đáp án đúng khi sai](#hiện-đáp-án-đúng-khi-sai). Nằm dưới mép trống (y 850), ngoài dải huy hiệu khoá. |

Vùng chạm rất lớn (360 × 880 px) để gõ bằng hai ngón cái không cần nhìn. Chạm ngoài vùng trống (y < 360) thì bỏ qua.

### Hai trống (không chỉ phân biệt bằng màu)

- Vị trí trái/phải chính là thuộc tính cần nhớ, không phụ thuộc màu.
- *Trống trái*: mặt tròn, hoa văn vòng tròn đồng tâm và chấm giữa, tiếng trầm. *Trống phải*: mặt tròn cùng cỡ, hoa văn dây chéo hình chữ X ở viền, tiếng cao. Hai hoa văn khác nhau để bản đồ dải nhịp dùng lại làm biểu tượng làn.
- *Sáng* (mỗi tiếng, cả lúc nghe lẫn lúc mình gõ): nền vàng `--primary`, phóng 106 %, viền phấn 6 px, một vòng sóng lan ra ngoài. Chênh độ sáng tắt/sáng ≥ 4,5 : 1. Sáng 140 ms, nên ở khoảng ngắn nhất 260 ms vẫn tắt ≥ 120 ms trước tiếng kế trên cùng trống. Không dùng đỏ cho trống sáng (dễ lẫn với báo sai, nháy đỏ gây khó chịu).
- Lúc nghe: trống không nhận chạm, con trỏ thường; lúc tới lượt: con trỏ bàn tay, rê chuột thấy viền mảnh.

### Trạng thái

| Trạng thái | Khi nào | Hiển thị | Nhận gõ |
| --- | --- | --- | --- |
| Đang nghe | 0 → `listenMs` | Biểu tượng tai; trống sáng + tiếng theo lịch; chấm k lấp khi tiếng k vang | Không: bỏ qua, không tính sai |
| Chờ gõ | Từ `listenMs` tới lần gõ đầu | Tai đổi thành ngón tay (nảy 150 ms), tiếng "tách" hai nốt, chấm về rỗng. Không giới hạn thời gian | Có |
| Đang gõ | Sau mỗi lần gõ khớp, chưa đủ N | Trống vừa gõ sáng như lúc nghe + tiếng trống của mặt đó; chấm tương ứng lấp đặc | Có |
| Đúng | Lần gõ thứ N khớp | Gửi; hai trống cùng nảy 300 ms; sang câu mới | Không |
| Sai / khoá | Lần gõ đầu tiên sai, hoặc quá hạn tiếng kế | Gửi ngay; chấm của bước sai hiện X; trống mờ 35 %; dải nhịp đáp án hiện; thanh khoá rút trong `WRONG_ANSWER_LOCK_MS` | Không, trong 1 500 ms |

### Gửi đáp án

- Giữ mảng `taps` của câu. Mỗi lần gõ hợp lệ (sau `listenMs`, trong vùng trống, qua bộ lọc nảy): `side` = `"left"` nếu `drums = 1`, ngược lại theo nửa màn / phím; `atMs = Math.round(ts − ts₀)`; thêm vào `taps`.
- Gọi `rhythmEchoFirstMiss(p, taps)`: ≠ −1 thì `bridge.submit(index, taps)` và vào Sai/khoá; bằng −1 và đủ N thì `bridge.submit(index, taps)` và vào Đúng.
- Sau mỗi lần gõ khớp mà chưa đủ N: hẹn giờ tới `rhythmEchoNextWindow(p, taps).toMs + 50 ms` (tính theo `ts₀`). Hết giờ mà chưa có lần gõ mới thì gửi `taps` hiện có (thiếu tiếng → sai) và vào Sai/khoá. 50 ms dư chỉ làm báo sai muộn chút, không đổi đúng/sai vì chấm dựa trên `atMs`.
- **Bộ lọc nảy:** bỏ qua lần gõ cùng mặt tới sớm hơn `RHYTHM_ECHO_DEBOUNCE_MS` (100 ms) sau lần gõ trước của mặt đó. Gõ khác mặt sát nhau vẫn tính (đó là lỗi thật). Bỏ qua phím lặp do giữ phím (`event.repeat`), phím kèm Ctrl/Alt/Meta, và phím khi đang gõ chữ / mở hộp thoại (`shouldIgnoreGameKey` trong `games/keyboard.ts`).
- Chấm ngay ở client như Theo dấu ánh đèn; server chấm lại cả mảng để tính điểm.

### Đo thời gian lần gõ

- Dùng `event.timeStamp` của sự kiện DOM gốc (`pointer.event.timeStamp` trong Phaser, `KeyboardEvent.timeStamp`), không dùng `this.time.now`, `performance.now()` trong handler hay giờ khung hình: các giờ đó dính độ giật khung hình 16–50 ms.
- Bật đa chạm (`this.input.addPointer(1)`) để gõ hai ngón cái xen kẽ; mỗi `pointerdown` là một lần gõ, bất kể ngón kia còn chạm hay không. Dùng `pointerdown`, không chờ `pointerup`.
- Gõ trước `listenMs` hay ngoài vùng trống thì bỏ qua, không đưa vào `taps`, không đặt `ts₀`.

### Trình chiếu, âm thanh và tắt tiếng

- **Phải chơi được khi tắt tiếng** (tắt sfx trong app, máy để im lặng, hoặc `AudioContext` chưa mở khoá trên iOS): mặt trống sáng theo từng tiếng là đủ để chơi; tiếng chỉ là phụ. Hình minh hoạ hướng dẫn có biểu tượng loa gạch chéo cạnh trống sáng.
- Đã có âm thanh hiệu ứng (CR-008): `apps/web/src/features/sfx/` phát qua **một `AudioContext` chung** (`@/lib/audio-context`), có công tắc bật/tắt riêng và tiếng tổng hợp bằng Web Audio (`recipes.ts`, có sẵn tiếng trống nhiễu lọc dùng cho trống dồn vinh danh). Đề xuất dùng lại: thêm hai loại tiếng tổng hợp `drum-low` (trống trái: sine ~110 Hz tắt nhanh + nhiễu lọc thấp) và `drum-high` (trống phải: nhiễu lọc dải ~2 kHz như snare), 0 KB, theo công tắc sfx. Không phát qua sound manager của Phaser để khỏi mở `AudioContext` thứ hai.
- `playSfx` hiện phát "ngay"; để khoảng cách nghe được chính xác, cần xếp lịch cả câu trước theo đồng hồ `AudioContext` (vd. thêm tuỳ chọn `when` vào `PlaySfxOptions`), không gọi `playSfx` trong từng `delayedCall` (lệch theo khung hình ±16 ms). Đèn nháy xếp theo `this.time` từ cùng một mốc bắt đầu; lệch cố định giữa tiếng và đèn không ảnh hưởng khoảng cách.
- Tiếng khác: tới lượt "tách" hai nốt; đúng "ting" theo combo, sai "bụp" (tầng React đã có theo `answerResult`).

### Hiện đáp án đúng khi sai

Vào Sai/khoá là hiện ngay (client đã có `hits`), suốt 1 500 ms khoá; hết khoá xoá cùng lúc với trống mờ dần vào câu mới. Vẽ **dải nhịp** ở y 940–1160 (dưới mép trống, ngoài dải huy hiệu khoá ở trên cùng):

- Một thanh thời gian ngang x 80–640, tỉ lệ sao cho câu nhịp dài nhất vừa khung; vạch phách mờ mỗi `2 × unitMs`.
- Hai làn: làn trên = trống trái, làn dưới = trống phải, đầu mỗi làn có hoa văn trống tương ứng (Mầm chỉ một làn).
- Tiếng đúng (`hits`): chấm đặc Ø 28 nền `--card` viền phấn, đặt ở `x ∝ atMs` trong làn của mặt đó, đánh số 1…N.
- Lần gõ của người chơi: vòng rỗng nét đứt Ø 28, đặt ở làn mặt đã gõ, căn để lần gõ đầu trùng tiếng đầu.
- Lần gõ sai đầu tiên (vị trí `rhythmEchoFirstMiss`): dấu X màu `--destructive` viền phấn trắng đè lên vòng của nó; trên làn đúng của tiếng đó vẽ khung nhận `rhythmEchoNextWindow(p, taps.slice(0, k))` thành vạch mờ, để thấy "sớm quá / muộn quá / sai trống". Quá hạn (chưa gõ): dấu X đặt ở cuối khung nhận.
- Không đủ thời gian phát lại cả câu trong 1,5 s (câu dài tới 3 s), nên không phát lại. Khi bật *giảm chuyển động*: dải nhịp hiện ngay, không trượt vào.

### Hiệu ứng (đều ≤ 300 ms)

- Trống sáng 140 ms (bật 40 ms, tắt 100 ms), vòng sóng lan 250 ms. Đúng cả câu: hai trống nảy 115 % rồi về, 300 ms. Sai: trống lắc ±8 px 200 ms, mờ trong 150 ms.
- Khi bật *giảm chuyển động*: bỏ phóng to, nảy, lắc, vòng sóng; giữ đổi độ sáng và viền (là luật chơi khi tắt tiếng). Lịch trình chiếu giữ nguyên.

### Tình huống đặc biệt

- Hết giờ vòng giữa câu: dừng, không gửi gì.
- Nối lại giữa vòng: bắt đầu ở `bridge.startIndex`, phát lại câu đó từ đầu pha nghe.
- Ẩn tab hoặc chuyển app lúc đang nghe: quay lại thì phát lại câu từ đầu. Đang gõ dở mà ẩn tab: gửi ngay `taps` hiện có (sai) khi quay lại, vì nhịp đã đứt.
- Lịch trình chiếu bắt đầu sau khung hình đầu tiên của câu để tiếng đầu không bị giật.

### Ví dụ để vẽ bản mẫu

Bốn câu thật (seed 777, câu 5, có trong test). "T" = trái, "P" = phải; thời điểm tính từ tiếng đầu, vang thật lúc `500 + atMs` ms.

| Mức | Câu đố | Khung nên vẽ |
| --- | --- | --- |
| Mầm | 1 trống · T T T · 0, 700, 1 400 · nghe tới 2 300 ms | **Đang nghe**, lúc ~1 250 ms: trống sáng (tiếng 2), tai, chấm 2 đặc, 1 rỗng. Chơi đúng sẽ gửi ba lần `"left"`, ví dụ `0, 690, 1 410`. |
| Thường | P P P T · 0, 600, 1 200, 1 800 · ±120 | **Đang gõ**: đã gõ P, P (chấm 2 đặc), trống phải đang sáng; ngón tay. Bản máy tính: nhãn phím nhỏ "← A F" / "→ D J" dưới trống. |
| Khó | T P P P P T · 0, 560, 1 680, 1 960, 2 240, 2 800 (phách, nghỉ, ti-ti, phách) · ±100 | **Đúng**: hai trống nảy, 6 chấm đặc. |
| Siêu khó | P T P P P T · 0, 560, 840, 1 400, 2 520, 2 800 (tiếng 3 và 4 lệch phách) · ±80 | **Sai / khoá**: đã gõ P 0, T 560, P 840, rồi gõ P ở 1 300 (lẽ ra 1 400 ± 80 → sớm 100 ms), gửi ngay 4 lần gõ. Dải nhịp: 6 chấm đúng, 4 vòng của người chơi, X ở vòng thứ 4, vạch khung nhận 1 320–1 480 trên làn phải. Thanh khoá đang chạy. |

### Chỉnh scene theo bản mẫu

Bản mẫu hàng M22 giữ nguyên bố cục, màu trống và nhịp sáng ở trên; các việc frontend-dev cần chỉnh trong `RhythmEchoScene.ts` (toạ độ khung 720 × 1280):

- **Huy hiệu tắt tiếng (chốt):** pha nghe mà sfx tắt hoặc `AudioContext` chưa `running` thì hiện huy hiệu tròn r 25 tâm (408, 209): nền `--card`, viền `--sticker` 4, bóng 5 px, `SPEAKER_PATH` + `MUTE_PATH` scale 1,5. Người tắt tiếng biết phải nhìn trống.
- **Đúng:** đĩa biểu tượng pha tô `--primary` + `CHECK_PATH` scale 1,9 trong 300 ms (phản hồi còn lại khi giảm chuyển động); vẫn nảy hai trống 115 %.
- **Sai/khoá:** biểu tượng pha thành X `--destructive` nét 10 suốt khoá; trống mờ 35 % giữ ở y 700.
- **Giảm chuyển động:** trống sáng giữ 100 % (không 106 %), viền mực 9 thay 5 để bù vòng sóng; lịch nháy không đổi.
- **Dải nhịp:** lần gõ = vòng đứt Ø 44 bao quanh chấm đáp án Ø 30 (số 1…N màu `--card`, Baloo 2 cỡ 20); làn trái y 1010, làn phải y 1092; vạch phách đứt mờ 18 % y 968–1134; thang 540 px = 3 000 ms.
- **Khung nhận** của tiếng sai: chữ nhật cao 48 bo 10, `--primary` 60 %, viền đứt `--card-foreground` 2,5. X sai: phấn 13 rồi `--destructive` 6,5.
- **Biểu tượng làn** r 17 (từ 15), viền `--chalk-muted` ở nền tối.
- Hoa văn trống tắt alpha 0,45 → 0,5; thêm bóng đổ `--sticker` 7 px dưới trống sáng.
- `RhythmEchoHowTo.tsx`: phóng loa gạch chéo `translate(430 300) scale(1.45)`, trống nhỏ r 18 tại (508, 318).

## Ghi chú cho BE

- **Không cần tin nhắn mới, không đổi schema.** `AnswerSchema.answer` là `z.unknown()`; `isAnswer` kiểm hình dạng (mảng ≤ 6 object nhỏ). Mỗi câu một tin, server không theo dõi từng lần gõ. Nhịp gửi ~1 đáp án / 5 giây, xa dưới `MAX_ANSWERS_PER_SECOND`.
- Đáp án có `atMs` đo ở client: mức tin cậy, dung sai và lý do ở [Cách chấm](#cách-chấm), làm đầu vào cho ADR "đáp án đo thời gian phía client" (chung với Rót vừa vạch).
- `speedAllowanceMs(p) = rhythmEchoListenMs(p) + rhythmEchoSpanMs(p)`; `difficultyMultiplier` = 1 / 1 / 2,45 / 2,7. **Không khai báo `answerWindowMs`** (lý do ở Cách chấm, mục 7). Không từ chối đáp án đến sớm, như mọi game.
- Test server cần một đáp án đúng: `GAMES["rhythm-echo"].generate(s, i, d).hits`.
- Kiểm tra não: điểm chuẩn đề xuất **1 450** (mục Cân bằng).

## Tác động Kiểm tra não

Nhóm Ghi nhớ lên 5 game (Theo dấu ánh đèn, Ai vừa biến mất, Lật cặp, Xếp lại tháp, Nhại nhịp), mỗi game được bốc 1/5. Theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): thay số giữ chỗ 1 500 bằng **1 450**, tăng `BRAIN_TEST_RULES_VERSION` một lần cho cả đợt CR-014, thêm dòng vào bảng điểm chuẩn ở GDD: Ghi nhớ · Nhại nhịp · 45 s · nghe ~2,55 s + chờ 0,6 s + gõ ~1,65 s · 4,3 % · 8,3 · 7,9 · **1 450** · × 1,05 · × 0,95. Việc này của điều phối (không sửa trong phiên này).

## Đối chiếu quy tắc thiết kế

| Quy tắc (GDD §5) | Cách đáp ứng |
| --- | --- |
| Hiểu trong ≤ 5 giây | "Nghe trống gõ, gõ lại y hệt" + hình hai nửa Nghe / Gõ lại |
| Một câu 1–8 giây ở Thường, sau miễn trừ | Thao tác thật ~2,3 s (chờ + gõ); cả câu ~5,1 s kể cả 2,55 s nghe |
| Đúng một đáp án, test 10 000 seed | Một dãy mặt trống, khung nhận các độ dài nốt tách rời; mục Đảm bảo |
| Chỉ số nguyên + `createRng` | Bốn lần `rng.pick` từ danh sách liệt kê sẵn; mọi thời gian nguyên |
| Bốn mức rõ rệt, Mầm cho trẻ 7 tuổi | 1 → 2 trống, 3 → 6 tiếng, đều → nghỉ + ti-ti → nghịch phách, ±150 → ±80 ms; Mầm một trống, nhịp đều, chạm đâu cũng được |
| Một ngón tay, khung dọc, vùng chạm ≥ 48 px | Vùng chạm nửa màn 360 × 880 px; một ngón hoặc hai ngón cái đều được |
| Không phụ thuộc chữ | Scene chỉ có biểu tượng, trống, chấm |
| Không chỉ phân biệt bằng màu | Trái/phải theo vị trí + hoa văn trống khác nhau; sáng = độ sáng + viền + vòng sóng; sai = dấu X |
| Chơi được khi tắt tiếng (CR-014) | Mỗi tiếng đều có mặt trống sáng; âm thanh không mang thông tin riêng |

## Câu hỏi mở

Đã tự chốt khi hiện thực (báo điều phối để chủ dự án xác nhận):

- **Mầm một trống:** client quy mọi lần gõ về `"left"`, `check` vẫn so mặt chặt (mục Cách sinh câu đố).
- **Siêu khó lấy luôn chỗ nghỉ của Khó** (bộ khoảng {1, 2, 3, 4}, kế hoạch chỉ ghi "nghịch phách"). Mô phỏng cho thấy nếu bỏ chỗ nghỉ thì Siêu khó dễ qua phần nhịp hơn Khó (khoảng dài 1 200 ms với ±100 ms là chỗ khó nhất); gộp vào thì mỗi mức chứa mọi thứ của mức trước và độ khó tăng chắc chắn.
- **Thêm bàn phím** (← A F / → D J, Mầm thêm Space): click chuột qua lại hai nửa màn trong 260 ms quá khó, máy tính sẽ thiệt.
- **Giới hạn nháy ≤ 3 tiếng/giây** (WCAG 2.3.1) như Theo dấu ánh đèn.

Còn mở:

- Dung sai chốt sau khi đo trễ chạm thật trên Android tầm trung (rủi ro của kế hoạch).
- Thường có quá dễ không (mô hình ~96 % đúng)? Nếu có, dùng núm chỉnh 1 (thêm nốt dài ở Thường).
- Có cần nhịp đếm vào (2 tiếng "tách" trước câu) ở Khó/Siêu khó để dễ bắt phách không? Hiện không có, để giữ pha nghe ngắn.
