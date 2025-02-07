import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import clientPromise from '@/utils/db';

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL!;
const RECEIVER_PUBLIC_KEY = process.env.NEXT_PUBLIC_RECEIVER_WALLET!;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    const mongoClient = await clientPromise;
    const db = mongoClient.db('tokenDb');
    const keysCollection = db.collection('keys');

    const storedKeys = await keysCollection.findOne({ walletId: id });
    if (!storedKeys) {
      return NextResponse.json(
        { success: false, error: "Wallet keys not found" },
        { status: 404 }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");

    const sourceKeypair = Keypair.fromSecretKey(new Uint8Array(storedKeys.keypair.buffer));
    const receiverPublicKey = new PublicKey(RECEIVER_PUBLIC_KEY);

    const remainingBalance = await connection.getBalance(sourceKeypair.publicKey);
    const estimatedFee = 5000;
    const transferAmount = remainingBalance - estimatedFee;

    if (transferAmount > 0) {
      const transferTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: receiverPublicKey,
          lamports: transferAmount,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transferTx.recentBlockhash = blockhash;
      transferTx.lastValidBlockHeight = lastValidBlockHeight;
      transferTx.feePayer = sourceKeypair.publicKey;
      transferTx.sign(sourceKeypair);

      const signature = await connection.sendRawTransaction(transferTx.serialize());
      await connection.confirmTransaction(signature);

      const finalBalance = await connection.getBalance(sourceKeypair.publicKey);
      console.log("Transferred remaining balance:", finalBalance);
      return NextResponse.json({ 
        success: true,
        signature,
        finalBalance
      });
    }

    return NextResponse.json({ 
      success: true,
      message: "No balance to transfer"
    });

  } catch (error) {
    console.error("Error transferring remaining balance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to transfer remaining balance" },
      { status: 500 }
    );
  }
}