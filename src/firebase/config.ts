import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:      'AIzaSyBMKDRyDXmHNG73L1RU05K8z8PZ72yTuL0',
  authDomain:  'trap-word.firebaseapp.com',
  databaseURL: 'https://trap-word-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:   'trap-word',
};

const app  = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
