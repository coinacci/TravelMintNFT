import React, { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

// Minimal TravelMint App - Stability First
function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 TravelMint initializing...');
        
        // Check if we're in Farcaster iframe
        if (window.parent !== window && sdk?.actions?.ready) {
          console.log('📱 Detected Farcaster environment');
          
          // Simple SDK ready with timeout
          const timeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('SDK Timeout')), 8000)
          );
          
          await Promise.race([sdk.actions.ready(), timeout]);
          console.log('✅ Farcaster SDK ready!');
        } else {
          console.log('🌐 Running in web browser');
        }
        
        setIsReady(true);
        console.log('✅ TravelMint ready!');
        
        // Signal to parent frame
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'frame-ready' }, '*');
          console.log('📡 Ready signal sent to parent');
        }
      } catch (err: any) {
        console.log('⚠️ Init error:', err?.message || err);
        setError(err?.message || 'Unknown error');
        setIsReady(true); // Continue anyway
      }
    };
    
    init();
  }, []);

  // Loading screen
  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#0f172a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗺️</div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>TravelMint</h1>
          <p style={{ margin: '0', opacity: '0.7' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#0f172a',
      color: 'white',
      padding: '1rem'
    }}>
      {/* Header */}
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '2rem',
        borderBottom: '1px solid #334155',
        paddingBottom: '1rem'
      }}>
        <h1 style={{ 
          fontSize: '1.75rem', 
          margin: '0 0 0.5rem 0',
          fontWeight: '700'
        }}>
          🗺️ TravelMint
        </h1>
        <p style={{ 
          margin: '0', 
          opacity: '0.8',
          fontSize: '0.9rem'
        }}>
          Travel Photo NFT Marketplace on Base
        </p>
        {error && (
          <p style={{ 
            color: '#ef4444', 
            fontSize: '0.8rem',
            marginTop: '0.5rem',
            opacity: '0.8'
          }}>
            Status: {error}
          </p>
        )}
      </header>
      
      {/* Main content */}
      <main style={{ 
        maxWidth: '600px', 
        margin: '0 auto'
      }}>
        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <FeatureCard
            icon="🖼️"
            title="Browse NFTs"
            description="Discover travel photos from around the world"
            buttonText="Explore Gallery"
            buttonColor="#3b82f6"
          />
          
          <FeatureCard
            icon="📸"
            title="Mint NFT"
            description="Turn your travel photos into NFTs"
            buttonText="Start Minting"
            buttonColor="#10b981"
          />
          
          <FeatureCard
            icon="💰"
            title="Marketplace"
            description="Buy and sell travel NFTs with USDC"
            buttonText="View Market"
            buttonColor="#8b5cf6"
          />
        </div>
        
        {/* Contract info */}
        <div style={{
          textAlign: 'center',
          opacity: '0.6',
          fontSize: '0.8rem',
          padding: '1rem',
          backgroundColor: '#1e293b',
          borderRadius: '0.5rem',
          border: '1px solid #334155'
        }}>
          <p style={{ margin: '0 0 0.25rem 0' }}>
            🔗 Contract: 0x8c12...558f
          </p>
          <p style={{ margin: '0' }}>
            🌐 Base Network • 💰 USDC
          </p>
        </div>
      </main>
    </div>
  );
}

// Feature card component
interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  buttonColor: string;
}

function FeatureCard({ icon, title, description, buttonText, buttonColor }: FeatureCardProps) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      padding: '1.25rem',
      borderRadius: '0.5rem',
      border: '1px solid #334155'
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>{title}</h3>
      <p style={{ margin: '0 0 1rem 0', opacity: '0.8', fontSize: '0.9rem' }}>
        {description}
      </p>
      <button 
        style={{
          backgroundColor: buttonColor,
          color: 'white',
          border: 'none',
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          width: '100%',
          fontWeight: '500',
          fontSize: '0.9rem'
        }}
        onClick={() => console.log(`${title} clicked`)}
      >
        {buttonText}
      </button>
    </div>
  );
}

export default App;