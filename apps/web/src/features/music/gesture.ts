/**
 * Quyết định ở mỗi thao tác khi đang chờ "thao tác đầu tiên" để tự phát nhạc (logic thuần, có test).
 * - "stop": không cần chờ nữa (người chơi đã tắt nhạc, hoặc nhạc đã phát) → gỡ listener.
 * - "ignore": thao tác nằm trên thanh nhạc (nút/thanh trượt tự lo việc của nó) → bỏ qua, vẫn chờ tiếp.
 *   Vd. kéo âm lượng trước tiên thì lần bấm chỗ trống sau đó vẫn tự phát.
 * - "play": thử phát; phát được thì mới gỡ listener.
 */
export type GestureAction = "stop" | "ignore" | "play";

export function gestureAction(state: {
  enabled: boolean;
  playing: boolean;
  onControl: boolean;
}): GestureAction {
  if (!state.enabled || state.playing) return "stop";
  if (state.onControl) return "ignore";
  return "play";
}
