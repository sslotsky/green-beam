import { Midi } from '/js/vendor/tonejs-midi.js';
import { html } from '../html.js';

export class MidiDrop extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <div class="midi-drop-zone">
        <span class="midi-drop-label">Drop MIDI file here</span>
      </div>
      <div class="midi-tracks" style="display:none">
        <div class="midi-track-list"></div>
        <button class="midi-play-btn">Play</button>
        <button class="midi-stop-btn" style="display:none">Stop</button>
      </div>
    `;

    this.dropZone = this.querySelector('.midi-drop-zone');
    this.tracksContainer = this.querySelector('.midi-tracks');
    this.trackList = this.querySelector('.midi-track-list');
    this.playBtn = this.querySelector('.midi-play-btn');
    this.stopBtn = this.querySelector('.midi-stop-btn');
    this._midi = null;
    this._selectedTrack = 0;
    this._timeouts = [];
    this._activeNotes = [];
    this._playing = false;

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
        this._loadFile(file);
      }
    });

    this.playBtn.addEventListener('click', () => this._play());
    this.stopBtn.addEventListener('click', () => this._stop());
  }

  async _loadFile(file) {
    const buffer = await file.arrayBuffer();
    this._midi = new Midi(buffer);
    this._trackInstruments = {};
    this._renderTracks();
    await this._loadInstruments();
  }

  async _loadInstruments() {
    const audioCtx = this.app.audio.context;
    const seen = {};

    for (const [i, track] of this._midi.tracks.entries()) {
      if (track.notes.length === 0) continue;
      const name = this._instrumentName(track);
      if (!seen[name]) {
        seen[name] = Soundfont.instrument(audioCtx, name);
      }
    }

    const loaded = {};
    for (const [name, promise] of Object.entries(seen)) {
      try {
        loaded[name] = await promise;
      } catch {
        console.warn(`Failed to load instrument: ${name}, falling back to piano`);
        if (!loaded['acoustic_grand_piano']) {
          loaded['acoustic_grand_piano'] = await Soundfont.instrument(audioCtx, 'acoustic_grand_piano');
        }
        loaded[name] = loaded['acoustic_grand_piano'];
      }
    }

    for (const [i, track] of this._midi.tracks.entries()) {
      if (track.notes.length === 0) continue;
      this._trackInstruments[i] = loaded[this._instrumentName(track)];
    }
  }

  _instrumentName(track) {
    const name = track.instrument?.name;
    if (!name) return 'acoustic_grand_piano';
    const snaked = name.toLowerCase().replace(/\s+/g, '_');

    // Fix mismatches between GM names and soundfont-player names
    const fixes = {
      'electric_bass_(finger)': 'electric_bass_finger',
      'electric_bass_(pick)': 'electric_bass_pick',
      'synthbrass_1': 'synth_brass_1',
      'synthbrass_2': 'synth_brass_2',
      'synthstrings_1': 'synth_strings_1',
      'synthstrings_2': 'synth_strings_2',
      'standard_kit': 'synth_drum',
      'orchestra_kit': 'synth_drum',
    };
    return fixes[snaked] || snaked;
  }

  _renderTracks() {
    this.trackList.innerHTML = '';

    // Default to track with most notes
    let maxNotes = 0;
    this._selectedTrack = -1;
    this._midi.tracks.forEach((track, i) => {
      if (track.notes.length > maxNotes) {
        maxNotes = track.notes.length;
        this._selectedTrack = i;
      }
    });

    const tracks = this._midi.tracks
      .map((track, i) => ({ track, i }))
      .filter(({ track }) => track.notes.length > 0)
      .sort((a, b) => b.track.notes.length - a.track.notes.length);

    this._trackElements = {};
    for (const { track, i } of tracks) {
      const instrName = track.instrument?.name || track.name || `Track ${i + 1}`;
      const div = document.createElement('div');
      div.className = 'midi-track' + (i === this._selectedTrack ? ' selected' : '');
      div.innerHTML = html`<span title="${instrName}">${instrName}</span><span style="color:#888">${track.notes.length}</span>`;
      div.addEventListener('click', () => {
        this.trackList.querySelectorAll('.midi-track').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        this._selectedTrack = i;
        this._loadSelectedInstrument();
        const keyboard = this.app.querySelector('piano-keyboard');
        if (keyboard) keyboard.allKeys.forEach(k => { if (k.pressed) k.release(); });
      });
      this._trackElements[i] = div;
      this.trackList.appendChild(div);
    }

    this.dropZone.style.display = 'none';
    this.tracksContainer.style.display = 'flex';
  }

  _loadSelectedInstrument() {
    const track = this._midi.tracks[this._selectedTrack];
    if (track) {
      this.app.audio.load(this._instrumentName(track));
    }
  }

  _playTrackNote(trackIndex, midi) {
    const instr = this._trackInstruments[trackIndex];
    if (!instr) return;
    this.app.audio.context.resume();
    const active = instr.play(midi);
    if (active) this._activeNotes.push({ note: active, midi });
  }

  _play() {
    this._stop();
    this._playing = true;
    this._trackActivity = {};
    this.playBtn.style.display = 'none';
    this.stopBtn.style.display = 'flex';

    // Load selected track's instrument into the main audio for piano keys
    this._loadSelectedInstrument();

    const keyboard = this.app.querySelector('piano-keyboard');
    const keysByMidi = {};
    keyboard.allKeys.forEach(k => { keysByMidi[k.midi] = k; });

    this._midi.tracks.forEach((track, i) => {
      this._trackActivity[i] = 0;
      for (const note of track.notes) {
        const startMs = note.time * 1000;
        const endMs = (note.time + note.duration) * 1000;

        // Note on
        const onId = setTimeout(() => {
          this._trackActivity[i]++;
          const selected = i === this._selectedTrack;
          if (selected) {
            const key = keysByMidi[note.midi];
            if (key) {
              key.press();
            } else {
              this._playTrackNote(i, note.midi);
            }
          } else {
            this._playTrackNote(i, note.midi);
          }
        }, startMs);
        this._timeouts.push(onId);

        // Note off
        const offId = setTimeout(() => {
          this._trackActivity[i]--;
          const selected = i === this._selectedTrack;
          if (selected) {
            const key = keysByMidi[note.midi];
            if (key) key.release();
          }
          for (let j = this._activeNotes.length - 1; j >= 0; j--) {
            if (this._activeNotes[j].midi === note.midi) {
              try { this._activeNotes[j].note.stop(); } catch {}
              this._activeNotes.splice(j, 1);
              break;
            }
          }
        }, endMs);
        this._timeouts.push(offId);
      }
    });

    // Update track activity indicators
    this._activityInterval = setInterval(() => {
      for (const [i, el] of Object.entries(this._trackElements)) {
        el.classList.toggle('active', (this._trackActivity[i] || 0) > 0);
      }
    }, 100);

    // Auto-stop at end
    const duration = this._midi.duration * 1000 + 200;
    this._timeouts.push(setTimeout(() => this._stop(), duration));
  }

  _stop() {
    if (this._activityInterval) {
      clearInterval(this._activityInterval);
      this._activityInterval = null;
    }
    this._timeouts.forEach(clearTimeout);
    this._timeouts = [];
    this._activeNotes.forEach(n => { try { n.note.stop(); } catch {} });
    this._activeNotes = [];
    this._trackActivity = {};
    if (this._trackElements) {
      for (const el of Object.values(this._trackElements)) el.classList.remove('active');
    }
    this._playing = false;
    this.playBtn.style.display = 'flex';
    this.stopBtn.style.display = 'none';

    // Release any pressed keys
    const keyboard = this.app.querySelector('piano-keyboard');
    if (keyboard) keyboard.allKeys.forEach(k => { if (k.pressed) k.release(); });
  }
}

customElements.define('midi-drop', MidiDrop);
