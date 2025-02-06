import { NextResponse } from 'next/server';
import clientPromise from '@/utils/db';
import { TokenData, WalletInfo } from '@/types/token';

export async function POST(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("tokenDb");
    
    const data = await request.json();
    
    console.log("Received token data:", data);
    
    if (!data.wallets || !Array.isArray(data.wallets) || data.wallets.length === 0) {
      console.error('Invalid or empty wallets array:', data.wallets);
      return NextResponse.json(
        { success: false, error: 'Invalid wallets data' },
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
      launchInterval: data.launchInterval,
      fundingWallet: data.fundingWallet,
      wallets: data.wallets.map((wallet: WalletInfo) => ({
        name: wallet.name,
        publicKey: wallet.publicKey,
        balance: wallet.balance,
        keypair: wallet.keypair,
        mint: wallet.mint,
        tokenUrl: wallet.tokenUrl
      })),
      createdAt: new Date()
    };

    const result = await db.collection('tokens').insertOne(token);
    const insertedToken: TokenData = { ...token, _id: result.insertedId };
    
    return NextResponse.json({ success: true, data: insertedToken });
  } catch (error) {
    console.error('Failed to store token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store token data' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    
    const client = await clientPromise;
    const db = client.db("tokenDb");
    
    const query = search ? {
      $or: [
        { tokenName: { $regex: search, $options: 'i' } },
        { tokenSymbol: { $regex: search, $options: 'i' } }
      ]
    } : {};
    
    const tokens = await db.collection('tokens')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}