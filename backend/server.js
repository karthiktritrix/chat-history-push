const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const PushAPI = require("@pushprotocol/restapi");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
let requests = []; // Temporary storage for requests

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Load requests from the file if it exists
if (fs.existsSync("requests.json")) {
  try {
    requests = JSON.parse(fs.readFileSync("requests.json", "utf-8"));
    console.log("Loaded requests from file:", requests);
  } catch (error) {
    console.error("Error loading requests.json:", error);
    requests = [];
  }
}

// Helper function to save requests to a file
function saveRequests() {
  fs.writeFileSync("requests.json", JSON.stringify(requests, null, 2));
  console.log("Requests saved to file.");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Helper function to send a message
const sendMessage = async ({
  receiverAddress,
  messageContent,
  messageType,
}) => {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
  const response = await PushAPI.chat.send({
    messageContent,
    messageType,
    receiverAddress,
    signer,
  });
  return response;
};

// Send a chat request
// app.post("/send-request", async (req, res) => {
//   const { senderAddress, receiverAddress } = req.body;

//   if (!senderAddress || !receiverAddress) {
//     return res.status(400).json({ success: false, message: "Invalid data" });
//   }

//   try {
//     // Add the request to the temporary storage
//     requests.push({ senderAddress, receiverAddress, status: "Pending" });

//     res.status(200).json({ success: true, message: "Chat request sent" });
//   } catch (error) {
//     console.error("Error sending request:", error.message);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// Send a chat request
app.post("/send-request", async (req, res) => {
  const { senderAddress, receiverAddress } = req.body;

  if (!senderAddress || !receiverAddress) {
    return res.status(400).json({ success: false, message: "Invalid data" });
  }

  try {
    // Add the request to the temporary storage
    const newRequest = { senderAddress, receiverAddress, status: "Pending" };
    requests.push(newRequest);

    saveRequests(); // Save the updated array to the file

    console.log("New request added:", newRequest);
    console.log("Updated requests array:", requests);

    res.status(200).json({ success: true, message: "Chat request sent" });
  } catch (error) {
    console.error("Error sending request:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending requests for a user
app.get("/get-requests/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  console.log("Available methods in PushAPI.chat:", Object.keys(PushAPI.chat));

  try {
    console.log("Fetching requests for wallet:", walletAddress);

    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);

    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer,
      encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
    });

    // Fetch pending requests
    const pendingRequests = await PushAPI.chat.requests({
      account: walletAddress,
      toDecrypt: true,
      pgpPrivateKey,

      env: "prod",
    });

    console.log("Fetched pending requests:", pendingRequests);

    const formattedRequests = pendingRequests.map((req) => ({
      senderAddress: req.did ? req.did.split(":")[1] : "Unknown",
      message: req.messageContent || "No message",
      publicKey: req.did ? req.did.split(":")[1] : "No Public Key", // Extract wallet address
      timestamp: req.timestamp
        ? new Date(req.timestamp).toLocaleString()
        : "N/A",
    }));

    res.status(200).json({ success: true, requests: formattedRequests });
  } catch (error) {
    console.error("Error fetching requests:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/get-chat-details/:chatAddress/:userAddress", async (req, res) => {
  const { chatAddress, userAddress } = req.params;

  try {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer,
      encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
    });

    const chats = await PushAPI.chat.chats({
      account: userAddress,
      toDecrypt: true,
      pgpPrivateKey,
      env: "prod",
    });

    const chatThread = chats.find((chat) => {
      const fromAddress = chat.msg?.fromDID?.split(":")[1];
      const toAddress = chat.msg?.toDID?.split(":")[1];
      return fromAddress === chatAddress || toAddress === chatAddress;
    });

    if (!chatThread) {
      return res.status(404).json({
        success: false,
        message: "Chat thread not found",
      });
    }

    res.status(200).json({
      success: true,
      threadHash: chatThread.threadhash,
      chatId: chatThread.chatId,
    });
  } catch (error) {
    console.error("Error fetching chat details:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Accept or reject a request
app.post("/update-request", async (req, res) => {
  const { senderAddress, receiverAddress, status } = req.body;

  if (!senderAddress || !receiverAddress || !status) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required parameters" });
  }

  try {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);

    // Use the update method to manage chat requests
    await PushAPI.chat.update({
      recipient: senderAddress,
      status, // Pass "Accepted" or "Rejected" as the status
      signer,
      env: "prod", // Ensure you're using the correct environment
    });

    res.status(200).json({ success: true, message: `Request ${status}` });
  } catch (error) {
    console.error("Error processing request:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update request" });
  }
});

// 1. Send a text  message
app.post("/send-text", async (req, res) => {
  const { receiverAddress, messageContent } = req.body;
  try {
    const response = await sendMessage({
      receiverAddress,
      messageContent,
      messageType: "Text",
    });
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error sending text message:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Send an image
app.post("/send-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    const imagePath = `uploads/${req.file.filename}`;
    const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
    const messageContent = `data:${req.file.mimetype};base64,${imageBase64}`;
    const { receiverAddress } = req.body;
    const response = await sendMessage({
      receiverAddress,
      messageContent,
      messageType: "Image",
    });
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error sending image:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// app.get("/get-chat-history", async (req, res) => {
//   try {
//     const { account, threadHash } = req.query;
//     if (!account || !threadHash) {
//       return res.status(400).json({ message: "Missing account or threadHash" });
//     }

//     const chatHistory = await getChatHistoryFromDatabase(account, threadHash);
//     res.status(200).json({ success: true, data: chatHistory });
//   } catch (error) {
//     console.error("Error fetching chat history:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// 3. Send a GIF
app.post("/send-gif", async (req, res) => {
  const { receiverAddress, gifUrl } = req.body;

  try {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);

    console.log("Sending GIF to:", receiverAddress);
    console.log("GIF URL:", gifUrl);

    // Use PushAPI to send the GIF as a MediaEmbed type
    const response = await PushAPI.chat.send({
      messageContent: gifUrl,
      messageType: "MediaEmbed", // MediaEmbed for sending GIFs
      receiverAddress,
      signer,
    });

    console.log("GIF sent successfully:", response);

    res.status(200).json({ success: true, message: "GIF sent successfully!" });
  } catch (error) {
    console.error("Error sending GIF:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Send an emoji
app.post("/send-emoji", async (req, res) => {
  const { receiverAddress, emoji } = req.body;
  try {
    const response = await sendMessage({
      receiverAddress,
      messageContent: emoji,
      messageType: "Text",
    });
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error sending emoji:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Send a document
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.post("/send-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const documentPath = `uploads/${req.file.filename}`;
    const documentBase64 = fs.readFileSync(documentPath, {
      encoding: "base64",
    });

    // Properly formatted content
    const messageContent = JSON.stringify({
      content: `data:${req.file.mimetype};base64,${documentBase64}`, // Embed the file content
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });

    const { receiverAddress } = req.body;

    const response = await sendMessage({
      receiverAddress,
      messageContent, // Send as JSON string
      messageType: "File",
    });

    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error sending document:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

//Fetch Connection
app.get("/get-connections/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  try {
    console.log("Fetching connections for wallet:", walletAddress);

    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);

    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer,
      encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
    });

    const chats = await PushAPI.chat.chats({
      account: walletAddress,
      toDecrypt: false,
      pgpPrivateKey,
      env: "prod",
    });

    console.log("Fetched chats from PushAPI:", JSON.stringify(chats, null, 2));

    const connections = Array.from(
      new Set(
        chats.map((chat) => {
          const fromAddress = chat.msg?.fromDID?.split(":")[1];
          const toAddress = chat.msg?.toDID?.split(":")[1];
          return fromAddress === walletAddress ? toAddress : fromAddress;
        })
      )
    ).filter((connection) => connection !== undefined);

    console.log("Extracted connections:", connections);

    res.status(200).json({ success: true, connections });
  } catch (error) {
    console.error("Error fetching connections:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get messages
app.get("/get-messages/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer,
      encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
    });
    const messages = await PushAPI.chat.chats({
      account: walletAddress,
      toDecrypt: true,
      pgpPrivateKey,
      env: "prod",
    });
    const formattedMessages = messages.map((msg) => ({
      from: msg.msg?.fromDID?.split(":")[1],
      to: msg.msg?.toDID?.split(":")[1],
      content: msg.msg?.messageContent,
      type: msg.msg?.messageType || "Text",
    }));
    res.status(200).json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/get-chat-history", async (req, res) => {
  const { account, threadHash } = req.query;

  if (!account || !threadHash) {
    return res.status(400).json({
      success: false,
      message: "Missing account or threadHash",
    });
  }

  try {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
    const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
      signer,
      encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
    });

    const chatHistory = await PushAPI.chat.history({
      threadhash: threadHash,
      account: account,
      limit: 30,
      toDecrypt: true,
      pgpPrivateKey: pgpPrivateKey,
      env: "prod",
    });

    res.status(200).json({
      success: true,
      data: chatHistory,
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Route to fetch chat history between two users
// app.get("/get-chat-history", async (req, res) => {
//   const { account, threadHash } = req.query;

//   if (!account || !threadHash) {
//     return res.status(400).json({ message: "Missing account or threadHash" });
//   }

//   try {
//     const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
//     const pgpPrivateKey = await PushAPI.chat.decryptPGPKey({
//       signer,
//       encryptedPGPPrivateKey: process.env.ENCRYPTED_PGP_PRIVATE_KEY,
//     });

//     const chatHistory = await PushAPI.chat.history({
//       account: account,
//       threadHash: threadHash,
//       toDecrypt: true,
//       limit: 10,
//       pgpPrivateKey: pgpPrivateKey,
//       env: "prod", // Use the appropriate environment ('prod', 'staging', or 'dev')
//     });

//     res.status(200).json({
//       success: true,
//       data: chatHistory,
//     });
//   } catch (error) {
//     console.error("Error fetching chat history:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

app._router.stack.forEach(function (middleware) {
  if (middleware.route) {
    console.log(middleware.route.path); // Logs the registered routes
  }
});

// Serve static files
app.use("/uploads", express.static("uploads"));
app.use(cors());
app.use(express.json());

app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log("Registered route:", middleware.route.path);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
