# Slide 2 — approved recording reference

This isolated HyperFrames composition is the approved reference for the full deck's native `details.grain` and `effects.digitalGlitch` treatment. It does not add a custom CSS/SVG filter or alter the live deck's animation clock.

- `grading.json`: the small editable treatment patch.
- `index.html`: the validated, normalized `data-color-grading` settings on a silent source video.
- `assets/source.mp4`: the approved 2× slide-2 GIF converted to a 5.4-second, 10 fps video. One black padding row makes its 720×355 source H.264-compatible; the row is removed again from the final GIF.
- `../../composition/assets/backgrounds/02-recording.gif`: the approved reference, 54 frames at 100 ms per frame. The base `02.gif` is preserved.

## Tune and rebuild

Run from this directory. Use the installed HyperFrames CLI and bundled FFmpeg, not a new installation:

```sh
export PATH="$HOME/Library/Application Support/HyperFrames/agent-cli/bin:$HOME/Library/Application Support/HyperFrames/runtimes/ffmpeg-darwin-arm64-4d7f2b1c517e:$PATH"
hyperframes media-treatment --project . --selector '#recording-source' --grading grading.json --apply --json
hyperframes check . --json
```

Capture the native shader output at exact 0.1-second intervals; this avoids wall-clock GIF timing during rendering:

```sh
hyperframes snapshot . --at "$(python3 -c 'print(",".join(f"{i/10:.1f}" for i in range(54)))')" --no-end --output .hyperframes/recording-frames --json
ffmpeg -y -hide_banner -loglevel error -framerate 10 -pattern_type glob -i '.hyperframes/recording-frames/frame-*.png' -filter_complex '[0:v]crop=w=720:h=355:x=0:y=0:exact=1,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a' -loop 0 ../../composition/assets/backgrounds/02-recording.gif
```

Check the generated GIF's frame count, duration, loop, and several consecutive frames, then use `python3 treatments/build-recording.py` from `output/` to propagate the newly approved reference to the other nineteen slides. Run `npm test` afterward. Capture the live deck as well to judge the combination with camera motion. No audio or MP4 presentation export is produced.

To disable the treatment on slide 2, change its image source back to `assets/backgrounds/02.gif` and update its smoke-test expectation. Leave all approved base GIFs and original artwork intact. See `../README.md` for the complete rollout workflow and limits.
