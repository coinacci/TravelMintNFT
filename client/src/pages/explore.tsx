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
  creator: { username: string; avatar?: string } | null;
  owner: { username: string; avatar?: string } | null;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: string;
  createdAt: string;
  fromUserId?: string;
  toUserId: string;
}

export default function Explore() {
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {nftDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold" data-testid="modal-nft-title">
                  {nftDetails.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  <img
                    src={nftDetails.imageUrl}
                    alt={nftDetails.title}
                    className="w-full h-64 md:h-80 object-cover rounded-lg"
                    data-testid="modal-nft-image"
                  />
                  
                  {/* Price and Action */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="text-2xl font-bold" data-testid="modal-nft-price">
                        {parseFloat(nftDetails.price).toFixed(0)} USDC
                      </p>
                    </div>
                    {nftDetails.isForSale === 1 && (
                      <Button 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        data-testid="modal-buy-button"
                      >
                        Buy Now
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-6">
                  {/* Description */}
                  {nftDetails.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground" data-testid="modal-nft-description">
                        {nftDetails.description}
                      </p>
                    </div>
                  )}

                  {/* Location */}
                  <div>
                    <h3 className="font-semibold mb-2">Location</h3>
                    <div className="flex items-center text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span data-testid="modal-nft-location">{nftDetails.location}</span>
                    </div>
                  </div>

                  {/* Creator & Owner */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Creator</h3>
                      <div className="flex items-center space-x-2">
                        {nftDetails.creator?.avatar ? (
                          <img
                            src={nftDetails.creator.avatar}
                            alt="Creator"
                            className="w-8 h-8 rounded-full"
                            data-testid="modal-creator-avatar"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="text-sm" data-testid="modal-creator-username">
                          @{nftDetails.creator?.username || 'unknown'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Owner</h3>
                      <div className="flex items-center space-x-2">
                        {nftDetails.owner?.avatar ? (
                          <img
                            src={nftDetails.owner.avatar}
                            alt="Owner"
                            className="w-8 h-8 rounded-full"
                            data-testid="modal-owner-avatar"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="text-sm" data-testid="modal-owner-username">
                          @{nftDetails.owner?.username || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div>
                    <h3 className="font-semibold mb-2">Created</h3>
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span data-testid="modal-nft-created">{formatDate(nftDetails.createdAt)}</span>
                    </div>
                  </div>

                  {/* Trading History */}
                  <div>
                    <h3 className="font-semibold mb-3">Trading History</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      <div className="bg-muted/50 rounded-lg p-3">
                        {nftDetails.transactions && nftDetails.transactions.length > 0 ? (
                          nftDetails.transactions.slice(0, 3).map((transaction, index) => (
                            <div key={transaction.id} className="flex justify-between items-center text-xs">
                              <span className="capitalize">{transaction.transactionType}</span>
                              <span>{parseFloat(transaction.amount).toFixed(0)} USDC</span>
                              <span className="text-muted-foreground">
                                {formatDate(transaction.createdAt)}
                              </span>
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