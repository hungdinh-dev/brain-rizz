import { defineConfig } from "tsdown";

/**
 * Đóng gói server thành dist/index.js.
 * `@brain-rizz/shared` (TypeScript nguồn) được gộp thẳng vào bundle,
 * các thư viện npm khác giữ nguyên là dependency runtime.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  fixedExtension: false,
  clean: true,
  sourcemap: true,
  dts: false,
  deps: {
    alwaysBundle: [/^@brain-rizz\//],
  },
});
