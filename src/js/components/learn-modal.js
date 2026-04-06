import { html } from '../html.js';

export class LearnModal extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');

    this.innerHTML = html`
      <div class="overlay learn-overlay">
        <div class="modal learn-modal">
          <h2>Learn a Song</h2>
          <ul class="song-list"></ul>
          <div class="actions">
            <button class="close-btn">Close</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.querySelector('.learn-overlay');
    this.songListEl = this.querySelector('.song-list');
    this.closeBtn = this.querySelector('.close-btn');

    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
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
