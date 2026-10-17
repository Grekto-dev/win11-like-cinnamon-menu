# Menu layout and opening performance

## Requested behavior

- No drag-to-resize or saved arbitrary popup dimensions. Derive fixed menu geometry from panel thickness and clamp uniformly to the current monitor's usable area.
- Use a Windows-like reference aspect ratio. The user-supplied image `feature_StartMenu_VP5-1066x600.avif` shows a six-column pinned grid; do not ship the image as an app asset.
- Standard retains the current 32px/8-column pinned layout at the baseline scale; Large uses larger icons and six columns. Recalculate hit targets, insertion slots and folder geometry, not just drawn icon size.
- Reuse the native Cinnamon icon chooser for the panel Start button, accepting themed names and local image paths. Preserve the existing selected icon.
- Recent rows use stable equal-width columns independent of title/subtitle length. All rows' second-column x coordinates must match, and long text must ellipsize rather than expanding the menu.
- Settings changes are live. Preserve the theme, pinned/folder data, keyboard and drag behavior.

## Baseline measurements

Measured on this user's running Cinnamon session before these changes, panel thickness 47px, scale 1, monitor 1920×1080. The benchmark opens with menu animation disabled to isolate preparation/render latency, waits for the stage's `after-paint`, closes, and repeats 12 times. These are observed timings on this machine, not a universal guarantee.

- Median time from `menu.open(false)` to first stage paint: **461.521ms**.
- Median synchronous `menu.open(false)` call: **434.558ms**.
- First measured open to paint: **495.007ms** (existing initialized applet; not process cold-start).
- Attached menu actors: **1124**; All-apps descendants **675**, Search-home descendants **106**, pinned grid **157**.
- Recent second-column left edges: **956, 965, 956px**; the middle row is displaced by 9px.

Deep profiling found native key-focus transitions dominate opening time; preferred-size computation itself took less than 0.01ms per measured call. A controlled experiment detaching the All-apps and Search-home descendant trees, preserving/restoring the original actors, reduced median first-paint latency to **165.1065ms**. Therefore optimize actor lifetime/attachment and invalidation, rather than claiming benefit from arbitrary timeout or animation removal.

## Validation requirements

1. Fixed actual popup/root allocation (not only natural size), proportional at several panel thicknesses and safely clamped on small monitors/HiDPI. Scrolling content must not grow the root.
2. No resizer handlers, cursor or reset-size control. Legacy saved dimensions ignored.
3. Default/large modes measured while open; mode switches retain pins and keep all DND coordinate math consistent.
4. Themed and file icons applied through the settings UI update path; cancel/restore retains the user's choice.
5. All recent rows have equal column geometry with short and long data, with no horizontal overflow.
6. Real open benchmark using the identical before/after method; count actors and verify search/all-apps appear when needed, without per-open eager rebuilds or lost data.
7. Existing drag/folder regressions remain green and pass live checks in both icon modes; outside click/Escape close cleanly with no leftover grab or timers.
8. Restore every setting and pinned-item fixture after live testing.

## Results after the changes

Same machine and method as the baseline (menu animation disabled, `after-paint`, 12 samples):

- Recent second-column x offsets are identical in every row (`layout_manager.homogeneous` on each row; `St.BoxLayout` has no `homogeneous` property).
- Key focus no longer lands on the big menu actor: the popup manager's `grab_key_focus()` is redirected to the search `ClutterText`. Median open (warm): **461 ms → ~52 ms** first paint, **434 ms → ~23 ms** synchronous.
- Cold open right after loading the applet: **~700 ms → ~300 ms**. The *All* list (675 of the 1124 actors) is now created lazily per letter group when its slot nears the viewport; each slot reserves its height, so the scrollbar and the alphabet jumper keep working. Actors on a typical open: 827.
- 72 unit tests pass. The live drag/folder scenarios (7) pass in both icon modes, repeatedly.

Test-environment note: a stuck Electron tooltip window from another app can sit above the menu and swallow pointer events during XTest drags; check `global.get_window_actors()` for class-less windows before blaming the applet.
