import type { Model } from "@contracts/index";
import React, { useState } from "react";

import { useChat } from "@/hooks/useChat";

interface Props {
  chatId: string;
  modelState: [Model, React.Dispatch<React.SetStateAction<Model>>];
}

export function Chat({ modelState, chatId }: Props) {
  console.log("Chat component rendered");

  const [input, setInput] = useState("");
  const { messages, isLoading, errorMessage, sendMessage } = useChat({
    modelState,
    chatId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };
  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message, _) => (
          <div
            key={message.timestamp}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 flex items-center ${
                message.role === "user"
                  ? "bg-blue-500 text-white self-end"
                  : "bg-gray-200 self-start"
              }`}
            >
              <div className="mr-2 order-1">
                <img
                  src={
                    message.role === "user"
                      ? "/assets/user-icon.svg"
                      : "/assets/model-icon.svg"
                  }
                  alt="icon"
                  className="w-6 h-6"
                />
              </div>
              <div className="order-2">{message.content}</div>
            </div>
          </div>
        ))}
        {errorMessage && (
          <div className="text-red-500 text-center mt-2">{errorMessage}</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
