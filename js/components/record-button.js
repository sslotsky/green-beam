import { html } from '../html.js';

export class RecordButton extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <button>
        <span class="rec-dot" style="width:12px;height:12px;border-radius:50%;background:#cc0000;display:inline-block;"></span>
        Record
      </button>
    `;
    this.dot = this.querySelector('.rec-dot');
    this.querySelector('button').addEventListener('click', () => this._toggle());
  }

  _toggle() {
    const { recorder } = this.app;
    if (recorder.recording) {
      const events = recorder.stop();
      this.dot.style.background = '#cc0000';
      this.dot.style.boxShadow = 'none';
      if (events) {
        this.app.querySelector('name-song-modal').open(events);
      }
    } else {
      recorder.start();
      this.dot.style.background = '#ff0000';
      this.dot.style.boxShadow = '0 0 6px #ff0000';
    }
  }
}

customElements.define('record-button', RecordButton);
