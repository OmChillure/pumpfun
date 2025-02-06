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

export interface TokenData {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  imageUrl: string | null;
  twitterLink?: string;
  websiteLink?: string;
  telegramLink?: string;
  wallets: WalletInfo[];
  fundingWallet: string;
}