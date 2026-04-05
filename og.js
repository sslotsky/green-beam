const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

let _satori;
async function getSatori() {
  if (!_satori) _satori = (await import('satori')).default;
  return _satori;
}

const interRegular = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Regular.ttf'));
const interBold = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Bold.ttf'));

const WIDTH = 1200;
const HEIGHT = 630;

function buildVisualization(events) {
  if (!events || events.length === 0) return [];

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

  if (notes.length === 0) return [];

  const maxDuration = Math.max(...notes.map(n => n.duration));

  return notes.slice(0, 60).map((note) => {
    const height = Math.max(10, Math.min(100, (note.duration / maxDuration) * 100));
    const hue = ((note.midi - 48) / 36) * 120;
    return {
      type: 'div',
      props: {
        style: {
          width: '6px',
          height: `${height}px`,
          backgroundColor: `hsl(${hue}, 80%, 55%)`,
          borderRadius: '3px',
          flexShrink: '0',
        },
      },
    };
  });
}

async function generateOgImage(songTitle, instrument, events) {
  const displayInstrument = instrument ? instrument.replace(/_/g, ' ') : null;
  const bars = buildVisualization(events);

  const satori = await getSatori();
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { color: '#00ff40', fontSize: '28px', fontWeight: 700, letterSpacing: '3px', marginBottom: '30px' },
              children: 'LUMITONE',
            },
          },
          {
            type: 'div',
            props: {
              style: { color: '#fff', fontSize: '48px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', maxWidth: '900px' },
              children: songTitle,
            },
          },
          ...(displayInstrument ? [{
            type: 'div',
            props: {
              style: { color: '#888', fontSize: '24px', marginBottom: '40px' },
              children: displayInstrument,
            },
          }] : []),
          ...(bars.length > 0 ? [{
            type: 'div',
            props: {
              style: {
                width: '600px',
                height: '120px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '3px',
              },
              children: bars,
            },
          }] : []),
        ],
      },
    },
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
