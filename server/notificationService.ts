import { z } from "zod";

// Farcaster notification schemas adapted from the example
const sendNotificationRequestSchema = z.object({
  notificationId: z.string(),
  title: z.string(),
  body: z.string(),
  targetUrl: z.string().optional(),
  tokens: z.array(z.string()),
});

const sendNotificationResponseSchema = z.object({
  result: z.object({
    successfulTokens: z.array(z.string()),
    rateLimitedTokens: z.array(z.string()),
    invalidTokens: z.array(z.string()),
  }),
});

export type SendNotificationRequest = z.infer<typeof sendNotificationRequestSchema>;
export type SendNotificationResponse = z.infer<typeof sendNotificationResponseSchema>;

export class NotificationService {
  private readonly neynarApiUrl = "https://api.neynar.com/v2/farcaster/notifications/send";
  
  constructor(private readonly apiKey: string) {}

  /**
   * Send notification to multiple Farcaster users
   */
  async sendNotification(params: {
    title: string;
    message: string;
    tokens: string[];
    targetUrl?: string;
  }): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    rateLimitedCount: number;
    errors?: string[];
  }> {
    try {
      const notificationRequest: SendNotificationRequest = {
        notificationId: crypto.randomUUID(),
        title: params.title,
        body: params.message,
        targetUrl: params.targetUrl || "https://travelmint.replit.app",
        tokens: params.tokens,
      };

      console.log(`📱 Sending notification to ${params.tokens.length} users:`, {
        title: params.title,
        message: params.message,
        tokenCount: params.tokens.length,
      });

      const response = await fetch(this.neynarApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify(notificationRequest),
      });

      const responseJson = await response.json();

      if (response.status === 200) {
        // Validate response format
        const parsedResponse = sendNotificationResponseSchema.safeParse(responseJson);
        
        if (!parsedResponse.success) {
          console.error("❌ Invalid notification response format:", parsedResponse.error);
          return {
            success: false,
            successCount: 0,
            failureCount: params.tokens.length,
            rateLimitedCount: 0,
            errors: ["Invalid response format from notification service"],
          };
        }

        const result = parsedResponse.data.result;
        const successCount = result.successfulTokens.length;
        const rateLimitedCount = result.rateLimitedTokens.length;
        const invalidCount = result.invalidTokens.length;
        const failureCount = rateLimitedCount + invalidCount;

        console.log(`✅ Notification sent - Success: ${successCount}, Failed: ${failureCount}, Rate Limited: ${rateLimitedCount}`);

        return {
          success: successCount > 0,
          successCount,
          failureCount,
          rateLimitedCount,
          errors: failureCount > 0 ? [`${rateLimitedCount} rate limited, ${invalidCount} invalid tokens`] : undefined,
        };
      } else {
        console.error(`❌ Notification API error (${response.status}):`, responseJson);
        
        return {
          success: false,
          successCount: 0,
          failureCount: params.tokens.length,
          rateLimitedCount: 0,
          errors: [responseJson.message || `API error: ${response.status}`],
        };
      }
    } catch (error: any) {
      console.error("❌ Notification service error:", error);
      
      return {
        success: false,
        successCount: 0,
        failureCount: params.tokens.length,
        rateLimitedCount: 0,
        errors: [error.message || "Unknown notification error"],
      };
    }
  }

  /**
   * Test notification service connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use a simple API endpoint to test the API key validity
      const testUrl = "https://api.neynar.com/v2/farcaster/user/bulk?fids=1&viewer_fid=1";
      const testResponse = await fetch(testUrl, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "x-api-key": this.apiKey,
        },
      });

      console.log(`🔑 Notification service connection test: ${testResponse.status}`);
      
      // Valid API key should return 200
      if (testResponse.status === 200) {
        console.log("✅ Neynar API connection successful");
        return true;
      } else {
        const errorText = await testResponse.text();
        console.error(`❌ Neynar API connection failed (${testResponse.status}):`, errorText);
        return false;
      }
    } catch (error) {
      console.error("🔑 Notification service connection test failed:", error);
      return false;
    }
  }
}

// Export singleton instance - will be initialized when NEYNAR_API_KEY is available
let notificationService: NotificationService | null = null;

export function getNotificationService(): NotificationService | null {
  if (!notificationService && process.env.NEYNAR_API_KEY) {
    notificationService = new NotificationService(process.env.NEYNAR_API_KEY);
    console.log("📱 Notification service initialized");
  }
  
  return notificationService;
}

export function isNotificationServiceAvailable(): boolean {
  return !!process.env.NEYNAR_API_KEY;
}