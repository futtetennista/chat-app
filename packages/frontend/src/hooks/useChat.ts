import { Message, Vendor } from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import { useCallback, useEffect, useState } from "react";

import api, { APIError } from "../api";
import { modelHandleToVendor, models } from "../constants";

interface ChatHistory {
  messages: Message[];
}

export function useChat({
  modelState: [model, setModel],
  chatId,
}: {
  modelState: [Vendor, React.Dispatch<React.SetStateAction<Vendor>>];
  chatId: string;
}): {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  error: string | undefined;
} {
  const [chatHistory, setChatHistory] = useState<ChatHistory>({
    messages: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    console.log("useEffect chatId", chatId);

    const savedChatHistory = sessionStorage.getItem(`app.chats.${chatId}`);
    console.log("storedMessages", !!savedChatHistory);

    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory) as ChatHistory);
    }
  }, [chatId]);

  function persistMessages(chatId: string, messages: Message[]) {
    sessionStorage.setItem(
      `app.chats.${chatId}`,
      JSON.stringify({
        ...chatHistory,
        messages,
      } as ChatHistory),
    );
  }

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      setIsLoading(true);

      await pipe(
        TE.fromEither(
          pipe(
            O.fromNullable(/@(?<model>\w+)/.exec(content)?.groups?.model),
            O.match(
              () => E.right(model),
              (modelTarget) =>
                pipe(
                  modelHandleToVendor(modelTarget),
                  O.match(
                    () => {
                      return E.left<{ _tag: "validation"; error: string }>({
                        _tag: "validation",
                        error: `Model "${modelTarget}" not supported. Valid models are: ${models.join(
                          ", ",
                        )}`,
                      });
                    },
                    (model) => E.right(model),
                  ),
                ),
            ),
          ),
        ),
        TE.tap((model) => {
          setModel(model);
          return TE.right(model);
        }),
        TE.map((model) => ({
          model,
          message: content.replace(/@\w+/, "").trim(),
          history: chatHistory.messages,
        })),
        TE.tapIO(({ model, message, history }) => {
          setChatHistory((prev: ChatHistory) => {
            const userMessage: Message = {
              role: "user",
              content: message,
              timestamp: Date.now(),
            };
            const updatedMessages = [...prev.messages, userMessage];
            persistMessages(chatId, updatedMessages);
            return { messages: updatedMessages };
          });

          return TE.right({ model, message, history });
        }),
        TE.flatMap(({ model, message, history }) =>
          api.sendMessageTE({ vendor: model, message, history }),
        ),
        TE.flatMap((response) => {
          if (response._t === "ko") {
            return TE.left<{ _tag: "api"; error: string }>({
              _tag: "api",
              error: `${response.error.title} (code: ${response.error.type})`,
            });
          }
          return TE.right(response.data);
        }),
        TE.tapError(
          (
            e:
              | { _tag: "api"; error: string }
              | { _tag: "validation"; error: string }
              | APIError,
          ) => {
            switch (e._tag) {
              case "api": {
                setError(`Unsuccessful request: ${e.error}`);
                break;
              }
              case "validation": {
                setError(e.error);
                break;
              }
              case "network": {
                console.error(e.error);
                setError("Network error occurred");
                break;
              }
              case "parse": {
                console.error(e.error);
                setError("Parsing JSON response failed");
                break;
              }
              case "decode": {
                console.error(D.draw(e.error));
                setError(`Decoding JSON response failed: ${D.draw(e.error)}`);
                break;
              }
              default: {
                const _exhaustiveCheck: never = e;
                return _exhaustiveCheck;
              }
            }

            return TE.left(e);
          },
        ),
        TE.tapIO((data) => {
          const assistantMessage: Message = {
            role: "assistant",
            content: data.message,
            timestamp: Date.now(),
          };
          setChatHistory((prev: ChatHistory) => {
            const updatedMessages = [...prev.messages, assistantMessage];
            persistMessages(chatId, updatedMessages);
            return { messages: updatedMessages };
          });

          if (data.stopReason) {
            setError(
              `⚠️ ${model} did not respond with a complete message (${data.stopReason})`,
            );
          } else {
            setError(undefined);
          }

          return TE.right(data);
        }),
      )().finally(() => {
        setIsLoading(false);
      });
    },
    [chatHistory, chatId, model, setModel, setError],
  );

  return {
    messages: chatHistory.messages,
    isLoading,
    sendMessage,
    error,
  };
}
