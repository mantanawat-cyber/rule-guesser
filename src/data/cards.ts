import type { Card, CardColor, CardCategory } from '../types';

const COLOR_META: Record<CardColor, { th: string; hex: string }> = {
  red:    { th: 'แดง',   hex: '#ef4444' },
  blue:   { th: 'น้ำเงิน', hex: '#3b82f6' },
  green:  { th: 'เขียว',  hex: '#22c55e' },
  yellow: { th: 'เหลือง', hex: '#eab308' },
};

const CATEGORY_META: Record<CardCategory, { th: string; emoji: string }> = {
  animal: { th: 'สัตว์',   emoji: '🐱' },
  food:   { th: 'อาหาร',  emoji: '🍎' },
  nature: { th: 'ธรรมชาติ', emoji: '🌿' },
};

const COLORS: CardColor[]    = ['red', 'blue', 'green', 'yellow'];
const CATEGORIES: CardCategory[] = ['animal', 'food', 'nature'];
const NUMBERS = [1, 2, 3, 4, 5, 6];

export const ALL_CARDS: Card[] = [];

let idx = 1;
for (const num of NUMBERS) {
  for (const color of COLORS) {
    for (const category of CATEGORIES) {
      ALL_CARDS.push({
        id: `card-${String(idx).padStart(3, '0')}`,
        number: num,
        color,
        colorTH:      COLOR_META[color].th,
        colorHex:     COLOR_META[color].hex,
        category,
        categoryTH:   CATEGORY_META[category].th,
        categoryEmoji: CATEGORY_META[category].emoji,
      });
      idx++;
    }
  }
}

export const CARD_MAP: Record<string, Card> = Object.fromEntries(
  ALL_CARDS.map(c => [c.id, c])
);
