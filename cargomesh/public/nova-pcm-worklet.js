class NovaPcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0;
    this.count = 0;
    this.phase = 0;
    this.frame = new Int16Array(320);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    const ratio = 16000 / sampleRate;
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i];
      this.count++;
      this.phase += ratio;
      if (this.phase >= 1) {
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.frame[this.offset++] = Math.round(value < 0 ? value * 32768 : value * 32767);
        this.sum = 0;
        this.count = 0;
        this.phase -= 1;
        if (this.offset === this.frame.length) {
          this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
          this.frame = new Int16Array(320);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("nova-pcm-worklet", NovaPcmWorklet);
