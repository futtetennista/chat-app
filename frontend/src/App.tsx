import React, { useState, useEffect } from "react";

import { Chat } from "@/components/Chat";
import { Model } from "@/types";
import { v4 } from "uuid";

const App: React.FC = () => {
  console.log("App component rendered");
  const [model, setModel] = useState<Model>("chatgpt");
  const [chatId, setChatId] = useState<string>(v4());

  useEffect(() => {
    let storedChatId = sessionStorage.getItem("app.currentChatId");
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
