import type { Vendor } from "@chat-app/contracts/index";
import React, { useState } from "react";

import { useChat } from "../hooks/useChat";

interface Props {
  chatId: string;
  modelState: [Vendor, React.Dispatch<React.SetStateAction<Vendor>>];
}

export default function Chat({ modelState, chatId }: Props) {
  console.log("Chat component rendered");

  const [input, setInput] = useState("");
  const { messages, isLoading, error, sendMessage } = useChat({
    modelState,
    chatId,
  });

  const onSubmit = async function (e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      await sendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 pb-20">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message, _) => (
          <div
            key={message.timestamp}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
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
        {error && <div className="text-red-500 text-center mt-2">{error}</div>}
      </div>

      <form onSubmit={e => { void onSubmit(e)}} className={`fixed bottom-0 left-0 right-0 flex gap-2 bg-white p-4 border-t`}>
        <input
          type="text"
          ref={(input) => { input?.focus() }}
          value={input}
          onChange={(e) => { setInput(e.target.value); }}
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
