// Firebase initialization
// Fill the env vars in .env.local (see .env.local.example)
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Read env via literal access so Next.js can inline them in the client bundle
// Your web app's Firebase configuration
const ENV = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

const missingEnv = (Object.entries(ENV)
  .filter(([, v]) => !v)
  .map(([k]) => k));
const shouldInit = missingEnv.length === 0;

let app: FirebaseApp | undefined;
if (shouldInit) {
  const firebaseConfig = {
    apiKey: ENV.apiKey!,
    authDomain: ENV.authDomain!,
    projectId: ENV.projectId!,
    storageBucket: ENV.storageBucket!,
    messagingSenderId: ENV.messagingSenderId!,
    appId: ENV.appId!,
  } as const;
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
} else if (typeof window !== "undefined") {
  // Log a friendly warning on the client for easier debugging
  // Mask API key when logging
  const masked = (val?: string | null) => (val ? `${val.slice(0, 6)}...${val.slice(-4)}` : "<missing>");
  console.warn(
    "Firebase not initialized. Missing envs:",
    missingEnv,
    {
      apiKey: masked(ENV.apiKey ?? null),
      projectId: ENV.projectId ?? "<missing>",
      authDomain: ENV.authDomain ?? "<missing>",
      storageBucket: ENV.storageBucket ?? "<missing>",
      appId: ENV.appId ?? "<missing>",
    }
  );
}

export const auth: ReturnType<typeof getAuth> | undefined = app ? getAuth(app) : undefined;
export const db: ReturnType<typeof getFirestore> | undefined = app ? getFirestore(app) : undefined;
export const storage: ReturnType<typeof getStorage> | undefined = app ? getStorage(app) : undefined;

// Helper for debug pages to inspect runtime status safely
export function firebaseStatus() {
  const initialized = !!app;
  const status = {
    initialized,
    missingEnv,
    env: {
      apiKey: ENV.apiKey ? "set" : "missing",
      authDomain: ENV.authDomain ? "set" : "missing",
      projectId: ENV.projectId ? "set" : "missing",
      storageBucket: ENV.storageBucket ? "set" : "missing",
      messagingSenderId: ENV.messagingSenderId ? "set" : "missing",
      appId: ENV.appId ? "set" : "missing",
    },
    getAppsCount: getApps().length,
    shouldInit,
    masked: {
      apiKey: ENV.apiKey
        ? `${ENV.apiKey.slice(0, 6)}...${ENV.apiKey.slice(-4)}`
        : "<missing>",
      authDomain: ENV.authDomain || "<missing>",
      projectId: ENV.projectId || "<missing>",
      storageBucket: ENV.storageBucket || "<missing>",
      messagingSenderId: ENV.messagingSenderId
        ? `***${String(ENV.messagingSenderId).slice(-4)}`
        : "<missing>",
      appId: ENV.appId
        ? `***${ENV.appId.slice(-4)}`
        : "<missing>",
    },
  } as const;
  return status;
}
