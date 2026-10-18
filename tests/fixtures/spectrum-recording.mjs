// Synthetic calibration fixture matching FrameRudiments' test_spectrum.py.
// Contains no song, audio, artwork or downloaded analysis data.
export function createSpectrumRecording({count = 512} = {}) {
  const axes = Array.from({length: 4}, (_, index) => ({
    name: `band_${String(index).padStart(3, '0')}`, mode: 'fourier', output_scale: 'bipolar',
    clipped_windows: 0, silent_axis: index === 3, normalization_divisor: 0.5,
    gain: index === 2 ? -0.5 : 1, frequency_low_hz: index * 100,
    frequency_high_hz: (index + 1) * 100, source_sample_rate: 8000,
    fourier: {fft_size: 256}, source_sha256: 'ab'.repeat(32)
  }));
  const samples = Array.from({length: count}, (_, index) => {
    const rms = [0.1, index < 20 ? 0.45 : 0.05, 0.02, 0];
    return axes.map((axis, band) => axis.silent_axis ? 0 :
      (2 * rms[band] / axis.normalization_divisor - 1) * axis.gain);
  });
  return {format: 'dancerudiments.recording', schema_version: 1, pips_per_beat: 64,
    sample_dtype: 'float64', name: 'synthetic_fourier_contract_fixture',
    dimensions: axes.map(axis => axis.name), samples,
    clock: {bpm: 120, bpm_source: 'synthetic fixture', bpm_status: 'confirmed',
      beat_zero_seconds: 0, phase_status: 'supplied', start_pip: 0},
    provenance: {producer: 'StemLab', synthetic: true, axes}};
}
