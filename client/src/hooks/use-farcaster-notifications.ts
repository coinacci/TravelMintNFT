import { useToast } from "@/hooks/use-toast";
import sdk from "@farcaster/frame-sdk";

// Farcaster Notification Context Type
export type MiniAppLocationNotificationContext = {
  type: 'notification';
  notification: {
    notificationId: string;
    title: string;
    body: string;
  };
};

// Notification details from Farcaster SDK
export type NotificationDetails = {
  url: string;
  token: string;
};

export const useFarcasterNotifications = () => {
  const { toast } = useToast();

  // Get stored notification details from localStorage
  const getStoredNotificationDetails = (): NotificationDetails | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('farcaster_notification_details');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  // Store notification details to localStorage and database
  const storeNotificationDetails = async (details: NotificationDetails, farcasterFid?: string, farcasterUsername?: string): Promise<void> => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('farcaster_notification_details', JSON.stringify(details));
      console.log('✅ Farcaster notification details stored to localStorage');

      // Also save to database for server-side quest reminders
      if (farcasterFid) {
        try {
          const response = await fetch('/api/update-user-notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              farcasterFid,
              notificationUrl: details.url,
              notificationToken: details.token,
              farcasterUsername
            }),
          });

          if (response.ok) {
            console.log('✅ Farcaster notification details synced to database');
          } else {
            console.warn('⚠️ Failed to sync notification details to database:', response.status);
          }
        } catch (error) {
          console.error('❌ Failed to sync notification details to database:', error);
        }
      }
    }
  };

  // Send Farcaster notification via HTTP API + local toast
  const sendNotification = async (
    notificationId: string,
    title: string,
    body: string,
    type: 'success' | 'info' | 'error' = 'success'
  ): Promise<void> => {
    try {
      // Always show local toast notification
      toast({
        title,
        description: body,
        variant: type === 'error' ? 'destructive' : 'default',
      });

      // Try to send Farcaster notification if user has enabled notifications
      const notificationDetails = getStoredNotificationDetails();
      
      if (notificationDetails) {
        const notificationPayload = {
          notificationId,
          title,
          body,
          targetUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        };

        const response = await fetch(notificationDetails.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${notificationDetails.token}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        if (response.ok) {
          console.log('✅ Farcaster notification sent:', title);
        } else {
          console.warn('⚠️ Farcaster notification failed:', response.status);
        }
      } else {
        console.log('ℹ️ No Farcaster notification details available - user may not have enabled notifications');
      }
    } catch (error) {
      console.error('❌ Failed to send Farcaster notification:', error);
      // Notification failure shouldn't break the app flow
    }
  };

  // Prompt user to add frame and enable notifications
  const enableFarcasterNotifications = async (farcasterFid?: string, farcasterUsername?: string): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && sdk?.actions) {
        // Check if user already has notification details stored
        const existing = getStoredNotificationDetails();
        if (existing) {
          console.log('ℹ️ Farcaster notifications already enabled');
          // Still sync to database if user details provided
          if (farcasterFid) {
            await storeNotificationDetails(existing, farcasterFid, farcasterUsername);
          }
          return true;
        }

        // Try to get from current context first
        if (sdk.context && typeof sdk.context === 'object') {
          const context = await Promise.resolve(sdk.context);
          if (context?.client?.notificationDetails) {
            await storeNotificationDetails(context.client.notificationDetails, farcasterFid, farcasterUsername);
            return true;
          }
        }

        // If not available, prompt user to add frame
        await sdk.actions.addFrame();
        return false; // User needs to add frame, notifications will be enabled via webhook/event
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to enable Farcaster notifications:', error);
      return false;
    }
  };

  // NFT Mint notification (when others mint)
  const sendNFTMintNotification = async (nftName: string, location: string, minterUsername?: string): Promise<void> => {
    const minterText = minterUsername ? ` by ${minterUsername}` : '';
    await sendNotification(
      `nft_mint_${Date.now()}`,
      '🎨 New NFT Minted!',
      `"${nftName}" travel NFT was minted in ${location}${minterText}!`,
      'success'
    );
  };

  // NFT Purchase notification (when others purchase)
  const sendNFTPurchaseNotification = async (nftName: string, location: string, price: string, buyerUsername?: string): Promise<void> => {
    const buyerText = buyerUsername ? ` by ${buyerUsername}` : '';
    await sendNotification(
      `nft_purchase_${Date.now()}`,
      '💰 NFT Sold!',
      `"${nftName}" travel NFT from ${location} was purchased for ${price} USDC${buyerText}!`,
      'success'
    );
  };



  return {
    sendNotification,
    sendNFTMintNotification,
    sendNFTPurchaseNotification,
    enableFarcasterNotifications,
    getStoredNotificationDetails,
  };
};