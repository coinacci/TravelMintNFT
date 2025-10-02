import { useState } from "react";
import { ChevronDown } from "lucide-react";

// TravelMint FAQ component
// - Tailwind CSS used for styling
// - Self-contained: FAQ data is embedded but can be passed via props or loaded from an API
// - Features: search, accordion, copy-to-clipboard, download as Markdown

const FAQ_DATA = [
  {
    id: "what-is",
    q: "What is TravelMint?",
    a:
      "TravelMint is a digital marketplace where you can mint your travel photos as NFTs and buy or sell them on the Base network. By uploading a photo and adding a location, you can create NFTs and showcase your unique travel memories on the blockchain.",
    tags: ["general"],
  },
  {
    id: "network",
    q: "Which network does it run on?",
    a: "TravelMint runs entirely on the Base network. You need to use USDC on Base for your transactions.",
    tags: ["technical", "payments"],
  },
  {
    id: "mint-fee",
    q: "How much is the minting fee?",
    a: "Each NFT minting requires 1 USDC + gas fee. The gas fee is the transaction cost on the Base network and depends on network usage at the time.",
    tags: ["fees"],
  },
  {
    id: "payments",
    q: "Which payment methods are supported?",
    a: "Currently, only USDC on the Base network is supported for payments.",
    tags: ["payments"],
  },
  {
    id: "royalties",
    q: "Are royalties (artist fees) supported?",
    a: "Currently, NFT sales do not include royalties. However, this feature is planned in the roadmap.",
    tags: ["sales", "roadmap"],
  },
  {
    id: "file-types",
    q: "Which file formats are supported?",
    a: "JPEG and PNG formats are supported for uploading photos.",
    tags: ["technical", "upload"],
  },
  {
    id: "location",
    q: "How does NFT location data work?",
    a: "Each NFT is linked with the uploaded photo and the selected manual or automatic location (GPS coordinates). This data is stored in the NFT’s metadata. Even if the NFT is sold, only ownership changes — the location data or map position does not change.",
    tags: ["technical", "feature"],
  },
  {
    id: "roadmap",
    q: "What’s planned for the future?",
    a: "Royalties for NFT sales, advanced filtering, social features, and additional utilities are planned.",
    tags: ["roadmap"],
  },
];

export default function TravelMintFAQ({ faqs = FAQ_DATA }) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-28">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">TravelMint — Frequently Asked Questions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          An interactive FAQ prepared for your NFT marketplace running on the Base network.
        </p>
      </header>

      <div className="space-y-3">
        {faqs.map((f) => (
          <article key={f.id} className="border rounded-lg overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between"
              onClick={() => toggle(f.id)}
              aria-expanded={openId === f.id}
            >
              <div>
                <h3 className="font-medium">{f.q}</h3>
                <div className="text-xs text-gray-500 mt-1">
                  {(f.tags || []).join(" • ")}
                </div>
              </div>
              <ChevronDown
                className={`transition-transform ${
                  openId === f.id ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>

            <div
              className={`px-4 pb-4 transition-max-h duration-300 ease-in-out overflow-hidden ${
                openId === f.id ? "max-h-96" : "max-h-0"
              }`}
            >
              <div className="text-sm text-gray-700">{f.a}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}