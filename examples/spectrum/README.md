# Spectrum gallery

Run the shared build and local example server:

```sh
npm ci --ignore-scripts
npm run build
node examples/spectrum/serve.mjs
```

Open <http://127.0.0.1:4194>. Play, pause, seek, resize the page, and unload/remount
the views. All ten canvases share one fetched recording and one native sample
table inside this page's runtime. No external media or models are downloaded.

`fixture.mjs` creates a short original synthetic tone and a **hand-authored**
Fourier calibration/display fixture. Its band levels are illustrative and are
not measured FFT evidence. The `producer: StemLab` field is a schema test fixture,
explicitly marked `synthetic: true`; it is not a claim that StemLab produced this
example. No sample data is imported by `src/` or copied into npm, browser or
WordPress packages. The example endpoint generates the fixture on demand in this
server process.

For real music use the saved StemLab Fourier `dancerudiments.recording` JSON
for the exact audio/master or explicitly associated stem and replace the page's
`spectrumRecordingUrl`. See [Spectrum visualisations](../../docs/spectrum-visualisations.md).
