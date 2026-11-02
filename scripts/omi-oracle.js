// Development-only oracle. Arithmetic bit extraction, no shifts/bitwise XOR,
// and no imports from the implementation under test.
const bit = (word, index) => Math.floor(word / 2 ** index) % 2;
export function referenceDelta(word) {
  let result = 0;
  for (let output = 0; output < 16; output++) {
    const parity = (bit(word, (output + 15) % 16) + bit(word, (output + 13) % 16) +
      bit(word, (output + 2) % 16) + bit(0x5a3c, output)) % 2;
    result += parity * 2 ** output;
  }
  return result;
}
export function referenceXor(a, b) {
  let result = 0;
  for (let i = 0; i < 16; i++) result += (bit(a, i) + bit(b, i)) % 2 * 2 ** i;
  return result;
}
