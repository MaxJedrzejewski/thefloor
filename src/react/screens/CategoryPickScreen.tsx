import { useHotkeys } from '../hooks/useHotkeys';
import type { Category } from '../../content/schema';

interface Props {
  roundLabel: string;
  playerNames: [string, string];
  categories: Category[];
  onPick: (categoryId: string) => void;
  onBack: () => void;
}

export function CategoryPickScreen({ roundLabel, playerNames, categories, onPick, onBack }: Props) {
  useHotkeys({ escape: onBack });

  return (
    <div className="screen pick-screen">
      <p className="muted">{roundLabel}</p>
      <h1 className="intro-versus">
        {playerNames[0]} <span className="versus">vs</span> {playerNames[1]}
      </h1>
      <p className="muted">Pick the category for this match.</p>

      <ul className="category-grid">
        {categories.map((c) => (
          <li key={c.id}>
            <button type="button" className="button large" onClick={() => onPick(c.id)}>
              {c.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button type="button" className="button ghost" onClick={onBack}>
          Back to bracket
        </button>
      </div>
    </div>
  );
}
