export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-28">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold" data-testid="about-title">About TravelMint</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Learn more about TravelMint
        </p>
      </header>

      <div className="space-y-6 text-foreground">
        <p className="leading-relaxed">
          TravelMint is a Web3-powered travel discovery platform built on Base, designed to inspire exploration and empower creators in the new digital economy.
        </p>

        <p className="leading-relaxed">
          We believe that travel is more than movement, it's connection, culture, and creativity.
          By merging blockchain technology with the joy of discovery, TravelMint helps travelers mint their journeys as NFTs, turning every route into a story that can be shared, collected, and celebrated across the Base ecosystem.
        </p>

        <div>
          <p className="font-semibold mb-3">For creators and brands, TravelMint opens a new path:</p>
          <ul className="space-y-2 ml-4">
            <li className="leading-relaxed">🔹 More visibility, through meaningful collaborations and authentic content.</li>
            <li className="leading-relaxed">🔹 Lower costs, with transparent, decentralized promotion tools.</li>
            <li className="leading-relaxed">🔹 More opportunities, by connecting travel experiences with digital ownership.</li>
          </ul>
        </div>

        <p className="leading-relaxed">
          Our vision is to onboard more travelers, creators, and brands into the onchain world building a global community that moves together, creates together, and earns together.
        </p>

        <div className="pt-4 border-t border-border">
          <p className="font-semibold text-center">More travelers, more routes, more inspiration.</p>
          <p className="font-semibold text-center">More brands, more visibility, lower-cost ads.</p>
        </div>
      </div>
    </div>
  );
}
