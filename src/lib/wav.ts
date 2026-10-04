export function encodeMonoWav(chunks: Float32Array[], inputRate: number, outputRate = 16_000) {
  const inputLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(inputLength);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.floor(merged.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), merged.length);
    let sum = 0;
    for (let sample = start; sample < end; sample += 1) sum += merged[sample];
    output[index] = sum / Math.max(1, end - start);
  }

  const buffer = new ArrayBuffer(44 + output.length * 2);
  const view = new DataView(buffer);
  const write = (position: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(position + index, value.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + output.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, output.length * 2, true);
  output.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return new Uint8Array(buffer);
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}
