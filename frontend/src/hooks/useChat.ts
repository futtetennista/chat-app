import { useCallback, useState } from "react";

import api from "@/api";
import { Message, Model } from "@/types";

export function useChat(defaultModel: Model) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);

      const match = content.match(/@(?<model>\w+)/);
      // TODO check if model is valid
      const model = (match?.groups?.model as Model) || defaultModel;

      const strippedContent = content.replace(/@\w+/, "").trim();
      const userMessage: Message = {
        role: "user",
        content: strippedContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await api.sendMessage({
          model: model,
          message: strippedContent,
          history: messages,
        });

        const assistantMessage: Message = {
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, defaultModel],
  );

  return { messages, isLoading, sendMessage };
}
