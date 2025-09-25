import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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

// Helper function: Check if SDK feature is available
const isSDKFeatureAvailable = (sdk: any, feature: string): boolean => {
  return typeof sdk[feature] !== 'undefined';
};

// Helper function: Get target URL
const getTargetUrl = (): string | undefined => {
  return typeof window !== 'undefined' ? window.location.origin : undefined;
};

export const useFarcasterNotifications = () => {
  const { toast } = useToast();

  // Get stored notification details from localStorage
  const getStoredNotificationDetails = (): NotificationDetails | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('farcaster_notification_details');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Failed to parse stored notification details:', error);
      return null;
    }
  };

  // Store notification details to localStorage and database
  const storeNotificationDetails = async (
    details: NotificationDetails,
    farcasterFid?: string,
    farcasterUsername?: string
  ): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('farcaster_notification_details', JSON.stringify(details));
      console.log('✅ Farcaster notification details stored to localStorage');

      if (farcasterFid) {
        const response = await fetch('/api/update-user-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            farcasterFid,
            notificationUrl: details.url,
            notificationToken: details.token,
            farcasterUsername,
          }),
        });

        if (response.ok) {
          console.log('✅ Farcaster notification details synced to database');
        } else {
          const errorData = await response.json();
          console.warn('⚠️ Failed to sync notification details to database:', response.status, errorData);
          toast({
            title: 'Database Sync Error',
            description: 'Failed to sync notification settings. Please try again.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to store notification details:', error);
      toast({
        title: 'Storage Error',
        description: 'Failed to save notification settings. Please try again.',
        variant: 'destructive',
      });
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
      // Show local toast notification
      toast({
        title,
        description: body,
        variant: type === 'error' ? 'destructive' : 'default',
      });

      const notificationDetails = getStoredNotificationDetails();
      if (!notificationDetails) {
        console.log('ℹ️ No Farcaster notification details available - user may not have enabled notifications');
        return;
      }

      const notificationPayload = {
        notificationId,
        title,
        body,
        targetUrl: getTargetUrl(),
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
        const errorData = await response.json();
        console.warn('⚠️ Farcaster notification failed:', response.status, errorData);
        toast({
          title: 'Notification Error',
          description: 'Failed to send notification. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ Failed to send Farcaster notification:', error);
      toast({
        title: 'Notification Error',
        description: 'Failed to send notification. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Prompt user to add frame and enable notifications
  const enableFarcasterNotifications = async (
    farcasterFid?: string,
    farcasterUsername?: string
  ): Promise<boolean> => {
    if (typeof window === 'undefined' || !isSDKFeatureAvailable(sdk, 'actions')) {
      console.log('ℹ️ Farcaster notifications not available in this environment');
      return false;
    }

    try {
      const existing = getStoredNotificationDetails();
      if (existing) {
        console.log('ℹ️ Farcaster notifications already enabled');
        if (farcasterFid) {
          await storeNotificationDetails(existing, farcasterFid, farcasterUsername);
        }
        return true;
      }

      // Check if context is available and get notification details
      if (isSDKFeatureAvailable(sdk, 'context')) {
        try {
          const context = await Promise.resolve(sdk.context);
          if (context?.client?.notificationDetails) {
            await storeNotificationDetails(context.client.notificationDetails, farcasterFid, farcasterUsername);
            return true;
          }
        } catch (error) {
          console.log('ℹ️ Could not get Farcaster context:', error);
        }
      }

      console.log('⏳ Prompting user to add frame for notifications...');
      await sdk.actions!.addFrame();
      console.log('✅ Frame addition requested');

      return new Promise((resolve) => {
        if (isSDKFeatureAvailable(sdk, 'on')) {
          const handler = async () => {
            try {
              const context = await Promise.resolve(sdk.context);
              if (context?.client?.notificationDetails) {
                await storeNotificationDetails(context.client.notificationDetails, farcasterFid, farcasterUsername);
                resolve(true);
              } else {
                console.log('ℹ️ No notification details available after frame addition');
                resolve(false);
              }
            } catch (error) {
              console.error('⚠️ Error handling context change:', error);
              resolve(false);
            }
          };

          (sdk as any).on('context-changed', handler);

          // Clean up listener after 10 seconds to prevent memory leaks
          setTimeout(() => {
            if (isSDKFeatureAvailable(sdk, 'off')) {
              (sdk as any).off('context-changed', handler);
            }
            resolve(false);
          }, 10000);
        } else {
          console.log('ℹ️ SDK does not support event listeners');
          resolve(false);
        }
      });
    } catch (error) {
      console.error('❌ Failed to enable Farcaster notifications:', error);
      toast({
        title: 'Notification Setup Failed',
        description: 'Could not enable notifications. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Clean up event listeners on component unmount
  useEffect(() => {
    return () => {
      if (isSDKFeatureAvailable(sdk, 'off') && isSDKFeatureAvailable(sdk, 'on')) {
        // Remove all listeners for 'context-changed' to prevent memory leaks
        (sdk as any).off('context-changed', () => {});
      }
    };
  }, []);

  // NFT Mint notification - English message as requested
  const sendNFTMintNotification = async (
    nftName: string,
    location: string,
    minterUsername?: string
  ): Promise<void> => {
    await sendNotification(
      `nft_mint_${uuidv4()}`,
      'New TravelMint NFT minted!',
      `"${nftName}" travel NFT was minted in ${location}${minterUsername ? ` by ${minterUsername}` : ''}!`,
      'success'
    );
  };

  // NFT Purchase notification - English message as requested
  const sendNFTPurchaseNotification = async (
    nftName: string,
    location: string,
    price: string,
    buyerUsername?: string
  ): Promise<void> => {
    await sendNotification(
      `nft_purchase_${uuidv4()}`,
      'TravelMint NFT sold',
      `"${nftName}" travel NFT from ${location} was sold for ${price} USDC${buyerUsername ? ` to ${buyerUsername}` : ''}!`,
      'success'
    );
  };

  // Quest reminder notification - English message as requested
  const sendQuestReminderNotification = async (): Promise<void> => {
    await sendNotification(
      `quest_reminder_${uuidv4()}`,
      '🎯 Complete your daily mint quest!',
      'Don\'t forget to mint a travel NFT today and earn rewards!',
      'info'
    );
  };

  return {
    sendNotification,
    sendNFTMintNotification,
    sendNFTPurchaseNotification,
    sendQuestReminderNotification,
    enableFarcasterNotifications,
    getStoredNotificationDetails,
  };
};