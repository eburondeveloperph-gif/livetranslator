/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import EventEmitter from 'eventemitter3';

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private emitter = new EventEmitter();
  
  // Gemini requires 16000Hz, 16-bit PCM
  private targetSampleRate = 16000;

  constructor(private sampleRate: number = 16000) {
    this.targetSampleRate = sampleRate;
  }

  on(event: string, fn: (...args: any[]) => void) {
    this.emitter.on(event, fn);
    return this;
  }

  off(event: string, fn: (...args: any[]) => void) {
    this.emitter.off(event, fn);
    return this;
  }

  private emit(event: string, ...args: any[]) {
    this.emitter.emit(event, ...args);
  }

  async start(stream?: MediaStream) {
    try {
      if (stream) {
        this.stream = stream;
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            channelCount: 1,
            sampleRate: this.targetSampleRate 
          } 
        });
      }

      this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use ScriptProcessor for broad compatibility to get PCM data
      // Buffer size 4096 gives decent chunk size
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const pcm16 = this.convertFloat32ToInt16(inputData);
        // Emit base64 encoded PCM data
        this.emit('data', this.arrayBufferToBase64(pcm16.buffer));
        
        // Simple volume meter calc
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.emit('volume', rms);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination); // Muted by nature of ScriptProcessor usually, but needed for Chrome to fire events

    } catch (e) {
      console.error("Error starting recorder:", e);
      throw e;
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private convertFloat32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      // Clamp between -1 and 1
      const s = Math.max(-1, Math.min(1, float32[i]));
      // Scale to 16-bit integer range
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}