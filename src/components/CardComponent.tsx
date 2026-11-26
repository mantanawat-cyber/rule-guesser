import type { Card } from '../types';

// Place card background images in src/assets/cards/
// Filenames: bg-red.png, bg-blue.png, bg-green.png, bg-yellow.png
const BG_IMAGES: Record<string, string> = {
  red:    new URL('../assets/cards/bg-red.png', import.meta.url).href,
  blue:   new URL('../assets/cards/bg-blue.png', import.meta.url).href,
  green:  new URL('../assets/cards/bg-green.png', import.meta.url).href,
  yellow: new URL('../assets/cards/bg-yellow.png', import.meta.url).href,
};

const GLOW: Record<string, string> = {
  red:    '0 0 16px rgba(239,68,68,0.6)',
  blue:   '0 0 16px rgba(59,130,246,0.6)',
  green:  '0 0 16px rgba(34,197,94,0.6)',
  yellow: '0 0 16px rgba(234,179,8,0.6)',
};

const CATEGORY_ACCENT: Record<string, { bg: string; text: string }> = {
  animal: { bg: 'rgba(255,140,30,0.22)',  text: '#ffb347' },
  food:   { bg: 'rgba(220,60,120,0.22)',  text: '#ff85c0' },
  nature: { bg: 'rgba(30,200,180,0.22)',  text: '#4dd9c0' },
};

const COLOR_HEX: Record<string, string> = {
  red:    '#ef4444',
  blue:   '#3b82f6',
  green:  '#22c55e',
  yellow: '#eab308',
};

interface Props {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  dimmed?: boolean;
}

export default function CardComponent({ card, onClick, selected, size = 'md', dimmed }: Props) {
  const accent = CATEGORY_ACCENT[card.category] ?? { bg: 'rgba(255,215,0,0.15)', text: '#ffd700' };
  const W = size === 'sm' ? 72 : size === 'lg' ? 108 : 90;
  const H = Math.round(W * (378 / 270));
  const barH = Math.round(H * 0.165);

  // scale factors relative to md (90px wide)
  const scale = W / 90;
  const cornerNumSize  = `${scale * 0.72}rem`;
  const cornerEmoji    = `${scale * 0.65}rem`;
  const centerNumSize  = `${scale * 2.6}rem`;
  const bottomThSize   = `${scale * 0.72}rem`;
  const bottomEnSize   = `${scale * 0.52}rem`;
  const bottomEmoji    = `${scale * 0.75}rem`;
  const cornerPad      = Math.round(scale * 5);

  const CATEGORY_EN: Record<string, string> = {
    animal: 'ANIMAL', food: 'FOOD', nature: 'NATURE',
  };

  return (
    <div
      onClick={onClick}
      style={{
        width: W,
        height: H,
        borderRadius: Math.round(scale * 8),
        overflow: 'hidden',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        boxShadow: selected
          ? `0 0 0 ${Math.round(scale * 3)}px ${COLOR_HEX[card.color]}, ${GLOW[card.color]}`
          : GLOW[card.color],
        transform: selected ? 'translateY(-6px) scale(1.05)' : 'none',
        transition: 'transform 0.15s, box-shadow 0.15s',
        opacity: dimmed ? 0.4 : 1,
        backgroundImage: `url(${BG_IMAGES[card.color]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        userSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: barH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${cornerPad}px`,
      }}>
        {/* left corner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: cornerNumSize, color: '#ffd700', textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1 }}>
            {card.number}
          </span>
          <span style={{ fontSize: cornerEmoji, lineHeight: 1 }}>{card.categoryEmoji}</span>
        </div>
        {/* right corner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: cornerEmoji, lineHeight: 1 }}>{card.categoryEmoji}</span>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: cornerNumSize, color: '#ffd700', textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1 }}>
            {card.number}
          </span>
        </div>
      </div>

      {/* Center — large number */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Math.round(barH * 0.3),
      }}>
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 900,
          fontSize: centerNumSize,
          color: '#ffd700',
          WebkitTextStroke: `${Math.max(1, Math.round(scale * 1.5))}px rgba(120,60,0,0.8)`,
          textShadow: `0 0 ${Math.round(scale * 12)}px rgba(255,180,0,0.7), 0 2px 4px rgba(0,0,0,0.9)`,
          lineHeight: 1,
        }}>
          {card.number}
        </span>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: barH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${cornerPad}px`,
        background: accent.bg,
        borderTop: `1px solid ${accent.text}44`,
      }}>
        {/* left emoji */}
        <span style={{ fontSize: bottomEmoji, lineHeight: 1 }}>{card.categoryEmoji}</span>
        {/* center text */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
          <span style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700, fontSize: bottomThSize, color: accent.text, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {card.categoryTH}
          </span>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 400, fontSize: bottomEnSize, color: `${accent.text}bb`, letterSpacing: '0.08em' }}>
            {CATEGORY_EN[card.category]}
          </span>
        </div>
        {/* right emoji */}
        <span style={{ fontSize: bottomEmoji, lineHeight: 1 }}>{card.categoryEmoji}</span>
      </div>
    </div>
  );
}

// Card back (face-down)
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const W = size === 'sm' ? 72 : size === 'lg' ? 108 : 90;
  const H = Math.round(W * (378 / 270));
  return (
    <div style={{
      width: W, height: H,
      borderRadius: 8,
      background: 'linear-gradient(135deg, #1a2240 0%, #0d1529 100%)',
      border: '1px solid rgba(200,168,75,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: size === 'sm' ? '1.4rem' : '1.8rem', opacity: 0.6 }}>⚜</span>
    </div>
  );
}
