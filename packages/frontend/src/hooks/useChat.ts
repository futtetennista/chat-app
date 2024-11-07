import type { Message, Model } from "@contracts/index";
import { useCallback, useEffect, useState } from "react";

import api from "@/api";
import { models } from "@/constants";

type ChatHistory = { messages: Message[] };

export function useChat({
  modelState: [model, setModel],
  chatId,
}: {
  modelState: [Model, React.Dispatch<React.SetStateAction<Model>>];
  chatId: string;
}) {
  const [chatHistory, setChatHistory] = useState<ChatHistory>({
    messages: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

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

      function isModel(name: string): name is Model {
        return models.includes(name as Model);
      }

      const modelTarget = content.match(/@(?<model>\w+)/);
      const currentModel = modelTarget?.groups?.model || model;
      if (!isModel(currentModel)) {
        setErrorMessage(
          `Model "${currentModel}" not supported. Valid models are: ${models.join(", ")}`,
        );
        setIsLoading(false);
        return;
      }

      console.log(`Setting model to ${currentModel}`);
      setModel(currentModel);
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
          model: currentModel,
          message: strippedContent,
          history: chatHistory.messages,
        });
        switch (response.status) {
          case "error": {
            setErrorMessage(`${response.error} (code: ${response.code})`);
            break;
          }
          case "success": {
            const assistantMessage: Message = {
              role: "assistant",
              content: response.message,
              timestamp: Date.now(),
            };
            setChatHistory((prev: ChatHistory) => {
              const updatedMessages = [...prev.messages, assistantMessage];
              persistMessages(updatedMessages);
              return { messages: updatedMessages };
            });
            break;
          }
          default: {
            const _exhaustiveCheck: never = response;
            return _exhaustiveCheck;
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatHistory, model, setModel],
  );

  return {
    messages: chatHistory.messages,
    isLoading,
    sendMessage,
    errorMessage,
  };
}
