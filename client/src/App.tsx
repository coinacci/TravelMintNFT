import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/wallet-provider";
import { useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import Landing from "@/pages/landing";
import Explore from "@/pages/explore";
import Marketplace from "@/pages/marketplace";
import MyNFTs from "@/pages/my-nfts";
import Mint from "@/pages/mint";
import Navigation from "@/components/navigation";



function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/explore" component={Explore} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/my-nfts" component={MyNFTs} />
        <Route path="/mint" component={Mint} />
        <Route>
          <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    console.log('📱 HTML Detection - Frame:', window.parent !== window, 'Mobile:', window.innerWidth < 768);
    
    // Frame detection and instant loading
    if (typeof window !== 'undefined' && window.parent !== window) {
      console.log('⚡ NO SPLASH: Instant frame loading');
      try {
        // Post ready message immediately - no delays for frames
        sdk.actions?.ready();
        console.log('🚀 Posting instant ready message (no splash delay)');
      } catch (error) {
        console.error('SDK ready error:', error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </WalletProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;