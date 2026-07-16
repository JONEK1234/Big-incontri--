import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCpEW78zm8sRLh6b4CPtu9yP4wgo4h6H64",
  authDomain: "model-mile-38gvj.firebaseapp.com",
  projectId: "model-mile-38gvj",
  storageBucket: "model-mile-38gvj.firebasestorage.app",
  messagingSenderId: "1034924504495",
  appId: "1:1034924504495:web:862b26ee4da2711459ab5a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-bigincontri-b7c2535f-3480-426f-8fd1-cbbcdb2dcfe7");
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
