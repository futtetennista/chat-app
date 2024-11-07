export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Request {
  message: string;
  history: Message[];
  model: Model;
}

export type Response = SuccessResponse | ErrorResponse;

type SuccessResponse = {
  status: "success";
  message: string;
};

type ErrorResponse = {
  status: "error";
  code: string;
  error: string;
  statusCode: number;
};

export type Model = "chatgpt" | "perplexity" | "claude";

type Vendor = "openai" | "perplexity" | "anthropic";

export interface LLM<Model> {
  vendor: Vendor;
  model: Model;
}
