import { useEffect, useState } from 'react';
import { Screen, Btn, Panel } from '../components/Layout';
import CardComponent, { CardBack } from '../components/CardComponent';
import { useGame } from '../store/GameContext';
import { listenRoom, updateGameState, updatePlayerHand } from '../firebase/room';
import { CARD_MAP } from '../data/cards';
import { RULE_MAP } from '../data/rules';
import { checkCardValid } from '../game/engine';
import { ALL_RULES } from '../data/rules';
import type { Card, GameState } from '../types';

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const [game, setGame] = useState<GameState | null>(state.gameState);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const { roomId, myUid } = state;
  const isRulemaster = game?.rulemasterUid === myUid;
  const myTurn = game?.currentTurn === myUid;
  const myHand = (game?.players?.[myUid!]?.hand ?? []).map(id => CARD_MAP[id]).filter(Boolean) as Card[];
  const rule = game?.ruleId ? RULE_MAP[game.ruleId] : null;
  const passedTop = game?.passedPile?.slice(-1)?.[0];
  const passedTopCard = passedTop ? CARD_MAP[passedTop] : null;

  useEffect(() => {
    if (!roomId) return;
    return listenRoom(roomId, data => {
      if (data) setGame(data);
    });
  }, [roomId]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  async function playCard() {
    if (!game || !myUid || !selected || !rule) return;
    const card = CARD_MAP[selected];
    if (!card) return;
    const valid = checkCardValid(card, passedTopCard, rule);

    const newHand = myHand.filter(c => c.id !== selected).map(c => c.id);

    if (valid) {
      const newPassed = [...(game.passedPile ?? []), selected];
      const nextUids = getNextTurnOrder(game);
      const nextTurn = nextUids[0] ?? null;
      await updatePlayerHand(roomId!, myUid, newHand);
      if (newHand.length === 0) {
        // trigger guess phase
        const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
        const myIdx = nonRM.indexOf(myUid);
        const order = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];
        await updateGameState(roomId!, {
          passedPile: newPassed,
          phase: 'guess',
          guessPhase: { triggeredBy: myUid, order, currentGuesser: order[0], results: {} },
          players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
        });
      } else {
        await updateGameState(roomId!, {
          passedPile: newPassed,
          currentTurn: nextTurn,
          players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
        });
      }
    } else {
      // Invalid — return to hand, end turn
      const nextUids = getNextTurnOrder(game);
      flash('❌ ไพ่นี้ไม่ตรงกฎ กลับเข้ามือ');
      await updateGameState(roomId!, {
        currentTurn: nextUids[0] ?? null,
      });
    }
    setSelected(null);
  }

  async function drawCard() {
    if (!game || !myUid) return;
    const draw = game.drawPile?.[0];
    if (!draw) { flash('กองจั่วหมดแล้ว'); return; }
    const newHand = [...myHand.map(c => c.id), draw];
    const newDraw = game.drawPile.slice(1);
    await updatePlayerHand(roomId!, myUid, newHand);
    await updateGameState(roomId!, { drawPile: newDraw, players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } } });
  }

  async function handleGuess(ruleId: string) {
    if (!game || !myUid || game.phase !== 'guess') return;
    const gp = game.guessPhase!;
    if (gp.currentGuesser !== myUid) return;
    const correct = ruleId === game.ruleId;
    const newResults = { ...gp.results, [myUid]: { ruleId, correct } };

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
  }

  if (!game) return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'rgba(200,168,75,0.6)' }}>กำลังโหลด...</div>
    </Screen>
  );

  if (game.phase === 'gameOver') return <GameOverScreen game={game} myUid={myUid!} onHome={() => dispatch({ type: 'GO_HOME' })} />;

  return (
    <Screen style={{ gap: 12, paddingTop: 'max(12px, env(safe-area-inset-top,0px))' }}>
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
      {isRulemaster && rule && (
        <Panel style={{ width: '100%', maxWidth: 480, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", marginBottom: 4 }}>
            กฎลับของคุณ
          </div>
          <div style={{ color: '#c8a84b', fontWeight: 600, fontSize: '0.95rem' }}>
            {rule.nameTH}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.4)', marginTop: 2 }}>
            ระดับ: {rule.difficulty}
          </div>
        </Panel>
      )}

      {/* Table — passed pile + player hands */}
      <Panel style={{ width: '100%', maxWidth: 480, padding: '16px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Passed pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif" }}>กองผ่าน</div>
            {passedTopCard ? <CardComponent card={passedTopCard} /> : (
              <div style={{ width: 90, height: 126, borderRadius: 8, border: '1px dashed rgba(200,168,75,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(200,168,75,0.3)', fontSize: '1.5rem' }}>?</span>
              </div>
            )}
            <div style={{ fontSize: '0.6rem', color: 'rgba(200,168,75,0.4)' }}>{game.passedPile?.length ?? 0} ใบ</div>
          </div>

          {/* Draw pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif" }}>กองจั่ว</div>
            <CardBack />
            <div style={{ fontSize: '0.6rem', color: 'rgba(200,168,75,0.4)' }}>{game.drawPile?.length ?? 0} ใบ</div>
          </div>

          {/* Failed pile info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif" }}>กองล้มเหลว</div>
            <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{game.failedPile?.length ?? 0} ใบ</div>
          </div>
        </div>

        {/* Player status row */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(game.players ?? {}).map(([uid, p]) => {
            const player = p as any;
            const isCurrent = game.currentTurn === uid;
            const isRM = uid === game.rulemasterUid;
            return (
              <div key={uid} style={{
                padding: '4px 8px', borderRadius: 6,
                background: isCurrent ? 'rgba(200,168,75,0.15)' : 'rgba(0,0,0,0.2)',
                border: isCurrent ? '1px solid rgba(200,168,75,0.4)' : '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.72rem',
                color: isCurrent ? '#c8a84b' : 'rgba(200,168,75,0.5)',
              }}>
                {isRM ? '👑' : ''} {player.name} {uid === myUid ? '(คุณ)' : ''} {!isRM && ` · ${player.hand?.length ?? 0}ใบ`}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Flash message */}
      {msg && (
        <div style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.6)', borderRadius: 8, border: '1px solid rgba(200,168,75,0.3)', fontSize: '0.9rem', textAlign: 'center' }}>
          {msg}
        </div>
      )}

      {/* Guess phase */}
      {game.phase === 'guess' && (
        <GuessPhasePanel game={game} myUid={myUid!} onGuess={handleGuess} />
      )}

      {/* Player hand */}
      {!isRulemaster && game.phase === 'playing' && (
        <Panel style={{ width: '100%', maxWidth: 480, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", marginBottom: 10 }}>
            ไพ่ในมือคุณ ({myHand.length} ใบ)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {myHand.map(card => (
              <CardComponent
                key={card.id}
                card={card}
                size="sm"
                selected={selected === card.id}
                onClick={myTurn ? () => setSelected(selected === card.id ? null : card.id) : undefined}
                dimmed={!myTurn}
              />
            ))}
            {myHand.length === 0 && (
              <div style={{ color: 'rgba(200,168,75,0.4)', fontSize: '0.85rem' }}>มือว่าง</div>
            )}
          </div>

          {myTurn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn variant="ghost" onClick={drawCard} style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}>
                🃏 จั่วไพ่
              </Btn>
              <Btn
                variant="primary"
                disabled={!selected}
                onClick={playCard}
                style={{ flex: 2, fontSize: '0.85rem', padding: '10px 16px' }}
              >
                ⬆ วางไพ่
              </Btn>
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
