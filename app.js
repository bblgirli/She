import { firebaseConfig } from "./firebase-config.js";

// ============================================
// GLOBAL STATE & CONSTANTS
// ============================================
const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";

let auth = null;
let db = null;
let firebaseApp = null;
let firebaseInitialized = false;

// Contacts and chats
let userContacts = [];
let chats = [];
let currentChatUid = null;
let chatListUnsubscribe = null;
let messagesUnsubscribe = null;
let presenceUnsubscribe = null;
let typingUnsubscribe = null;
let typingTimer = null;
let shownNotificationIds = new Set();

// Voice recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingLocked = false;
let recordingStartTime = null;
let recordingTimerInterval = null;

// Audio analysis for pitch level
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

// WebRTC calling
let peerConnection = null;
let currentCallState = null;
let callStream = null;
let incomingCallData = null;
let currentCallUid = null;
let callStartTime = null;
let callDurationInterval = null;
let callHistoryListener = null;

async function initializeFirebase() {
    if (firebaseInitialized) return true;
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const { getAuth, setPersistence, browserLocalPersistence } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        await setPersistence(auth, browserLocalPersistence);
        firebaseInitialized = true;
        return true;
    } catch (error) { console.error("Firebase error:", error); return false; }
}
function showDebug(msg){console.log(msg);}
function showError(message){const e=document.getElementById("pageStatus")||document.getElementById("loginStatus")||document.getElementById("signupStatus")||document.getElementById("forgotStatus")||document.getElementById("resetStatus");if(e){e.textContent=message;e.className="status-message status-error";}else console.warn(message);}
function showSuccess(message){const e=document.getElementById("pageStatus")||document.getElementById("loginStatus")||document.getElementById("signupStatus")||document.getElementById("forgotStatus")||document.getElementById("resetStatus");if(e){e.textContent=message;e.className="status-message status-success";}}
function showInfo(message){console.log(message);}
function clearStatus(){}
function saveUser(user){localStorage.setItem(CURRENT_USER_KEY,JSON.stringify(user));}
function getCurrentUser(){try{return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)||"null");}catch{return null;}}
function clearUser(){localStorage.removeItem(CURRENT_USER_KEY);}
async function setCurrentUserPresence(isOnline){if(!firebaseInitialized||!auth?.currentUser)return;try{const{doc,setDoc,serverTimestamp}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");await setDoc(doc(db,"users",auth.currentUser.uid),{uid:auth.currentUser.uid,online:isOnline,lastSeen:isOnline?null:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});}catch(e){console.warn("Could not update presence:",e);}}
async function handleLogin(event){event.preventDefault();const email=document.getElementById("loginEmail")?.value?.trim()||"",password=document.getElementById("loginPassword")?.value||"";if(!email||!password)return showError("Please enter email and password");if(!firebaseInitialized&&!await initializeFirebase())return showError("Firebase connection failed");try{const{signInWithEmailAndPassword}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");const result=await signInWithEmailAndPassword(auth,email,password);await setCurrentUserPresence(true);saveUser({uid:result.user.uid,email:result.user.email,displayName:result.user.displayName||""});window.location.href="chats.html";}catch(e){showError(e.message);}}

// Presence display is owned by the existing chat listener. Do not add another writer here.

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>initializeFirebase(),{once:true});else initializeFirebase();
