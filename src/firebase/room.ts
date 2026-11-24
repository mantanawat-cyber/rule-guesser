import { ref, set, get, update, onValue, off, push } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './config';
import type { GameState } from '../types';

export async function getOrCreateUid(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

function genCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createRoom(hostUid: string, hostName: string): Promise<{ roomId: string; roomCode: string }> {
  const roomCode = genCode();
  const roomRef = push(ref(db, 'rg_rooms'));
  const roomId = roomRef.key!;
  await set(roomRef, {
    roomCode,
    hostUid,
    phase: 'lobby',
    createdAt: Date.now(),
    players: {
      [hostUid]: { name: hostName, ready: false, joinedAt: Date.now() },
    },
  });
  return { roomId, roomCode };
}

export async function joinRoom(roomCode: string, uid: string, name: string): Promise<string | null> {
  const snap = await get(ref(db, 'rg_rooms'));
  if (!snap.exists()) return null;
  let foundId: string | null = null;
  snap.forEach(child => {
    if (child.val().roomCode === roomCode && child.val().phase === 'lobby') {
      foundId = child.key;
    }
  });
  if (!foundId) return null;
  await update(ref(db, `rg_rooms/${foundId}/players/${uid}`), {
    name, ready: false, joinedAt: Date.now(),
  });
  return foundId;
}

export async function setPlayerReady(roomId: string, uid: string, ready: boolean) {
  await update(ref(db, `rg_rooms/${roomId}/players/${uid}`), { ready });
}

export async function startGame(roomId: string, state: GameState) {
  await set(ref(db, `rg_rooms/${roomId}`), {
    ...state,
    createdAt: Date.now(),
  });
}

export async function updateGameState(roomId: string, patch: Partial<GameState>) {
  await update(ref(db, `rg_rooms/${roomId}`), patch);
}

export async function updatePlayerHand(roomId: string, uid: string, hand: string[]) {
  await update(ref(db, `rg_rooms/${roomId}/players/${uid}`), { hand });
}

export function listenRoom(roomId: string, cb: (data: GameState | null) => void) {
  const r = ref(db, `rg_rooms/${roomId}`);
  onValue(r, snap => cb(snap.exists() ? snap.val() as GameState : null));
  return () => off(r);
}
