import { Midi } from '/js/vendor/tonejs-midi.js';
import { html } from '../html.js';

export class MidiPlayer extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this._midi = null;
    this._selectedTrack = 0;
    this._timeouts = [];
    this._activeNotes = [];
    this._playing = false;
    this._trackInstruments = {};
    this._trackElements = {};
    this._mutedTracks = new Set();
    this._soloedTracks = new Set();
    this._trackVolumes = {};

    this.innerHTML = html`
      <div class="midi-tracks" style="display:none">
        <div class="midi-song-name"></div>
        <div class="midi-track-list"></div>
        <div class="midi-progress"><div class="midi-progress-fill"></div></div>
        <div class="midi-controls">
          <button class="midi-play-btn">Play</button>
          <button class="midi-pause-btn" style="display:none">Pause</button>
          <button class="midi-stop-btn" style="display:none">Stop</button>
        </div>
        <div class="midi-fallback-warning" style="display:none"></div>
      </div>
    `;

    this.tracksContainer = this.querySelector('.midi-tracks');
    this.songName = this.querySelector('.midi-song-name');
    this.trackList = this.querySelector('.midi-track-list');
    this.playBtn = this.querySelector('.midi-play-btn');
    this.pauseBtn = this.querySelector('.midi-pause-btn');
    this.stopBtn = this.querySelector('.midi-stop-btn');
    this.progressBar = this.querySelector('.midi-progress');
    this.progressFill = this.querySelector('.midi-progress-fill');
    this.warning = this.querySelector('.midi-fallback-warning');

    // Progress bar seek
    const pctFromEvent = (e) => {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const rect = this.progressBar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const startDrag = (e) => {
      if (!this._midi) return;
      this._wasDraggingWhilePlaying = this._playing;
      if (this._playing) this._pause();
      const pct = pctFromEvent(e);
      this._pausedAt = pct * this._midi.duration * 1000;
      this.progressFill.style.width = `${pct * 100}%`;
    };

    const moveDrag = (e) => {
      if (!this._midi) return;
      const pct = pctFromEvent(e);
      this._pausedAt = pct * this._midi.duration * 1000;
      this.progressFill.style.width = `${pct * 100}%`;
    };

    const endDrag = () => {
      if (this._wasDraggingWhilePlaying) {
        this._resume();
      }
      this._wasDraggingWhilePlaying = false;
    };

    this.progressBar.addEventListener('mousedown', (e) => {
      startDrag(e);
      const onMove = (e) => moveDrag(e);
      const onUp = () => {
        endDrag();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    this.progressBar.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrag(e);
    }, { passive: false });

    this.progressBar.addEventListener('touchmove', (e) => {
      e.preventDefault();
      moveDrag(e);
    }, { passive: false });

    this.progressBar.addEventListener('touchend', () => endDrag());

    this.playBtn.addEventListener('click', () => {
      if (this._pausedAt) this._resume();
      else this._play();
    });
    this.pauseBtn.addEventListener('click', () => this._pause());
    this.stopBtn.addEventListener('click', () => this._stop());

    this._onVisibilityChange = () => {
      if (!this._playing && !this._pausedAt) return;
      if (document.hidden) this._pause();
      else this._resume();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  async loadSong(song) {
    this._stop();
    this.songName.textContent = song.name;
    this.tracksContainer.style.display = 'flex';
    this.trackList.innerHTML = '<div class="midi-track" style="color:#888">Loading...</div>';

    try {
      const res = await fetch(`/midi/${song.file}`);
      const buffer = await res.arrayBuffer();
      await this._loadBuffer(buffer);
    } catch {
      this.trackList.innerHTML = '<div class="midi-track" style="color:#888">Failed to load</div>';
    }
  }

  async loadFile(name, buffer) {
    this._stop();
    this.songName.textContent = name;
    this.tracksContainer.style.display = 'flex';
    this.trackList.innerHTML = '<div class="midi-track" style="color:#888">Loading...</div>';
    await this._loadBuffer(buffer);
  }

  async _loadBuffer(buffer) {
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
    const snaked = name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');

    const fixes = {
      'synthbrass_1': 'synth_brass_1',
      'synthbrass_2': 'synth_brass_2',
      'synthstrings_1': 'synth_strings_1',
      'synthstrings_2': 'synth_strings_2',
      'standard_kit': 'synth_drum',
      'orchestra_kit': 'synth_drum',
      'jazz_kit': 'synth_drum',
    };
    return fixes[snaked] || snaked;
  }

  _renderTracks() {
    this.trackList.innerHTML = '';

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
    this._trackOrder = tracks.map(t => t.i);
    this._mutedTracks.clear();
    this._soloedTracks.clear();
    for (const { track, i } of tracks) {
      const instrName = track.instrument?.name || track.name || `Track ${i + 1}`;
      const div = document.createElement('div');
      div.className = 'midi-track' + (i === this._selectedTrack ? ' selected' : '');
      div.tabIndex = 0;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-name';
      nameSpan.title = instrName;
      nameSpan.textContent = instrName;

      const btns = document.createElement('span');
      btns.className = 'track-btns';

      const muteBtn = document.createElement('button');
      muteBtn.textContent = 'M';
      muteBtn.title = 'Mute';
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._mutedTracks.has(i)) {
          this._mutedTracks.delete(i);
          muteBtn.classList.remove('muted');
        } else {
          this._mutedTracks.add(i);
          muteBtn.classList.add('muted');
        }
      });

      const soloBtn = document.createElement('button');
      soloBtn.textContent = 'S';
      soloBtn.title = 'Solo';
      soloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._soloedTracks.has(i)) {
          this._soloedTracks.delete(i);
          soloBtn.classList.remove('soloed');
        } else {
          this._soloedTracks.add(i);
          soloBtn.classList.add('soloed');
        }
      });

      const volBtn = document.createElement('button');
      volBtn.textContent = 'V';
      volBtn.title = `Volume: 100%`;
      this._trackVolumes[i] = 1;
      volBtn.addEventListener('click', (e) => e.stopPropagation());
      volBtn.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? 0.1 : -0.1;
        this._trackVolumes[i] = Math.max(0, Math.min(2, (this._trackVolumes[i] ?? 1) + delta));
        const pct = Math.round(this._trackVolumes[i] * 100);
        volBtn.title = `Volume: ${pct}%`;
        volBtn.classList.toggle('vol-adjusted', this._trackVolumes[i] !== 1);
      }, { passive: false });

      btns.appendChild(muteBtn);
      btns.appendChild(soloBtn);
      btns.appendChild(volBtn);
      div.appendChild(nameSpan);
      div.appendChild(btns);

      div.addEventListener('click', () => this._selectTrack(i, div));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._selectTrack(i, div);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = this._trackOrder.indexOf(i);
          const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
          if (next >= 0 && next < this._trackOrder.length) {
            const nextEl = this._trackElements[this._trackOrder[next]];
            nextEl.focus();
          }
        }
      });
      this._trackElements[i] = div;
      this.trackList.appendChild(div);
    }

    this._loadSelectedInstrument();
  }

  _selectTrack(i, div) {
    this.trackList.querySelectorAll('.midi-track').forEach(el => el.classList.remove('selected'));
    div.classList.add('selected');
    this._selectedTrack = i;
    this._loadSelectedInstrument();
    const keyboard = this.app.querySelector('piano-keyboard');
    if (keyboard) keyboard.allKeys.forEach(k => { if (k.pressed) k.release(); });
  }

  _loadSelectedInstrument() {
    const track = this._midi.tracks[this._selectedTrack];
    if (track) {
      const name = this._instrumentName(track);
      const select = this.app.querySelector('instrument-selector select');
      this.warning.style.display = 'none';
      this.app.audio.load(name).then(() => {
        if (select) {
          if (!select.querySelector(`option[value="${name}"]`)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = track.instrument?.name || track.name || name.replace(/_/g, ' ');
            select.appendChild(opt);
          }
          select.value = name;
        }
      }).catch(() => {
        const displayName = track.instrument?.name || track.name || name.replace(/_/g, ' ');
        this.warning.textContent = `"${displayName}" not available, using piano`;
        this.warning.style.display = 'block';
        if (select) select.value = 'acoustic_grand_piano';
        return this.app.audio.load('acoustic_grand_piano');
      });
    }
  }

  _isTrackAudible(i) {
    if (this._soloedTracks.size > 0) return this._soloedTracks.has(i);
    return !this._mutedTracks.has(i);
  }

  _playTrackNote(trackIndex, midi) {
    const instr = this._trackInstruments[trackIndex];
    if (!instr) return;
    this.app.audio.context.resume();
    const gain = this._trackVolumes[trackIndex] ?? 1;
    const active = instr.play(midi, 0, { gain });
    if (active) this._activeNotes.push({ note: active, midi });
  }

  _play(offsetMs = 0) {
    this._clearPlayback();
    this._playing = true;
    this._startTime = Date.now() - offsetMs;
    this._trackActivity = {};
    this.playBtn.style.display = 'none';
    this.pauseBtn.style.display = 'flex';
    this.stopBtn.style.display = 'flex';

    if (offsetMs === 0) this._loadSelectedInstrument();

    const keyboard = this.app.querySelector('piano-keyboard');
    const keysByMidi = {};
    keyboard.allKeys.forEach(k => { keysByMidi[k.midi] = k; });

    this._midi.tracks.forEach((track, i) => {
      this._trackActivity[i] = 0;
      for (const note of track.notes) {
        const startMs = note.time * 1000;
        const endMs = (note.time + note.duration) * 1000;

        if (endMs <= offsetMs) continue;

        if (startMs >= offsetMs) {
          const onId = setTimeout(() => {
            this._trackActivity[i]++;
            if (!this._isTrackAudible(i)) return;
            const selected = i === this._selectedTrack;
            const gain = this._trackVolumes[i] ?? 1;
            if (selected) {
              const key = keysByMidi[note.midi];
              if (key) {
                key.pressWithGain(gain);
              } else {
                this._playTrackNote(i, note.midi);
              }
            } else {
              this._playTrackNote(i, note.midi);
            }
          }, startMs - offsetMs);
          this._timeouts.push(onId);
        }

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
        }, endMs - offsetMs);
        this._timeouts.push(offId);
      }
    });

    this._activityInterval = setInterval(() => {
      for (const [i, el] of Object.entries(this._trackElements)) {
        el.classList.toggle('active', (this._trackActivity[i] || 0) > 0);
      }
      const elapsed = Date.now() - this._startTime;
      const progress = Math.min(elapsed / (this._midi.duration * 1000), 1);
      this.progressFill.style.width = `${progress * 100}%`;
    }, 100);

    const duration = this._midi.duration * 1000 + 200 - offsetMs;
    this._timeouts.push(setTimeout(() => this._stop(), duration));
  }

  _pause() {
    if (!this._playing) return;
    this._pausedAt = Date.now() - this._startTime;
    this._clearPlayback();
    this._playing = false;
    this.playBtn.style.display = 'flex';
    this.pauseBtn.style.display = 'none';
    this.stopBtn.style.display = 'flex';
  }

  _resume() {
    if (!this._pausedAt) return;
    const offset = this._pausedAt;
    this._pausedAt = null;
    this._play(offset);
  }

  _clearPlayback() {
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
    const keyboard = this.app.querySelector('piano-keyboard');
    if (keyboard) keyboard.allKeys.forEach(k => { if (k.pressed) k.release(); });
  }

  _stop() {
    this._clearPlayback();
    this._playing = false;
    this._pausedAt = null;
    this.progressFill.style.width = '0%';
    this.playBtn.style.display = 'flex';
    this.pauseBtn.style.display = 'none';
    this.stopBtn.style.display = 'none';
  }
}

customElements.define('midi-player', MidiPlayer);
