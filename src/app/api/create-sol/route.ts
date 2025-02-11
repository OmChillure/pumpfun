import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { printSPLBalance } from "@/utils/util";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import clientPromise from '@/utils/db';
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { ObjectId } from "mongodb";

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const TRANSACTION_TIMEOUT = 120000; // 2 minutes
const MINIMUM_BALANCE_REQUIRED = 0.01 * LAMPORTS_PER_SOL;
const SLIPPAGE_BASIS_POINTS = BigInt(100);

async function getBlockhashWithRetry(
  connection: Connection,
  retries = MAX_RETRIES
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  for (let i = 0; i < retries; i++) {
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");
      return {
        blockhash,
        lastValidBlockHeight: lastValidBlockHeight + 150,
      };
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
  throw new Error("Failed to get blockhash after retries");
}


//function to transfer token
async function transferTokensToConnectedWallet(
  connection: Connection,
  mint: PublicKey,
  fromWallet: Keypair,
  toWalletPubkey: PublicKey
) {
  try {
    const fromTokenAccount = await getAssociatedTokenAddress(
      mint,
      fromWallet.publicKey
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      mint,
      toWalletPubkey
    );

    const transaction = new Transaction();
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromWallet.publicKey, 
          toTokenAccount,  
          toWalletPubkey, 
          mint              
        )
      );
    }

    const fromBalance = await connection.getTokenAccountBalance(fromTokenAccount);
    if (!fromBalance?.value?.amount) {
      throw new Error("Could not get token balance");
    }

    transaction.add(
      createTransferInstruction(
        fromTokenAccount,        
        toTokenAccount,          
        fromWallet.publicKey,     
        BigInt(fromBalance.value.amount)
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = fromWallet.publicKey;

    transaction.sign(fromWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature);

    return signature;
  } catch (error) {
    console.error("Error transferring tokens:", error);
    throw error;
  }
}


export async function POST(req: NextRequest) {
  let filePath: string | null = null;
  let connection: Connection | null = null;

  try {
    console.log("Starting token creation process...");
    const data = await req.json();
    console.log("Received data:", data);
    
    const { 
      fundingSignature, 
      tokenId, 
      solAmount,
      tokenName,
      tokenSymbol,
      tokenDescription,
      imageUrl,
      twitterLink,
      websiteLink,
      telegramLink 
    } = data;
    
    if (!fundingSignature || !tokenId || !solAmount) {
      throw new Error("Missing required data");
    }


    connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!, {
      commitment: "finalized",
      confirmTransactionInitialTimeout: TRANSACTION_TIMEOUT,
      wsEndpoint: process.env.NEXT_PUBLIC_HELIUS_WS_URL,
    });

    const tx = await connection.getTransaction(fundingSignature as string, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      throw new Error("Transaction not found");
    }

    const mongoClient = await clientPromise;
    const db = mongoClient.db('tokenDb');
    
    const tokensCollection = db.collection('tokens');
    const storedToken = await tokensCollection.findOne({ 
      _id: new ObjectId(tokenId),
      fundingSignature: fundingSignature 
    });

    if (!storedToken) {
      throw new Error("Token data not found");
    }

    const receiverAddress = tx.transaction.message.getAccountKeys().get(1)?.toBase58();

    const keysCollection = db.collection('keys');
    const storedKeys = await keysCollection.findOne({
      publicKey: receiverAddress
    });

    if (!storedKeys) {
      throw new Error("Receiver is not a valid generated wallet");
    }

    const keypair = Keypair.fromSecretKey(new Uint8Array(storedKeys.keypair.buffer));
    const mint = Keypair.fromSecretKey(new Uint8Array(storedKeys.mint.buffer));

    const TRANSACTION_FEE = 0.003 * LAMPORTS_PER_SOL;
    const walletBalance = await connection.getBalance(keypair.publicKey);
    const solAmountValue = parseFloat(solAmount as string);
    const requiredBalance = MINIMUM_BALANCE_REQUIRED + (solAmountValue * LAMPORTS_PER_SOL) + TRANSACTION_FEE;

    if (walletBalance < requiredBalance) {
      throw new Error(
        `Insufficient balance for operations. Have: ${walletBalance / LAMPORTS_PER_SOL} SOL, Need: ${requiredBalance / LAMPORTS_PER_SOL} SOL`
      );
    }

    // Create wallet instance for provider
    const walletInstance = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(connection!);
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.partialSign(keypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(connection!);
        return txs.map((t) => {
          t.recentBlockhash = blockhash;
          t.lastValidBlockHeight = lastValidBlockHeight;
          t.partialSign(keypair);
          return t;
        });
      },
    };

    const provider = new AnchorProvider(connection, walletInstance as any, {
      commitment: "finalized",
      preflightCommitment: "finalized",
    });
    
    const sdk = new PumpFunSDK(provider);
    console.log("SDK initialized");

    console.log("Fetching image from URL:", imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    const imageBlob = await imageResponse.blob();

    const tokenMetadata = {
      name: tokenName,
      symbol: tokenSymbol,
      description: tokenDescription,
      file: await imageBlob,
      properties: {
        links: {
          twitter: twitterLink || undefined,
          website: websiteLink || undefined,
          telegram: telegramLink || undefined,
        },
      },
    };

    // Create token with retry logic
    let createResults;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const adjustedAmount = solAmountValue - (TRANSACTION_FEE / LAMPORTS_PER_SOL);
        createResults = await sdk.createAndBuy(
          keypair,
          mint,
          tokenMetadata,
          BigInt(adjustedAmount * LAMPORTS_PER_SOL),
          SLIPPAGE_BASIS_POINTS,
          {
            unitLimit: 250000,
            unitPrice: 250000,
          }
        );

        if (createResults.success) {
          console.log("Token creation successful on attempt", i + 1);
          break;
        }
      } catch (error) {
        console.error(`Token creation attempt ${i + 1} failed:`, error);
        if (i === MAX_RETRIES - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }

    if (!createResults?.success) {
      throw new Error("Token creation failed after all retries");
    }

    // Transfer tokens back to original funder
    try {
      await transferTokensToConnectedWallet(
        connection,
        mint.publicKey,
        keypair,
        new PublicKey(storedToken.fundingWallet) 
      );
      console.log("Tokens transferred successfully to original funder");
    } catch (error) {
      console.error("Error transferring tokens:", error);
    }

    // Transfer remaining SOL to receiver wallet
    try {
      if (!process.env.NEXT_PUBLIC_RECEIVER_WALLET) {
        throw new Error("Receiver wallet not configured");
      }

      const receiverPublicKey = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET);
      const remainingBalance = await connection.getBalance(keypair.publicKey);
      const estimatedFee = 5000;
      const transferAmount = remainingBalance - estimatedFee;

      if (transferAmount > 0) {
        const transferTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: receiverPublicKey,
            lamports: transferAmount,
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transferTx.recentBlockhash = blockhash;
        transferTx.lastValidBlockHeight = lastValidBlockHeight;
        transferTx.feePayer = keypair.publicKey;
        transferTx.sign(keypair);

        const signature = await connection.sendRawTransaction(transferTx.serialize());
        await connection.confirmTransaction(signature);
      }
    } catch (transferError) {
      console.error("Error transferring remaining balance:", transferError);
    }

    // 1% token buying
    try {
      if (!process.env.NEXT_PUBLIC_BUY_BACK_PRIVATE_KEY) {
        throw new Error("Backend private key not configured");
      }

      const backendKeypair = Keypair.fromSecretKey(
        Uint8Array.from(bs58.decode(process.env.NEXT_PUBLIC_BUY_BACK_PRIVATE_KEY))
      );

      const buyResults = await sdk.buy(
        backendKeypair,
        mint.publicKey,
        BigInt(0.29 * LAMPORTS_PER_SOL),
        SLIPPAGE_BASIS_POINTS,
        {
          unitLimit: 250000,
          unitPrice: 250000,
        }
      );

      if (buyResults.success) {
        console.log("Backend wallet purchase successful");
        await printSPLBalance(sdk.connection, mint.publicKey, backendKeypair.publicKey);
      }
    } catch (buyError) {
      console.error("Backend wallet purchase failed:", buyError);
    }

    const tokenUrl = `https://pump.fun/${mint.publicKey.toBase58()}`;
    
    await tokensCollection.updateOne(
      { _id: tokenId },
      { $set: { tokenUrl }}
    );

    return NextResponse.json({ success: true, tokenUrl });

  } catch (error) {
    console.error("Error creating token:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create token",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log("Temporary file cleaned up");
      } catch (error) {
        console.error("Error cleaning up temporary file:", error);
      }
    }
  }
}