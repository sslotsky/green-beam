import { html } from '../html.js';

export class RecordButton extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <button class="rec-btn">
        <span class="rec-dot" style="width:12px;height:12px;border-radius:50%;background:#cc0000;display:inline-block;"></span>
        Record
      </button>
      <div class="rec-warning" style="display:none;color:#ff8800;font-size:11px;font-family:sans-serif;line-height:1.3;margin-top:4px;"></div>
    `;
    this.dot = this.querySelector('.rec-dot');
    this.warning = this.querySelector('.rec-warning');
    this.querySelector('.rec-btn').addEventListener('click', () => this._toggle());
    this._checkInterval = null;
  }

  _toggle() {
    const { recorder } = this.app;
    if (recorder.recording) {
      this._stopRecording();
    } else {
      recorder.start();
      this.dot.style.background = '#ff0000';
      this.dot.style.boxShadow = '0 0 6px #ff0000';
      this.warning.style.display = 'none';
      this._checkInterval = setInterval(() => this._checkLimit(), 500);
    }
  }

  _checkLimit() {
    const { recorder } = this.app;
    if (!recorder.recording) return;

    if (recorder.atLimit) {
      this._stopRecording();
    } else if (recorder.nearLimit) {
      this.warning.textContent = 'Recording is approaching maximum size and will be stopped automatically when limit is reached.';
      this.warning.style.display = 'block';
    }
  }

  _stopRecording() {
    const { recorder } = this.app;
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
    const events = recorder.stop();
    this.dot.style.background = '#cc0000';
    this.dot.style.boxShadow = 'none';
    this.warning.style.display = 'none';
    if (events) {
      this.app.querySelector('name-song-modal').open(events, this.app.audio.currentInstrument);
    }
  }
}

customElements.define('record-button', RecordButton);
