import { z } from "zod";

// Farcaster notification schemas - updated for correct Neynar API
const sendNotificationRequestSchema = z.object({
  target_fids: z.array(z.number()),
  notification: z.object({
    title: z.string(),
    body: z.string(),
    target_url: z.string(),
    uuid: z.string(),
  }),
});

const sendNotificationResponseSchema = z.object({
  notification_deliveries: z.array(z.object({
    object: z.string(),
    fid: z.number(),
    status: z.string(),
  })),
});

export type SendNotificationRequest = z.infer<typeof sendNotificationRequestSchema>;
export type SendNotificationResponse = z.infer<typeof sendNotificationResponseSchema>;

export class NotificationService {
  private readonly neynarApiUrl = "https://api.neynar.com/v2/farcaster/frame/notifications";
  
  constructor(private readonly apiKey: string) {}

  /**
   * Send notification to multiple Farcaster users by FID
   */
  async sendNotification(params: {
    title: string;
    message: string;
    fids: number[];
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
        target_fids: params.fids,
        notification: {
          title: params.title,
          body: params.message,
          target_url: params.targetUrl || "https://travelmint.replit.app",
          uuid: crypto.randomUUID(),
        },
      };

      console.log(`📱 Sending notification to ${params.fids.length} users:`, {
        title: params.title,
        message: params.message,
        fids: params.fids,
      });

      // DEBUG: Also try with empty array to target all enabled users
      console.log(`🔄 Also testing with empty FID array for broader reach...`);

      const response = await fetch(this.neynarApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(notificationRequest),
      });

      const responseJson = await response.json();
      
      // DEBUG: Log full API response to understand format
      console.log(`🔍 Neynar API Response (Status: ${response.status}):`, JSON.stringify(responseJson, null, 2));

      if (response.status === 200) {
        // Validate response format
        const parsedResponse = sendNotificationResponseSchema.safeParse(responseJson);
        
        if (!parsedResponse.success) {
          console.error("❌ Invalid notification response format - Expected:", sendNotificationResponseSchema);
          console.error("❌ Actual response:", responseJson);
          console.error("❌ Parsing errors:", parsedResponse.error);
          
          // Try to work with actual response format
          if (responseJson && responseJson.notification_deliveries) {
            console.log("🔄 Attempting to work with actual response format...");
            const deliveries = responseJson.notification_deliveries;
            const successCount = Array.isArray(deliveries) ? deliveries.filter(d => d.status === 'success').length : 0;
            const failureCount = Array.isArray(deliveries) ? deliveries.filter(d => d.status !== 'success').length : 0;
            
            console.log(`✅ Notification sent (raw format) - Success: ${successCount}, Failed: ${failureCount}`);
            
            return {
              success: successCount > 0,
              successCount,
              failureCount,
              rateLimitedCount: 0,
              errors: failureCount > 0 ? [`${failureCount} deliveries failed`] : undefined,
            };
          }
          
          return {
            success: false,
            successCount: 0,
            failureCount: params.fids.length,
            rateLimitedCount: 0,
            errors: ["Invalid response format from notification service"],
          };
        }

        const deliveries = parsedResponse.data.notification_deliveries;
        const successCount = deliveries.filter(d => d.status === 'success').length;
        const failureCount = deliveries.filter(d => d.status !== 'success').length;

        console.log(`✅ Notification sent - Success: ${successCount}, Failed: ${failureCount}`);

        return {
          success: successCount > 0,
          successCount,
          failureCount,
          rateLimitedCount: 0, // Rate limiting info not provided in new API
          errors: failureCount > 0 ? [`${failureCount} deliveries failed`] : undefined,
        };
      } else {
        console.error(`❌ Notification API error (${response.status}):`, responseJson);
        
        return {
          success: false,
          successCount: 0,
          failureCount: params.fids.length,
          rateLimitedCount: 0,
          errors: [responseJson.message || `API error: ${response.status}`],
        };
      }
    } catch (error: any) {
      console.error("❌ Notification service error:", error);
      
      return {
        success: false,
        successCount: 0,
        failureCount: params.fids.length,
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