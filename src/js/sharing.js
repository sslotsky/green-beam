// Binary format: [version(1)] [event(4 bytes each)...]
// Event: [(type << 7) | midi] [time_ms as uint24 big-endian]

const VERSION = 1;
const BYTES_PER_EVENT = 4;

function eventsToBytes(events) {
  const buf = new Uint8Array(1 + events.length * BYTES_PER_EVENT);
  buf[0] = VERSION;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const offset = 1 + i * BYTES_PER_EVENT;
    const typeBit = e.type === 'on' ? 1 : 0;
    buf[offset] = (typeBit << 7) | (e.midi & 0x7F);
    const ms = Math.round(e.time);
    buf[offset + 1] = (ms >> 16) & 0xFF;
    buf[offset + 2] = (ms >> 8) & 0xFF;
    buf[offset + 3] = ms & 0xFF;
  }
  return buf;
}

function bytesToEvents(buf) {
  const events = [];
  for (let i = 1; i + BYTES_PER_EVENT <= buf.length; i += BYTES_PER_EVENT) {
    const byte0 = buf[i];
    const type = (byte0 >> 7) === 1 ? 'on' : 'off';
    const midi = byte0 & 0x7F;
    const time = (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
    events.push({ type, midi, time });
  }
  return events;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}


export function encode(events) {
  return toBase64Url(eventsToBytes(events));
}

export function decode(str) {
  try {
    const bytes = fromBase64Url(str);
    if (bytes[0] !== VERSION) return null;
    return bytesToEvents(bytes);
  } catch {
    return null;
  }
}

export function encodeEvents(events) {
  return encode(events);
}

export async function shareSong(encoded, name, instrument) {
  const res = await fetch('/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: encoded, name, instrument }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error);
  return `${location.origin}/songs/${result.id}`;
}

export function loadFromHash() {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  const [data, ...params] = raw.split('&');
  const events = decode(data);
  if (!events) return null;
  let name = null;
  let instrument = null;
  for (const param of params) {
    const [key, val] = param.split('=');
    if (key === 'name') name = decodeURIComponent(val);
    if (key === 'instrument') instrument = decodeURIComponent(val);
  }
  return { events, name, instrument };
}
