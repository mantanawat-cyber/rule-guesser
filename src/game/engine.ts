import { ALL_CARDS } from '../data/cards';
import { ALL_RULES } from '../data/rules';
import type { Card, Rule, GameState } from '../types';

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(): string[] {
  return shuffleArray(ALL_CARDS.map(c => c.id));
}

export function pickRandomRule(difficulty?: Rule['difficulty']): Rule {
  const pool = difficulty ? ALL_RULES.filter(r => r.difficulty === difficulty) : ALL_RULES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function checkCardValid(card: Card, previousCard: Card | null, rule: Rule): boolean {
  const { condition } = rule;

  if (condition.reference === 'fixed_value') {
    const val = condition.value;
    if (condition.attribute === 'color') {
      if (val === 'red' || val === 'blue' || val === 'green' || val === 'yellow') {
        return card.color === val;
      }
    }
    if (condition.attribute === 'category') {
      if (val === 'animal' || val === 'food' || val === 'nature') {
        return card.category === val;
      }
    }
    if (condition.attribute === 'number') {
      if (val === 'even') return card.number % 2 === 0;
      if (val === 'odd')  return card.number % 2 !== 0;
    }
    return false;
  }

  if (!previousCard) return true;

  if (condition.attribute === 'color') {
    if (condition.operator === 'equals')     return card.color === previousCard.color;
    if (condition.operator === 'not_equals') return card.color !== previousCard.color;
    if (condition.operator === 'alternates') return card.color !== previousCard.color;
  }
  if (condition.attribute === 'category') {
    if (condition.operator === 'equals')     return card.category === previousCard.category;
    if (condition.operator === 'not_equals') return card.category !== previousCard.category;
  }
  if (condition.attribute === 'number') {
    const diff = typeof condition.value === 'number' ? condition.value : 0;
    if (condition.operator === 'greater_than') return card.number >= previousCard.number + diff;
    if (condition.operator === 'less_than')    return card.number <= previousCard.number - diff;
    if (condition.operator === 'equals')       return card.number === previousCard.number;
    if (condition.operator === 'not_equals')   return card.number !== previousCard.number;
  }
  return false;
}

export function getPlayerTurnOrder(state: GameState): string[] {
  return Object.keys(state.players).filter(uid => uid !== state.rulemasterUid);
}

function pickStarterCard(deck: string[], ruleId: string): { starterId: string; remainingDeck: string[] } {
  const rule = ALL_RULES.find(r => r.id === ruleId)!;
  const idx = deck.findIndex(id => {
    const card = ALL_CARDS.find(c => c.id === id)!;
    return checkCardValid(card, null, rule);
  });
  const starterIdx = idx === -1 ? 0 : idx;
  return {
    starterId: deck[starterIdx],
    remainingDeck: deck.filter((_, i) => i !== starterIdx),
  };
}

export function buildInitialGameState(
  hostUid: string,
  roomCode: string,
  playerNames: Record<string, string>,
  ruleId: string,
): GameState {
  const uids = Object.keys(playerNames);
  const rawDeck = createDeck();
  const HAND_SIZE = 5;

  const { starterId, remainingDeck: deck } = pickStarterCard(rawDeck, ruleId);
  const starterLog = [{ cardId: starterId, result: 'pass' as const, uid: 'system' }];

  // Solo mode
  if (uids.length === 1) {
    const uid = uids[0];
    return {
      phase: 'playing',
      ruleId,
      ruleVisibleTo: [uid],
      currentTurn: uid,
      rulemasterUid: null,
      rulemasterOrder: [uid],
      currentRulemasterIndex: 0,
      passedPile: [starterId],
      failedPile: [],
      drawPile: deck.slice(HAND_SIZE),
      discardPile: [],
      players: {
        [uid]: { name: playerNames[uid], hand: deck.slice(0, HAND_SIZE), isRulemaster: false, joinedAt: Date.now() },
      },
      guessPhase: null,
      stuckCheck: null,
      playLog: starterLog,
      round: 1,
      winnerUid: null,
      hostUid,
      roomCode,
    };
  }

  const shuffledUids = shuffleArray(uids);
  const rulemasterUid = shuffledUids[0];

  const players: GameState['players'] = {};
  let deckIdx = 0;

  for (const uid of uids) {
    const hand = uid === rulemasterUid ? [] : deck.slice(deckIdx, deckIdx + HAND_SIZE);
    if (uid !== rulemasterUid) deckIdx += HAND_SIZE;
    players[uid] = {
      name: playerNames[uid],
      hand,
      isRulemaster: uid === rulemasterUid,
      joinedAt: Date.now(),
    };
  }

  const nonRulemasters = shuffledUids.filter(u => u !== rulemasterUid);

  return {
    phase: 'playing',
    ruleId,
    ruleVisibleTo: [rulemasterUid],
    currentTurn: nonRulemasters[0] ?? null,
    rulemasterUid,
    rulemasterOrder: shuffledUids,
    currentRulemasterIndex: 0,
    passedPile: [starterId],
    failedPile: [],
    drawPile: deck.slice(deckIdx),
    discardPile: [],
    players,
    guessPhase: null,
    stuckCheck: null,
    playLog: starterLog,
    round: 1,
    winnerUid: null,
    hostUid,
    roomCode,
  };
}
