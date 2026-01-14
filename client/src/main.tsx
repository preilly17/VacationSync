import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const globalScope = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __VITE_ENV__?: Record<string, string>;
};
globalScope.__DEV__ = import.meta.env.DEV;
globalScope.__VITE_ENV__ = {
  VITE_API_URL: import.meta.env.VITE_API_URL ?? "",
  VITE_WS_URL: import.meta.env.VITE_WS_URL ?? "",
  NODE_ENV: import.meta.env.NODE_ENV ?? "",
};

createRoot(document.getElementById("root")!).render(<App />);
