/** Judge-feedback tones, synthesized so there is no audio asset to ship or license. */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  audio: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** A bright ascending chime for a correct answer. */
export function playCorrectSound(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, 880, now, 0.16, 'sine', 0.22);
  tone(audio, 1318.5, now + 0.09, 0.22, 'sine', 0.22);
}

/** A harsh low buzz for a pass. */
export function playPassSound(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, 150, now, 0.35, 'sawtooth', 0.18);
}
