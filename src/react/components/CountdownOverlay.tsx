interface Props {
  secondsLeft: number;
}

/** Gives players a beat to get set before either clock starts running. */
export function CountdownOverlay({ secondsLeft }: Props) {
  return (
    <div className="countdown-overlay" data-testid="countdown-overlay" aria-live="assertive">
      <p className="countdown-label">Get ready</p>
      <p className="countdown-number">{secondsLeft}</p>
    </div>
  );
}
