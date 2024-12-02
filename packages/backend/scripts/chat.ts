import {
  ChatResponse,
  Message,
  modelHandleToVendor,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
import { Command } from "@commander-js/extra-typings";
import { input, search, select } from "@inquirer/prompts";
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

import { anthropicModels, openAIModels } from "./mkConfig";

const PersistedChatD = Decoder.struct({
  name: Decoder.string,
  messages: Decoder.array(Message),
});

export type PersistedChat = Decoder.TypeOf<typeof PersistedChatD>;

const PersistedChatE: Encoder.Encoder<string, PersistedChat> = {
  encode: (chat) =>
    JSON.stringify({
      name: chat.name,
      messages: chat.messages,
    }),
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
    const readDir = (dirPath: string): IOE.IOEither<Error, string[]> => {
      return pipe(
        IOE.Do,
        IOE.bind("fileNames", () =>
          IOE.tryCatch(
            () => fs.readdirSync(dirPath),
            (reason) => new Error(String(reason)),
          ),
        ),
        IOE.map(({ fileNames: files }) => files),
      );
    };

    const readFile = (filePath: string): IOE.IOEither<Error, string> =>
      IOE.tryCatch(
        () => fs.readFileSync(filePath, { encoding: "utf-8" }),
        (reason) => new Error(String(reason)),
      );

    const readFileContent = (
      filePath: string,
    ): IO.IO<
      E.Either<
        Error,
        {
          fileName: string;
          name: string;
          messages: Message[];
        }
      >
    > => {
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
              fileName: path.basename(filePath),
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
      chat: { name: string; messages: unknown[] },
    ): IOE.IOEither<Error, string> => {
      return IOE.tryCatch(
        () => {
          fs.writeFileSync(filePath, JSON.stringify(chat, null, 2));
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
      fileName,
    }: {
      value: Undecoded<T>;
      decoder: Decoder.Decoder<unknown, T>;
      fileName?: string;
    }): IOE.IOEither<Error, T> => {
      return IO.of(
        pipe(
          decoder.decode(value),
          E.mapLeft(
            (error) =>
              new Error(
                `Could not decode value${fileName ? `(file: ${fileName}` : ""}`,
                {
                  cause: Decoder.draw(error),
                },
              ),
          ),
        ),
      );
    };

    const getExistingChatFilePaths: IOE.IOEither<Error, string[]> = pipe(
      fs.existsSync(chatHistoryDir) ? readDir(chatHistoryDir) : IOE.right([]),
      IOE.map((files) => {
        return files.filter((file) => file.endsWith(".json"));
      }),
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
      chatHistoryPath: string,
    ): TE.TaskEither<
      Error,
      {
        fileName: string;
        name: string;
        messages: { content: string; role: "user" | "assistant" }[];
      }
    > =>
      pipe(
        TE.Do,
        TE.bind("chatFiles", () => TE.fromIOEither(readDir(chatHistoryPath))),
        TE.bind("chatContentsOrError", ({ chatFiles }) => {
          return TE.fromIO(
            IO.sequenceArray(
              chatFiles.map((chatFile) =>
                readFileContent(path.resolve(chatHistoryPath, chatFile)),
              ),
            ),
          );
        }),
        TE.tapIO(({ chatContentsOrError }) => {
          return IO.sequenceArray(
            chatContentsOrError
              .filter((chat) => chat._tag === "Left")
              .map((chat) => Console.error(chat.left)),
          );
        }),
        TE.bindW("chats", ({ chatContentsOrError }) => {
          return TE.sequenceArray(
            chatContentsOrError
              .filter((chat) => chat._tag === "Right")
              .map((chat) => TE.of(chat.right)),
          );
        }),
        TE.bind("selectedChatName", ({ chats }) => {
          return TE.fromTask(() => {
            return search<string>({
              message: "Select a chat to continue",
              source(term, _opt) {
                return !term
                  ? chats.map((chat) => chat.name)
                  : chats
                      .filter((chat) => chat.name.includes(term))
                      .map((chat) => chat.name);
              },
            });
          });
        }),
        TE.bind("selectedChatFileName", ({ chats, selectedChatName }) => {
          return pipe(
            O.fromNullable(
              chats.find((chat) => chat.name === selectedChatName),
            ),
            O.match(
              () => TE.left(new Error("Chat not found")),
              (chat) => TE.right(chat.fileName),
            ),
          );
        }),
        TE.bind("selectedChatPersisted", ({ selectedChatFileName }) => {
          return TE.fromIOEither(
            readFile(path.resolve(chatHistoryPath, selectedChatFileName)),
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
              fileName: selectedChatFileName,
            }),
          );
        }),
        TE.tapIO(({ selectedChat }) => {
          return IO.sequenceArray(
            selectedChat.messages.map(({ role, content }) => {
              return Console.log(`${role}: ${content}`);
            }),
          );
        }),
        TE.map(({ selectedChatFileName, selectedChat }) => {
          return {
            fileName: selectedChatFileName,
            ...selectedChat,
          };
        }),
        TE.tapError((e) => {
          return TE.fromIO(Console.error(e));
        }),
      );

    const createChatFile = ({
      fileName,
      name,
    }: {
      fileName: string;
      name: string;
    }): IOE.IOEither<Error, string> =>
      writeFile(path.resolve(chatHistoryDir, fileName), {
        name: name,
        messages: [],
      });

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

    const createNewChat: TE.TaskEither<
      Error,
      { fileName: string; name: string; messages: Message[] }
    > = pipe(
      TE.Do,
      TE.tapIO(() => createChatHistoryDir(chatHistoryDir)),
      TE.bind("name", () =>
        TE.fromTask(() => input({ message: "Enter a name for the new chat:" })),
      ),
      TE.bind("fileName", () => {
        return TE.fromIOEither(
          createChatFile({
            fileName: `${Date.now().toString()}.json`,
            name: "",
          }),
        );
      }),
      TE.bind("messages", () => TE.of([])),
    );

    type ErrorOrDone = Error | Decoder.DecodeError | "done";

    const chatLoop = (
      filePath: string,
      chat:
        | (PersistedChat & { _tag: "chat" })
        | { name: string; _tag: "restore" },
    ): TE.TaskEither<ErrorOrDone, unknown> =>
      pipe(
        TE.Do,
        TE.bind("userMessageRaw", () =>
          TE.fromTask(() =>
            input({ message: "Enter your message (type '!e[xit]' to quit):" }),
          ),
        ),
        TE.tap(({ userMessageRaw }) => {
          if (/!e(xit)?/.test(userMessageRaw.toLowerCase())) {
            console.log("Exiting chat...");
            return TE.left("done" as const);
          }

          return _chatLoop(filePath, chat, userMessageRaw);
        }),
        TE.map(constVoid),
      );

    const _chatLoop = (
      filePath: string,
      chat:
        | (PersistedChat & {
            _tag: "chat";
          })
        | { name: string; _tag: "restore" },
      userMessageRaw: string,
    ): TE.TaskEither<ErrorOrDone, unknown> =>
      pipe(
        TE.Do,
        TE.let("modelTarget", () => {
          return O.fromNullable(
            /@(?<model>\w+)/.exec(userMessageRaw)?.groups?.model,
          );
        }),
        TE.let("vendor", ({ modelTarget }) => {
          if (modelTarget._tag === "None") {
            return TE.of("openai");
          }

          const vendorO = modelHandleToVendor(modelTarget.value);
          if (vendorO._tag === "None") {
            return TE.left(
              new Error(
                `Model "${modelTarget.value}" not supported. Valid models are: ${[...openAIModels, ...anthropicModels].join(", ")}`,
              ),
            );
          }
          return TE.of(vendorO.value);
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
            if (chat._tag === "restore") {
              return pipe(
                TE.Do,
                TE.bind("chat", () =>
                  TE.fromIOEither(readFileContent(filePath)),
                ),
                TE.map(({ chat }) => chat.messages),
                TE.tapError((e) => {
                  return TE.fromIO(Console.error(e));
                }),
              );
            }

            const data = chat.messages;
            data.push({ content: userMessage, role: "user" });
            return TE.of(data);
          },
        ),
        TE.tapIO(({ messageHistory }) => {
          return writeFile(filePath, {
            name: chat.name,
            messages: messageHistory,
          });
        }),
        TE.bind("response", ({ vendor, userMessage, messageHistory }) => {
          return TE.tryCatch(
            () =>
              fetch("http://localhost:3000/v1/api/chat", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  vendor,
                  message: userMessage,
                  history: messageHistory.slice(0, -1),
                }),
              }),
            (reason) => new Error(String(reason)),
          );
        }),
        TE.bind("responseBody", ({ response }) => {
          return TE.tryCatch(
            () => response.json(),
            (reason) => new Error(String(reason)),
          );
        }),
        TE.bindW("chatResponse", ({ responseBody }) => {
          return TE.fromEither(ChatResponse.decode(responseBody));
        }),
        TE.bind("assistantResponse", ({ chatResponse }) => {
          return chatResponse._t === "ko"
            ? TE.left(new APIError(chatResponse.error))
            : TE.of(chatResponse.data);
        }),
        TE.tap(({ messageHistory, assistantResponse }) => {
          messageHistory.push({
            content: assistantResponse.message,
            role: "assistant",
          });
          return TE.of(undefined);
        }),
        TE.tapIO(({ messageHistory }) => {
          return writeFile(filePath, {
            name: chat.name,
            messages: messageHistory,
          });
        }),
        TE.tap(({ messageHistory }) => {
          return chatLoop(filePath, {
            name: chat.name,
            messages: messageHistory,
            _tag: "chat",
          });
        }),
        TE.tapError((e) => {
          return TE.fromIO(Console.error(e));
        }),
        TE.alt(() => {
          return chatLoop(filePath, { name: chat.name, _tag: "restore" });
        }),
      );

    return pipe(
      TE.Do,
      TE.bind("existingChatFilePaths", () =>
        TE.fromIOEither(getExistingChatFilePaths),
      ),
      TE.bind("action", ({ existingChatFilePaths }) =>
        TE.fromTask(selectAction(existingChatFilePaths)),
      ),
      TE.tapIO(({ action }) => {
        return Console.log({ action });
      }),
      TE.bind("currentChat", ({ action }) => {
        switch (action) {
          case "new": {
            return createNewChat;
          }
          case "existing": {
            return restoreExistingChat(chatHistoryDir);
          }
          default: {
            const _exhaustiveCheck: never = action;
            return _exhaustiveCheck;
          }
        }
      }),
      TE.tapTask(({ currentChat: { fileName, name, messages } }) => {
        return chatLoop(path.resolve(chatHistoryDir, fileName), {
          name,
          messages,
          _tag: "chat",
        });
      }),
      TE.match(constVoid, constVoid),
    )();
  };
}
