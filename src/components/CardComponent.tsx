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
  const W = size === 'sm' ? 72 : size === 'lg' ? 108 : 90;
  const H = Math.round(W * (378 / 270));
  const barH = Math.round(H * 0.14);
  const fontSize = size === 'sm' ? '1rem' : size === 'lg' ? '1.5rem' : '1.2rem';
  const emojiSize = size === 'sm' ? '0.9rem' : size === 'lg' ? '1.2rem' : '1rem';

  return (
    <div
      onClick={onClick}
      style={{
        width: W,
        height: H,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        boxShadow: selected
          ? `0 0 0 3px ${COLOR_HEX[card.color]}, ${GLOW[card.color]}`
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
      {/* Top bar — number */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: barH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 900,
          fontSize,
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          lineHeight: 1,
        }}>
          {card.number}
        </span>
      </div>

      {/* Bottom bar — category */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: barH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}>
        <span style={{ fontSize: emojiSize }}>{card.categoryEmoji}</span>
        <span style={{
          fontFamily: "'Sarabun', sans-serif",
          fontSize: size === 'sm' ? '0.55rem' : '0.65rem',
          color: '#fff',
          fontWeight: 600,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          {card.categoryTH}
        </span>
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
