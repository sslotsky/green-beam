# Web Audio API in Lumitone

Lumitone uses the Web Audio API extensively — for instrument playback, sound synthesis, real-time audio analysis, and hardware MIDI input. This document walks through how each part of the audio system works.

## Audio Graph

All audio flows through a single `AudioContext` and a shared `AnalyserNode` before reaching the speakers:

```
Soundfont instruments ──┐
                        ├──> AnalyserNode ──> AudioContext.destination (speakers)
Spaceship explosions ───┘         │
                                  │
                          Music Visualizer
                        (reads frequency & waveform data)
```

The `Audio` class (`src/js/audio.js`) owns the context and analyser. Every component in the app accesses them through `this.app.audio`.

## Instrument Playback

Lumitone uses [soundfont-player](https://github.com/danigb/soundfont-player) to load General MIDI instrument samples on demand. There are 72 available instruments, from acoustic pianos to steel drums.

When an instrument is loaded, it's wired to the analyser node so the visualizer can react to it:

```javascript
Soundfont.instrument(this.context, name, { destination: this.analyser })
```

Notes are triggered with a MIDI number and optional gain:

```javascript
this.instrument.play(midi, 0, { gain })
```

The MIDI player (`src/js/components/midi-player.js`) loads a separate Soundfont instrument per track, all routed through the same analyser. Per-track volume is controlled by passing a `gain` value when playing each note.

## Sound Synthesis: Spaceship Explosions

When a beam hits a spaceship (`src/js/components/spaceship.js`), Lumitone synthesizes an explosion sound from scratch using two layered audio sources:

### Noise burst (impact texture)

A buffer filled with random samples, filtered through a lowpass sweep:

```
BufferSource (white noise, 0.3s)
  → BiquadFilter (lowpass, 1000 Hz → 100 Hz)
    → GainNode (0.4 → 0.001)
      → destination
```

The lowpass filter sweeps from 1000 Hz down to 100 Hz over 0.3 seconds, giving the noise a "thud" quality as the high frequencies fade first.

### Sub-bass thump

A sine oscillator that drops in pitch:

```
OscillatorNode (sine, 80 Hz → 20 Hz, 0.2s)
  → GainNode (0.5 → 0.001)
    → destination
```

Together these create a short, punchy explosion — the noise provides the initial crack and the oscillator adds a low-frequency rumble.

Both use `exponentialRampToValueAtTime` for natural-sounding decay envelopes.

## Real-Time Analysis: Music Visualizer

The `AnalyserNode` provides two views of the audio signal that power the visualizer (`src/js/components/music-visualizer.js`):

### Frequency data (equalizer mode)

```javascript
analyser.getByteFrequencyData(dataArray) // 128 bins, 0-255 each
```

The 128 frequency bins (from `fftSize = 256`) are grouped into 64 bars. Each bar averages a range of bins, and the height maps linearly from the 0-255 value. The lower 75% of bins are used — the upper bins represent ultrasonic frequencies that are mostly silent.

The `smoothingTimeConstant` of 0.8 means each frame blends 80% of the previous data with 20% new data, preventing jitter.

### Time-domain data (waveform mode)

```javascript
analyser.getByteTimeDomainData(waveformData) // 256 samples, centered at 128
```

This is the raw waveform — 256 samples where 128 is silence, values above/below represent positive/negative amplitude. The visualizer draws this as a continuous line across the piano width, with thickness and glow intensity scaled by the current energy level.

### Color cycling

Both modes use a time-based hue rotation (`performance.now() / 50 % 360`) so the colors gradually shift through the spectrum, independent of the audio content.

## Web MIDI API

Lumitone supports hardware MIDI controllers (`src/js/midi.js`) through the Web MIDI API:

```javascript
navigator.requestMIDIAccess()
```

When a MIDI device is connected, incoming messages are parsed by status byte:
- `0x90` (Note On) — triggers key press with the note's MIDI number
- `0x80` (Note Off) — releases the key

This means you can plug in a MIDI keyboard and play Lumitone directly, with beams, sound, and visualizer all responding to hardware input.

## AudioContext Resume

Browsers require a user gesture before allowing audio playback. Lumitone calls `context.resume()` at three points:
- When playing a note via the on-screen keyboard
- When starting MIDI file playback
- When a spaceship explosion is triggered

This ensures audio works regardless of which interaction happens first.
