// ── Paste your Firebase config here ──────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

const loginScreen = document.getElementById('loginScreen');
const appRoot     = document.getElementById('appRoot');
const loginBtn    = document.getElementById('loginBtn');
const logoutBtn   = document.getElementById('logoutBtn');
const loginMsg    = document.getElementById('loginMsg');

loginBtn.addEventListener('click', async () => {
  loginMsg.textContent = '';
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await checkAccess(result.user);
  } catch (e) {
    loginMsg.textContent = '❌ ' + e.message;
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (user) await checkAccess(user);
  else showLogin('');
});

async function checkAccess(user) {
  const email = user.email.toLowerCase();
  try {
    const snap = await getDoc(doc(db, 'allowlist', email));
    if (snap.exists() && snap.data().active) {
      showApp(user);
    } else {
      await signOut(auth);
      showLogin(`❌ Access denied for ${email}. Ask the owner to add you.`);
    }
  } catch {
    await signOut(auth);
    showLogin('❌ Could not verify access. Try again.');
  }
}

function showApp(user) {
  loginScreen.style.display = 'none';
  appRoot.style.display     = 'block';
  logoutBtn.textContent     = `Sign out (${user.email})`;
  logoutBtn.style.display   = 'inline-block';
}

function showLogin(msg) {
  loginScreen.style.display = 'flex';
  appRoot.style.display     = 'none';
  logoutBtn.style.display   = 'none';
  loginMsg.textContent      = msg;
}
