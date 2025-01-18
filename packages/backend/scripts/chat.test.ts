import { Message } from "@chat-app/contracts";
import {
  baseURL as apiBaseURL,
  internalHandlers as handlers,
} from "@chat-app/mocks";
import { input } from "@inquirer/prompts";
import * as fs from "fs";
import * as Decoder from "io-ts/lib/Decoder";
import { setupServer } from "msw/node";
import * as os from "os";
import * as path from "path";

import { ChatHistoryTestOnly as ChatHistory } from "./chat";
import { chatLoopTestOnly as chatLoop } from "./chat";

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("ChatHistory", () => {
  it("should decode valid chat history", () => {
    const validChatHistory = {
      chat_history: [
        { filename: "chat1.json", name: "Chat 1" },
        { filename: "chat2.json", name: "Chat 2" },
      ],
    };

    // validChatHistory = JSON.parse(fs.readFileSync("../../.chat_history/chat_history.json", "utf-8"));
    // validChatHistory = {"chat_history":[{"name":"one","filename":"1732983566964.json"},{"name":"two","filename":"1732991308405.json"}]};

    const result = ChatHistory.decode(validChatHistory);

    expect(result._tag).toBe("Right");
    if (result._tag === "Right") {
      expect(result.right).toEqual(validChatHistory);
    }
  });

  it("should fail to decode invalid chat history", () => {
    const invalidChatHistory = {
      chat_history: [
        { filename: "chat1.json", name: 123 }, // Invalid name type
      ],
    };

    const result = ChatHistory.decode(invalidChatHistory);

    if (result._tag === "Left") {
      console.log(Decoder.draw(result.left));
    }
    expect(result._tag).toBe("Left");
  });

  it("should fail to decode chat history with missing fields", () => {
    const invalidChatHistory = {
      chat_history: [
        { filename: "chat1.json" }, // Missing name field
      ],
    };

    const result = ChatHistory.decode(invalidChatHistory);

    if (result._tag === "Left") {
      console.log(Decoder.draw(result.left));
    }
    expect(result._tag).toBe("Left");
  });

  it("should NOT fail to decode chat history with extra fields", () => {
    const invalidChatHistory = {
      chat_history: [
        { filename: "chat1.json", name: "Chat 1", extra: "extra field" }, // Extra field
      ],
    };

    const result = ChatHistory.decode(invalidChatHistory);

    if (result._tag === "Left") {
      console.log(Decoder.draw(result.left));
    }
    expect(result._tag).toBe("Right");
  });
});

jest.mock("@inquirer/prompts", () => ({
  input: jest.fn(),
}));

describe("chatLoop", () => {
  const [timeout, messageThreshold] = process.env.CI
    ? [60_000, 10_000]
    : [5_000, 11];

  it(
    "[perf] should NOT cause a stack overflow",
    async function () {
      const chat: { _tag: "chat"; messages: Message[] } = {
        _tag: "chat",
        messages: [],
      };
      const chatHistoryDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "chat-history-"),
      );
      const filePath = path.join(chatHistoryDir, "test-chat.json");
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          messages: [],
        }),
        "utf8",
      );

      const start = Date.now();

      (input as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(Date.now() - start > timeout - 500 ? "!e" : "test message");
          }, 1);
        });
      });

      return chatLoop({
        apiBaseURL,
        chatHistoryDir,
        filePath,
        chat,
        messageThreshold,
      })();
    },
    timeout,
  );
});
