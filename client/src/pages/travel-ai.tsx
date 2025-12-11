import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Lock, MapPin, Coffee, Utensils, Landmark } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function TravelAI() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if user is a holder
  const { data: holderStatus, isLoading: isCheckingHolder } = useQuery<{ isHolder: boolean }>({
    queryKey: ["/api/holder-status", address],
    queryFn: async () => {
      const response = await fetch(`/api/holder-status/${address}`);
      if (!response.ok) throw new Error("Failed to check holder status");
      return response.json();
    },
    enabled: !!address,
  });

  const isHolder = holderStatus?.isHolder ?? false;

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
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
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

  // Quick suggestions
  const suggestions = [
    { icon: Landmark, text: "Barcelona'da görülmesi gereken yerler" },
    { icon: Coffee, text: "Paris'te en iyi kafeler" },
    { icon: Utensils, text: "Tokyo'da yemek önerileri" },
    { icon: MapPin, text: "İstanbul gezi rehberi" },
  ];

  const handleSuggestionClick = (text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white pb-32">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Lock className="h-16 w-16 text-gray-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Cüzdan Bağlantısı Gerekli</h1>
            <p className="text-gray-400 max-w-md">
              Travel AI özelliğini kullanmak için lütfen cüzdanınızı bağlayın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Checking holder status
  if (isCheckingHolder) {
    return (
      <div className="min-h-screen bg-black text-white pb-32">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-gray-400">Holder durumu kontrol ediliyor...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not a holder state
  if (!isHolder) {
    return (
      <div className="min-h-screen bg-black text-white pb-32">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-6 rounded-full mb-6">
              <Sparkles className="h-16 w-16 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Holder Exclusive</h1>
            <p className="text-gray-400 max-w-md mb-6">
              Travel AI, TravelMint NFT sahiplerine özel bir özelliktir. 
              Kişiselleştirilmiş seyahat önerileri almak için bir NFT mint edin.
            </p>
            <Button 
              onClick={() => window.location.href = "/mint"}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              data-testid="button-mint-nft"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              NFT Mint Et
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Travel AI</h1>
            <p className="text-xs text-gray-400">Kişisel seyahat asistanınız</p>
          </div>
        </div>

        {/* Chat Area */}
        <Card className="bg-gray-900 border-gray-800 h-[calc(100vh-280px)] flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Sparkles className="h-12 w-12 text-purple-400 mb-4" />
                <h2 className="text-lg font-semibold mb-2">Merhaba! 👋</h2>
                <p className="text-gray-400 text-sm mb-6 max-w-sm">
                  Ben Travel AI, seyahat asistanınızım. Gitmek istediğiniz şehri söyleyin, 
                  size en iyi mekanları, kafeleri ve restoranları önereyim.
                </p>
                
                {/* Suggestions */}
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                  {suggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.text)}
                        className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
                        data-testid={`suggestion-${index}`}
                      >
                        <Icon className="h-5 w-5 text-purple-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{suggestion.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
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
                    <div className="bg-gray-800 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                        <span className="text-sm text-gray-400">Düşünüyorum...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Bir şehir veya soru yazın..."
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || chatMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
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
