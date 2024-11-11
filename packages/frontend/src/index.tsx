import { createRoot } from "react-dom/client";

import App from "./App";

async function enableMocking() {
  // if (typeof process === "undefined") {
  //   console.log("process is undefined");
  //   return undefined;
  // }
  console.log("NODE_ENV", process.env.NODE_ENV);
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const { worker } = await import("./mocks/browser.ts");
  return worker.start();
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
