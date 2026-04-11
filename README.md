# Lumitone

Play, record, and share music on a virtual piano — with a space-themed twist.

**[Try it live](https://lumitone.saxymofo.dev/)**

## Features

- **Virtual piano keyboard** with mouse, keyboard, and MIDI controller support
- **72 General MIDI instruments** — pianos, guitars, strings, brass, synths, and more
- **MIDI file playback** with multi-track controls (mute, solo, per-track volume)
- **Recording and sharing** — record performances and share them via link
- **Real-time music visualizer** — mirrored equalizer and waveform oscilloscope modes with color cycling
- **Space theme** — starfield, flying saucers, and light beams that shoot from the keys

## Run locally

```bash
npm install
npm run build
npm start
```

The app runs at `http://localhost:3000`.

## How it works

Lumitone makes heavy use of the Web Audio API for instrument playback, sound synthesis, real-time audio analysis, and hardware MIDI input. See [docs/web-audio.md](docs/web-audio.md) for a deep dive into the audio architecture.
