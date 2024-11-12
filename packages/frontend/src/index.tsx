import { createRoot } from "react-dom/client";

import App from "./App";

async function enableMocking() {
  console.log("NODE_ENV", process.env.NODE_ENV);
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  try {
    const { internal: handlers } = await import("@chat-app/mocks");
    const { setupWorker } = await import("msw/browser");
    const worker = setupWorker(...handlers);
    const res = await worker.start({
      onUnhandledRequest: "warn",
    });
    return res;
  } catch (error) {
    console.error("Failed to import mocks", error);
    return undefined;
  }
}

enableMocking()
  .then(() => {
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Element with id 'root' not found");
    }
    const root = createRoot(container);
    root.render(<App />);
  })
  .catch((error: unknown) => {
    console.error("Failed to enable mocking", error);
  });
