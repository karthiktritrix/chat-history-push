import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import "react-toastify/dist/ReactToastify.css";
import "./ChatApp.css";
import { ethers } from "ethers"; // Import ethers.js for wallet signer
import * as PushAPI from "@pushprotocol/restapi"; // Import PushAPI

const TENOR_API_KEY = "AIzaSyCRHsgCv5Au_JgsOHufJOvFm0RBryEkB1c";

// const knownThreadHash =
//   "v2:3ef1ca8d192d2aa334ea4ff50dd7884d42cdca623d6baa827616662aad9ae759";

const ChatApp = () => {
  const [selectedTab, setSelectedTab] = useState("Chats"); // Default to "Chats"

  const [walletAddress, setWalletAddress] = useState("");
  const [newReceiver, setNewReceiver] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messages, setMessages] = useState({});
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [chatThreadHashes, setChatThreadHashes] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      if (walletAddress) {
        await Promise.all([
          fetchConnections(),
          // fetchMessages(),
          // fetchChatHistory(selectedChat),
          fetchRequests(),
          // fetchInitialData(),
        ]);
      }
    };

    fetchData();

    // return () => clearInterval(interval);
  }, [walletAddress]); // Ensure dependencies are correctly listed

  useEffect(() => {
    const storedChats = localStorage.getItem("chatList");
    console.log(storedChats);

    if (storedChats) {
      setChatList(JSON.parse(storedChats));
    }
    if (walletAddress) {
      fetchConnections();
      // fetchMessages();
      // fetchChatHistory(selectedChat);
      fetchRequests();
    }
  }, [walletAddress]);

  const connectWallet = async () => {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const wallet = accounts[0];
      setWalletAddress(wallet);
      toast.success("Wallet connected!");
      fetchConnections();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error("Failed to connect wallet");
    }
  };

  /*************  ✨ Codeium Command 🌟  *************/
  const fetchConnections = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/get-connections/${walletAddress}`
      );

      if (response.data.success) {
        const fetchedConnections = response.data.connections;
        const newChatList = fetchedConnections.map((conn) => conn.address);
        const newChatThreadHashes = fetchedConnections.reduce(
          (acc, conn) => ({
            ...acc,
            [conn.address]: conn.threadHash,
          }),
          {}
        );

        setChatList((prevChatList) =>
          Array.from(new Set([...prevChatList, ...newChatList]))
        );
        setChatThreadHashes((prevChatThreadHashes) => ({
          ...prevChatThreadHashes,
          ...newChatThreadHashes,
        }));

        console.log("Updated Chat List:", newChatList);
        console.log("Updated Chat Thread Hashes:", newChatThreadHashes);
        toast.success("Connections fetched successfully!");
      } else {
        toast.error("Failed to fetch connections.");
      }
    } catch (error) {
      console.error("Error fetching connections:", error.message);
      toast.error("Error fetching connections.");
    }
  };
  /******  03cb9fa8-9548-43db-9825-2d157eec077d  *******/

  // Fetch chat requests
  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/get-requests/${walletAddress}`
      );
      console.log("API response for requests:", response.data);

      if (response.data.success) {
        // Check if requests data exists
        if (response.data.requests && response.data.requests.length > 0) {
          setRequests(response.data.requests); // Store the requests in state
          console.log("Updated requests in state:", response.data.requests);
        } else {
          setRequests([]); // Clear requests if empty
          console.warn("No requests found.");
        }
      } else {
        toast.error("Failed to fetch requests.");
      }
    } catch (error) {
      console.error("Error fetching requests:", error.message);
      toast.error("Failed to fetch requests.");
    }
  };

  // Accept or reject a request
  const handleRequest = async (senderAddress, status) => {
    if (!senderAddress || !walletAddress || !status) {
      console.error("Missing required parameters:", {
        senderAddress,
        walletAddress,
        status,
      });
      toast.error("Failed to update request. Missing required parameters.");
      return;
    }

    try {
      const payload = {
        senderAddress,
        receiverAddress: walletAddress, // Your wallet address
        status,
      };

      console.log("Sending payload to /update-request:", payload);

      const response = await axios.post(
        "http://localhost:5000/update-request",
        payload
      );

      if (response.data.success) {
        setRequests((prev) =>
          prev.filter((req) => req.senderAddress !== senderAddress)
        );
        toast.success(`Request ${status.toLowerCase()} successfully!`);
      } else {
        console.error("Server responded with an error:", response.data.message);
        toast.error(response.data.message || "Failed to update request.");
      }
    } catch (error) {
      console.error("Error updating request:", error.message);
      toast.error("Failed to update request.");
    }
  };

  const sendText = async () => {
    if (!messageContent || !selectedChat) {
      toast.error("Please enter a message and select a chat.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/send-text", {
        receiverAddress: selectedChat,
        messageContent,
      });

      if (response.data.success) {
        // Append the sent message to the local state
        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [
            ...(prev[selectedChat] || []),
            {
              from: walletAddress,
              to: selectedChat,
              content: messageContent,
              type: "Text",
            },
          ],
        }));
        setMessageContent(""); // Clear the input field
        toast.success("Text message sent!");
      }
    } catch (error) {
      console.error("Error sending text:", error.message);
      toast.error("Failed to send text message.");
    }
  };

  const sendImage = async (file) => {
    if (!file || !selectedChat) return;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("receiverAddress", selectedChat);

    try {
      const response = await axios.post(
        "http://localhost:5000/send-image",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.success) {
        const imagePath = URL.createObjectURL(file); // Create a temporary URL for display
        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [
            ...(prev[selectedChat] || []),
            {
              from: walletAddress,
              to: selectedChat,
              content: imagePath,
              type: "Image",
            },
          ],
        }));
        toast.success("Image sent successfully!");
      }
    } catch (error) {
      console.error("Error sending image:", error.message);
      toast.error("Failed to send image.");
    }
  };

  const sendGif = async (gifUrl) => {
    if (!gifUrl || !selectedChat) {
      toast.error("Please select a chat before sending a GIF.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/send-gif", {
        receiverAddress: selectedChat,
        gifUrl,
      });

      if (response.data.success) {
        // Append the sent GIF to the local state
        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [
            ...(prev[selectedChat] || []),
            {
              from: walletAddress,
              to: selectedChat,
              content: gifUrl,
              type: "MediaEmbed",
            },
          ],
        }));
        toast.success("GIF sent successfully!");
      }
    } catch (error) {
      console.error("Error sending GIF:", error.message);
      toast.error("Failed to send GIF.");
    }
  };

  const fetchChatHistory = async (selectedChat) => {
    console.log("Attempting to fetch history for chat:", selectedChat);

    try {
      const response = await axios.get(
        `http://localhost:5000/get-chat-details/${selectedChat}/${walletAddress}`
      );

      if (!response.data.success) {
        toast.error("Could not fetch chat details");
        return;
      }

      const threadHash = response.data.threadHash;
      console.log("Retrieved threadHash:", threadHash);

      if (!threadHash) {
        toast.error("No thread hash found for this chat");
        return;
      }

      const historyResponse = await axios.get(
        `http://localhost:5000/get-chat-history`,
        {
          params: {
            account: walletAddress,
            threadHash: threadHash,
          },
        }
      );

      if (historyResponse.data.success) {
        const history = historyResponse.data.data.map((msg) => ({
          from: msg.fromDID ? msg.fromDID.split(":")[1] : msg.fromCAIP10,
          to: msg.toDID ? msg.toDID.split(":")[1] : msg.toCAIP10,
          content: msg.messageContent,
          type: msg.messageType || "Text",
          timestamp: msg.timestamp,
        }));

        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [...history, ...(prev[selectedChat] || [])],
        }));

        toast.success("Chat history loaded successfully!");
      } else {
        toast.error("Failed to load chat history");
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      toast.error("Error loading chat history");
    }
  };

  useEffect(() => {
    if (selectedChat && walletAddress) {
      fetchChatHistory(selectedChat); // Trigger fetch when either selectedChat or walletAddress changes
    }
  }, [selectedChat, walletAddress]);

  const sendEmoji = async (emoji) => {
    if (!emoji || !selectedChat) return;

    try {
      const response = await axios.post("http://localhost:5000/send-emoji", {
        receiverAddress: selectedChat,
        emoji,
      });

      if (response.data.success) {
        // Append the sent emoji to the local state
        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [
            ...(prev[selectedChat] || []),
            {
              from: walletAddress,
              to: selectedChat,
              content: emoji,
              type: "Text",
            },
          ],
        }));
        toast.success("Emoji sent successfully!");
      }
    } catch (error) {
      console.error("Error sending emoji:", error.message);
      toast.error("Failed to send emoji.");
    }
  };

  const onEmojiClick = (emojiObject) => {
    sendEmoji(emojiObject.emoji);
  };

  const fetchGifs = async (query) => {
    try {
      const response = await axios.get(
        `https://tenor.googleapis.com/v2/search?q=${query}&key=${TENOR_API_KEY}&limit=10`
      );
      setGifs(response.data.results); // Store GIF results
    } catch (error) {
      console.error("Error fetching GIFs:", error.message);
      toast.error("Failed to fetch GIFs.");
    }
  };

  const sendDocument = async (file) => {
    if (!file || !selectedChat) {
      toast.error("Please select a chat and choose a document.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);
    formData.append("receiverAddress", selectedChat);

    try {
      const response = await axios.post(
        "http://localhost:5000/send-document",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.success) {
        const documentUrl = URL.createObjectURL(file); // Temporary URL for display
        setMessages((prev) => ({
          ...prev,
          [selectedChat]: [
            ...(prev[selectedChat] || []),
            {
              from: walletAddress,
              to: selectedChat,
              content: documentUrl,
              fileName: file.name,
              type: "Document",
            },
          ],
        }));
        toast.success("Document sent successfully!");
      } else {
        toast.error("Failed to send document.");
      }
    } catch (error) {
      console.error("Error sending document:", error.message);
      toast.error("Failed to send document.");
    }
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        {/* Tabs for Chats and Requests */}
        <div className="tabs">
          <button
            className={selectedTab === "Chats" ? "active-tab" : ""}
            onClick={() => setSelectedTab("Chats")}
          >
            Chats
          </button>
          <button
            className={selectedTab === "Requests" ? "active-tab" : ""}
            onClick={() => setSelectedTab("Requests")}
          >
            Requests
          </button>
        </div>

        {/* Chats List */}
        {selectedTab === "Chats" && (
          <>
            <h3>
              Chats
              <button
                className="add-btn"
                onClick={() => setShowNewChatInput(!showNewChatInput)}
              >
                +
              </button>
            </h3>
            {showNewChatInput && (
              <div className="new-chat-input">
                <input
                  type="text"
                  placeholder="Enter public key"
                  value={newReceiver}
                  onChange={(e) => setNewReceiver(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (newReceiver.trim()) {
                      setChatList((prev) => {
                        const updatedList = Array.from(
                          new Set([...prev, newReceiver.trim()])
                        );
                        localStorage.setItem(
                          "chatList",
                          JSON.stringify(updatedList)
                        );
                        return updatedList;
                      });
                      setNewReceiver("");
                    } else {
                      toast.error("Please enter a valid public key.");
                    }
                  }}
                >
                  Add
                </button>
              </div>
            )}

            <ul>
              {chatList
                .filter(
                  (key) =>
                    key && key.toLowerCase() !== walletAddress?.toLowerCase() // Ensure both values are non-null before calling toLowerCase()
                )
                .map((key, index) => (
                  <li
                    key={key || index}
                    onClick={() => {
                      setSelectedChat(key);
                      setSelectedRequest(null); // Clear selected request when a chat is selected
                    }}
                    className={selectedChat === key ? "active" : ""}
                  >
                    {key}
                  </li>
                ))}
            </ul>
          </>
        )}

        {/* Requests List */}
        {selectedTab === "Requests" && (
          <>
            <h3>Chat Requests</h3>
            <ul>
              {requests.map((req, index) => (
                <li
                  key={index}
                  onClick={() => {
                    setSelectedRequest(req);
                    setSelectedChat(null); // Clear selected chat when a request is selected
                  }}
                  className={selectedRequest === req ? "active" : ""}
                >
                  {req.senderAddress}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="main-chat">
        {!walletAddress ? (
          <button className="connect-btn" onClick={connectWallet}>
            Connect Wallet
          </button>
        ) : selectedRequest ? (
          <div className="request-details-main">
            <h3>{selectedRequest.senderAddress}</h3>
            <p>
              {selectedRequest.message || "This wallet wants to chat with you!"}
            </p>
            <div className="request-actions">
              <button
                style={{
                  backgroundColor: "green",
                  color: "white",
                  padding: "10px",
                  marginRight: "10px",
                }}
                onClick={() => {
                  handleRequest(selectedRequest.senderAddress, "Accepted");
                  setSelectedRequest(null); // Clear after action
                }}
              >
                Accept
              </button>
              <button
                style={{
                  backgroundColor: "red",
                  color: "white",
                  padding: "10px",
                }}
                onClick={() => {
                  handleRequest(selectedRequest.senderAddress, "Rejected");
                  setSelectedRequest(null); // Clear after action
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ) : selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <h3>{selectedChat}</h3>
              {/* Add a Button to Fetch Chat History */}
              {/* <button
                onClick={() => fetchChatHistory(selectedChat)}
                style={{ marginLeft: "auto" }}
              >
                Load History
              </button> */}
            </div>

            {/* Chat Window */}
            <div className="chat-window">
              {messages[selectedChat]?.map((msg, index) => {
                if (msg.type === "File") {
                  try {
                    console.log("Raw message content received:", msg.content);
                    const fileContent = JSON.parse(msg.content);
                    const fileData = fileContent.content; // Extract the `content` field

                    return (
                      <div
                        key={index}
                        className={
                          msg.from === walletAddress
                            ? "message-bubble sender"
                            : "message-bubble receiver"
                        }
                      >
                        <a
                          href={fileData}
                          download="downloaded-file" // Default filename
                          className="document-link"
                        >
                          📄 Download File
                        </a>
                      </div>
                    );
                  } catch (error) {
                    console.error(
                      "Failed to parse document message content",
                      error
                    );
                    return (
                      <div
                        key={index}
                        className={
                          msg.from === walletAddress
                            ? "message-bubble sender"
                            : "message-bubble receiver"
                        }
                      >
                        Invalid Document
                      </div>
                    );
                  }
                }
                // Handle other message types (Text, Image, etc.)
                return (
                  // <div
                  //   key={index}
                  //   className={
                  //     msg.from === walletAddress
                  //       ? "message-bubble sender"
                  //       : "message-bubble receiver"
                  //   }
                  // >
                  //   {msg.type === "Image" ? (
                  //     // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  //     <img
                  //       src={msg.content}
                  //       alt="Sent Image"
                  //       className="chat-image"
                  //     />
                  //   ) : msg.type === "MediaEmbed" ? (
                  //     <img
                  //       src="msg.content"
                  //       alt="Sent GIF"
                  //       className="gif-message"
                  //     />
                  //   ) : (
                  //     <span>{msg.content}</span>
                  //   )}
                  // </div>
                  <div
                    key={index}
                    className={
                      msg.from === walletAddress
                        ? "message-bubble sender"
                        : "message-bubble receiver"
                    }
                  >
                    {msg.type === "Image" ? (
                      <img
                        src={msg.content}
                        alt="Sent Image"
                        className="chat-image"
                      />
                    ) : msg.type === "MediaEmbed" ? (
                      <img
                        src={msg.content} // Corrected to dynamically reference msg.content
                        alt="Sent GIF"
                        className="gif-message"
                      />
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="message-input">
              <textarea
                placeholder="Type your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
              />
              <div className="input-options">
                <label htmlFor="image-upload">📷</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => sendImage(e.target.files[0])}
                  style={{ display: "none" }}
                  id="image-upload"
                />

                <label htmlFor="document-upload">📄</label>
                <input
                  type="file"
                  accept=".pdf, .txt, .doc, .docx, .zip"
                  onChange={(e) => sendDocument(e.target.files[0])}
                  style={{ display: "none" }}
                  id="document-upload"
                />

                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  😊
                </button>
                <button onClick={() => setShowGifPicker(!showGifPicker)}>
                  GIF
                </button>
                <button onClick={sendText}>Send</button>
              </div>

              {showEmojiPicker && (
                <div className="emoji-picker">
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              )}
              {showGifPicker && (
                <div className="gif-picker">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    onChange={(e) => fetchGifs(e.target.value)}
                  />
                  <div className="gif-grid">
                    {gifs.map((gif) => (
                      <img
                        key={gif.id}
                        src={gif.media_formats.gif.url}
                        alt="GIF"
                        onClick={() => sendGif(gif.media_formats.gif.url)}
                        className="gif-item"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <p>Select a chat to view messages</p>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default ChatApp;
