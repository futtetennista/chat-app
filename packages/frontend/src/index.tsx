import { createRoot } from "react-dom/client";

import App from "./App";

async function enableMocking() {
  console.log("NODE_ENV", process.env.NODE_ENV);
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return;
  }
  const { worker } = await import("./mocks/browser.ts");
  return worker.start();
}

enableMocking().then(() => {
  const container = document.getElementById("root");
  const root = createRoot(container!);
  root.render(<App />);
});
