import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BUILD_ID } from "./buildId";
import App from "./App.tsx";
import "./index.css";

console.log(`[BUILD_ID] ${BUILD_ID}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
