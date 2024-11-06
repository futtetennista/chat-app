import { useCallback, useState, useEffect } from "react";

import api from "@/api";
import { Message, Model } from "@/types";

type ChatHistory = { messages: Message[] };

export function useChat({
  modelState,
  chatId,
}: {
  modelState: [Model, React.Dispatch<React.SetStateAction<Model>>];
  chatId: string;
}) {
  const [chatHistory, setChatHistory] = useState<ChatHistory>({
    messages: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("useEffect chatId", chatId);

    const savedChatHistory = sessionStorage.getItem(`app.chats.${chatId}`);
    console.log("storedMessages", !!savedChatHistory);

    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory) as ChatHistory);
    }
  }, [chatId]);

  function persistMessages(messages: Message[]) {
    sessionStorage.setItem(
      `app.chats.${chatId}`,
      JSON.stringify({
        ...chatHistory,
        messages,
      } as ChatHistory),
    );
  }

  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);

      const match = content.match(/@(?<model>\w+)/);
      // TODO check if model is valid
      const model = (match?.groups?.model as Model) || modelState;

      const strippedContent = content.replace(/@\w+/, "").trim();
      const userMessage: Message = {
        role: "user",
        content: strippedContent,
        timestamp: Date.now(),
      };

      setChatHistory((prev: ChatHistory) => {
        const updatedMessages = [...prev.messages, userMessage];
        persistMessages(updatedMessages);
        return { messages: updatedMessages };
      });

      try {
        const response = await api.sendMessage({
          model: model,
          message: strippedContent,
          history: chatHistory.messages,
        });
        const assistantMessage: Message = {
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        };
        setChatHistory((prev: ChatHistory) => {
          const updatedMessages = [...prev.messages, assistantMessage];
          persistMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatHistory, modelState],
  );

  return { messages: chatHistory.messages, isLoading, sendMessage };
}
