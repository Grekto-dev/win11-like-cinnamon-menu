# Start menu size profiles (measured reference geometry)

Two private Windows 11 screenshots were measured at their full 1919×1079-pixel resolution, treated as captures of a nominal 1920×1080 monitor. Border coordinates below are inclusive; the images are not shipped or published.

| Profile | Capture suffix | Horizontal borders | Vertical borders | Outer bounds | App columns | Reference grid width |
|---|---|---|---|---|---|---|
| Small / Pequeno | `2026-10-17 232800.png` | x = 639 … 1280 | y = 294 … 1019 | 642 × 726 px | 6 | 570 px |
| Medium / Médio | Arithmetic midpoint, not a third capture | — | — | 738 × 796 px | 7 | 666 px |
| Large / Grande (default) | `2026-10-17 232729.png` | x = 543 … 1376 | y = 154 … 1019 | 834 × 866 px | 8 | 762 px |

Both measured menus are centred at x = 959.5. The taskbar's first row is y = 1031, and its captured height is 48 px. The menu's last border row is y = 1019: their row-coordinate difference is **12 px** (11 fully intervening rows). The applet uses a **12-stage-pixel gap** at reference scale; nominal 1080-pixel monitor/work-area coordinates may therefore differ from the cropped capture by one pixel. Grid widths are outer width minus 72 px of reference padding. Medium is exactly the midpoint of both outer dimensions, with seven columns.

Other measurements retained from the large reference: pinned row pitch 84 px; category tile 154 × 153 px with 29 px gaps; 2 × 2 category preview cells 68 × 68 px with approximately 36 px preview icons. The existing applet uses an 82 px app-cell height and native theme labels rather than imposing a screenshot font.

## Menu size, not icon size

The visible setting is **Menu size / Tamanho do menu**. Its values are `small`, `medium`, `large`, and `custom`. Every preset profile uses the same **32 logical px application icon at reference scale**, 42-stage-pixel icon box, 82 px app-cell height, and 82 × 86 px folder cells. Changing a preset menu size changes outer bounds and app columns, not the icon-size preset or theme font. Folder grids retain four columns. Existing scrolling and lazy app-list materialization handle the different viewport sizes.

`Win11MenuApplet.MENU_SIZES` holds each preset profile's bounds, grid width and columns. `MENU_REF` holds the 1920×1080 reference screen, common icon/cell metrics and 12 px gap. Unknown/missing profiles fall back to Large.

## Custom menu size mode, preset consistency, and live corner drag-resize

When `menu-size` is set to `custom` (`Custom / Personalizado`), both the Start Menu and the Search Menu share the user-configured outer dimensions (`custom-menu-width` and `custom-menu-height` in stage pixels), clamped between:
- **Minimum bounds**: the current monitor's `small` preset dimensions (`minWidth = small.width`, `minHeight = small.height`), ensuring the menu never shrinks below the compact layout or truncates controls.
- **Maximum bounds**: `min(round(MW × 0.75), round(1218 × screenScale), AW − margin)` horizontally and `min(round(MH × 0.88), round(980 × screenScale), AH − margin)` vertically, preventing the menu from covering the entire screen.

The custom layout profile (`_computeCustomLayoutProfile`) guarantees exact consistency with the presets:
- Whenever the custom width coincides with `Small` (6 columns), `Medium` (7 columns), or `Large` (8 columns), the column count and icon size (`32 px` reference) match that preset identically.
- Icons never grow past the preset maximum (`32 px` reference). As custom width increases past a preset's width, a new column (`cols + 1`) is added immediately and the icon size steps back to the minimum for that new column count (`32 × (cols − 1) / cols` reference px), growing smoothly back up to `32 px` at the next preset width, and continuing with the same `96 px × scale` column step beyond `Large` (9, 10, … columns).
- While `custom` is selected, a subtle grip handle appears in the top-right corner of the menu. Clicking and dragging that corner resizes the menu fluidly in real time (`_applyLiveResizeStep`) and streams the live dimensions to `~/.cache/win11-menu/live-size-<instance_id>.json` so an open settings window updates its width and height (`px`) spinbuttons dynamically as the user drags.

## Dynamic monitor scaling and native theme chrome

For selected reference bounds `W × H`, monitor `MW × MH`, work area `AW × AH`, and shell UI scale `U`:

```text
margin = 20 × U
rawScale = min(MW / 1920, MH / 1080)
subFhdExponent = ln(768 / 885) / ln(768 / 1080) ≈ 0.4159
screenScale = rawScale^subFhdExponent   (when rawScale < 1)
            = rawScale                  (when rawScale ≥ 1)
scale = min(screenScale,
            max(1, AW − margin) / W, max(1, AH − margin) / H,
            max(1, AW − 1) / (W + 12), max(1, AH − 1) / (H + 12))
outer = floor(W × scale) × floor(H × scale)
panelGap = max(1, round(12 × scale))
```

At `1920×1080` and above (`rawScale ≥ 1`), `screenScale` scales linearly with the monitor dimensions (`2560×1440`, `3840×2160`, ultrawide, etc.), and all list, recent, search, and preview-pane icons/typography scale proportionally via `logicalScale = scale / U`. Below `1920×1080` (`rawScale < 1`), `screenScale` follows a smooth power curve calibrated to the compact Windows 11 reference capture (`642×726 px` inside an `885 px`-tall screen, i.e., `82.03%` of screen height), producing `557×630 px` (`Small`), `640×690 px` (`Medium`), and work-area-clamped `Large` on `1366×768` rather than shrinking linearly. Work-area limits reserve both the UI margin and the scaled panel gap, with a one-pixel rounding guard; the gap can exceed the fixed margin at high stage scales. The same clamp supports panels on all four sides and secondary-monitor offsets. Panel thickness affects the usable area, not the reference dimensions.

Monitor and actor dimensions are stage pixels: HiDPI is already represented in the monitor size. Application icons retain their 32 logical px reference size (bounded only by the scaled icon box on tiny viewports) and scale with `scale / U` above 1080p, avoiding double scaling or sub-FHD icon truncation; tile labels preserve a readable minimum font size. Native menu border/padding is subtracted from the outer allocation before sizing the root and content. Section horizontal padding is applied on `.win11-section-box` (rather than the `StScrollable` box itself) so Clutter's `StBoxLayout` paint volume always covers the full scrollable width without right-edge scroll tearing. Folder width also reserves the existing overlay/card padding, and Search Home / Search Results dynamically proportion their left/right columns, Quick Search chips, Top App cards, and clipped preview pane to the effective content width. DND insertion, merge regions, animation coordinates, folder reorder, and category wrapping consume these same effective grid metrics.

The menu, root and main container keep fixed allocations; overflowing content scrolls rather than enlarging the popup.

## Backward-compatible migration

The old `icon-size-mode` key is retained as a hidden `generic` value, bound without a layout callback. The new `menu-size` key defaults to `large`. Sequential applet migration advances `settings-version` to **3**:

| Saved old icon mode | New menu size | Preserved app columns |
|---|---|---|
| `standard` (old Small) | `large` | 8 |
| `medium` | `medium` | 7 |
| `large` (old Large) | `small` | 6 |
| Missing/unknown | `large` | 8 |

Schema version default remains **1**, so configurations lacking a version still receive the existing version-2 search/recent migration before version 3. Version-2 configurations do not replay the older migration. Version 3 (or a future version) never remaps later choices. Legacy values, pins/folders, language, theme and panel icon are not rewritten. The GTK window edits only the new key through the existing debounced settings trigger. Live layout refresh is deferred until Cinnamon releases an active drag source, then applied once.

## Category view (All → View: Category)

Tiles come from the system menu tree (`AppUtils.getApps()`, the same source and ordering as Cinnamon's own menu). Each tile shows up to four apps in a 2 × 2 preview, with the category name underneath. Clicking a preview launches its app; clicking the tile border opens the category inline. Escape or Back returns. Tile geometry scales uniformly, and wrapping uses the selected profile's effective grid width rather than a fixed large-menu width.

## Verification boundaries

Fixture tests exercise all profiles, resolution/HiDPI scaling, clamping/gap reservation, native chrome, real app/folder tile allocations, DND metrics and deferred profile switches, sequential/idempotent migration, and both GTK translations. They use temporary settings/cache directories and no synthetic desktop input. Final Cinnamon actor measurements, screenshots, native typography and real-pointer interaction remain live validation tasks; no desktop reload or user configuration change is required by the fixture suite.
