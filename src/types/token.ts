import { ObjectId } from "mongodb";

export interface WalletInfo {
  id: any;
  name: string;
  publicKey: string;
  balance: number;
  keypair: number[];
  mint: number[];
  tokenUrl?: string;
}

export interface WalletGenerationProgress {
  current: number;
  total: number;
  status: string;
}

export interface TokenData {
  _id?: ObjectId;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  imageUrl: string;
  twitterLink?: string;
  websiteLink?: string;
  telegramLink?: string;
  fundingWallet: string;
  fundingSignature: string;
  solAmount: string;
  targetWallet: string;
  createdAt: Date;
}

export interface WalletInfo {
  name: string;
  publicKey: string;
  balance: number;
  keypair: number[];
  mint: number[];
  tokenUrl?: string;
}

export interface TokenResponse {
  success: boolean;
  tokenUrl?: string;
  error?: string;
}

export interface StoreResponse {
  success: boolean;
}
