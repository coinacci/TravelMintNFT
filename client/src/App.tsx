import React, { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

// Simple API helper
async function fetchAPI(endpoint: string) {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}${endpoint}`;
  console.log('📡 API call:', url);
  const response = await fetch(url);
  return response.json();
}

// Minimal TravelMint App - Stability First
function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [nfts, setNfts] = useState<any[]>([]);

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
        
        // Load basic data
        try {
          const statsData = await fetchAPI('/api/stats');
          setStats(statsData);
          console.log('📊 Stats loaded:', statsData);
          
          const nftsData = await fetchAPI('/api/nfts');
          setNfts(nftsData.slice(0, 6)); // Show first 6 NFTs
          console.log('🖼️ NFTs loaded:', nftsData.length, 'total');
        } catch (e) {
          console.log('⚠️ Data loading failed:', e);
        }
        
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
        {/* Stats */}
        {stats && (
          <div style={{
            backgroundColor: '#1e293b',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem' }}>
              <div>
                <div style={{ fontWeight: '600', color: '#3b82f6' }}>{stats.totalNFTs}</div>
                <div style={{ opacity: '0.7' }}>NFTs</div>
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#10b981' }}>${stats.totalVolume}</div>
                <div style={{ opacity: '0.7' }}>Volume</div>
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#8b5cf6' }}>{stats.totalHolders}</div>
                <div style={{ opacity: '0.7' }}>Holders</div>
              </div>
            </div>
          </div>
        )}

        {/* Featured NFTs */}
        {nfts.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
              🖼️ Featured NFTs
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem'
            }}>
              {nfts.map((nft, i) => (
                <NFTCard key={nft.id || i} nft={nft} />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'grid',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <button 
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              width: '100%',
              fontWeight: '500',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onClick={() => console.log('Mint clicked')}
          >
            <span>📸</span>
            <span>Mint Travel NFT</span>
          </button>
          <button 
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              width: '100%',
              fontWeight: '500',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onClick={() => console.log('Marketplace clicked')}
          >
            <span>💰</span>
            <span>Browse Marketplace</span>
          </button>
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

// NFT Card component
function NFTCard({ nft }: { nft: any }) {
  const imageUrl = nft.objectStorageUrl || nft.imageUrl || '';
  const price = nft.price ? `${parseFloat(nft.price).toFixed(0)} USDC` : 'Not for sale';
  
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '0.5rem',
      border: '1px solid #334155',
      overflow: 'hidden',
      cursor: 'pointer'
    }}>
      <div style={{
        aspectRatio: '1',
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#374151'
      }} />
      <div style={{ padding: '0.75rem' }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: '600',
          marginBottom: '0.25rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {nft.title || 'Untitled'}
        </div>
        <div style={{
          fontSize: '0.7rem',
          opacity: '0.7',
          marginBottom: '0.25rem'
        }}>
          📍 {nft.location || 'Unknown'}
        </div>
        <div style={{
          fontSize: '0.7rem',
          color: '#10b981',
          fontWeight: '500'
        }}>
          {price}
        </div>
      </div>
    </div>
  );
}

// Action button component
function ActionButton({ icon, text, color }: { icon: string, text: string, color: string }) {
  return (
    <button 
      style={{
        backgroundColor: color,
        color: 'white',
        border: 'none',
        padding: '0.75rem 1rem',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        width: '100%',
        fontWeight: '500',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}
      onClick={() => console.log(`${text} clicked`)}
    >
      <span>{icon}</span>
      <span>{text}</span>
    </button>
  );
}

export default App;