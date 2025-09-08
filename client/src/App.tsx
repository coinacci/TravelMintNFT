import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/wallet-provider";
import { useEffect, useState, Component, ReactNode } from "react";
import sdk from "@farcaster/frame-sdk";
import Landing from "@/pages/landing";
import Explore from "@/pages/explore";
import Marketplace from "@/pages/marketplace";
import MyNFTs from "@/pages/my-nfts";
import Mint from "@/pages/mint";
import Navigation from "@/components/navigation";

// Enhanced Farcaster SDK with mobile detection
let farcasterReady = false;
let isMobileFarcaster = false;
if (typeof window !== 'undefined') {
  try {
    console.log('🚀 Minimal Farcaster init...');
    
    // Detect mobile Farcaster specifically
    const userAgent = navigator.userAgent || '';
    isMobileFarcaster = userAgent.includes('Farcaster') && 
                       (userAgent.includes('Mobile') || 
                        userAgent.includes('Android') || 
                        userAgent.includes('iPhone') ||
                        /Mobi|Android/i.test(userAgent));
    
    // Only log detection, don't call any SDK methods immediately
    if (window.parent !== window && sdk?.actions) {
      console.log(`📱 Farcaster environment detected - Mobile: ${isMobileFarcaster}`);
      // Don't call ready() immediately - let it happen async later
    } else {
      console.log('🌐 Standard web browser mode');
    }
  } catch (e) {
    console.log('⚠️ Farcaster detection failed, web mode');
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 CRITICAL: Error caught by boundary:', error, errorInfo);
    console.error('🚨 Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              TravelMint Error
            </h1>
            <p style={{ marginBottom: '1rem', opacity: 0.8 }}>
              App crashed in Farcaster environment
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
              <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  // Removed all state to minimize mobile issues

  useEffect(() => {
    console.log('🎯 TravelMint starting...');
    
    // Optional Farcaster SDK ready call - mobile-aware timing
    if (typeof window !== 'undefined' && window.parent !== window && sdk?.actions?.ready) {
      // Mobile Farcaster needs longer initialization time
      const readyDelay = isMobileFarcaster ? 2500 : 1000;
      
      setTimeout(() => {
        try {
          sdk.actions.ready();
          console.log(`✅ Farcaster ready (delayed ${readyDelay}ms) - Mobile: ${isMobileFarcaster}`);
        } catch (e) {
          console.log('⚠️ Farcaster ready call failed:', e);
        }
      }, readyDelay);
    }
    
    // No context loading - keep it simple for mobile
    console.log('📱 App ready for interaction');
  }, []);

  // Removed emergency fallback screen - no splash screens!

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ErrorBoundary>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
