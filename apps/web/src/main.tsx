import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
// Khởi tạo trước khi render: i18n (đồng bộ, bản dịch có sẵn trong bundle) và theme sáng/tối.
import "@/i18n";
import "@/stores/theme.store";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Không tìm thấy #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
