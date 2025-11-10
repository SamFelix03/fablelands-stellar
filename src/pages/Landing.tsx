import React from "react";
import { useWallet } from "../hooks/useWallet";
import { connectWallet } from "../util/wallet";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing: React.FC = () => {
  const { address, isPending } = useWallet();
  const navigate = useNavigate();

  React.useEffect(() => {
    // If wallet is already connected, redirect to home
    if (address) {
      navigate("/home");
    }
  }, [address, navigate]);

  const handleConnectWallet = async () => {
    await connectWallet();
    // Navigation will happen automatically via useEffect when address is set
  };

  return (
    <main className="min-h-screen flex flex-col dotted-background">
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="w-full max-w-4xl flex flex-col items-center text-center">
          <h1
            className="text-7xl font-chango text-center tracking-tight leading-none mb-6"
            style={{
              textShadow: "4px 4px 0px #FFD700",
              letterSpacing: "1px",
              color: "#000",
            }}
          >
            FableLands
          </h1>
          
          <p className="text-xl text-gray-700 mb-4 max-w-2xl">
            Your virtual pets on Stellar blockchain. Chat with them, feed them, and watch them evolve!
          </p>

          <Button
            size="lg"
            onClick={handleConnectWallet}
            disabled={isPending}
            className="text-lg px-12 py-6"
          >
            {isPending ? "Loading..." : "Connect Your Wallet"}
          </Button>
        </div>
      </div>
      
      <footer className="py-4 w-full bg-black text-white">
        <div className="flex items-center justify-center text-sm">
          <span>© {new Date().getFullYear()} Pet World. Licensed under the{" "}
            <a
              href="http://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-400 transition-colors"
            >
              Apache License, Version 2.0
            </a>
            .
          </span>
        </div>
      </footer>
    </main>
  );
};

export default Landing;

