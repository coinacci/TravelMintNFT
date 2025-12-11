// Travel AI Service using Google Gemini 2.0 Flash
// Reference: blueprint:javascript_gemini

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const TRAVEL_SYSTEM_PROMPT = `You are TravelMint's travel assistant. You provide detailed and helpful information about cities, places to visit, cafes, restaurants, and tourist attractions.

Your tasks:
1. Provide information about the city or question the user asks
2. List important tourist spots, cafes, and restaurants  
3. Give a brief description for each recommendation
4. Provide local tips and advice
5. Always respond in English

Response format:
- Use emojis for section headers (🏛️ Historic Sites, ☕ Cafes, 🍽️ Restaurants, etc.)
- List each recommendation with bullet points
- Keep it concise but informative
- Add practical info like price ranges or best times to visit

Example response format:
🏛️ Historic Sites
• Sagrada Familia - Gaudí's legendary masterpiece, go early morning
• Park Güell - Colorful mosaics, amazing city views

☕ Cafes  
• Satan's Coffee Corner - Specialty coffee, hipster atmosphere
• Nomad Coffee - Barcelona's best coffee shop

🍽️ Restaurants
• Can Culleretes - Since 1786, traditional Catalan cuisine
• Bar Cañete - Tapas heaven, reservations required`;

export async function getTravelAdvice(userMessage: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: TRAVEL_SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Got it! I'm ready to help as your travel assistant. Which city or place would you like to know about?" }] },
        { role: "user", parts: [{ text: userMessage }] }
      ],
    });

    return response.text || "Sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}
