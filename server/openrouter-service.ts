import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";

// This is using Replit's AI Integrations service, which provides OpenRouter-compatible API access without requiring your own OpenRouter API key.
const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
});

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getTravelRecommendation(
  query: string,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = `You are a helpful travel assistant. Provide concise, practical travel advice and recommendations.
IMPORTANT: Always respond in the SAME LANGUAGE as the user's message. If they write in Turkish, respond in Turkish. If they write in English, respond in English.
When recommending places, use **bold** formatting for place names (e.g., **Hagia Sophia**, **Blue Mosque**).
Focus only on what the user asks - don't add extra categories unless requested.
Keep responses informative but concise (2-3 sentences per recommendation).
If user asks about a specific topic (like cafes, museums, etc.), only provide info about that topic.
Use the conversation history to maintain context - if user mentioned a city before, remember it.`;

  const messages: any[] = [
    { role: "system", content: systemPrompt }
  ];

  // Add chat history for context (last 8 messages)
  const recentHistory = chatHistory.slice(-8);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  }

  // Add current query
  messages.push({ role: "user", content: query });

  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openrouter.chat.completions.create({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages: messages,
            max_tokens: 1024,
            temperature: 0.7,
          });
          return completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 8000,
        factor: 2,
      }
    );
    
    return response;
  } catch (error: any) {
    console.error("OpenRouter API error:", error);
    if (isRateLimitError(error)) {
      throw new Error("AI service is temporarily busy. Please try again in a few moments.");
    }
    throw new Error("Failed to get travel recommendation. Please try again.");
  }
}
