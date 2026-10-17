# Start menu proportions (measured from a reference capture)

Reference: a Windows 11 Start menu screenshot, 1919×1079 px (a 1920×1080 monitor), measured by pixel analysis of the border lines (not by eye). The reference image itself is not shipped.

| Item | Measured | As fraction of the screen |
|---|---|---|
| Menu width (border to border) | 834 px (x = 543 … 1376) | 43.4 % of the width |
| Menu height | 866 px (y = 154 … 1019) | 80.2 % of the height |
| Horizontal position | centred (centre x = 959.5 of 960) | — |
| Gap above the taskbar | 12 px (menu bottom 1020, taskbar top 1032) | 1.1 % of the height |
| Taskbar height | 48 px | 4.4 % of the height |
| Pinned row pitch | 84 px | — |
| Category tile | 154 × 153 px, 29 px apart | — |
| Category preview cell | 68 × 68 px, 2 × 2, icons ≈ 36 px | — |

## How the applet uses it

`Win11MenuApplet.MENU_REF` holds `{screenW: 1920, screenH: 1080, width: 834, height: 866, gridWidth: 762, gap: 12}`.

`scale = min(monitor.width / 1920, monitor.height / 1080, (workArea.width − margin) / 834, (workArea.height − margin) / 866)`

The menu is `834·scale × 866·scale`, so it covers the same fraction of the screen at any resolution (1280×720, 2560×1440, 4K with or without UI scaling all give 43.4 % × 80.2 %). One uniform factor is used so the menu is never stretched on ultra-wide screens (it keeps the height fraction there), and the last two terms keep it inside the work area on very small screens. Panel thickness no longer changes the menu size. The pinned grid spans `762·scale` px (834 minus 72 px of padding), icon sizes and cell heights use the same factor, and the gap above the panel is `12·scale` px.

Monitor sizes are stage pixels, so HiDPI (`ui_scale`) is already included; icon textures use `scale / ui_scale` to avoid scaling them twice.

Font sizes come from the theme and are not scaled by this factor.

## Category view (All → View: Category)

Tiles come from the system menu tree (`AppUtils.getApps()`, the same source and ordering as Cinnamon's own menu). Each tile shows the first four apps of the category as a 2 × 2 preview with the category name under it. Clicking a preview icon launches that app; clicking the tile border opens the category inline (back button + app list; Escape or Back returns). Tile geometry scales with the menu factor.
