import {
  ChatRequest,
  ChatResponse,
  defaultModels,
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

type PersistedChat = Decoder.TypeOf<typeof PersistedChatD>;

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

export default function (_cmd: Command) {
  return async function ({
    apiBaseURL = "http://localhost:3000/",
    chatHistoryDir = path.resolve(__dirname, "../../../.chat_history"),
  }: {
    chatHistoryDir?: string;
    apiBaseURL?: string;
  }): Promise<void> {
    // 1. ask user if they want to create a new chat or continue an existing one
    // existing chats are  stored in the .chat_history folder (if it exists)
    // and json files with a "name" property.
    // Don't show "existing chats" if the folder is empty.
    // Use inquirer.js for this.
    return pipe(
      TE.Do,
      TE.bind("chatHistory", () =>
        TE.fromIO(getOrCreateChatHistory({ chatHistoryDir })),
      ),
      TE.bind("choice", ({ chatHistory }) =>
        TE.fromTask(selectAction(chatHistory.map((chat) => chat.name))),
      ),
      TE.tapIO(({ choice }) => {
        return Console.log({ choice });
      }),
      TE.bind("currentChat", ({ choice, chatHistory }) => {
        switch (choice) {
          case "new": {
            return createNewChat({ chatHistoryDir });
          }
          case "existing": {
            return restoreExistingChat({ chatHistory, chatHistoryDir });
          }
          default: {
            const _exhaustiveCheck: never = choice;
            return _exhaustiveCheck;
          }
        }
      }),
      TE.tapTask(({ currentChat: { filename, messages } }) => {
        return chatLoop({
          // messageThreshold: 10_000,
          apiBaseURL,
          filePath: path.resolve(chatHistoryDir, filename),
          chatHistoryDir,
          chat: { messages, _tag: "chat" },
        });
      }),
      TE.tapError((e) => {
        return TE.fromIO(Console.error(e));
      }),
      TE.match(constVoid, constVoid),
    )();
  };
}

type ChatLoopError = Error | Decoder.DecodeError;

function chatLoop({
  apiBaseURL,
  filePath,
  chatHistoryDir,
  chat,
  messageThreshold,
}: {
  apiBaseURL: string;
  filePath: string;
  chatHistoryDir: string;
  chat: ({ _tag: "chat" } & PersistedChat) | { _tag: "restore" };
  messageThreshold?: number;
}): TE.TaskEither<ChatLoopError, unknown> {
  return pipe(
    TE.Do,
    TE.bind("messageThresholdReached", () => {
      return TE.of(
        undefined !== messageThreshold ? messageThreshold <= 0 : false,
      );
    }),
    TE.bind("messages", () => {
      if (chat._tag === "restore") {
        return pipe(
          TE.Do,
          TE.bind("persistedChat", () =>
            TE.fromIOEither(readFileContent({ filePath, chatHistoryDir })),
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
    // TE.tapIO(({ messageThresholdReached }) =>
    //   Console.log({ messageThreshold, messageThresholdReached }),
    // ),
    TE.tap(({ messages, userMessage, messageThresholdReached }) => {
      return userMessage._tag === "None"
        ? TE.fromIO(Console.log("👋 Goodbye!"))
        : messageThresholdReached
          ? TE.fromIO(Console.log("👋 Message threshold reached. Goodbye!"))
          : _chatLoop({
              messageThreshold,
              apiBaseURL,
              chatHistoryDir,
              filePath,
              chat: messages,
              userMessageRaw: userMessage.value,
            });
    }),
    TE.map(constVoid),
  );
}

function _chatLoop({
  apiBaseURL,
  filePath,
  chatHistoryDir,
  chat,
  userMessageRaw,
  messageThreshold,
}: {
  apiBaseURL: string;
  chatHistoryDir: string;
  filePath: string;
  chat: PersistedChat;
  userMessageRaw: string;
  messageThreshold?: number;
}): TE.TaskEither<ChatLoopError, unknown> {
  return pipe(
    TE.Do,
    TE.let("modelTargets", () => {
      return O.fromNullable(userMessageRaw.match(/@\w+/g));
    }),
    TE.bind("models", ({ modelTargets }) => {
      if (modelTargets._tag === "None") {
        return TE.of<Error, Model[]>(defaultModels);
      }

      return pipe(
        E.sequenceArray(modelTargets.value.map(resolveModel)),
        E.match(
          () => {
            return TE.left(
              new Error(
                `One or more models in "${modelTargets.value.join(", ")}" are not supported. Valid models are: ${[...openaiModels, ...anthropicModels].join(", ")}`,
              ),
            );
          },
          (models) => TE.right<Error, readonly Model[]>(models),
        ),
      );

      // const modelO = modelTarget.value.map(resolveModel);
      // if (modelO._tag === "None") {
      //   return TE.left(
      //     new Error(
      //       `Model "${modelTarget.value}" not supported. Valid models are: ${[...openaiModels, ...anthropicModels].join(", ")}`,
      //     ),
      //   );
      // }
      // return TE.of<Error, Model>(modelO.value);
    }),
    TE.let("userMessage", ({ modelTargets }) => {
      if (modelTargets._tag === "None") {
        return userMessageRaw;
      }

      return modelTargets.value
        .reduce<string>((tally, model) => {
          return tally.replace(model, "");
        }, userMessageRaw)
        .trim();
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
    TE.bind("response", ({ models, userMessage, messageHistory }) => {
      return TE.tryCatch(
        () =>
          fetch(new URL(`${apiBaseURL}/v1/api/chat`), {
            // fetch(`http://localhost/v1/api/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: ChatRequest.encode({
              models,
              message: userMessage,
              history: messageHistory.slice(0, -1),
            }),
          }),
        (reason) => new Error(String(reason)),
      );
    }),
    TE.bind("responseText", ({ response }) => {
      return pipe(
        TE.tryCatch(
          () => response.text(),
          (reason) => new Error(String(reason)),
        ),
        TE.flatMap((text) => TE.fromIOEither(parseJSON<ChatResponse>(text))),
      );
    }),
    TE.bindW("responseDecoded", ({ responseText }) => {
      return TE.fromIOEither(
        decodeOrFail({
          decoder: ChatResponse,
          value: responseText,
        }),
      );
    }),
    TE.bind("assistantResponse", ({ responseDecoded }) => {
      return responseDecoded._t === "ko"
        ? TE.left(new APIError(responseDecoded.error))
        : TE.of(responseDecoded.data);
    }),
    TE.tap(({ messageHistory, assistantResponse }) => {
      assistantResponse.forEach(({ message: content }) => {
        messageHistory.push({
          content,
          role: "assistant",
        });
      });
      return TE.of(undefined);
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
    TE.tapIO(({ assistantResponse }) => {
      return Console.log(
        assistantResponse
          .map(({ model, message }) => `${model}: ${message}`)
          .join("\n"),
      );
    }),
    TE.tap(({ messageHistory }) => {
      return chatLoop({
        messageThreshold:
          undefined !== messageThreshold ? messageThreshold - 1 : undefined,
        apiBaseURL,
        filePath,
        chatHistoryDir: chatHistoryDir,
        chat: {
          // name: chat.name,
          messages: messageHistory,
          _tag: "chat",
        },
      });
    }),
    TE.tapError((error) => {
      return TE.fromIO(Console.error(error));
    }),
    TE.alt(() => {
      return chatLoop({
        messageThreshold:
          undefined !== messageThreshold ? messageThreshold - 1 : undefined,
        apiBaseURL,
        filePath,
        chatHistoryDir,
        chat: { _tag: "restore" },
      });
    }),
  );
}

function _getOrCreateChatHistory(
  dirPath: string,
): IOE.IOEither<Error, ChatHistory["chat_history"]> {
  return pipe(
    IOE.Do,
    IOE.tapIO(() => createChatHistoryDir(dirPath)),
    IOE.bind("chatHistory", () =>
      fs.existsSync(path.resolve(dirPath, "chat_history.json"))
        ? readFile(path.resolve(dirPath, "chat_history.json"))
        : pipe(
            writeFile(
              path.resolve(dirPath, "chat_history.json"),
              JSON.stringify({ chat_history: [] }),
            ),
            IOE.map(() => JSON.stringify({ chat_history: [] })),
          ),
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
}

function readFile(filePath: string): IOE.IOEither<Error, string> {
  return IOE.tryCatch(
    () => fs.readFileSync(filePath, { encoding: "utf-8" }),
    (reason) => new Error(String(reason)),
  );
}

function readFileContent({
  chatHistoryDir,
  filePath,
}: {
  chatHistoryDir: string;
  filePath: string;
}): IO.IO<E.Either<Error, PersistedChat>> {
  return pipe(
    IO.Do,
    IO.bind("contentOrError", () =>
      readFile(path.resolve(chatHistoryDir, filePath)),
    ),
    IO.bind(
      "contentParsedOrError",
      ({ contentOrError }): IOE.IOEither<Error, Undecoded<PersistedChat>> => {
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
}

function writeFile(
  filePath: string,
  payload: string,
): IOE.IOEither<Error, { basename: string }> {
  return IOE.tryCatch(
    () => {
      fs.writeFileSync(filePath, payload, { encoding: "utf8" });
      return { basename: path.basename(filePath) };
    },
    (reason) => new Error(String(reason)),
  );
}

interface Undecoded<T> {
  _tag: "undecoded";
  value: T;
}

function parseJSON<T>(value: string): IOE.IOEither<Error, Undecoded<T>> {
  return IOE.tryCatch(
    () => ({ _tag: "undecoded", value: JSON.parse(value) as T }),
    (reason) => new Error(String(reason)),
  );
}

function decodeOrFail<T>({
  value,
  decoder,
  filename,
}: {
  value: Undecoded<T>;
  decoder: Decoder.Decoder<unknown, T>;
  filename?: string;
}): IOE.IOEither<Error, T> {
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
}

function getOrCreateChatHistory({
  chatHistoryDir,
}: {
  chatHistoryDir: string;
}): IO.IO<ChatHistory["chat_history"]> {
  return pipe(
    IOE.Do,
    IOE.bind("chatHistory", () => _getOrCreateChatHistory(chatHistoryDir)),
    IOE.matchE(
      (_) => IO.of([]),
      ({ chatHistory }) => IO.of(chatHistory),
    ),
  );
}

const selectAction: (arg: string[]) => T.Task<"new" | "existing"> = (
  existingChatFilePaths: string[],
) => {
  return existingChatFilePaths.length > 0
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
};

function restoreExistingChat({
  chatHistory,
  chatHistoryDir,
}: {
  chatHistory: ChatHistory["chat_history"];
  chatHistoryDir: string;
}): TE.TaskEither<
  Error,
  PersistedChat & {
    filename: string;
  }
> {
  return pipe(
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
      return TE.fromIOEither(parseJSON<PersistedChat>(selectedChatPersisted));
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
}

function createChatFile({
  filename,
  chatHistoryDir,
}: {
  filename: string;
  name: string;
  chatHistoryDir: string;
}): IOE.IOEither<Error, { basename: string }> {
  return writeFile(
    path.resolve(chatHistoryDir, filename),
    PersistedChat.encode({
      // name: name,
      messages: [],
    }),
  );
}

function createChatHistoryDir(
  dirPath: string,
): IOE.IOEither<Error, string | null | undefined> {
  return IOE.tryCatch(
    () =>
      fs.existsSync(dirPath)
        ? null
        : fs.mkdirSync(dirPath, { recursive: true }),
    (reason) => new Error(String(reason)),
  );
}

function updateChatHistory(
  dirPath: string,
  { name, filename }: { name: string; filename: string },
): IOE.IOEither<Error, void> {
  return pipe(
    IOE.Do,
    IOE.bind("chatHistory", () => _getOrCreateChatHistory(dirPath)),
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
}

function createNewChat({
  chatHistoryDir,
}: {
  chatHistoryDir: string;
}): TE.TaskEither<Error, PersistedChat & { filename: string }> {
  return pipe(
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
        chatHistoryDir,
      });
    }),
    TE.tapIO(({ name, filename }) => {
      return updateChatHistory(chatHistoryDir, { name, filename });
    }),
    TE.bind("messages", () => TE.of([])),
  );
}

export { ChatHistory as ChatHistoryTestOnly, chatLoop as chatLoopTestOnly };
