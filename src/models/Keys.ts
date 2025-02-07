import mongoose from 'mongoose';

const KeysSchema = new mongoose.Schema({
  walletId: {
    type: String,
    required: true,
    unique: true
  },
  keypair: {
    type: Buffer,
    required: true
  },
  mint: {
    type: Buffer,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  mintPublicKey: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    //added this , as it will delete keys after 1 hour, remove it if you want to keep keys forever
    expires: 3600 
  }
});

export const Keys = mongoose.models.Keys || mongoose.model('Keys', KeysSchema);