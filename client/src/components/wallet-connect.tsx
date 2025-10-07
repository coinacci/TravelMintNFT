import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, LogOut, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthKitProvider, useSignIn } from "@farcaster/auth-kit";
import QRCodeSVG from "react-qr-code";

// Farcaster AuthKit configuration
const authConfig = {
  rpcUrl: 'https://mainnet.optimism.io',
  domain: typeof window !== 'undefined' ? window.location.host : 'travelmint.replit.app',
  siweUri: typeof window !== 'undefined' ? `${window.location.origin}/api/auth/farcaster` : 'https://travelmint.replit.app/api/auth/farcaster',
};

// Farcaster QR Code Authentication Component (must be used inside AuthKitProvider)
function FarcasterQRAuth({ onSuccess, onError, onBack }: {
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
  onBack: () => void;
}) {
  const [hasInitialized, setHasInitialized] = useState(false);
  const signInState = useSignIn({
    onSuccess: onSuccess,
    onError: onError
  });

  const { signIn, url, isSuccess, isError, error } = signInState;

  useEffect(() => {
    // Trigger sign in flow automatically only once
    if (!hasInitialized) {
      console.log('🔄 Initializing Farcaster sign in...');
      signIn();
      setHasInitialized(true);
    }
  }, [hasInitialized, signIn]);

  if (isError) {
    return (
      <div className="space-y-4">
        <div className="text-center text-red-500">
          <p>Authentication failed: {error?.message || 'Please try again'}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={onBack}>
          Back to Wallet Options
        </Button>
      </div>
    );
  }

  if (isSuccess) {
    return null; // Success handler will be called
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Sign in with Farcaster</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Scan the QR code with your Warpcast app
          </p>
        </div>

        {url ? (
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={url} size={200} />
          </div>
        ) : (
          <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Waiting for confirmation...
        </p>
      </div>

      <Button variant="outline" className="w-full" onClick={onBack}>
        Back to Wallet Options
      </Button>
    </div>
  );
}

export function WalletConnect({ farcasterUser }: { farcasterUser?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInjectedProvider, setHasInjectedProvider] = useState(false);
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  
  // Check if browser has an injected provider (MetaMask, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasInjectedProvider(!!window.ethereum);
    }
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

  // Show Farcaster username if available, otherwise show wallet address
  const displayName = farcasterUser?.username 
    ? `@${farcasterUser.username}` 
    : address ? formatAddress(address) : '';

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
            <span>{displayName}</span>
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
    <AuthKitProvider config={authConfig}>
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
              Choose a wallet to access TravelMint
            </DialogDescription>
          </DialogHeader>
          
          <>
            <div className="space-y-3">
              {connectors.length === 0 && (
                <p className="text-center text-muted-foreground">No wallet connectors available</p>
              )}
              {connectors.map((connector) => {
              const isLoading = isPending;
              console.log('Available connector:', connector.name, connector.type);
            
            // Get connector-specific icon and description
            const getConnectorInfo = (name: string) => {
              const nameLower = name.toLowerCase();
              
              if (nameLower.includes('coinbase')) {
                return {
                  icon: <div className="w-5 h-5 rounded bg-blue-600" />,
                  description: 'Connect using Coinbase Wallet'
                };
              }
              
              if (nameLower.includes('walletconnect')) {
                return {
                  icon: <svg className="w-5 h-5" viewBox="0 0 300 185" fill="none"><path d="M61.4385 36.2562C99.8438 -2.08542 162.156 -2.08542 200.561 36.2562L205.613 41.2857C207.815 43.4819 207.815 47.0725 205.613 49.2687L188.098 66.7333C186.997 67.8314 185.173 67.8314 184.072 66.7333L177.088 59.7686C150.792 33.5306 111.208 33.5306 84.9123 59.7686L77.4277 67.2297C76.3266 68.3278 74.5028 68.3278 73.4017 67.2297L55.8866 49.7651C53.6844 47.5689 53.6844 43.9783 55.8866 41.7821L61.4385 36.2562ZM233.957 71.0653L249.642 86.7079C251.845 88.9041 251.845 92.4947 249.642 94.6909L179.038 165.102C176.836 167.298 173.188 167.298 170.986 165.102C170.986 165.102 170.986 165.102 170.986 165.102L121.284 115.497C120.734 114.948 119.766 114.948 119.216 115.497C119.216 115.497 119.216 115.497 119.216 115.497L69.5147 165.102C67.3125 167.298 63.6641 167.298 61.4619 165.102C61.4619 165.102 61.4619 165.102 61.4619 165.102L-9.11313 94.6909C-11.3153 92.4947 -11.3153 88.9041 -9.11313 86.7079L6.57213 71.0653C8.77429 68.8691 12.4227 68.8691 14.6249 71.0653L64.3262 120.67C64.8762 121.22 65.8443 121.22 66.3943 120.67C66.3943 120.67 66.3943 120.67 66.3943 120.67L116.096 71.0653C118.298 68.8691 121.946 68.8691 124.149 71.0653C124.149 71.0653 124.149 71.0653 124.149 71.0653L173.85 120.67C174.4 121.22 175.368 121.22 175.918 120.67L225.619 71.0653C227.822 68.8691 231.47 68.8691 233.957 71.0653Z" fill="currentColor"/></svg>,
                  description: 'Scan with mobile wallet app'
                };
              }
              
              if (nameLower.includes('metamask') || nameLower.includes('injected')) {
                return {
                  icon: <svg className="w-5 h-5" viewBox="0 0 212 189" fill="none"><path d="M200.768 0L119.712 59.3191L134.72 23.9362L200.768 0Z" fill="#E2761B" stroke="#E2761B"/><path d="M10.7359 0L91.0879 59.8511L76.7359 23.9362L10.7359 0Z" fill="#E4761B" stroke="#E4761B"/><path d="M171.072 137.532L149.76 170.468L195.84 183.404L209.28 138.298L171.072 137.532Z" fill="#E4761B" stroke="#E4761B"/><path d="M2.23999 138.298L15.68 183.404L61.76 170.468L40.448 137.532L2.23999 138.298Z" fill="#E4761B" stroke="#E4761B"/><path d="M59.2 81.5745L46.464 100.426L92.288 102.553L90.624 53.0212L59.2 81.5745Z" fill="#E4761B" stroke="#E4761B"/><path d="M152.32 81.5745L120.384 52.4894L119.2 102.553L165.056 100.426L152.32 81.5745Z" fill="#E4761B" stroke="#E4761B"/><path d="M61.76 170.468L88.448 157L65.6 138.83L61.76 170.468Z" fill="#E4761B" stroke="#E4761B"/><path d="M123.072 157L149.76 170.468L145.92 138.83L123.072 157Z" fill="#E4761B" stroke="#E4761B"/></svg>,
                  description: 'Connect browser wallet extension'
                };
              }
              
              if (nameLower.includes('farcaster')) {
                return {
                  icon: <Wallet className="w-5 h-5 text-purple-500" />,
                  description: 'Farcaster native wallet'
                };
              }
              
              return {
                icon: <Wallet className="w-5 h-5" />,
                description: 'Connect wallet'
              };
            };
            
            const { icon, description } = getConnectorInfo(connector.name);
            
            // Check if this is an injected connector and if provider exists
            const isInjectedConnector = connector.type === 'injected';
            const isDisabled = isPending || (isInjectedConnector && !hasInjectedProvider);
            
            return (
              <Button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                variant="outline"
                className="w-full justify-start h-auto p-4"
                disabled={isDisabled}
                data-testid={`connect-${connector.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {isInjectedConnector && !hasInjectedProvider 
                        ? 'No browser wallet detected' 
                        : description}
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
          </>
        </DialogContent>
    </Dialog>
    </AuthKitProvider>
  );
}