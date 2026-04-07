import { html } from '../html.js';

export class LearnModal extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');

    this.innerHTML = html`
      <div class="overlay learn-overlay">
        <div class="modal learn-modal">
          <h2>Learn a Song</h2>
          <div class="tabs">
            <button class="tab-btn active" data-tab="catalog">Catalog</button>
            <button class="tab-btn" data-tab="upload">Upload</button>
          </div>
          <div class="tab-content catalog-tab">
            <ul class="song-list"></ul>
          </div>
          <div class="tab-content upload-tab" style="display:none">
            <div class="midi-drop-zone">
              <span class="midi-drop-label">Drop a MIDI file here or click to browse</span>
              <input type="file" accept=".mid,.midi" class="midi-file-input" style="display:none">
            </div>
          </div>
          <div class="actions">
            <button class="close-btn">Close</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.querySelector('.learn-overlay');
    this.songListEl = this.querySelector('.song-list');
    this.catalogTab = this.querySelector('.catalog-tab');
    this.uploadTab = this.querySelector('.upload-tab');
    this.dropZone = this.querySelector('.midi-drop-zone');
    this.closeBtn = this.querySelector('.close-btn');

    // Tabs
    this.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        this.catalogTab.style.display = tab === 'catalog' ? '' : 'none';
        this.uploadTab.style.display = tab === 'upload' ? '' : 'none';
      });
    });

    // Drop zone
    this.fileInput = this.querySelector('.midi-file-input');

    this.dropZone.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files[0];
      if (file) this._loadFile(file);
      this.fileInput.value = '';
    });

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

    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  async _loadFile(file) {
    const name = file.name.replace(/\.(mid|midi)$/i, '');
    const buffer = await file.arrayBuffer();
    this.close();
    const player = this.app.querySelector('midi-player');
    if (player) player.loadFile(name, buffer);
  }

  async open() {
    this.overlay.classList.add('open');
    await this._loadSongs();
  }

  close() {
    this.overlay.classList.remove('open');
  }

  async _loadSongs() {
    this.songListEl.innerHTML = '<li class="empty">Loading...</li>';
    try {
      const res = await fetch('/midi');
      const songs = await res.json();
      this.songListEl.innerHTML = '';
      if (songs.length === 0) {
        this.songListEl.innerHTML = '<li class="empty">No songs available</li>';
        return;
      }
      for (const song of songs) {
        const li = document.createElement('li');
        li.textContent = song.name;
        li.addEventListener('click', () => {
          this.close();
          const player = this.app.querySelector('midi-player');
          if (player) player.loadSong(song);
        });
        this.songListEl.appendChild(li);
      }
    } catch {
      this.songListEl.innerHTML = '<li class="empty">Failed to load songs</li>';
    }
  }
}

customElements.define('learn-modal', LearnModal);
