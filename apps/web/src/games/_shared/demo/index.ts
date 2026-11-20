/**
 * Khung diễn hướng dẫn động (CR-021, UI-UX 6.11): sân khấu 640 × 360, con trỏ, sóng chạm, ✓ ✗ ⚡,
 * chuyển câu, huy hiệu bước, nhãn khoá và dòng thời gian lặp. Mỗi game chỉ khai báo kịch bản
 * (`defineScript`) và vẽ vật của mình (`<Name>Demo.tsx` trong thư mục game).
 */
export { DemoStage, DemoStill } from "./DemoStage";
export { A, Cursor, LockPill, Mark, NumberBadge, Question, Ring, Ripple, StepBadge } from "./parts";
export {
  type DemoScript,
  defineScript,
  type Ease,
  type PoseInput,
  popIn,
  questionIn,
  questionOut,
  ripple,
  type Track,
  type TrackBuilder,
  track,
} from "./timeline";
