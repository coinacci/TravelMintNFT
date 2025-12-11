import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Lock } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface TravelAIStatus {
  isHolder: boolean;
  queryCount: number;
  remainingFreeQueries: number;
  hasAccess: boolean;
  freeQueryLimit: number;
}

export default function TravelAI() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get Travel AI status (holder status + query count)
  const { data: status, isLoading: isCheckingStatus } = useQuery<TravelAIStatus>({
    queryKey: ["/api/travel-ai/status", address],
    queryFn: async () => {
      const response = await fetch(`/api/travel-ai/status/${address}`);
      if (!response.ok) throw new Error("Failed to check status");
      return response.json();
    },
    enabled: !!address,
  });

  const isHolder = status?.isHolder ?? false;
  const hasAccess = status?.hasAccess ?? false;
  const remainingFreeQueries = status?.remainingFreeQueries ?? 0;

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/travel-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, walletAddress: address }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      // Refresh status to update remaining queries
      queryClient.invalidateQueries({ queryKey: ["/api/travel-ai/status", address] });
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: error.message || "Sorry, an error occurred. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(inputValue.trim());
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Shared wrapper for all states - viewport locked, no page scroll
  const FixedWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col bg-black text-white overflow-hidden h-[calc(100dvh-80px)]">
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden px-4">
        {children}
      </div>
    </div>
  );

  // Not connected state
  if (!isConnected) {
    return (
      <FixedWrapper>
        <Lock className="h-16 w-16 text-gray-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2 text-center">Wallet Connection Required</h1>
        <p className="text-gray-400 max-w-md text-center">
          Please connect your wallet to use the Travel AI feature.
        </p>
      </FixedWrapper>
    );
  }

  // Checking status
  if (isCheckingStatus) {
    return (
      <FixedWrapper>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-400">Checking access...</p>
      </FixedWrapper>
    );
  }

  // No access - free queries exhausted and not a holder
  if (!hasAccess) {
    return (
      <FixedWrapper>
        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-6 rounded-full mb-6">
          <Sparkles className="h-16 w-16 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center">Free Queries Used</h1>
        <p className="text-gray-400 max-w-md mb-6 text-center">
          You've used all 3 free queries. Mint a TravelMint NFT to unlock unlimited access 
          to your personal AI travel assistant.
        </p>
        <Button 
          onClick={() => window.location.href = "/mint"}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          data-testid="button-mint-nft"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Mint NFT
        </Button>
      </FixedWrapper>
    );
  }

  return (
    <div className="flex flex-col bg-black text-white overflow-hidden h-[calc(100dvh-80px)]">
      <div className="mx-auto flex flex-col w-full max-w-4xl px-4 py-3 gap-3 min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Travel AI</h1>
              <p className="text-xs text-gray-400">Your personal travel assistant</p>
            </div>
          </div>
          
          {/* Query counter for non-holders */}
          {!isHolder && (
            <div className="bg-gray-800 px-3 py-1.5 rounded-full">
              <span className="text-xs text-gray-300">
                {remainingFreeQueries} free {remainingFreeQueries === 1 ? 'query' : 'queries'} left
              </span>
            </div>
          )}
          
          {/* Holder badge */}
          {isHolder && (
            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-3 py-1.5 rounded-full border border-purple-500/30">
              <span className="text-xs text-purple-300">Unlimited Access</span>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <Card className="bg-gray-900 border-gray-800 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-4">
                <Sparkles className="h-10 w-10 text-purple-400 mb-3" />
                <h2 className="text-base font-semibold mb-2">Hello! 👋</h2>
                <p className="text-gray-400 text-sm max-w-sm">
                  I'm Travel AI, your personal travel assistant. Tell me about the city you want to visit, 
                  and I'll recommend the best places, cafes, and restaurants.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        message.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-100"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-2xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                        <span className="text-sm text-gray-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-800 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about a city or travel tip..."
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-10"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || chatMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 h-10 w-10 p-0"
                data-testid="button-send-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
