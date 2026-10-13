export const meta = {
  name: 'qa-fix',
  description: 'QA soát thay đổi chưa commit, giao lỗi về đúng phòng ban sửa song song, lặp tới khi sạch (tối đa 3 vòng)',
  whenToUse: 'Sau khi sửa code, trước khi commit. args (tuỳ chọn): "mô tả thay đổi" hoặc { context, maxRounds }',
  phases: [
    { title: 'Kiểm thử', detail: 'qa-tester chạy pnpm check và soát diff' },
    { title: 'Sửa lỗi', detail: 'mỗi phòng ban sửa lỗi của mình, chạy song song' },
  ],
}

// Quy trình: QA → (các phòng sửa song song) → QA lại … cho tới khi hết lỗi blocker/major.
// Workflow new-minigame và feature gọi lại workflow này ở bước cuối.

const ROLES = ['game-designer', 'ui-designer', 'frontend-dev', 'backend-dev']
const context = typeof args === 'string' ? args : (args && args.context) || ''
const MAX_ROUNDS = (args && args.maxRounds) || 3

const QA = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    checks: { type: 'string', description: 'Lệnh đã chạy và kết quả, ngắn gọn' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          location: { type: 'string', description: 'file:dòng' },
          description: { type: 'string' },
          owner: { type: 'string', enum: ROLES },
        },
        required: ['severity', 'location', 'description', 'owner'],
      },
    },
  },
  required: ['passed', 'checks', 'issues'],
}

const FIX = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: { type: 'array', items: { type: 'string' }, description: 'Lỗi không sửa, kèm lý do' },
    summary: { type: 'string' },
  },
  required: ['fixed', 'notFixed', 'summary'],
}

let qa = null
const fixes = []

for (let round = 1; round <= MAX_ROUNDS; round++) {
  qa = await agent(
    'Soát toàn bộ thay đổi chưa commit (git status, git diff) theo quy trình QA của bạn.' +
      (context ? `\nBối cảnh thay đổi: ${context}` : '') +
      (round > 1 ? `\nĐây là vòng ${round}: các phòng ban vừa sửa lỗi vòng trước, hãy kiểm tra lại từ đầu.` : ''),
    { agentType: 'qa-tester', phase: 'Kiểm thử', label: `qa:vòng-${round}`, schema: QA },
  )
  if (!qa) break

  const toFix = qa.issues.filter((i) => i.severity !== 'minor')
  log(`Vòng ${round}: ${qa.passed ? 'PASS' : 'FAIL'} · ${toFix.length} lỗi cần sửa · ${qa.issues.length - toFix.length} gợi ý`)
  if (!toFix.length) break
  if (round === MAX_ROUNDS) {
    log(`Hết ${MAX_ROUNDS} vòng, còn ${toFix.length} lỗi, chuyển cho người dùng quyết định`)
    break
  }

  // Mỗi phòng nhận đúng lỗi của mình; các phòng sửa song song vì phạm vi file khác nhau.
  const owners = [...new Set(toFix.map((i) => i.owner))]
  const results = await parallel(
    owners.map((owner) => () =>
      agent(
        'QA báo các lỗi sau thuộc phòng của bạn. Sửa tất cả rồi chạy lại kiểm tra liên quan.\n' +
          toFix
            .filter((i) => i.owner === owner)
            .map((i) => `- [${i.severity}] ${i.location}: ${i.description}`)
            .join('\n') +
          '\nNếu lỗi thuộc phòng khác hoặc QA hiểu sai, đưa vào notFixed kèm lý do.',
        { agentType: owner, phase: 'Sửa lỗi', label: `sửa:${owner}`, schema: FIX },
      ),
    ),
  )
  results.forEach((r, k) => {
    if (r) fixes.push({ round, owner: owners[k], ...r })
  })
}

return {
  passed: qa ? qa.passed : false,
  checks: qa ? qa.checks : 'QA không chạy được',
  remaining: qa ? qa.issues : [],
  fixes,
}
