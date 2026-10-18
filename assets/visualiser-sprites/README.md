# FrameRudiments sprite atlases

These 17 PNG sheets and their original manifest are copied byte-for-byte from
[FrameRudiments at c8d1c9a75630a88324e49a1446820392514092dd](https://github.com/kieransimkin/FrameRudiments/tree/c8d1c9a75630a88324e49a1446820392514092dd/src/framerudiments/sprite_assets).
The accompanying MIT licence applies. Copyright (c) 2026 Kieran Simkin.
The original manifest preserves the image-generation provenance of
`generated-neon.png`; the other sheets are procedural artwork from that project.

Each sheet is 768 by 768 pixels, arranged as eight rows and eight columns of
96-pixel cells. Rows represent segments, dots, tubes, crystals, icons, sparks,
blocks and flames; columns provide palette/animation variants. Several themes
intentionally have identical PNG bytes. The supplied SHA-256 hashes are
verified before browser decoding and during packaging checks.

The renderer package contains these generic reusable images as separate assets.
JavaScript imports do not embed or fetch their pixels. A page that mounts a
sprite view loads only its selected sheet, shares it with other views of the
same atlas/grid, and releases it after its last owner is destroyed.

For npm/browser use, host this directory and pass its URL as
`visualiserAssetBaseUrl`. WordPress resolves the shipped directory automatically.
Custom page artwork uses a separately hosted, pinned `style.sprite_asset`
reference. Song recordings and custom artwork are not part of this directory.

See [the visualiser guide](https://github.com/kieransimkin/DanceMoves/blob/main/docs/rudiment-visualisers.md) for all modes,
sprite controls, timing, limits and custom-atlas examples.
