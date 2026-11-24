import type { Rule } from '../types';

export const ALL_RULES: Rule[] = [
  // Easy — sequence rules
  {
    id: 'rule-001',
    nameTH: 'สีต้องเหมือนใบก่อนหน้า',
    difficulty: 'easy',
    type: 'sequence',
    condition: { attribute: 'color', operator: 'equals', reference: 'previous_card' },
  },
  {
    id: 'rule-002',
    nameTH: 'หมวดหมู่ต้องเหมือนใบก่อนหน้า',
    difficulty: 'easy',
    type: 'sequence',
    condition: { attribute: 'category', operator: 'equals', reference: 'previous_card' },
  },
  {
    id: 'rule-003',
    nameTH: 'ตัวเลขต้องมากกว่าหรือเท่ากับใบก่อนหน้า',
    difficulty: 'easy',
    type: 'sequence',
    condition: { attribute: 'number', operator: 'greater_than', reference: 'previous_card' },
  },
  {
    id: 'rule-004',
    nameTH: 'ตัวเลขต้องน้อยกว่าหรือเท่ากับใบก่อนหน้า',
    difficulty: 'easy',
    type: 'sequence',
    condition: { attribute: 'number', operator: 'less_than', reference: 'previous_card' },
  },
  // Easy — absolute rules
  {
    id: 'rule-005',
    nameTH: 'ต้องเป็นสีแดงเท่านั้น',
    difficulty: 'easy',
    type: 'absolute',
    condition: { attribute: 'color', operator: 'equals', reference: 'fixed_value', value: 'red' },
  },
  {
    id: 'rule-006',
    nameTH: 'ต้องเป็นสีน้ำเงินเท่านั้น',
    difficulty: 'easy',
    type: 'absolute',
    condition: { attribute: 'color', operator: 'equals', reference: 'fixed_value', value: 'blue' },
  },
  {
    id: 'rule-007',
    nameTH: 'ต้องเป็นหมวดสัตว์เท่านั้น',
    difficulty: 'easy',
    type: 'absolute',
    condition: { attribute: 'category', operator: 'equals', reference: 'fixed_value', value: 'animal' },
  },
  {
    id: 'rule-008',
    nameTH: 'ต้องเป็นเลขคู่เท่านั้น (2,4,6)',
    difficulty: 'easy',
    type: 'absolute',
    condition: { attribute: 'number', operator: 'equals', reference: 'fixed_value', value: 'even' },
  },
  {
    id: 'rule-009',
    nameTH: 'ต้องเป็นเลขคี่เท่านั้น (1,3,5)',
    difficulty: 'easy',
    type: 'absolute',
    condition: { attribute: 'number', operator: 'equals', reference: 'fixed_value', value: 'odd' },
  },
  // Medium
  {
    id: 'rule-010',
    nameTH: 'สีต้องสลับกันทุกใบ',
    difficulty: 'medium',
    type: 'sequence',
    condition: { attribute: 'color', operator: 'alternates', reference: 'previous_card' },
  },
  {
    id: 'rule-011',
    nameTH: 'ตัวเลขต้องต่างจากใบก่อนหน้า',
    difficulty: 'medium',
    type: 'sequence',
    condition: { attribute: 'number', operator: 'not_equals', reference: 'previous_card' },
  },
  {
    id: 'rule-012',
    nameTH: 'หมวดหมู่ต้องต่างจากใบก่อนหน้า',
    difficulty: 'medium',
    type: 'sequence',
    condition: { attribute: 'category', operator: 'not_equals', reference: 'previous_card' },
  },
  {
    id: 'rule-013',
    nameTH: 'สีต้องต่างจากใบก่อนหน้า',
    difficulty: 'medium',
    type: 'sequence',
    condition: { attribute: 'color', operator: 'not_equals', reference: 'previous_card' },
  },
  {
    id: 'rule-014',
    nameTH: 'ต้องเป็นหมวดอาหารเท่านั้น',
    difficulty: 'medium',
    type: 'absolute',
    condition: { attribute: 'category', operator: 'equals', reference: 'fixed_value', value: 'food' },
  },
  {
    id: 'rule-015',
    nameTH: 'ต้องเป็นหมวดธรรมชาติเท่านั้น',
    difficulty: 'medium',
    type: 'absolute',
    condition: { attribute: 'category', operator: 'equals', reference: 'fixed_value', value: 'nature' },
  },
  // Hard
  {
    id: 'rule-016',
    nameTH: 'ตัวเลขต้องมากกว่าใบก่อนหน้าอย่างน้อย 2',
    difficulty: 'hard',
    type: 'sequence',
    condition: { attribute: 'number', operator: 'greater_than', reference: 'previous_card', value: 2 },
  },
  {
    id: 'rule-017',
    nameTH: 'ต้องเป็นสีเหลืองเท่านั้น',
    difficulty: 'hard',
    type: 'absolute',
    condition: { attribute: 'color', operator: 'equals', reference: 'fixed_value', value: 'yellow' },
  },
  {
    id: 'rule-018',
    nameTH: 'ต้องเป็นสีเขียวเท่านั้น',
    difficulty: 'hard',
    type: 'absolute',
    condition: { attribute: 'color', operator: 'equals', reference: 'fixed_value', value: 'green' },
  },
];

export const RULE_MAP: Record<string, Rule> = Object.fromEntries(
  ALL_RULES.map(r => [r.id, r])
);

export function getRulesByDifficulty(d: Rule['difficulty']) {
  return ALL_RULES.filter(r => r.difficulty === d);
}
