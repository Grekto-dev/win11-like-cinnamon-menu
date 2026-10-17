# Win11-Like CInnamon Menu

The applet keeps its original internal identifier, `win11-menu@cinnamon`, so existing installations and settings remain compatible.

A modern desktop applet for the **Cinnamon Desktop Environment** (Linux Mint and other distributions) that faithfully recreates the **Windows 11 Start Menu and Taskbar Search**, while adhering to your active Cinnamon theme and keeping the official Linux Mint identity.

---

## ✨ Features

- **Windows 11 Start Menu Design & Geometry**:
  - Centered popup window with rounded cards, padding, and smooth transition animations.
  - Preserves your active Cinnamon theme's colors, dark/light mode, and accent tones.
  - **Fixed, screen-proportional size**: the popup is always 43.4 % × 80.2 % of the monitor (834×866 on 1920×1080, measured from a Windows 11 reference, see [docs/menu-proportions.md](docs/menu-proportions.md)), at any resolution and UI scale; it is clamped to the work area and cannot be resized. Previously saved sizes are ignored.
  - **Configurable Start button icon**: Linux Mint logo by default; the setting opens Cinnamon's icon chooser, which accepts any themed icon name or image file.
  - **Icon size modes**: *Small* (32px icons, 8 columns), *Medium* (40px, 7 columns) or *Large* (48px, 6 columns).
  - **Footer shortcuts** (left to right): Documents, Downloads, Music, Pictures, Videos, Network, Personal folder, File Explorer, Settings, and the always-present Power button. Each one (except Power) can be toggled in *Layout options → Folders*.
  - **Any panel position**: with the panel on the bottom the menus open above it; on top they open below it; on a vertical panel on the left they open to its right, and on the right they open to its left (12 px gap, scaled). In vertical panels the search box is not available (its option is greyed out in the settings window): the icon + label button is shown stacked, with upright letters arranged from top to bottom and centred across the bar. The extra spacing follows the panel axis: horizontal on top/bottom, vertical on left/right, applied equally before and after Search.
  - **Taskbar search**: hidden, icon only, icon + label, or a real *search box* (about 4.9x the panel thickness wide). The box is inactive until clicked; the text typed in it and in the menu's search field mirror each other.
  - **All apps view**: *List*, *Grid* or *Category* (tiles with a 2×2 preview of each system menu category; click a preview icon to launch it, click the tile to open the category). Pick it from the *View:* dropdown.
  - **Sections**: *All*, recently added apps and recent files can be shown or hidden independently (*Layout options → Recent* / *All*). The recent-files toggle is a placeholder for a later design.

- **Pinned Applications (8-column grid in Standard mode, 6 in Large)**:
  - **Drag and Drop**: Reorder pinned apps with smooth auto-arranging animations.
  - **Folder Creation**: Hold an app over another icon briefly, then drop to create a folder with a 2x2 miniature preview. Quick passes do not create folders accidentally.
  - **Explicit Opening & Rename**: A new folder stays closed. Click it to open; click its title to rename. Clicking outside confirms the name and closes only the folder.
  - **Folder Overlay Modal**: Open folders in an animated centered card, reorder inside, or drag items onto the desired pinned-grid position. Single-app folders remain open; extracting the last app removes the empty folder.
  - **Cancellable Drag & Drop**: Press Escape to restore the original order without saving a cancelled drag. Preview and compaction animations respect the animation preference.
  - Interaction reference and validation criteria: [Start-menu video reference](docs/start-menu-video-reference.md).

- **Recommended & Recent Items**:
  - 2x3 grid displaying recent documents and applications with human-readable relative timestamps (*"Just now"*, *"10m ago"*, etc.).
  - Right-click context actions (open, remove from list, pin to start).
  - *"Show all >"* subview for browsing full recent history.

- **All Applications**:
  - Alphabetical index list with jumper grid (`#`, `A` to `Z`).
  - View switcher supporting **List**, **Grid**, and **Categories** modes.

- **Taskbar Search Button & Search View**:
  - Optional search button on the taskbar with two selectable styles:
    1. **Windows 11 Pill Style**: Rounded pill shape with magnifying glass icon and localized label (`"Search"` / `"Pesquisar"`).
    2. **Icon Only**: Minimalist magnifying glass icon.
  - **Search Home View**:
    - **Left column**: Recent search queries and files with quick removal.
    - **Right column**: Quick search chips (*Focus settings*, *Sound*, *Bluetooth*, *Themes*, etc.) and Top Apps.
  - Full unified search powered by Cinnamon's search engine (fuzzy matching for apps, settings, recent documents, and search providers).

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
