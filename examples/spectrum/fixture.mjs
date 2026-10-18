/** Synthetic display/calibration fixture, not a StemLab analysis of a real song.
 * Kept in this example only. Nothing here is imported by the reusable package.
 */
import {createHash} from 'node:crypto';
export function createFixture() {
  const sampleRate = 16000, seconds = 8, count = sampleRate * seconds;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length - 8, 4);wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);wav.writeUInt16LE(1, 20);wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);wav.writeUInt16LE(16, 34);wav.write('data', 36);wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate, fade = Math.min(1, t * 10, (seconds - t) * 10);
    const value = [110, 330, 880, 2640].reduce((sum, hz, j) => sum + Math.sin(2 * Math.PI * hz * t) * (.025 + .018 * Math.sin(t * 2 + j)), 0);
    wav.writeInt16LE(Math.round(value * fade * 32767), 44 + i * 2);
  }
  const digest = createHash('sha256').update(wav).digest('hex');
  const axes = Array.from({length: 32}, (_, i) => ({name:`band_${String(i).padStart(3,'0')}`,
    mode:'fourier',output_scale:'bipolar',clipped_windows:0,silent_axis:false,
    normalization_divisor:.25,gain:1,frequency_low_hz:i * 250,frequency_high_hz:(i + 1) * 250,
    source_sample_rate:sampleRate,source_sha256:digest,fourier:{fft_size:512}}));
  const samples = Array.from({length: seconds * 128}, (_, pip) => axes.map((_, i) => {
    const centre = 10 + 8 * Math.sin(pip / 110);
    const rms = .001 + .05 * Math.exp(-Math.pow((i - centre) / 4, 2)) + .008 * (1 + Math.sin(pip / 24 + i)) + .025 * Math.exp(-Math.pow((i - 3) / 2, 2));
    return Number((2 * rms / .25 - 1).toFixed(12));
  }));
  const recording = {format:'dancerudiments.recording',schema_version:1,pips_per_beat:64,sample_dtype:'float64',sample_decimals:12,
    name:'synthetic_spectrum_gallery',dimensions:axes.map(axis=>axis.name),samples,
    clock:{bpm:120,bpm_source:'synthetic example',bpm_status:'confirmed',beat_zero_seconds:0,phase_status:'supplied',start_pip:0},
    provenance:{producer:'StemLab',synthetic:true,description:'Hand-authored calibration/display fixture; not measured FFT evidence.',axes}};
  return {wav,recording};
}
