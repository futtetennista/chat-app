import { Model } from "@chat-app/contracts";
import React from "react";
import { FaPaperclip, FaPaperPlane, FaTruckLoading } from "react-icons/fa";
import styled from "styled-components";

import { useChat } from "../hooks/useChat";

const MessagesContainer = styled.div`
  background-color: #fff;
  border-radius: 5px;
  border: 1px solid #ddd;
  flex: 1;
  margin-bottom: 80px; /* Added more margin to account for input container */
  max-height: calc(100vh - 140px); /* Adjust height to prevent overlap */
  overflow-y: auto;
  padding: 10px;
`;

const Message = styled.div`
  background-color: #e1ffc7;
  border-radius: 5px;
  margin-bottom: 10px;
  padding: 10px;
  word-wrap: break-word;
`;

const InputContainer = styled.div`
  /* display: flex;
  align-items: center;
  position: fixed;
  bottom: 20px;
  left: 20px;
  right: 20px;
  background-color: #f0f0f0;
  padding: 10px;
  z-index: 1000; */

  input[type="text"] {
    border-radius: 24px;
    border: 1px solid #ddd;
    flex: 1;
    margin-left: 10px;
    margin-right: 10px;
    padding: 10px;
  }
`;

const Form = styled.form`
  align-items: center;
  background-color: #f0f0f0;
  bottom: 20px;
  display: flex;
  left: 20px;
  padding: 10px;
  position: fixed;
  right: 20px;
  z-index: 1000;
`;

const SendButton = styled.button`
  background-color: #007bff;
  border-radius: 24px;
  border: none;
  color: white;
  cursor: pointer;
  padding: 10px;

  &:hover {
    background-color: #0056b3;
  }
`;

const AttachFileButton = styled.button`
  background-color: ${({ disabled }) => (disabled ? "#ccc" : "#007bff")};
  border: none;
  border-radius: 24px;
  color: white;
  cursor: pointer;
  padding: 10px;

  &:hover {
    background-color: #0056b3;
  }
`;

interface Props {
  chatId: string;
  modelState: [Model, React.Dispatch<React.SetStateAction<Model>>];
}

const Chat = ({ modelState, chatId }: Props) => {
  const [input, setInput] = React.useState<string | undefined>(undefined);
  const { messages, isLoading, error, chat } = useChat({
    modelState,
    chatId,
  });

  const onSubmit = async function (e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (input?.trim() && !isLoading) {
      await chat(input.trim());
      setInput("");
    }
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    console.log(messagesEndRef.current);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(scrollToBottom, [messages]);

  return (
    <>
      <MessagesContainer>
        {messages.map((message, index) => (
          <Message
            key={index}
            ref={index === messages.length - 1 ? messagesEndRef : null}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 flex items-center ${
                message.role === "user"
                  ? "bg-blue-500 text-white self-end"
                  : "bg-gray-200 self-start"
              }`}
            >
              <div className="mr-2 order-1">
                <img
                  src={
                    message.role === "user"
                      ? "/assets/user-icon.svg"
                      : "/assets/model-icon.svg"
                  }
                  alt="icon"
                  className="w-6 h-6"
                />
              </div>
              <div className="order-2">{message.content}</div>
            </div>
          </Message>
        ))}
      </MessagesContainer>
      {error && <div className="text-red-500 text-center mt-2">{error}</div>}
      <InputContainer>
        <Form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
        >
          <AttachFileButton type="submit" disabled={true}>
            <FaPaperclip />
          </AttachFileButton>
          <input
            onKeyDown={(e) => {
              const handleKeyDown = async () => {
                if (e.key === "Enter") {
                  await onSubmit(e);
                }
              };
              void handleKeyDown();
            }}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            ref={(input) => {
              input?.focus();
            }}
            disabled={isLoading}
            placeholder="Type a message..."
          />
          <SendButton type="submit" disabled={isLoading}>
            {isLoading ? <FaTruckLoading /> : <FaPaperPlane />}
          </SendButton>
        </Form>
      </InputContainer>
    </>
  );
};

export default Chat;
