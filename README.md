# ShapeAreaCalc

A browser-based tool for measuring areas of shapes on images. Runs **100% offline** — no server, no uploads, no internet required after loading.

<!-- TODO: replace with actual screenshot -->
<p align="center">
  <img src="docs/screenshot.png" alt="ShapeAreaCalc Screenshot" width="800">
</p>

## Why This Tool

- **Offline & Private** — All processing happens locally in your browser. Your images never leave your machine. Ideal for lab environments with restricted network access.
- **Scientific Use** — Set a real-world scale bar (µm, mm, nm) against pixel distances, then measure areas in physical units with full precision.
- **Zero Install** — Just open `index.html` in any modern browser. No dependencies, no build step, no package manager.

## Features

| Feature | Details |
|---|---|
| **Image Formats** | JPEG, PNG, BMP, WebP, **TIFF** (via UTIF.js) |
| **Scale Calibration** | Two-point calibration with configurable units (nm / µm / mm) |
| **Shape Types** | Ellipse, Rectangle, Freeform Polygon |
| **Shape Editing** | Drag to move, resize via handles, rotate, vertex editing for polygons |
| **Zoom Lens** | 5× magnified view follows cursor for pixel-accurate placement |
| **Drag & Drop** | Drop image files directly onto the window |

## Usage

1. **Open** — Double-click `index.html` or serve it locally.
2. **Load Image** — Click "Upload Image" or drag & drop a file onto the canvas.
3. **Set Scale** — Enter the known length and unit, click "Set Scale", then click two points on a known reference (e.g. a scale bar in a microscope image).
4. **Draw Shapes** — Select a shape type (Ellipse / Rectangle / Polygon), click "Add Shape", then draw on the image.
5. **Read Results** — Areas are displayed in physical units (e.g. µm²) in the sidebar shape list.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected shape |
| `Escape` | Cancel current drawing / deselect |

## Use Cases

- **Microscopy** — Measure cell areas, grain boundaries, or particle sizes from SEM / TEM / optical micrographs.
- **Materials Science** — Quantify phase regions, coating cross-sections, or defect areas on wafer images.
- **Biology** — Measure tissue sections, colony areas, or wound healing regions.
- **Quality Inspection** — Calculate surface defect areas from inspection camera images.
- **Education** — Teach image-based measurement techniques without requiring commercial software licenses.

## Tech Stack

Pure HTML + CSS + JavaScript. [UTIF.js](https://github.com/nickyamanern/UTIF.js) is bundled locally for TIFF support. **Zero external requests** — works fully air-gapped out of the box.

## License

MIT
