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

  // Store notification details to localStorage
  const storeNotificationDetails = (details: NotificationDetails): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('farcaster_notification_details', JSON.stringify(details));
      console.log('✅ Farcaster notification details stored');
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
  const enableFarcasterNotifications = async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && sdk?.actions) {
        // Check if user already has notification details stored
        const existing = getStoredNotificationDetails();
        if (existing) {
          console.log('ℹ️ Farcaster notifications already enabled');
          return true;
        }

        // Try to get from current context first
        if (sdk.context && typeof sdk.context === 'object') {
          const context = await Promise.resolve(sdk.context);
          if (context?.client?.notificationDetails) {
            storeNotificationDetails(context.client.notificationDetails);
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
    const minterText = minterUsername ? ` ${minterUsername} tarafından` : '';
    await sendNotification(
      `nft_mint_${Date.now()}`,
      '🎨 Yeni NFT Mintlendi!',
      `"${nftName}" travel NFT'i ${location} lokasyonunda${minterText} mintlendi!`,
      'success'
    );
  };

  // NFT Purchase notification (when others purchase)
  const sendNFTPurchaseNotification = async (nftName: string, location: string, price: string, buyerUsername?: string): Promise<void> => {
    const buyerText = buyerUsername ? ` ${buyerUsername} tarafından` : '';
    await sendNotification(
      `nft_purchase_${Date.now()}`,
      '💰 NFT Satıldı!',
      `${location} lokasyonundan "${nftName}" travel NFT'i ${price} USDC'ye${buyerText} satın alındı!`,
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