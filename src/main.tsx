import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorLogging } from "./lib/systemLog";

// Capture uncaught errors / rejections / console.error into system_logs.
installGlobalErrorLogging();

createRoot(document.getElementById("root")!).render(<App />);
