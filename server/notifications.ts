import { NeynarAPIClient } from '@neynar/nodejs-sdk';

// Initialize Neynar client
const neynarClient = new NeynarAPIClient({ 
  apiKey: process.env.NEYNAR_API_KEY!,
  basePath: "https://api.neynar.com"
});

export interface NotificationToken {
  fid: number;
  token: string;
  isActive: boolean;
}

export interface NotificationPreferences {
  fid: number;
  enablePurchaseNotifications: boolean;
  enableListingNotifications: boolean;
  enablePriceChangeNotifications: boolean;
  enableGeneralUpdates: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  target_url: string;
}

/**
 * Notification Service for TravelMint NFT Marketplace
 * Handles sending notifications to Farcaster users via Neynar API
 */
export class NotificationService {
  private client: NeynarAPIClient;

  constructor() {
    this.client = neynarClient;
  }

  /**
   * Filter users by notification preferences
   */
  private async filterByPreferences(fids: number[], notificationType: 'purchase' | 'listing' | 'price_change' | 'general'): Promise<number[]> {
    const { storage } = await import('./storage');
    const eligibleFids: number[] = [];

    for (const fid of fids) {
      try {
        const preferences = await storage.getNotificationPreferences(fid);
        if (!preferences) {
          // If no preferences found, assume user wants notifications (default behavior)
          eligibleFids.push(fid);
          continue;
        }

        // Check specific notification type preference (convert 1/0 to boolean)
        let isEnabled = false;
        switch (notificationType) {
          case 'purchase':
            isEnabled = preferences.enablePurchaseNotifications === 1;
            break;
          case 'listing':
            isEnabled = preferences.enableListingNotifications === 1;
            break;
          case 'price_change':
            isEnabled = preferences.enablePriceChangeNotifications === 1;
            break;
          case 'general':
            isEnabled = preferences.enableGeneralUpdates === 1;
            break;
        }

        if (isEnabled) {
          eligibleFids.push(fid);
        }
      } catch (error) {
        console.error(`Failed to check preferences for FID ${fid}:`, error);
        // If error checking preferences, include user (fail open)
        eligibleFids.push(fid);
      }
    }

    return eligibleFids;
  }

  /**
   * Get all users eligible for a specific notification type
   */
  private async getEligibleUsers(notificationType: 'purchase' | 'listing' | 'price_change' | 'general'): Promise<number[]> {
    const { storage } = await import('./storage');
    
    try {
      // Get all active notification tokens
      const { db } = await import('./db');
      const { notificationTokens, notificationPreferences } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const results = await db
        .select({
          fid: notificationTokens.fid,
          enablePurchaseNotifications: notificationPreferences.enablePurchaseNotifications,
          enableListingNotifications: notificationPreferences.enableListingNotifications,
          enablePriceChangeNotifications: notificationPreferences.enablePriceChangeNotifications,
          enableGeneralUpdates: notificationPreferences.enableGeneralUpdates
        })
        .from(notificationTokens)
        .leftJoin(notificationPreferences, eq(notificationTokens.fid, notificationPreferences.fid))
        .where(eq(notificationTokens.isActive, 1));

      const eligibleFids: number[] = [];
      
      for (const result of results) {
        // If no preferences found, assume user wants notifications (default behavior)
        if (!result.enablePurchaseNotifications && !result.enableListingNotifications && 
            !result.enablePriceChangeNotifications && !result.enableGeneralUpdates) {
          eligibleFids.push(result.fid);
          continue;
        }

        // Check specific notification type preference
        let isEnabled = false;
        switch (notificationType) {
          case 'purchase':
            isEnabled = result.enablePurchaseNotifications === 1;
            break;
          case 'listing':
            isEnabled = result.enableListingNotifications === 1;
            break;
          case 'price_change':
            isEnabled = result.enablePriceChangeNotifications === 1;
            break;
          case 'general':
            isEnabled = result.enableGeneralUpdates === 1;
            break;
        }

        if (isEnabled) {
          eligibleFids.push(result.fid);
        }
      }

      return eligibleFids;
    } catch (error) {
      console.error(`Failed to get eligible users for ${notificationType}:`, error);
      return []; // Fail closed on error
    }
  }

  /**
   * Send notification to specific users by FID
   */
  async sendNotificationToUsers(
    targetFids: number[],
    notification: NotificationPayload
  ) {
    try {
      console.log(`📱 Sending notification to ${targetFids.length} users:`, notification.title);
      
      const response = await this.client.publishFrameNotifications({
        targetFids,
        notification
      });

      console.log(`✅ Notification sent successfully to ${targetFids.length} users`);
      return response;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users with filters
   */
  async sendNotificationToAll(
    notification: NotificationPayload,
    filters?: {
      exclude_fids?: number[];
      following_fid?: number;
      minimum_user_score?: number;
      near_location?: {
        latitude: number;
        longitude: number;
        radius: number; // meters
      };
    }
  ) {
    try {
      console.log(`📱 Sending notification to all users:`, notification.title);
      
      const response = await this.client.publishFrameNotifications({
        targetFids: [], // Empty = all users
        filters,
        notification
      });

      console.log(`✅ Broadcast notification sent successfully`);
      return response;
    } catch (error) {
      console.error('❌ Failed to send broadcast notification:', error);
      throw error;
    }
  }

  /**
   * Send NFT purchase notification (respects user preferences)
   */
  async sendPurchaseNotification(
    buyerFid: number,
    sellerFid: number,
    nftTitle: string,
    price: string,
    nftId: string
  ) {
    const buyerNotification: NotificationPayload = {
      title: "🎉 Purchase Successful!",
      body: `You successfully purchased "${nftTitle}" for ${price} USDC`,
      target_url: `${process.env.APP_URL || 'https://your-app.replit.app'}/my-nfts`
    };

    const sellerNotification: NotificationPayload = {
      title: "💰 NFT Sold!",
      body: `Your "${nftTitle}" was sold for ${price} USDC`,
      target_url: `${process.env.APP_URL || 'https://your-app.replit.app'}/my-nfts`
    };

    // Check preferences before sending notifications
    const eligibleUsers = await this.filterByPreferences([buyerFid, sellerFid], 'purchase');
    
    // Send notifications only to users who opted in
    const notifications = [];
    if (eligibleUsers.includes(buyerFid)) {
      notifications.push(this.sendNotificationToUsers([buyerFid], buyerNotification));
    }
    if (eligibleUsers.includes(sellerFid)) {
      notifications.push(this.sendNotificationToUsers([sellerFid], sellerNotification));
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Send new listing notification (respects user preferences)
   */
  async sendNewListingNotification(
    nftTitle: string,
    price: string,
    location: string,
    nftId: string,
    excludeSellerFid?: number
  ) {
    const notification: NotificationPayload = {
      title: "🌍 New Travel NFT Listed!",
      body: `"${nftTitle}" from ${location} listed for ${price} USDC`,
      target_url: `${process.env.APP_URL || 'https://your-app.replit.app'}/marketplace`
    };

    // Get all users who opted in for listing notifications
    const eligibleFids = await this.getEligibleUsers('listing');
    const excludeList = excludeSellerFid ? [excludeSellerFid, ...eligibleFids.filter(fid => fid === excludeSellerFid)] : [];
    const targetFids = eligibleFids.filter(fid => !excludeList.includes(fid));

    if (targetFids.length > 0) {
      await this.sendNotificationToUsers(targetFids, notification);
    }
  }

  /**
   * Send price change notification (respects user preferences)
   */
  async sendPriceChangeNotification(
    nftTitle: string,
    oldPrice: string,
    newPrice: string,
    location: string,
    nftId: string,
    ownerFid: number
  ) {
    const notification: NotificationPayload = {
      title: "💸 Price Updated!",
      body: `"${nftTitle}" from ${location} price changed: ${oldPrice} → ${newPrice} USDC`,
      target_url: `${process.env.APP_URL || 'https://your-app.replit.app'}/marketplace`
    };

    // Get all users who opted in for price change notifications
    const eligibleFids = await this.getEligibleUsers('price_change');
    const targetFids = eligibleFids.filter(fid => fid !== ownerFid);

    if (targetFids.length > 0) {
      await this.sendNotificationToUsers(targetFids, notification);
    }
  }

  /**
   * Send welcome notification when user adds mini app
   */
  async sendWelcomeNotification(fid: number) {
    const notification: NotificationPayload = {
      title: "🌍 Welcome to TravelMint!",
      body: "Start exploring and collecting unique travel photo NFTs from around the world",
      target_url: `${process.env.APP_URL || 'https://your-app.replit.app'}/marketplace`
    };

    await this.sendNotificationToUsers([fid], notification);
  }

  /**
   * Send general platform updates (respects user preferences)
   */
  async sendPlatformUpdate(
    title: string,
    message: string,
    targetUrl?: string
  ) {
    const notification: NotificationPayload = {
      title,
      body: message,
      target_url: targetUrl || `${process.env.APP_URL || 'https://your-app.replit.app'}`
    };

    // Get all users who opted in for general updates
    const eligibleFids = await this.getEligibleUsers('general');

    if (eligibleFids.length > 0) {
      await this.sendNotificationToUsers(eligibleFids, notification);
    }
  }

  /**
   * Send location-based notification
   */
  async sendLocationBasedNotification(
    title: string,
    message: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    targetUrl?: string
  ) {
    const notification: NotificationPayload = {
      title,
      body: message,
      target_url: targetUrl || `${process.env.APP_URL || 'https://your-app.replit.app'}/marketplace`
    };

    const filters = {
      near_location: {
        latitude,
        longitude,
        radius: radiusKm * 1000 // Convert km to meters
      }
    };

    await this.sendNotificationToAll(notification, filters);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Helper function to check if notifications are enabled
export function isNotificationsEnabled(): boolean {
  return !!process.env.NEYNAR_API_KEY;
}

// Helper function for safe notification sending (won't throw if service is unavailable)
export async function sendNotificationSafely(
  notificationFn: () => Promise<any>
): Promise<boolean> {
  if (!isNotificationsEnabled()) {
    console.log('⚠️ Notifications disabled - NEYNAR_API_KEY not found');
    return false;
  }

  try {
    await notificationFn();
    return true;
  } catch (error) {
    console.error('⚠️ Notification failed but continuing:', error);
    return false;
  }
}