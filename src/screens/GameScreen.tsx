import { useEffect, useMemo, useRef, useState } from 'react';
import { Screen, Btn, Panel } from '../components/Layout';
import CardComponent from '../components/CardComponent';
import { useGame } from '../store/GameContext';
import { listenRoom, updateGameState, startGame } from '../firebase/room';
import { CARD_MAP } from '../data/cards';
import { RULE_MAP } from '../data/rules';
import { checkCardValid, buildInitialGameState, pickRandomRule } from '../game/engine';
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
@keyframes rg-flash-drop {
  0%   { transform: translateX(-50%) translateY(-18px) scale(0.94); opacity: 0; }
  60%  { transform: translateX(-50%) translateY(3px)  scale(1.02); opacity: 1; }
  100% { transform: translateX(-50%) translateY(0)    scale(1);    opacity: 1; }
}
@keyframes rg-flash-pulse {
  0%,100% { box-shadow: 0 0 10px rgba(210,150,30,0.25), 0 4px 20px rgba(0,0,0,0.6); }
  50%     { box-shadow: 0 0 22px rgba(210,150,30,0.55), 0 4px 24px rgba(0,0,0,0.6); }
}
@keyframes rg-toast-out {
  from { transform: translateY(0)    scale(1);    opacity: 1; }
  to   { transform: translateY(60px) scale(0.9);  opacity: 0; }
}
@keyframes rg-turn-banner {
  0%   { transform: translateY(-70px) scale(0.9); opacity: 0; }
  18%  { transform: translateY(0)     scale(1.04); opacity: 1; }
  25%  { transform: translateY(0)     scale(1);    opacity: 1; }
  80%  { transform: translateY(0)     scale(1);    opacity: 1; }
  100% { transform: translateY(-70px) scale(0.9);  opacity: 0; }
}
@keyframes rg-red-flash {
  0%   { opacity: 0.55; }
  100% { opacity: 0; }
}
@keyframes rg-pass-glow {
  0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  30%  { box-shadow: 0 0 22px 8px rgba(34,197,94,0.75); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
@keyframes rg-guess-entry {
  0%   { transform: scale(0.7); opacity: 0; }
  25%  { transform: scale(1.06); opacity: 1; }
  65%  { transform: scale(1);   opacity: 1; }
  100% { transform: scale(1.1); opacity: 0; }
}
@keyframes rg-confetti-fall {
  0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
}
@keyframes rg-winner-glow {
  0%,100% { text-shadow: 0 0 10px rgba(200,168,75,0.4); }
  50%     { text-shadow: 0 0 30px rgba(200,168,75,0.9), 0 0 60px rgba(200,168,75,0.4); }
}
@keyframes rg-particle-float {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  8%   { opacity: 0.35; }
  92%  { opacity: 0.12; }
  100% { transform: translateY(-100vh) translateX(var(--drift)) rotate(180deg); opacity: 0; }
}
@keyframes rg-latest-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(200,168,75,0); }
  50%     { box-shadow: 0 0 10px 3px rgba(200,168,75,0.35); }
}
@keyframes rg-bg-pass-ring {
  0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0.7; }
  65%  { opacity: 0.2; }
  100% { transform: translate(-50%,-50%) scale(5);   opacity: 0; }
}
@keyframes rg-bg-pass-glow {
  0%   { opacity: 0; }
  18%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes rg-bg-spark {
  0%   { transform: rotate(var(--sa)) translateX(0)     scale(1.2); opacity: 1; }
  100% { transform: rotate(var(--sa)) translateX(140px) scale(0);   opacity: 0; }
}
@keyframes rg-bg-fail-vignette {
  0%   { opacity: 0.7; }
  100% { opacity: 0; }
}
@keyframes rg-card-play-out {
  0%   { transform: translateY(-12px) scale(1.08); opacity: 1; }
  45%  { transform: translateY(-55px) scale(0.9);  opacity: 0.7; }
  100% { transform: translateY(-130px) scale(0.4); opacity: 0; }
}
.rg-shake        { animation: rg-shake 0.5s ease-in-out; }
.rg-toast-enter  { animation: rg-toast-in  0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rg-toast-exit   { animation: rg-toast-out 0.25s ease-in forwards; }
.rg-pass-glow    { animation: rg-pass-glow 0.7s ease-out forwards; }
.rg-winner-glow  { animation: rg-winner-glow 2s ease-in-out infinite; }
.rg-latest-pulse { animation: rg-latest-pulse 2.5s ease-in-out infinite; border-radius: 7px; }
.rg-card-hand {
  transition:
    transform 0.22s cubic-bezier(0.22,1,0.36,1),
    filter    0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22,1,0.36,1);
  cursor: pointer;
  will-change: transform;
}
@media (hover: hover) and (pointer: fine) {
  .rg-card-hand:hover:not(.rg-card-selected) {
    transform: translateY(-6px) scale(1.04);
    filter: brightness(1.1);
  }
}
.rg-card-hand.rg-card-selected {
  transform: translateY(-14px) scale(1.07);
  filter: brightness(1.2);
  box-shadow: 0 0 0 2px rgba(210,160,50,0.9), 0 10px 28px rgba(200,140,30,0.4), 0 0 18px rgba(200,140,30,0.2);
  border-radius: 8px;
}
.rg-card-playing {
  animation: rg-card-play-out 0.32s cubic-bezier(0.4,0,1,1) forwards;
  pointer-events: none;
}
.rg-card-hand-dimmed { transition: filter 0.15s ease; }
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
  const [playingCard, setPlayingCard] = useState<string | null>(null);
  const [showBgPass, setShowBgPass] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [showTurnBanner, setShowTurnBanner] = useState(false);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [showGuessEntry, setShowGuessEntry] = useState(false);
  const [passFlash, setPassFlash] = useState(false);
  const prevTurnRef = useRef<string | null | undefined>(undefined);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const prevPassedLenRef = useRef<number>(0);

  const { roomId, myUid } = state;
  const isVsSystem = game?.rulemasterUid === 'system';
  const isSolo = !isVsSystem && !game?.rulemasterUid;
  const isRulemaster = !isSolo && !isVsSystem && game?.rulemasterUid === myUid;
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

  useEffect(() => {
    if (!game || !myUid) return;

    // Turn banner: show when turn first comes to me
    if (prevTurnRef.current !== undefined && game.currentTurn === myUid && prevTurnRef.current !== myUid) {
      setShowTurnBanner(true);
      const t = setTimeout(() => setShowTurnBanner(false), 2000);
      return () => clearTimeout(t);
    }
    prevTurnRef.current = game.currentTurn;
  }, [game?.currentTurn]);

  useEffect(() => {
    if (!game) return;

    // Guess phase entry overlay
    if (prevPhaseRef.current === 'playing' && game.phase === 'guess') {
      setShowGuessEntry(true);
      const t = setTimeout(() => setShowGuessEntry(false), 2200);
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = game.phase;
  }, [game?.phase]);

  useEffect(() => {
    if (!game) return;
    const len = game.passedPile?.length ?? 0;
    if (prevPassedLenRef.current > 0 && len > prevPassedLenRef.current) {
      setPassFlash(true);
      const t = setTimeout(() => setPassFlash(false), 700);
      prevPassedLenRef.current = len;
      return () => clearTimeout(t);
    }
    prevPassedLenRef.current = len;
  }, [game?.passedPile?.length]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  function showRejection(card: Card) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastExiting(false);
    setRejectedCard(card);
    setShowRedFlash(true);
    setTimeout(() => setShowRedFlash(false), 450);
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

    // Compute everything synchronously before any await (closure-safe)
    const cardId = selected;
    const valid = checkCardValid(card, passedTopCard, rule);
    const newHand = myHand.filter(c => c.id !== cardId).map(c => c.id);
    const newLog = [...(game.playLog ?? []), { cardId, result: valid ? 'pass' : 'fail', uid: myUid } as const];
    const newPassed = valid ? [...(game.passedPile ?? []), cardId] : null;
    const nextTurn = getNextTurnOrder(game)[0] ?? null;
    const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
    const myIdx = nonRM.indexOf(myUid);
    const guessOrder = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];

    if (valid) {
      setPlayingCard(cardId);
      setSelected(null);
      setShowBgPass(true);
      await new Promise(r => setTimeout(r, 300));
      setPlayingCard(null);
      setTimeout(() => setShowBgPass(false), 750);
    }

    try {
      if (valid) {
        if (newHand.length === 0) {
          await updateGameState(roomId!, {
            passedPile: newPassed!,
            playLog: newLog,
            phase: 'guess',
            guessPhase: { triggeredBy: myUid, order: guessOrder, currentGuesser: guessOrder[0], results: {} },
            players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
          });
        } else {
          await updateGameState(roomId!, {
            passedPile: newPassed!,
            playLog: newLog,
            currentTurn: nextTurn,
            players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newHand } },
          });
        }
      } else {
        showRejection(card);
        await updateGameState(roomId!, {
          playLog: newLog,
          currentTurn: nextTurn,
          failedPile: [...(game.failedPile ?? []), cardId],
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

    // Solo / VS System: auto-check with rule engine (no human rulemaster needed)
    if ((isSolo || isVsSystem) && rule) {
      const stuck = !myHand.some(c => checkCardValid(c, passedTopCard, rule));
      if (!stuck) {
        // มีไพ่ที่ลงได้ — ระบบ auto-play 1 ใบ แล้วจั่วใบใหม่มาแทน
        const validCard = myHand.find(c => checkCardValid(c, passedTopCard, rule))!;
        const cardId = validCard.id;
        const newHand = myHand.filter(c => c.id !== cardId).map(c => c.id);
        const newLog = [...(game.playLog ?? []), { cardId, result: 'pass' as const, uid: myUid }];
        const newPassed = [...(game.passedPile ?? []), cardId];
        const replacement = (game.drawPile ?? [])[0];
        const newDraw = replacement ? (game.drawPile ?? []).slice(1) : (game.drawPile ?? []);
        const finalHand = replacement ? [...newHand, replacement] : newHand;
        const nextTurn = getNextTurnOrder(game)[0] ?? null;

        if (finalHand.length === 0) {
          const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
          const myIdx = nonRM.indexOf(myUid);
          const order = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];
          try {
            await updateGameState(roomId!, {
              passedPile: newPassed, playLog: newLog, drawPile: newDraw,
              phase: 'guess',
              guessPhase: { triggeredBy: myUid, order, currentGuesser: order[0], results: {} },
              players: { ...game.players, [myUid]: { ...game.players[myUid], hand: finalHand } },
            });
          } catch (e) { flash('เกิดข้อผิดพลาด: ' + String(e)); }
        } else {
          try {
            await updateGameState(roomId!, {
              passedPile: newPassed, playLog: newLog, drawPile: newDraw,
              currentTurn: nextTurn,
              players: { ...game.players, [myUid]: { ...game.players[myUid], hand: finalHand } },
            });
          } catch (e) { flash('เกิดข้อผิดพลาด: ' + String(e)); }
          flash(`มีไพ่ลงได้! ระบบลง ${validCard.colorTH} ${validCard.number} ให้อัตโนมัติ`);
        }
        return;
      }
      const n = myHand.length;

      // Last card and truly stuck → go to guess phase directly
      if (n <= 1) {
        const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
        const myIdx = nonRM.indexOf(myUid);
        const order = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];
        try {
          await updateGameState(roomId!, {
            stuckCheck: null,
            phase: 'guess',
            guessPhase: { triggeredBy: myUid, order, currentGuesser: order[0], results: {} },
            discardPile: [...(game.discardPile ?? []), ...myHand.map(c => c.id)],
            players: { ...game.players, [myUid]: { ...game.players[myUid], hand: [] } },
          });
        } catch (e) {
          flash('เกิดข้อผิดพลาด: ' + String(e));
        }
        return;
      }

      const drawCount = Math.min(game.drawPile.length, Math.max(1, n - 1));
      const newCards = (game.drawPile ?? []).slice(0, drawCount);
      const newDraw = (game.drawPile ?? []).slice(drawCount);
      try {
        await updateGameState(roomId!, {
          stuckCheck: null,
          drawPile: newDraw,
          discardPile: [...(game.discardPile ?? []), ...myHand.map(c => c.id)],
          players: { ...game.players, [myUid]: { ...game.players[myUid], hand: newCards } },
        });
      } catch (e) {
        flash('เกิดข้อผิดพลาด: ' + String(e));
      }
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
    const uid = check.requesterUid;

    // Last card and truly stuck → go to guess phase directly
    if (n <= 1) {
      const nonRM = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
      const myIdx = nonRM.indexOf(uid);
      const order = [...nonRM.slice(myIdx), ...nonRM.slice(0, myIdx)];
      try {
        await updateGameState(roomId!, {
          stuckCheck: null,
          phase: 'guess',
          guessPhase: { triggeredBy: uid, order, currentGuesser: order[0], results: {} },
          discardPile: [...(game.discardPile ?? []), ...snapshot],
          players: { ...game.players, [uid]: { ...game.players[uid], hand: [] } },
        });
      } catch (e) {
        flash('เกิดข้อผิดพลาด: ' + String(e));
      }
      setStuckValidPick(null);
      return;
    }

    const drawCount = Math.min(game.drawPile.length, Math.max(1, n - 1));
    const newCards = (game.drawPile ?? []).slice(0, drawCount);
    const newDraw = (game.drawPile ?? []).slice(drawCount);
    const nextTurn = getNextTurnOrder({ ...game, currentTurn: uid })[0] ?? null;
    try {
      await updateGameState(roomId!, {
        stuckCheck: null,
        drawPile: newDraw,
        discardPile: [...(game.discardPile ?? []), ...snapshot],
        currentTurn: nextTurn,
        players: { ...game.players, [uid]: { ...game.players[uid], hand: newCards } },
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

  async function handleLeaveGame() {
    if (!game || !myUid) { dispatch({ type: 'GO_HOME' }); return; }
    if (game.phase === 'gameOver' || game.phase === 'lobby') { dispatch({ type: 'GO_HOME' }); return; }

    try {
      const remainingPlayers = Object.fromEntries(
        Object.entries(game.players).filter(([uid]) => uid !== myUid)
      );
      const remainingUids = Object.keys(remainingPlayers);
      const updates: Partial<GameState> = { players: remainingPlayers };

      // Transfer host
      if (game.hostUid === myUid && remainingUids.length > 0) {
        updates.hostUid = remainingUids[0];
      }

      // End game: no players left
      if (remainingUids.length === 0) {
        updates.phase = 'gameOver';
        updates.winnerUid = null;
      }
      // End game: I'm the human rulemaster — nobody left to arbiter
      else if (!isVsSystem && !isSolo && game.rulemasterUid === myUid) {
        updates.phase = 'gameOver';
        updates.winnerUid = null;
      }
      // End game: I'm the last player (rulemaster stays but has nobody to play with)
      else if (remainingUids.filter(u => u !== game.rulemasterUid).length === 0) {
        updates.phase = 'gameOver';
        updates.winnerUid = null;
      }
      else {
        // Advance turn if it's mine
        if (game.currentTurn === myUid) {
          const all = Object.keys(game.players).filter(u => u !== game.rulemasterUid);
          const idx = all.indexOf(myUid);
          const next = [...all.slice(idx + 1), ...all.slice(0, idx)]
            .find(u => u !== myUid && remainingPlayers[u]);
          updates.currentTurn = next ?? null;
        }

        // Clear stuck check if I'm involved
        if (game.stuckCheck?.requesterUid === myUid || (isRulemaster && game.stuckCheck)) {
          updates.stuckCheck = null;
        }

        // Guess phase: skip me if it's my turn to guess
        if (game.phase === 'guess' && game.guessPhase) {
          const gp = game.guessPhase;
          if (gp.currentGuesser === myUid) {
            const nextGuessers = gp.order.filter(u => u !== myUid && !gp.results[u] && remainingPlayers[u]);
            if (nextGuessers.length === 0) {
              updates.phase = 'gameOver';
              updates.winnerUid = null;
            } else {
              updates.guessPhase = { ...gp, order: gp.order.filter(u => u !== myUid), currentGuesser: nextGuessers[0] };
            }
          } else {
            updates.guessPhase = { ...gp, order: gp.order.filter(u => u !== myUid) };
          }
        }
      }

      await updateGameState(roomId!, updates);
    } catch {
      // Firebase failed — still leave locally
    }

    dispatch({ type: 'GO_HOME' });
  }

  async function handlePlayAgain() {
    if (!game || !myUid || myUid !== game.hostUid) return;
    const playerNames: Record<string, string> = {};
    Object.entries(game.players).forEach(([uid, p]) => { playerNames[uid] = p.name; });
    const rule = pickRandomRule();
    const opts = game.rulemasterUid === 'system' ? { systemRulemaster: true } : {};
    const newGame = buildInitialGameState(game.hostUid, game.roomCode, playerNames, rule.id, opts);
    try {
      await startGame(roomId!, newGame);
    } catch (e) {
      flash('เกิดข้อผิดพลาด: ' + String(e));
    }
  }

  if (game.phase === 'gameOver') return (
    <GameOverScreen
      game={game}
      myUid={myUid!}
      onHome={() => dispatch({ type: 'GO_HOME' })}
      onPlayAgain={myUid === game.hostUid ? handlePlayAgain : undefined}
    />
  );

  return (
    <Screen style={{ gap: 12, paddingTop: 'max(12px, env(safe-area-inset-top,0px))' }}>
      <style>{ANIM_STYLES}</style>

      {/* Rejection toast */}
      {rejectedCard && (
        <div
          className={toastExiting ? 'rg-toast-exit' : 'rg-toast-enter'}
          style={{
            position: 'fixed',
            top: 'max(60px, env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            pointerEvents: 'none',
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

      <AmbientParticles />

      {/* Pass bg effect: golden ripple ring + sparkles */}
      {showBgPass && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
          {/* Full-screen golden glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(200,168,75,0.1) 0%, transparent 70%)',
            animation: 'rg-bg-pass-glow 0.75s ease-out forwards',
          }} />
          {/* Expanding ring */}
          <div style={{
            position: 'absolute', top: '48%', left: '50%',
            width: 200, height: 200, borderRadius: '50%',
            border: '2px solid rgba(200,168,75,0.6)',
            boxShadow: '0 0 18px rgba(200,168,75,0.35), inset 0 0 18px rgba(200,168,75,0.15)',
            animation: 'rg-bg-pass-ring 0.75s cubic-bezier(0.2,0.8,0.4,1) forwards',
          }} />
          {/* Sparkles */}
          {[0,45,90,135,180,225,270,315].map(deg => (
            <div key={deg} style={{
              position: 'absolute', top: '48%', left: '50%',
              width: 5, height: 5, borderRadius: '50%',
              background: deg % 90 === 0 ? '#f0d87a' : 'rgba(200,168,75,0.7)',
              '--sa': `${deg}deg`,
              animation: `rg-bg-spark ${0.55 + (deg % 90 === 0 ? 0.1 : 0)}s ${deg * 0.001}s cubic-bezier(0.2,0.8,0.4,1) forwards`,
            } as React.CSSProperties} />
          ))}
        </div>
      )}

      {/* Red flash / vignette on fail */}
      {showRedFlash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(140,10,10,0.1) 30%, rgba(180,20,20,0.6) 100%)',
          animation: 'rg-bg-fail-vignette 0.5s ease-out forwards',
        }} />
      )}

      {/* Guess phase entry overlay */}
      {showGuessEntry && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,5,15,0.6)',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            fontFamily: "'Cinzel Decorative', serif",
            fontSize: '2rem', color: '#c8a84b', textAlign: 'center',
            textShadow: '0 0 30px rgba(200,168,75,0.8)',
            animation: 'rg-guess-entry 2.2s ease-out forwards',
          }}>
            ⚔<br />เวลาทาย!
          </div>
        </div>
      )}

      {/* Turn banner */}
      {showTurnBanner && (
        <div style={{
          position: 'fixed', top: 'max(14px, env(safe-area-inset-top,0px))',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, pointerEvents: 'none',
          background: 'rgba(10,14,26,0.92)',
          border: '1.5px solid rgba(200,168,75,0.7)',
          borderRadius: 12, padding: '10px 24px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 24px rgba(200,168,75,0.3)',
          animation: 'rg-turn-banner 2s cubic-bezier(0.34,1.4,0.64,1) forwards',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', color: '#c8a84b', fontWeight: 700, letterSpacing: '0.08em' }}>
            เทิร์นของคุณ!
          </span>
        </div>
      )}

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', color: 'rgba(200,168,75,0.6)', letterSpacing: '0.1em' }}>
          ⚜ เกมทายกฎลับ
        </div>
        <div style={{ fontSize: '0.75rem', color: myTurn ? '#c8a84b' : 'rgba(200,168,75,0.4)' }}>
          {isRulemaster ? '👑 คนคุมกฎ' : isVsSystem ? (myTurn ? '⚡ เทิร์นของคุณ' : '🤖 ระบบคุมกฎ') : myTurn ? '⚡ เทิร์นของคุณ' : 'รอเทิร์น...'}
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

          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', minHeight: 128 }}>
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
                    const cardClass = [
                      isLatest && passFlash && !isFail ? 'rg-pass-glow' : '',
                      isLatest && !passFlash && !isFail ? 'rg-latest-pulse' : '',
                    ].filter(Boolean).join(' ') || undefined;
                    return (
                      <div key={`${entry.cardId}-${idx}`} style={{ position: 'relative', flexShrink: 0 }} className={cardClass}>
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
            const isRM = !isVsSystem && uid === game.rulemasterUid;
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

      {/* Flash message — fixed overlay, no layout shift */}
      {msg && (
        <div style={{
          position: 'fixed',
          top: 'max(64px, env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 22px',
          background: 'linear-gradient(135deg, rgba(28,10,4,0.96) 0%, rgba(40,16,6,0.96) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(210,150,40,0.55)',
          boxShadow: '0 0 10px rgba(210,150,30,0.25), 0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(220,170,60,0.12)',
          backdropFilter: 'blur(12px)',
          animation: 'rg-flash-drop 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards, rg-flash-pulse 1.8s 0.3s ease-in-out infinite',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>🔥</span>
          <span style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#e8c870',
            letterSpacing: '0.06em',
            textShadow: '0 0 10px rgba(210,160,40,0.5)',
          }}>{msg}</span>
        </div>
      )}

      {/* Guess phase */}
      {game.phase === 'guess' && (
        <GuessPhasePanel game={game} myUid={myUid!} onGuess={handleGuess} />
      )}

      {/* Rulemaster: stuck check notification banner */}
      {isRulemaster && game.stuckCheck && (
        <div style={{
          width: '100%', maxWidth: 480,
          padding: '8px 16px',
          borderRadius: 8,
          background: 'rgba(200,100,30,0.15)',
          border: '1px solid rgba(200,120,30,0.5)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.78rem', color: 'rgba(255,180,80,0.9)',
        }}>
          <span style={{ fontSize: '1rem' }}>🔔</span>
          <span><strong>{game.players[game.stuckCheck.requesterUid]?.name ?? '?'}</strong> ขอให้ตรวจมือตัน — ดูด้านล่าง</span>
        </div>
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
      {(!isRulemaster || isSolo || isVsSystem) && game.phase === 'playing' && (
        <Panel style={{ width: '100%', maxWidth: 480, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,168,75,0.5)', fontFamily: "'Cinzel', serif", marginBottom: 10 }}>
            ไพ่ในมือคุณ ({myHand.length} ใบ)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {myHand.map(card => (
              <div
                key={card.id}
                className={[
                  rejectedCard?.id === card.id ? 'rg-shake' : '',
                  playingCard === card.id ? 'rg-card-hand rg-card-playing' : '',
                  playingCard !== card.id && myTurn ? 'rg-card-hand' : '',
                  playingCard !== card.id && myTurn && selected === card.id ? 'rg-card-selected' : '',
                  !myTurn && playingCard !== card.id ? 'rg-card-hand-dimmed' : '',
                ].filter(Boolean).join(' ')}
              >
                <CardComponent
                  card={card}
                  size="lg"
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

          {/* Stuck check pending — waiting for rulemaster */}
          {game.stuckCheck?.requesterUid === myUid ? (
            <div style={{
              marginTop: 14,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(200,168,75,0.07)',
              border: '1.5px solid rgba(200,168,75,0.35)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.1rem', marginBottom: 4 }}>🔍</div>
              <div style={{ fontSize: '0.82rem', color: '#c8a84b', fontWeight: 600, marginBottom: 2 }}>
                ส่งมือให้ตรวจแล้ว
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(200,168,75,0.55)' }}>
                {isVsSystem ? 'ระบบกำลังตรวจสอบ...' : 'รอคนคุมกฎตรวจสอบ — ห้ามวางไพ่ระหว่างนี้'}
              </div>
            </div>
          ) : myTurn ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn
                variant="ghost"
                onClick={requestStuckCheck}
                style={{ flex: 1, fontSize: '0.75rem', padding: '8px 10px' }}
              >
                🔍 ตรวจมือตัน
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
          ) : null}
        </Panel>
      )}

      {confirmLeave ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Btn variant="danger" onClick={handleLeaveGame} style={{ fontSize: '0.75rem' }}>
            ✓ ออกเลย
          </Btn>
          <Btn variant="ghost" onClick={() => setConfirmLeave(false)} style={{ fontSize: '0.75rem' }}>
            ✕ ยกเลิก
          </Btn>
        </div>
      ) : (
        <Btn variant="ghost" onClick={() => setConfirmLeave(true)} style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.55 }}>
          ออกจากเกม
        </Btn>
      )}
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

  return (
    <Panel style={{ width: '100%', maxWidth: 480, border: '1px solid rgba(200,168,75,0.5)', padding: '14px 16px' }}>
      <div style={{ fontFamily: "'Cinzel', serif", color: '#c8a84b', fontSize: '0.8rem', marginBottom: 4, textAlign: 'center' }}>
        🔍 ตรวจมือตัน
      </div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(200,168,75,0.6)', textAlign: 'center', marginBottom: 6 }}>
        <strong style={{ color: 'rgba(232,220,192,0.9)' }}>{requesterName}</strong> ส่งมือให้ตรวจ ({handCards.length} ใบ)
      </div>
      <div style={{ fontSize: '0.68rem', color: 'rgba(200,168,75,0.45)', textAlign: 'center', marginBottom: 12 }}>
        {stuckValidPick ? '✓ เลือกไพ่แล้ว — กด "มีไพ่นี้ลงได้" เพื่อยืนยัน' : 'แตะไพ่ที่ลงได้ หรือกด "ตันจริง"'}
      </div>

      {/* Their hand — always tappable */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
        {handCards.map(card => (
          <div
            key={card.id}
            onClick={() => onPickValid(stuckValidPick === card.id ? null : card.id)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <CardComponent card={card} size="sm" selected={stuckValidPick === card.id} />
          </div>
        ))}
      </div>

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
          disabled={!stuckValidPick}
          onClick={onHasValid}
          style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px' }}
        >
          👆 มีไพ่นี้ลงได้
        </Btn>
      </div>
    </Panel>
  );
}

const EMBER_COLORS = ['rgba(255,160,40,0.55)', 'rgba(255,100,20,0.45)', 'rgba(255,210,80,0.5)'];
const AMBIENT_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: (i * 8.5 + Math.sin(i * 1.3) * 10 + 50) % 100,
  bottom: (i * 8.3) % 100,
  duration: 16 + (i * 2.1) % 10,
  delay: -(i * 2.3) % 20,
  size: 2 + (i % 3),
  drift: `${((i % 2 === 0 ? 1 : -1) * (8 + (i % 12)))}px`,
  color: EMBER_COLORS[i % 3],
}));

function AmbientParticles() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {AMBIENT_PARTICLES.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.left}%`, bottom: `${p.bottom}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          '--drift': p.drift,
          willChange: 'transform',
          animation: `rg-particle-float ${p.duration}s ${p.delay}s linear infinite`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

function Confetti() {
  const particles = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: (i * 2.1 + 1) % 100,
    delay: (i * 0.038) % 1.8,
    duration: 2.2 + (i * 0.037) % 1.8,
    color: ['#c8a84b','#22c55e','#3b82f6','#f59e0b','#ec4899','#a855f7','#ef4444'][i % 7],
    size: 7 + (i % 7),
    borderRadius: i % 2 === 0 ? '50%' : '2px',
    rotate: (i * 7.3) % 360,
  })), []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 150, overflow: 'hidden' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.left}%`, top: -16,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.borderRadius,
          transform: `rotate(${p.rotate}deg)`,
          animation: `rg-confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

function GameOverScreen({ game, myUid, onHome, onPlayAgain }: {
  game: GameState;
  myUid: string;
  onHome: () => void;
  onPlayAgain?: () => void;
}) {
  const winner = game.winnerUid ? game.players[game.winnerUid]?.name : null;
  const rule = game.ruleId ? RULE_MAP[game.ruleId] : null;
  const isWinner = game.winnerUid === myUid;
  const isHost = myUid === game.hostUid;

  return (
    <Screen style={{ justifyContent: 'center' }}>
      {isWinner && <Confetti />}
      <Panel style={{ textAlign: 'center', width: '100%', maxWidth: 400 }}>
        <div className={isWinner ? 'rg-winner-glow' : undefined} style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: '1.6rem', marginBottom: 8, color: '#c8a84b' }}>
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

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onPlayAgain && (
            <Btn variant="primary" fullWidth onClick={onPlayAgain}>
              🔄 เล่นอีกรอบ
            </Btn>
          )}
          {!isHost && (
            <div style={{ fontSize: '0.78rem', color: 'rgba(200,168,75,0.45)', padding: '8px 0' }}>
              รอ host เริ่มรอบใหม่...
            </div>
          )}
          <Btn variant="ghost" fullWidth onClick={onHome}>
            ออกจากห้อง
          </Btn>
        </div>
      </Panel>
    </Screen>
  );
}
