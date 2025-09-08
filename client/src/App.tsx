import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/wallet-provider";
import { useEffect } from "react";
import { sdk } from '@farcaster/miniapp-sdk';
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
    const initializeFarcasterApp = async () => {
      console.log('📱 HTML Detection - Frame:', window.parent !== window, 'Mobile:', window.innerWidth < 768);
      
      // Hide HTML fallback when React loads
      const fallback = document.getElementById('html-fallback');
      if (fallback) {
        fallback.style.display = 'none';
        console.log('🚫 HTML fallback hidden - React loaded');
      }
      
      // Frame detection and proper SDK initialization
      if (typeof window !== 'undefined' && window.parent !== window) {
        console.log('⚡ Initializing Farcaster MiniApp SDK...');
        try {
          // Official Farcaster MiniApp SDK call - async/await pattern
          await sdk.actions.ready();
          console.log('✅ Farcaster SDK ready() called successfully - splash should be hidden');
        } catch (error) {
          console.error('❌ Farcaster SDK ready() error:', error);
          // Fallback for manual visibility
          document.body.style.visibility = 'visible';
          document.body.style.opacity = '1';
        }
      }
    };

    initializeFarcasterApp();
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