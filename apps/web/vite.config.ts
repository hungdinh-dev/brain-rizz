import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite chặn Host lạ. Cho phép link Cloudflare Quick Tunnel (`pnpm share`, scripts/share.mjs)
// để bạn bè mở được bản preview/dev qua Internet.
const TUNNEL_HOSTS = [".trycloudflare.com"];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Đọc "paths" trong tsconfig.json: import "@/components/ui/button" → src/components/ui/button
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    allowedHosts: TUNNEL_HOSTS,
  },
  preview: {
    allowedHosts: TUNNEL_HOSTS,
  },
  build: {
    target: "es2022",
    // Phaser (~1 MB) và từng minigame được tách chunk riêng nhờ import() động,
    // nên màn hình đầu chỉ tải React + UI.
    chunkSizeWarningLimit: 1500,
  },
});
