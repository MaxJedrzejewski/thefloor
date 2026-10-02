import { DEFAULT_RULES } from '../rules';
import type { DuelSetup, Prompt } from '../types';

export const T0 = 1_000;

export function makePrompts(count: number): Prompt[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    kind: 'text' as const,
    body: `Question ${i + 1}?`,
    answer: `Answer ${i + 1}`,
  }));
}

export function makeSetup(overrides: Partial<DuelSetup> = {}): DuelSetup {
  const prompts = makePrompts(10);
  return {
    duelId: 'duel-1',
    matchId: 'm1',
    rules: DEFAULT_RULES,
    categoryId: 'cat-1',
    categoryName: 'World Capitals',
    players: {
      A: { playerId: 'pa', name: 'Maya' },
      B: { playerId: 'pb', name: 'Jon' },
    },
    firstToAnswer: 'A',
    queue: prompts.map((p) => p.id),
    prompts: Object.fromEntries(prompts.map((p) => [p.id, p])),
    ...overrides,
  };
}
