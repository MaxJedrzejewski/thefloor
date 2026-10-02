interface Props {
  answer: string | null;
  answerVisible: boolean;
  canUndo: boolean;
}

const KEYS = [
  ['SPACE', 'correct'],
  ['P', 'pass −3s'],
  ['Z', 'undo'],
  ['ESC', 'pause'],
  ['A', 'hide answer'],
  ['F', 'fullscreen'],
] as const;

/**
 * The judge's strip: low contrast, small, pinned to the bottom edge. Close enough
 * for whoever is adjudicating to read, unobtrusive from the players' seats.
 */
export function JudgeBar({ answer, answerVisible, canUndo }: Props) {
  return (
    <footer className="judge-bar">
      <p className="judge-answer" data-testid="judge-answer">
        {answerVisible ? (
          <>
            <span className="judge-label">ANSWER</span> {answer ?? '—'}
          </>
        ) : (
          <span className="judge-label">ANSWER HIDDEN · PRESS A</span>
        )}
      </p>
      <p className="judge-keys">
        {KEYS.map(([key, action]) => (
          <span key={key} className={`judge-key ${key === 'Z' && !canUndo ? 'is-disabled' : ''}`}>
            <kbd>{key}</kbd> {action}
          </span>
        ))}
      </p>
    </footer>
  );
}
