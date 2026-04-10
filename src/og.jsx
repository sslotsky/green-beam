const { default: satori } = require('satori');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const interRegular = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Regular.ttf'));
const interBold = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Bold.ttf'));

const WIDTH = 1200;
const HEIGHT = 630;

function NoteBar({ midi, duration, maxLogDuration, minLogDuration }) {
  const logDur = Math.log(1 + duration);
  const height = Math.max(20, Math.min(100, ((logDur - minLogDuration) / (maxLogDuration - minLogDuration)) * 80 + 20));
  const hue = ((midi - 48) / 36) * 120;
  return (
    <div style={{
      width: '6px',
      height: `${height}px`,
      backgroundColor: `hsl(${hue}, 80%, 55%)`,
      borderRadius: '3px',
      flexShrink: '0',
    }} />
  );
}

function Visualization({ events }) {
  if (!events || events.length === 0) return null;

  const notes = [];
  const openNotes = {};
  for (const e of events) {
    if (e.type === 'on') {
      openNotes[e.midi] = e.time;
    } else if (e.type === 'off' && openNotes[e.midi] !== undefined) {
      notes.push({ midi: e.midi, start: openNotes[e.midi], duration: e.time - openNotes[e.midi] });
      delete openNotes[e.midi];
    }
  }

  if (notes.length === 0) return null;

  const count = Math.min(60, notes.length);
  const step = notes.length / count;
  const bars = Array.from({ length: count }, (_, i) => notes[Math.floor(i * step)]);
  const logDurations = bars.map(n => Math.log(1 + n.duration));
  const maxLogDuration = Math.max(...logDurations);
  const minLogDuration = Math.min(...logDurations);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: '3px',
      height: '120px',
      width: '1080px',
    }}>
      {bars.map((note, i) => (
        <NoteBar key={i} midi={note.midi} duration={note.duration} maxLogDuration={maxLogDuration} minLogDuration={minLogDuration} />
      ))}
    </div>
  );
}

function OgCard({ songTitle, instrument, events }) {
  const displayInstrument = instrument ? instrument.replace(/_/g, ' ') : null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '60px',
      fontFamily: 'Inter',
    }}>
      <div style={{ color: '#00ff40', fontSize: '28px', fontWeight: 700, letterSpacing: '3px', marginBottom: '30px' }}>
        LUMITONE
      </div>
      <div style={{ color: '#fff', fontSize: '48px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', maxWidth: '900px' }}>
        {songTitle}
      </div>
      {displayInstrument && (
        <div style={{ color: '#888', fontSize: '24px', marginBottom: '40px' }}>
          {displayInstrument}
        </div>
      )}
      <Visualization events={events} />
    </div>
  );
}

async function generateOgImage(songTitle, instrument, events) {
  const svg = await satori(
    <OgCard songTitle={songTitle} instrument={instrument} events={events} />,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  return resvg.render().asPng();
}

module.exports = { generateOgImage };
