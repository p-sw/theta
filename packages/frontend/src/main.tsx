import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@catppuccin/highlightjs/css/catppuccin-frappe.css";
import App from "./App.tsx";
import { ConnectivityProvider } from "@/page/context/Connectivity";
import { PathProvider } from "@/page/context/Path";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectivityProvider>
      <PathProvider>
        <App />
      </PathProvider>
    </ConnectivityProvider>
  </StrictMode>,
);
