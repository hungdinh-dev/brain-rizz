# Kiểm thử (Test plan)

| | |
| --- | --- |
| Giai đoạn SDLC | Kiểm thử |
| Phiên bản tài liệu | 1.0 · 2026-10-10 |
| Liên quan | [SRS](../01-product/srs.md) (yêu cầu cần kiểm), [Quy trình phát triển](sdlc.md) (Definition of Done), [Hướng dẫn phát triển › Test](development.md#test) (lệnh chạy) |
| Cập nhật khi | Thêm tầng test, thêm thiết bị, bù xong một lỗ hổng test, đổi checklist phát hành |

## 1. Mục tiêu

1. Hai máy bất kỳ luôn sinh **cùng một câu đố** từ cùng seed (bất biến số 1).
2. Server chấm điểm đúng luật và không bị lừa bởi tin nhắn sai.
3. Trận chơi không vỡ khi mạng chập chờn hoặc người chơi tải lại trang.
4. Mượt và dùng được trên điện thoại thật.

## 2. Các tầng test

| Tầng | Công cụ | Kiểm cái gì | Nằm ở | Chạy khi | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Unit — logic dùng chung | Vitest | PRNG, mã phòng, tính điểm, đồng bộ giờ, schema giao thức | `packages/shared/src/*.test.ts` | Mỗi commit (CI) | ✅ |
| Unit — bộ sinh câu đố | Vitest | Tất định, đúng một đáp án, độ khó tăng dần — **10.000 seed × 4 độ khó** | `packages/shared/src/games/<id>/<id>.test.ts` | Mỗi commit | ✅ (1/1 game) |
| Unit — web | Vitest | Logic thuần phía client (vd. đọc hồ sơ) | `apps/web/src/**/*.test.ts` | Mỗi commit | ✅ |
| Tích hợp — phòng chơi | `@colyseus/testing` | Server thật: vào phòng, quyền chủ phòng, cùng seed, chấm điểm | `apps/server/test/` | Mỗi commit | ✅ (nối lại mới có tải lại trang) |
| Kiểu & i18n | `tsc` | Kiểu toàn repo; `en.ts` đủ khoá như `vi.ts` | — | Mỗi commit | ✅ |
| End-to-end nhiều người | Playwright | 4–8 trình duyệt (cả giả lập điện thoại) vào một phòng, chơi hết một trận | dự kiến `e2e/` | Trước mỗi bản phát hành | ⏳ GĐ 1 |
| Tải | `@colyseus/loadtest` | 8 người trả lời liên tục | `apps/server/loadtest/` | Trước mốc Alpha/Beta/1.0 | ✅ có script |
| Mạng xấu | DevTools (giả lập 3G, offline) | Đồng hồ, nối lại, đáp án đến muộn | Kiểm tay | Trước mỗi bản phát hành | Thủ công |
| Thiết bị thật | Điện thoại, tablet | Cảm ứng, hiệu năng, âm thanh, safe-area | Kiểm tay theo mục 5 | Trước mỗi bản phát hành | Thủ công |

Tất cả test tự động chạy bằng `pnpm test`; `pnpm check` = lint + typecheck + test; CI chạy thêm `pnpm build`.

## 3. Quy tắc viết test

- Tên test viết tiếng Việt, mô tả hành vi: `"chỉ chủ phòng được bắt đầu vòng"`.
- Bộ sinh câu đố mới **bắt buộc** có test ≥ 10.000 seed cho tính tất định và đúng một đáp án (quy định trong `AGENTS.md`).
- Không đổi giá trị snapshot của `createRng` để "cho test xanh" — snapshot đó bảo vệ tính tương thích giữa các phiên bản.
- Mỗi lỗi đã sửa nên có một test tái hiện lỗi, nếu viết được bằng Vitest.

## 4. Kịch bản kiểm tay (smoke test)

Chạy với 2 thiết bị (A = chủ phòng, B = người chơi), khoảng 10 phút. Mã trong ngoặc là UC trong [SRS](../01-product/srs.md).

| # | Bước | Kết quả mong đợi | UC |
| --- | --- | --- | --- |
| 1 | A mở game lần đầu | Màn giới thiệu → menu; nút ngôn ngữ, giao diện hoạt động | UC-11 |
| 2 | A bấm Tạo phòng khi chưa có tên | Mở màn chọn bạn đồng hành; xác nhận xong tự tạo phòng | UC-01, UC-02 |
| 3 | A bấm Mời bạn | Điện thoại: bảng chia sẻ; máy tính: "Đã copy link mời" | UC-04 |
| 4 | B mở link mời | Bỏ qua màn giới thiệu, mã điền sẵn; vào sảnh, A thấy B | UC-03 |
| 5 | B đổi độ khó, bấm Sẵn sàng | A thấy thay đổi ngay; avatar B nhún nhảy | UC-05 |
| 6 | B thử bấm Bắt đầu (nếu thấy nút) | Bị từ chối, có thông báo | UC-06 |
| 7 | A chọn game, 2 vòng, Bắt đầu | Cả hai đếm ngược cùng lúc | UC-06 |
| 8 | Chơi; cố tình trả lời sai một câu | Sai: rung + khoá 1,5 giây; điểm hai bên chạy real-time | UC-07 |
| 9 | Giữa vòng, B tải lại trang | B vào lại đúng phòng, giữ điểm | UC-10 |
| 10 | Giữa vòng, B tắt mạng 10 giây rồi bật | A thấy B mất kết nối rồi có lại; B chơi tiếp | UC-10 |
| 11 | Hết vòng 1 | Bảng kết quả vòng; B thấy "Chờ chủ phòng…" | UC-08 |
| 12 | A bấm Vòng tiếp theo → hết vòng 2 | Màn chung cuộc theo điểm trận | UC-08 |
| 13 | A bấm Chơi lại | Cả phòng về sảnh, điểm về 0 | UC-09 |
| 14 | A bấm Thoát | B trở thành chủ phòng | UC-12 |

## 5. Ma trận thiết bị

Tối thiểu trước mỗi bản phát hành từ 0.5 trở đi: **một iPhone, một Android tầm trung, một máy tính**.

| Thiết bị | Trình duyệt | Bắt buộc | Kiểm thêm |
| --- | --- | --- | --- |
| iPhone (iOS 2 bản gần nhất) | Safari | ✅ | Âm thanh sau lần chạm đầu, safe-area, chuyển app rồi quay lại |
| Android tầm trung (RAM 4 GB) | Chrome | ✅ | FPS minigame (Cổng 2: ≥ 55), nóng máy sau 3 trận |
| Máy tính Windows/macOS | Chrome hoặc Edge | ✅ | Copy link, mã QR, bàn phím |
| Máy tính | Firefox, Safari | Nên | Giao diện, WebGL |
| Tablet | Safari / Chrome | Nên | Bố cục khung dọc trên màn hình rộng |

Ghi lại thiết bị đã dùng trong mục "Đã xong" của báo cáo tuần ở [Tình trạng dự án](../00-tracking/status.md).

## 6. Lỗ hổng test cần bù

| # | Thiếu | Liên quan | Ưu tiên | Giai đoạn |
| --- | --- | --- | --- | --- |
| T-01 | Test nối lại: rớt mạng giữ chỗ, quá 45 giây bị xoá, chuyển quyền chủ phòng | UC-10, UC-12, FR-PH-07/08 | Cao | GĐ 1 |
| T-02 | Test chống spam: > 10 đáp án/giây bị bỏ; đáp án sai index/ngoài giờ bị bỏ | FR-VC-07 | Cao | GĐ 1 |
| T-04 | Test chéo trình duyệt cho bộ sinh câu đố (cùng seed cho cùng câu trên Chrome/Safari/Node) | NFR, bất biến 1 | Vừa | GĐ 1 |
| T-05 | E2E Playwright 4 trình duyệt chơi trọn trận | Cổng 1 | Cao | GĐ 1 |

Bù xong một mục thì xoá khỏi bảng và cập nhật cột "Test" ở [ma trận truy vết](../01-product/srs.md#8-ma-trận-truy-vết).

## 7. Checklist trước khi phát hành

- [ ] `pnpm check` và `pnpm build` xanh; CI trên GitHub xanh.
- [ ] Không còn lỗi S1, S2 đang mở.
- [ ] Chạy kịch bản kiểm tay (mục 4) trên ma trận thiết bị (mục 5).
- [ ] Từ 0.5: test Playwright nhiều người xanh; `loadtest` 8 người không lỗi.
- [ ] Kích thước gói JS ban đầu ≤ 300 KB gzip (xem output `pnpm build`).
- [ ] `MIN_PLAYERS_TO_START` đúng giá trị phát hành (2).
- [ ] Asset mới đã ghi giấy phép trong `assets/LICENSES.md`.
- [ ] Changelog, features.md, status.md đã cập nhật.

## 8. Báo lỗi

| Mức | Nghĩa | Ví dụ | Xử lý |
| --- | --- | --- | --- |
| S1 — Chặn | Không chơi được, mất dữ liệu, sai bất biến, gian lận dễ dàng | Hai máy ra câu đố khác nhau; server sập | Sửa ngay, hotfix |
| S2 — Nặng | Sai chức năng chính, có cách né | Không nối lại được sau khi tải trang | Sửa trước bản phát hành kế tiếp |
| S3 — Vừa | Sai chức năng phụ, giao diện lệch | Chữ tiếng Anh tràn nút | Xếp lịch |
| S4 — Nhẹ | Trình bày, gợi ý | Màu hơi nhạt | Khi rảnh |

Mỗi lỗi ghi: thiết bị + trình duyệt, các bước tái hiện, kết quả thực tế, kết quả mong đợi, ảnh/video nếu có. Agent `qa-tester` dùng thang blocker/major/minor tương ứng S1/S2/S3–S4.

[← Hướng dẫn](README.md) · [Mục lục tài liệu](../README.md)
