// --- Firebase & Socket.io Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
getAuth,
GoogleAuthProvider,
signInWithPopup,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";


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
limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

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

// --- DOM Elements ---
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

let currentUser = null;
let currentPoolId = null;
let locationGranted = false;
let currentChatId = null;
let timerIntervals = new Map();

// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  const profileIconId = "profileIcon";

  if (user) {
    profileBtn.textContent = user.displayName.split(" ")[0] || "Profile";

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
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date()
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

// --- Global Click Handler for Popups ---
document.addEventListener("click", (e) => {
  const isPopup = e.target.closest(".popup");
  const isTrigger = e.target.closest("#profileBtn, #createPoolBtn"); 
  if (!isPopup && !isTrigger) closeAllPopups();
});

function closeAllPopups() {
  document.querySelectorAll(".popup").forEach(p => p.classList.add("hidden"));
  const profilePopup = document.getElementById("profilePopup");
  if (profilePopup) profilePopup.remove();
  currentPoolId = null;
}

// Prevent clicks inside popups from closing them
document.querySelectorAll(".popup").forEach(popup => {
  popup.addEventListener("click", (e) => e.stopPropagation());
});

// Navigate to Home when clicking logo or brand
document.addEventListener("DOMContentLoaded", () => {
  const homeBtn = document.getElementById("homeBtn");
  homeBtn.addEventListener("click", () => {
    closeAllPopups();    // Close any open popups
    showSection("home"); // Switch to Home section
  });
});



// --- Login / Profile ---
profileBtn.addEventListener("click", async () => {
  if (currentUser) showProfilePopup();
  else {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) { console.error("Login error", err); }
  }
});

async function logout() {
  // Clear pools listener if it exists
  if (poolsListener) {
    poolsListener();
    poolsListener = null;
  }
  
  await signOut(auth);
  alert("Logged out!");
  showSection("home");
}

// --- Location Handling ---
function requestLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationGranted = true;
      console.log("📍 Location granted:", pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      locationGranted = false;
      console.warn("⚠️ Location denied or error:", err.message);
      alert("Without location, you cannot proceed!");
    }
  );
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Function to check if pool is within range
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
    
    return distance <= 1; // 1 km range
  } catch (err) {
    console.error("Error checking pool range:", err);
    return false;
  }
}

// --- Profile Popup ---
function showProfilePopup() {
  const existing = document.getElementById("profilePopup");
  if (existing) { existing.remove(); return; }

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
  popup.addEventListener("click", e => e.stopPropagation());

  document.getElementById("logoutBtn").addEventListener("click", logout);
}

// --- Create Pool ---
createPoolBtn.addEventListener("click", () => {
  if (!currentUser) return alert("Login first!");
  if (!locationGranted) return alert("Grant location to create pool!");
  createPopup.classList.remove("hidden");
});

closeCreatePopupBtn.addEventListener("click", () => createPopup.classList.add("hidden"));

submitPoolBtn.addEventListener("click", async () => {
  const platform = document.getElementById("platform").value.trim();
  const participantLimit = parseInt(document.getElementById("participantLimit").value);
  const threshold = parseInt(document.getElementById("threshold").value);
  const timeLimitMin = parseInt(document.getElementById("timeLimit").value);
  const description = document.getElementById("description").value.trim();

  // Validate all fields
  if (!platform) return alert("Platform name is required!");
  if (!participantLimit || participantLimit < 1) return alert("Participant limit must be at least 1!");
  if (!threshold || threshold <= 0) return alert("Threshold must be greater than 0!");
  if (!timeLimitMin || timeLimitMin <= 0) return alert("Time limit must be greater than 0!");
  if (timeLimitMin > 180) return alert("Time limit cannot exceed 180 minutes!");
  if (!description) return alert("Description is required!");

  try {

    // Get current location
    const position = await getCurrentPosition();
    if (!position) return alert("Location is required to create a pool!");

    const { latitude, longitude } = position.coords;

    // Create a chat collection for this pool
    const chatRef = await addDoc(collection(db, "chats"), {
      createdAt: serverTimestamp(),
      poolId: null // We'll update this after pool creation
    });

    const pool = await addDoc(collection(db, "pools"), {
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName,
      platform,
      participantLimit,
      threshold,
      timeLimit: timeLimitMin * 60,
      description,
      participants: [],
      location: { latitude, longitude },
      chatId: chatRef.id,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + (timeLimitMin * 60 * 1000))
    });

    // Update chat with pool reference
    await updateDoc(chatRef, { poolId: pool.id });

    alert("Pool created!");
    createPopup.classList.add("hidden");
    clearCreatePopup();
  } catch (err) { console.error("Error creating pool", err); }
});

function clearCreatePopup() {
  ["platform","participantLimit","threshold","timeLimit","description"].forEach(id => document.getElementById(id).value = "");
}

// --- Chat Functions ---
async function openChat(poolId, chatId, poolName) {
  if (currentChatId === chatId) return;
  
  // Check if user has access to chat
  const poolDoc = await getDoc(doc(db, "pools", poolId));
  if (!poolDoc.exists()) return alert("Pool not found!");
  
  const pool = poolDoc.data();
  const isCreator = pool.creatorId === currentUser?.uid;
  const isParticipant = pool.participants.includes(currentUser?.uid);
  
  if (!isCreator && !isParticipant) {
    return alert("Only the creator and participants can access the chat!");
  }
  
  closeChat();
  currentChatId = chatId;
  
  const chatPopup = document.createElement('div');
  chatPopup.className = 'chat-popup';
  chatPopup.id = 'chatPopup';
  chatPopup.innerHTML = `
    <div class="chat-header">
      <span>${poolName}</span>
      <button class="close-chat">&times;</button>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input">
      <input type="text" placeholder="Type a message..." id="chatInput">
      <button id="sendMessage">Send</button>
    </div>
  `;
  
  document.body.appendChild(chatPopup);
  
  // Setup event listeners
  chatPopup.querySelector('.close-chat').onclick = closeChat;
  chatPopup.querySelector('#sendMessage').onclick = () => sendMessage(chatId);
  chatPopup.querySelector('#chatInput').onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage(chatId);
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
  
  const popup = document.getElementById('chatPopup');
  if (popup) popup.remove();
  currentChatId = null;
}

const messageListeners = new Map();

function listenToMessages(chatId) {
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    
    renderMessages(messages.reverse());
  });
  
  messageListeners.set(chatId, unsubscribe);
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  container.innerHTML = messages.map(msg => `
    <div class="chat-message ${msg.senderId === currentUser?.uid ? 'sent' : 'received'}">
      <div>${msg.text}</div>
      <div class="message-meta">
        ${msg.senderId !== currentUser?.uid ? msg.senderName + ' • ' : ''}
        ${new Date(msg.timestamp?.toDate()).toLocaleTimeString()}
      </div>
    </div>
  `).join('');
  
  container.scrollTop = container.scrollHeight;
}

async function sendMessage(chatId) {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    await addDoc(messagesRef, {
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text,
      timestamp: serverTimestamp()
    });
    
    input.value = '';
  } catch (err) {
    console.error('Error sending message:', err);
  }
}

// --- Timer Functions ---
function startTimer(poolId, expiresAt) {
  if (timerIntervals.has(poolId)) {
    clearInterval(timerIntervals.get(poolId));
  }
  
  const timerElement = document.querySelector(`[data-timer-id="${poolId}"]`);
  if (!timerElement) return;
  
  const interval = setInterval(async () => {
    const timeLeft = new Date(expiresAt) - new Date();
    
    if (timeLeft <= 0) {
      clearInterval(timerIntervals.get(poolId));
      timerIntervals.delete(poolId);
      
      const poolRef = doc(db, 'pools', poolId);
      const poolSnap = await getDoc(poolRef);
      
      if (poolSnap.exists()) {
        const pool = poolSnap.data();
        if (pool.participants.length === 0) {
          // Delete pool if no participants
          await deleteDoc(poolRef);
        } else {
          // Disable joining
          timerElement.innerHTML = 'Time Expired';
          const joinBtn = document.querySelector(`[data-id="${poolId}"].join-btn`);
          if (joinBtn) joinBtn.disabled = true;
        }
      }
      return;
    }
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    timerElement.innerHTML = `Time Left: ${minutes}m ${seconds}s`;
    if (timeLeft < 300000) { // Less than 5 minutes
      timerElement.classList.add('expiring');
    }
  }, 1000);
  
  timerIntervals.set(poolId, interval);
}

// --- Listen to Pools ---
// Keep track of active listeners
let poolsListener = null;

function listenToPools() {
  // Clear any existing listener
  if (poolsListener) {
    poolsListener();
    poolsListener = null;
  }

  const q = query(collection(db, "pools"), orderBy("createdAt", "desc"));

  poolsListener = onSnapshot(q, async (snapshot) => {
    // Clear all containers first
    poolsContainer.innerHTML = "";
    joinedContainer.innerHTML = "";
    myRequestsContainer.innerHTML = "";

    // Create a Set to track rendered pool IDs
    const renderedPools = new Set();

    const pools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const pool of pools) {
      // Skip if we've already rendered this pool
      if (renderedPools.has(pool.id)) continue;
      renderedPools.add(pool.id);

      const joined = pool.participants.includes(currentUser?.uid);

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

// --- Render Pools ---
function renderHome(pool) {
  const card = document.createElement("div");
  card.className = "pool-card";
  card.innerHTML = `
    <h4>${pool.platform}</h4>
    <p>Creator: ${pool.creatorName}</p>
    <div class="description">${pool.description || 'No description provided'}</div>
    <p>Participants: ${pool.participants.length}/${pool.participantLimit}</p>
    <p>Threshold: ₹${pool.threshold}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="join-btn">Join Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  poolsContainer.appendChild(card);
  
  // Add event listeners
  card.querySelector(".join-btn").addEventListener("click", () => joinPool(pool.id));
  card.querySelector(".chat-btn").addEventListener("click", () => 
    openChat(pool.id, pool.chatId, pool.platform)
  );
  
  // Start timer
  if (pool.expiresAt) {
    startTimer(pool.id, pool.expiresAt.toDate());
  }
}

async function joinPool(poolId) {
  if (!currentUser) return alert("Login first!");
  if (!locationGranted) return alert("Grant location to join pool!");
  try {
    // Get current pool data to check participant limit
    const poolDoc = await getDoc(doc(db, "pools", poolId));
    if (!poolDoc.exists()) return alert("Pool not found!");
    
    const pool = poolDoc.data();
    if (pool.participants.length >= pool.participantLimit) {
      return alert("This pool is full! Cannot join.");
    }
    
    await updateDoc(doc(db, "pools", poolId), { participants: arrayUnion(currentUser.uid) });
    alert("Joined pool!");
  } catch (err) { console.error("Join error", err); }
}

function renderJoined(pool) {
  const card = document.createElement("div");
  card.className = "joined-card";
  card.innerHTML = `
    <h4>${pool.platform}</h4>
    <div class="description">${pool.description || 'No description provided'}</div>
    <p>Creator: ${pool.creatorName}</p>
    <p>Participants: ${pool.participants.length}/${pool.participantLimit}</p>
    <p>Threshold: ₹${pool.threshold}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="leave-btn">Leave Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  joinedContainer.appendChild(card);

  // Add event listeners
  card.querySelector(".leave-btn").addEventListener("click", () => leavePool(pool.id));
  card.querySelector(".chat-btn").addEventListener("click", () => 
    openChat(pool.id, pool.chatId, pool.platform)
  );
  
  // Start timer
  if (pool.expiresAt) {
    startTimer(pool.id, pool.expiresAt.toDate());
  }
}

async function leavePool(poolId) {
  try {
    const poolDoc = doc(db, "pools", poolId);
    const snap = await getDoc(poolDoc);
    if (snap.exists()) {
      let data = snap.data();
      data.participants = data.participants.filter(uid => uid !== currentUser.uid);
      await updateDoc(poolDoc, { participants: data.participants });
      alert("Left pool!");
    }
  } catch (err) { console.error("Leave error", err); }
}

function renderMyRequest(pool) {
  const card = document.createElement("div");
  card.className = "my-card";
  card.innerHTML = `
    <h4>${pool.platform}</h4>
    <div class="description">${pool.description || 'No description provided'}</div>
    <p>Participants: ${pool.participants.length}/${pool.participantLimit}</p>
    <p>Threshold: ₹${pool.threshold}</p>
    <div class="timer" data-timer-id="${pool.id}">Loading...</div>
    <div class="card-actions">
      <button data-id="${pool.id}" class="delete-btn">Delete Pool</button>
      <button data-id="${pool.id}" class="chat-btn">Chat</button>
    </div>
  `;
  myRequestsContainer.appendChild(card);

  // Add event listeners
  card.querySelector(".delete-btn").addEventListener("click", () => deletePool(pool.id));
  card.querySelector(".chat-btn").addEventListener("click", () => 
    openChat(pool.id, pool.chatId, pool.platform)
  );
  
  // Start timer
  if (pool.expiresAt) {
    startTimer(pool.id, pool.expiresAt.toDate());
  }
}

async function deletePool(poolId) {
  if (!confirm("Delete this pool?")) return;
  try {
    // Get the pool to retrieve its chatId
    const poolDoc = await getDoc(doc(db, "pools", poolId));
    if (poolDoc.exists()) {
      const pool = poolDoc.data();
      const chatId = pool.chatId;
      
      // Delete all messages in the chat
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const messagesSnapshot = await getDocs(messagesRef);
      const batch = writeBatch(db);
      
      messagesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Delete the chat document
      batch.delete(doc(db, "chats", chatId));
      
      // Delete the pool
      batch.delete(doc(db, "pools", poolId));
      
      // Commit all deletions
      await batch.commit();
      alert("Pool deleted!");
    }
  } catch (err) { console.error("Delete error", err); }
}

// --- Section Switching ---
document.getElementById("allPoolBtn").addEventListener("click", () => showSection("homeSection"));
document.getElementById("joinedPoolBtn").addEventListener("click", () => showSection("joined"));
document.getElementById("myRequestsBtn").addEventListener("click", () => showSection("myRequests"));

function showSection(section) {
  homeSection.classList.add("hidden");
  joinedSection.classList.add("hidden");
  myRequestsSection.classList.add("hidden");

  if (section==="joined") joinedSection.classList.remove("hidden");
  else if (section==="myRequests") myRequestsSection.classList.remove("hidden");
  else homeSection.classList.remove("hidden");
}
