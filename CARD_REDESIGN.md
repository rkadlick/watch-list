# Media Card Redesign Plan

## Goal

Separate browsing from managing. Cards should be fast to scan and still allow quick status edits, while deeper management (notes, tags, dates) lives behind an edit toggle. Mobile gets a proper list row layout.

---

## Phase 1 — Browse / Edit Split on Existing Small Card

**What changes:**
- Add an edit (pencil) icon button to the card header
- By default, the card is in **browse mode**: notes, tags, and start/finish dates are hidden. If notes or tags exist, show a small indicator icon so the user knows data is there.
- Clicking the edit icon switches the card to **edit mode** in-place: notes textarea, tag add/remove, date pickers expand below the existing content. A "Done" button (or clicking the edit icon again) collapses back to browse.
- The season accordion (Seasons tab) stays for now — it is only visible in edit mode. In browse mode the Seasons tab is hidden.
- No layout changes to the card grid yet.

**Review checkpoint:** Small mosaic cards are cleaner by default. Edit mode reveals the same fields as today, just behind a toggle.

---

## Phase 2 — Season Status Pills

**What changes:**
- Replace the season accordion in **browse mode** with a compact row of season pills.
- Each pill shows: season number + a status icon. Colors match the existing status color system.
  - `·` neutral/muted — To Watch
  - `▶` blue — Watching
  - `✓` green — Watched
  - `✗` red — Dropped
- Clicking/tapping a pill opens a small popover with the 4 status options (icon + label). Selecting one updates that season's status immediately.
- The full season accordion (with per-season notes, dates, ratings) moves into **edit mode** only, replacing the season pills when in edit mode.
- TV show overall status badge becomes **computed / read-only** in the card header — it derives from season statuses via the existing `calculateTVStatus` logic. Users can no longer manually set status for TV shows from the card header; they set it per season.
- Movies are unaffected — their status dropdown remains manual.

**Review checkpoint:** Season pills are visible and interactive in browse mode. Changing a season pill updates the main show status automatically. Edit mode still gives access to the full accordion.

---

## Phase 3 — List Row Layout (Mobile Default)

**What changes:**
- Add a new `"list"` card size/format: a full-width horizontal row, ~80px tall.
- Layout: small poster thumbnail (48×64px) on the left | title + year + type in the middle | status badge + user rating on the right | season pills below the title line for TV shows (compact, wrapping).
- On mobile (< 640px), the list row layout becomes the **default** view instead of the 2-column mosaic.
- Browse / edit split applies here too: tapping anywhere on the row (except interactive controls) toggles edit mode, which expands the row downward to show notes, tags, dates.
- The layout toggle in the toolbar gets a new "list" icon option alongside the existing mosaic/grid options.

**Review checkpoint:** Mobile shows a dense list. You can see 8–10 items at a glance. Season pills and status are still editable inline.

---

## Phase 4 — Polish Pass

**What changes (small items collected from phases 1–3):**
- Indicator icons for notes and tags in browse mode (show a small message/tag icon when data exists, rather than just hiding silently).
- Providers in browse mode: compressed to icons only with a `+N` overflow, no expand toggle needed since edit mode isn't for providers.
- Animate the browse → edit mode transition (smooth height expand).
- Keyboard accessibility: Escape closes edit mode, Enter confirms status pill selection.
- Any rough edges surfaced during review of phases 1–3.

**Review checkpoint:** Everything feels polished and intentional.

---

## Phase 5 — Large Single-Column Layout (Backlog)

**Status:** Deprioritized. Not starting until phases 1–4 are stable.

**What it would be:** A single wide card per row, full viewport width, for users who want a detailed log-style view. Uses the browse/edit split from phases 1–2. No accordion inline — detail in edit mode only.

---

## Branch Strategy

Each phase gets its own PR off a shared `card-redesign` base branch, or as sequential commits that you review before the next phase starts. Main is not touched until you sign off.

```
main
  └── card-redesign          ← base branch
        ├── phase-1/...      ← browse/edit split
        ├── phase-2/...      ← season pills
        ├── phase-3/...      ← list row layout
        └── phase-4/...      ← polish
```
