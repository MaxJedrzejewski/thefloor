import { useMemo, useState } from 'react';
import { randomSeed, shuffle, mulberry32 } from '../../engine/rng';
import { isPlayable, type CategoryIndex } from '../../content/schema';
import type { TournamentDraft } from '../../tournament/types';

interface Props {
  categories: CategoryIndex;
  onStart: (draft: TournamentDraft) => void;
  onEditCategories: () => void;
}

const STARTER_NAMES = ['Maya', 'Jon', 'Ada', 'Sam', 'Nia', 'Theo'];

export function SetupScreen({ categories, onStart, onEditCategories }: Props) {
  const [names, setNames] = useState<string[]>(STARTER_NAMES.slice(0, 4));
  const playable = useMemo(
    () => Object.values(categories).filter(isPlayable).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  const [enabled, setEnabled] = useState<string[]>(() => playable.map((c) => c.id));

  const filled = names.map((n) => n.trim()).filter(Boolean);
  const duplicateNames = new Set(filled).size !== filled.length;

  const canStart = filled.length >= 2 && enabled.length > 0 && !duplicateNames;

  const setName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

  const toggleCategory = (id: string) =>
    setEnabled((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const start = (seedOrder: 'entered' | 'random') => {
    const seed = randomSeed();
    const ordered = seedOrder === 'random' ? shuffle(filled, mulberry32(seed)) : filled;
    onStart({
      name: 'The Floor',
      seed,
      enabledCategoryIds: enabled,
      players: ordered.map((name, i) => ({ id: `pl_${i + 1}`, name, seed: i + 1 })),
    });
  };

  return (
    <div className="screen setup-screen">
      <header className="screen-header">
        <h1>The Floor</h1>
        <p className="lede">
          Two players, one clock each, 45 seconds apiece. Answer and the clock swaps. Pass and it costs
          you three seconds but stays your turn. Run out and you are gone.
        </p>
      </header>

      <section className="panel">
        <h2>Players</h2>
        <p className="hint">
          Two or more. The order you enter them is the seeding, so the first name gets the easiest
          opening draw — or let the app seed at random.
        </p>

        <ol className="player-list">
          {names.map((name, i) => (
            <li key={i}>
              <span className="seed-badge">{i + 1}</span>
              <input
                type="text"
                value={name}
                placeholder={`Player ${i + 1}`}
                aria-label={`Player ${i + 1} name`}
                onChange={(e) => setName(i, e.target.value)}
              />
              {names.length > 2 && (
                <button
                  type="button"
                  className="button ghost small"
                  aria-label={`Remove player ${i + 1}`}
                  onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>

        <button type="button" className="button" onClick={() => setNames((prev) => [...prev, ''])}>
          Add player
        </button>
        {duplicateNames && <p className="error">Two players share a name — the bracket will be confusing.</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Categories in play</h2>
          <button type="button" className="button ghost small" onClick={onEditCategories}>
            Edit categories
          </button>
        </div>
        <p className="hint">
          Nobody owns a category. One is drawn at random before each duel, preferring topics the
          tournament has not used yet.
        </p>

        {playable.length === 0 ? (
          <p className="error">No category has enough prompts to play. Add some in the editor.</p>
        ) : (
          <ul className="category-choices">
            {playable.map((category) => (
              <li key={category.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={enabled.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  <span>{category.name}</span>
                  <span className="muted">{category.prompts.length} prompts</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="actions">
        <button type="button" className="button primary" disabled={!canStart} onClick={() => start('entered')}>
          Build bracket
        </button>
        <button type="button" className="button" disabled={!canStart} onClick={() => start('random')}>
          Build bracket with random seeding
        </button>
      </div>
    </div>
  );
}
