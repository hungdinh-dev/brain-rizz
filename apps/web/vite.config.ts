import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Đọc "paths" trong tsconfig.json: import "@/components/ui/button" → src/components/ui/button
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    // Phaser (~1 MB) và từng minigame được tách chunk riêng nhờ import() động,
    // nên màn hình đầu chỉ tải React + UI.
    chunkSizeWarningLimit: 1500,
  },
});
