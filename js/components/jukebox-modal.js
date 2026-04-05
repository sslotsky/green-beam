import { makeShareUrl, shareSong } from '../sharing.js';
import { html } from '../html.js';

export class JukeboxModal extends HTMLElement {
  constructor() {
    super();
    this._selectedIndex = -1;
    this._selectedCommunityId = null;
    this._activeTab = 'mine';
  }

  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <div class="overlay" id="overlay">
        <div class="modal">
          <h2>Jukebox</h2>
          <div class="tabs">
            <button class="tab-btn active" data-tab="mine">My Songs</button>
            <button class="tab-btn" data-tab="community">Community</button>
          </div>
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
    this.shareBtn = this.querySelector('.share-btn');

    // Tabs
    this.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        this.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderActiveTab();
      });
    });

    this.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

    this.querySelector('.play-btn').addEventListener('click', () => {
      if (this._activeTab === 'mine') {
        if (this._selectedIndex < 0) return;
        this.close();
        const keyboard = this.app.querySelector('piano-keyboard');
        this.app.recorder.playRecording(this.app.recorder.recordings[this._selectedIndex], keyboard.allKeys);
      } else {
        if (!this._selectedCommunityId) return;
        this._playCommunity(this._selectedCommunityId);
      }
    });

    this.shareBtn.addEventListener('click', async () => {
      if (this._selectedIndex < 0 || this._activeTab !== 'mine') return;
      const rec = this.app.recorder.recordings[this._selectedIndex];
      const { encoded, truncated, totalNotes, sharedNotes } = makeShareUrl(rec.events);
      this.shareStatus.textContent = 'Creating link...';
      this.shareStatus.style.display = 'block';
      try {
        const shortUrl = await shareSong(encoded, rec.name);
        await navigator.clipboard.writeText(shortUrl);
        if (truncated) {
          this.shareStatus.textContent = `Link copied! Sharing first ${sharedNotes} of ${totalNotes} notes.`;
        } else {
          this.shareStatus.textContent = 'Link copied to clipboard!';
        }
      } catch (err) {
        this.shareStatus.textContent = err.message || 'Failed to create link.';
      }
    });

    // Listen for jukebox click
    this.app.addEventListener('jukebox-click', () => this.open());

    // Open for shared recording
    if (this.app.sharedRecording) {
      this.open(this.app.sharedRecording);
    }
  }

  open(preselect = null) {
    this._activeTab = 'mine';
    this.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === 'mine');
    });
    this._renderMyList(preselect);
    this._updateActions();
    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }

  _renderActiveTab() {
    if (this._activeTab === 'mine') {
      this._renderMyList();
    } else {
      this._renderCommunityList();
    }
    this._updateActions();
  }

  _updateActions() {
    this.shareBtn.style.display = this._activeTab === 'mine' ? 'flex' : 'none';
  }

  _selectLi(li, rec) {
    this.list.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    this._selectedIndex = this.app.recorder.recordings.indexOf(rec);
  }

  _renderMyList(preselect = null) {
    this.list.innerHTML = '';
    this._selectedIndex = -1;
    this.shareStatus.style.display = 'none';
    const recordings = this.app.recorder.recordings;

    if (recordings.length === 0) {
      this.list.innerHTML = html`<li class="empty">No recordings yet</li>`;
      return;
    }

    const sorted = recordings.slice().sort((a, b) => a.timestamp - b.timestamp);
    sorted.forEach(rec => {
      const li = document.createElement('li');
      const timeStr = rec.timestamp.toLocaleTimeString();
      const noteCount = rec.events.filter(e => e.type === 'on').length;
      const sharedIcon = rec.shared ? '<span title="Shared by another user" style="cursor:help">&#x1F517; </span>' : '';
      li.innerHTML = html`<span>${sharedIcon}${rec.name}</span><span style="color:#888">${noteCount} notes - ${timeStr}</span>`;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&#x1F5D1;';
      deleteBtn.title = 'Remove from your jukebox';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.recorder.delete(rec);
        this._renderMyList();
      });
      li.appendChild(deleteBtn);

      li.addEventListener('click', () => this._selectLi(li, rec));
      if (rec === preselect) this._selectLi(li, rec);
      this.list.appendChild(li);
    });
  }

  async _renderCommunityList() {
    this.list.innerHTML = html`<li class="empty">Loading...</li>`;
    this._selectedCommunityId = null;
    this.shareStatus.style.display = 'none';

    try {
      const res = await fetch('/songs/recent');
      const songs = await res.json();

      this.list.innerHTML = '';
      if (songs.length === 0) {
        this.list.innerHTML = html`<li class="empty">No community songs yet. Be the first to share!</li>`;
        return;
      }

      songs.forEach(song => {
        const li = document.createElement('li');
        const date = new Date(song.created_at * 1000);
        const dateStr = date.toLocaleDateString();
        li.innerHTML = html`<span>${song.name || 'Untitled'}</span><span style="color:#888">${dateStr}</span>`;
        li.addEventListener('click', () => {
          this.list.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
          li.classList.add('selected');
          this._selectedCommunityId = song.id;
        });
        this.list.appendChild(li);
      });
    } catch {
      this.list.innerHTML = html`<li class="empty">Failed to load community songs</li>`;
    }
  }

  async _playCommunity(id) {
    try {
      const res = await fetch(`/songs/${id}/data`);
      if (!res.ok) throw new Error();
      const { data, name } = await res.json();

      const { decode } = await import('../sharing.js');
      const events = decode(data);
      if (!events) return;

      this.close();
      const keyboard = this.app.querySelector('piano-keyboard');
      this.app.recorder.playRecording({ name, events }, keyboard.allKeys);
    } catch {
      this.shareStatus.textContent = 'Failed to load song.';
      this.shareStatus.style.display = 'block';
    }
  }
}

customElements.define('jukebox-modal', JukeboxModal);
