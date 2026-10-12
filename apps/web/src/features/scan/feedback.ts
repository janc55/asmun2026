import type { ScanColor } from './types';

/**
 * Retroalimentación sensorial del escaneo (TASK-3.6): pitido sintetizado con
 * Web Audio API y vibración del móvil, diferenciados por resultado.
 *
 * El navegador exige un gesto del usuario antes de reproducir audio, por eso
 * `unlockAudio()` se llama al abrir el escáner.
 */

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioContext) {
    const Constructor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Constructor) return null;
    audioContext = new Constructor();
  }

  return audioContext;
}

/** Habilita el audio dentro de un gesto del usuario (obligatorio en iOS). */
export function unlockAudio(): void {
  const context = getContext();
  if (context && context.state === 'suspended') {
    void context.resume();
  }
}

export function playTone(frequency: number, durationMs: number, type: OscillatorType = 'sine', volume = 0.18): void {
  const context = getContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = durationMs / 1000;

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Algunos navegadores bloquean la vibración sin gesto previo: no es crítico.
  }
}

/** Pitido y vibración según el semáforo del resultado. */
export function feedbackForResult(color: ScanColor): void {
  if (color === 'verde') {
    playTone(880, 110);
    window.setTimeout(() => playTone(1320, 140), 105);
    vibrate(60);
    return;
  }

  if (color === 'amarillo') {
    playTone(660, 240, 'triangle');
    vibrate([90, 60, 90]);
    return;
  }

  playTone(200, 420, 'square', 0.14);
  vibrate([140, 70, 140, 70, 220]);
}
