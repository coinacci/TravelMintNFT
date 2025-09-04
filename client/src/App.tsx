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

// Browser-safe Farcaster SDK initialization
let farcasterReady = false;
if (typeof window !== 'undefined' && sdk?.actions?.ready) {
  console.log('🚀 Initializing Farcaster SDK...');
  try {
    // Call ready() without await to prevent blocking
    sdk.actions.ready();
    farcasterReady = true;
    console.log('✅ Farcaster ready signal sent');
  } catch (e) {
    console.log('⚠️ Farcaster not available (running in web browser)');
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
  const [context, setContext] = useState<any>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    console.log('🎯 TravelMint App starting...');
    
    try {
      // Get Farcaster context if available (optional, non-blocking)
      if (typeof window !== 'undefined' && sdk?.context) {
        Promise.resolve(sdk.context)
          .then((appContext: any) => {
            setContext(appContext);
            console.log('✅ Farcaster context loaded:', appContext?.user?.displayName || 'User');
          })
          .catch((error) => {
            // Handle promise rejection properly to prevent unhandled rejection
            console.log('ℹ️ Running in web browser mode (Farcaster context not available)');
            console.log('📋 Error details:', error?.message || 'No details available');
          });
      } else {
        console.log('🌐 No Farcaster SDK available - running in standard web browser');
      }
    } catch (error) {
      console.error('🚨 CRITICAL: App initialization failed:', error);
      setIsError(true);
    }
  }, []);

  // Emergency fallback for Farcaster iframe issues
  if (isError) {
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
            TravelMint Initialization Error
          </h1>
          <p style={{ marginBottom: '1rem', opacity: 0.8 }}>
            Failed to start in current environment
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
            Retry
          </button>
        </div>
      </div>
    );
  }

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
