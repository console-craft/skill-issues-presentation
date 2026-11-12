# Recording treatments

All twenty backgrounds use the exact native HyperFrames grain/digitalGlitch settings approved on slide 2. The live deck uses separate `NN-recording.gif` files; approved 2× `NN.gif` files and the original artwork remain unchanged.

`slide-02/` is the editable reference. Its existing treated GIF is preserved exactly when building the other slides. Each generated `slide-NN/` contains an isolated native HyperFrames composition and a silent source MP4 so the treatment can be inspected independently.

## Rebuild the rollout

From `output/`:

```sh
python3 treatments/build-recording.py
npm test
npm run check
```

The builder uses this Mac's installed ImageMagick, HyperFrames CLI, and bundled FFmpeg. Two isolated rendering sessions run at once. Each clip is converted from its approved 2× base GIF, padded to even dimensions for H.264, graded with the approved native settings, checked, and sampled at exact 0.1-second intervals. Padding is removed again before GIF encoding. The final file replaces its destination only after dimensions, frame timing, infinite looping, and changing noise have been verified.

Loop duration is preserved for every slide. Sources whose original frame boundaries fall between 100 ms samples (slide 3) are sampled at 10 fps, not sped up again. Source dimensions are retained, including slide 12's 1600×900 resolution. No audio or presentation MP4 export is produced.

The builder never rewrites `slide-02/`, its approved `02-recording.gif`, or any clean base GIF. It refuses to overwrite a generated composition if it does not have the builder's provenance marker. Build logs and cached frames live inside each generated treatment directory; `.hyperframes/` and logs are ignored by Git.

To tune the look, edit and rebuild slide 2 using its own README, then run the rollout builder to propagate the newly approved reference. To disable the look, use the clean base file in each slide's `picture` element. The reduced-motion source already selects that clean file automatically.

## Limits

This is a baked presentation treatment: larger assets and GIF palette quantization are the trade-off for keeping the live player simple. Treat browser playback checks as local evidence, not a projector/venue or long-session performance guarantee. The complete folder is portable; a single inlined HTML export is not, because the treated files exceed the CLI's inline-size limit.
