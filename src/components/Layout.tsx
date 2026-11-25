import type { CSSProperties, ReactNode } from 'react';

export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingLeft: 'max(16px, env(safe-area-inset-left,0px))',
      paddingRight: 'max(16px, env(safe-area-inset-right,0px))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom,0px))',
      paddingTop: 'max(16px, env(safe-area-inset-top,0px))',
      position: 'relative',
      zIndex: 1,
      ...style,
    }}>
      {/* Golden top glow — matches cover screen, pure CSS */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '35vh',
        background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(200,168,75,.055) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {children}
    </div>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      background: 'rgba(26,34,64,0.9)',
      border: '1px solid rgba(180,150,60,0.4)',
      borderRadius: 16,
      padding: '20px 20px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 0 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,168,75,0.15)',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{
        fontFamily: "'Cinzel Decorative', serif",
        fontSize: '1.1rem',
        color: '#c8a84b',
        letterSpacing: '0.08em',
        textShadow: '0 0 16px rgba(200,168,75,0.5)',
        marginBottom: 4,
      }}>
        ⚜ เกมทายกฎลับ ⚜
      </div>
      {subtitle && (
        <div style={{ color: 'rgba(200,168,75,0.6)', fontSize: '0.75rem', letterSpacing: '0.15em', fontFamily: "'Cinzel', serif" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

interface BtnProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export function Btn({ onClick, disabled, variant = 'primary', fullWidth, children, style }: BtnProps) {
  const base: CSSProperties = {
    padding: '12px 20px',
    borderRadius: 8,
    fontFamily: "'Cinzel', serif",
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    transition: 'all 0.15s',
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  if (variant === 'primary') return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'linear-gradient(135deg, #8b6914 0%, #c8a84b 50%, #8b6914 100%)',
      color: '#0a0e1a',
      border: '1px solid #c8a84b',
      boxShadow: disabled ? 'none' : '0 0 12px rgba(200,168,75,0.3)',
      ...style,
    }}>{children}</button>
  );
  if (variant === 'ghost') return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'transparent',
      color: 'rgba(200,168,75,0.7)',
      border: '1px solid rgba(180,150,60,0.4)',
      ...style,
    }}>{children}</button>
  );
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'rgba(180,30,30,0.3)',
      color: '#ef4444',
      border: '1px solid rgba(180,30,30,0.5)',
      ...style,
    }}>{children}</button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={{
      width: '100%',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(180,150,60,0.4)',
      borderRadius: 8,
      color: '#e8dcc0',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.15s',
      ...props.style,
    }} />
  );
}

export function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(180,150,60,0.25)' }} />
      <div style={{ color: 'rgba(200,168,75,0.4)', fontSize: '0.75rem' }}>✦</div>
      <div style={{ flex: 1, height: 1, background: 'rgba(180,150,60,0.25)' }} />
    </div>
  );
}
