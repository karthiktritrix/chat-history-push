const PushAPI = require('@pushprotocol/restapi');
const { ethers } = require('ethers');
require('dotenv').config();

const decryptPGPPrivateKey = async () => {
  try {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY); // Store your private key in .env

    // Replace 'ENCRYPTED_PGP_PRIVATE_KEY' with the key you fetched in the previous step
    const encryptedPGPPrivateKey = 'ENCRYPTED_PGP_PRIVATE_KEY'; 

    // Decrypt the PGP private key
    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer: wallet,
      encryptedPGPPrivateKey: encryptedPGPPrivateKey,
    });

    console.log('Decrypted PGP Private Key:', pgpPrivateKey);

    // Store this securely for use in your backend
  } catch (error) {
    console.error('Error decrypting PGP private key:', error.message);
  }
};

decryptPGPPrivateKey();
