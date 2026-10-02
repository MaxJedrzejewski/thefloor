import { mulberry32, shuffle, type Rng } from './rng';
import type { Category, CategoryIndex } from '../content/schema';
import { isPlayable } from '../content/schema';
import type { DuelPlayer, DuelSetup, PlayerSlot, Prompt } from './duel/types';
import { DEFAULT_RULES } from './duel/rules';

export interface DuelDraw {
  category: Category;
  firstToAnswer: PlayerSlot;
  queue: string[];
  prompts: Record<string, Prompt>;
}

/**
 * Categories the host may pick for the next duel: enabled and playable, minus
 * those the tournament has already used. Once every one has been used the
 * whole pool opens up again.
 */
export function availableCategories(
  enabledIds: readonly string[],
  categories: CategoryIndex,
  usedCategoryIds: readonly string[],
): Category[] {
  const pool = enabledIds
    .map((id) => categories[id])
    .filter((c): c is Category => !!c && isPlayable(c));
  const used = new Set(usedCategoryIds);
  const fresh = pool.filter((c) => !used.has(c.id));
  return fresh.length > 0 ? fresh : pool;
}

/**
 * Set up a duel on the category the host picked. The clue order and who
 * answers first are still random.
 */
export function drawDuel(
  categoryId: string,
  enabledIds: readonly string[],
  categories: CategoryIndex,
  usedCategoryIds: readonly string[],
  usedPromptIds: readonly string[],
  rng: Rng,
): DuelDraw | null {
  const category = availableCategories(enabledIds, categories, usedCategoryIds).find(
    (c) => c.id === categoryId,
  );
  if (!category) return null;

  const spent = new Set(usedPromptIds);
  const unseen = category.prompts.filter((p) => !spent.has(p.id));
  // Fall back to the full set rather than running a duel on three clues.
  const usable = unseen.length >= 12 ? unseen : category.prompts;

  return {
    category,
    firstToAnswer: rng() < 0.5 ? 'A' : 'B',
    queue: shuffle(usable, rng).map((p) => p.id),
    prompts: Object.fromEntries(category.prompts.map((p) => [p.id, p])),
  };
}

/** Prompt ids to append when a duel exhausts its queue mid-play. */
export function refillQueue(prompts: Record<string, Prompt>, avoidId: string | null, rng: Rng): string[] {
  const all = Object.values(prompts);
  if (all.length === 0) return [];
  const reshuffled = shuffle(all, rng).map((p) => p.id);

  // Never show the same clue twice in a row across the seam.
  if (reshuffled.length > 1 && reshuffled[0] === avoidId) {
    [reshuffled[0], reshuffled[1]] = [reshuffled[1]!, reshuffled[0]!];
  }
  return reshuffled;
}

export function buildDuelSetup(args: {
  duelId: string;
  matchId: string;
  draw: DuelDraw;
  players: Record<PlayerSlot, DuelPlayer>;
}): DuelSetup {
  return {
    duelId: args.duelId,
    matchId: args.matchId,
    rules: DEFAULT_RULES,
    categoryId: args.draw.category.id,
    categoryName: args.draw.category.name,
    players: args.players,
    firstToAnswer: args.draw.firstToAnswer,
    queue: args.draw.queue,
    prompts: args.draw.prompts,
  };
}

export function rngForDuel(seed: number, duelNumber: number): Rng {
  return mulberry32((seed + duelNumber * 0x9e3779b1) >>> 0);
}
