"use server";

import { PinataSDK } from "pinata-web3";
import axios from "axios";

// Ensure environment variables are set
if (!process.env.PINATA_JWT) {
  throw new Error("PINATA_JWT environment variable is not set");
}
if (!process.env.NEXT_PUBLIC_PINATA_GATEWAY) {
  throw new Error("NEXT_PUBLIC_PINATA_GATEWAY environment variable is not set");
}

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});

export const upload = async (data: FormData) => {
  try {
    const file = data.get("file");

    if (!(file instanceof File)) {
      throw new Error("Invalid file type");
    }

    const uploadResult = await pinata.upload.file(file);
    console.log("Upload successful. IPFS Hash:", uploadResult.IpfsHash);

    // Uncomment and modify as needed
    // const res = await axios.post("https://solface-fastapi.onrender.com/upload", {
    //   id: uploadResult.IpfsHash,
    //   url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${uploadResult.IpfsHash}`
    // });

    return { 
      hash: uploadResult.IpfsHash,
      url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${uploadResult.IpfsHash}`
    };
  } catch (error) {
    console.error("File upload error:", error);
    
    if (error instanceof Error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
    
    throw new Error("An unknown error occurred during file upload");
  }
};

export const getFile = async (hash: string, type: string) => {
  try {
    const data = await pinata.gateways.get(hash);
    console.log("Retrieved file data:", data);
    return data;
  } catch (error) {
    console.error("Error retrieving file:", error);
    
    if (error instanceof Error) {
      throw new Error(`File retrieval failed: ${error.message}`);
    }
    
    throw new Error("An unknown error occurred while retrieving the file");
  }
};