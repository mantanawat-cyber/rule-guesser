import { useEffect, useRef, useState } from 'react';
import { Screen, Btn, Panel } from '../components/Layout';
import CardComponent from '../components/CardComponent';
import { useGame } from '../store/GameContext';
import { listenRoom, updateGameState } from '../firebase/room';
import { CARD_MAP } from '../data/cards';
import { RULE_MAP } from '../data/rules';
import { checkCardValid } from '../game/engine';
import { ALL_RULES } from '../data/rules';
import type { Card, GameState } from '../types';

function toArr<T>(v: T[] | Record<string, T> | null | undefined): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return Object.values(v);
}

function normalizeGame(raw: GameState): GameState {
  return {
    ...raw,
    passedPile: toArr(raw.passedPile as any),
    failedPile: toArr(raw.failedPile as any),
    drawPile: toArr(raw.drawPile as any),
    discardPile: toArr(raw.discardPile as any),
    playLog: toArr(raw.playLog as any),
    players: Object.fromEntries(
      Object.entries(raw.players ?? {}).map(([uid, p]) => [
        uid,
        { ...p, hand: toArr((p as any).hand) },
      ])
    ),
    stuckCheck: raw.stuckCheck ? {
      ...raw.stuckCheck,
      handSnapshot: toArr(raw.stuckCheck.handSnapshot as any),
    } : null,
    guessPhase: raw.guessPhase ? {
      ...raw.guessPhase,
      order: toArr(raw.guessPhase.order as any),
    } : null,
  };
}

const ANIM_STYLES = `
@keyframes rg-shake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  15%      { transform: translateX(-6px) rotate(-3deg); }
  30%      { transform: translateX(6px)  rotate(3deg); }
  45%      { transform: translateX(-5px) rotate(-2deg); }
  60%      { transform: translateX(5px)  rotate(2deg); }
  75%      { transform: translateX(-3px) rotate(-1deg); }
  90%      { transform: translateX(3px)  rotate(1deg); }
}
@keyframes rg-toast-in {
  from { transform: translateY(80px) scale(0.92); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}
@keyframes rg-toast-out {
  from { transform: translateY(0)    scale(1);    opacity: 1; }
  to   { transform: translateY(60px) scale(0.9);  opacity: 0; }
}
.rg-shake { animation: rg-shake 0.5s ease-in-out; }
.rg-toast-enter { animation: rg-toast-in  0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rg-toast-exit  { animation: rg-toast-out 0.25s ease-in forwards; }
`;

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const [game, setGame] = useState<GameState | null>(state.gameState);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [rejectedCard, setRejectedCard] = useState<Card | null>(null);
  const [toastExiting, setToastExiting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stuckValidPick, setStuckValidPick] = useState<string | null>(null);

  const { roomId, myUid } = state;
  const isSolo = game ? Object.keys(game.players).length === 1 : false;
  const isRulemaster = !isSolo && game?.rulemasterUid === myUid;
  const canSeeRule = isSolo || isRulemaster;
  const myTurn = game?.currentTurn === myUid;
  const myHand = (game?.players?.[myUid!]?.hand ?? []).map(id => CARD_MAP[id]).filter(Boolean) as Card[];
  const rule = game?.ruleId ? RULE_MAP[game.ruleId] : null;
  const passedTop = game?.passedPile?.slice(-1)?.[0];
  const passedTopCard = passedTop ? CARD_MAP[passedTop] : null;

  useEffect(() => {
    if (!roomId) return;
    return listenRoom(roomId, data => {
      if (data) setGame(normalizeGame(data));
    });
  }, [roomId]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  function showRejection(card: Card) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastExiting(false);
    setRejectedCard(card);
    toastTimer.current = setTimeout(() => {
      setToastExiting(true);
      toastTimer.current = setTimeout(() => setRejectedCard(null), 300);
    }, 2000);
  }

  async function playCard() {
    if (!game || !myUid || !selected || !rule) return;
    if (game.stuckCheck) return;
    const card = CARD_MAP[selected];
    if (!card) return;
    const valid = checkCardValid(card, passedTopCard, rule);
    const newHand = myHand.filter(c => c.id !== selected).map(c => c.id);
    const newLog = [...(game.playLog ?? []), { cardId: selected, result: valid ? 'pass' : 'fail', uid: myUid } as const];

    try {
      if (valid) {
        const newPassed = [...(game.passedPile ?? []), selected];
        const nextTurn = getNextTurnOrder(game)[0] ?? null;
        if (newHand.length === 0) {
          const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
          const myIdx = nonRM.indexOf(myUid);
          const order = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];
          await updateGameState(roomId!, {
            passedPile: newPassed,
            playLog: newLog,
            phase: 'guess',
            guessPhase: { triggeredBy: myUid, order, currentGuesser: order[0], results: {} },
            players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
          });
        } else {
          await updateGameState(roomId!, {
            passedPile: newPassed,
            playLog: newLog,
            currentTurn: nextTurn,
            players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
          });
        }
      } else {
        showRejection(card);
        await updateGameState(roomId!, {
          playLog: newLog,
          currentTurn: getNextTurnOrder(game)[0] ?? null,
        });
      }
    } catch (e) {
      flash('เกิดข้อผิดพลาด: ' + String(e));
    }
    setSelected(null);
  }

  async function requestStuckCheck() {
    if (!game || !myUid || !myTurn) return;
    if (game.stuckCheck) return;

    // Solo: auto-check with rule engine
    if (isSolo && rule) {
      const stuck = !myHand.some(c => checkCardValid(c, passedTopCard, rule));
      if (!stuck) {
        flash('ยังมีไพ่ที่ลงได้อยู่!');
        return;
      }
      // Truly stuck — draw n-1 replacements
      const n = myHand.length;
      const drawCount = Math.max(0, n - 1);
      const newCards = (game.drawPile ?? []).slice(0, drawCount);
      const newDraw = (game.drawPile ?? []).slice(drawCount);
      await updateGameState(roomId!, {
        stuckCheck: null,
        drawPile: newDraw,
        discardPile: [...(game.discardPile ?? []), ...myHand.map(c => c.id)],
        players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newCards } },
      });
      flash(`ตันจริง! จั่ว ${drawCount} ใบใหม่`);
      return;
    }

    // Multiplayer: send to rulemaster
    await updateGameState(roomId!, {
      stuckCheck: { requesterUid: myUid, handSnapshot: myHand.map(c => c.id) },
    });
  }

  async function resolveStuckTrulyStuck() {
    if (!game || !myUid) return;
    const check = game.stuckCheck;
    if (!check) return;
    const snapshot = check.handSnapshot;
    const n = snapshot.length;
    const drawCount = Math.max(0, n - 1);
    const newCards = (game.drawPile ?? []).slice(0, drawCount);
    const newDraw = (game.drawPile ?? []).slice(drawCount);
    const nextTurn = getNextTurnOrder({ ...game, currentTurn: check.requesterUid })[0] ?? null;
    try {
      await updateGameState(roomId!, {
        stuckCheck: null,
        drawPile: newDraw,
        discardPile: [...(game.discardPile ?? []), ...snapshot],
        currentTurn: nextTurn,
        players: { ...game.players, [check.requesterUid]: { ...game.players[check.requesterUid], hand: newCards } },
      });
    } catch (e) {
      flash('เกิดข้อผิดพลาด: ' + String(e));
    }
    setStuckValidPick(null);
  }

  async function resolveStuckHasValid(validCardId: string) {
    if (!game || !myUid) return;
    const check = game.stuckCheck;
    if (!check) return;
    const uid = check.requesterUid;
    const currentHand = game.players[uid].hand;
    const newHand = currentHand.filter(id => id !== validCardId);
    const replacement = (game.drawPile ?? [])[0];
    const newDraw = (game.drawPile ?? []).slice(1);
    const finalHand = replacement ? [...newHand, replacement] : newHand;
    const newPassed = [...(game.passedPile ?? []), validCardId];
    const newLog = [...(game.playLog ?? []), { cardId: validCardId, result: 'pass' as const, uid }];
    const nextTurn = getNextTurnOrder({ ...game, currentTurn: uid })[0] ?? null;
    try {
      await updateGameState(roomId!, {
        stuckCheck: null,
        drawPile: newDraw,
        passedPile: newPassed,
        playLog: newLog,
        currentTurn: nextTurn,
        players: { ...game.players, [uid]: { ...game.players[uid], hand: finalHand } },
      });
    } catch (e) {
      flash('เกิดข้อผิดพลาด: ' + String(e));
    }
    setStuckValidPick(null);
  }

  async function handleGuess(ruleId: string) {
    if (!game || !myUid || game.phase !== 'guess') return;
    const gp = game.guessPhase!;
    if (gp.currentGuesser !== myUid) return;
    const correct = ruleId === game.ruleId;
    const newResults = { ...gp.results, [myUid]: { ruleId, correct } };

    try {
      if (correct) {
        await updateGameState(roomId!, {
          phase: 'gameOver',
          winnerUid: myUid,
          guessPhase: { ...gp, results: newResults, currentGuesser: '' },
        });
        return;
      }
      const remaining = gp.order.filter(u => !newResults[u]);
      if (remaining.length === 0) {
        await updateGameState(roomId!, {
          phase: 'gameOver',
          winnerUid: null,
          guessPhase: { ...gp, results: newResults, currentGuesser: '' },
        });
        return;
      }
      await updateGameState(roomId!, {
        guessPhase: { ...gp, results: newResults, currentGuesser: remaining[0] },
      });
    } catch (e) {
      flash('เกิดข้อผิดพลาด: ' + String(e));
    }
  }

  if (!game) return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'rgba(200,168,75,0.6)' }}>กำลังโหลด...</div>
    </Screen>
  );

  if (game.phase === 'gameOver') return <GameOverScreen game={game} myUid={myUid!} onHome={() => dispatch({ type: 'GO_HOME' })} />;

  return (
    <Screen style={{ gap: 12, paddingTop: 'max(12px, env(safe-area-inset-top,0px))' }}>
      <style>{ANIM_STYLES}</style>

      {/* Rejection toast */}
      {rejectedCard && (
        <div
          className={toastExiting ? 'rg-toast-exit' : 'rg-toast-enter'}
          style={{
            position: 'fixed',
            bottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(10,5,5,0.92)',
            border: '1px solid rgba(220,50,50,0.6)',
            borderRadius: 16,
            padding: '16px 24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(200,30,30,0.3)',
            backdropFilter: 'blur(12px)',
            minWidth: 180,
          }}
        >
          {/* Red X badge */}
          <div style={{
            position: 'absolute',
            top: -14,
            width: 28, height: 28,
            borderRadius: '50%',
            background: '#c0392b',
            border: '2px solid rgba(255,80,80,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem',
            boxShadow: '0 0 10px rgba(200,30,30,0.6)',
          }}>✕</div>

          {/* Card with shake */}
          <div className="rg-shake" style={{ marginTop: 6 }}>
            <div style={{ position: 'relative' }}>
              <CardComponent card={rejectedCard} size="md" />
              {/* Red overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: 8,
                background: 'rgba(180,20,20,0.35)',
                border: '2px solid rgba(239,68,68,0.8)',
                boxShadow: 'inset 0 0 16px rgba(239,68,68,0.4)',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* Message */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
              ไม่ตรงกฎ!
            </div>
            <div style={{ color: 'rgba(232,220,192,0.6)', fontSize: '0.72rem', fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
              ไพ่กลับเข้ามือ · จบเทิร์น
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', color: 'rgba(200,168,75,0.6)', letterSpacing: '0.1em' }}>
          ⚜ เกมทายกฎลับ
        </div>
        <div style={{ fontSize: '0.75rem', color: myTurn ? '#c8a84b' : 'rgba(200,168,75,0.4)' }}>
          {isRulemaster ? '👑 คนคุมกฎ' : myTurn ? '⚡ เทิร์นของคุณ' : 'รอเทิร์น...'}
        </div>
      </div>

      {/* Rule display (rulemaster only) */}
      {canSeeRule && rule && (
        <Panel style={{ width: '100%', maxWidth: 480, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", marginBottom: 4 }}>
            {isSolo ? '🧪 Solo — กฎลับ' : 'กฎลับของคุณ'}
          </div>
          <div style={{ color: '#c8a84b', fontWeight: 600, fontSize: '0.95rem' }}>
            {rule.nameTH}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.4)', marginTop: 2 }}>
            ระดับ: {rule.difficulty}
          </div>
        </Panel>
      )}

      {/* Table */}
      <Panel style={{ width: '100%', maxWidth: 480, padding: '14px 16px' }}>

        {/* Play history — last 4 plays (pass + fail) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
              ประวัติการลง
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(200,168,75,0.35)' }}>
              ✅ {game.passedPile?.length ?? 0} · ❌ {game.failedPile?.length ?? 0} · แสดง 4 ล่าสุด →
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', minHeight: 116 }}>
            {(() => {
              const log = (game.playLog ?? []).slice(-4);
              const empty = 4 - log.length;
              return (
                <>
                  {Array.from({ length: empty }).map((_, i) => (
                    <div key={`e-${i}`} style={{
                      width: 72, height: 101, borderRadius: 7,
                      border: '1px dashed rgba(200,168,75,0.12)', flexShrink: 0,
                    }} />
                  ))}
                  {log.map((entry, idx) => {
                    const card = CARD_MAP[entry.cardId];
                    if (!card) return null;
                    const isLatest = idx === log.length - 1;
                    const isFail = entry.result === 'fail';
                    const playerName = game.players[entry.uid]?.name ?? '?';
                    return (
                      <div key={`${entry.cardId}-${idx}`} style={{ position: 'relative', flexShrink: 0 }}>
                        {/* Result badge */}
                        <div style={{
                          position: 'absolute', top: -8, left: '50%',
                          transform: 'translateX(-50%)',
                          background: isFail ? 'rgba(180,20,20,0.95)' : 'rgba(20,120,50,0.95)',
                          color: '#fff',
                          fontSize: '0.46rem',
                          fontFamily: "'Cinzel', serif",
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: 4,
                          letterSpacing: '0.03em',
                          whiteSpace: 'nowrap',
                          border: isFail ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(34,197,94,0.5)',
                          zIndex: 1,
                        }}>
                          {isFail ? '✕ ไม่ผ่าน' : '✓ ผ่าน'}
                        </div>

                        <CardComponent card={card} size="sm" />

                        {/* Fail overlay */}
                        {isFail && (
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: 7,
                            background: 'rgba(160,10,10,0.42)',
                            border: '1.5px solid rgba(239,68,68,0.6)',
                            pointerEvents: 'none',
                          }} />
                        )}

                        {/* Player name */}
                        <div style={{
                          position: 'absolute', bottom: -14, left: 0, right: 0,
                          textAlign: 'center',
                          fontSize: '0.5rem',
                          color: isLatest ? 'rgba(200,168,75,0.7)' : 'rgba(200,168,75,0.35)',
                          fontFamily: "'Sarabun', sans-serif",
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {playerName}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}

          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(200,168,75,0.1)', marginBottom: 10 }} />

        {/* Failed pile + player status */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <div style={{
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(180,30,30,0.12)',
            border: '1px solid rgba(180,30,30,0.3)',
            fontSize: '0.68rem',
            color: 'rgba(239,100,100,0.8)',
          }}>
            ❌ ล้มเหลว {game.failedPile?.length ?? 0} ใบ
          </div>

          {Object.entries(game.players ?? {}).map(([uid, p]) => {
            const player = p as any;
            const isCurrent = game.currentTurn === uid;
            const isRM = uid === game.rulemasterUid;
            return (
              <div key={uid} style={{
                padding: '3px 8px', borderRadius: 6,
                background: isCurrent ? 'rgba(200,168,75,0.15)' : 'rgba(0,0,0,0.2)',
                border: isCurrent ? '1px solid rgba(200,168,75,0.4)' : '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.68rem',
                color: isCurrent ? '#c8a84b' : 'rgba(200,168,75,0.45)',
              }}>
                {isCurrent ? '⚡ ' : ''}{isRM ? '👑 ' : ''}{player.name}{uid === myUid ? ' (คุณ)' : ''}{!isRM ? ` · ${player.hand?.length ?? 0}` : ''}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Flash message (draw pile empty etc.) */}
      {msg && (
        <div style={{
          padding: '10px 20px',
          background: 'rgba(10,10,20,0.85)',
          borderRadius: 10,
          border: '1px solid rgba(200,168,75,0.35)',
          fontSize: '0.85rem',
          textAlign: 'center',
          color: 'rgba(232,220,192,0.8)',
          fontFamily: "'Cinzel', serif",
          letterSpacing: '0.04em',
        }}>
          {msg}
        </div>
      )}

      {/* Guess phase */}
      {game.phase === 'guess' && (
        <GuessPhasePanel game={game} myUid={myUid!} onGuess={handleGuess} />
      )}

      {/* Rulemaster: stuck check review panel */}
      {isRulemaster && game.phase === 'playing' && game.stuckCheck && (
        <StuckCheckPanel
          game={game}
          stuckValidPick={stuckValidPick}
          onPickValid={setStuckValidPick}
          onTrulyStuck={resolveStuckTrulyStuck}
          onHasValid={() => { if (stuckValidPick) resolveStuckHasValid(stuckValidPick); }}
        />
      )}

      {/* Player hand */}
      {(!isRulemaster || isSolo) && game.phase === 'playing' && (
        <Panel style={{ width: '100%', maxWidth: 480, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", marginBottom: 10 }}>
            ไพ่ในมือคุณ ({myHand.length} ใบ)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {myHand.map(card => (
              <div
                key={card.id}
                className={rejectedCard?.id === card.id ? 'rg-shake' : undefined}
              >
                <CardComponent
                  card={card}
                  size="sm"
                  selected={selected === card.id}
                  onClick={myTurn ? () => setSelected(selected === card.id ? null : card.id) : undefined}
                  dimmed={!myTurn}
                />
              </div>
            ))}
            {myHand.length === 0 && (
              <div style={{ color: 'rgba(200,168,75,0.4)', fontSize: '0.85rem' }}>มือว่าง</div>
            )}
          </div>

          {myTurn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn
                variant="ghost"
                onClick={requestStuckCheck}
                disabled={!!game.stuckCheck}
                style={{ flex: 1, fontSize: '0.75rem', padding: '8px 10px', opacity: game.stuckCheck ? 0.5 : 1 }}
              >
                🔍 ตรวจมือตัน
              </Btn>
              <Btn
                variant="primary"
                disabled={!selected || !!game.stuckCheck}
                onClick={playCard}
                style={{ flex: 2, fontSize: '0.85rem', padding: '10px 16px' }}
              >
                ⬆ วางไพ่
              </Btn>
            </div>
          )}

          {/* Waiting for stuck check verdict */}
          {!myTurn && game.stuckCheck?.requesterUid === myUid && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(200,168,75,0.08)',
              border: '1px solid rgba(200,168,75,0.25)',
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'rgba(200,168,75,0.7)',
            }}>
              ⏳ รอคนคุมกฎตรวจมือตัน...
            </div>
          )}
        </Panel>
      )}

      <Btn variant="ghost" onClick={() => dispatch({ type: 'GO_HOME' })} style={{ fontSize: '0.75rem', marginTop: 4 }}>
        ออกจากเกม
      </Btn>
    </Screen>
  );
}

function getNextTurnOrder(game: GameState): string[] {
  const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
  const idx = nonRM.indexOf(game.currentTurn ?? '');
  return idx === -1 ? nonRM : [...nonRM.slice(idx + 1), ...nonRM.slice(0, idx + 1)];
}

function GuessPhasePanel({ game, myUid, onGuess }: { game: GameState; myUid: string; onGuess: (id: string) => void }) {
  const gp = game.guessPhase!;
  const isMyTurn = gp.currentGuesser === myUid;
  const alreadyGuessed = !!gp.results?.[myUid];
  const [pick, setPick] = useState('');

  const rules = ALL_RULES;

  return (
    <Panel style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ fontFamily: "'Cinzel', serif", color: '#c8a84b', fontSize: '0.85rem', marginBottom: 8, textAlign: 'center' }}>
        ⚔ เฟสทายกฎ
      </div>
      {alreadyGuessed ? (
        <div style={{ textAlign: 'center', color: 'rgba(200,168,75,0.6)', fontSize: '0.85rem' }}>
          คุณทายแล้ว — รอผลลัพธ์...
        </div>
      ) : isMyTurn ? (
        <>
          <div style={{ color: 'rgba(200,168,75,0.7)', fontSize: '0.8rem', marginBottom: 10 }}>
            ถึงเทิร์นทาย — เลือกกฎที่คิดว่าถูก:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
            {rules.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setPick(r.id)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  background: pick === r.id ? 'rgba(200,168,75,0.15)' : 'rgba(0,0,0,0.2)',
                  border: pick === r.id ? '1px solid rgba(200,168,75,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  color: pick === r.id ? '#c8a84b' : 'rgba(232,220,192,0.7)',
                  fontSize: '0.82rem',
                }}
              >
                {r.nameTH}
              </button>
            ))}
          </div>
          <Btn variant="primary" fullWidth disabled={!pick} onClick={() => onGuess(pick)}>
            ✓ ยืนยันคำตอบ
          </Btn>
        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'rgba(200,168,75,0.6)', fontSize: '0.85rem' }}>
          รอ {game.players[gp.currentGuesser]?.name ?? '...'} ทาย
        </div>
      )}
    </Panel>
  );
}

function StuckCheckPanel({
  game, stuckValidPick, onPickValid, onTrulyStuck, onHasValid,
}: {
  game: GameState;
  stuckValidPick: string | null;
  onPickValid: (id: string | null) => void;
  onTrulyStuck: () => void;
  onHasValid: () => void;
}) {
  const check = game.stuckCheck!;
  const requesterName = game.players[check.requesterUid]?.name ?? '?';
  const handCards = check.handSnapshot.map(id => CARD_MAP[id]).filter(Boolean) as Card[];
  const [mode, setMode] = useState<'choose' | 'pick'>('choose');

  return (
    <Panel style={{ width: '100%', maxWidth: 480, border: '1px solid rgba(200,168,75,0.5)', padding: '14px 16px' }}>
      <div style={{ fontFamily: "'Cinzel', serif", color: '#c8a84b', fontSize: '0.8rem', marginBottom: 4, textAlign: 'center' }}>
        🔍 ตรวจมือตัน
      </div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(200,168,75,0.6)', textAlign: 'center', marginBottom: 12 }}>
        <strong style={{ color: 'rgba(232,220,192,0.9)' }}>{requesterName}</strong> ส่งมือให้ตรวจ ({handCards.length} ใบ)
      </div>

      {/* Their hand */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
        {handCards.map(card => (
          <div
            key={card.id}
            onClick={mode === 'pick' ? () => onPickValid(stuckValidPick === card.id ? null : card.id) : undefined}
            style={{ cursor: mode === 'pick' ? 'pointer' : 'default', position: 'relative' }}
          >
            <CardComponent
              card={card}
              size="sm"
              selected={mode === 'pick' && stuckValidPick === card.id}
            />
          </div>
        ))}
      </div>

      {mode === 'choose' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            variant="ghost"
            onClick={onTrulyStuck}
            style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px', borderColor: 'rgba(200,80,80,0.4)', color: 'rgba(239,100,100,0.9)' }}
          >
            😶 ตันจริง
          </Btn>
          <Btn
            variant="primary"
            onClick={() => setMode('pick')}
            style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px' }}
          >
            👆 มีไพ่ลงได้
          </Btn>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.72rem', color: 'rgba(200,168,75,0.6)', textAlign: 'center', marginBottom: 8 }}>
            แตะไพ่ที่ลงได้ แล้วกดยืนยัน
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setMode('choose'); onPickValid(null); }} style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px' }}>
              ← ย้อนกลับ
            </Btn>
            <Btn variant="primary" disabled={!stuckValidPick} onClick={onHasValid} style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px' }}>
              ✓ ยืนยัน
            </Btn>
          </div>
        </>
      )}
    </Panel>
  );
}

function GameOverScreen({ game, myUid, onHome }: { game: GameState; myUid: string; onHome: () => void }) {
  const winner = game.winnerUid ? game.players[game.winnerUid]?.name : null;
  const rule = game.ruleId ? RULE_MAP[game.ruleId] : null;
  const isWinner = game.winnerUid === myUid;

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Panel style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: '1.6rem', marginBottom: 8, color: '#c8a84b' }}>
          {winner ? (isWinner ? '🏆 คุณชนะ!' : `${winner} ชนะ!`) : '🤝 ไม่มีผู้ชนะ'}
        </div>
        {rule && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(200,168,75,0.08)', borderRadius: 8, border: '1px solid rgba(200,168,75,0.3)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(200,168,75,0.6)', marginBottom: 4, fontFamily: "'Cinzel', serif" }}>
              กฎลับที่ซ่อนอยู่คือ
            </div>
            <div style={{ color: '#e8dcc0', fontWeight: 600 }}>{rule.nameTH}</div>
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <Btn variant="primary" onClick={onHome}>กลับหน้าหลัก</Btn>
        </div>
      </Panel>
    </Screen>
  );
}
