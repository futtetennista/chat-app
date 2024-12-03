import {
  ChatRequest,
  ChatResponse,
  defaultModel,
  Message,
  Model,
  resolveModel,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
import { anthropicModels, openaiModels } from "@chat-app/contracts";
import { Command } from "@commander-js/extra-typings";
import { input, search, select } from "@inquirer/prompts";
import * as apply from "fp-ts/lib/Apply";
import * as Console from "fp-ts/lib/Console";
import * as E from "fp-ts/lib/Either";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as IO from "fp-ts/lib/IO";
import * as IOE from "fp-ts/lib/IOEither";
import * as O from "fp-ts/lib/Option";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as Codec from "io-ts/lib/Codec";
import * as Decoder from "io-ts/lib/Decoder";
import * as Encoder from "io-ts/lib/Encoder";
import * as path from "path";

const ChatHistoryD = Decoder.struct({
  chat_history: Decoder.array(
    Decoder.struct({
      filename: Decoder.string,
      name: Decoder.string,
    }),
  ),
});

type ChatHistory = Decoder.TypeOf<typeof ChatHistoryD>;

const ChatHistoryE: Encoder.Encoder<string, ChatHistory> = {
  encode: (chatHistory) => JSON.stringify(chatHistory),
};

const ChatHistory: Codec.Codec<unknown, string, ChatHistory> = Codec.make(
  ChatHistoryD,
  ChatHistoryE,
);

const PersistedChatD = Decoder.struct({
  // name: Decoder.string,
  messages: Decoder.array(Message),
});

export type PersistedChat = Decoder.TypeOf<typeof PersistedChatD>;

const PersistedChatE: Encoder.Encoder<string, PersistedChat> = {
  encode: (chat) => JSON.stringify(chat),
};

const PersistedChat: Codec.Codec<unknown, string, PersistedChat> = Codec.make(
  PersistedChatD,
  PersistedChatE,
);

class APIError extends Error {
  public readonly detail;
  public readonly instance;
  public readonly status;
  public readonly type;

  constructor(errorResponse: RFC9457ErrorResponse) {
    super(errorResponse.title);
    this.status = errorResponse.status;
    this.type = errorResponse.type;
    this.detail = errorResponse.detail;
    this.instance = errorResponse.instance;
  }
}

export function chat(_cmd: Command) {
  return async function ({
    chatHistoryDir = path.resolve(__dirname, "../../../.chat_history"),
  }: {
    chatHistoryDir?: string;
  }): Promise<void> {
    // 1. ask user if they want to create a new chat or continue an existing one
    // existing chats are  stored in the .chat_history folder (if it exists)
    // and json files with a "name" property.
    // Don't show "existing chats" if the folder is empty.
    // Use inquirer.js for this.
    const readChatHistory = (
      dirPath: string,
    ): IOE.IOEither<Error, ChatHistory["chat_history"]> => {
      return pipe(
        IOE.Do,
        IOE.bind("chatHistory", () =>
          readFile(path.resolve(dirPath, "chat_history.json")),
        ),
        IOE.bind("parsed", ({ chatHistory }) => {
          return parseJSON<ChatHistory>(chatHistory);
        }),
        IOE.bind("decoded", ({ parsed }) => {
          return decodeOrFail({
            decoder: ChatHistory,
            value: parsed,
            filename: "chat_history.json",
          });
        }),
        IOE.map(({ decoded }) => decoded.chat_history),
        IOE.tapError((e) => {
          return IOE.fromIO(Console.error(e));
        }),
      );
    };

    const readFile = (filePath: string): IOE.IOEither<Error, string> =>
      IOE.tryCatch(
        () => fs.readFileSync(filePath, { encoding: "utf-8" }),
        (reason) => new Error(String(reason)),
      );

    const readFileContent = (
      filePath: string,
    ): IO.IO<E.Either<Error, PersistedChat>> => {
      return pipe(
        IO.Do,
        IO.bind("contentOrError", () =>
          readFile(path.resolve(chatHistoryDir, filePath)),
        ),
        IO.bind(
          "contentParsedOrError",
          ({
            contentOrError,
          }): IOE.IOEither<Error, Undecoded<PersistedChat>> => {
            if (contentOrError._tag === "Left") {
              return IO.of(contentOrError);
            }
            return parseJSON<PersistedChat>(contentOrError.right);
          },
        ),
        IO.bind(
          "contentDecodedOrError",
          ({ contentParsedOrError }): IO.IO<E.Either<Error, PersistedChat>> => {
            if (contentParsedOrError._tag === "Left") {
              return IO.of(contentParsedOrError);
            }
            return decodeOrFail({
              decoder: PersistedChat,
              value: contentParsedOrError.right,
              filename: path.basename(filePath),
            });
          },
        ),
        IO.map(({ contentDecodedOrError }) => {
          if (contentDecodedOrError._tag === "Left") {
            return E.left(contentDecodedOrError.left);
          }
          return E.of({
            fileName: path.basename(filePath),
            ...contentDecodedOrError.right,
          });
        }),
      );
    };

    const writeFile = (
      filePath: string,
      payload: string,
    ): IOE.IOEither<Error, string> => {
      return IOE.tryCatch(
        () => {
          fs.writeFileSync(filePath, payload, { encoding: "utf8" });
          return path.basename(filePath);
        },
        (reason) => new Error(String(reason)),
      );
    };

    interface Undecoded<T> {
      _tag: "undecoded";
      value: T;
    }

    const parseJSON = <T>(value: string): IOE.IOEither<Error, Undecoded<T>> => {
      return IOE.tryCatch(
        () => ({ _tag: "undecoded", value: JSON.parse(value) as T }),
        (reason) => new Error(String(reason)),
      );
    };

    const decodeOrFail = <T>({
      value,
      decoder,
      filename,
    }: {
      value: Undecoded<T>;
      decoder: Decoder.Decoder<unknown, T>;
      filename?: string;
    }): IOE.IOEither<Error, T> => {
      return IO.of(
        pipe(
          decoder.decode(value.value),
          E.mapLeft(
            (error) =>
              new Error(
                `Could not decode value '${JSON.stringify(value.value)}'${filename ? ` (file: ${filename})` : ""}`,
                {
                  cause: Decoder.draw(error),
                },
              ),
          ),
        ),
      );
    };

    const getChatHistory: IO.IO<ChatHistory["chat_history"]> = pipe(
      IOE.Do,
      IOE.bind("chatHistory", () => readChatHistory(chatHistoryDir)),
      IOE.matchE(
        (_) => IO.of([]),
        ({ chatHistory }) => IO.of(chatHistory),
      ),
    );

    const selectAction: (arg: string[]) => T.Task<"new" | "existing"> = (
      existingChatFilePaths: string[],
    ) =>
      existingChatFilePaths.length > 0
        ? () =>
            select({
              message: "What would you like do?",
              choices: [
                { name: "Create a new chat", value: "new" as const },
                {
                  name: "Continue an existing chat",
                  value: "existing" as const,
                },
              ],
            })
        : T.of("new" as const);

    const restoreExistingChat = (
      chatHistory: ChatHistory["chat_history"],
    ): TE.TaskEither<
      Error,
      PersistedChat & {
        filename: string;
      }
    > =>
      pipe(
        TE.Do,
        TE.bind("selectedChatName", () => {
          return TE.fromTask(() => {
            return search<string>({
              message: "Select a chat to continue",
              source(term, _opt) {
                return !term
                  ? chatHistory.map((chat) => chat.name)
                  : chatHistory
                      .filter((chat) => chat.name.includes(term))
                      .map((chat) => chat.name);
              },
            });
          });
        }),
        TE.bind("selectedChatFileName", ({ selectedChatName }) => {
          return pipe(
            O.fromNullable(
              chatHistory.find((chat) => chat.name === selectedChatName),
            ),
            O.match(
              () => TE.left(new Error("Chat not found")),
              (chat) => TE.right(chat.filename),
            ),
          );
        }),
        TE.bind("selectedChatPersisted", ({ selectedChatFileName }) => {
          return TE.fromIOEither(
            readFile(path.resolve(chatHistoryDir, selectedChatFileName)),
          );
        }),
        TE.bind("selectedChatRaw", ({ selectedChatPersisted }) => {
          return TE.fromIOEither(
            parseJSON<PersistedChat>(selectedChatPersisted),
          );
        }),
        TE.bind("selectedChat", ({ selectedChatFileName, selectedChatRaw }) => {
          return TE.fromIOEither(
            decodeOrFail({
              decoder: PersistedChat,
              value: selectedChatRaw,
              filename: selectedChatFileName,
            }),
          );
        }),
        TE.tapIO(({ selectedChat }) => {
          return apply.sequenceT(IO.Apply)(
            Console.log("✅ Chat restored"),
            ...selectedChat.messages.map(({ role, content }) => {
              return Console.log(`${role}: ${content}`);
            }),
          );
        }),
        TE.map(({ selectedChatFileName, selectedChat }) => {
          return {
            filename: selectedChatFileName,
            ...selectedChat,
          };
        }),
        TE.tapError((e) => {
          return TE.fromIO(Console.error(e));
        }),
      );

    const createChatFile = ({
      filename,
    }: {
      filename: string;
      name: string;
    }): IOE.IOEither<Error, string> =>
      writeFile(
        path.resolve(chatHistoryDir, filename),
        PersistedChat.encode({
          // name: name,
          messages: [],
        }),
      );

    const createChatHistoryDir = (
      dirPath: string,
    ): IOE.IOEither<Error, string | null | undefined> =>
      IOE.tryCatch(
        () =>
          fs.existsSync(dirPath)
            ? null
            : fs.mkdirSync(dirPath, { recursive: true }),
        (reason) => new Error(String(reason)),
      );

    const updateChatHistory = (
      dirPath: string,
      { name, filename }: { name: string; filename: string },
    ): IOE.IOEither<Error, void> => {
      return pipe(
        IOE.Do,
        IOE.bind("chatHistory", () => readChatHistory(dirPath)),
        IOE.bind("updatedChatHistory", ({ chatHistory }) => {
          return IOE.right([...chatHistory, { name, filename }]);
        }),
        IOE.bind("writeResult", ({ updatedChatHistory }) => {
          return writeFile(
            path.resolve(dirPath, "chat_history.json"),
            ChatHistory.encode({
              chat_history: updatedChatHistory,
            }),
          );
        }),
        IOE.tapError((e) => {
          return IOE.fromIO(Console.error(e));
        }),
        IOE.map(constVoid),
      );
    };

    const createNewChat: TE.TaskEither<
      Error,
      PersistedChat & { filename: string }
    > = pipe(
      TE.Do,
      TE.tapIO(() => createChatHistoryDir(chatHistoryDir)),
      TE.bind("name", () =>
        TE.fromTask(() =>
          input({
            message: "Enter a name for the new chat:",
            default: "New chat",
          }),
        ),
      ),
      TE.bind("filename", () => {
        return TE.of(`${Date.now().toString()}.json`);
      }),
      TE.tapIO(({ name, filename }) => {
        return createChatFile({
          filename,
          name,
        });
      }),
      TE.tapIO(({ name, filename }) => {
        return updateChatHistory(chatHistoryDir, { name, filename });
      }),
      TE.bind("messages", () => TE.of([])),
    );

    type ChatLoopError = Error | Decoder.DecodeError;

    const chatLoop = (
      filePath: string,
      chat: ({ _tag: "chat" } & PersistedChat) | { _tag: "restore" },
    ): TE.TaskEither<ChatLoopError, unknown> =>
      pipe(
        TE.Do,
        TE.bind("messages", () => {
          if (chat._tag === "restore") {
            return pipe(
              TE.Do,
              TE.bind("persistedChat", () =>
                TE.fromIOEither(readFileContent(filePath)),
              ),
              TE.map(({ persistedChat }) => persistedChat),
              TE.tapIO((persistedChat) =>
                Console.log(
                  `✅ Chat restored from error (${persistedChat.messages.length.toString()})`,
                ),
              ),
            );
          }
          return TE.of({ messages: chat.messages });
        }),
        TE.bind("userMessageRaw", () =>
          TE.fromTask(() =>
            input({ message: "Enter your message (type '!e[xit]' to quit):" }),
          ),
        ),
        TE.bind("userMessage", ({ userMessageRaw }) => {
          if (/!e(xit)?/.test(userMessageRaw.toLowerCase())) {
            return TE.of(O.none);
          }
          return TE.of(O.some(userMessageRaw));
        }),
        TE.tap(({ messages, userMessage }) => {
          return userMessage._tag === "None"
            ? TE.fromIO(Console.log("👋 Goodbye!"))
            : _chatLoop(filePath, messages, userMessage.value);
        }),
        TE.map(constVoid),
      );

    const _chatLoop = (
      filePath: string,
      chat: PersistedChat,
      userMessageRaw: string,
    ): TE.TaskEither<ChatLoopError, unknown> =>
      pipe(
        TE.Do,
        TE.let("modelTarget", () => {
          return O.fromNullable(
            /@(?<modelOrHandle>\w+)/.exec(userMessageRaw)?.groups
              ?.modelOrHandle,
          );
        }),
        TE.bind("model", ({ modelTarget }) => {
          if (modelTarget._tag === "None") {
            return TE.of<Error, Model>(defaultModel);
          }

          const modelO = resolveModel(modelTarget.value);
          if (modelO._tag === "None") {
            return TE.left(
              new Error(
                `Model "${modelTarget.value}" not supported. Valid models are: ${[...openaiModels, ...anthropicModels].join(", ")}`,
              ),
            );
          }
          return TE.of<Error, Model>(modelO.value);
        }),
        TE.let("userMessage", ({ modelTarget }) => {
          if (modelTarget._tag === "None") {
            return userMessageRaw;
          }
          return userMessageRaw.replace(modelTarget.value, "").trim();
        }),
        TE.bind(
          "messageHistory",
          ({ userMessage }): TE.TaskEither<Error, Message[]> => {
            const data = chat.messages;
            data.push({ content: userMessage, role: "user" });
            return TE.of(data);
          },
        ),
        TE.tapIO(({ messageHistory }) => {
          return writeFile(
            filePath,
            PersistedChat.encode({
              // name: chat.name,
              messages: messageHistory,
            }),
          );
        }),
        TE.bind("response", ({ model, userMessage, messageHistory }) => {
          return TE.tryCatch(
            () =>
              fetch("http://localhost:3000/v1/api/chat", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: ChatRequest.encode({
                  model,
                  message: userMessage,
                  history: messageHistory.slice(0, -1),
                }),
              }),
            (reason) => new Error(String(reason)),
          );
        }),
        TE.bind("responseUndecoded", ({ response }) => {
          return pipe(
            TE.tryCatch(
              () => response.text(),
              (reason) => new Error(String(reason)),
            ),
            TE.flatMap((text) =>
              TE.fromIOEither(parseJSON<ChatResponse>(text)),
            ),
          );
        }),
        TE.bindW("responseDecoded", ({ responseUndecoded }) => {
          return TE.fromIOEither(
            decodeOrFail({
              decoder: ChatResponse,
              value: responseUndecoded,
            }),
          );
        }),
        TE.bind("assistantResponse", ({ responseDecoded }) => {
          return responseDecoded._t === "ko"
            ? TE.left(new APIError(responseDecoded.error))
            : TE.of(responseDecoded.data);
        }),
        TE.tap(({ messageHistory, assistantResponse }) => {
          messageHistory.push({
            content: assistantResponse.message,
            role: "assistant",
          });
          return TE.of(undefined);
        }),
        TE.tapIO(({ assistantResponse }) => {
          return Console.log(
            `${assistantResponse.model}: ${assistantResponse.message}`,
          );
        }),
        TE.tapIO(({ messageHistory }) => {
          return writeFile(
            filePath,
            PersistedChat.encode({
              // name: chat.name,
              messages: messageHistory,
            }),
          );
        }),
        TE.tap(({ messageHistory }) => {
          return chatLoop(filePath, {
            // name: chat.name,
            messages: messageHistory,
            _tag: "chat",
          });
        }),
        TE.tapError((error) => {
          return TE.fromIO(Console.error(error));
        }),
        TE.alt(() => {
          return chatLoop(filePath, { _tag: "restore" });
        }),
      );

    return pipe(
      TE.Do,
      TE.bind("chatHistory", () => TE.fromIO(getChatHistory)),
      TE.bind("choice", ({ chatHistory }) =>
        TE.fromTask(selectAction(chatHistory.map((chat) => chat.name))),
      ),
      TE.tapIO(({ choice }) => {
        return Console.log({ choice });
      }),
      TE.bind("currentChat", ({ choice, chatHistory }) => {
        switch (choice) {
          case "new": {
            return createNewChat;
          }
          case "existing": {
            return restoreExistingChat(chatHistory);
          }
          default: {
            const _exhaustiveCheck: never = choice;
            return _exhaustiveCheck;
          }
        }
      }),
      TE.tapTask(({ currentChat: { filename, messages } }) => {
        return chatLoop(path.resolve(chatHistoryDir, filename), {
          messages,
          _tag: "chat",
        });
      }),
      TE.tapError((e) => {
        return TE.fromIO(Console.error(e));
      }),
      TE.match(constVoid, constVoid),
    )();
  };
}

export { ChatHistory as ChatHistoryTestOnly };
