import { ChatRequest } from "./index";

describe("ChatRequest", () => {
  describe("encode", () => {
    it("should encode ChatRequest to JSON string", () => {
      const chatRequest: ChatRequest = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        vendor: "openai",
      };

      const encoded = ChatRequest.encode(chatRequest);
      expect(encoded).toBe(
        JSON.stringify({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          vendor: "openai",
        }),
      );
    });
  });

  describe("decode", () => {
    it("should decode JSON string to ChatRequest", () => {
      const o = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        vendor: "openai",
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          vendor: "openai",
        });
      }
    });

    it("should fail to decode invalid JSON string", () => {
      const o = {
        message: "Hello, world!",
        history: [
          { role: "user", content: "Hi", timestamp: "invalid-timestamp" },
        ],
        vendor: "openai",
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Left");
    });
  });
});
