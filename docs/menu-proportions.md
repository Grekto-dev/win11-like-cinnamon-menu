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

The visible setting is **Menu size / Tamanho do menu**. Its values are `small`, `medium`, `large`. Every profile uses the same **32 logical px application icon at reference scale**, 42-stage-pixel icon box, 82 px app-cell height, and 82 × 86 px folder cells. Changing the menu size changes outer bounds and app columns, not the icon-size preset or theme font. Folder grids retain four columns. Existing scrolling and lazy app-list materialization handle the different viewport sizes.

`Win11MenuApplet.MENU_SIZES` holds each profile's bounds, grid width and columns. `MENU_REF` holds the 1920×1080 reference screen, common icon/cell metrics and 12 px gap. Unknown/missing profiles fall back to Large.

## Uniform monitor scaling and native theme chrome

For selected reference bounds `W × H`, monitor `MW × MH`, work area `AW × AH`, and shell UI scale `U`:

```text
margin = 20 × U
scale = min(MW / 1920, MH / 1080,
            max(1, AW − margin) / W, max(1, AH − margin) / H,
            max(1, AW − 1) / (W + 12), max(1, AH − 1) / (H + 12))
outer = floor(W × scale) × floor(H × scale)
panelGap = max(1, round(12 × scale))
```

One factor preserves each profile's aspect ratio at other resolutions and on ultrawide monitors. Work-area limits reserve both the UI margin and the scaled panel gap, with a one-pixel rounding guard; the gap can exceed the fixed margin at high stage scales. The same clamp supports panels on all four sides and secondary-monitor offsets. Panel thickness affects the usable area, not the reference dimensions.

Monitor and actor dimensions are stage pixels: HiDPI is already represented in the monitor size. Icon textures and CSS lengths use `scale / U`, avoiding double scaling; fonts remain native and are not scaled by the profile. Native menu border/padding is subtracted from the outer allocation before sizing the root and content. App-grid width is bounded by both the profile grid width and content width minus the existing 26 logical px section padding on each side. Folder width also reserves the existing overlay/card padding. DND insertion, merge regions, animation coordinates, folder reorder, and category wrapping consume these same effective grid metrics.

The menu, root and main container keep fixed allocations; overflowing content scrolls rather than enlarging the popup. No arbitrary manual dimensions or resize handles are restored.

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
