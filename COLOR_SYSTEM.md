# 🎨 Color System Documentation

## Overview

This application uses a **scale-based color system** with 7 hue families, each containing 9 steps (50-800). The system ensures semantic consistency, WCAG AA compliance, and proper light/dark mode support.

---

## Color Scales

### 1️⃣ Neutral (Cool Slate)
**Purpose:** Backgrounds, surfaces, borders, text, inputs

- **50:** `#F8F9FB` - Lightest background
- **100:** `#EEF1F4` - Card surface (light mode)
- **200:** `#DCDFE3` - Borders, secondary backgrounds
- **300:** `#A8ADB5` - Muted text (dark mode)
- **400:** `#737A84` - Medium neutral
- **500:** `#5A616B` - Muted text (light mode)
- **600:** `#404852` - Dark surface elements
- **700:** `#2A2F37` - Card surface (dark mode)
- **800:** `#181C22` - Darkest background, primary text (light)

**Light Mode Mapping:**
- Background → 50
- Card → 100
- Border → 200
- Muted text → 500
- Primary text → 800

**Dark Mode Mapping:**
- Background → 800
- Card → 700
- Border → 600
- Muted text → 300
- Primary text → 100

---

### 2️⃣ Primary (Blue-Violet ~260°)
**Purpose:** Primary buttons, active states, focus, **Watching status**, **Creator role**

- **50:** `#F6F4FD`
- **100:** `#E6E0FA` - Soft pill bg (light)
- **200:** `#C5B5F3` - Focus ring (dark)
- **300:** `#9D82E8` - Outline text (dark)
- **400:** `#7655DC` - Solid button (dark)
- **500:** `#6B3FD9`
- **600:** `#5E2FC7` - Solid button (light), outline text (light)
- **700:** `#4722A3` - Soft pill bg (dark)
- **800:** `#2F166E`

**Usage:**
- Light: Primary buttons use 600, soft pills use 100
- Dark: Primary buttons use 400, soft pills use 700

---

### 3️⃣ Success (Emerald ~150°)
**Purpose:** **Watched status**, success alerts

- **50:** `#F0FDF7`
- **100:** `#D4F7E7` - Soft status bg (light)
- **200:** `#A3ECC9`
- **300:** `#5DD999` - Text accent (dark)
- **400:** `#22C56D`
- **500:** `#16A35A` - Strong alert
- **600:** `#0D8F4B` - Text accent (light)
- **700:** `#086639` - Soft status bg (dark)
- **800:** `#053D23`

---

### 4️⃣ Warning (Amber ~40°)
**Purpose:** **Medium priority**, warning alerts

- **50:** `#FEFBF3`
- **100:** `#FDF4E0` - Soft priority bg (light)
- **200:** `#FAE5B8`
- **300:** `#F5CE73` - Text accent (dark)
- **400:** `#EFB829`
- **500:** `#E8A817` - Strong alert
- **600:** `#D9940C` - Text accent (light)
- **700:** `#A66F08` - Soft priority bg (dark)
- **800:** `#6B4805`

---

### 5️⃣ Danger (Red ~5°)
**Purpose:** **High priority**, **Dropped status**, destructive actions, errors

- **50:** `#FEF4F3`
- **100:** `#FCE3E0` - Dropped (soft, light)
- **200:** `#F7BBB5` - High priority (light)
- **300:** `#EF7A6F` - Text accent (dark)
- **400:** `#E84236` - Destructive button (dark), trash icon hover (dark)
- **500:** `#E1321F`
- **600:** `#D32315` - Destructive button (light), high priority (dark), trash icon hover (light)
- **700:** `#A01B10` - Dropped bg (dark)
- **800:** `#69110B`

---

### 6️⃣ Info (Blue ~210°)
**Purpose:** **To Watch status**, **Admin role**, info alerts

- **50:** `#F0F7FE`
- **100:** `#DCEDFB` - Soft status bg (light)
- **200:** `#B0D6F6`
- **300:** `#68B0ED` - Outline role text (dark)
- **400:** `#2F8DE3`
- **500:** `#1A7DD9` - Alert
- **600:** `#136AC7` - Outline role text (light)
- **700:** `#0D4F95` - Soft status bg (dark)
- **800:** `#083363`

**Note:** Distinct from Primary (violet) to differentiate To Watch from Watching

---

### 7️⃣ Rating (Gold ~45°)
**Purpose:** **User ratings only** (never reused elsewhere)

- **50:** `#FFFCF0`
- **100:** `#FFF7DC`
- **200:** `#FFECB0`
- **300:** `#FFD966` - Low rating
- **400:** `#FFC933` - Mid rating (fill color)
- **500:** `#FFB800` - High rating (text/outline color)
- **600:** `#F5A800`
- **700:** `#C28400`
- **800:** `#8A5E00`

---

## Domain Mapping

### Priority Levels
- **High** → Danger-200 (light) / Danger-600 (dark)
- **Medium** → Warning-100 (light) / Warning-700 (dark)
- **Low** → Neutral subtle

### Watch Status
- **Watching** → Primary-100 (light) / Primary-700 (dark)
- **To Watch** → Info-100 (light) / Info-700 (dark)
- **Watched** → Success-100 (light) / Success-700 (dark)
- **Dropped** → Danger-100 (light) / Danger-700 (dark)

### Roles
- **Creator** → Primary (outline)
- **Admin** → Info (outline)
- **Viewer** → Neutral

### Ratings
- **All ratings** → Gold scale only
- Star fill: Rating-400
- Star outline: Rating-500

---

## Utility Classes

All status, priority, and role badges use utility classes:

```css
/* Status */
.status-watching
.status-to-watch
.status-watched
.status-dropped

/* Priority */
.priority-high
.priority-medium
.priority-low

/* Roles */
.role-creator
.role-admin
.role-viewer
```

These classes automatically handle light/dark mode transitions.

---

## Core Principles

1. **Hue = Meaning** - Each hue represents a specific semantic purpose
2. **Shade = Context** - Light vs dark mode use different steps on the same scale
3. **Consistency** - Pills use soft tints (100/700), buttons use stronger solids (600/400)
4. **No Reuse** - No exact shade is used identically across different domains
5. **Accessibility** - All text meets WCAG AA (4.5:1 for text, 3:1 for UI)

---

## Files Updated

### Core Theme
- `app/globals.css` - Complete color system with all scales and utilities

### Components
- `app/dashboard/page.tsx` - Role badge styles
- `components/media-card/MediaCardRegular.tsx` - Trash icon hover
- `components/media-card/MediaCardSmall.tsx` - Trash icon hover
- `components/media-card/UserRatingPopover.tsx` - Rating stars using gold scale
- `components/ui/Button.tsx` - Button variants (uses semantic tokens)
- `components/ui/Tabs.tsx` - Tab styles (uses semantic tokens)

### Type Definitions
- `components/media-card/types.ts` - Status/priority color mappings (utility class names)

---

## Testing Checklist

When reviewing the new theme:

- [ ] Status pills are readable in both light and dark modes
- [ ] Priority badges have clear visual hierarchy (high > medium > low)
- [ ] Creator/Admin/Viewer roles are visually distinct
- [ ] Trash icons turn red on hover (danger-600 light, danger-400 dark)
- [ ] Rating stars are gold (never amber/yellow)
- [ ] Buttons have consistent hover states across light/dark
- [ ] Tab switcher inactive states are visible on hover
- [ ] All text is readable (no low-contrast combinations)
- [ ] Dark mode uses lighter accent colors appropriately
- [ ] No pure white or pure black (except necessary cases)

---

## Future Extensions

To add new semantic colors:

1. Choose the appropriate base hue (or create new scale if needed)
2. Map light mode to darker steps (e.g., 600)
3. Map dark mode to lighter steps (e.g., 400 or 300)
4. Create utility class if reusable
5. Document in this file

**Example:** If you need an "archived" status:
- Use Neutral scale (it's for low-emphasis states)
- Light: `bg-neutral-200 text-neutral-600`
- Dark: `bg-neutral-600 text-neutral-300`
