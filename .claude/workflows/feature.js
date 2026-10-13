export const meta = {
  name: 'feature',
  description: 'Chia một yêu cầu thành việc cho từng phòng ban, chạy song song những việc không phụ thuộc nhau, rồi QA và sửa lỗi',
  whenToUse: 'Yêu cầu lớn chạm nhiều phần (UI + FE + BE…). args: "mô tả yêu cầu" hoặc { task }',
  phases: [
    { title: 'Lập kế hoạch', detail: 'chia việc theo phòng ban và thứ tự phụ thuộc' },
    { title: 'Thực hiện', detail: 'mỗi việc bắt đầu ngay khi các việc nó cần đã xong' },
    { title: 'Kiểm thử', detail: 'workflow qa-fix' },
  ],
}

const ROLES = ['game-designer', 'ui-designer', 'frontend-dev', 'backend-dev']
const task = typeof args === 'string' ? args : args && args.task
if (!task) throw new Error('Thiếu args: mô tả yêu cầu')

const PLAN = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ngắn, vd. t1' },
          role: { type: 'string', enum: ROLES },
          task: { type: 'string', description: 'Việc cụ thể, đủ để làm mà không cần hỏi lại' },
          files: { type: 'array', items: { type: 'string' }, description: 'File/thư mục dự kiến sửa' },
          dependsOn: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'role', 'task', 'files', 'dependsOn'],
      },
    },
    questions: { type: 'array', items: { type: 'string' }, description: 'Điểm mơ hồ người dùng phải quyết' },
  },
  required: ['tasks', 'questions'],
}

const REPORT = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    handoffs: { type: 'array', items: { type: 'string' }, description: 'role → việc còn lại' },
  },
  required: ['done', 'summary', 'files', 'handoffs'],
}

// 1. Lập kế hoạch (agent Plan chỉ đọc, không sửa file).
phase('Lập kế hoạch')
const plan = await agent(
  `Bạn là tech lead của studio Brain Rizz. Yêu cầu:\n"${task}"\n\n` +
    'Đọc AGENTS.md và xem nhanh phần code liên quan (chỉ đủ để chia việc), rồi chia thành việc cho các phòng ban: ' +
    'game-designer (đặc tả + logic câu đố trong packages/shared/src/games), ui-designer (bản mẫu, token, component UI), ' +
    'frontend-dev (apps/web), backend-dev (apps/server, protocol, scoring).\n' +
    'Quy tắc chia việc:\n' +
    '- Mỗi phòng tối đa một việc; việc nhỏ cùng phòng thì gộp lại. Không cần phòng nào thì bỏ phòng đó.\n' +
    '- Hai việc chạy song song không được sửa chung file; nếu trùng thì cho việc sau phụ thuộc việc trước.\n' +
    '- Thứ tự luật chơi: shared → server → web. Màn hình mới: bản mẫu ui-designer trước frontend-dev.\n' +
    '- Không viết code. Điểm nào mơ hồ thì ghi vào questions.',
  { agentType: 'Plan', phase: 'Lập kế hoạch', label: 'plan', schema: PLAN },
)
if (!plan || !plan.tasks.length) return { plan, note: 'Không có việc để làm' }

// Bỏ phụ thuộc không tồn tại, chặn phụ thuộc vòng tròn trước khi chạy.
const byId = {}
plan.tasks.forEach((t) => {
  byId[t.id] = t
})
plan.tasks.forEach((t) => {
  t.dependsOn = t.dependsOn.filter((d) => byId[d] && d !== t.id)
})
const visiting = {}
const checked = {}
const visit = (id) => {
  if (checked[id]) return
  if (visiting[id]) throw new Error(`Kế hoạch có phụ thuộc vòng tròn tại ${id}`)
  visiting[id] = true
  byId[id].dependsOn.forEach(visit)
  checked[id] = true
}
plan.tasks.forEach((t) => visit(t.id))
log(`Kế hoạch: ${plan.tasks.map((t) => `${t.id}=${t.role}${t.dependsOn.length ? `←${t.dependsOn.join(',')}` : ''}`).join(' · ')}`)

// 2. Thực hiện: mỗi việc chạy ngay khi việc nó phụ thuộc xong, không chờ cả "đợt".
phase('Thực hiện')
const running = {}
const run = (t) => {
  if (running[t.id]) return running[t.id]
  running[t.id] = Promise.all(t.dependsOn.map((d) => run(byId[d]))).then((deps) => {
    const others = plan.tasks.filter((o) => o.id !== t.id && !t.dependsOn.includes(o.id))
    return agent(
      `Yêu cầu chung: "${task}"\n\nViệc của bạn (${t.id}): ${t.task}\nFile dự kiến: ${t.files.join(', ') || '(tự xác định)'}` +
        (deps.length
          ? '\n\nKết quả các việc trước:\n' + deps.map((r, k) => `- ${t.dependsOn[k]}: ${r ? r.summary : 'agent lỗi'}`).join('\n')
          : '') +
        (others.length
          ? '\n\nCác phòng khác có thể đang làm song song, không sửa file của họ:\n' +
            others.map((o) => `- ${o.role}: ${o.files.join(', ')}`).join('\n')
          : ''),
      { agentType: t.role, phase: 'Thực hiện', label: `${t.role}:${t.id}`, schema: REPORT },
    )
  })
  return running[t.id]
}
const reports = await Promise.all(plan.tasks.map(run))

// 3. QA + sửa lỗi theo vòng.
phase('Kiểm thử')
let qa = null
try {
  qa = await workflow('qa-fix', { context: task })
} catch (err) {
  log(`Không gọi được qa-fix (${err}), chạy QA một lượt`)
  qa = await agent('Soát toàn bộ thay đổi chưa commit theo quy trình QA của bạn.', { agentType: 'qa-tester', phase: 'Kiểm thử', label: 'qa' })
}

return {
  questions: plan.questions,
  tasks: plan.tasks.map((t, k) => ({ id: t.id, role: t.role, task: t.task, report: reports[k] })),
  qa,
}
