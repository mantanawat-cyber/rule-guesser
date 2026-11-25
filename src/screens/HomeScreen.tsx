import { useState, useEffect, useRef } from 'react';
import { Screen, Panel, Btn, Input, Divider } from '../components/Layout';
import { useGame } from '../store/GameContext';
import { getOrCreateUid, createRoom, joinRoom } from '../firebase/room';

type Mode = 'menu' | 'create' | 'join';

const COVER_CARDS = [
  { color: '#c0392b', num: 7, emoji: '🐱', top: '8%',  left: '3%',  cr: '-18deg', cd: 5.5, cdy: 0,   pass: true },
  { color: '#2563eb', num: 3, emoji: '🌲', top: '30%', left: '1%',  cr: '-10deg', cd: 7,   cdy: 0.8, fail: true },
  { color: '#16a34a', num: 9, emoji: '🍎', top: '58%', left: '2%',  cr: '-22deg', cd: 6,   cdy: 1.5  },
  { color: '#c8a84b', num: 5, emoji: '🐘', top: '8%',  right: '3%', cr:  '14deg', cd: 6.5, cdy: 0.3  },
  { color: '#c0392b', num: 2, emoji: '🌸', top: '32%', right: '1%', cr:  '20deg', cd: 7.5, cdy: 1.2  },
  { color: '#16a34a', num: 6, emoji: '🐬', top: '58%', right: '2%', cr:  '12deg', cd: 5,   cdy: 2    },
] as const;

const COVER_CSS = `
@keyframes rg-cover-drift {
  from { transform: translateY(0) rotate(var(--cr)); }
  to   { transform: translateY(-14px) rotate(calc(var(--cr) + 4deg)); }
}
@keyframes rg-orb-pulse {
  0%,100% { box-shadow: 0 0 28px rgba(200,168,75,.75), 0 0 60px rgba(200,168,75,.35), 0 0 120px rgba(200,168,75,.12); }
  50%     { box-shadow: 0 0 44px rgba(200,168,75,1),   0 0 90px rgba(200,168,75,.55), 0 0 180px rgba(200,168,75,.2); }
}
`;

function CardSVG({ c }: { c: typeof COVER_CARDS[number] }) {
  const id = `cg${c.num}${c.color[1]}`;
  return (
    <div style={{
      position: 'absolute',
      top: 'top' in c ? c.top : undefined,
      left: 'left' in c ? c.left : undefined,
      right: 'right' in c ? c.right : undefined,
      '--cr': c.cr,
      animation: `rg-cover-drift ${c.cd}s ${c.cdy}s ease-in-out infinite alternate`,
      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.7))',
      zIndex: 2,
    } as React.CSSProperties}>
      <svg width="54" height="76" viewBox="0 0 54 76" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c.color} stopOpacity="1"/>
            <stop offset="100%" stopColor={c.color} stopOpacity="0.72"/>
          </linearGradient>
        </defs>
        <rect width="54" height="76" rx="6" fill={`url(#${id})`}/>
        <rect x="1" y="1" width="52" height="74" rx="5" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1"/>
        <rect x="4" y="4" width="46" height="68" rx="4" fill="rgba(0,0,0,.1)"/>
        <text x="8" y="20" fontSize="13" fill="white" fontWeight="700" fontFamily="Georgia,serif" opacity="0.95">{c.num}</text>
        <text x="27" y="48" textAnchor="middle" fontSize="20">{c.emoji}</text>
        <text x="46" y="70" textAnchor="end" fontSize="13" fill="white" fontWeight="700" fontFamily="Georgia,serif" opacity="0.95" transform="rotate(180,46,70)">{c.num}</text>
        {'fail' in c && c.fail && <>
          <rect width="54" height="76" rx="6" fill="rgba(140,10,10,.42)"/>
          <line x1="10" y1="10" x2="44" y2="66" stroke="rgba(239,68,68,.9)" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="44" y1="10" x2="10" y2="66" stroke="rgba(239,68,68,.9)" strokeWidth="2.5" strokeLinecap="round"/>
        </>}
        {'pass' in c && c.pass && <>
          <rect x="8" y="1" width="38" height="12" rx="4" fill="rgba(20,120,50,.92)"/>
          <text x="27" y="10" textAnchor="middle" fontSize="6.5" fill="white" fontWeight="700" fontFamily="Arial,sans-serif">✓ ผ่าน</text>
        </>}
      </svg>
    </div>
  );
}

export default function HomeScreen() {
  const { state, dispatch } = useGame();
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState(state.myName);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (mode !== 'menu') return;
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!cv) return;
      cv.width  = window.innerWidth  * dpr;
      cv.height = window.innerHeight * dpr;
      cv.style.width  = window.innerWidth  + 'px';
      cv.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    const ctx = cv.getContext('2d')!;
    const EMBER_RGB = ['255,160,40', '255,100,20', '255,210,80', '240,80,10'];
    const embers = Array.from({ length: 80 }, () => ({
      x: Math.random(), y: Math.random(),
      r: (0.5 + Math.random() * 1.4) * dpr,
      a: 0.15 + Math.random() * 0.5,
      sp: 1.2 + Math.random() * 2.8,
      off: Math.random() * Math.PI * 2,
      col: EMBER_RGB[Math.floor(Math.random() * EMBER_RGB.length)],
    }));
    const rays = Array.from({ length: 12 }, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      width: 0.01 + Math.random() * 0.022,
      alpha: 0.03 + Math.random() * 0.045,
    }));

    let t = 0;
    function draw() {
      const W = cv!.width, H = cv!.height;
      ctx.clearRect(0, 0, W, H);
      embers.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(t * s.sp * 0.02 + s.off);
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.col},${s.a * tw})`;
        ctx.fill();
      });
      const cx = W * 0.5, cy = H * 0.28;
      const len = Math.hypot(W, H);
      const rot = t * 0.003;
      rays.forEach(r => {
        const a = r.angle + rot;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0,   `rgba(220,140,30,${r.alpha})`);
        grad.addColorStop(0.4, `rgba(200,100,20,${r.alpha * 0.4})`);
        grad.addColorStop(1,   'rgba(180,60,10,0)');
        ctx.beginPath();
        ctx.moveTo(0, -len * r.width);
        ctx.lineTo(len, 0);
        ctx.lineTo(0,  len * r.width);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });
      t++;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

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

  /* ── Cover screen ── */
  if (mode === 'menu') {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(210,140,20,.08) 0%, transparent 55%),
          linear-gradient(180deg, rgba(8,2,2,0.52) 0%, rgba(5,1,1,0.18) 40%, rgba(12,4,2,0.55) 100%),
          url('/bg-fire.png') center top / cover no-repeat`,
        backgroundColor: '#110403',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        padding: `max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))`,
      }}>
        <style>{COVER_CSS}</style>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

        {/* Floating cards */}
        {COVER_CARDS.map((c, i) => <CardSVG key={i} c={c} />)}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 440, width: '100%' }}>

          {/* Orb */}
          <div style={{
            width: 'clamp(52px,11vw,72px)', height: 'clamp(52px,11vw,72px)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 32%, #ffe98a, #c8a84b 45%, #6b4a08)',
            animation: 'rg-orb-pulse 3.5s ease-in-out infinite',
            marginBottom: 'clamp(12px,2.5vw,20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'clamp(1.3rem,3.5vw,1.8rem)',
            color: 'rgba(10,5,0,.55)',
            flexShrink: 0,
          }}>⚜</div>

          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 'clamp(.5rem,1.6vw,.65rem)', letterSpacing: '.42em', color: 'rgba(200,168,75,.65)', textTransform: 'uppercase', marginBottom: 6 }}>
            The Secret Rule Game
          </div>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 'clamp(2rem,8.5vw,4.2rem)', fontWeight: 900, color: '#f0d87a', lineHeight: .92, textShadow: '0 0 50px rgba(200,168,75,.45),0 3px 6px rgba(0,0,0,.9)', letterSpacing: '.03em', marginBottom: 'clamp(4px,1vw,8px)' }}>
            Rule<br />Guesser
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 'clamp(.85rem,2.6vw,1.15rem)', color: '#e8dcc0', opacity: .78, letterSpacing: '.18em', fontWeight: 600, marginBottom: 4 }}>
            เกมทายกฎลับ
          </div>
          <div style={{ fontFamily: "'Sarabun',sans-serif", fontSize: 'clamp(.7rem,2vw,.82rem)', color: 'rgba(232,220,192,.5)', letterSpacing: '.04em', marginBottom: 'clamp(10px,2vw,16px)' }}>
            ค้นหากฎที่ซ่อนอยู่จากการเล่นไพ่
          </div>

          {/* Divider */}
          <div style={{ width: 'clamp(90px,25vw,160px)', height: 1, background: 'linear-gradient(90deg,transparent,rgba(200,168,75,.55),transparent)', margin: 'clamp(10px,2vw,16px) auto' }} />

          {/* Badges */}
          <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'clamp(16px,3.5vw,26px)' }}>
            {[['👥','1–6 ผู้เล่น'],['🎂','10+'],['⏱','15–30 นาที']].map(([icon,label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 100, border: '1px solid rgba(200,168,75,.3)', background: 'rgba(200,168,75,.07)', backdropFilter: 'blur(6px)', fontFamily: "'Cinzel',serif", fontSize: 'clamp(.55rem,1.6vw,.65rem)', color: 'rgba(200,168,75,.9)', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                <span>{icon}</span>{label}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
            <button
              onClick={() => setMode('create')}
              style={{ padding: 'clamp(10px,2.5vw,14px) 0', borderRadius: 100, background: 'linear-gradient(135deg,#d4b050,#8a5f18)', border: '1px solid rgba(200,168,75,.4)', color: '#0a0800', fontFamily: "'Cinzel',serif", fontSize: 'clamp(.8rem,2.3vw,.95rem)', fontWeight: 700, letterSpacing: '.1em', cursor: 'pointer', boxShadow: '0 4px 28px rgba(200,168,75,.4),0 2px 8px rgba(0,0,0,.6)', transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)', textTransform: 'uppercase' }}
              onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)')}
              onMouseOut={e => (e.currentTarget.style.transform = '')}
            >⚔ สร้างห้องใหม่</button>
            <button
              onClick={() => setMode('join')}
              style={{ padding: 'clamp(8px,2vw,11px) 0', borderRadius: 100, background: 'transparent', border: '1px solid rgba(200,168,75,.35)', color: 'rgba(200,168,75,.8)', fontFamily: "'Cinzel',serif", fontSize: 'clamp(.75rem,2vw,.88rem)', fontWeight: 600, letterSpacing: '.1em', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'border-color .15s, color .15s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(200,168,75,.7)'; e.currentTarget.style.color = 'rgba(200,168,75,1)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(200,168,75,.35)'; e.currentTarget.style.color = 'rgba(200,168,75,.8)'; }}
            >🔮 เข้าร่วมห้อง</button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 'max(10px,env(safe-area-inset-bottom,0px))', fontFamily: "'Cinzel',serif", fontSize: '.5rem', color: 'rgba(200,168,75,.22)', letterSpacing: '.25em', textTransform: 'uppercase', zIndex: 10 }}>
          Rule Guesser · เกมทายกฎลับ
        </div>
      </div>
    );
  }

  /* ── Create / Join forms ── */
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '1.4rem', fontWeight: 900, color: '#c8a84b', textAlign: 'center', marginBottom: 24, textShadow: '0 0 20px rgba(200,168,75,.3)' }}>
        ⚜ Rule Guesser
      </div>

      <Panel>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'rgba(200,168,75,.7)', fontSize: '.8rem', marginBottom: 6, fontFamily: "'Cinzel',serif" }}>ชื่อของคุณ</div>
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
            <div style={{ color: 'rgba(200,168,75,.7)', fontSize: '.8rem', marginBottom: 6, fontFamily: "'Cinzel',serif" }}>รหัสห้อง</div>
            <Input
              placeholder="XXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ textAlign: 'center', letterSpacing: '.3em', fontSize: '1.3rem' }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>
        )}

        {err && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(80,10,10,.7)', borderRadius: 6, border: '1px solid rgba(180,40,40,.5)' }}>
            <span style={{ fontSize: '.85rem', color: '#ef4444' }}>❌ {err}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={() => { setMode('menu'); setErr(''); }}>← กลับ</Btn>
          <div style={{ flex: 1 }}>
            <Btn variant="primary" fullWidth disabled={loading} onClick={mode === 'create' ? handleCreate : handleJoin}>
              {loading ? 'กำลังโหลด...' : mode === 'create' ? '⚔ สร้างห้อง' : '🔮 เข้าร่วม'}
            </Btn>
          </div>
        </div>

        <Divider />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Btn variant="ghost" style={{ fontSize: '.75rem' }} onClick={() => { setMode(mode === 'create' ? 'join' : 'create'); setErr(''); }}>
            {mode === 'create' ? '🔮 เข้าร่วมห้องแทน' : '⚔ สร้างห้องแทน'}
          </Btn>
        </div>
      </Panel>
    </Screen>
  );
}
