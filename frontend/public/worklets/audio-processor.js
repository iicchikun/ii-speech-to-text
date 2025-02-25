class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(2048);
    this._writeIndex = 0;
    this.port.postMessage({ type: 'debug', message: 'AudioProcessor initialized' });
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;

    const channel = input[0];
    if (!channel) return true;

    // Add samples to buffer
    for (let i = 0; i < channel.length; i++) {
      this._buffer[this._writeIndex] = channel[i];
      this._writeIndex++;

      // When buffer is full, send it
      if (this._writeIndex >= 2048) {
        // Convert Float32Array to Int16Array with minimal processing
        const samples = new Int16Array(2048);
        for (let j = 0; j < 2048; j++) {
          // Simple float32 to int16 conversion
          samples[j] = Math.floor(this._buffer[j] * 32767);
        }

        // Send the buffer
        const buffer = samples.buffer.slice(0);
        this.port.postMessage(buffer, [buffer]);
        
        // Reset buffer
        this._buffer = new Float32Array(2048);
        this._writeIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
