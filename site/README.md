# Landing site

Static, zero-dependency landing page (`index.html`, self-contained HTML+CSS, no build
step, no JS). Deployed to GitHub Pages by `.github/workflows/site.yml` on every push to
`main` that touches `site/**` or `docs/media/**`.

Screenshots are NOT duplicated here: the workflow stages `docs/media/*.png` into
`media/` and `resources/icon.png` as the favicon at deploy time. To preview locally:

```bash
mkdir -p /tmp/_site/media && cp site/index.html /tmp/_site/ \
  && cp docs/media/*.png /tmp/_site/media/ && cp resources/icon.png /tmp/_site/icon.png \
  && open /tmp/_site/index.html
```

One-time setup (done 2026-07-08): repo Settings → Pages → Source: **GitHub Actions**.
Published at: https://carlo23666.github.io/lolcompanion/
