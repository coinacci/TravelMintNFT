export default function Contact() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-28">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold" data-testid="contact-title">Contact</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get in touch with us
        </p>
      </header>

      <div className="space-y-6">
        <div className="border border-border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Founder</h2>
            <p className="text-foreground">Coinacci</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Farcaster & Base App</h2>
            <a 
              href="https://warpcast.com/coinacci" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              data-testid="link-farcaster"
            >
              @coinacci
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
