import { firebaseConfig } from "./firebase-config.js";

// Legacy in-page notifications are intentionally disabled. Firebase listeners
// sync message data; push notifications are handled separately by the service worker.
const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";
let auth = null, db = null, firebaseApp = null, firebaseInitialized = false;
let userContacts = [], chats = [], currentChatUid = null;
let chatListUnsubscribe = null, messagesUnsubscribe = null, presenceUnsubscribe = null, typingUnsubscribe = null, typingTimer = null;
let shownNotificationIds = new Set();

async function initializeFirebase(){if(firebaseInitialized)return true;try{const{initializeApp}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");const{getAuth,setPersistence,browserLocalPersistence}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");const{getFirestore}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");firebaseApp=initializeApp(firebaseConfig);auth=getAuth(firebaseApp);db=getFirestore(firebaseApp);await setPersistence(auth,browserLocalPersistence);firebaseInitialized=true;return true}catch(e){console.error("Firebase error:",e);return false}}
function showDebug(msg){console.log(msg);const e=document.getElementById("firebaseDebug");if(e){const l=document.createElement("div");l.textContent=msg;e.appendChild(l);e.scrollTop=e.scrollHeight}}
function showError(message){const e=document.getElementById("pageStatus")||document.getElementById("loginStatus")||document.getElementById("signupStatus")||document.getElementById("forgotStatus")||document.getElementById("resetStatus");if(e){e.textContent=message;e.className="status-message status-error";return}alert(message)}
function showSuccess(message){const e=document.getElementById("pageStatus")||document.getElementById("loginStatus")||document.getElementById("signupStatus")||document.getElementById("forgotStatus")||document.getElementById("resetStatus");if(e){e.textContent=message;e.className="status-message status-success";return}alert(message)}
function showInfo(message){const e=document.getElementById("pageStatus")||document.getElementById("loginStatus")||document.getElementById("signupStatus")||document.getElementById("forgotStatus")||document.getElementById("resetStatus");if(e){e.textContent=message;e.className="status-message status-info";return}alert(message)}
function clearStatus(){["pageStatus","loginStatus","signupStatus","forgotStatus","resetStatus"].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent="";e.className=""}})}
function requestNotificationPermission(){return Promise.resolve(false)}
function showMessageNotification(){return}
function setAvatarElement(element,photoURL,fallbackText="👤"){if(!element)return;if(photoURL){element.innerHTML=`<img src="${photoURL}" alt="Profile photo" />`;element.style.background="#ddd";element.style.overflow="hidden";return}element.innerHTML="";element.textContent=fallbackText;element.style.background="#ddd";element.style.overflow="hidden"}

// All remaining application logic is loaded from the original app implementation
// at runtime by the existing page scripts. This module deliberately exposes no
// notification side effects from Firestore message listeners.
window.__sheLegacyNotificationsDisabled=true;
