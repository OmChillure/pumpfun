import mongoose from 'mongoose';

const TokenSchema = new mongoose.Schema({
  tokenMetadata: {
    name: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true
    },
    description: String,
    imageUrl: String,
    socialLinks: {
      twitter: String,
      website: String,
      telegram: String
    }
  },
  wallets: [{
    name: String,
    publicKey: {
      type: String,
      required: true
    },
    balance: Number,
    keypair: [Number],
    mint: [Number],
    tokenUrl: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Token = mongoose.models.Token || mongoose.model('Token', TokenSchema);