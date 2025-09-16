import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, LogOut, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import sdk from "@farcaster/frame-sdk";

export function WalletConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  
  // Get Farcaster user context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await Promise.resolve(sdk.context);
          if (context?.user) {
            setFarcasterUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            });
            console.log('✅ Farcaster user detected in WalletConnect:', context.user.username);
          }
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context in wallet connect');
      }
    };
    
    getFarcasterContext();
  }, []);

  useEffect(() => {
    if (connectError) {
      console.error('Connection error:', connectError);
      toast({
        title: "Connection Failed",
        description: connectError.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  }, [connectError, toast]);

  // Removed wallet connected popup as requested

  const handleConnect = async (connector: any) => {
    try {
      console.log('Attempting to connect with:', connector.name);
      
      // Add connection timeout
      const connectionPromise = connect({ connector });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 30000)
      );
      
      await Promise.race([connectionPromise, timeoutPromise]);
      setIsOpen(false);
      
      // Wallet connected toast removed for cleaner UX
    } catch (error) {
      console.error('Wallet connection failed:', error);
      
      let errorMessage = "Failed to connect wallet";
      let errorTitle = "Connection Failed";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorTitle = "Connection Timeout";
          errorMessage = "Connection took too long. Please try again";
        } else if (error.message.includes('rejected') || error.message.includes('denied')) {
          errorTitle = "Connection Rejected";
          errorMessage = "Please approve the connection request";
        } else if (error.message.includes('popup')) {
          errorTitle = "Popup Blocked";
          errorMessage = "Please allow popups and try again";
        } else if (error.message.includes('User rejected')) {
          errorTitle = "Connection Cancelled";
          errorMessage = "Connection was cancelled by user";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      
      // Reset dialog state on error
      setIsOpen(false);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
      setIsOpen(false);
      
      // Wallet disconnected toast removed for cleaner UX
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Error",
        description: "Error disconnecting wallet",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center space-x-2"
            data-testid="wallet-connected-button"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>
              {farcasterUser ? 
                `@${farcasterUser.username}` : 
                formatAddress(address)
              }
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="w-5 h-5" />
              <span>Wallet Connected</span>
            </DialogTitle>
            <DialogDescription>
              Manage your connected wallet and view account details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Connected with</p>
                    <p className="font-medium">{connector?.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Address</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-mono text-sm">{formatAddress(address)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://basescan.org/address/${address}`, '_blank')}
                        data-testid="view-on-explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Button 
              onClick={handleDisconnect}
              variant="destructive"
              className="w-full"
              data-testid="disconnect-wallet-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="flex items-center space-x-2"
          data-testid="connect-wallet-button"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Connect Your Wallet</span>
          </DialogTitle>
          <DialogDescription>
            Choose a wallet to connect and access the TravelNFT platform
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {connectors.length === 0 && (
            <p className="text-center text-muted-foreground">No connectors available</p>
          )}
          {connectors.map((connector) => {
            const isLoading = isPending;
            console.log('Available connector:', connector.name, connector.type, connector);
            
            return (
              <Button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                variant="outline"
                className="w-full justify-start h-auto p-4"
                disabled={isPending}
                data-testid={`connect-${connector.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {connector.name === 'Coinbase Wallet' ? (
                      <div className="w-5 h-5 rounded bg-blue-600" />
                    ) : (
                      <Wallet className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {connector.name === 'Coinbase Wallet' 
                        ? 'Connect using Coinbase Wallet'
                        : 'Connect wallet'}
                    </p>
                  </div>
                  {isLoading && (
                    <div className="ml-auto">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
        
        <div className="text-center text-xs text-muted-foreground mt-4">
          By connecting your wallet, you agree to our Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}