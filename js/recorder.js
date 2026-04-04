const STORAGE_KEY = 'green-beam-recordings';

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
    if (this.currentEvents.length > 0) {
      this.recordings.push({
        name: `Recording ${this.recordings.length + 1}`,
        timestamp: new Date(),
        events: this.currentEvents,
      });
      this._save();
    }
    this.currentEvents = [];
  }

  recordEvent(type, midi) {
    if (!this.recording) return;
    this.currentEvents.push({ type, midi, time: performance.now() - this.startTime });
  }

  playRecording(rec, allKeys) {
    this.stopPlayback(allKeys);
    this._playing = true;
    this._timeouts = [];

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

    const duration = rec.events[rec.events.length - 1].time + 100;
    this._timeouts.push(setTimeout(() => {
      this._playing = false;
      allKeys.forEach(k => { if (k.pressed) k.release(); });
    }, duration));
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
