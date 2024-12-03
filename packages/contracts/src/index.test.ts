import * as O from "fp-ts/Option";

import {
  anthropicDefaultModel,
  anthropicModels,
  ChatRequest,
  ChatResponse,
  defaultModel,
  Message,
  Model,
  openaiDefaultModel,
  openaiModels,
  perplexityDefaultModel,
  perplexityModels,
  resolveModel,
  RFC9457ErrorResponse,
  SuccessResponse,
} from "./index";

describe("ChatRequest", () => {
  describe("encode", () => {
    it("should encode ChatRequest to JSON string", () => {
      const chatRequest: ChatRequest = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        model: defaultModel,
      };

      const encoded = ChatRequest.encode(chatRequest);
      expect(encoded).toBe(
        JSON.stringify({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          model: defaultModel,
        }),
      );
    });
  });

  describe("decode", () => {
    it("should decode JSON string to ChatRequest", () => {
      const o = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        model: defaultModel,
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          model: defaultModel,
        });
      }
    });

    it("should fail to decode invalid JSON string", () => {
      const o = {
        message: "Hello, world!",
        history: [
          { role: "user", content: "Hi", timestamp: "invalid-timestamp" },
        ],
        model: defaultModel,
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Left");
    });
  });

  describe("resolveModel", () => {
    it("should resolve model handle to the default model", () => {
      expect(resolveModel("c")).toEqual(O.some(anthropicDefaultModel));
      expect(resolveModel("claude")).toEqual(O.some(anthropicDefaultModel));
      expect(resolveModel("cld")).toEqual(O.some(anthropicDefaultModel));
      expect(resolveModel("chatgpt")).toEqual(O.some(openaiDefaultModel));
      expect(resolveModel("gpt")).toEqual(O.some(openaiDefaultModel));
      expect(resolveModel("p")).toEqual(O.some(perplexityDefaultModel));
      expect(resolveModel("ppx")).toEqual(O.some(perplexityDefaultModel));
    });

    it.each<Model[]>([
      ...anthropicModels.map((x) => [x, x]),
      ...openaiModels.map((x) => [x, x]),
      ...perplexityModels.map((x) => [x, x]),
    ])("should resolve '%s' to '%s'", (x, y) => {
      expect(resolveModel(x)).toEqual(O.some(y));
    });

    it("should return none for unknown models", () => {
      expect(resolveModel("unknown-model")).toEqual(O.none);
    });
  });

  describe("Model", () => {
    it("should encode and decode Model correctly", () => {
      const encoded = Model.encode(defaultModel);
      const decoded = Model.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(defaultModel);
      }
    });
  });

  describe("Message", () => {
    it("should encode and decode Message correctly", () => {
      const message: Message = {
        role: "user",
        content: "Hello",
        timestamp: 1633024800000,
      };
      const encoded = Message.encode(message);
      const decoded = Message.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(message);
      }
    });
  });

  describe("SuccessResponse", () => {
    it("should encode and decode SuccessResponse correctly", () => {
      const successResponse: SuccessResponse = {
        message: "Success",
        model: defaultModel,
      };
      const encoded = SuccessResponse.encode(successResponse);
      const decoded = SuccessResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(successResponse);
      }
    });
  });

  describe("RFC9457ErrorResponse", () => {
    it("should encode and decode RFC9457ErrorResponse correctly", () => {
      const errorResponse: RFC9457ErrorResponse = {
        type: "tag:@chat-app:i_am_a_teapot",
        status: "400",
        title: "Bad Request",
        detail: "Invalid input",
      };
      const encoded = RFC9457ErrorResponse.encode(errorResponse);
      const decoded = RFC9457ErrorResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(errorResponse);
      }
    });
  });

  describe("ChatResponse", () => {
    it("should encode and decode ChatResponse correctly for success", () => {
      const chatResponse: ChatResponse = {
        _t: "ok",
        data: { message: "Success", model: defaultModel },
      };
      const encoded = ChatResponse.encode(chatResponse);
      const decoded = ChatResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(chatResponse);
      }
    });

    it("should encode and decode ChatResponse correctly for error", () => {
      const chatResponse: ChatResponse = {
        _t: "ko",
        error: {
          type: "tag:@chat-app:i_am_a_teapot",
          status: "400",
          title: "Bad Request",
          detail: "Invalid input",
        },
      };
      const encoded = ChatResponse.encode(chatResponse);
      const decoded = ChatResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual(chatResponse);
      }
    });
  });
});
