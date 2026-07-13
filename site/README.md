# Landing site

Static, zero-dependency bilingual landing page (`index.html`, `es.html`, shared
`styles.css`, no build step and no JavaScript). Deployed to GitHub Pages by
`.github/workflows/site.yml` on every push to
`main` that touches `site/**`, `docs/media/**` or the mascot sheets.

Screenshots and mascot sheets are not duplicated here: the workflow stages
`docs/media/{en,es}/*.png` and `src/renderer/public/mascot/*-sheet.png` into the
deployed site. `lol-gameplay-hud.jpg` is an owner-provided gameplay capture cropped to the lower
HUD strip and used to demonstrate the overlay's real placement. To preview locally:

```bash
mkdir -p /tmp/_site/media/{en,es} /tmp/_site/mascot && cp -r site/. /tmp/_site/ \
  && cp docs/media/en/*.png /tmp/_site/media/en/ \
  && cp docs/media/es/*.png /tmp/_site/media/es/ \
  && cp src/renderer/public/mascot/*-sheet.png /tmp/_site/mascot/ \
  && open /tmp/_site/index.html
```

One-time setup (done 2026-07-08): repo Settings → Pages → Source: **GitHub Actions**.
Published at: https://carlo23666.github.io/lolcompanion/
