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

      case 'whistle': {
        // Human concert whistle bursts ("Fiiiu-Fiiit!")
        const whistleBursts = [
          { start: 0, duration: 0.3, freqStart: 2100, freqEnd: 2600 },
          { start: 0.38, duration: 0.45, freqStart: 2200, freqEnd: 2900 }
        ];

        whistleBursts.forEach((burst) => {
          const t = now + burst.start;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const vibrato = ctx.createOscillator();
          const vibratoGain = ctx.createGain();

          // Vibrato LFO for human throat fluctuation
          vibrato.frequency.setValueAtTime(7.5, t);
          vibratoGain.gain.setValueAtTime(45, t);
          vibrato.connect(osc.frequency);
          vibrato.start(t);
          vibrato.stop(t + burst.duration);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(burst.freqStart, t);
          osc.frequency.exponentialRampToValueAtTime(burst.freqEnd, t + burst.duration * 0.7);

          gain.gain.setValueAtTime(0.01, t);
          gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + burst.duration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + burst.duration);
        });
        break;
      }

      case 'crowd': {
        // Stadium crowd roar & energetic cheer chant
        const notes = [220, 277.18, 329.63, 440];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.linearRampToValueAtTime(freq * 1.08, now + 1.4);

          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.2 / (idx + 1), now + 0.3);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.8);
        });

        // Background warm roar noise
        const bufferSize = ctx.sampleRate * 1.8;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / bufferSize);
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(1.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseSource.start(now);
        break;
      }

      case 'rimshot': {
        // Classic comedic "Ba-Dum-Tss" punchline
        // "Ba"
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(160, now);
        osc1.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // "Dum"
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const t2 = now + 0.18;
        osc2.frequency.setValueAtTime(130, t2);
        osc2.frequency.exponentialRampToValueAtTime(60, t2 + 0.15);
        gain2.gain.setValueAtTime(0.4, t2);
        gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t2);
        osc2.stop(t2 + 0.15);

        // "Tss" (Cymbal crash)
        const t3 = now + 0.36;
        const cymbalBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate);
        const cymbalData = cymbalBuffer.getChannelData(0);
        for (let i = 0; i < cymbalData.length; i++) {
          cymbalData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
        }
        const cymbal = ctx.createBufferSource();
        cymbal.buffer = cymbalBuffer;
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(6500, t3);

        const cymbalGain = ctx.createGain();
        cymbalGain.gain.setValueAtTime(0.35, t3);
        cymbalGain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.9);

        cymbal.connect(highpass);
        highpass.connect(cymbalGain);
        cymbalGain.connect(ctx.destination);
        cymbal.start(t3);
        break;
      }

      case 'laser': {
        // Retro Sci-Fi DJ Laser Pitch Sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}
