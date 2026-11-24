export type CardColor = 'red' | 'blue' | 'green' | 'yellow';
export type CardCategory = 'animal' | 'food' | 'nature';

export interface Card {
  id: string;
  number: number;
  color: CardColor;
  colorTH: string;
  colorHex: string;
  category: CardCategory;
  categoryTH: string;
  categoryEmoji: string;
}

export type RuleDifficulty = 'easy' | 'medium' | 'hard';
export type RuleType = 'sequence' | 'absolute';
export type RuleAttribute = 'color' | 'number' | 'category';
export type RuleOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'alternates';
export type RuleReference = 'previous_card' | 'fixed_value';

export interface RuleCondition {
  attribute: RuleAttribute;
  operator: RuleOperator;
  reference: RuleReference;
  value?: string | number;
}

export interface Rule {
  id: string;
  nameTH: string;
  difficulty: RuleDifficulty;
  type: RuleType;
  condition: RuleCondition;
}

export interface Player {
  name: string;
  hand: string[];
  isRulemaster: boolean;
  joinedAt: number;
}

export type GamePhase = 'lobby' | 'playing' | 'guess' | 'roundEnd' | 'gameOver';

export interface PlayLogEntry {
  cardId: string;
  result: 'pass' | 'fail';
  uid: string;
}

export interface StuckCheck {
  requesterUid: string;
  handSnapshot: string[];
}

export interface GuessPhase {
  triggeredBy: string;
  order: string[];
  currentGuesser: string;
  results: Record<string, { ruleId: string; correct: boolean }>;
}

export interface GameState {
  phase: GamePhase;
  ruleId: string | null;
  ruleVisibleTo: string[];
  currentTurn: string | null;
  rulemasterUid: string | null;
  rulemasterOrder: string[];
  currentRulemasterIndex: number;
  passedPile: string[];
  failedPile: string[];
  drawPile: string[];
  discardPile: string[];
  players: Record<string, Player>;
  guessPhase: GuessPhase | null;
  stuckCheck: StuckCheck | null;
  playLog: PlayLogEntry[];
  round: number;
  winnerUid: string | null;
  hostUid: string;
  roomCode: string;
}

export interface LocalState {
  roomId: string | null;
  myUid: string | null;
  myName: string;
  phase: 'home' | 'lobby' | 'game';
}
