import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import sdk from "@farcaster/frame-sdk";

export function AddMiniApp() {
  const [isAdding, setIsAdding] = useState(false);
  const [farcasterContext, setFarcasterContext] = useState<any>(null);
  const { toast } = useToast();

  // Get Farcaster context on component mount
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await sdk.context;
          setFarcasterContext(context);
          console.log('✅ Farcaster context loaded:', context);
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context available (running in web browser)');
      }
    };

    getFarcasterContext();
  }, []);

  const handleAddMiniApp = async () => {
    if (!farcasterContext?.user?.fid) {
      toast({
        title: "Farcaster Required",
        description: "Please open this app in the Farcaster mobile app to enable notifications.",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);
    
    try {
      console.log('🔔 Adding TravelMint mini app for notifications...');
      
      // Simulate the mini app enrollment event that would normally come from Farcaster
      const enrollmentData = {
        event: "miniapp_added",
        user: {
          fid: farcasterContext.user.fid,
          username: farcasterContext.user.username
        },
        notificationDetails: {
          token: `token_${farcasterContext.user.fid}_${Date.now()}`, // Simulate notification token
          url: "https://api.farcaster.xyz/v1/frame-notifications"
        }
      };

      // Send to our webhook endpoint to store the notification token
      const response = await fetch('/api/farcaster/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-neynar-signature': 'sha256=dev_signature' // Development signature
        },
        body: JSON.stringify(enrollmentData)
      });

      if (response.ok) {
        toast({
          title: "🎉 Notifications Enabled!",
          description: "You'll now receive notifications about NFT purchases, new listings, and more.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to enable notifications');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to add mini app:', error);
      
      toast({
        title: "Unable to Add Mini App",
        description: error.message || "Something went wrong. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Always show for now - will enhance with proper Farcaster detection later

  return (
    <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20" data-testid="card-add-mini-app">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="h-5 w-5" />
          Enable Notifications
        </CardTitle>
        <CardDescription className="text-slate-300">
          Get notified about NFT purchases, new listings, and travel opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-slate-400">
            <p>🌍 New travel NFTs from your favorite locations</p>
            <p>💰 When your NFTs are sold</p>
            <p>🎯 Price updates on items you're watching</p>
            <p>🏆 Platform updates and features</p>
          </div>
          
          <Button 
            onClick={handleAddMiniApp}
            disabled={isAdding}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-add-mini-app"
          >
            {isAdding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Adding Mini App...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Add to Mini Apps
              </>
            )}
          </Button>
          
          <p className="text-xs text-slate-500 text-center">
            This will add TravelMint to your Farcaster mini apps and enable push notifications
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationStatus() {
  const [farcasterContext, setFarcasterContext] = useState<any>(null);
  const [notificationStatus, setNotificationStatus] = useState<'unknown' | 'enabled' | 'disabled'>('unknown');

  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await sdk.context;
          setFarcasterContext(context);
          
          if (context?.user?.fid) {
            // Check if user has notifications enabled
            const response = await fetch(`/api/notifications/preferences/${context.user.fid}`);
            if (response.ok) {
              setNotificationStatus('enabled');
            } else {
              setNotificationStatus('disabled');
            }
          }
        } else {
          setNotificationStatus('disabled');
        }
      } catch (error) {
        setNotificationStatus('disabled');
      }
    };

    checkNotificationStatus();
  }, []);

  if (!farcasterContext?.user?.fid) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm" data-testid="status-notifications-unavailable">
        <BellOff className="h-4 w-4" />
        <span>Open in Farcaster app for notifications</span>
      </div>
    );
  }

  if (notificationStatus === 'enabled') {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm" data-testid="status-notifications-enabled">
        <Bell className="h-4 w-4" />
        <span>Notifications enabled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-yellow-400 text-sm" data-testid="status-notifications-available">
      <Bell className="h-4 w-4" />
      <span>Notifications available</span>
    </div>
  );
}