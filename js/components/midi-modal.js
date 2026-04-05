import { html } from '../html.js';

export class MidiModal extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.innerHTML = html`
      <div class="overlay midi-overlay">
        <div class="modal">
          <h2>MIDI Devices</h2>
          <ul class="device-list"></ul>
          <div class="actions">
            <button class="disconnect-btn" style="display:none">Disconnect</button>
            <button class="cancel-btn">Cancel</button>
            <button class="connect-btn play-btn">Connect</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.querySelector('.midi-overlay');
    this.list = this.querySelector('.device-list');
    this.connectBtn = this.querySelector('.connect-btn');
    this.disconnectBtn = this.querySelector('.disconnect-btn');
    this._selectedInput = null;

    this.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

    this.connectBtn.addEventListener('click', () => {
      if (!this._selectedInput) return;
      this.app.midi.connect(this._selectedInput);
      this._wireToKeyboard();
      this.close();
    });

    this.disconnectBtn.addEventListener('click', () => {
      this.app.midi.disconnect();
      this._renderList();
    });

    this.app.addEventListener('amp-click', () => this.open());
  }

  async open() {
    const midi = this.app.midi;
    if (!midi.access) await midi.init();
    this._renderList();
    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }

  _wireToKeyboard() {
    const keyboard = this.app.querySelector('piano-keyboard');
    const keysByMidi = {};
    keyboard.allKeys.forEach(k => { keysByMidi[k.midi] = k; });

    this.app.midi.onNoteOn((note) => {
      const key = keysByMidi[note];
      if (key) key.press();
    });

    this.app.midi.onNoteOff((note) => {
      const key = keysByMidi[note];
      if (key) key.release();
    });
  }

  _renderList() {
    this.list.innerHTML = '';
    this._selectedInput = null;
    const midi = this.app.midi;

    if (!midi.supported) {
      this.list.innerHTML = html`<li class="empty">Web MIDI not supported in this browser</li>`;
      return;
    }

    const inputs = midi.getInputs();
    if (inputs.length === 0) {
      this.list.innerHTML = html`<li class="empty">No MIDI devices found</li>`;
      return;
    }

    this.disconnectBtn.style.display = midi.activeInput ? 'flex' : 'none';

    inputs.forEach(input => {
      const li = document.createElement('li');
      const isActive = midi.activeInput === input;
      li.innerHTML = html`
        <span>${input.name || 'Unknown Device'}</span>
        <span style="color:#888">${input.manufacturer || ''}${isActive ? ' (connected)' : ''}</span>
      `;
      if (isActive) li.classList.add('selected');
      li.addEventListener('click', () => {
        this.list.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this._selectedInput = input;
      });
      this.list.appendChild(li);
    });
  }
}

customElements.define('midi-modal', MidiModal);
