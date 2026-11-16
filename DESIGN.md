---
version: alpha
name: Notion Analysis — LowEndAFF
description: Notion's warm, paper-calm productivity design language adapted for LowEndAFF — built on a warm off-white canvas (#f6f5f4) and deep ink-grey dark mode (#191919), near-black Inter + Noto Sans SC typography, a single confident Notion blue (#0075de), unified sm/md/lg component sizing and 6px/8px/12px/full radii, zero-displacement transitions, and harmonious callout-style commercial placements.

colors:
  primary: '#0075de'
  primary-active: '#005bab'
  secondary: '#213183'
  on-primary: '#ffffff'
  canvas: '#ffffff'
  canvas-soft: '#f6f5f4'
  surface: '#ffffff'
  subtle: '#f0efed'
  ink: '#191918'
  ink-secondary: '#31302e'
  ink-muted: '#615d59'
  ink-faint: '#a39e98'
  hairline: '#e6e6e6'
  accent-sky: '#62aef0'
  accent-purple: '#d6b6f6'
  accent-purple-deep: '#391c57'
  accent-pink: '#ff64c8'
  accent-orange: '#dd5b00'
  accent-orange-deep: '#793400'
  accent-teal: '#2a9d99'
  accent-green: '#1aae39'
  accent-brown: '#523410'
  accent-red: '#e03e3e'
  night-canvas: '#191919'
  night-surface: '#202020'
  night-raised: '#252525'
  night-subtle: '#2a2a2a'
  night-ink: '#f0efed'
  night-ink-secondary: '#c7c5c1'
  night-ink-muted: '#9b9a97'
  night-ink-faint: '#6e6d6a'
  night-primary: '#3392ff'
  night-primary-active: '#0075de'
  night-hairline: '#2f2f2f'

typography:
  display-1:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -2.125px
  display-2:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 54px
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: -1.875px
  heading-1:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: clamp(30px, 3vw, 40px)
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: -0.025em
  heading-2:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: -0.015em
  heading-3:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 20px
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: -0.01em
  title:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: -0.008em
  reading:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 16.5px
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0.01em
  body-md:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0
  body-sm:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  eyebrow:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.02em
  data:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 28px
  xxl: 32px

sizes:
  control-sm:
    height: 26px
    padding: 4px 10px
    fontSize: 12px
    rounded: '{rounded.sm}'
  control-md:
    minHeight: 44px
    padding: 10px 16px
    fontSize: 14px
    rounded: '{rounded.md}'
  control-lg:
    minHeight: 48px
    padding: 12px 20px
    fontSize: 15px
    rounded: '{rounded.md}'
  card-sm:
    padding: 12px
    rounded: '{rounded.md}'
  card-md:
    padding: 16px
    rounded: '{rounded.lg}'
  card-lg:
    padding: 24px
    rounded: '{rounded.lg}'

components:
  nav-bar:
    backgroundColor: '{colors.canvas-soft}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    padding: 16px
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 10px 16px
  button-primary-pressed:
    backgroundColor: '{colors.primary-active}'
    textColor: '{colors.on-primary}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 10px 16px
  button-utility:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 10px 16px
  button-icon:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    width: 44px
    height: 44px
  badge-pill:
    backgroundColor: '{colors.subtle}'
    textColor: '{colors.ink-secondary}'
    typography: '{typography.eyebrow}'
    rounded: '{rounded.sm}'
    padding: 4px 10px
  feature-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.lg}'
    padding: 24px
  tag-filter:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: 10px 16px
  tag-filter-selected:
    backgroundColor: '#ebf5fe'
    textColor: '{colors.primary}'
    rounded: '{rounded.md}'
    padding: 10px 16px
  notion-view-tabs:
    backgroundColor: transparent
    borderBottom: '1px solid {colors.hairline}'
    padding: 0
    width: 100%
  route-picker:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: 12px 16px
    width: 100%
  footer:
    backgroundColor: '{colors.canvas-soft}'
    textColor: '{colors.ink-secondary}'
    typography: '{typography.caption}'
    padding: 32px
---

# Design System: Notion Analysis — LowEndAFF

## Overview

Notion looks like a well-organized desk in good daylight. The dominant surface is not pure clinical white but a warm, paper-soft off-white — `{colors.canvas-soft}` (`#f6f5f4`) in light mode and warm ink-grey `{colors.night-canvas}` (`#191919`) in dark mode — that takes the clinical edge off the screen and makes long VPS/server benchmark pages feel like a calm, authoritative technical document.

Type is set in `Inter Variable` paired with `PingFang SC` / `Noto Sans SC Variable` in near-black `{colors.ink}` (`#191918`) at confident weights for headings, while Chinese-English mixed body copy uses a relaxed `1.85` line height and neutral tracking for effortless reading. The chrome whispers in warm greys and hairlines (`#e6e6e6` / `#2f2f2f`), reserving a single structural accent — Notion Blue (`#0075de` in light mode, `#3392ff` in dark mode) — for primary actions, inline links, active states, and focus rings.

Notion's **multi-colour sticker palette** (`{colors.accent-orange}`, `{colors.accent-teal}`, `{colors.accent-green}`, `{colors.accent-sky}`, `{colors.accent-purple}`) carries status semantics and sponsor brand accents without overpowering the document surface.

**Key Characteristics:**
- Warm paper-soft canvas (`#f6f5f4`) with pure white (`#ffffff`) cards and tables for gentle figure/ground contrast; warm charcoal (`#191919` / `#202020`) in dark mode.
- Unified component sizing (`sm` / `md` / `lg`) and strict border-radius tokens (`6px` / `8px` / `12px` / `9999px`) with zero arbitrary radii.
- Smooth color, border, and opacity transitions (`180ms cubic-bezier(0.16, 1, 0.3, 1)`) with **zero element displacement (`transform: none`)** and **zero shadow mutation** on hover, focus, or active states.
- Callout-inspired commercial placements that are immediately scannable by readers yet blend naturally into the document rhythm.
- CJK + Latin mixed typography and framed media wells optimized for reading technical benchmarks, routing tables, and BGP topology charts.

---

## Colors

### Brand & Structural Accent
- **Notion Blue** (`--accent`: `#0075de` light / `#3392ff` dark): The single structural accent used for primary CTAs, links, selected filters, and `:focus-visible` outlines.
- **Pressed Blue** (`--accent-active`: `#005bab` light / `#0075de` dark): Active/pressed fill for primary actions.
- **Soft Blue Tint** (`--accent-soft`: `#ebf5fe` light / `rgba(51, 146, 255, 0.14)` dark): Selected chip/tab highlight and callout tint.

### Surface & Neutral Hierarchy
- **Canvas** (`--canvas`: `#f6f5f4` light / `#191919` dark): Warm paper page background.
- **Surface** (`--surface`: `#ffffff` light / `#202020` dark): Card, table, and control surface.
- **Raised** (`--raised`: `#ffffff` light / `#252525` dark): Popovers, dropdown menus, tooltips, and dialogs.
- **Subtle** (`--subtle`: `#f0efed` light / `#2a2a2a` dark): Segmented control tracks, table headers, code blocks, and muted badges.
- **Hairline Border** (`--border`: `#e6e6e6` light / `#2f2f2f` dark): 1px structural divider and card border.

### Text Hierarchy
- **Ink** (`--text`: `#191918` light / `#f0efed` dark): Headings, primary labels, and key values.
- **Warm Charcoal** (`--text-secondary`: `#31302e` light / `#c7c5c1` dark): Long-form article prose.
- **Stone** (`--muted`: `#615d59` light / `#9b9a97` dark): Secondary descriptions, captions, table headers, and metadata.
- **Ash** (`--faint`: `#a39e98` light / `#6e6d6a` dark): Subtle hints, separators, and disabled text.

### Sticker & Semantic Palette
- **Green** (`--success`: `#1aae39` light / `#32c759` dark): Normal/unlocked status and terminal indicator.
- **Orange** (`--warning` / `--brand-orange`: `#dd5b00` light / `#ffa344` dark): Warning status and warm sponsor accent.
- **Teal** (`--brand-teal`: `#2a9d99` light / `#4dab9a` dark): Teal sponsor accent.
- **Red** (`--danger`: `#e03e3e` light / `#ff7369` dark): Error/blocked status.

---

## Typography & CJK-Latin Optimization

### Font Stack
- **Sans-serif (UI & Reading)**: `'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC Variable', 'Microsoft YaHei', sans-serif`
- **Monospace (Benchmarks, Tables, Terminals, Prices)**: `'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace` with `font-variant-numeric: tabular-nums`.

### CJK & English Reading Rules
1. **Separate Tracking for Headings vs Chinese Prose**: Display and section headings use tight negative tracking (`-0.025em` to `-0.01em`) at weight `650–700`, while Chinese long-form paragraphs (`.prose`, `.archive-prose`) use `16.5px` (`16px` on mobile), `line-height: 1.85`, `letter-spacing: 0.01em`, and `max-width: 68ch` so dense Chinese characters breathe comfortably alongside inline English identifiers.
2. **Line-Break & Mixed-Script Spacing**: Apply `line-break: strict`, `word-break: normal`, `overflow-wrap: anywhere`, and progressive `text-autospace: normal` so Chinese punctuation never orphans at line start and long IPv6/ASN/hostname strings wrap cleanly without horizontal page overflow.
3. **Evidence Alignment**: All article data tables keep headers and cells left-aligned (`text-align: left`) with tabular monospace numerals.

---

## Unified Shapes & Component Sizing (`sm / md / lg`)

### Border Radius Scale
Every component in the project uses one of four radius tokens:
- `--radius-sm` (`6px`): Inline tags (`.tag`, `.review-type-label`), segmented control inner buttons, combobox/dropdown menu options, inline code chips.
- `--radius-md` (`8px`): Standard buttons (`.button`), tag-cloud filter buttons, segmented control outer tracks (`padding: 4px` + `6px` inner button = concentric), route picker triggers, data table frames, article image frames.
- `--radius-lg` (`12px`): Cards and panels (`.panel`, `.spec-card`, `.promo-card`, `.placement-card`, `.terminal`, ad cards, dropdown menus, tooltips, map workspace and dialog).
- `--radius-full` (`9999px`): Status dots and circular indicators.

### Standard Component Size Scale
- **Small (`sm`)**: `font-size: 12px`, `line-height: 1.4`, `padding: 4px 10px`, `border-radius: var(--radius-sm)` (`6px`). Used for non-interactive status pills, `.tag`, `.review-type-label`, and inline metadata badges (interactive small controls maintain a `44px` minimum hit target).
- **Medium (`md`)**: `min-height: 44px`, `padding: 10px 16px`, `font-size: 14px`, `font-weight: 500`, `border-radius: var(--radius-md)` (`8px`). Used for `.button` (primary & secondary), pagination buttons, `.tag-cloud button`, `.notion-view-tabs` items, `.tag-tabs button`, `.review-tablist button`, `.bgp-tabs button`, `.atlas-type-filter button`, and `44×44px` `.icon-button`.
- **Large (`lg`)**: `min-height: 48px`, `padding: 12px 20px`, `font-size: 15px`, `font-weight: 500`, `border-radius: var(--radius-md)` (`8px`). Used for hero/marketing CTAs, `.route-picker-trigger`, and `.friend-button` rows.
- **Card Padding Scale**: `sm` (`12px`), `md` (`16px`), `lg` (`24px`).

---

## Elevation & Motion (Zero Displacement, Constant Shadow)

### Elevation Levels
- **Level 0 — Flat Hairline**: `background: var(--surface); border: 1px solid var(--border); box-shadow: none;` — Default cards, tables, terminals, and spec panels.
- **Level 1 — Micro-Shadow (`--shadow-sm`)**: Notion's layered near-transparent shadow (`0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.04)`) — Active segmented control pill and floating controls.
- **Level 2 — Floating Overlay (`--shadow-md`)**: (`0 4px 12px rgba(0, 0, 0, 0.06), 0 16px 36px rgba(0, 0, 0, 0.08)`) — Dropdown menus (`.theme-options`, `.mobile-nav nav`, `.route-picker-list`), tooltips (`.heading-tooltip`), and dialogs (`.atlas-directory`).

### Transition & Interaction Rules
- **Transition Token**: `--transition-base: 180ms cubic-bezier(0.16, 1, 0.3, 1)`.
- **No Element Displacement**: Interactive elements and their child icons never use `transform: translate*()` or `scale()` on `:hover`, `:focus-visible`, or `:active`.
- **No Shadow Mutation**: `box-shadow` remains constant across default, hover, and focus states. State feedback is communicated strictly through smooth transitions of `background-color`, `border-color`, `color`, and `opacity`.

---

## Advertising & Media Wells

### Notion Solid-Surface Advertising Slots
1. **Pure Solid Surface & Uniform 1px Hairline**: Homepage (`HomeAds`), article top/bottom (`ArticleTopAds` / `ArticleBottomAds`), and article sidebar (`ArticleSidebarAds`) cards sit on solid `--surface` (`#ffffff` in light mode, `#202020` in dark mode) with a uniform `1px solid var(--border)` hairline frame and `--radius-lg` (`12px`). **Gradients and thick left side borders are strictly forbidden.**
2. **Coherent Notion Sticker Brand Badges**:
   - Merchant brand identity uses Notion's sticker palette (`#0075de` blue, `#dd5b00` orange, `#2a9d99` teal, `#31302e` charcoal) strictly as a compact solid badge pill or dot inside the card.
   - Hovering over a secondary button or card darkens the neutral surface and neutral border (`--subtle` / `--border-strong`), never mixing a grey fill with a blue border.
   - All UI icons across the project use Iconify `@iconify-json/mingcute` (`*-line` icons) exclusively, all country flags use `@iconify-json/flagpack` SVG vectors, and custom-authored SVG illustrations are prohibited.
3. **First-Screen Partner Bento Stack**: Homepage sponsors (`HomeAds`) render as a non-carousel solid-surface partner stack visible above the fold alongside the primary blog reading stream.

### Image & BGP Media Wells
- Benchmark screenshots and BGP topology images (`.archive-image`) sit inside a dedicated Notion media well (`background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px;`), ensuring crisp contrast in both light and dark modes, paired with a clean caption bar.
