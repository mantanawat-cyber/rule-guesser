import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { GameState } from '../types';

interface LocalState {
  screen: 'home' | 'lobby' | 'game';
  roomId: string | null;
  myUid: string | null;
  myName: string;
  roomCode: string | null;
  gameState: GameState | null;
}

type Action =
  | { type: 'SET_NAME'; name: string }
  | { type: 'GO_LOBBY'; roomId: string; roomCode: string; uid: string; name: string }
  | { type: 'GO_GAME' }
  | { type: 'UPDATE_GAME'; state: GameState }
  | { type: 'GO_HOME' };

const initial: LocalState = {
  screen: 'home',
  roomId: null,
  myUid: null,
  myName: '',
  roomCode: null,
  gameState: null,
};

function reducer(s: LocalState, a: Action): LocalState {
  switch (a.type) {
    case 'SET_NAME':     return { ...s, myName: a.name };
    case 'GO_LOBBY':     return { ...s, screen: 'lobby', roomId: a.roomId, roomCode: a.roomCode, myUid: a.uid, myName: a.name };
    case 'GO_GAME':      return { ...s, screen: 'game' };
    case 'UPDATE_GAME':  return { ...s, gameState: a.state };
    case 'GO_HOME':      return { ...initial };
    default:             return s;
  }
}

const Ctx = createContext<{ state: LocalState; dispatch: React.Dispatch<Action> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}
