"use client"

import React, { useRef, useState, ChangeEvent, FormEvent } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { WalletInfo, TokenResponse, StoreResponse } from "@/types/token";
import { DollarSign, Upload, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "";
const BASE_AMOUNT = 0.035 * LAMPORTS_PER_SOL;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_RECEIVER_WALLET;

const WalletGenerator = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDesc, setTokenDesc] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [twitterLink, setTwitterLink] = useState("");
  const [websiteLink, setWebsiteLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [solAmount, setSolAmount] = useState("0.001");

  const generateWallet = async (solAmount: string) => {
    const response = await fetch("/api/generate-wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ solAmount }),
    });

    const result = await response.json();
    console.log("Privareeeeeeeeeeeeeeeeeeeeeeeee", result)
    if (!result.success) {
      throw new Error(result.error || "Failed to generate wallet");
    }

    return result.data;
  };
 
  //main submit function
  const handleSubmitSOL = async (e: FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a token image");
      return;
    }

    if (!tokenName || !tokenSymbol) {
      toast.error("Please enter token name and symbol");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const walletInfo = await generateWallet(solAmount);
      
      const connection = new Connection(RPC_URL, {
        commitment: "finalized",
        confirmTransactionInitialTimeout: 120000,
      });

      const fundingWalletBalance = await connection.getBalance(publicKey);
      const AMOUNT_PER_WALLET = BASE_AMOUNT + (parseFloat(solAmount) * LAMPORTS_PER_SOL);
      
      if (fundingWalletBalance < AMOUNT_PER_WALLET) {
        throw new Error(`Insufficient balance. Required: ${AMOUNT_PER_WALLET / LAMPORTS_PER_SOL} SOL`);
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(walletInfo.publicKey),
          lamports: AMOUNT_PER_WALLET,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("tokenName", tokenName);
      formData.append("tokenSymbol", tokenSymbol);
      formData.append("tokenDescription", tokenDesc);
      formData.append("originalFunder", publicKey.toString());
      formData.append("solAmount", solAmount);
      formData.append("walletData", JSON.stringify(walletInfo));

      if (twitterLink) formData.append("twitterLink", twitterLink);
      if (websiteLink) formData.append("websiteLink", websiteLink);
      if (telegramLink) formData.append("telegramLink", telegramLink);

      const tokenResponse = await fetch("/api/create-sol", {
        method: "POST",
        body: formData,
      });

      const tokenResult = await tokenResponse.json();
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || "Failed to create token");
      }

      const newWallet = {
        id: walletInfo.id,
        name: "Token Wallet",
        publicKey: walletInfo.publicKey,
        balance: await connection.getBalance(new PublicKey(walletInfo.publicKey)) / LAMPORTS_PER_SOL,
        keypair: walletInfo.keypair,
        mint: walletInfo.mint,
        tokenUrl: tokenResult.tokenUrl,
      };

      setWallet(newWallet);
      toast.success("Wallet and token created successfully!");

      await storeTokenData(newWallet, publicKey.toString());

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const storeTokenData = async (newWallet: WalletInfo, fundingWallet: string) => {
    const tokenData = {
      tokenName,
      tokenSymbol,
      tokenDescription: tokenDesc,
      imageUrl: imagePreview,
      twitterLink,
      websiteLink,
      telegramLink,
      wallets: [newWallet],
      fundingWallet,
    };

    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenData),
    });

    const result = await response.json() as StoreResponse;
    if (!result.success) {
      throw new Error("Failed to store token data");
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log(file);
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
      <p className="text-xl text-gray-600 text-center">Create your token with a dedicated wallet.</p>
    </div>
    <div>
      <form className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="tokenImage" className="text-[13px] font-lexend font-medium mb-2 sm:block hidden">Token Image</label>
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
              <label htmlFor="tokenName" className="block text-sm font-medium">Token Name</label>
              <input
                id="tokenName"
                type="text"
                placeholder="Enter token name"
                className="w-full px-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                value={tokenName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTokenName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tokenSymbol" className="block text-sm font-medium">Token Symbol</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="tokenSymbol"
                  type="text"
                  placeholder="Enter token symbol"
                  className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                  value={tokenSymbol}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTokenSymbol(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="tokenDesc" className="block text-sm font-medium">Token Description</label>
            <textarea
              id="tokenDesc"
              placeholder="Enter token description"
              className="w-full px-3 py-2 border rounded-md min-h-[100px] bg-white/90 border-gray-400 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
              value={tokenDesc}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTokenDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="solAmount" className="block text-sm font-medium">SOL Amount</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="solAmount"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="Enter SOL amount"
                className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                value={solAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSolAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="text-3xl">Socials</div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[13px] font-lexend font-medium mb-2 block">Twitter Link</label>
              <input
                type="url"
                placeholder="https://x.com/.."
                value={twitterLink}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTwitterLink(e.target.value)}
                className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
              />
            </div>

            <div>
              <label className="text-[13px] font-lexend font-medium mb-2 block">Website Link</label>
              <input
                type="url"
                placeholder="https://yourwebsite.com"
                value={websiteLink}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsiteLink(e.target.value)}
                className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
              />
            </div>

            <div>
              <label className="text-[13px] font-lexend font-medium mb-2 block">Telegram Link</label>
              <input
                type="url"
                placeholder="https://t.me/.."
                value={telegramLink}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTelegramLink(e.target.value)}
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
            <p className="font-mono text-sm break-all mt-1">Public Key: {wallet.publicKey}</p>
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
                <summary className="cursor-pointer text-blue-500">Show Keys</summary>
                <div className="mt-2 space-y-2">
                  <p className="font-mono break-all">
                    <span className="font-semibold">Keypair:</span> {JSON.stringify(wallet.keypair)}
                  </p>
                  <p className="font-mono break-all">
                    <span className="font-semibold">Mint:</span> {JSON.stringify(wallet.mint)}
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
    <div className="h-20" />
  </div>
);
};

export default WalletGenerator;