// import * as fs from "fs";
import * as Decoder from "io-ts/lib/Decoder";

import { ChatHistoryTestOnly as ChatHistory } from "./chat";

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
