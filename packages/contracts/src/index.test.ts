import * as E from "fp-ts/Either";

import {
  anthropicDefaultModel,
  anthropicModels,
  ChatRequest,
  ChatResponse,
  ChatSuccessResponse,
  defaultModel,
  Message,
  Model,
  openaiDefaultModel,
  openaiModels,
  perplexityDefaultModel,
  perplexityModels,
  resolveModel,
  RFC9457ErrorResponse,
} from "./index";

describe("ChatRequest", () => {
  describe("encode", () => {
    it("should encode ChatRequest to JSON string", () => {
      const chatRequest: ChatRequest = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        models: [defaultModel],
      };

      const encoded = ChatRequest.encode(chatRequest);
      expect(encoded).toBe(
        JSON.stringify({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          models: [defaultModel],
        }),
      );
    });
  });

  describe("decode", () => {
    it("should decode JSON string to ChatRequest", () => {
      const o: ChatRequest = {
        message: "Hello, world!",
        history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
        models: [defaultModel],
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Right");
      if (decoded._tag === "Right") {
        expect(decoded.right).toEqual({
          message: "Hello, world!",
          history: [{ role: "user", content: "Hi", timestamp: 1633024800000 }],
          models: [defaultModel],
        });
      }
    });

    it("should fail to decode invalid JSON string", () => {
      const o = {
        message: "Hello, world!",
        history: [
          { role: "user", content: "Hi", timestamp: "invalid_timestamp" },
        ],
        models: [defaultModel],
      };

      const decoded = ChatRequest.decode(o);
      expect(decoded._tag).toBe("Left");
    });
  });

  describe("resolveModel", () => {
    it("should resolve model handle to the default model", () => {
      expect(resolveModel("c")).toEqual(E.right(anthropicDefaultModel));
      expect(resolveModel("claude")).toEqual(E.right(anthropicDefaultModel));
      expect(resolveModel("cld")).toEqual(E.right(anthropicDefaultModel));
      expect(resolveModel("chatgpt")).toEqual(E.right(openaiDefaultModel));
      expect(resolveModel("gpt")).toEqual(E.right(openaiDefaultModel));
      expect(resolveModel("p")).toEqual(E.right(perplexityDefaultModel));
      expect(resolveModel("ppx")).toEqual(E.right(perplexityDefaultModel));
    });

    it.each<Model[]>([
      ...anthropicModels.map((x) => [x, x]),
      ...openaiModels.map((x) => [x, x]),
      ...perplexityModels.map((x) => [x, x]),
    ])("should resolve '%s' to '%s'", (x, y) => {
      expect(resolveModel(x)).toEqual(E.right(y));
    });

    it("should return none for unknown models", () => {
      expect(resolveModel("unknown-model")).toEqual(E.left("unknown-model"));
    });
  });

  describe("Model", () => {
    it("should encode and decode Model correctly", () => {
      const encoded = Model.encode(defaultModel);
      const decoded = Model.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      expect((decoded as E.Right<Model>).right).toEqual(defaultModel);
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
      expect((decoded as E.Right<Message>).right).toEqual(message);
    });
  });

  describe("SuccessResponse", () => {
    it("should encode and decode SuccessResponse correctly", () => {
      const successResponse: ChatSuccessResponse = {
        responses: [
          {
            message: "Success",
            model: defaultModel,
          },
        ],
      };
      const encoded = ChatSuccessResponse.encode(successResponse);
      const decoded = ChatSuccessResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      expect((decoded as E.Right<ChatSuccessResponse>).right).toEqual(
        successResponse,
      );
    });

    it("should encode and decode SuccessResponse with errors correctly", () => {
      const successResponse: ChatSuccessResponse = {
        responses: [
          {
            message: "Success",
            model: defaultModel,
          },
        ],
        errors: [
          {
            type: "tag:@chat-app:i_am_a_teapot",
            status: "400",
            title: "Bad Request",
            detail: "Invalid input",
          },
        ],
      };
      const encoded = ChatSuccessResponse.encode(successResponse);
      const decoded = ChatSuccessResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      expect((decoded as E.Right<ChatSuccessResponse>).right).toEqual(
        successResponse,
      );
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
      expect((decoded as E.Right<RFC9457ErrorResponse>).right).toEqual(
        errorResponse,
      );
    });
  });

  describe("ChatResponse", () => {
    it("should encode and decode ChatResponse correctly for success", () => {
      const chatResponse: ChatResponse = {
        _t: "ok",
        data: { responses: [{ message: "Success", model: defaultModel }] },
      };
      const encoded = ChatResponse.encode(chatResponse);
      const decoded = ChatResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      expect((decoded as E.Right<ChatResponse>).right).toEqual(chatResponse);
    });

    it("should encode and decode ChatResponse correctly for error", () => {
      const chatResponse: ChatResponse = {
        _t: "ko",
        errors: [
          {
            type: "tag:@chat-app:i_am_a_teapot",
            status: "400",
            title: "Bad Request",
            detail: "Invalid input",
          },
        ],
      };
      const encoded = ChatResponse.encode(chatResponse);
      const decoded = ChatResponse.decode(JSON.parse(encoded));

      expect(decoded._tag).toBe("Right");
      expect((decoded as E.Right<ChatResponse>).right).toEqual(chatResponse);
    });
  });
});
