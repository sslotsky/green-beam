import { makeShareUrl } from '../sharing.js';

export class JukeboxModal extends HTMLElement {
  constructor() {
    super();
    this._selectedIndex = -1;
  }

  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = `
      <div class="overlay" id="overlay">
        <div class="modal">
          <h2>Jukebox</h2>
          <ul class="recording-list"></ul>
          <div class="share-status" style="font-size:12px;color:#888;display:none;"></div>
          <div class="actions">
            <button class="share-btn">Share</button>
            <button class="cancel-btn">Cancel</button>
            <button class="play-btn">Play</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.querySelector('.overlay');
    this.list = this.querySelector('.recording-list');
    this.shareStatus = this.querySelector('.share-status');

    this.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

    this.querySelector('.play-btn').addEventListener('click', () => {
      if (this._selectedIndex < 0) return;
      this.close();
      const keyboard = this.app.querySelector('piano-keyboard');
      this.app.recorder.playRecording(this.app.recorder.recordings[this._selectedIndex], keyboard.allKeys);
    });

    this.querySelector('.share-btn').addEventListener('click', () => {
      if (this._selectedIndex < 0) return;
      const rec = this.app.recorder.recordings[this._selectedIndex];
      const { url, truncated, totalNotes, sharedNotes } = makeShareUrl(rec.events);
      navigator.clipboard.writeText(url);
      if (truncated) {
        this.shareStatus.textContent = `Link copied! Sharing first ${sharedNotes} of ${totalNotes} notes.`;
      } else {
        this.shareStatus.textContent = 'Link copied to clipboard!';
      }
      this.shareStatus.style.display = 'block';
    });

    // Listen for jukebox click
    this.app.addEventListener('jukebox-click', () => this.open());

    // Open for shared recording
    if (this.app.sharedRecording) {
      this.open(this.app.sharedRecording);
    }
  }

  open(preselect = null) {
    this._renderList(preselect);
    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }

  _selectLi(li, rec) {
    this.list.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    this._selectedIndex = this.app.recorder.recordings.indexOf(rec);
  }

  _renderList(preselect = null) {
    this.list.innerHTML = '';
    this._selectedIndex = -1;
    this.shareStatus.style.display = 'none';
    const recordings = this.app.recorder.recordings;

    if (recordings.length === 0) {
      this.list.innerHTML = '<li class="empty">No recordings yet</li>';
      return;
    }

    const sorted = recordings.slice().sort((a, b) => a.timestamp - b.timestamp);
    sorted.forEach(rec => {
      const li = document.createElement('li');
      const timeStr = rec.timestamp.toLocaleTimeString();
      const noteCount = rec.events.filter(e => e.type === 'on').length;
      li.innerHTML = `<span>${rec.name}</span><span style="color:#888">${noteCount} notes - ${timeStr}</span>`;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&#x1F5D1;';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.recorder.delete(rec);
        this._renderList();
      });
      li.appendChild(deleteBtn);

      li.addEventListener('click', () => this._selectLi(li, rec));
      if (rec === preselect) this._selectLi(li, rec);
      this.list.appendChild(li);
    });
  }
}

customElements.define('jukebox-modal', JukeboxModal);
