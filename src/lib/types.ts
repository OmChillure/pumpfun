// lib/types.ts
export interface WalletInfo {
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
  tokenName: string;
  tokenSymbol: string;
  tokenDesc?: string;
  imageUrl?: string;
  tokenUrl?: string;
  twitterLink?: string;
  websiteLink?: string;
  telegramLink?: string;
}
