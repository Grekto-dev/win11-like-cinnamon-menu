# Start-menu interaction reference

Reference: user's local `Gravando 2026-10-17 015019.mp4`, 30.8 s, 930×946, 30 fps. Do not commit the video or extracted frames. This is a behavioral reference, not Microsoft source/assets.

## Observed sequence

- 0–8 s: drag an app across the pinned grid. Other tiles slide into the prospective insertion slots before release. A floating icon follows the pointer; labels don't duplicate underneath it. Grid order remains row-major.
- ~8–10 s: drop Paint onto Calculator's icon to create a folder. The target becomes a mini-icon folder and the vacated slot compacts. **The new folder stays closed**; do not automatically open it or select its name.
- ~11–12 s: click the folder to open a centered card over the still-visible pinned grid. The card expands/fades into place; the menu itself remains open.
- ~12–15 s: click the folder title explicitly to edit, select text, finish by clicking elsewhere. Outside the card dismisses the folder rather than requiring a separate rename-confirm click.
- ~16–18 s: outside click dismisses the folder; the root grid remains visible.
- ~19–23 s: open again, rearrange two items within the folder, then drag Paint out to an arbitrary root-grid slot. Root items make room and folder contents compact. **The card remains open with Calculator as its sole remaining item.**
- ~24–27 s: drag the final item out. Only now does the empty folder disappear and its card close. The final app lands in the selected root-grid position, not necessarily next to the old folder.
- ~28–30 s: normal root-grid reordering continues; displaced tiles glide to their new positions.

## Implementation acceptance criteria

1. Root reordering uses actual pointer coordinates with animated, stable insertion previews. Center-hover merging is intentional (short dwell); quick passes must not create folders accidentally. Timers must fire even with a stationary pointer and cancel on leave/drop/cancel.
2. Merge into app creates a closed named folder with 2×2 mini-icons; merge into existing folder appends once without duplicate IDs. No forced rename/open after drop.
3. Folder opens/closes with a short scale/opacity transition (tunable approximation from video, not claimed exact easing measurements). Respect `enable-animation`; disabled animations settle immediately.
4. Folder is centered, backdrop fills the menu, outside click (including when renaming) closes only the folder; Escape first dismisses the folder/rename, then menu as appropriate.
5. Folder reordering previews and commits the same sequence. Cancel restores the original layout and persists no change.
6. Drag a folder item onto any unobscured root-grid slot: preview insertion/merge, preserve drag source until DND completion, commit app extraction once, keep card and one-item folder open. Remove empty folder and close card only when the final app leaves. No app loss or duplication.
7. Retain current app/theme/spacing preferences and all existing pinned data. Back up config before live tests, restore it afterwards.
8. Destroy/reload/close cancels timers and transient animations/monitors. No dead actors, leaked grabs, ghost icons, or launches after a drag.
9. Automated behavior tests plus live synthetic mouse drags, readback of persisted lists, and visual/actor confirmation on the final reloaded code. Test animation enabled and disabled paths.

## Fidelity scope

Preserve Cinnamon theming, app icons, existing sizing and localization. Match the demonstrated interactions; do not copy Windows proprietary assets. The video does not establish exact easing curves or all edge cases, so animation constants must be described as approximations.

## Verification

- Automated: `node --check applet.js` and `node --test tests/*.test.js` (42 tests at implementation time).
- Live Cinnamon/X11: synthetic mouse drags verified root reorder; intentional folder creation without auto-opening; two successive internal reorders followed by reopen; Escape cancellation in both grids; all three apps extracted to selected root insertion gaps; a one-app folder kept open; empty-folder removal; outside click while renaming; transfer into another folder without duplicate apps; extraction with animations disabled.
- Live actor probes confirmed real `scale-x` transitions for opening/closing, full-menu backdrop allocation, and no remaining modal grab, drag monitor, or interaction timer after teardown. The original pinned configuration was restored and read back.
- Insertion preview uses a 75 ms dwell, tile motion about 150 ms, card open/close 170/140 ms. The initial intentional-merge dwell was 420 ms; the responsive-hover update below reduces it to 160 ms. These are tuned approximations of the supplied recording, not exact Windows animation curves.
- Live test screenshots were captured through FFmpeg X11 capture. `gnome-screenshot`'s flash overlay can steal the DND drop target, so it is unsuitable during an active drag.

## Responsive hover feedback

Pointer movement inside the same merge target or insertion slot preserves that intent's original deadline instead of cancelling/restarting it for every 8px movement. Moving to another target starts a new deadline; leaving a merge zone clears its highlight immediately. The stationary insertion snapshot is retained so tiles sliding under an unmoving pointer cannot accidentally become merge targets.

Regression tests use a virtual clock that honors real timeout deadlines, in addition to the original lifecycle fixtures. A live Cinnamon DND-controller replay with repeated in-target movement measured feedback at 756.27 ms before / 166.59 ms after on the secondary panel, and 163.69 ms after on the primary panel. These are callback/highlight-state timings, not a claim that the CSS color transition is instantaneous. The replay exercised real stage hit testing and actors, bypassed only physical input grabs, and did not inject X input or write fixture pins to user settings. Both runs created the folder and restored settings, pins, history and modal count.
