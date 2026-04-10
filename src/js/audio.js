const INSTRUMENTS = [
  'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_piano_1', 'electric_piano_2',
  'honkytonk_piano', 'harpsichord', 'clavinet', 'celesta', 'glockenspiel', 'music_box',
  'vibraphone', 'marimba', 'xylophone', 'tubular_bells', 'dulcimer',
  'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ', 'reed_organ',
  'accordion', 'harmonica',
  'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz',
  'electric_guitar_clean', 'electric_guitar_muted', 'overdriven_guitar', 'distortion_guitar',
  'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass',
  'slap_bass_1', 'synth_bass_1',
  'violin', 'viola', 'cello', 'contrabass', 'tremolo_strings', 'pizzicato_strings',
  'orchestral_harp', 'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1',
  'choir_aahs', 'voice_oohs', 'synth_choir',
  'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn', 'brass_section',
  'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
  'oboe', 'english_horn', 'bassoon', 'clarinet',
  'piccolo', 'flute', 'recorder', 'pan_flute', 'ocarina',
  'lead_1_square', 'lead_2_sawtooth',
  'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth',
  'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle',
  'steel_drums', 'taiko_drum', 'timpani',
];

export class Audio {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.context.destination);
    this.instrument = null;
  }

  load(name) {
    this.instrument = null;
    this.currentInstrument = name;
    return Soundfont.instrument(this.context, name, { destination: this.analyser }).then(p => { this.instrument = p; });
  }

  play(midi, gain) {
    if (!this.instrument) return null;
    this.context.resume();
    return this.instrument.play(midi, 0, gain != null ? { gain } : undefined);
  }

  static get instruments() {
    return INSTRUMENTS;
  }
}
