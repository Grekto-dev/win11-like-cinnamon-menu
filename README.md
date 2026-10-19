# Win11-Like Cinnamon Menu

The applet keeps its original internal identifier, `win11-menu@cinnamon`, so existing installations and settings remain compatible.

A modern desktop applet for the **Cinnamon Desktop Environment** (Linux Mint and other distributions) that faithfully recreates the **Windows 11 Start Menu and Taskbar Search**, while adhering to your active Cinnamon theme and keeping the official Linux Mint identity.

---

## ✨ Features

- **Windows 11 Start Menu Design & Geometry**:
  - Centered popup window with rounded cards, padding, and smooth transition animations.
  - Preserves your active Cinnamon theme's colors, dark/light mode, and accent tones.
  - **Screen-proportional menu sizes** measured from Windows 11 references: *Small* 642×726 / 6 columns, *Medium* 738×796 / 7 columns, *Large* 834×866 / 8 columns on 1920×1080. Each profile scales uniformly to the monitor and is clamped to its work area; no manual resizing. See [measured geometry and migration](docs/menu-proportions.md).
  - **Configurable Start button icon**: Linux Mint logo by default; the setting opens Cinnamon's icon chooser, which accepts any themed icon name or image file.
  - **Menu size / Tamanho do menu** changes the menu dimensions and column count, with consistent 32px reference app icons and native fonts. Saved old icon modes migrate by column count: old Large → Small, Medium → Medium, old Small → Large.
  - **Footer shortcuts** (left to right): Documents, Downloads, Music, Pictures, Videos, Network, Personal folder, File Explorer, Settings, and the always-present Power button. Each one (except Power) can be toggled in *Layout options → Folders*.
  - **Any panel position**: with the panel on the bottom the menus open above it; on top they open below it; on a vertical panel on the left they open to its right, and on the right they open to its left (12 px gap, scaled). In vertical panels the search box is not available (its option is greyed out in the settings window): the icon + label button is shown stacked, with upright letters arranged from top to bottom and centred across the bar. The extra spacing follows the panel axis: horizontal on top/bottom, vertical on left/right, applied equally before and after Search.
  - **Taskbar search**: hidden, icon only, icon + label, or a real *search box* (about 4.9x the panel thickness wide). The box is inactive until clicked; the text typed in it and in the menu's search field mirror each other.
  - **All apps view**: *List*, *Grid* or *Category* (tiles with a 2×2 preview of each system menu category; click a preview icon to launch it, click the tile to open the category). Pick it from the *View:* dropdown.
  - **Sections**: *All*, recently launched apps and recent files can be shown or hidden independently (*Layout options → Recent* / *All*). Recent files use actual file history and respect Cinnamon's system privacy setting without changing your applet switch.

- **Pinned Applications (6 / 7 / 8 columns in Small / Medium / Large)**:
  - **Drag and Drop**: Reorder pinned apps with smooth auto-arranging animations.
  - **Folder Creation**: Hold an app over another icon briefly, then drop to create a folder with a 2x2 miniature preview. Quick passes do not create folders accidentally.
  - **Explicit Opening & Rename**: A new folder stays closed. Click it to open; click its title to rename. Clicking outside confirms the name and closes only the folder.
  - **Folder Overlay Modal**: Open folders in an animated centered card, reorder inside, or drag items onto the desired pinned-grid position. Single-app folders remain open; extracting the last app removes the empty folder.
  - **Cancellable Drag & Drop**: Press Escape to restore the original order without saving a cancelled drag. Preview and compaction animations respect the animation preference.
  - Interaction reference and validation criteria: [Start-menu video reference](docs/start-menu-video-reference.md).

- **Recommended & Recent Items**:
  - 2x3 grid displaying recent documents and applications with human-readable relative timestamps (*"Just now"*, *"10m ago"*, etc.).
  - Actual app launch times and GTK recent-history timestamps are merged newest-first; no filler apps are added. The complete GTK recent history is validated asynchronously without reading file contents or blocking menu open/search on filesystem I/O.
  - Right-click a file to open it, open its containing folder, or remove it from history only (never delete the actual file). Application context menus retain their pinning actions.
  - *"Show all >"* subview shows full recent history with paths, relative timestamps, and an empty state. Missing, unreadable, private, hidden and duplicate files are excluded. Turning off system recent-file tracking immediately clears cached files from Recent and Search Home, while recent applications remain available.

- **All Applications**:
  - Alphabetical index list with jumper grid (`#`, `A` to `Z`).
  - View switcher supporting **List**, **Grid**, and **Categories** modes.

- **Taskbar Search Button & Search View**:
  - Four taskbar modes: hidden, icon only, icon + localized label, and a mirrored search box. Vertical bars use upright stacked letters instead of a text field.
  - **Search Home View**:
    - **Left column**: Recent search queries and files with quick removal.
    - **Right column**: Quick search chips (*Focus settings*, *Sound*, *Bluetooth*, *Themes*, etc.) and Top Apps.
  - Application/settings matching stays in Cinnamon; filename lookup runs in a separate Python process with a persistent, local SQLite name index. Results are appended as found, without rebuilding existing rows or waiting for a full scan. Changing the query or closing the menu cancels old delivery; keyboard selection is preserved.
  - The **Files / Arquivos** filter searches names (not contents) across accessible local filesystem locations, including local mounted drives. It needs no root permissions and uploads nothing. Virtual filesystems, network mounts and cache/generated internals are excluded; see [engine scope, privacy and performance](docs/file-search-engine.md). The first scan builds the index progressively; later searches reuse it. At most 80 filesystem matches are displayed per query; refine the terms when the limit is reached.

- **Bottom Toolbar**:
  - User profile picture and username.
  - Quick access folder shortcuts (Settings, File Explorer, Downloads, Documents, etc.).
  - Windows 11 power menu (Shut down, Restart, Sleep, Lock, Sign out).

- **Multi-language Support (i18n)**:
  - **English** (default)
  - **Português (Brasil) - PT-BR**

---

## 🚀 Installation

### Option 1: Git Clone (Recommended)

Run the following command in your terminal:

```bash
git clone https://github.com/Grekto-dev/win11-like-cinnamon-menu.git ~/.local/share/cinnamon/applets/win11-menu@cinnamon
```

### Option 2: Manual Installation

1. Download or clone this repository.
2. Copy the folder contents into:
   ```
   ~/.local/share/cinnamon/applets/win11-menu@cinnamon/
   ```
3. Restart Cinnamon (`Alt + F2`, type `r`, and press `Enter`) or log out and back in.

---

## ⚙️ Enabling & Configuring the Applet

1. Right-click on your Cinnamon panel and click **"Applets"** (or open *System Settings -> Applets*).
2. Under the **"Manage"** tab, locate **"Win11-Like CInnamon Menu"**.
3. Select it and click the **"+"** button to add it to your panel.
4. Click the gear icon next to the applet or right-click the panel icon and choose **"Configure..."** to customize:
   - Language (English or PT-BR)
   - Menu size (Small / Medium / Large)
   - Taskbar Search button visibility and style (Pill or Icon)
   - Extra spacing on both sides of Search (0–24 px): one value adds the same gap between Menu/Search and Search/the next applet, applied immediately. Zero keeps the original minimum spacing.
   - Panel icon and label
   - Footer shortcuts and behavioral options

---

## 🛠️ File Structure

- `metadata.json`: Applet definition, UUID, and Cinnamon compatibility metadata.
- `settings-schema.json`: Preferences schema with language, search styles, and customization options.
- `stylesheet.css`: Styling for Windows 11 geometries, cards, pills, and animations, inheriting Cinnamon theme colors.
- `applet.js`: Core applet implementation (menu layout, DND grid, folders, search engine, recents, footer).
- `appUtils.js`: String normalization, fuzzy search, and application category helpers.

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) — see the [LICENSE](LICENSE) file for details.


## Settings window

*Configure…* opens a standalone GTK window (`win11-menu-settings.py`, one per panel instance) with **Language**, **Layout options** (with *Folders* and *Recent* sub-pages) and **Behavior**. Every page scrolls, so nothing is hidden in a small window. Texts appear in one language at a time and switch immediately when you change the language; the Start menu and search language only change when you press **OK**. All other settings apply live. The window writes the instance's Cinnamon settings JSON and touches a trigger file in `~/.cache/win11-menu/`, which the applet watches. If the script is missing, Cinnamon's native settings page is used as a fallback.
