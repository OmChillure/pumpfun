import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getFile, upload } from "@/app/actions";
import { printSPLBalance } from "@/utils/util";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";

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

async function waitForBalance(
  connection: Connection,
  publicKey: PublicKey,
  expectedBalance: number,
  maxAttempts = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const balance = await connection.getBalance(publicKey);
    if (balance >= expectedBalance) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

//function to transfer token
export async function transferTokensToConnectedWallet(
  connection: Connection,
  mint: PublicKey,
  fromWallet: Keypair,
  toWalletPubkey: PublicKey
) {
  try {
    // Get the token account of the fromWallet address
    const fromTokenAccount = await getAssociatedTokenAddress(
      mint,
      fromWallet.publicKey
    );

    // Get the token account of the toWallet address
    const toTokenAccount = await getAssociatedTokenAddress(
      mint,
      toWalletPubkey
    );

    const transaction = new Transaction();

    // Check if the receiver's token account exists
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    
    // If the token account doesn't exist, create it
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
    
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,        
        toTokenAccount,          
        fromWallet.publicKey,     
        BigInt(fromBalance.value.amount)
      )
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = fromWallet.publicKey;

    // Sign and send transaction
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

    const data = await req.formData();
    console.log("Form data received");
    const solAmount = data.get("solAmount");
    if (!solAmount) throw new Error("No SOL amount provided");

    const uploadResult = await upload(data);
    console.log("File uploaded to IPFS:", uploadResult.hash);

    const walletDataRaw = data.get("walletData");
    if (!walletDataRaw) throw new Error("No wallet data provided");

    const walletData = JSON.parse(walletDataRaw as string);
    console.log("Wallet data parsed successfully");

    let retryCount = 0;
    while (!connection && retryCount < MAX_RETRIES) {
      try {
        connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!, {
          commitment: "finalized",
          confirmTransactionInitialTimeout: TRANSACTION_TIMEOUT,
          wsEndpoint: process.env.NEXT_PUBLIC_HELIUS_WS_URL,
        });
        console.log("Connection established");
      } catch (e) {
        retryCount++;
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
    if (!connection) throw new Error("Failed to establish connection");

    // Create keypairs from wallet data
    const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData.keypair));
    const mint = Keypair.fromSecretKey(Uint8Array.from(walletData.mint));
    console.log("Created Keypairs:");
    console.log("Main Keypair:", {
      publicKey: keypair.publicKey.toString(),
    });
    console.log("Mint Keypair:", {
      publicKey: mint.publicKey.toString(),
    });
    
    console.log("Keypairs created");


    console.log("Checking initial balance...");
    const TRANSACTION_FEE = 0.003 * LAMPORTS_PER_SOL;
    const walletBalance = await connection.getBalance(keypair.publicKey);
    const solAmountValue = parseFloat(solAmount as string);
    const requiredBalance = MINIMUM_BALANCE_REQUIRED + (solAmountValue * LAMPORTS_PER_SOL) + TRANSACTION_FEE;

    if (walletBalance < requiredBalance) {
      throw new Error(
        `Insufficient balance for operations. Have: ${walletBalance / LAMPORTS_PER_SOL} SOL, Need: ${requiredBalance / LAMPORTS_PER_SOL} SOL`
      );
    }

    console.log("Sufficient balance confirmed:", walletBalance / LAMPORTS_PER_SOL, "SOL");

    // Create wallet instance for provider
    const walletInstance = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(
          connection!
        );
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.partialSign(keypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(
          connection!
        );
        return txs.map((t) => {
          t.recentBlockhash = blockhash;
          t.lastValidBlockHeight = lastValidBlockHeight;
          t.partialSign(keypair);
          return t;
        });
      },
    };

    // Initialize provider and SDK
    const provider = new AnchorProvider(connection, walletInstance as any, {
      commitment: "finalized",
      preflightCommitment: "finalized",
    });
    const sdk = new PumpFunSDK(provider);
    console.log("SDK initialized");

    const ipfsData = await getFile(
      uploadResult.hash,
      "application/octet-stream"
    );
    const fileBlob = new Blob([JSON.stringify(ipfsData)], {
      type: "application/octet-stream",
    });

    const tokenMetadata = {
      name: data.get("tokenName") as string,
      symbol: data.get("tokenSymbol") as string,
      description: data.get("tokenDescription") as string,
      file: await fileBlob,
      properties: {
        links: {
          twitter: data.get("twitterLink") || undefined,
          website: data.get("websiteLink") || undefined,
          telegram: data.get("telegramLink") || undefined,
        },
      },
    };
  
    console.log("Token metadata prepared");

    // Create token with retry logic
    console.log("Creating token...");
    let createResults;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const adjustedAmount = solAmountValue - (TRANSACTION_FEE / LAMPORTS_PER_SOL);
        createResults = await sdk.createAndBuy(
          keypair,
          mint,
          tokenMetadata,
          BigInt(adjustedAmount  * LAMPORTS_PER_SOL),
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
    
    try {
      const originalFunder = data.get("originalFunder");
      if (!originalFunder) {
        throw new Error("No original funder provided");
      }
    
      await transferTokensToConnectedWallet(
        connection,
        mint.publicKey,
        keypair,
        new PublicKey(originalFunder)
      );
      
      console.log("Tokens transferred successfully to original funder");
    } catch (error) {
      console.error("Error transferring tokens:", error);
    }

    const tokenUrl = `https://pump.fun/${mint.publicKey.toBase58()}`;
    console.log("Success:", tokenUrl);
    await printSPLBalance(sdk.connection, mint.publicKey, keypair.publicKey);

    return NextResponse.json({ success: true, tokenUrl });
  } catch (error) {
    console.error("Error creating token:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create token",
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