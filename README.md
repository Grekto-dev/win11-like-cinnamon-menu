# Windows 11 Menu & Search Applet for Cinnamon (`win11-menu@cinnamon`)

A modern desktop applet for the **Cinnamon Desktop Environment** (Linux Mint and other distributions) that faithfully recreates the **Windows 11 Start Menu and Taskbar Search**, while adhering to your active Cinnamon theme and keeping the official Linux Mint identity.

---

## ✨ Features

- **Windows 11 Start Menu Design & Geometry**:
  - Centered popup window with rounded cards, padding, and smooth transition animations.
  - Preserves your active Cinnamon theme's colors, dark/light mode, and accent tones.
  - Official **Linux Mint logo** menu icon by default (`linuxmint-logo-ring-symbolic`), with an integrated icon picker for all official Mint emblems.

- **Pinned Applications (8-Column Grid)**:
  - **Drag and Drop**: Reorder pinned apps with smooth auto-arranging animations.
  - **Folder Creation**: Dragging an app over another creates a folder card with 2x2 miniature icon previews.
  - **Instant Rename Mode**: Newly created folders open immediately in rename mode with `"Nova Pasta"` (or `"New folder"`) pre-selected for quick naming.
  - **Folder Overlay Modal**: Open folders in a centered card view, reorder inside, or drag items back out to unpack.

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
git clone https://github.com/Grekto-dev/win11-menu.git ~/.local/share/cinnamon/applets/win11-menu@cinnamon
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
2. Under the **"Manage"** tab, locate **"Windows 11 Menu & Search"**.
3. Select it and click the **"+"** button to add it to your panel.
4. Click the gear icon next to the applet or right-click the panel icon and choose **"Configure..."** to customize:
   - Language (English or PT-BR)
   - Taskbar Search button visibility and style (Pill or Icon)
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
