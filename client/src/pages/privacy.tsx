export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              TravelMint is a decentralized application that interacts with blockchain networks. 
              We do not collect personal information beyond what is necessary for the application to function.
              Wallet addresses and transaction data are stored on the blockchain and are publicly accessible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">How We Use Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              Information is used solely to provide the NFT marketplace functionality, including:
              displaying your NFTs, facilitating transactions, and maintaining the quest system.
              No personal data is sold or shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Blockchain Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              All NFT data, transactions, and ownership records are stored on the Base blockchain 
              and are publicly accessible. This is inherent to blockchain technology and cannot be modified.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions, please contact us through our official channels on Farcaster.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Updates</h2>
            <p className="text-muted-foreground leading-relaxed">
              This privacy policy may be updated periodically. Last updated: September 2025.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}