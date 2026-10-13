export const meta = {
  name: 'new-minigame',
  description: 'Làm một hoặc nhiều minigame song song: tạo khung → thiết kế + bản mẫu → xây dựng → cập nhật tài liệu → QA',
  whenToUse:
    'Thêm minigame mới. args: { id, category, idea?, mockup? } hoặc { games: [ {…}, {…} ] } để làm nhiều game cùng lúc. category: identify | memorize | analyze | compute | visualize',
  phases: [
    { title: 'Tạo khung', detail: 'chạy pnpm new-game lần lượt từng game' },
    { title: 'Thiết kế', detail: 'game-designer, và ui-designer song song nếu mockup' },
    { title: 'Xây dựng', detail: 'backend-dev (chỉ khi cần, chạy lần lượt), frontend-dev' },
    { title: 'Tổng hợp', detail: 'cập nhật bảng trạng thái và cây thư mục một lần' },
    { title: 'Kiểm thử', detail: 'workflow qa-fix' },
  ],
}

const CATS = ['identify', 'memorize', 'analyze', 'compute', 'visualize']
const input = args || {}
const games = Array.isArray(input.games) ? input.games : [input]
for (const g of games) {
  if (!g.id || !CATS.includes(g.category)) {
    throw new Error(`Mỗi game cần id và category (${CATS.join(' | ')}). Nhận được: ${JSON.stringify(g)}`)
  }
}

// Các file dùng chung giữa nhiều game: agent chạy song song không được sửa, bước Tổng hợp sửa một lần.
const SHARED_FILES =
  'docs/04-minigames/README.md, docs/02-architecture/folder-structure.md, packages/shared/src/games/index.ts, apps/web/src/games/registry.ts'
const PARALLEL_NOTE =
  games.length > 1
    ? `\nĐang có ${games.length} game làm song song (${games.map((g) => g.id).join(', ')}). Chỉ sửa thư mục của game này; KHÔNG sửa ${SHARED_FILES}.`
    : `\nKHÔNG sửa ${SHARED_FILES} (bước Tổng hợp sẽ cập nhật).`

const brief = (g) =>
  [`ID: ${g.id}`, `Nhóm kỹ năng: ${g.category}`, g.idea ? `Ý tưởng: ${g.idea}` : 'Ý tưởng: lấy từ dòng dự kiến trong docs/04-minigames/README.md']
    .join('\n')

const DESIGN = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    specPath: { type: 'string' },
    needsServerChange: { type: 'boolean', description: 'true chỉ khi cần tin nhắn hoặc luật phòng mới ngoài generate/check chung' },
    serverNotes: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['done', 'specPath', 'needsServerChange', 'summary'],
}

const REPORT = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    link: { type: 'string', description: 'Link bản mẫu nếu có' },
  },
  required: ['done', 'summary', 'files'],
}

// 1. Tạo khung lần lượt: pnpm new-game ghi vào file đăng ký chung, chạy song song sẽ ghi đè nhau.
phase('Tạo khung')
await agent(
  'Chạy lần lượt từng lệnh sau ở thư mục gốc repo (không chạy song song). Lệnh nào báo game đã tồn tại thì bỏ qua và chạy tiếp:\n' +
    games.map((g) => `pnpm new-game ${g.id} ${g.category}`).join('\n') +
    '\nKhông sửa gì thêm. Trả về kết quả từng lệnh.',
  { phase: 'Tạo khung', label: 'scaffold', effort: 'low' },
)

// Backend sửa PartyRoom/protocol dùng chung nên xếp hàng từng game một.
let serverQueue = Promise.resolve()
const queueServer = (fn) => {
  const run = serverQueue.then(fn)
  serverQueue = run.catch(() => null)
  return run
}

// 2–3. Mỗi game đi qua Thiết kế → Xây dựng độc lập, game nhanh không phải chờ game chậm.
const results = await pipeline(
  games,
  async (g) => {
    const [design, mock] = await parallel([
      () =>
        agent(
          `Thiết kế minigame cho Brain Rizz. Khung đã được tạo bằng pnpm new-game.\n${brief(g)}\n` +
            'Làm đủ: đặc tả, bộ sinh câu đố thay cho câu đố mẫu, test 10.000 seed, cân bằng 4 mức độ khó.' +
            PARALLEL_NOTE,
          { agentType: 'game-designer', phase: 'Thiết kế', label: `design:${g.id}`, schema: DESIGN },
        ),
      () =>
        g.mockup
          ? agent(
              `Vẽ bản mẫu màn chơi cho minigame (khung 720×1280, canvas trong suốt đặt trên nền bảng phấn, rõ ở cả sáng và tối).\n${brief(g)}\nKhông sửa code. Trả link bản mẫu.`,
              { agentType: 'ui-designer', phase: 'Thiết kế', label: `mockup:${g.id}`, schema: REPORT },
            )
          : Promise.resolve(null),
    ])
    return { design, mock }
  },
  async ({ design, mock }, g) => {
    if (!design || !design.done) return { id: g.id, design, mock, stoppedAt: 'Thiết kế' }

    let backend = null
    if (design.needsServerChange) {
      backend = await queueServer(() =>
        agent(
          `Minigame ${g.id} cần thay đổi phía server: ${design.serverNotes || '(xem đặc tả)'}\nĐặc tả: ${design.specPath}.\n` +
            'Làm protocol, PartyRoom, hàm gửi tối thiểu trong connection.ts, kèm test server.',
          { agentType: 'backend-dev', phase: 'Xây dựng', label: `server:${g.id}`, schema: REPORT },
        ),
      )
    }

    const frontend = await agent(
      `Làm phần hiển thị cho minigame ${g.id} theo đặc tả ${design.specPath} (đọc mục Ghi chú cho FE): thay scene mẫu bằng scene thật, viết locales vi/en.` +
        (mock && mock.link ? `\nBản mẫu: ${mock.link}` : '') +
        (backend ? `\nBackend vừa làm: ${backend.summary}` : '') +
        PARALLEL_NOTE,
      { agentType: 'frontend-dev', phase: 'Xây dựng', label: `fe:${g.id}`, schema: REPORT },
    )
    return { id: g.id, design, mock, backend, frontend }
  },
)

// 4. Cập nhật một lần các file dùng chung để tránh nhiều agent ghi đè nhau.
phase('Tổng hợp')
const finished = results.filter((r) => r && r.frontend && r.frontend.done)
if (finished.length) {
  await agent(
    'Cập nhật tài liệu dùng chung cho các minigame vừa làm xong:\n' +
      finished.map((r) => `- ${r.id}: ${r.design.summary}`).join('\n') +
      '\nViệc cần làm: đổi trạng thái trong docs/04-minigames/README.md, thêm các file mới vào docs/02-architecture/folder-structure.md, kiểm tra hai file đăng ký game (index.ts, registry.ts) đã đủ.',
    { agentType: 'game-designer', phase: 'Tổng hợp', label: 'docs', effort: 'low' },
  )
}

// 5. QA + sửa lỗi theo vòng.
phase('Kiểm thử')
let qa = null
try {
  qa = await workflow('qa-fix', { context: `Minigame mới: ${games.map((g) => g.id).join(', ')}` })
} catch (err) {
  log(`Không gọi được qa-fix (${err}), chạy QA một lượt`)
  qa = await agent('Soát toàn bộ thay đổi chưa commit theo quy trình QA của bạn.', { agentType: 'qa-tester', phase: 'Kiểm thử', label: 'qa' })
}

return {
  games: results.map((r, k) => r || { id: games[k].id, stoppedAt: 'lỗi agent' }),
  qa,
}
