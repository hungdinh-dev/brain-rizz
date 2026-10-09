import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    // Room test dùng chung một server Colyseus → chạy tuần tự.
    fileParallelism: false,
  },
});
