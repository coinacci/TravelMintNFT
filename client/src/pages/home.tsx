import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MapView from "@/components/map-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

interface NFT {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  location: string;
  latitude: string;
  longitude: string;
  price: string;
  isForSale: number;
  creator: { id: string; username: string; avatar?: string } | null;
  owner: { id: string; username: string; avatar?: string } | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: string;
  createdAt: string;
  fromUserId?: string;
  toUserId: string;
}

export default function Home() {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id],
    enabled: !!selectedNFT?.id,
  });

  const handleNFTSelect = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNFT(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`${isMobile ? 'pb-16' : ''}`}>
      <MapView onNFTSelect={handleNFTSelect} />

      {/* Floating Upload Button */}
      <Link href="/mint">
        <Button
          className="fixed bottom-4 right-4 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 z-10"
          data-testid="upload-button"
          style={{ bottom: isMobile ? '5rem' : '1rem' }}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </Button>
      </Link>

      {/* NFT Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="nft-detail-modal">
          {selectedNFT && (
            <>
              <DialogHeader>
                <DialogTitle data-testid="modal-nft-title">{selectedNFT.title}</DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedNFT.imageUrl}
                    alt={selectedNFT.title}
                    className="w-full rounded-lg"
                    data-testid="modal-nft-image"
                  />

                  <div className="mt-4 bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Location Details</h4>
                    <div className="flex items-center space-x-2 text-sm mb-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span data-testid="modal-nft-location">{selectedNFT.location}</span>
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid="modal-nft-coordinates">
                      Coordinates: {parseFloat(selectedNFT.latitude).toFixed(4)}°, {parseFloat(selectedNFT.longitude).toFixed(4)}°
                    </div>
                  </div>
                </div>

                <div>
                  <div className="space-y-6">
                    {/* Pricing and Purchase */}
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-lg font-medium">Current Price</span>
                        <span className="text-2xl font-bold text-accent" data-testid="modal-nft-price">
                          {parseFloat(selectedNFT.price).toFixed(0)} USDC
                        </span>
                      </div>
                      {selectedNFT.isForSale === 1 ? (
                        <>
                          <Button className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-colors" data-testid="purchase-nft-button">
                            Purchase NFT
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Includes 5% platform fee
                          </p>
                        </>
                      ) : (
                        <div className="text-center">
                          <p className="text-muted-foreground">This NFT is not currently for sale</p>
                        </div>
                      )}
                    </div>

                    {/* Owner and Creator Info */}
                    <div>
                      <h4 className="font-medium mb-3">Ownership</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Creator</span>
                          <div className="flex items-center space-x-2">
                            {selectedNFT.creator?.avatar && (
                              <img
                                src={selectedNFT.creator.avatar}
                                alt="Creator profile"
                                className="w-6 h-6 rounded-full"
                                data-testid="modal-creator-avatar"
                              />
                            )}
                            <span className="text-sm" data-testid="modal-creator-username">
                              @{selectedNFT.creator?.username || 'unknown'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Current Owner</span>
                          <div className="flex items-center space-x-2">
                            {selectedNFT.owner?.avatar && (
                              <img
                                src={selectedNFT.owner.avatar}
                                alt="Owner profile"
                                className="w-6 h-6 rounded-full"
                                data-testid="modal-owner-avatar"
                              />
                            )}
                            <span className="text-sm" data-testid="modal-owner-username">
                              @{selectedNFT.owner?.username || 'unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {selectedNFT.description && (
                      <div>
                        <h4 className="font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground" data-testid="modal-nft-description">
                          {selectedNFT.description}
                        </p>
                      </div>
                    )}

                    {/* Trading History */}
                    <div>
                      <h4 className="font-medium mb-3">Trading History</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {nftDetails?.transactions && nftDetails.transactions.length > 0 ? (
                          nftDetails.transactions.map((tx) => (
                            <div key={tx.id} className="flex justify-between items-center text-xs" data-testid={`transaction-${tx.id}`}>
                              <span className="text-muted-foreground capitalize">{tx.transactionType}</span>
                              <span>{parseFloat(tx.amount).toFixed(0)} USDC</span>
                              <span className="text-muted-foreground">{formatDate(tx.createdAt)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No trading history available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
