# ADR 0016: Sổ phấn và máy quay phụ kiện chạy trong Postgres

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-20
- Bổ sung cho: [ADR 0011](0011-supabase-accounts-and-solo-modes.md) (Supabase, khoá secret chỉ ở server), [ADR 0015](0015-admin-console.md) (bảng không policy + RPC `security definer`)
- Liên quan: [CR-023](../../00-tracking/change-requests.md#cr-023), [CR-024](../../00-tracking/change-requests.md#cr-024), [Kế hoạch gacha, thú, mở khoá](../../01-product/gacha-pets-unlocks.md) (mục 2, 4, 5.3), [Cài Supabase › Phấn và máy quay](../../03-guides/supabase-setup.md#10-phấn-máy-quay-phụ-kiện-mở-khoá-thú-cr-023-cr-024)

## Bối cảnh

CR-023 thêm **phấn** (tiền trong game, chỉ kiếm bằng chơi) và **máy quay phụ kiện**: tiêu phấn để quay, tỉ lệ công khai, có bảo hiểm, trùng món thì đổi lại phấn. CR-024 mở khoá 6 bạn đồng hành theo thành tích.

Ràng buộc:

- **Không tiền thật** (kế hoạch mục 2): không nạp, không mua lượt, không quảng cáo đổi lượt. Có trẻ em chơi.
- **Server quyết** (bất biến 2): số dư, kết quả quay, món sở hữu không được do client tính. Web là SPA tĩnh chỉ có khoá publishable (ADR 0005, 0011).
- Phấn đến từ **nhiều nơi**: trận party và Kiểm tra não (game server chấm), luyện tập (client gửi qua `submit_practice_result`), quà mỗi ngày (client bấm), máy quay (client bấm). Game server tự tắt khi rảnh (ADR 0004), không phải lúc nào cũng chạy.
- **Chống đua**: hai tab cùng quay, bấm đúp, server gọi lại sau lỗi mạng không được tiêu quá số dư, cộng hai lần hay vượt trần ngày.
- Số liệu kinh tế (giá, tỉ lệ, bảo hiểm, trần) đã chỉnh bằng mô phỏng ở `packages/shared/src/cosmetics/economy.ts`; mô phỏng và Postgres phải dùng cùng số và cùng thuật toán.

## Quyết định

Sổ phấn, trần ngày và thuật toán quay chạy **trong Postgres**, sau RPC `security definer` (`supabase/migrations/20261120000000_gacha.sql`). Bảng bật RLS, không có policy, revoke khỏi `anon`/`authenticated`. Shared giữ **bản tham chiếu** cùng thuật toán (`capChalkGrant`, `rollGachaBatch`, `pickGachaItem`). Hằng số trong SQL được **đánh dấu `/* @economy <TÊN> */`** và test shared đọc file migration để so từng giá trị.

### Cách làm

- **Sổ chỉ thêm dòng** (`chalk_ledger`): mỗi lần cộng/trừ một dòng `(source, ref, amount, day)`, số dư = tổng `amount`. `unique (user_id, source, ref)` làm khoá idempotent: quà mỗi ngày (ref = ngày), thưởng trận / Kiểm tra não (ref do game server đặt), lượt quay (ref = `batch_id`). Có sổ thì kiểm toán và sửa sai dễ (ghi dòng `admin`), không có số dư lệch với lịch sử.
- **Khoá theo người**: `gacha_pull`, `grant_chalk`, `submit_practice_result` lấy `pg_advisory_xact_lock(hashtextextended('chalk:' || user_id, 0))` trước khi đọc số dư / đếm trần. Yêu cầu cùng lúc của một người chạy lần lượt; người khác không phải chờ.
- **Trần ngày** (giờ Việt Nam, `chalk_today()`): `chalk_capped` làm y hệt `capChalkGrant` (party theo tổng phấn, brain/practice theo số lần). Lần thưởng bị kẹp hết vẫn ghi dòng 0 để gọi lại cùng `ref` trả đúng số cũ.
- **Quay**: `gacha_pull(1 | 10)` kiểm đủ phấn, trừ giá, bốc độ hiếm bằng `random()` theo tỉ lệ + bảo hiểm (Sử thi lần 15, Huyền thoại lần 60, gói 10 chắc ≥ 1 Hiếm), chọn món đều trong độ hiếm, **Huyền thoại không trùng tới khi đủ bộ**, trùng thì đổi phấn. Cả lượt là một transaction: lỗi giữa chừng thì không trừ gì. Web gửi kèm `p_request_id` (một uuid mỗi lần bấm, giữ nguyên khi thử lại sau hết giờ chờ): mã đã có lượt quay thì hàm (kiểm sau khoá theo người) trả lại đúng kết quả đã lưu kèm `replayed: true`, không trừ phấn lần hai.
- **Ai gọi gì**: client (kể cả khách ẩn danh) gọi `my_wallet`, `claim_daily_chalk`, `gacha_pull`, `my_items`, `gacha_history`, `my_unlock_stats`; game server (khoá secret) gọi `grant_chalk` (số tính bằng `partyChalkReward` / `brainChalkReward` của shared) và `unlock_stats_for`. Phấn luyện tập cộng trong `submit_practice_result` (giữ chữ ký cũ).
- **Đối chiếu số**: `ECONOMY_SQL_CONSTANTS` liệt kê tên → giá trị; `cosmetics/migration.test.ts` đòi mỗi tên có ít nhất một dấu, mọi dấu đúng giá trị, không có tên lạ; seed `cosmetic_items` đúng 24 món của `COSMETIC_ITEMS`; `chalk_ledger.source` nhận đủ `CHALK_SOURCES`.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Sổ + RNG quay trong Postgres, RPC `security definer` (chọn) | Mọi nguồn phấn (web, game server) qua một chỗ; transaction + khoá advisory chống đua; không cần game server chạy để quay; idempotent bằng unique | Logic viết bằng PL/pgSQL, không chạy được test TypeScript trực tiếp (bù bằng bản tham chiếu + test đọc SQL); máy dev không có Postgres nên SQL chỉ soát bằng mắt tới khi chạy trên project |
| Quay trên game server (TypeScript, RNG ở server), Supabase chỉ lưu | Dùng thẳng hàm shared, test dễ | Game server tự tắt khi rảnh: mở màn quay phải đánh thức máy; cần API HTTP mới + xác thực; ghi sổ vẫn phải chống đua ở DB |
| Quay trên client, gửi kết quả lên | Đơn giản nhất | Client tự chọn kết quả: phá nguyên tắc "server quyết" |
| Cột `balance` trên một dòng ví, cập nhật tại chỗ | Đọc số dư O(1) | Mất lịch sử; cộng trùng / sai không truy được; vẫn cần khoá dòng |
| Hằng số trong bảng cấu hình (đọc lúc chạy) thay vì viết trong SQL | Đổi số không cần migration | Thêm một nguồn sự thật nữa lệch với shared / mô phỏng; khó kiểm bằng test tĩnh |

## Hệ quả

- **Dễ hơn:**
  - Chơi web không cần game server thức để quay, nhận quà, xem ví.
  - Gọi lại an toàn: server thử lại `grant_chalk` cùng `ref` không cộng hai lần; bấm đúp quay chỉ trừ đúng số lượt.
  - Sai số liệu bị test bắt ngay trong `pnpm check` (đổi `economy.ts` mà quên SQL thì đỏ).
  - Không có đường nạp tiền thật nào để mở: phấn chỉ vào sổ qua các nguồn chơi đã liệt kê (và `admin` bằng khoá secret).
- **Khó hơn / chấp nhận:**
  - Đổi số kinh tế phải viết **migration mới** (thay hàm có dấu đánh dấu) và chuyển test sang đọc file mới.
  - `random()` của Postgres không phải RNG mật mã. Không có tiền thật và người chơi chỉ thấy vài bit mỗi lần quay nên không đáng lo; cần thì đổi sang `gen_random_bytes` (pgcrypto) mà không đổi hợp đồng.
  - Số dư tính bằng tổng sổ: vài nghìn dòng mỗi người mỗi năm vẫn nhanh nhờ index `(user_id, …)`. Sổ lớn hơn nhiều thì thêm bảng chốt số dư theo kỳ.
  - Luyện tập chấm trên máy nên phấn luyện tập gọi thẳng RPC được; chặn bằng trần thấp nhất (10 lượt × 5 phấn/ngày).
  - Advisors của Supabase báo "RLS Enabled No Policy" cho 5 bảng mới. Đó là cố ý.
- **Khi nào xem lại:**
  - Có ý định bán phấn / lượt quay bằng tiền thật: phải có ADR mới (pháp lý, trẻ em, hoàn tiền), không mở rộng thiết kế này.
  - Nhiều nguồn phấn mới hoặc sự kiện có thời hạn (kế hoạch mục 2 hiện cấm).
  - Sổ quá lớn làm `my_wallet` / `gacha_pull` chậm.
