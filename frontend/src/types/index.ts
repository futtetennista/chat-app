export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type Model = (typeof models)[number];

export const models = ["claude", "chatgpt"] as const;

export interface LLMProvider {
  id: string;
  name: string;

  sendMessage: (message: string, history: Message[]) => Promise<string>;
}
