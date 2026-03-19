# ICFS - Tables

**I Can't F***ing See** — because some tables are impossible to read.

Alternating row colours and hover highlighting for any HTML table. A lightweight Chrome/Edge extension that makes reading tables bearable.

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
- 🖼️ **iframe/frame support** — works inside frames (looking at you, Autotask)

## Install

1. Download or clone this repo
2. Go to `chrome://extensions` or `edge://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the extension folder

## Usage

- Click the extension icon to open the popup with all controls
- Right-click any table → **Toggle zebra stripes on this table**
- Settings are saved per-site automatically

## Why?

Because web developers keep building tables with zero visual distinction between rows and expecting humans to track data across 15 columns of white-on-white nothing.

## License

MIT
