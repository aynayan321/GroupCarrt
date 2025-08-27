// --- Firebase & Socket.io Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDocs,
  writeBatch,
  limit,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

// --- Socket.io Client ---
const socket = io("https://group-cart-1.onrender.com", {
  withCredentials: true
});

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDdM2cWaRqRdiJ085nyCDSy6P2lZDQ8f1M",
  authDomain: "groupcart-3c788.firebaseapp.com",
  projectId: "groupcart-3c788",
  appId: "1:675386399587:web:f7858cd2e84a91dc135156"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
console.log("✅ Firebase initialized:", app.name);

// ============================================================================
// Helpers & Globals
// ============================================================================

// Replace built-in alerts with a small helper (can be upgraded to a toast UI)
function notify(message, type = "info") {
  // Minimal implementation; replace with a proper toast system later
  console[type === "error" ? "error" : "log"]("🔔", message);
  // Keep alert for now so you still see something in production without a UI lib
  alert(message);
}

// DOM Elements
const profileBtn = document.getElementById("profileBtn");
const createPoolBtn = document.getElementById("createPoolBtn");
const createPopup = document.getElementById("createPopup");
const submitPoolBtn = document.getElementById("submitPool");
const closeCreatePopupBtn = document.getElementById("closeCreatePopup");
const poolsContainer = document.getElementById("poolsContainer");
const joinedContainer = document.getElementById("joinedContainer");
const myRequestsContainer = document.getElementById("myRequestsContainer");

// Sections
const homeSection = document.getElementById("homeSection");
const joinedSection = document.getElementById("joinedSection");
const myRequestsSection = document.getElementById("myRequestsSection");

// State
let currentUser = null;
let currentPoolId = null;
let locationGranted = false;
let currentChatId = null;
const timerIntervals = new Map();
const messageListeners = new Map();
let poolsListener = null; // active Firestore listener for pools

// ============================================================================
// Auth State & Login/Logout
// ============================================================================

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const profileIconId = "profileIcon";

  if (user) {
    profileBtn.textContent = user.displayName?.split(" ")[0] || "Profile";

    if (!document.getElementById(profileIconId)) {
      const img = document.createElement("img");
      img.id = profileIconId;
      img.src = "/assets/user.svg";
      img.alt = "User Icon";
      img.style.width = "14px";
      img.style.height = "14px";
      img.style.marginLeft = "4px";
      profileBtn.appendChild(img);
    }

    // Save user in Firestore if first login
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        name: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? "",
        createdAt: serverTimestamp()
      });
    }

    requestLocation();
    listenToPools();
  } else {
    profileBtn.textContent = "Login";
    poolsContainer.innerHTML = "";
    joinedContainer.innerHTML = "";
    myRequestsContainer.innerHTML = "";

    const icon = document.getElementById(profileIconId);
    if (icon) icon.remove();
  }
});

// Global click handler to close popups when clicking outside
document.addEventListener("click", (e) => {
  const isPopup = e.target.closest(".popup");
  const isTrigger = e.target.closest("#profileBtn, #createPoolBtn");
  if (!isPopup && !isTrigger) closeAllPopups();
});

function closeAllPopups() {
  document.querySelectorAll(".popup").forEach((p) => p.classList.add("hidden"));
  const profilePopup = document.getElementById("profilePopup");
  if (profilePopup) profilePopup.remove();
  currentPoolId = null;
}

// Prevent clicks inside popups from closing them
// (this needs to run after popups appear in DOM; safe for initial static .popup elements)
document.querySelectorAll(".popup").forEach((popup) => {
  popup.addEventListener("click", (e) => e.stopPropagation());
});

// Navigate to Home when clicking logo or brand
document.addEventListener("DOMContentLoaded", () => {
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      closeAllPopups();
      showSection("home");
    });
  }
});

// Login / Profile button behavior
if (profileBtn) {
  profileBtn.addEventListener("click", async () => {
    if (currentUser) showProfilePopup();
    else {
      try {
        // Popup for localhost, Redirect for production
        if (
          window.location.hostname.includes("localhost") ||
          window.location.hostname.includes("127.0.0.1")
        ) {
          await signInWithPopup(auth, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
      } catch (err) {
        console.error("Login error", err);
        notify("Login failed. Check console for details.", "error");
      }
    }
  });
}

async function logout() {
  // Clear pools listener if it exists
  if (poolsListener) {
    poolsListener();
    poolsListener = null;
  }
  await signOut(auth);
  notify("Logged out!");
  showSection("home");
}

// Profile popup
function showProfilePopup() {
  const existing = document.getElementById("profilePopup");
  if (existing) {
    existing.remove();
    return;
  }

  const popup = document.createElement("div");
  popup.id = "profilePopup";
  popup.className = "popup";
  popup.style.position = "absolute";
  popup.style.top = "56px";
  popup.style.right = "12px";
  popup.style.background = "#fff";
  popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  popup.style.padding = "8px";
  popup.style.borderRadius = "8px";
  popup.innerHTML = `
    <button id="logoutBtn">Logout</button>
  `;
  document.body.appendChild(popup);
  popup.addEventListener("click", (e) => e.stopPropagation());

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

// ============================================================================
// Location Helpers
// ============================================================================

function requestLocation() {
  if (!navigator.geolocation) {
    notify("Geolocation not supported in this browser.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationGranted = true;
      console.log(
        "📍 Location granted:",
        pos.coords.latitude,
        pos.coords.longitude
      );
    },
    (err) => {
      locationGranted = false;
      console.warn("⚠️ Location denied or error:", err.message);
      notify("Without location, you cannot proceed!", "error");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

async function isPoolInRange(pool) {
  try {
    const position = await getCurrentPosition();
    if (!position || !pool.location) return false;

    const distance = calculateDistance(
      position.coords.latitude,
      position.coords.longitude,
      pool.location.latitude,
      pool.location.longitude
    );
    return distance <= 1; // within 1 km
  } catch (err) {
    console.error("Error checking pool range:", err);
    return false;
  }
}

// ============================================================================
// Create Pool
// ============================================================================

if (createPoolBtn) {
  createPoolBtn.addEventListener("click", () => {
    if (!currentUser) return notify("Login first!", "error");
    if (!locationGranted) return notify("Grant location to create pool!", "error");
    createPopup?.classList.remove("hidden");
  });
}

if (closeCreatePopupBtn) {
  closeCreatePopupBtn.addEventListener("click", () =>
    createPopup?.classList.add("hidden")
  );
}

if (submitPoolBtn) {
  submitPoolBtn.addEventListener("click", async () => {
    const platform = document.getElementById("platform").value.trim();
    const participantLimit = parseInt(
      document.getElementById("participantLimit").value
    );
    const threshold = parseInt(document.getElementById("threshold").value);
    const timeLimitMin = parseInt(document.getElementById("timeLimit").value);
    const description = document.getElementById("description").value.trim();

    // Validation
    if (!platform) return notify("Platform name is required!", "error");
    if (!participantLimit || participantLimit < 1)
      return notify("Participant limit must be at least 1!", "error");
    if (!threshold || threshold <= 0)
      return notify("Threshold must be greater than 0!", "error");
    if (!timeLimitMin || timeLimitMin <= 0)
      return notify("Time limit must be greater than 0!", "error");
    if (timeLimitMin > 180)
      return notify("Time limit cannot exceed 180 minutes!", "error");
    if (!description) return notify("Description is required!", "error");

    try {
      const position = await getCurrentPosition();
      if (!position) return notify("Location is required to create a pool!", "error");

      const { latitude, longitude } = position.coords;

      // Create chat document first
      const chatRef = await addDoc(collection(db, "chats"), {
        createdAt: serverTimestamp(),
        poolId: null, // set later
      });

      // Create pool
      const pool = await addDoc(collection(db, "pools"), {
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName,
        platform,
        participantLimit,
        threshold,
        timeLimit: timeLimitMin * 60, // seconds
        description,
        participants: [],
        location: { latitude, longitude },
        chatId: chatRef.id,
        createdAt: serverTimestamp(),
        // store as Firestore Timestamp for consistent reading
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + timeLimitMin * 60 * 1000)
        ),
      });

      // Back-link pool to chat
      await updateDoc(chatRef, { poolId: pool.id });

      notify("Pool created!");
      createPopup?.classList.add("hidden");
      clearCreatePopup();
    } catch (err) {
      console.error("Error creating pool", err);
      notify("Failed to create pool. See console for details.", "error");
    }
  });
}

function clearCreatePopup() {
  ["platform", "participantLimit", "threshold", "timeLimit", "description"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
}

// ============================================================================
// Chat
// ============================================================================

async function openChat(poolId, chatId, poolName) {
  if (currentChatId === chatId) return;

  // Check if user has access to chat
  const poolDoc = await getDoc(doc(db, "pools", poolId));
  if (!poolDoc.exists()) return notify("Pool not found!", "error");

  const pool = poolDoc.data();
  const isCreator = pool.creatorId === currentUser?.uid;
  const isParticipant = pool.participants?.includes(currentUser?.uid);

  if (!isCreator && !isParticipant) {
    return notify("Only the creator and participants can access the chat!", "error");
  }

  closeChat();
  currentChatId = chatId;

  const chatPopup = document.createElement("div");
  chatPopup.className = "chat-popup";
  chatPopup.id = "chatPopup";
  chatPopup.innerHTML = `
    <div class="chat-header">
      <span>${poolName}</span>
      <button class="close-chat" aria-label="Close chat">&times;</button>
    </div>
    <div class="chat-messages" id="chatMessages" role="log" aria-live="polite"></div>
    <div class="chat-input">
      <input type="text" placeholder="Type a message..." id="chatInput" aria-label="Chat message" />
      <button id="sendMessage">Send</button>
    </div>
  `;

  document.body.appendChild(chatPopup);

  // Setup event listeners
  chatPopup.querySelector(".close-chat").onclick = closeChat;
  chatPopup.querySelector("#sendMessage").onclick = () => sendMessage(chatId);
  chatPopup.querySelector("#chatInput").onkeypress = (e) => {
    if (e.key === "Enter") sendMessage(chatId);
  };

  // Listen to messages
  listenToMessages(chatId);
}

function closeChat() {
  if (currentChatId) {
    const unsubscribe = messageListeners.get(currentChatId);
    if (unsubscribe) unsubscribe();
    messageListeners.delete(currentChatId);
  }

  const popup = document.getElementById("chatPopup");
  if (popup) popup.remove();
  currentChatId = null;
}

function listenToMessages(chatId) {
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  const q = query(messagesRef, orderBy("timestamp", "desc"), limit(50));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    renderMessages(messages.reverse());
  });

  messageListeners.set(chatId, unsubscribe);
}

function renderMessages(messages) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  container.innerHTML = messages
    .map((msg) => {
      const isMine = msg.senderId === currentUser?.uid;
      const time = msg.timestamp
        ? (msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp))
        : new Date();
      return `
        <div class="chat-message ${isMine ? "sent" : "received"}">
          <div class="chat-bubble">${escapeHtml(msg.text || "")}</div>
          <div class="message-meta">
            ${!isMine ? (escapeHtml(msg.senderName || "Unknown") + " • ") : ""}
            ${time.toLocaleTimeString()}
          </div>
        </div>
      `;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
}

async function sendMessage(chatId) {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    await addDoc(messagesRef, {
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text,
      timestamp: serverTimestamp(),
    });

    input.value = "";
  } catch (err) {
    console.error("Error sending message:", err);
    notify("Failed to send message.", "error");
  }
}

// Escape HTML to prevent XSS in chat rendering
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================================
// Timers
// ============================================================================

function startTimer(poolId, expiresAt) {
  // Clear any existing timer
  if (timerIntervals.has(poolId)) {
    clearInterval(timerIntervals.get(poolId));
  }

  const timerElement = document.querySelector(`[data-timer-id="${poolId}"]`);
  if (!timerElement) return;

  const parseExpires = (val) => {
    if (!val) return null;
    if (val.toDate) return val.toDate(); // Firestore Timestamp
    if (typeof val === "string" || typeof val === "number") return new Date(val);
    if (val instanceof Date) return val;
    return null;
  };

  const end = parseExpires(expiresAt);
  if (!end) {
    timerElement.textContent = "Time Expired";
    return;
  }

  const tick = async () => {
    const timeLeft = end - new Date();

    if (timeLeft <= 0) {
      clearInterval(timerIntervals.get(poolId));
      timerIntervals.delete(poolId);

      const poolRef = doc(db, "pools", poolId);
      const poolSnap = await getDoc(poolRef);

      if (poolSnap.exists()) {
        const pool = poolSnap.data();
        if (!pool.participants || pool.participants.length === 0) {
          // Delete pool if no participants
          await deleteDoc(poolRef);
        } else {
          // Disable joining
          timerElement.textContent = "Time Expired";
          timerElement.classList.add("expired");
          const joinBtn = document.querySelector(
            `[data-id="${poolId}"]\.join-btn`
          );
          if (joinBtn) joinBtn.disabled = true;
        }
      }
      return;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    timerElement.textContent = `Time Left: ${minutes}m ${seconds}s`;

    if (timeLeft < 300000) {
      // < 5 minutes
      timerElement.classList.add("expiring");
    }
  };

  tick(); // render immediately
  const interval = setInterval(tick, 1000);
  timerIntervals.set(poolId, interval);
}

// ============================================================================
// Pools: Listen & Render
// ============================================================================

function listenToPools() {
  // Clear any existing listener
  if (poolsListener) {
    poolsListener();
    poolsListener = null;
  }

  const qPools = query(collection(db, "pools"), orderBy("createdAt", "desc"));

  poolsListener = onSnapshot(qPools, async (snapshot) => {
    // Clear all containers first
    poolsContainer.innerHTML = "";
    joinedContainer.innerHTML = "";
    myRequestsContainer.innerHTML = "";

    // Track rendered pool IDs to avoid duplicates
    const renderedPools = new Set();

    const pools = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    for (const pool of pools) {
      if (renderedPools.has(pool.id)) continue;
      renderedPools.add(pool.id);

      const joined = Array.isArray(pool.participants)
        ? pool.participants.includes(currentUser?.uid)
        : false;

      if (pool.creatorId === currentUser?.uid) {
        renderMyRequest(pool);
      } else if (joined) {
        renderJoined(pool);
      } else {
        // Only show available pools that are within 1km range
        const inRange = await isPoolInRange(pool);
        if (inRange) {
          renderHome(pool);
        }
      }
    }
  });
}

// Render: Home (available pools)
function renderHome(pool) {
  const card = document.createElement("div");
  card.className = "pool-card";
  card.innerHTML = `
    <h4>${escapeHtml(pool.platform)}</h4>
    <p>Creator: ${escapeHtml(pool.creatorName || "Unknown")}</p>
    <div class="description">${escapeHtml(pool.description || "No description provided")}</div>
    <p>Participants: ${(pool.participants?.length || 0)}/${pool.participantLimit}</p>
    <p>Threshold: ₹${Number(pool.threshold ?? 0)}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="join-btn">Join Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  poolsContainer.appendChild(card);

  // Event listeners
  const joinBtn = card.querySelector(".join-btn");
  const chatBtn = card.querySelector(".chat-btn");

  joinBtn?.addEventListener("click", () => joinPool(pool.id));
  chatBtn?.addEventListener("click", () => openChat(pool.id, pool.chatId, pool.platform));

  // Start timer
  if (pool.expiresAt) {
    const expires = pool.expiresAt.toDate ? pool.expiresAt.toDate() : pool.expiresAt;
    startTimer(pool.id, expires);
  }
}

async function joinPool(poolId) {
  if (!currentUser) return notify("Login first!", "error");
  if (!locationGranted) return notify("Grant location to join pool!", "error");

  try {
    const poolRef = doc(db, "pools", poolId);
    const poolDoc = await getDoc(poolRef);
    if (!poolDoc.exists()) return notify("Pool not found!", "error");

    const pool = poolDoc.data();
    const currentCount = Array.isArray(pool.participants) ? pool.participants.length : 0;
    if (currentCount >= pool.participantLimit) {
      return notify("This pool is full! Cannot join.", "error");
    }

    await updateDoc(poolRef, { participants: arrayUnion(currentUser.uid) });
    notify("Joined pool!");
  } catch (err) {
    console.error("Join error", err);
    notify("Failed to join pool.", "error");
  }
}

// Render: Joined pools
function renderJoined(pool) {
  const card = document.createElement("div");
  card.className = "joined-card";
  card.innerHTML = `
    <h4>${escapeHtml(pool.platform)}</h4>
    <div class="description">${escapeHtml(pool.description || "No description provided")}</div>
    <p>Creator: ${escapeHtml(pool.creatorName || "Unknown")}</p>
    <p>Participants: ${(pool.participants?.length || 0)}/${pool.participantLimit}</p>
    <p>Threshold: ₹${Number(pool.threshold ?? 0)}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="leave-btn">Leave Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  joinedContainer.appendChild(card);

  const leaveBtn = card.querySelector(".leave-btn");
  const chatBtn = card.querySelector(".chat-btn");

  leaveBtn?.addEventListener("click", () => leavePool(pool.id));
  chatBtn?.addEventListener("click", () => openChat(pool.id, pool.chatId, pool.platform));

  if (pool.expiresAt) {
    const expires = pool.expiresAt.toDate ? pool.expiresAt.toDate() : pool.expiresAt;
    startTimer(pool.id, expires);
  }
}

async function leavePool(poolId) {
  try {
    const poolRef = doc(db, "pools", poolId);
    const snap = await getDoc(poolRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const updated = (data.participants || []).filter((uid) => uid !== currentUser.uid);
    await updateDoc(poolRef, { participants: updated });
    notify("Left pool!");
  } catch (err) {
    console.error("Leave error", err);
    notify("Failed to leave pool.", "error");
  }
}

// Render: My requests (created by me)
function renderMyRequest(pool) {
  const card = document.createElement("div");
  card.className = "my-card";
  card.innerHTML = `
    <h4>${escapeHtml(pool.platform)}</h4>
    <div class="description">${escapeHtml(pool.description || "No description provided")}</div>
    <p>Participants: ${(pool.participants?.length || 0)}/${pool.participantLimit}</p>
    <p>Threshold: ₹${Number(pool.threshold ?? 0)}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="delete-btn">Delete Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  myRequestsContainer.appendChild(card);

  const deleteBtn = card.querySelector(".delete-btn");
  const chatBtn = card.querySelector(".chat-btn");

  deleteBtn?.addEventListener("click", () => deletePool(pool.id));
  chatBtn?.addEventListener("click", () => openChat(pool.id, pool.chatId, pool.platform));

  if (pool.expiresAt) {
    const expires = pool.expiresAt.toDate ? pool.expiresAt.toDate() : pool.expiresAt;
    startTimer(pool.id, expires);
  }
}

async function deletePool(poolId) {
  if (!confirm("Delete this pool?")) return;
  try {
    const poolRef = doc(db, "pools", poolId);
    const poolDoc = await getDoc(poolRef);
    if (poolDoc.exists()) {
      const pool = poolDoc.data();
      const chatId = pool.chatId;

      const batch = writeBatch(db);

      // Delete all messages in the chat
      if (chatId) {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const messagesSnapshot = await getDocs(messagesRef);
        messagesSnapshot.docs.forEach((m) => batch.delete(m.ref));
        batch.delete(doc(db, "chats", chatId));
      }

      // Delete the pool
      batch.delete(poolRef);

      // Commit all deletions
      await batch.commit();
      notify("Pool deleted!");
    }
  } catch (err) {
    console.error("Delete error", err);
    notify("Failed to delete pool.", "error");
  }
}

// ============================================================================
// Section Switching
// ============================================================================

const allPoolBtn = document.getElementById("allPoolBtn");
const joinedPoolBtn = document.getElementById("joinedPoolBtn");
const myRequestsBtn = document.getElementById("myRequestsBtn");

allPoolBtn?.addEventListener("click", () => showSection("home"));
joinedPoolBtn?.addEventListener("click", () => showSection("joined"));
myRequestsBtn?.addEventListener("click", () => showSection("myRequests"));

function showSection(section) {
  homeSection.classList.add("hidden");
  joinedSection.classList.add("hidden");
  myRequestsSection.classList.add("hidden");

  if (section === "joined") joinedSection.classList.remove("hidden");
  else if (section === "myRequests") myRequestsSection.classList.remove("hidden");
  else homeSection.classList.remove("hidden");
}

// ============================================================================
// Socket Logs
// ============================================================================

socket.on("connect", () => console.log("🔌 Socket connected:", socket.id));
socket.on("disconnect", () => console.log("❌ Socket disconnected"));
