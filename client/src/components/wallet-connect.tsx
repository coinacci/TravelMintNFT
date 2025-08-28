import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, LogOut, ExternalLink } from "lucide-react";

export function WalletConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = (connector: any) => {
    connect({ connector });
    setIsOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setIsOpen(false);
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
            <span>{formatAddress(address)}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="w-5 h-5" />
              <span>Wallet Connected</span>
            </DialogTitle>
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
        </DialogHeader>
        
        <div className="space-y-3">
          {connectors.map((connector) => {
            const isLoading = isPending && connector.type === 'coinbaseWallet';
            
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
                    ) : connector.name === 'Farcaster Mini App' ? (
                      <div className="w-5 h-5 rounded bg-purple-600" />
                    ) : (
                      <Wallet className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {connector.name === 'Coinbase Wallet' 
                        ? 'Connect using Coinbase Wallet'
                        : connector.name === 'Farcaster Mini App'
                        ? 'Connect via Farcaster'
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