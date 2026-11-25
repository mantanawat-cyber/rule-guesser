import { useEffect, useState } from 'react';
import { Screen, Panel, Logo, Btn, Divider } from '../components/Layout';
import { useGame } from '../store/GameContext';
import { listenRoom, setPlayerReady, startGame } from '../firebase/room';
import { buildInitialGameState, pickRandomRule } from '../game/engine';
import type { GameState } from '../types';

type GameMode = 'practice' | 'vs_system' | 'multiplayer';

export default function LobbyScreen() {
  const { state, dispatch } = useGame();
  const [roomData, setRoomData] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('practice');

  const { roomId, myUid, roomCode } = state;
  const isHost = roomData?.hostUid === myUid;

  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRoom(roomId, data => {
      if (!data) return;
      setRoomData(data);
      if (data.phase === 'playing') {
        dispatch({ type: 'UPDATE_GAME', state: data });
        dispatch({ type: 'GO_GAME' });
      }
    });
    return unsub;
  }, [roomId]);

  async function handleReady() {
    if (!roomId || !myUid) return;
    const me = roomData?.players?.[myUid];
    await setPlayerReady(roomId, myUid, !(me as any)?.ready);
  }

  async function handleStart() {
    if (!roomId || !myUid || !roomData) return;
    const playerNames: Record<string, string> = {};
    Object.entries(roomData.players ?? {}).forEach(([uid, p]) => {
      playerNames[uid] = (p as any).name;
    });
    const rule = pickRandomRule();
    const isSoloPlayer = Object.keys(playerNames).length === 1;
    const opts = isSoloPlayer && gameMode !== 'vs_system'
      ? {}
      : { systemRulemaster: gameMode === 'vs_system' };
    const gameState = buildInitialGameState(myUid, roomCode ?? '', playerNames, rule.id, opts);
    await startGame(roomId, gameState);
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode ?? '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const players = Object.entries(roomData?.players ?? {});
  const isSolo = players.length === 1;
  const allReady = players.length >= 1 && (isSolo || players.every(([uid, p]) => uid === roomData?.hostUid || (p as any).ready));

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Logo subtitle="ห้องรอ" />

      <Panel>
        {/* Room code */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ color: 'rgba(200,168,75,0.6)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: 8, fontFamily: "'Cinzel', serif" }}>
            รหัสห้อง
          </div>
          <button
            onClick={copyCode}
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '2.4rem',
              fontWeight: 900,
              color: '#c8a84b',
              letterSpacing: '0.3em',
              textShadow: '0 0 20px rgba(200,168,75,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              paddingLeft: '0.3em',
            }}
          >
            {roomCode}
          </button>
          <div style={{ color: 'rgba(200,168,75,0.4)', fontSize: '0.72rem', marginTop: 2 }}>
            {copied ? '✓ คัดลอกแล้ว' : 'แตะเพื่อคัดลอก'}
          </div>
        </div>

        <Divider />

        {/* Player list */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'rgba(200,168,75,0.6)', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: 10, fontFamily: "'Cinzel', serif" }}>
            ผู้เล่น ({players.length}/6)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map(([uid, p]) => {
              const player = p as any;
              const isMe = uid === myUid;
              const ready = !!player.ready;
              return (
                <div key={uid} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isMe ? 'rgba(200,168,75,0.08)' : 'rgba(0,0,0,0.2)',
                  border: isMe ? '1px solid rgba(200,168,75,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: '0.95rem', color: isMe ? '#e8dcc0' : 'rgba(232,220,192,0.7)' }}>
                    {player.name} {uid === roomData?.hostUid ? '👑' : ''} {isMe ? '(คุณ)' : ''}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: ready ? '#22c55e' : 'rgba(200,168,75,0.4)' }}>
                    {ready ? '✓ พร้อม' : '⏳ รอ'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Host: game mode selector */}
        {isHost && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: 'rgba(200,168,75,0.6)', fontSize: '0.72rem', marginBottom: 8, fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
              โหมดเกม
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                { id: 'vs_system', label: '🤖 VS ระบบ', desc: 'ระบบคุมกฎ — ไม่มีใครเห็นกฎ (แนะนำ)' },
                { id: 'multiplayer', label: '👥 Multiplayer', desc: 'ผู้เล่น 1 คนรู้กฎ คนอื่นทาย', disabled: players.length < 2 },
                { id: 'practice', label: '🧪 Solo ฝึก', desc: 'เห็นกฎ เล่นคนเดียวเพื่อทดสอบ' },
              ] as { id: GameMode; label: string; desc: string; disabled?: boolean }[]).map(opt => (
                <button
                  key={opt.id}
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && setGameMode(opt.id)}
                  style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: opt.disabled ? 'default' : 'pointer',
                    background: gameMode === opt.id ? 'rgba(200,168,75,0.12)' : 'rgba(0,0,0,0.2)',
                    border: gameMode === opt.id ? '1.5px solid rgba(200,168,75,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    color: opt.disabled ? 'rgba(200,168,75,0.2)' : gameMode === opt.id ? '#c8a84b' : 'rgba(232,220,192,0.6)',
                    fontSize: '0.82rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.65 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHost && isSolo && (
          <div style={{ color: 'rgba(200,168,75,0.5)', fontSize: '0.8rem', textAlign: 'center', marginBottom: 12, padding: '6px 10px', background: 'rgba(200,168,75,0.06)', borderRadius: 6, border: '1px solid rgba(200,168,75,0.2)' }}>
            🧪 Solo Test Mode — กฎจะแสดงให้เห็น
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={() => dispatch({ type: 'GO_HOME' })}>
            ← ออก
          </Btn>
          <div style={{ flex: 1 }}>
            {isHost ? (
              <Btn variant="primary" fullWidth disabled={!allReady} onClick={handleStart}>
                {allReady ? '⚔ เริ่มเกม' : 'รอทุกคนพร้อม...'}
              </Btn>
            ) : (
              <Btn
                variant={roomData?.players?.[myUid!] && (roomData.players[myUid!] as any).ready ? 'ghost' : 'primary'}
                fullWidth
                onClick={handleReady}
              >
                {roomData?.players?.[myUid!] && (roomData.players[myUid!] as any).ready ? '✓ พร้อมแล้ว' : '✓ ฉันพร้อม'}
              </Btn>
            )}
          </div>
        </div>
      </Panel>
    </Screen>
  );
}
