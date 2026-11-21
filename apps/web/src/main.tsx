import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { currentProfile } from "@/lib/profile";
// Khởi tạo trước khi render: i18n (đồng bộ, bản dịch có sẵn trong bundle) và theme sáng/tối.
import "@/i18n";
import { initNav } from "@/stores/nav.store";
import "@/stores/theme.store";
import "@/styles/globals.css";

// Màn theo đường dẫn + Back/Forward (CR-022). Link sâu vào màn cần hồ sơ khi chưa có tên → qua màn
// chọn bạn đồng hành trước.
initNav({ hasProfile: () => currentProfile().name !== "" });

const root = document.getElementById("root");
if (!root) throw new Error("Không tìm thấy #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
