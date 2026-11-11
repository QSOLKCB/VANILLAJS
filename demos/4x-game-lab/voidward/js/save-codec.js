// SPDX-License-Identifier: Apache-2.0
// One bounded UTF-8 contract for native saves, autosaves and engine state text.
// These are admission ceilings, not a browser performance promise. See
// docs/SAVE_LIMITS.md for the schema budget and measured Node boundary fixture.
export const MAX_STATE_BYTES = 48 * 1024 * 1024;
export const MAX_SAVE_BYTES = 49 * 1024 * 1024;
const encoder = new TextEncoder();
export const saveByteLength = text => encoder.encode(text).byteLength;
function boundedText(text, limit, label) {
  const fail=()=>{throw new Error(`${label} exceeds the ${limit / 1024 / 1024} MiB UTF-8 limit.`);};
  if (typeof text !== 'string' || text.length > limit) fail();
  const bytes=saveByteLength(text); if(bytes>limit)fail();
  return bytes;
}
function envelopeShape(data) {
  if (!data || data.kind !== 'voidward.save.v1' || !data.state || typeof data.state !== 'object' || Array.isArray(data.state) || !(data.extension === null || typeof data.extension === 'string'))
    throw new Error('Choose a VOIDWARD save file.');
}
export function encodeSaveEnvelope(data) {
  envelopeShape(data);
  // Compact JSON is intentional: pretty printing can make a valid long campaign
  // exceed the import budget solely through indentation and escaped history.
  const text = JSON.stringify(data), bytes = boundedText(text, MAX_SAVE_BYTES, 'Save file');
  // The state is a substring of this compact envelope. Avoid a second large
  // serialization unless the envelope itself exceeds the smaller state budget.
  if (bytes > MAX_STATE_BYTES)
    boundedText(JSON.stringify(data.state), MAX_STATE_BYTES, 'Campaign state');
  return text;
}
export function decodeSaveEnvelope(text) {
  boundedText(text, MAX_SAVE_BYTES, 'Save file');
  const data = JSON.parse(text);
  envelopeShape(data);
  boundedText(JSON.stringify(data.state), MAX_STATE_BYTES, 'Campaign state');
  // Content and full state schemas are still checked by parsePack/migrateState
  // before the caller can replace its active campaign or invoke installed hooks.
  return data;
}
export function decodeStateText(text) {
  boundedText(text, MAX_STATE_BYTES, 'Campaign state');
  return JSON.parse(text);
}
