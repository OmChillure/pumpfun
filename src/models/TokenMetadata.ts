import mongoose from 'mongoose';

const TokenMetadataSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true 
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
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const TokenMetadata = mongoose.models.TokenMetadata || mongoose.model('TokenMetadata', TokenMetadataSchema);