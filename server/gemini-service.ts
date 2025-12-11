// Travel AI Service using Google Gemini 1.5 Flash
// Reference: blueprint:javascript_gemini

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const TRAVEL_SYSTEM_PROMPT = `Sen TravelMint'in seyahat asistanısın. Kullanıcılara şehirler, gezilecek yerler, kafeler, restoranlar ve turistik mekanlar hakkında detaylı ve faydalı bilgiler veriyorsun.

Görevin:
1. Kullanıcının gitmek istediği şehir veya sorduğu soru hakkında bilgi ver
2. Önemli turistik yerleri, kafeleri ve restoranları listele
3. Her öneri için kısa bir açıklama yap
4. Yerel ipuçları ve tavsiyeler ver
5. Yanıtlarını Türkçe ver (kullanıcı farklı bir dilde yazarsa o dilde yanıt ver)

Yanıt formatı:
- Başlıkları emoji ile süsle (🏛️ Tarihi Yerler, ☕ Kafeler, 🍽️ Restoranlar vb.)
- Her öneriyi madde işareti ile listele
- Kısa ve öz tut, ama faydalı bilgi ver
- Fiyat aralıkları veya en iyi ziyaret zamanları gibi pratik bilgiler ekle

Örnek yanıt formatı:
🏛️ Tarihi Yerler
• Sagrada Familia - Gaudí'nin efsanevi eseri, sabah erken gidin
• Park Güell - Renkli mozaikler, şehir manzarası muhteşem

☕ Kafeler  
• Satan's Coffee Corner - Specialty coffee, hipster atmosfer
• Nomad Coffee - Barselona'nın en iyi kahvecisi

🍽️ Restoranlar
• Can Culleretes - 1786'dan beri, geleneksel Katalan mutfağı
• Bar Cañete - Tapas cenneti, rezervasyon şart`;

export async function getTravelAdvice(userMessage: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { role: "user", parts: [{ text: TRAVEL_SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Anladım! Seyahat asistanı olarak yardımcı olmaya hazırım. Hangi şehir veya yer hakkında bilgi almak istersiniz?" }] },
        { role: "user", parts: [{ text: userMessage }] }
      ],
    });

    return response.text || "Üzgünüm, şu anda yanıt oluşturamıyorum. Lütfen tekrar deneyin.";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}
