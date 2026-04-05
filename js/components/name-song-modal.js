import { html } from '../html.js';

export class NameSongModal extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <div class="overlay name-song-overlay">
        <div class="modal">
          <h2>Name Your Song</h2>
          <input class="song-name-input" type="text" style="width:100%;padding:8px;font-size:14px;border-radius:4px;border:1px solid #555;background:#333;color:#fff;box-sizing:border-box;" />
          <div class="actions">
            <button class="discard-btn">Discard</button>
            <button class="save-btn play-btn">Save</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.querySelector('.name-song-overlay');
    this.input = this.querySelector('.song-name-input');
    this._pendingEvents = null;

    this.querySelector('.save-btn').addEventListener('click', () => this._save());
    this.querySelector('.discard-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._save();
      e.stopPropagation();
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
  }

  open(events) {
    this._pendingEvents = events;
    const defaultName = `Song ${new Date().toLocaleTimeString()}`;
    this.input.value = defaultName;
    this.overlay.classList.add('open');
    this.input.focus();
    this.input.select();
  }

  close() {
    this._pendingEvents = null;
    this.overlay.classList.remove('open');
  }

  _save() {
    if (!this._pendingEvents) return;
    const name = this.input.value.trim() || `Song ${new Date().toLocaleTimeString()}`;
    this.app.recorder.save(name, this._pendingEvents);
    this.close();
  }
}

customElements.define('name-song-modal', NameSongModal);
