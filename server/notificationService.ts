import { storage } from "./storage";
import { v4 as uuidv4 } from 'uuid';

export interface NotificationPayload {
  notificationId: string;
  title: string;
  body: string;
  targetUrl?: string;
}

export class NotificationService {
  private static getTargetUrl(): string {
    // Use environment variable or default to localhost for development
    return process.env.REPLIT_DOMAINS || 'http://localhost:5000';
  }

  // Send notification to a specific user by their stored notification details
  private static async sendToUser(
    notificationUrl: string,
    notificationToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const response = await fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notificationToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('✅ Farcaster notification sent successfully:', payload.title);
        return true;
      } else {
        const errorData = await response.json();
        console.warn('⚠️ Farcaster notification failed:', response.status, errorData);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send Farcaster notification:', error);
      return false;
    }
  }

  // Send notification to all users with notifications enabled
  public static async sendToAllUsers(
    title: string,
    body: string
  ): Promise<{ sent: number; failed: number }> {
    try {
      const users = await storage.getUsersWithNotificationsEnabled();
      console.log(`📢 Sending notification to ${users.length} users with notifications enabled`);

      const payload: NotificationPayload = {
        notificationId: uuidv4(),
        title,
        body,
        targetUrl: this.getTargetUrl(),
      };

      let sent = 0;
      let failed = 0;

      // Send notifications to all users in parallel
      const promises = users.map(async (user) => {
        if (user.notificationUrl && user.notificationToken) {
          const success = await this.sendToUser(
            user.notificationUrl,
            user.notificationToken,
            payload
          );
          
          if (success) {
            sent++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      });

      await Promise.all(promises);

      console.log(`📊 Notification summary: ${sent} sent, ${failed} failed`);
      
      return { sent, failed };
    } catch (error) {
      console.error('❌ Failed to send notifications to all users:', error);
      return { sent: 0, failed: 0 };
    }
  }

  // NFT Mint notification - English message as requested
  public static async sendNFTMintNotification(
    nftName: string,
    location: string,
    minterUsername?: string
  ): Promise<{ sent: number; failed: number }> {
    const title = 'New TravelMint NFT minted!';
    const body = `"${nftName}" travel NFT was minted in ${location}${minterUsername ? ` by ${minterUsername}` : ''}!`;
    
    console.log(`🎨 Sending NFT mint notification: ${title}`);
    return await this.sendToAllUsers(title, body);
  }

  // NFT Purchase notification - English message as requested
  public static async sendNFTPurchaseNotification(
    nftName: string,
    location: string,
    price: string,
    buyerUsername?: string
  ): Promise<{ sent: number; failed: number }> {
    const title = 'TravelMint NFT sold';
    const body = `"${nftName}" travel NFT from ${location} was sold for ${price} USDC${buyerUsername ? ` to ${buyerUsername}` : ''}!`;
    
    console.log(`💰 Sending NFT purchase notification: ${title}`);
    return await this.sendToAllUsers(title, body);
  }

  // Quest reminder notification - English message as requested
  public static async sendQuestReminderNotification(): Promise<{ sent: number; failed: number }> {
    const title = '🎯 Complete your daily mint quest!';
    const body = 'Don\'t forget to mint a travel NFT today and earn rewards!';
    
    console.log(`🎯 Sending quest reminder notification: ${title}`);
    return await this.sendToAllUsers(title, body);
  }
}