import { listen } from "@colyseus/tools";
import app from "./app.config";

// Lắng nghe trên PORT (mặc định 2567).
listen(app);
