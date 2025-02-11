import { NextResponse } from 'next/server';
import clientPromise from '@/utils/db';
import { TokenData } from '@/types/token';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("tokenDb");
    
    const data = await request.json();
    console.log("Received token data:", data);
    
    if (!data.targetWallet) {
      console.error('Missing target wallet:', data);
      return NextResponse.json(
        { success: false, error: 'Missing target wallet data' },
        { status: 400 }
      );
    }

    const token: TokenData = {
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
      tokenDescription: data.tokenDescription,
      imageUrl: data.imageUrl,
      twitterLink: data.twitterLink,
      websiteLink: data.websiteLink,
      telegramLink: data.telegramLink,
      fundingWallet: data.fundingWallet,
      fundingSignature: data.fundingSignature,
      solAmount: data.solAmount,
      targetWallet: data.targetWallet,
      createdAt: new Date()
    };

    const result = await db.collection('tokens').insertOne(token);
    const insertedToken: TokenData = { ...token, _id: result.insertedId };
    
    return NextResponse.json({ 
      success: true, 
      data: insertedToken,
      tokenId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Failed to store token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store token data' },
      { status: 500 }
    );
  }
}