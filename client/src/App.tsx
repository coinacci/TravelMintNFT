import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/wallet-provider";
import { useEffect, Component, ReactNode } from "react";
import sdk from "@farcaster/miniapp-sdk";
import Landing from "@/pages/landing";
import Explore from "@/pages/explore";
import Marketplace from "@/pages/marketplace";
import MyNFTs from "@/pages/my-nfts";
import Mint from "@/pages/mint";
import Navigation from "@/components/navigation";
import { queryClient } from "./lib/queryClient";

// Çerçeve ve mobil algılama değişkenleri
let farcasterReady = false;
let isFarcasterFrame = false;
let isMobileFarcaster = false;

if (typeof window !== 'undefined') {
  try {
    const userAgent = navigator.userAgent || '';
    isFarcasterFrame = window.parent !== window;
    isMobileFarcaster = isFarcasterFrame && userAgent.includes('Farcaster');
    console.log(`📱 Frame: ${isFarcasterFrame}, Mobile Farcaster: ${isMobileFarcaster}`);
  } catch (e) {
    console.error('⚠️ Frame detection failed - assuming frame environment:', e);
    isFarcasterFrame = true;
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            padding: '1rem',
            zIndex: 1000, // Ensure error screen is on top
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '90%' }}>
            <h1
              style={{
                fontSize: 'clamp(1.2rem, 5vw, 1.5rem)',
                fontWeight: 'bold',
                marginBottom: '1rem',
              }}
            >
              TravelMint Error
            </h1>
            <p
              style={{
                marginBottom: '1rem',
                opacity: 0.8,
                fontSize: 'clamp(0.9rem, 4vw, 1rem)',
              }}
            >
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
                cursor: 'pointer',
                fontSize: 'clamp(0.9rem, 4vw, 1rem)',
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
    <div style={{ position: 'relative', zIndex: 1000, minHeight: '100vh' }}>
      <Navigation />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/explore" component={Explore} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/my-nfts" component={MyNFTs} />
        <Route path="/mint" component={Mint} />
        <Route>
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ff00ff',
              color: 'white',
              zIndex: 1000,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
                Page Not Found
              </h1>
              <p>The page you're looking for doesn't exist.</p>
            </div>
          </div>
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  useEffect(() => {
    const initializeFrame = async () => {
      try {
        // SDK hazır kontrolü ve çağrı
        const callReady = async () => {
          if (typeof sdk !== 'undefined' && sdk.actions && sdk.actions.ready && !farcasterReady) {
            await sdk.actions.ready();
            farcasterReady = true;
            console.log('✅ Farcaster SDK ready() called successfully');
          } else {
            console.log('⚠️ SDK not ready or already called');
          }
        };

        // Çerçeve ortamında mesaj gönderme
        if (isFarcasterFrame && window.parent && window.parent !== window) {
          const targetOrigin = '*'; // Replace with 'https://warpcast.com' or specific Farcaster origin if known
          const messages = [
            { type: 'farcaster_frame_loaded', source: 'TravelMint', timestamp: Date.now() },
            { type: 'DISMISS_SPLASH', action: 'hide_splash_now', ready: true },
            { type: 'HIDE_SPLASH_OVERLAY' },
          ];

          // Send messages immediately and with delays to ensure delivery
          messages.forEach((message) => {
            window.parent.postMessage(message, targetOrigin);
            setTimeout(() => window.parent.postMessage(message, targetOrigin), 10);
            setTimeout(() => window.parent.postMessage(message, targetOrigin), 50);
            setTimeout(() => window.parent.postMessage(message, targetOrigin), 100);
          });
          console.log('📨 Sent postMessages to parent for splash dismissal');
        }

        // Call ready immediately and with delays for reliability
        await callReady();
        setTimeout(callReady, 0);
        setTimeout(callReady, 10);
        setTimeout(callReady, 50);
        setTimeout(callReady, 100);

        // Additional attempt to force splash dismissal via CSS (client-side fallback)
        if (isFarcasterFrame) {
          const hideSplash = () => {
            const splash = document.querySelector('div[id*="splash"], div[class*="splash"]');
            if (splash) {
              (splash as HTMLElement).style.display = 'none';
              console.log('🧹 Force-hid splash element via CSS');
            }
          };
          setTimeout(hideSplash, 100);
          setTimeout(hideSplash, 500);
        }
      } catch (error) {
        console.error('⚠️ Frame initialization error:', error);
      }
    };

    if (isFarcasterFrame || isMobileFarcaster) {
      initializeFrame();
    }
  }, []);

  return (
    <div style={{ position: 'relative', zIndex: 1000, minHeight: '100vh' }}>
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
    </div>
  );
}

export default App;