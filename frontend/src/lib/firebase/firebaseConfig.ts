import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

// Initialize Firebase only once (singleton pattern)
// Will fail gracefully if env vars are missing - components should handle this
let app: ReturnType<typeof getApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

try {
  // Only initialize if we have at least the API key
  if (firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
    googleAuthProvider = new GoogleAuthProvider();
  } else {
    // Create a mock auth instance for development when env vars are missing
    console.warn('Firebase config incomplete - app will run in development mode without authentication');
    app = null;
    db = null;
    auth = null;
    googleAuthProvider = null;
  }
} catch (error) {
  // If initialization fails, set everything to null
  console.warn('Firebase initialization failed:', error);
  app = null;
  db = null;
  auth = null;
  googleAuthProvider = null;
}

export { app, db, auth, googleAuthProvider, storage };
