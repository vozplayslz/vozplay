/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Web Audio API Synthesizer (PRD Section 47)
 * Produces low-latency offline soundboard effects without external mp3 downloads.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch (e) {
    return null;
  }
}

export function playDJAudioEffect(soundType: string): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    switch (soundType) {
      case 'applause': {
        // Generates crowd applause via bandpass filtered pink/white noise bursts
        const bufferSize = ctx.sampleRate * 2.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 1.4));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, now);
        filter.Q.setValueAtTime(1.5, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        break;
      }

      case 'airhorn': {
        // Classic Reggae / DJ Air Horn two-tone bursts (F#4 & B4)
        const beeps = [0, 0.14, 0.32, 0.62];
        beeps.forEach((startOffset) => {
          [370, 494].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + startOffset);

            gain.gain.setValueAtTime(0.2, now + startOffset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.11);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + startOffset);
            osc.stop(now + startOffset + 0.12);
          });
        });
        break;
      }

      case 'drums': {
        // Drum roll crescendo followed by punchy floor tom / kick
        for (let i = 0; i < 12; i++) {
          const t = now + i * 0.045;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(120 + i * 5, t);
          gain.gain.setValueAtTime(0.1 + i * 0.02, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.04);
        }
        // Final punch
        const finalT = now + 0.6;
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, finalT);
        kickOsc.frequency.exponentialRampToValueAtTime(45, finalT + 0.4);
        kickGain.gain.setValueAtTime(0.6, finalT);
        kickGain.gain.exponentialRampToValueAtTime(0.01, finalT + 0.4);
        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start(finalT);
        kickOsc.stop(finalT + 0.4);
        break;
      }

      case 'cheer': {
        // Triumphant ascending arpeggio fanfare
        const notes = [329.63, 415.3, 493.88, 659.25, 830.61]; // E major
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.25, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.6);
        });
        break;
      }

      case 'boo': {
        // Comic descending wah-wah / buzzer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.7);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }

      case 'vinheta': {
        // Lush futuristic chime & harmonic chord jingle for VozPlay
        const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major lush chime
        chord.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 1.2);
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}
