import { useState } from 'react';
import { Screen, Panel, Logo, Btn, Input, Divider } from '../components/Layout';
import { useGame } from '../store/GameContext';
import { getOrCreateUid, createRoom, joinRoom } from '../firebase/room';

type Mode = 'menu' | 'create' | 'join';

export default function HomeScreen() {
  const { state, dispatch } = useGame();
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState(state.myName);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const n = name.trim();
    if (!n) { setErr('กรุณากรอกชื่อก่อน'); return; }
    setErr(''); setLoading(true);
    try {
      const uid = getOrCreateUid();
      const { roomId, roomCode } = await createRoom(uid, n);
      dispatch({ type: 'GO_LOBBY', roomId, roomCode, uid, name: n });
    } catch {
      setErr('สร้างห้องไม่ได้ — ตรวจสอบการเชื่อมต่อ');
    }
    setLoading(false);
  }

  async function handleJoin() {
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n) { setErr('กรุณากรอกชื่อก่อน'); return; }
    if (c.length !== 4) { setErr('รหัสห้องต้องมี 4 ตัวอักษร'); return; }
    setErr(''); setLoading(true);
    try {
      const uid = getOrCreateUid();
      const roomId = await joinRoom(c, uid, n);
      if (!roomId) { setErr('ไม่พบห้องรหัส ' + c); setLoading(false); return; }
      dispatch({ type: 'GO_LOBBY', roomId, roomCode: c, uid, name: n });
    } catch {
      setErr('เข้าร่วมไม่ได้ — ตรวจสอบการเชื่อมต่อ');
    }
    setLoading(false);
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Logo subtitle="RULE GUESSER" />

      <Panel>
        {mode === 'menu' && (
          <>
            <div style={{ color: 'rgba(200,180,140,0.7)', fontSize: '0.8rem', textAlign: 'center', marginBottom: 20, fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
              ค้นหากฎลึกลับที่ซ่อนอยู่
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="primary" fullWidth onClick={() => setMode('create')}>
                ⚔ สร้างห้องใหม่
              </Btn>
              <Btn variant="ghost" fullWidth onClick={() => setMode('join')}>
                🔮 เข้าร่วมห้อง
              </Btn>
            </div>
            <Divider />
            <div style={{ color: 'rgba(200,180,140,0.4)', fontSize: '0.72rem', textAlign: 'center', lineHeight: 1.6 }}>
              เกมทายกฎลับ — 2-6 ผู้เล่น<br />
              ค้นหากฎที่ซ่อนอยู่จากการเล่นไพ่
            </div>
          </>
        )}

        {(mode === 'create' || mode === 'join') && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: 'rgba(200,168,75,0.7)', fontSize: '0.8rem', marginBottom: 6, fontFamily: "'Cinzel', serif" }}>
                ชื่อของคุณ
              </div>
              <Input
                placeholder="กรอกชื่อ..."
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={16}
                autoFocus
                style={{ textAlign: 'center' }}
              />
            </div>

            {mode === 'join' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'rgba(200,168,75,0.7)', fontSize: '0.8rem', marginBottom: 6, fontFamily: "'Cinzel', serif" }}>
                  รหัสห้อง
                </div>
                <Input
                  placeholder="XXXX"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.3rem' }}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              </div>
            )}

            {err && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(80,10,10,0.7)', borderRadius: 6, border: '1px solid rgba(180,40,40,0.5)' }}>
                <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>❌ {err}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setMode('menu'); setErr(''); }}>
                ← กลับ
              </Btn>
              <div style={{ flex: 1 }}>
                <Btn
                  variant="primary"
                  fullWidth
                  disabled={loading}
                  onClick={mode === 'create' ? handleCreate : handleJoin}
                >
                  {loading ? 'กำลังโหลด...' : mode === 'create' ? '⚔ สร้างห้อง' : '🔮 เข้าร่วม'}
                </Btn>
              </div>
            </div>
          </>
        )}
      </Panel>
    </Screen>
  );
}
