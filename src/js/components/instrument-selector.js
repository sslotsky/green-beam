import { Audio } from '../audio.js';

export class InstrumentSelector extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    const select = document.createElement('select');
    Audio.instruments.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name.replace(/_/g, ' ');
      select.appendChild(opt);
    });
    select.value = this.app.audio.currentInstrument || 'acoustic_grand_piano';
    select.addEventListener('change', () => this.app.audio.load(select.value));
    this.appendChild(select);
  }
}

customElements.define('instrument-selector', InstrumentSelector);
