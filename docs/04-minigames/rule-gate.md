# Cổng luật (`rule-gate`)

- Nhóm: Phân tích
- Thời lượng vòng: 60 000 ms (mặc định cho game mới theo CR-006)
- File: `packages/shared/src/games/rule-gate/` (logic + test), `apps/web/src/games/rule-gate/` (scene + chữ hiển thị)
- Bản mẫu: [canvas Brain Rizz](https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ), trang **Minigame**, hàng **M25** (RuleGateMobile, RuleGateLevels, RuleGateStates, RuleGateHowTo). Chờ chủ dự án duyệt.
- Nguồn cơ chế: trò "gác cổng" (cho vào / mời về theo luật) và trắc nghiệm phân loại thẻ Wisconsin (luật ẩn, chỉ biết qua đúng/sai), theo [kế hoạch mở rộng › 3.13](../01-product/minigame-expansion.md#313-cổng-luật-rule-gate-phân-tích) và [CR-014](../00-tracking/change-requests.md#cr-014). Chỉ mượn cơ chế; tên, nhân vật, cổng lớp, bảng phấn là của Brain Rizz.

> Trạng thái: **🚧 Đang làm, chờ chơi thử** (2026-10-20). Đã có đặc tả, bộ sinh câu đố + test 10 000 seed, scene Phaser, màn hướng dẫn và hình minh hoạ, chữ vi/en, điểm chuẩn Kiểm tra não; đã đăng ký và chơi được trong Luyện tập, phòng party, Kiểm tra não. Còn: bản mẫu ui-designer, chơi thử trên máy thật để chốt thời gian giải và hệ số.

**Khác Phấn trượt thế nào.** Phấn trượt đổi luật **theo màu từng câu** (trắng theo mũi, vàng theo trượt) và luật luôn là một trong hai luật cố định học từ màn hướng dẫn. Cổng luật có **luật mới thật sự** mỗi khối vài câu: luật là điều kiện trên **đặc điểm của bạn** (loài, mũ, kính, đồ cầm tay), vẽ bằng biểu tượng trên bảng, giữ nguyên suốt khối rồi đổi sang luật khác. Ở Siêu khó luật bị giấu hẳn, người chơi phải tự suy ra từ phản hồi đúng/sai. Đáp án chỉ có hai bên (vào / về), không có hướng.

## Cách chơi

Từng bạn đi tới cổng lớp. Bảng phấn vẽ "vé vào cổng": bạn nào khớp vé thì **vuốt trái cho vào**, không khớp thì **vuốt phải mời về**. Luật đổi sau vài bạn; ở Siêu khó vé bị úp, phải đoán luật qua đúng/sai.

## Màn hướng dẫn

- **Cách chơi:**
  1. Bảng vẽ vé: bạn nào được vào
  2. Khớp vé: vuốt trái cho vào cổng
  3. Không khớp: vuốt phải mời về nhà
- **Điều khiển:** Vuốt trái / phải hoặc chạm hai nút Cổng / Nhà (điện thoại) · Phím ← → (hoặc A D), click hai nút (máy tính).
- **Hình minh hoạ:** khung bảng phấn. Trên cùng là một tấm vé vẽ biểu tượng **mũ lưỡi trai**. Giữa: một bạn thỏ đội mũ lưỡi trai đứng trước cổng; cổng lớp bên trái mở, có mũi tên phấn cong vào cổng + dấu tích; ngôi nhà nhỏ bên phải mờ, gạch chéo. Góc dưới: hình bạn mèo không mũ nhỏ hơn, mũi tên chỉ về nhà (ví dụ "không khớp").
- **Câu nhắc lúc đếm ngược:** "Khớp vé: trái · Không: phải!"
- **Câu nhắc theo mức:** Mầm "Có hình trên vé thì cho vào!" · Thường "Vé mới hiện lên thì đọc lại!" · Khó "Vé ghép: xem cả hai, coi dấu cấm!" · Siêu khó "Vé bị úp: đoán luật qua đúng sai!".
- **Gợi ý cạnh từng mức:** Mầm "Một vé cả vòng" · Thường "Vé đổi sau 6 bạn" · Khó "Vé ghép, đổi sau 4–6 bạn" · Siêu khó "Vé ẩn, đổi ngầm".

## Câu đố & đáp án

**Bạn** (`RuleGateBuddy`), mọi thuộc tính phân biệt bằng **hình**, không chỉ bằng màu:

| Thuộc tính | Giá trị | Vẽ | Mức có |
| --- | --- | --- | --- |
| `species` | `"cat"` mèo · `"bunny"` thỏ · `"panda"` gấu trúc | Tai nhọn tam giác · tai dài · tai tròn + quầng mắt | mọi mức |
| `hat` | `true` / `false` | Mũ lưỡi trai | mọi mức |
| `glasses` | `true` / `false` | Kính tròn hai mắt | Thường trở lên (Mầm luôn `false`) |
| `item` | `"none"` · `"book"` sách · `"ball"` bóng | Cầm trên tay: hình chữ nhật có gáy · hình tròn có sọc | mọi mức |

Mầm có 3 × 2 × 3 = **18** bạn khác nhau, các mức khác 3 × 2 × 2 × 3 = **36** bạn (`ruleGateBuddyCount`).

**Luật** (`RuleGateRule`) = điều kiện để được **vào**; không thoả thì mời về.

- Đặc điểm (`RuleGateFeature`, một biểu tượng): `cat`, `bunny`, `panda`, `hat`, `glasses`, `book`, `ball` (`RULE_GATE_FEATURES`, `RULE_GATE_FEATURE_ATTR`).
- Vế (`RuleGateTerm`): `{ feature, negated }` = bạn có đặc điểm đó (hoặc **không** có, khi `negated`).
- Luật: `{ op: "single", terms: [vế] }` hoặc `{ op: "and" | "or", terms: [vế, vế] }`. Hai vế luôn trên hai thuộc tính khác nhau, xếp theo thứ tự `species → hat → glasses → item`.
- Hàm dùng chung: `ruleGateHas(buddy, feature)`, `ruleGateTermHolds(buddy, term)`, `ruleGateAdmits(rule, buddy)`.

- `Puzzle` (`RuleGatePuzzle`):
  - `buddy`: bạn đang đứng ở cổng.
  - `rule`: luật của khối chứa câu này. **Có cả khi luật ẩn** (để FE hiện gợi ý, xem dưới; client vốn biết seed nên không lộ thêm gì so với NFR-SEC-02).
  - `ruleShown`: `boolean`: vẽ vé lên bảng không (Siêu khó: `false`).
  - `ruleIsNew`: `boolean`: câu đầu của khối mới ở mức hiện luật → FE báo "vé mới". Câu 0 của vòng và mọi câu Siêu khó: `false`.
  - `answer`: `"in" | "out"` = `ruleGateAdmits(rule, buddy) ? "in" : "out"`.
- `Answer` (`RuleGateAnswer`): chuỗi **`"in"`** (cho vào, vuốt trái) hoặc **`"out"`** (mời về, vuốt phải). Gửi một lần mỗi câu. `check`: đúng khi `answer === puzzle.answer`. `isAnswer`: đúng hai chuỗi đó, phân biệt hoa thường.
- Đáp án đúng cho test server: `GAMES["rule-gate"].generate(s, i, d).answer`.

## Cách sinh câu đố

`generate` không giữ trạng thái. Mỗi câu tính lại khối của nó và luật của khối từ seed vòng:

1. **Khối** (`ruleGateBlock(seed, index, d)`): độ dài khối thứ j = `createRng(deriveSeed(seed, j, LENGTH_SALT + d)).int(min, max)` (Mầm, Thường cố định 6, không bốc). Ranh giới khối là dãy cộng dồn cố định theo seed vòng, nên người nhanh, người chậm gặp luật mới ở cùng số thứ tự câu. Tìm khối của câu `index` là O(index / 4).
2. **Luật khối** (`ruleGateRule(seed, khối, d)`): luật khối 0 bốc từ `deriveSeed(seed, 0, RULE_SALT + d)`. Khối j ≥ 1 bốc từ `deriveSeed(seed, j, RULE_SALT + d)`, bốc lại tối đa 8 lần nếu trùng luật khối j − 1 (Siêu khó: nếu cùng thuộc tính), rồi mới dùng luật thay tất định (đổi VÀ ↔ HOẶC, hoặc sang thuộc tính kế). Chuỗi tính lại từ khối 0 mỗi lần, O(số khối) ≈ 5–15 mỗi vòng. Mầm dùng luật khối 0 cả vòng.
   - Một vế: chọn thuộc tính đều trong các thuộc tính của mức, rồi chọn đặc điểm đều trong thuộc tính đó; phủ định với xác suất `negatePct`.
   - Hai vế (Khó): hai thuộc tính khác nhau (xáo rồi lấy hai cái đầu, xếp lại theo thứ tự chuẩn), mỗi vế như trên; VÀ / HOẶC 50/50.
   - Muối cộng thêm độ khó: hai người cùng phòng chọn hai mức khác nhau **không thấy chung luật**, nên người chơi Siêu khó không nhìn trộm được luật ẩn trên máy người chơi Thường (trùng ngẫu nhiên ~18 %).
3. **Phân câu trong khối** (luồng `deriveSeed(seed, khối, PLAN_SALT + d)`), khối dài L:
   - Khối mới (khối ≥ 1 ở mức có đổi luật) có một **câu phân định** ở vị trí bốc đều trong `discriminateWithin` câu đầu (Thường, Khó: 3 câu đầu; Siêu khó: luôn câu đầu). Bạn ở câu đó lấy trong tập "luật mới cho vào, luật cũ mời về" hoặc ngược lại (bốc 50/50 nếu cả hai khác rỗng). Hai luật khác bảng chân trị nên ít nhất một tập khác rỗng. Ai vẫn theo luật cũ chắc chắn sai câu này.
   - Số câu "vào" của khối bốc đều trong [2, L − 2] (tính cả câu phân định), xáo vị trí. Mỗi khối có **≥ 2 câu vào và ≥ 2 câu về**, nên luôn chọn một bên chỉ đúng ~50 %, và không đếm được để đoán câu cuối khối.
   - Bạn cho câu vào / câu về lấy **không lặp** trong tập bạn khớp / không khớp luật (xáo một phần Fisher–Yates). Tập nhỏ nhất (vd. "mèo VÀ cầm sách" = 4 bạn) vẫn đủ cho L ≤ 6 của Khó, nên trong một khối không có hai bạn giống hệt nhau.
4. `answer = ruleGateAdmits(rule, buddy) ? "in" : "out"`.

Chỉ dùng số nguyên và `createRng()`; không có vòng thử lại không giới hạn.

**Vì sao đúng một đáp án:** luật là hàm boolean trên bạn, nên mỗi bạn có đúng một kết quả vào hoặc về. Luật không bao giờ hằng đúng hay hằng sai: mỗi vế dùng một thuộc tính có ≥ 2 giá trị ở mức đó, hai vế nằm trên hai thuộc tính độc lập. Ở dạng chuẩn, hai luật khác chữ thì khác bảng chân trị (test kiểm lại bằng bảng chân trị trên cả 36 bạn).

## Độ khó

| Mức | Thuộc tính thay đổi | Luật | Phủ định | Luật đổi | Câu phân định | Hiện luật |
| --- | --- | --- | --- | --- | --- | --- |
| Mầm | loài, mũ, đồ cầm (18 bạn) | 1 vế | không | không (một luật cả vòng) | — | có |
| Thường | + kính (36 bạn) | 1 vế | không | mỗi 6 câu, báo "vé mới" | trong 3 câu đầu khối | có |
| Khó | như Thường | 2 vế, VÀ / HOẶC | 30 % mỗi vế | mỗi 4–6 câu (bốc đều), báo "vé mới" | trong 3 câu đầu khối | có |
| Siêu khó | như Thường | 1 vế | không | ngầm mỗi 6–8 câu (bốc đều), luôn sang **thuộc tính khác** | luôn câu đầu khối | **ẩn** |

| Mức | Người chơi thấy gì |
| --- | --- |
| Mầm | Một vé cả vòng (vd. vé "mũ"): bạn nào đội mũ thì cho vào |
| Thường | Vé một biểu tượng, cứ 6 bạn lại đổi vé; vé mới nháy sáng, và trong 3 bạn đầu có một bạn mà vé cũ xử ngược |
| Khó | Vé ghép hai biểu tượng: hai biểu tượng **chung một vé** = phải có cả hai (VÀ); **hai vé riêng** = có một là được (HOẶC); biểu tượng có vạch cấm = phải **không** có. Đổi vé sau 4–6 bạn |
| Siêu khó | Vé úp (dấu ?). Chỉ biết luật qua đúng/sai và sổ cổng 4 bạn gần nhất; luật đổi ngầm sau 6–8 bạn, câu đầu sau khi đổi chắc chắn bị luật cũ đánh lừa |

**Siêu khó không dùng phủ định** (lệch kế hoạch, xem Câu hỏi mở 1): bạn được vào luôn **có chung** một đặc điểm nhìn thấy được, nên người chơi "à ra thế" khi nhìn cột Vào của sổ cổng. Có phủ định thì người học lý tưởng sai 31 % thay vì 25 %, và cột Vào chỉ chung một thứ *không có*, khó nhận ra.

**Độ khó đo được** (bộ sinh thật `rule-gate.ts`, 5 000 seed × 60 câu mỗi mức, 2026-10-20):

| Mức | Thuộc tính | Bạn khác nhau | Vế / luật | Vế phủ định | Lần đổi luật / 60 câu | Câu đầu khối mới là câu phân định | Người giữ luật cũ sai (trong khối mới) | Người học lý tưởng buộc sai |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mầm | 3 | 18 | 1 | 0 % | 0 | — | — | 0 % |
| Thường | 4 | 36 | 1 | 0 % | 9,0 | 67 % | 59 % | 0 % |
| Khó | 4 | 36 | 2 | 30,2 % | 11,4 | 65 % | 57 % | 0 % |
| Siêu khó | 4 | 36 | 1 | 0 % | 8,0 | 100 % | 57 % | **24,7 %** |

- Đáp án vào / về đúng 50,0 % ở cả bốn mức.
- "Người học lý tưởng" (test `khó dần` và `luật ẩn học được`): giữ mọi luật một vế còn khớp với 4 câu gần nhất (rút ngắn cửa sổ khi không luật nào khớp), trả lời theo đa số, không trượt tay. Ở mức hiện luật thì đọc đúng vé là không bao giờ buộc phải sai. Ở Siêu khó: sàn ~1 câu mỗi khối (câu phân định, 1/7 ≈ 14 %) cộng ~0,7 câu đoán sai khi luật còn nhiều khả năng.
- Mỗi bước lên mức tăng ít nhất một chỉ số: Mầm → Thường thêm kính và bắt đầu đổi luật; Thường → Khó luật hai vế, có phủ định, đổi dày hơn (11,4 so với 9 lần); Khó → Siêu khó luật ẩn, sai buộc 0 → 24,7 %. Siêu khó ít vế, không phủ định và đổi thưa hơn Khó: cố ý, vì phải suy luật từ phản hồi; luật ẩn hai vế hoặc đổi mỗi 4–6 câu thì gần như đoán mò.

## Đảm bảo khi sinh câu đố

- Đúng một đáp án: `check` đúng với `answer` và sai với bên kia; `answer` khớp `ruleGateAdmits(rule, buddy)`.
- Luật đúng dạng của mức (số vế, thuộc tính có ở mức, hai vế khác thuộc tính và đúng thứ tự, không phủ định ở Mầm, Thường, Siêu khó), không hằng đúng / hằng sai trên không gian bạn của mức.
- Luật của câu **chỉ phụ thuộc khối**: mọi câu trong khối có cùng luật, bằng `ruleGateRule(seed, khối, d)`; sinh xuôi hay ngược ra cùng câu.
- Luật đổi đúng chu kỳ: Mầm không đổi; Thường đổi đúng ở câu 6, 12, 18…; Khó độ dài khối 4 / 5 / 6, Siêu khó 6 / 7 / 8, mỗi độ dài 30–37 %. Luật mới khác luật cũ (bảng chân trị); Siêu khó khác cả thuộc tính.
- Mỗi khối trọn vẹn có ≥ 2 câu vào và ≥ 2 câu về, không có hai bạn giống hệt nhau; khối mới có câu phân định trong `discriminateWithin` câu đầu.
- `ruleShown` và `ruleIsNew` đúng mức; bạn nằm trong không gian của mức (Mầm không có kính).
- Tỉ lệ vào / về 45–55 % ở mọi mức. Thường và Siêu khó cùng seed trùng luật khối 0 < 25 %.
- `isAnswer` chỉ nhận `"in"`, `"out"`; tất định; không gọi `Math.random` / `Date.now`.

Các điều trên được kiểm trong `rule-gate.test.ts`: 10 000 seed × 24 câu liên tiếp × 4 độ khó (960 000 câu), cộng test thứ tự sinh, chu kỳ đổi luật, luồng riêng theo mức, độ khó tăng dần và người học lý tưởng. Chạy ~4 s.

## Cân bằng

Người chơi mục tiêu: Mầm là trẻ 7 tuổi, các mức khác là người lớn đúng sức. Thời gian = nhìn bạn + soát vé + vuốt / bấm. Câu đầu khối mới chậm hơn và dễ sai hơn vì phải đọc vé mới; ở Siêu khó thời gian tuỳ người chơi đã đoán ra luật hay còn phân vân.

| Mức | Thời gian giải mỗi câu | Tỉ lệ sai | Số câu mỗi vòng 60 s |
| --- | --- | --- | --- |
| Mầm | trẻ 7 tuổi 1,7–2,7 s (người lớn 0,65–0,95 s) | 8 % (người lớn 2 %) | ~22,6 (20,8 đúng) |
| Thường | 0,9–1,4 s; câu đầu khối 1,4–1,9 s | 4 %; câu đầu khối 10 % (chung 4,9 %) | ~37 (35,4 đúng) |
| Khó | 1,4–2,1 s, +0,15 s mỗi vế phủ định; câu đầu khối 2,0–2,8 s | 8 %; câu đầu khối 15 % (chung 9,2 %) | ~25 (22,5 đúng) |
| Siêu khó | đã đoán ra luật 0,9–1,4 s; còn phân vân 1,5–2,3 s | ~26 % (mô hình người học dưới đây) | ~30 (22,4 đúng) |

- Các mức hiện luật không chồng nhau về thời gian (Mầm ≤ 0,95 s ≤ Thường ≤ 1,4 s ≤ Khó). Siêu khó nhanh ngang Thường khi đã biết luật, nhưng khó ở chỗ khác: sai gấp ~3 lần Khó và bị khoá ~11 s mỗi vòng. Thời gian thực cho mỗi câu đúng: Thường 1,7 s, Khó 2,7 s, Siêu khó 2,7 s.
- Siêu khó còn ~22 câu đúng mỗi vòng (≥ 8). Thường ~37 câu, nhiều hơn khuyến nghị 15–25 câu của GDD vì mỗi câu chỉ là một quyết định hai bên, giống Phấn trượt; vẫn trong khung 1–8 s mỗi câu.
- **Mô hình người chơi Siêu khó:** người học cửa sổ 4 câu (đúng bằng sổ cổng FE hiện), trả lời theo đa số các luật còn khớp; còn phân vân thì 10 % chọn ngược đa số, đã chắc thì trượt tay 3 %. Sau 2 câu sai liền thì thấy vé (gợi ý FE, xem Ghi chú cho FE) và theo đúng vé tới khi bị phản hồi bác bỏ.

**Hệ số điểm và miễn trừ thời gian** (CR-006, khai báo trong `ruleGate`):

| Mức | `difficultyMultiplier` | `speedAllowanceMs` | Cách tính |
| --- | --- | --- | --- |
| Mầm | **1** | không khai báo | Mô phỏng trẻ 7 tuổi cần 2,24 → min(2,24; 1) = 1 |
| Thường | 1 | không khai báo | Mốc so sánh |
| Khó | **2,05** | không khai báo | Mô phỏng cần 2,045, làm tròn tới 0,05 |
| Siêu khó | **2,4** | không khai báo | Mô phỏng cần 2,39 (có gợi ý sau 2 câu sai liền). Không có gợi ý thì cần 2,55 |

- `speedAllowanceMs`: không cần. Bạn hiện ra là vuốt được ngay (không chờ bạn đi tới cổng); không có pha trình chiếu. Đọc vé mới ở câu đầu khối là một phần kỹ năng, chỉ mất ~0,5 s (~4 điểm thưởng tốc độ).
- `answerWindowMs`: không khai báo (không có vật biến mất).
- Cách mô phỏng: như Phấn trượt (200 000 vòng 60 s mỗi mức bằng chính `generate()` và `pointsForCorrect`, thời gian đều trong khoảng, câu sai tốn thời gian như câu đúng rồi khoá 1,5 s, giữa hai câu 0,25–0,35 s hiệu ứng tính vào `answerMs` câu sau, câu chưa xong khi hết giờ không tính). Script không lưu trong repo.

| Người chơi | Đúng · sai mỗi vòng | A_d | B_d | m_d tính ra | Hệ số chọn | Điểm vòng (so với Thường) |
| --- | --- | --- | --- | --- | --- | --- |
| Trẻ 7 tuổi · Mầm | 20,8 · 1,8 | 2 706 | 1 147 | 2,24 | 1 | ~3 850 (53 %) |
| Người lớn · Thường | 35,4 · 1,8 | 4 839 | 2 382 | 1 | 1 | ~7 230 (100 %) |
| Người lớn · Khó | 22,5 · 2,3 | 2 903 | 1 286 | 2,05 | 2,05 | ~7 230 (100 %) |
| Người lớn · Siêu khó | 22,4 · 7,8 | 2 506 | 1 230 | 2,39 | 2,4 | ~7 250 (100 %) |
| Người lớn · Siêu khó, FE không có gợi ý | 21,4 · 8,1 | 2 379 | 1 164 | 2,55 | 2,4 | ~6 870 (95 %) |
| Người lớn chọn Mầm | 51,8 · 1,1 | 7 403 | 3 701 | 0,48 | 1 | ~11 100 (154 %) |

(A_d = tổng 100 × hệ số combo của các câu đúng, B_d = tổng thưởng tốc độ × hệ số combo; điểm vòng = m × A_d + B_d. Đã chạy lại với hệ số chọn: điểm vòng lệch ≤ 0,3 % so với Thường.)

- Trẻ 7 tuổi ở Mầm được ~53 % người lớn ở Thường do trần hệ số Mầm = 1 (quy tắc chung). Người lớn chọn Mầm được ~154 %, cũng do trần đó.
- **Điểm chuẩn Kiểm tra não** (`BRAIN_TEST_REFERENCE_SCORE`): đề xuất **4 750**. Theo cách của GDD: 4 000 lượt người lớn ở Thường, 40 s của nhóm Phân tích, thời gian đều ±20 % quanh 1,15 s (câu đầu khối 1,65 s), sai 4 % (câu đầu khối 10 %), hiệu ứng 0,25–0,35 s: 24,8 câu · 23,6 đúng, trung bình 4 754 điểm; 20 000 lượt ra 4 747. Nhanh hơn 30 % được × 1,32, chậm hơn 40 % được × 0,73. Cao như Phấn trượt (4 900) vì nhiều câu ngắn; `skillScore` quy về cùng thang nên không lệch Điểm Não.

Núm chỉnh sau chơi thử (chỉ sửa số trong `RULE_GATE_LEVELS`, rồi tính lại hệ số):

1. Siêu khó quá ức chế (sai > 30 % hoặc người chơi bỏ cuộc): khối 6–8 → 8–10 câu (người học lý tưởng sai ~20 %), hoặc bỏ kính ở Siêu khó (6 đặc điểm thay vì 7).
2. Khó quá chậm (> 2,5 s mỗi câu): phủ định 30 % → 20 %, hoặc chỉ cho phủ định ở vế thứ hai.
3. Thường quá dễ (gần như không sai): đưa câu phân định về luôn câu đầu khối, hoặc khối 6 → 5 câu.

## Ghi chú cho FE

Toạ độ trong khung 720×1280:

| Vùng | Vị trí | Nội dung |
| --- | --- | --- |
| Bảng vé | x 60–660, y 240–500 | Mảng bảng phấn (`--board`), viền xanh dương Phân tích. Vẽ vé (xem dưới). Siêu khó: một vé úp (mặt sau có dấu ?) + sổ cổng |
| Bạn | tâm (360, 760), cao ~300 px | Bạn đứng trước cổng, vẽ bằng Phaser Graphics nét phấn |
| Cổng lớp | x 24–200, y 600–960 | Cổng gỗ có biển hình quyển vở (không chữ); bên trái |
| Nhà | x 520–696, y 640–960 | Ngôi nhà nhỏ, đường mòn dẫn ra; bên phải |
| Hai nút | hàng y 1040–1170: nút Cổng x 40–340, nút Nhà x 380–680 (300 × 130 px) | Nút trái vẽ cổng + mũi tên ←, nút phải vẽ nhà + mũi tên →. Hiện ở cả điện thoại và máy tính |
| Thanh khoá | 420×14 tại (150, 1206) | Khi sai |

**Vẽ vé** (không dùng chữ, chỉ biểu tượng):

- Mỗi đặc điểm một biểu tượng phấn ~96 px: mặt mèo (tai nhọn), mặt thỏ (tai dài), mặt gấu trúc (tai tròn + quầng mắt), mũ lưỡi trai, kính tròn, quyển sách, quả bóng có sọc. Biểu tượng giống hệt phụ kiện vẽ trên bạn, để soát bằng mắt.
- **Phủ định** (`negated`): biểu tượng trong vòng tròn có vạch chéo (biển cấm), nét đỏ phấn **và** vạch dày, để người mù màu vẫn thấy.
- `single`: một vé, một biểu tượng. `and`: **một vé** chứa hai biểu tượng nối bằng dấu "+" phấn (= phải có cả hai). `or`: **hai vé riêng** đặt cạnh nhau, giữa có dấu "/" (= có một trong hai là được). Màn hướng dẫn mức Khó có hình minh hoạ cho "+" và "/".
- Cạnh vé vẽ mũi tên nhỏ chỉ về phía cổng (trái), nhắc rằng vé là điều kiện để **vào**.
- `ruleIsNew`: vé cũ bị khăn lau quệt đi, vé mới vẽ lại bằng hiệu ứng phấn 300 ms, khung bảng nháy vàng 2 lần, kèm nhãn "Vé mới!" qua `t()`. Bạn vẫn vuốt được ngay trong lúc đó.
- Mức hiện luật: nếu được, vẽ vé của câu 0 ngay từ lúc đếm ngược (sinh câu 0 bằng `generate` phía client) để người chơi đọc trước.

**Siêu khó (`ruleShown = false`):**

- Bảng chỉ vẽ một vé úp (dấu ? phấn) và **sổ cổng**: 4 bạn gần nhất (thu nhỏ ~64 px) xếp vào hai cột, cột trái có biểu tượng cổng (= được vào), cột phải biểu tượng nhà (= mời về), theo **đáp án đúng** của câu đó, cả khi người chơi trả lời sai. Sổ cuốn liên tục và **không xoá khi luật đổi ngầm** (xoá là lộ lúc đổi). Xoá khi hết vòng.
- **Gợi ý sau 2 câu sai liền:** trong lúc khoá của câu sai thứ hai liên tiếp, vé úp lật mặt cho thấy `rule` của câu vừa sai trong suốt `bridge.unlockDelay`, rồi úp lại. Bộ đếm "sai liền" về 0 sau mỗi câu đúng và sau mỗi lần gợi ý. Việc này **chỉ ở FE**, không ảnh hưởng chấm: luật đã có sẵn trong `puzzle.rule`, server không cần biết. Hệ số Siêu khó 2,4 đã tính có gợi ý; bỏ gợi ý thì báo game-designer nâng lên 2,55.
- Không bao giờ báo "vé mới" ở Siêu khó, không dùng `ruleGateBlock` để hiện ranh giới khối.

**Nhập:** vuốt bắt đầu ở bất kỳ đâu trong khung: pointerdown → pointerup, quãng ngang ≥ 40 px thiết kế và dài ≥ 1,3 lần quãng dọc thì nhận trái (`"in"`) hoặc phải (`"out"`); vuốt dọc hoặc chéo không rõ thì bỏ qua (không gửi). Chạm nút (quãng < 40 px) = chọn bên của nút. Bàn phím: ← / A = vào, → / D = về; nhận ở mọi thiết bị có bàn phím; `preventDefault` cho phím mũi tên; bỏ qua `event.repeat` và phím kèm Ctrl/Alt/Meta; không bắt phím khi con trỏ ở ô nhập chữ (vd. ô chat). Trên máy tính, mỗi nút hiện nhãn phím nhỏ ("← / A", "→ / D"); bấm phím thì nút nhấp sáng như khi click. Mỗi câu chỉ nhận một lần.

| Trạng thái | Hiển thị |
| --- | --- |
| Câu mới | Bạn trượt từ dưới lên vào chỗ đứng trước cổng trong 200 ms (nhận đáp án ngay từ khung hình đầu) |
| Đúng | Gửi ngay; bạn đi qua cổng (vào) hoặc theo đường mòn về nhà (về) trong 250 ms, nút vừa chọn sáng vàng + dấu tích; ~300 ms sau bạn mới. Siêu khó: bạn thu nhỏ bay vào sổ cổng đúng cột |
| Sai / khoá | Xem mục dưới |

### Hiện đáp án đúng khi sai

Suốt `bridge.unlockDelay`: nút đúng sáng vàng (`--primary`) + dấu tích, nút vừa chọn X đỏ và rung nhẹ. Bạn quay sang và đi chậm về **phía đúng** (vào cổng hoặc về nhà), dừng giữa đường tới hết khoá. Ở mức hiện luật, trên vé đặt dấu ✓ (khớp) / ✗ (không khớp) cạnh **từng biểu tượng** theo `ruleGateTermHolds(buddy, term)`, và vẽ vòng phấn quanh phụ kiện tương ứng trên người bạn (vd. khoanh cái mũ), để người chơi thấy vì sao. Ở Siêu khó, vé vẫn úp (trừ lúc gợi ý), bạn bay vào sổ cổng đúng cột. Bảng vé từ y 240 trở xuống và bạn ở giữa khung, nên huy hiệu khoá (tới y ≈ 80, thẻ thấp nhất tới y ≈ 225) không che phần đáp án.

### Hiệu ứng

Bạn đi vào / về 250 ms, rung nút sai 200 ms, khăn lau vé 300 ms, bụi phấn khi vẽ vé. Giảm chuyển động (`prefersReducedMotion()`): bạn hiện / mất bằng mờ dần thay vì đi, vé đổi không có khăn lau (chỉ khung nháy vàng một lần, giữ nhãn "Vé mới!"), không rung; mọi thông tin chơi (vé, dấu ✓ / ✗, sổ cổng, phía đúng sáng lên) giữ nguyên. Âm: chuông cửa nhẹ khi cho vào đúng, tiếng huýt "tạm biệt" khi mời về đúng, "bụp" trầm khi sai; chơi được khi tắt tiếng.

Nền tối: bảng `#24203f`, biểu tượng phấn trắng; vạch cấm vẫn có nét dày ngoài màu đỏ.

### Chỉnh scene theo bản mẫu

Bố cục hiện tại (bảng vé, bạn, cổng, nhà, nút, sổ cổng, thanh khoá) đã khớp bản mẫu M25, giữ nguyên. Bộ màu nhân vật dùng chung với Đếm sĩ số; luật chỉ theo hình nên không cần tên màu trong luật.

- `shapes.ts`: bóng `#f2a541` → **tím nhạt `#c3a6ff`** (cam trùng sắc mèo `#f08a3c`), giữ sọc mực. Mũ `#4d9de0`, sách `#3bb273`, kính mực, ba loài giữ mã bộ nhân vật app.
- Màu dành riêng: vàng `#ffd166` = đúng/chọn, đỏ `#c93a55` / `#f07a90` = sai/cấm; nhân vật và phụ kiện không dùng hai màu này.
- Vé mặt trước: thay nét phấn bằng thẻ giấy kem `#fff8ef` (cả hai giao diện), viền mực 5, bóng 7, bo 16, hai khấc tròn r14 giữa cạnh trái/phải; giữ kích thước 210 / 400 / 2×176, cao 180, tâm y 372.
- Biểu tượng trên vé tô màu bằng chính hàm vẽ phụ kiện trên bạn (~96 px): đầu loài ×0,52, mũ ×0,82, kính ×0,8, sách/bóng ×1,85.
- Biển cấm: vòng r54 + vạch chéo ±38, lớp dưới mực 16/18, lớp trên `#c93a55` 9/10. VÀ: "+" mực 9 px trên cùng vé; HOẶC: "/" phấn giữa hai vé.
- Bảng vé: khung gỗ, mặt `--board`, viền trong `#4d9de0` 6 px; vé mới nháy viền `#ffd166` 10 px; nhãn "Vé mới!" thẻ vàng 164×46 tâm (560, 256) xoay −4°.
- Vé úp: vé kem phủ sọc chéo mực 13 %, dấu "?" Baloo 130 px `#4d9de0` viền mực; gợi ý lật thành vé mặt trước + viền vàng 9 px.
- Sổ cổng: đầu cột biểu tượng cổng (361, 292) / nhà (555, 292), vạch chia nét đứt x 458; ô mini x 317/405 và 511/599, y 352/434, zoom 0,34.
- Cổng: hai cột gỗ + xà + biển quyển vở kem dòng kẻ xanh, hai cánh mở vào trong. Nhà: tường `--card`, mái gỗ, ống khói, cửa sổ `#8ec5ff`. Đường mòn chấm từ chân bạn sang hai bên.
- Nút: ← + cổng / nhà + →; nhãn phím chỉ trên máy tính (chip 92×30 góc phải trên nút). Huy hiệu tích / X ở (x + 278, ~1048).
- Viền ngoài bạn ở nền tối đổi `#ffffff` → `--chalk-muted` (`#c9c6dc`); Siêu khó sai/gợi ý: bạn bay vào đúng cột sổ, không đi bộ.
- Đang tải / lỗi / trống: dùng lớp phủ chung của khung chơi. Chi tiết toạ độ: ghi chú bản mẫu trên canvas.

## Ghi chú cho BE

Không. Đáp án là chuỗi `"in"` / `"out"`, chấm một lần mỗi câu; giao thức vẫn `answer: unknown` + `isAnswer`, không đổi schema zod. `generate` tính lại chuỗi khối và luật từ câu 0 (O(số khối), ~3 µs mỗi lần gọi), vẫn tất định và rẻ. Không cần `speedAllowanceMs` hay `answerWindowMs`.

## Tác động Kiểm tra não

Nhóm Phân tích lên 7 game (Cân não, Đếm khối, Bi rơi đâu, Phấn trượt, Chuỗi quy luật, Ô bí ẩn, Cổng luật). Theo [GDD › Kiểm tra não](../01-product/game-design.md#kiểm-tra-não): thay số giữ chỗ 1 500 bằng điểm chuẩn **4 750**, thêm dòng vào bảng điểm chuẩn ở GDD (40 s · 1,15 s, câu đầu khối 1,65 s · 4 %, câu đầu khối 10 % · 24,8 câu · 23,6 đúng · × 1,32 · × 0,73), và tăng `BRAIN_TEST_RULES_VERSION` **một lần cho cả đợt CR-014** (điều phối làm).

## Câu hỏi mở

1. **Siêu khó không có luật phủ định** (kế hoạch không nói rõ). *Đề xuất:* giữ như đặc tả: bạn được vào luôn có chung một đặc điểm thấy được; người học lý tưởng sai 25 % thay vì 31 %. Muốn thêm phủ định thì đặt `negatePct` 50 và tính lại hệ số (~2,7).
2. **Siêu khó: câu đầu sau mỗi lần đổi ngầm chắc chắn sai** (~3–4 lần mỗi vòng), cộng ~4 câu đoán sai khi luật chưa rõ hoặc trượt tay: ~26 % câu sai, ~11 s bị khoá mỗi vòng. Đã làm hai thứ đỡ ức chế, đều ở FE: sổ cổng 4 bạn và gợi ý lật vé sau 2 câu sai liền. Cần chơi thử; còn nặng thì dùng núm chỉnh 1 (khối 8–10 câu).
3. **Luật mới ở Siêu khó luôn sang thuộc tính khác** (như Wisconsin đổi chiều phân loại). Có nên nói điều này ở màn hướng dẫn không? *Đề xuất:* không; người chơi tự nhận ra là thêm một tầng suy luận.
4. **Câu phân định ở Thường / Khó** nằm trong 3 câu đầu khối thay vì luôn câu đầu, để không có mẹo "thấy vé mới thì trả lời ngược vé cũ". *Đề xuất:* giữ.
5. **Tên đặc điểm và biểu tượng** (mèo / thỏ / gấu trúc, mũ lưỡi trai, kính, sách, bóng): ui-designer chốt hình. Nếu đổi loài thì chỉ đổi hình, giữ id trong shared; biểu tượng trên vé và trên người bạn phải giống nhau.
6. **Trùng ý với Tìm bạn (`crowd-search`)** (cũng vẽ bạn có phụ kiện): FE nên dùng chung bộ vẽ bạn + phụ kiện cho cả hai game; chơi thử xem hai game có quá giống nhau về hình không.
