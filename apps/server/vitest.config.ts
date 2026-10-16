import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    // Room test dùng chung một server Colyseus → chạy tuần tự.
    fileParallelism: false,
    // Test không bao giờ gọi Supabase thật: để trống biến (dotenv của @colyseus/tools không ghi đè
    // biến đã có), store mặc định là bản rỗng; test cần ghi dùng MemoryResultStore.
    env: { SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" },
  },
});
