export class LoadingIndicator extends HTMLElement {
  constructor() {
    super();
    this._timer = null;
  }

  connectedCallback() {
    this.style.display = 'none';
    this.textContent = this.getAttribute('message') || 'Loading...';
  }

  start(delay = 300) {
    this.stop();
    this._timer = setTimeout(() => {
      this.style.display = '';
    }, delay);
  }

  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.style.display = 'none';
  }
}

customElements.define('loading-indicator', LoadingIndicator);
