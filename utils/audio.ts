
export const playVictorySound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const playNote = (freq: number, startTime: number, duration: number, volume: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = ctx.currentTime;
  // Fanfarra Heróica: C4, E4, G4, C5
  playNote(261.63, now, 0.4, 0.1);      // C4
  playNote(329.63, now + 0.15, 0.4, 0.1); // E4
  playNote(392.00, now + 0.3, 0.4, 0.1);  // G4
  playNote(523.25, now + 0.45, 0.8, 0.15); // C5
};
