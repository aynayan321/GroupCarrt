// server/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const {
  PORT = 3000,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY
} = process.env;

// Initialize Firebase Admin (for later auth verification / Firestore server ops)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://group-cart-2.onrender.com", 
  "https://groupcart-41b08.web.app",
  "https://groupcart-41b08.firebaseapp.com"
];



app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser clients or same-origin
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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Simple health check
app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  console.log("🔌 socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ API & Socket server running on http://localhost:${PORT}`);
});
