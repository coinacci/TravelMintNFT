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

// AGGRESSIVE mobile detection - treat ALL frames as mobile by default
let farcasterReady = false;
let isMobileFarcaster = false;
let isFarcasterFrame = false;
let isAnyMobile = false;

if (typeof window !== 'undefined') {
  try {
    const userAgent = navigator.userAgent || '';
    isFarcasterFrame = window.parent !== window;
    
    // EXPANDED mobile detection - much more aggressive
    isMobileFarcaster = isFarcasterFrame && (
      userAgent.includes('Farcaster') ||
      userAgent.includes('Mobile') || 
      userAgent.includes('Android') || 
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad') ||
      /Mobi|Android|iPhone|iPad/i.test(userAgent) ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
    
    // If it's ANY frame, treat as mobile (safer approach)
    isAnyMobile = isFarcasterFrame || isMobileFarcaster;
    
    console.log('🚀 TravelMint Ultra-Mobile Detection');
    console.log(`📱 Frame: ${isFarcasterFrame}, Mobile: ${isMobileFarcaster}, AnyMobile: ${isAnyMobile}`);
    console.log(`🔍 UserAgent: ${userAgent.substring(0, 100)}`);
    
    // ULTRA-AGGRESSIVE: Call SDK ready() immediately and repeatedly
    if (isAnyMobile || isFarcasterFrame) {
      console.log('📱 FRAME/MOBILE detected - Calling SDK ready()');
      
      // Call Farcaster SDK ready() multiple times with different strategies
      const callReady = () => {
        try {
          if (typeof sdk !== 'undefined' && sdk.actions) {
            sdk.actions.ready();
            console.log('✅ Farcaster SDK ready() called successfully');
          }
        } catch (error) {
          console.log('⚠️ SDK ready() call failed:', error);
        }
      };
      
      // Call immediately and with short delays
      callReady();
      setTimeout(callReady, 0);
      setTimeout(callReady, 1);
      setTimeout(callReady, 10);
      setTimeout(callReady, 50);
    }
  } catch (e) {
    console.log('⚠️ Detection failed - defaulting to mobile-safe mode');
    isAnyMobile = true; // Default to safe mode
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
    
    // Mobile Farcaster specific error handling
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      const isMobile = userAgent.includes('Farcaster') && /Mobi|Android|iPhone/i.test(userAgent);
      
      if (isMobile) {
        console.error('📱 MOBILE FARCASTER ERROR - attempting instant recovery');
        // Force reload on mobile error
        setTimeout(() => window.location.reload(), 100);
      }
    }
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
  console.log('🔀 Router rendering');
  
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
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ff00ff', // Magenta for 404
            color: 'white'
          }}>
            <div style={{textAlign: 'center'}}>
              <h1 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '16px'}}>Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
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
    
    // UNIVERSAL: NO SDK EVER in frame environments
    if (typeof window !== 'undefined') {
      if (isAnyMobile || isFarcasterFrame) {
        // UNIVERSAL frame strategy - no mobile/desktop distinction
        console.log('🚀 UNIVERSAL FRAME MODE: Zero-delay for ALL frames');
        console.log('📱 App ready for immediate interaction (mobile AND desktop)');
        
        // Universal frame communication
        if (window.parent && window.parent !== window) {
          setTimeout(() => {
            console.log('📨 Posting UNIVERSAL READY to parent frame');
            window.parent.postMessage({
              type: 'FRAME_APP_READY_UNIVERSAL',
              source: 'TravelMint',
              strategy: 'no-splash-universal',
              timestamp: Date.now()
            }, '*');
          }, 5); // Even faster - 5ms
        }
      } else {
        // Pure web (no frame) - but still NO SDK to be safe
        console.log('🌐 Pure web mode - NO SDK calls for safety');
      }
    }
    
    // No context loading - keep it simple for mobile
    console.log('📱 App ready for interaction');
  }, []);

  // Removed emergency fallback screen - no splash screens!

  console.log('🚀 App main render - about to return JSX');
  
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
