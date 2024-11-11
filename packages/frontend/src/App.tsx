import type { Vendor } from "@chat-app/contracts/index";
import React, { useEffect, useState } from "react";
import { v4 } from "uuid";

import Chat from "./components/Chat";

const App: React.FC = () => {
  console.log("App component rendered");
  const [model, setModel] = useState<Vendor>("openai");
  const [chatId, setChatId] = useState<string>(v4());

  useEffect(() => {
    const storedChatId = sessionStorage.getItem("app.currentChatId");
    if (!storedChatId) {
      console.log("No chatId found in sessionStorage, generating a new one");
      sessionStorage.setItem("app.currentChatId", chatId);
      setChatId(chatId);
    } else {
      console.log("Found chatId in sessionStorage", storedChatId);
      setChatId(storedChatId);
    }
  }, []);

  return (
    <div className="h-screen">
      {/* <div className="bg-gray-100 p-4"> */}
      {/* <select
          value={defaultModel}
          onChange={(e) => {
            const model = models.find((name) => name === e.target.value);
            if (model) {
              setDefaultModel(model);
            }
          }}
          className="p-2 rounded"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div> */}
      {chatId && <Chat modelState={[model, setModel]} chatId={chatId} />}
    </div>
  );
};

export default App;
