# Đội AI agent

Dự án dùng một "studio" gồm 5 phòng ban AI agent (Claude Code subagent). Mỗi phòng có nhiệm vụ riêng, chạy trong ngữ cảnh riêng và chỉ gửi báo cáo ngắn về phiên chính, nhờ vậy phiên chính không phải đọc hết code của mọi phần. Việc của các phòng khác nhau có thể chạy song song.

## Sơ đồ

```text
                    Bạn  ⇄  Phiên chính (điều phối / tech lead)
                                   │  chia việc, ghép kết quả
     ┌──────────────┬──────────────┼──────────────┬──────────────┐
game-designer   ui-designer   frontend-dev    backend-dev    qa-tester
 đặc tả +        bản mẫu,      màn hình,       server,        pnpm check,
 logic câu đố    token, UI     scene, i18n     protocol       soát bất biến
```

| Phòng | Chịu trách nhiệm cho câu hỏi | Model | File định nghĩa |
| --- | --- | --- | --- |
| `game-designer` | Game có vui, rõ luật, công bằng? | opus | `.claude/agents/game-designer.md` |
| `ui-designer` | Nhìn có thích, bấm có dễ? | opus | `.claude/agents/ui-designer.md` |
| `frontend-dev` | Trên trình duyệt có chạy mượt, đúng bản mẫu? | opus | `.claude/agents/frontend-dev.md` |
| `backend-dev` | Server có công bằng, ổn định, chống gian lận? | opus | `.claude/agents/backend-dev.md` |
| `qa-tester` | Thay đổi có an toàn để giữ lại? | opus | `.claude/agents/qa-tester.md` |

Tài liệu không có phòng riêng: phòng nào sửa phần nào thì tự cập nhật tài liệu của phần đó, còn `qa-tester` kiểm tra xem đã cập nhật chưa.

## Cách dùng

**Giao một việc cho một phòng** (nói tự nhiên, hoặc gõ `@` để chọn agent):

```text
Dùng ui-designer vẽ bản mẫu màn sảnh chờ theo phong cách bảng phấn.
Dùng qa-tester soát thay đổi hiện tại.
```

**Giao nhiều việc song song**: nêu rõ các việc độc lập, phiên chính sẽ chạy các phòng cùng lúc.

```text
Song song: frontend-dev làm màn menu theo bản mẫu, backend-dev thêm tin nhắn "đổi avatar".
Xong thì cho qa-tester soát.
```

**Dùng workflow** cho việc lớn. Workflow là script trong `.claude/workflows/` điều phối nhiều agent theo một trình tự cố định.

| Lệnh | Khi nào | Luồng chạy |
| --- | --- | --- |
| `/feature` | Yêu cầu chạm nhiều phần | Lập kế hoạch → mỗi việc chạy ngay khi việc nó cần đã xong (song song tối đa) → `qa-fix` |
| `/new-minigame` | Thêm 1 hoặc nhiều game | Tạo khung → thiết kế (+ bản mẫu) → xây dựng, **mỗi game chạy độc lập** → cập nhật tài liệu chung → `qa-fix` |
| `/qa-fix` | Trước khi commit | QA → các phòng sửa lỗi của mình song song → QA lại (tối đa 3 vòng) |

Ví dụ: *"Chạy /new-minigame cho 2 game: { id: number-balloons, category: compute } và { id: light-trail, category: memorize, mockup: true }"*.

## Quy tắc chạy song song

- **Song song được**: các phòng sửa các file khác nhau, ví dụ hai minigame khác nhau, hoặc màn hình và server khi chưa đổi protocol.
- **Phải tuần tự**: sửa chung file, hoặc việc sau cần kết quả việc trước. Luật chơi đi theo thứ tự shared → server → web, và màn hình mới cần bản mẫu trước khi dựng.
- **File dùng chung** giữa các game (`docs/04-minigames/README.md`, `folder-structure.md`, `games/index.ts`, `games/registry.ts`) chỉ được sửa ở một bước. Workflow `new-minigame` đã tách riêng bước này.
- Cần sửa chung file mà vẫn muốn chạy song song thì dùng `isolation: worktree` (mỗi agent làm trên một bản sao git riêng), sau đó gộp lại.

## Tiết kiệm token

- Mỗi agent chỉ nhận AGENTS.md cùng nhiệm vụ của mình, và chỉ mở file khi cần, tra theo `folder-structure.md`.
- Báo cáo trả về giới hạn ≤ 15–20 dòng và không dán code, nên ngữ cảnh của phiên chính luôn gọn.
- Hiện cả 5 phòng dùng opus. Muốn tiết kiệm hơn thì hạ `qa-tester` (và `ui-designer` khi chỉ sửa token) xuống `sonnet` ở dòng `model:` trong file agent; giá trị hợp lệ: `opus`, `sonnet`, `haiku`, `inherit` hoặc mã model đầy đủ.
- Agent con không được gọi thêm agent khác (`disallowedTools: Agent`), tránh nhân chi phí ngoài ý muốn.

## Sửa hoặc thêm phòng ban

1. Mỗi phòng là một file `.claude/agents/<tên>.md`: phần frontmatter (`name`, `description`, `model`, `color`, `disallowedTools`) và phần nội dung là bộ quy tắc của phòng.
2. `description` quyết định khi nào phiên chính giao việc, nên viết ngắn và nêu rõ "dùng khi…".
3. Phần nội dung giữ cấu trúc thống nhất: **Nhiệm vụ chính, Ranh giới, Hoàn thành khi, Cách làm chung, Báo cáo trả về**. Không chép lại các quy tắc đã có trong AGENTS.md.
4. Thêm phòng mới thì cập nhật bảng ở trên, danh sách `ROLES` trong các workflow và mục "Đội agent" trong AGENTS.md.

[← Hướng dẫn](README.md) · [Mục lục tài liệu](../README.md)
