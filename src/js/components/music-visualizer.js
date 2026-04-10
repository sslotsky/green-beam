export class MusicVisualizer extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.mode = this.getAttribute('mode') || 'equalizer';
    this.analyser = this.app.audio.analyser;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // Waveform state
    this.waveformData = new Uint8Array(this.analyser.fftSize);

    this.app.registerCanvasComponent(this);
  }

  update() {
    this.analyser.getByteFrequencyData(this.dataArray);

    if (this.mode === 'waveform') {
      this.analyser.getByteTimeDomainData(this.waveformData);
    }
  }

  draw(ctx) {
    switch (this.mode) {
      case 'waveform':
        this._drawWaveform(ctx);
        break;
      case 'equalizer':
      default:
        this._drawEqualizer(ctx);
    }
  }

  _drawWaveform(ctx) {
    const keyboard = this.app.querySelector('piano-keyboard');
    if (!keyboard) return;

    const data = this.waveformData;
    const x0 = keyboard.bodyX;
    const totalWidth = keyboard.bodyWidth;
    const yCenter = 750;
    const amplitude = 65;

    // Compute volume for glow/thickness
    const freqData = this.dataArray;
    let energy = 0;
    for (let i = 0; i < freqData.length; i++) energy += freqData[i];
    energy /= freqData.length;
    const intensity = Math.min(1, energy / 80);

    const hue = Math.round((performance.now() / 50) % 360);

    ctx.save();
    ctx.beginPath();
    const sliceWidth = totalWidth / data.length;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128; // -1 to 1
      const x = x0 + i * sliceWidth;
      const y = yCenter + v * amplitude * (0.3 + intensity * 0.7);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const color = `hsl(${hue}, 80%, 55%)`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 + intensity * 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + intensity * 12;
    ctx.stroke();
    ctx.restore();
  }

  _drawEqualizer(ctx) {
    const data = this.dataArray;
    const keyboard = this.app.querySelector('piano-keyboard');
    if (!keyboard) return;

    const x0 = keyboard.bodyX;
    const totalWidth = keyboard.bodyWidth;
    const yCenter = 750;
    const maxBarHeight = 42;

    const barCount = 64;
    const gap = 2;
    const barWidth = (totalWidth - (barCount - 1) * gap) / barCount;
    const usableBins = Math.floor(data.length * 0.75);
    const binsPerBar = Math.max(1, Math.floor(usableBins / barCount));

    // Slowly cycling base hue
    const baseHue = (performance.now() / 50) % 360;

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        sum += data[i * binsPerBar + j];
      }
      const avg = sum / binsPerBar;
      const barHeight = (avg / 255) * maxBarHeight;

      if (barHeight < 1) continue;

      const bx = x0 + i * (barWidth + gap);
      const hue = Math.round((baseHue + (i / barCount) * 60) % 360);
      const color = `hsl(${hue}, 80%, 55%)`;

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;

      // Top half (grows upward)
      ctx.beginPath();
      ctx.roundRect(bx, yCenter - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
      ctx.fill();

      // Bottom half (grows downward, mirrored)
      ctx.beginPath();
      ctx.roundRect(bx, yCenter, barWidth, barHeight, [0, 0, 2, 2]);
      ctx.fill();
    }
    ctx.restore();
  }

  setMode(mode) {
    this.mode = mode;
    this.setAttribute('mode', mode);
  }
}

customElements.define('music-visualizer', MusicVisualizer);
