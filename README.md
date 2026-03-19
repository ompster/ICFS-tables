# ICFS - Tables

**I Can't F***ing See** — because some tables are impossible to read.

Alternating row colours and hover highlighting for any HTML table. A lightweight Chrome/Edge extension that makes reading tables bearable.

## Why?

Built by someone with congenital nystagmus who was sick of losing their place in tables. If you've ever struggled to track a row across 15 columns of white-on-white nothing, this is for you.

Nystagmus, low vision, dyslexia, or just tired eyes — row differentiation shouldn't be optional. Web developers keep forgetting that, so here we are.

## Features

- 🦓 **Alternating row colours** on any HTML table
- 🖱️ **Hover highlighting** so you don't lose your place
- 🎨 **Custom colours** — pick your own or use presets (Blue, Green, Grey, Purple, High Contrast)
- 🌐 **Per-site settings** — different colours and toggle state for each site
- 📋 **Right-click context menu** — toggle stripes on individual tables
- ⚙️ **3 striping methods:**
  - **JS injection** (default) — walks the DOM and applies inline styles. Works on everything, including old ASP pages, iframes, and sites that fight back with inline styles
  - **CSS only** — lightweight nth-child selectors for well-behaved pages
  - **Auto** — tries CSS first, falls back to JS if needed
- 🖼️ **iframe/frame support** — works inside frames (looking at you, legacy enterprise apps)
- ♿ **Accessibility-first** — not a gimmick, a genuine tool for people who need it

## Install

1. Download or clone this repo
2. Go to `chrome://extensions` or `edge://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the extension folder

## Usage

- Click the extension icon to open the popup with all controls
<img width="250" height="433" alt="image" src="https://github.com/user-attachments/assets/a27f0a18-d765-4f9d-a440-5c1bb60793c9" />

- Right-click any table → **Toggle zebra stripes on this table**
<img width="467" height="233" alt="image" src="https://github.com/user-attachments/assets/b16da0d5-b74a-460c-ad73-e75a7f053af0" />

- Settings are saved per-site automatically

## License

MIT
