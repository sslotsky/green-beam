// Binary format: [version(1)] [event(4 bytes each)...]
// Event: [(type << 7) | midi] [time_ms as uint24 big-endian]
// 4 bytes per event, ~11 base64 chars per note pair
// Max URL ~1950 usable chars → ~177 notes

const VERSION = 1;
const BYTES_PER_EVENT = 4;
const BASE_URL_OVERHEAD = 60; // generous estimate for base URL + "#"
const MAX_URL_LENGTH = 2000;

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

export function truncateEvents(events, maxUrlLength = MAX_URL_LENGTH) {
  const availableChars = maxUrlLength - BASE_URL_OVERHEAD;
  // base64 produces ~4/3 chars per byte, plus 1 byte for version
  const maxBytes = Math.floor(availableChars * 3 / 4) - 1;
  const maxEvents = Math.floor(maxBytes / BYTES_PER_EVENT);

  if (events.length <= maxEvents) {
    return { events, truncated: false, totalNotes: 0, sharedNotes: 0 };
  }

  // Truncate at a note boundary — ensure every 'on' has a matching 'off'
  const truncated = events.slice(0, maxEvents);
  const openNotes = new Set();
  const closed = [];

  for (const e of truncated) {
    if (e.type === 'on') {
      openNotes.add(e.midi);
      closed.push(e);
    } else {
      openNotes.delete(e.midi);
      closed.push(e);
    }
  }

  // Close any still-open notes at the last event's time
  const lastTime = closed.length > 0 ? closed[closed.length - 1].time : 0;
  for (const midi of openNotes) {
    closed.push({ type: 'off', midi, time: lastTime });
  }

  const totalNotes = events.filter(e => e.type === 'on').length;
  const sharedNotes = closed.filter(e => e.type === 'on').length;

  return { events: closed, truncated: true, totalNotes, sharedNotes };
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

export function makeShareUrl(events) {
  const result = truncateEvents(events);
  const encoded = encode(result.events);
  const url = `${location.origin}${location.pathname}#${encoded}`;
  return { url, encoded, ...result };
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
