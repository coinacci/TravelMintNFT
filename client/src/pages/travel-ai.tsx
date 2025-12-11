import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Lock } from "lucide-react";

interface WikiImage {
  name: string;
  title: string;
  thumbnailUrl: string | null;
  pageUrl: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: WikiImage[];
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
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

  // Lock body scroll when this page is active
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    const originalHtmlStyle = document.documentElement.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    return () => {
      document.body.style.overflow = originalStyle;
      document.documentElement.style.overflow = originalHtmlStyle;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

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

  // Chat mutation with conversation history for context
  const chatMutation = useMutation({
    mutationFn: async ({ message, history }: { message: string; history: Message[] }) => {
      // Format history for API (exclude current message, limit to last 8)
      const chatHistory = history.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const response = await fetch("/api/travel-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, walletAddress: address, chatHistory }),
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
        images: data.images || [],
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

    // Pass current messages as history before adding new user message
    const currentHistory = [...messages];
    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ message: inputValue.trim(), history: currentHistory });
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
    <div className="flex flex-col bg-black text-white overflow-hidden h-[calc(100dvh-80px)] pb-20" style={{ overscrollBehavior: 'none' }}>
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

  // No access - daily free queries exhausted and not a holder
  if (!hasAccess) {
    return (
      <FixedWrapper>
        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-4 rounded-full mb-4">
          <Sparkles className="h-12 w-12 text-purple-400" />
        </div>
        <h1 className="text-xl font-bold mb-2 text-center">Daily Limit Reached</h1>
        <p className="text-gray-400 max-w-sm mb-4 text-center text-sm">
          You've used your 3 free daily queries. Mint a TravelMint NFT for unlimited access, 
          or come back tomorrow for 3 more free queries!
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button 
            onClick={() => window.location.href = "/mint"}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 w-full"
            data-testid="button-mint-nft"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Mint NFT for Unlimited Access
          </Button>
          <p className="text-gray-500 text-xs text-center">
            Free queries reset daily at midnight UTC
          </p>
        </div>
      </FixedWrapper>
    );
  }

  return (
    <div className="flex flex-col bg-black text-white overflow-hidden h-[calc(100dvh-80px)] pb-20" style={{ overscrollBehavior: 'none' }}>
      <div className="mx-auto flex flex-col w-full max-w-4xl px-3 py-2 gap-2 min-h-0 flex-1 overflow-hidden">
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
        <Card className="bg-gray-900 border-gray-800 flex flex-col min-h-0 overflow-hidden max-h-[50vh]">
          <div className="flex-1 min-h-0 overflow-y-auto p-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-8">
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
                    className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        message.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-100"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
                      </p>
                    </div>
                    {/* Wikipedia images for places mentioned */}
                    {message.images && message.images.length > 0 && (
                      <div className="flex gap-2 mt-2 max-w-[85%] overflow-x-auto pb-1">
                        {message.images.map((img, idx) => (
                          img.thumbnailUrl && (
                            <a
                              key={idx}
                              href={img.pageUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 group"
                              data-testid={`link-wiki-image-${idx}`}
                            >
                              <div className="relative rounded-lg overflow-hidden w-20 h-20 bg-gray-700">
                                <img
                                  src={img.thumbnailUrl}
                                  alt={img.name}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                  loading="lazy"
                                  data-testid={`img-wiki-thumbnail-${idx}`}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                                  <p className="text-[10px] text-white truncate">{img.name}</p>
                                </div>
                              </div>
                            </a>
                          )
                        ))}
                      </div>
                    )}
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
