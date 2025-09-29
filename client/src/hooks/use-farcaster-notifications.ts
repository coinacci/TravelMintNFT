import { useState, useEffect, useCallback } from 'react';
import sdk from '@farcaster/frame-sdk';
import { useToast } from "@/hooks/use-toast";

interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface NotificationTokenData {
  token: string;
  enabled: boolean;
  userId: string;
}

export function useFarcasterNotifications() {
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);
  const [notificationToken, setNotificationToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isCollectingToken, setIsCollectingToken] = useState(false);
  const { toast } = useToast();

  // Get Farcaster user context (similar to existing pattern)
  const getFarcasterContext = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && sdk?.context) {
        const context = await Promise.resolve(sdk.context);
        if (context?.user) {
          setFarcasterUser({
            fid: context.user.fid,
            username: context.user.username || `user-${context.user.fid}`,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl
          });
          console.log('✅ Farcaster user detected for notifications:', context.user.username || context.user.fid);
          return context.user;
        }
      }
    } catch (error) {
      console.log('ℹ️ No Farcaster context available for notifications');
    }
    return null;
  }, []);

  // Collect notification token from Farcaster SDK
  const collectNotificationToken = useCallback(async (user: FarcasterUser) => {
    if (isCollectingToken) return;
    
    setIsCollectingToken(true);
    
    try {
      console.log('📱 Attempting to collect notification token...');
      
      // The Farcaster SDK doesn't have direct getNotificationToken method
      // Instead, we need to use the addFrame approach with notifications enabled
      
      // CORRECT IMPLEMENTATION: Use proper Farcaster Mini App notification flow
      if (typeof window !== 'undefined' && sdk?.context) {
        console.log('📱 Checking Farcaster Mini App notification status...');
        
        try {
          const context = await Promise.resolve(sdk.context);
          
          // Check if user has added the Mini App (required for notifications)
          if (context?.client?.added) {
            console.log('✅ Mini App is added to user\'s Farcaster client');
            
            // Check if notification details are available
            if (context.client.notificationDetails) {
              const { token, url } = context.client.notificationDetails;
              
              if (token && url) {
                console.log('✅ Real notification token found in Farcaster context');
                setNotificationToken(token);
                
                // Store real token in database
                await storeNotificationToken(user.fid.toString(), token);
                
                toast({
                  title: "Notifications Enabled!",
                  description: "Farcaster notifications are now active.",
                });
                
                return token;
              } else {
                console.log('ℹ️ Mini App added but notification details not available yet');
              }
            } else {
              console.log('ℹ️ Mini App added but notifications not enabled');
            }
          } else {
            // User hasn't added the Mini App yet - this is required for notifications
            console.log('ℹ️ Mini App not added - user needs to add it to enable notifications');
            
            // Show helpful message about adding the Mini App
            toast({
              title: "Add Mini App for Notifications",
              description: "Add TravelMint to your Farcaster client to enable notifications.",
            });
          }
          
        } catch (error: any) {
          console.error('❌ Error checking Farcaster notification status:', error);
        }
      }
      
      console.log('ℹ️ No notification token available from Farcaster SDK');
      
    } catch (error: any) {
      console.error('❌ Failed to collect notification token:', error);
      
      // Don't show error toast for normal cases (user declines, etc.)
      if (error.message && !error.message.includes('User declined')) {
        toast({
          title: "Notification Setup Failed",
          description: "Could not enable notifications. You can try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsCollectingToken(false);
    }
    
    return null;
  }, [isCollectingToken, toast]);

  // Store notification token in database
  const storeNotificationToken = useCallback(async (farcasterFid: string, token: string) => {
    try {
      const response = await fetch('/api/user-stats/notification-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          farcasterFid,
          notificationToken: token,
          notificationsEnabled: true
        }),
      });

      if (response.ok) {
        setNotificationsEnabled(true);
        console.log('✅ Notification token stored in database');
      } else {
        console.error('❌ Failed to store notification token:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error storing notification token:', error);
    }
  }, []);

  // Auto-collect notification token when user connects
  useEffect(() => {
    const initializeNotifications = async () => {
      const user = await getFarcasterContext();
      
      if (user && !notificationToken && !isCollectingToken) {
        // Small delay to ensure SDK is fully ready
        setTimeout(() => {
          collectNotificationToken(user);
        }, 1000);
      }
    };

    initializeNotifications();
  }, [getFarcasterContext, collectNotificationToken, notificationToken, isCollectingToken]);

  // Manual notification enablement (for components that want explicit control)
  const enableNotifications = useCallback(async () => {
    const user = await getFarcasterContext();
    if (user) {
      return await collectNotificationToken(user);
    }
    return null;
  }, [getFarcasterContext, collectNotificationToken]);

  // Check if notifications are supported
  const isNotificationSupported = useCallback(() => {
    return typeof window !== 'undefined' && 
           sdk?.actions?.addFrame;
  }, []);

  return {
    farcasterUser,
    notificationToken,
    notificationsEnabled,
    isCollectingToken,
    enableNotifications,
    isNotificationSupported: isNotificationSupported(),
    storeNotificationToken
  };
}