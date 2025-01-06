const PushAPI = require('@pushprotocol/restapi');
const { ethers } = require('ethers');
require('dotenv').config();

const fetchEncryptedPGPPrivateKey = async () => {
  try {
    // Initialize a wallet with your private key
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

    // Fetch user details, including the encrypted PGP private key
    const user = await PushAPI.user.get({
      account: `eip155:${wallet.address}`, // Your wallet address in eip155 format
      env: 'prod', // Use 'staging' for testing
    });

    if (!user || !user.encryptedPrivateKey) {
      console.error('PGP private key not found for this account. Ensure the wallet is onboarded.');
      return;
    }

    console.log('Encrypted PGP Private Key:', user.encryptedPrivateKey);
  } catch (error) {
    console.error('Error fetching encrypted PGP private key:', error.message);
  }
};

fetchEncryptedPGPPrivateKey();
