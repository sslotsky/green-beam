const STORAGE_KEY = 'lumitone-recordings';

export class Recorder {
  constructor() {
    this.recording = false;
    this.startTime = 0;
    this.currentEvents = [];
    this.recordings = this._load();
  }

  _load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map(r => ({ ...r, timestamp: new Date(r.timestamp) }));
    } catch {
      return [];
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.recordings));
  }

  start() {
    this.recording = true;
    this.startTime = performance.now();
    this.currentEvents = [];
  }

  stop() {
    this.recording = false;
    const events = this.currentEvents;
    this.currentEvents = [];
    return events.length > 0 ? events : null;
  }

  save(name, events) {
    this.recordings.push({
      name,
      timestamp: new Date(),
      events,
    });
    this._save();
  }

  delete(rec) {
    const idx = this.recordings.indexOf(rec);
    if (idx >= 0) {
      this.recordings.splice(idx, 1);
      this._save();
    }
  }

  recordEvent(type, midi) {
    if (!this.recording) return;
    this.currentEvents.push({ type, midi, time: performance.now() - this.startTime });
  }

  get progress() {
    if (!this._playing || !this._playbackDuration) return 0;
    const elapsed = performance.now() - this._playbackStart;
    return Math.min(elapsed / this._playbackDuration, 1);
  }

  get playing() {
    return this._playing;
  }

  playRecording(rec, allKeys) {
    this.stopPlayback(allKeys);
    this._playing = true;
    this._timeouts = [];
    this._playbackStart = performance.now();
    this._playbackDuration = rec.events[rec.events.length - 1].time + 100;

    const keysByMidi = {};
    allKeys.forEach(k => { keysByMidi[k.midi] = k; });

    for (const evt of rec.events) {
      const tid = setTimeout(() => {
        const key = keysByMidi[evt.midi];
        if (!key) return;
        if (evt.type === 'on') key.press();
        else key.release();
      }, evt.time);
      this._timeouts.push(tid);
    }

    this._timeouts.push(setTimeout(() => {
      this._playing = false;
      allKeys.forEach(k => { if (k.pressed) k.release(); });
    }, this._playbackDuration));
  }

  stopPlayback(allKeys) {
    if (this._timeouts) {
      this._timeouts.forEach(clearTimeout);
      this._timeouts = [];
    }
    allKeys.forEach(k => { if (k.pressed) k.release(); });
    this._playing = false;
  }
}
