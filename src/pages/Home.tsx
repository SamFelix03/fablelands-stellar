import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { PetList } from "../components/PetList";
import { PetDetail } from "../components/PetDetail";
import { WalletButton } from "../components/WalletButton";

const Home: React.FC = () => {
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const { address } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to landing if no wallet connected
    if (!address) {
      navigate("/");
    }
  }, [address, navigate]);

  if (!address) {
    return null; // Will redirect
  }

  return (
    <main className="min-h-screen dotted-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1
            className="text-5xl font-chango tracking-tight leading-none"
            style={{
              textShadow: "4px 4px 0px #FFD700",
              letterSpacing: "1px",
              color: "#000",
            }}
          >
            🐾 PET WORLD
          </h1>
          <WalletButton />
        </div>

        {selectedPetId === null ? (
          <PetList 
            onSelectPet={(tokenId) => setSelectedPetId(tokenId)}
            selectedPetId={selectedPetId}
          />
        ) : (
          <PetDetail 
            tokenId={selectedPetId}
            onBack={() => setSelectedPetId(null)}
          />
        )}
      </div>
    </main>
  );
};

export default Home;
