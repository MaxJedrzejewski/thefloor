import { useCallback, useEffect, useRef, useState } from 'react';
import { useDuelSession } from '../hooks/useDuelSession';
import { useVisibilityPause } from '../hooks/useVisibilityPause';
import { useHotkeys } from '../hooks/useHotkeys';
import { ClockPanel } from '../components/ClockPanel';
import { PromptStage } from '../components/PromptStage';
import { JudgeBar } from '../components/JudgeBar';
import { PausedOverlay } from '../components/PausedOverlay';
import { RevealOverlay, type RevealOutcome } from '../components/RevealOverlay';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { playCorrectSound, playPassSound } from '../audio/feedbackSounds';
import { currentPrompt, consumedPromptIds } from '../../engine/duel/selectors';
import type { DuelSetup, DuelSummary } from '../../engine/duel/types';

/** Long enough to register as a beat for the room, short enough not to drag. */
const REVEAL_MS = 2_000;

/** Time to let players get set before either clock starts running. */
const COUNTDOWN_SECONDS = 5;

interface Props {
  setup: DuelSetup;
  seed: number;
  roundLabel: string;
  onFinished: (summary: DuelSummary) => void;
  onAbandon: () => void;
}

function toSummary(state: ReturnType<typeof useDuelSession>['state']): DuelSummary {
  const outcome = state.outcome!;
  return {
    duelId: state.setup.duelId,
    categoryId: state.setup.categoryId,
    categoryName: state.setup.categoryName,
    winnerId: state.setup.players[outcome.winner].playerId,
    loserId: state.setup.players[outcome.loser].playerId,
    finalRemainingMs: outcome.finalRemainingMs,
    players: state.setup.players,
    stats: state.stats,
    usedPromptIds: consumedPromptIds(state),
  };
}

export function DuelScreen({ setup, seed, roundLabel, onFinished, onAbandon }: Props) {
  const duel = useDuelSession(setup, seed);
  const [answerVisible, setAnswerVisible] = useState(true);
  const [reveal, setReveal] = useState<{ outcome: RevealOutcome; answer: string } | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { state, correct, pass, start, pause, resume, undo, canUndo, displayMs } = duel;

  useEffect(() => {
    if (state.phase !== 'ready') return;
    if (countdown <= 0) {
      start();
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1_000);
    return () => clearTimeout(timer);
  }, [state.phase, countdown, start]);

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  useVisibilityPause(state.phase === 'running', pause);

  useEffect(() => {
    if (state.phase === 'finished') onFinished(toSummary(state));
  }, [state, onFinished]);

  const togglePause = useCallback(() => {
    if (state.phase === 'running') pause('host');
    else if (state.phase === 'paused') resume();
  }, [state.phase, pause, resume]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const prompt = currentPrompt(state);

  const judge = useCallback(
    (outcome: RevealOutcome) => {
      if (state.phase !== 'running' || !prompt) return;
      pause('reveal');
      if (outcome === 'correct') playCorrectSound();
      else playPassSound();
      setReveal({ outcome, answer: prompt.answer });
      revealTimer.current = setTimeout(() => {
        resume();
        if (outcome === 'correct') correct();
        else pass();
        setReveal(null);
      }, REVEAL_MS);
    },
    [state.phase, prompt, pause, resume, correct, pass],
  );

  useHotkeys(
    {
      ' ': () => judge('correct'),
      p: () => judge('pass'),
      arrowright: () => judge('pass'),
      z: undo,
      backspace: undo,
      escape: togglePause,
      a: () => setAnswerVisible((v) => !v),
      f: toggleFullscreen,
    },
    state.phase !== 'finished' && !reveal,
  );

  const running = state.phase === 'running';

  return (
    <div className={`duel-screen ${reveal ? `is-reveal-${reveal.outcome}` : ''}`}>
      <header className="duel-header">
        <p className="duel-category">
          <span className="duel-label">Category</span> {setup.categoryName}
        </p>
        <p className="duel-round">{roundLabel}</p>
        <button
          type="button"
          className="button ghost small"
          onClick={togglePause}
          disabled={state.phase === 'ready' || state.phase === 'finished' || !!reveal}
        >
          {state.phase === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="button ghost small" onClick={onAbandon}>
          Abandon duel
        </button>
      </header>

      <main className="duel-body">
        <ClockPanel
          side="left"
          name={setup.players.A.name}
          remainingMs={displayMs.A}
          startingMs={setup.rules.startingMs}
          active={running && state.active === 'A'}
        />

        <div className="prompt-column">
          <PromptStage prompt={prompt} categoryName={setup.categoryName} />
          {state.phase === 'ready' && <CountdownOverlay secondsLeft={countdown} />}
          {reveal && <RevealOverlay outcome={reveal.outcome} answer={reveal.answer} />}
          {!reveal && state.phase === 'paused' && state.pauseReason !== 'reveal' && (
            <PausedOverlay reason={state.pauseReason} onResume={resume} />
          )}
        </div>

        <ClockPanel
          side="right"
          name={setup.players.B.name}
          remainingMs={displayMs.B}
          startingMs={setup.rules.startingMs}
          active={running && state.active === 'B'}
        />
      </main>

      <JudgeBar answer={prompt?.answer ?? null} answerVisible={answerVisible} canUndo={canUndo} />
    </div>
  );
}
