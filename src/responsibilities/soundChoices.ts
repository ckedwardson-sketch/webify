function playTone(freq: number, duration: number, startAt: number, type: OscillatorType = "sine") {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
  // Let the context close itself once the tone finishes rather than
  // leaking one AudioContext per play — browsers cap how many can be
  // open at once.
  setTimeout(() => ctx.close().catch(() => {}), (startAt + duration + 0.2) * 1000);
}

export interface SoundPreset {
  key: string;
  label: string;
  play: () => void;
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    key: "chime",
    label: "Chime",
    play: () => {
      playTone(660, 0.25, 0);
      playTone(880, 0.35, 0.15);
    },
  },
  {
    key: "beep",
    label: "Beep",
    play: () => playTone(880, 0.18, 0, "square"),
  },
  {
    key: "bell",
    label: "Bell",
    play: () => playTone(523, 0.8, 0, "triangle"),
  },
  {
    key: "urgent",
    label: "Urgent (triple)",
    play: () => {
      playTone(1000, 0.12, 0, "square");
      playTone(1000, 0.12, 0.18, "square");
      playTone(1000, 0.12, 0.36, "square");
    },
  },
  {
    key: "gentle",
    label: "Gentle",
    play: () => playTone(440, 1.1, 0, "sine"),
  },
];

export function playSound(key: string) {
  const preset = SOUND_PRESETS.find((s) => s.key === key) ?? SOUND_PRESETS[0];
  preset.play();
}
