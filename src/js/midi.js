export class Midi {
  constructor() {
    this.access = null;
    this.activeInput = null;
    this.supported = !!navigator.requestMIDIAccess;
    this._onNoteOn = null;
    this._onNoteOff = null;
  }

  async init() {
    if (!this.supported) return;
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      this.supported = false;
    }
  }

  getInputs() {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values());
  }

  connect(input) {
    this.disconnect();
    this.activeInput = input;
    input.onmidimessage = (e) => this._handleMessage(e);
  }

  disconnect() {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
    }
  }

  onNoteOn(fn) { this._onNoteOn = fn; }
  onNoteOff(fn) { this._onNoteOff = fn; }

  _handleMessage(e) {
    const [status, note, velocity] = e.data;
    const command = status & 0xF0;
    if (command === 0x90 && velocity > 0) {
      if (this._onNoteOn) this._onNoteOn(note, velocity);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      if (this._onNoteOff) this._onNoteOff(note);
    }
  }
}
