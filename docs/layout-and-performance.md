# Menu layout and opening performance

## Requested behavior

- No drag-to-resize or saved arbitrary popup dimensions. Derive fixed menu geometry from the monitor, using the selected profile, and clamp uniformly to the usable work area on every panel side.
- Use the two measured Windows 11 captures documented in [menu-proportions.md](menu-proportions.md): Small 642×726 / six app columns, Medium 738×796 / seven columns, Large 834×866 / eight columns, on a nominal 1920×1080 screen. Do not ship reference images as app assets.
- Expose **Menu size / Tamanho do menu**, not icon-size presets. All profiles use the same 32px reference application icons and native theme fonts. Recalculate hit targets, insertion slots, category wrapping and folder geometry from the effective grid metrics.
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

1. Fixed actual popup/root allocation (not only natural size) for all three menu-size profiles; uniform monitor scaling, native theme chrome, safe small-monitor/HiDPI clamps and the scaled panel gap. Scrolling content must not grow the root.
2. No resizer handlers, cursor or reset-size control. Legacy saved dimensions ignored.
3. Small/Medium/Large measured while open; profile switches retain pins/folders and all DND coordinate math, and defer a live reflow until the active drag source is released.
4. Themed and file icons applied through the settings UI update path; cancel/restore retains the user's choice.
5. All recent rows have equal column geometry with short and long data, with no horizontal overflow.
6. Real open benchmark using the identical before/after method; count actors and verify search/all-apps appear when needed, without per-open eager rebuilds or lost data.
7. Existing drag/folder regressions remain green and pass live checks in all three menu sizes; outside click/Escape close cleanly with no leftover grab or timers.
8. Restore every setting and pinned-item fixture after live testing.

## Historical performance results (before menu-size profiles)

Same machine and method as the baseline (menu animation disabled, `after-paint`, 12 samples):

- Recent second-column x offsets are identical in every row (`layout_manager.homogeneous` on each row; `St.BoxLayout` has no `homogeneous` property).
- Key focus no longer lands on the big menu actor: the popup manager's `grab_key_focus()` is redirected to the search `ClutterText`. Median open (warm): **461 ms → ~52 ms** first paint, **434 ms → ~23 ms** synchronous.
- Cold open right after loading the applet: **~700 ms → ~300 ms**. The *All* list (675 of the 1124 actors) is now created lazily per letter group when its slot nears the viewport; each slot reserves its height, so the scrollbar and the alphabet jumper keep working. Actors on a typical open: 827.
- 72 unit tests pass. The live drag/folder scenarios (7) pass in both icon modes, repeatedly.

Test-environment note: a stuck Electron tooltip window from another app can sit above the menu and swallow pointer events during XTest drags; check `global.get_window_actors()` for class-less windows before blaming the applet.

## Menu-size implementation and fixture validation

The new `menu-size` key has values `small|medium|large` and defaults to `large`. The old `icon-size-mode` is a hidden generic migration input. Sequential `settings-version` migration advances to 3, preserving the previous column count (`standard`→`large`, `medium`→`medium`, `large`→`small`) without replaying version-2 search/recent choices or altering pinned data. The schema version default stays 1 so unversioned old installations still migrate correctly.

Profiles share a uniform monitor/work-area scale; the panel gap is 12px at reference scale. Icons/CSS use logical scale while actor allocations use stage scale, and fonts remain native. Grid widths start at outer width minus 72px, then account for the actual native theme chrome and existing section padding. Categories use this effective grid width too. The settings callback uses the existing deferred-DND refresh path and existing lazy app-list/folder rendering; there is no eager-list or teardown rewrite.

Regression fixtures cover measured bounds, all three column counts with fixed icons, missing/unknown defaults, sequential/idempotent migration and user-data preservation, multiple resolutions and UI scales, all-side gap reservation, thick native chrome, real tile allocations, insertion/merge/cancellation, deferred profile switches, English/Portuguese labels and debounced writes of only the new key. These tests use temporary configuration/cache fixtures. Historical timing/live-DND results above are not a claim of new live-pointer verification.

## Integrated live validation: menu sizes, recent cache and filename search

Actual Cinnamon actor allocations on the 1920×1080, scale-1 monitor after reloading the integrated build:

| Profile | Popup size | App columns | Reference app icon |
|---|---|---:|---:|
| Small | 642×726 | 6 | 32 px |
| Medium | 738×796 | 7 | 32 px |
| Large | 834×866 | 8 | 32 px |

All three opens left the filesystem worker uncreated. Settings, pinned items, app-launch history and panel placement were restored/read back after testing. No synthetic desktop mouse/key input was used for these geometry/data checks; the DND regression suite passed, but the historical real-pointer suite above was not rerun in this task.

Using the same 12-open `after-paint` method immediately before and after menu-size/recent integration, the warm first-paint medians were **35.31 ms before / 37.07 ms after**; synchronous preparation medians were **9.26 / 10.64 ms**. These are warm, animation-disabled observations, not a promise of zero latency or a cold-start guarantee.

An actual menu query `relatorio` against an isolated three-file fixture returned two accented Portuguese filenames via the real GJS client and Python process. In a final run, result events arrived at **80.4 ms** and **94.1 ms**, before `done` at **141.4 ms**. Rapid query replacement kept only the latest matches; close/teardown restored the UI and modal count to zero. The worker's separate 50,001-file benchmark and scan scope are recorded in [file-search-engine.md](file-search-engine.md). User files were not recursively indexed by these validation fixtures.

After the independent review's privacy fix, **237 Node tests + 82 Python tests** passed. A live Cinnamon actor fixture invoked the recent-privacy callback without changing the system's global preference: history-only results were removed, a same-URI recent+favorite result retained its actor/selection/preview, and revoking the final history row cleared all four preview children and showed the empty state. No scan was started by revocation. Settings, pins, app-launch history and temporary method overrides were restored; modal count returned to zero. The final build loaded on both installed instances, all three menu sizes were measured again, and the new session-log interval had no JS errors. These are local validation results, not a claim about remote CI.

## Compact horizontal Start highlight

The supplied `antes.png` / `depois.png` panel crops are both 189×64. The reference changes only the Start-button background: its horizontal bounds move from x=14…67 (54 px) to x=19…62 (44 px). The 38×38 icon keeps the same bounds and Search does not move.

For horizontal panels, exchange up to 5 logical pixels of theme padding on each side for equal additional margin. This narrows the painted/hit area but preserves the outer applet's width, icon position and Search/neighbour spacing. Read the original theme after clearing the previous inline style, convert stage pixels by `ui_scale`, and clamp the exchange to available padding in compact themes. Top/bottom styling stays native; vertical panels retain their existing zero-padding behavior. Theme reads wait for stage attachment and the inset is recalculated on mapping/theme changes.

Live verification after reloading both installed instances measured:

| Panel height | Start before → after | Icon unchanged | Applet width unchanged |
|---:|---:|---:|---:|
| 47 px | 54 → 44 px | 38×38 px | 153 px |
| 40 px | 48 → 38 px | 32×32 px | 144 px |

Pixel scans reproduced the exact reference background bounds, x=14…67 → 19…62. Search allocations and icon positions were unchanged; settings, pins and app-launch history were preserved. No injected mouse/key input was used. Regression coverage includes repeated updates, asymmetric theme margins, compact themes, RTL, HiDPI and unattached actors; the full local suites passed 241 Node + 82 Python tests.
