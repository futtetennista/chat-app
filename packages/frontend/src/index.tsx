import { createRoot } from "react-dom/client";

import App from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Element with id 'root' not found");
}

createRoot(container).render(<App />);
