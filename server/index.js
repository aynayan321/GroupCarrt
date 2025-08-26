// server/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import axios from "axios";

dotenv.config();

const {
  PORT = 3000,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} = process.env;

// --- Firebase Admin Init ---
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const app = express();

// --- Allowed Origins ---
const allowedOrigins = [
  "http://localhost:5173",              // local dev
  "https://group-cart-1.onrender.com",  // frontend (Render static site)
  "https://group-cart-2.onrender.com",  // backend (Render web service)
  "https://groupcart-41b08.web.app",    // Firebase hosting
  "https://groupcart-41b08.firebaseapp.com",
];

// --- Middleware ---
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked for origin: " + origin));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// --- Server + Socket.io ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// --- Routes ---
app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  console.log("🔌 socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ socket disconnected:", socket.id);
  });
});

// --- Keep Render Alive ---
const keepAliveUrl = "https://group-cart-2.onrender.com/health"; 
const interval = 300000; // 5 min

function keepAlive() {
  axios
    .get(keepAliveUrl)
    .then(() => console.log("🌍 Keep-alive ping successful"))
    .catch((err) => console.error("⚠️ Keep-alive failed:", err.message));
}
setInterval(keepAlive, interval);

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`✅ API & Socket server running on http://localhost:${PORT}`);
});
