"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDash } from "@/context/DashboardContext";
import { useAuth } from "@/context/AuthContext";
import ResponseRenderer from "./ResponseRenderer";

interface Message {
  id: number;
  content: string;
  sender: "user" | "ai";
  type?: "text" | "table" | "chart" | "csv" | "navigation";
}

export function ModalAI() {
  const { tokens } = useAuth();
  const { aiTransactions, accounts, budgets } = useDash();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, content: "Hello! How can I assist you today?", sender: "ai" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No longer need to load all data into context for AI
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      content: input,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/predictions/agent/chat/`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tokens?.access}`
        },
        body: JSON.stringify({ query: input }),
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, content: data.response, sender: "ai" },
      ]);
    } catch (error) {
      console.error("Error fetching response:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          content: "Sorry, I encountered an error. Please try again.",
          sender: "ai",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="text-sm text-white/25 flex items-center hover:text-white transition-colors duration-300 ease-in-out">
          <span className="cursor-pointer">Ask Warfare A Question!</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] h-[70vh] flex flex-col bg-[#121212] text-white border-none w-full">
        <div className="flex flex-row items-center justify-start gap-4 w-full border-white/15 border-b py-4 px-6">
          <DialogHeader>
            <DialogTitle>Assistant</DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex flex-1 overflow-hidden w-full">
          <div className="flex-1 flex flex-col relative w-full">
            <ScrollArea className="flex-1 p-4 text-sm font-mono ">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex flex-row gap-6 items-center ${
                    message.sender === "user" ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`${message.sender === "user" ? "" : "hidden"}`}
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                  </div>
                  <div
                    className={`${message.sender === "user" ? "hidden" : ""}`}
                  >
                    <div className="w-7 h-7 border border-white/15 rounded-none flex items-center justify-center text-sm">
                      AI
                    </div>
                  </div>
                  <div
                    className={`flex p-2 text-white bg-[#161616]`}
                    style={{
                      maxWidth: "100%",
                      wordWrap: "break-word",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {message.sender !== "user" ? (
                      <ResponseRenderer response={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex flex-row gap-6 items-center">
                  <div className="w-7 h-7 border border-white/15 rounded-none flex items-center justify-center text-sm">
                    AI
                  </div>
                  <div className="inline-block text-white/50 animate-pulse">Thinking...</div>
                </div>
              )}
            </ScrollArea>
            <div className="py-2 border-t-2 border-white/15 flex ">
              <div className="flex flex-row items-center justify-between w-full px-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Warfare a question..."
                  className="border-none bg-[#121212] "
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  disabled={loading}
                />
                <Button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex flex-row items-center justify-center w-16"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
