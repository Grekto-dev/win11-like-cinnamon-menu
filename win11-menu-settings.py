#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# win11-menu settings window
# Copyright (C) 2026 win11-menu contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""GTK3 settings window for the win11-menu Cinnamon applet.

Reads and writes the applet's Cinnamon spices JSON (only the "value" field of
existing keys) and pokes the running applet through small trigger files in a
cache directory.  Run with /usr/bin/python3 --instance-id N.
"""

import argparse
import json
import os
import sys
import tempfile
import time

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gio, GLib, Gtk, Pango  # noqa: E402

try:
    gi.require_version("XApp", "1.0")
    from gi.repository import XApp  # noqa: E402
except (ValueError, ImportError):
    XApp = None

UUID = "win11-menu@cinnamon"
DEFAULT_SPICES_DIR = os.path.expanduser("~/.config/cinnamon/spices/" + UUID)
DEFAULT_CACHE_DIR = os.path.expanduser("~/.cache/win11-menu")

I18N = {
    "en": {
        "window_title": "Start menu settings",
        "page_language": "Language",
        "page_layout": "Layout options",
        "page_behavior": "Behavior",
        "ok": "OK",
        "back": "Back",
        "language_label": "Language",
        "language_note": "This window's text changes immediately. The Start menu and search language only change when you press OK.",
        "group_start_button": "Start button",
        "group_search": "Search",
        "group_menu": "Menu",
        "group_sections": "Sections",
        "group_actions": "Actions",
        "menu_custom": "Use a custom icon and label",
        "menu_icon": "Start button icon",
        "menu_icon_size_mode": "Icon size",
        "size_auto_taskbar": "Automatic (follows the taskbar)",
        "size_custom": "Custom",
        "menu_icon_size": "Custom icon size",
        "menu_label": "Panel text",
        "search_display": "Taskbar search",
        "search_vertical_note": "The search box needs a horizontal bar. On vertical bars the vertical icon and label is used.",
        "search_hidden": "Hide",
        "search_icon": "Search icon only",
        "search_pill": "Search icon and label",
        "search_box": "Search box",
        "search_size_mode": "Search height",
        "size_auto": "Automatic",
        "size_custom_f": "Custom",
        "search_pill_height": "Custom height",
        "search_spacing": "Extra spacing on both sides of Search",
        "search_spacing_tip": "Equally increases the gap between the Start button and Search, and between Search and the next applet",
        "menu_size": "Menu size",
        "menu_small": "Small",
        "menu_medium": "Medium",
        "menu_large": "Large",
        "show_avatar": "Show user avatar and name",
        "show_description": "Show application descriptions in search",
        "section_folders": "Folders",
        "section_folders_sub": "Shortcuts shown at the bottom of the menu",
        "section_recent": "Recent",
        "section_recent_tip": "Recently added apps and used files",
        "section_all": "All",
        "section_all_tip": "Show all apps and system components",
        "action_editor": "Open the menu editor",
        "action_reset": "Reset pinned apps to default",
        "reset_question": "Reset the pinned apps? This replaces your current arrangement.",
        "yes": "Yes",
        "no": "No",
        "folders_intro": "Choose which shortcuts appear at the bottom of the Start menu. The power button is always shown.",
        "show_settings": "Settings",
        "show_files": "File Explorer",
        "show_home": "Personal folder",
        "show_network": "Network",
        "show_videos": "Videos",
        "show_pictures": "Pictures",
        "show_music": "Music",
        "show_downloads": "Downloads",
        "show_documents": "Documents",
        "show_recent_apps": "Show recently added apps",
        "show_recent_files": "Show recent files",
        "recent_files_note": "Shows actual file history when Cinnamon privacy allows it (remember-recent-files). Removing an entry only removes history, never the file.",
        "overlay_key": "Keyboard shortcut to open and close the menu",
        "key_capture": "Press the keys…",
        "key_none": "None",
        "center_menu": "Center the menu horizontally on screen",
        "activate_on_hover": "Open the menu when I hover over it",
        "hover_delay": "Hover delay (ms)",
        "enable_animation": "Use menu animations",
        "enable_autoscroll": "Autoscroll in the application list",
        "choose_icon": "Choose an image",
        "browse": "Browse…",
        "cancel": "Cancel",
        "images": "Images",
    },
    "ptbr": {
        "window_title": "Configurações do menu Iniciar",
        "page_language": "Idioma",
        "page_layout": "Opções de layout",
        "page_behavior": "Comportamento",
        "ok": "OK",
        "back": "Voltar",
        "language_label": "Idioma",
        "language_note": "O texto desta janela muda na hora. O idioma do menu Iniciar e da pesquisa só muda ao pressionar OK.",
        "group_start_button": "Botão Iniciar",
        "group_search": "Pesquisa",
        "group_menu": "Menu",
        "group_sections": "Seções",
        "group_actions": "Ações",
        "menu_custom": "Usar ícone e texto personalizados",
        "menu_icon": "Ícone do botão Iniciar",
        "menu_icon_size_mode": "Tamanho do ícone",
        "size_auto_taskbar": "Automático (acompanha a barra de tarefas)",
        "size_custom": "Personalizado",
        "menu_icon_size": "Tamanho personalizado do ícone",
        "menu_label": "Texto no painel",
        "search_display": "Pesquisa na barra de tarefas",
        "search_vertical_note": "A caixa de pesquisa precisa de uma barra horizontal. Em barras verticais, o ícone e rótulo é exibido na vertical.",
        "search_hidden": "Ocultar",
        "search_icon": "Somente ícone de pesquisa",
        "search_pill": "Ícone e rótulo de pesquisa",
        "search_box": "Caixa de pesquisa",
        "search_size_mode": "Altura da pesquisa",
        "size_auto": "Automático",
        "size_custom_f": "Personalizada",
        "search_pill_height": "Altura personalizada",
        "search_spacing": "Espaçamento extra dos dois lados da pesquisa",
        "search_spacing_tip": "Aumenta igualmente a distância entre o botão Iniciar e a pesquisa e entre a pesquisa e o próximo applet",
        "menu_size": "Tamanho do menu",
        "menu_small": "Pequeno",
        "menu_medium": "Médio",
        "menu_large": "Grande",
        "show_avatar": "Mostrar avatar e nome do usuário",
        "show_description": "Mostrar descrições dos aplicativos na pesquisa",
        "section_folders": "Pastas",
        "section_folders_sub": "Atalhos exibidos na parte inferior do menu",
        "section_recent": "Recentes",
        "section_recent_tip": "Apps adicionados recentemente e arquivos usados",
        "section_all": "Tudo",
        "section_all_tip": "Mostrar todos os aplicativos e componentes do sistema",
        "action_editor": "Abrir o editor do menu",
        "action_reset": "Restaurar aplicativos fixados padrão",
        "reset_question": "Restaurar os aplicativos fixados? Isso substitui a sua organização atual.",
        "yes": "Sim",
        "no": "Não",
        "folders_intro": "Escolha quais atalhos aparecem na parte inferior do menu Iniciar. O botão de energia sempre aparece.",
        "show_settings": "Configurações",
        "show_files": "Explorador de arquivos",
        "show_home": "Pasta pessoal",
        "show_network": "Rede",
        "show_videos": "Vídeos",
        "show_pictures": "Imagens",
        "show_music": "Música",
        "show_downloads": "Downloads",
        "show_documents": "Documentos",
        "show_recent_apps": "Mostrar aplicativos adicionados recentemente",
        "show_recent_files": "Mostrar arquivos recentes",
        "recent_files_note": "Mostra o histórico real quando a privacidade do Cinnamon permite (remember-recent-files). Remover uma entrada apaga somente o histórico, nunca o arquivo.",
        "overlay_key": "Atalho de teclado para abrir e fechar o menu",
        "key_capture": "Pressione as teclas…",
        "key_none": "Nenhum",
        "center_menu": "Centralizar o menu horizontalmente na tela",
        "activate_on_hover": "Abrir o menu ao passar o mouse",
        "hover_delay": "Atraso ao passar o mouse (ms)",
        "enable_animation": "Usar animações no menu",
        "enable_autoscroll": "Rolagem automática na lista de aplicativos",
        "choose_icon": "Escolher uma imagem",
        "browse": "Procurar…",
        "cancel": "Cancelar",
        "images": "Imagens",
    },
}


# ---------------------------------------------------------------------------
# Keyboard shortcut helpers (pure functions, no display needed)
# ---------------------------------------------------------------------------
_KEY_LABELS = {
    "Super_L": "Super", "Super_R": "Super", "Control_L": "Ctrl", "Control_R": "Ctrl",
    "Alt_L": "Alt", "Alt_R": "Alt", "Shift_L": "Shift", "Shift_R": "Shift",
    "Escape": "Esc", "Return": "Enter", "space": "Space",
}
_MOD_LABELS = {"<Control>": "Ctrl+", "<Alt>": "Alt+", "<Shift>": "Shift+", "<Super>": "Super+"}
MODIFIER_KEYVALS = {
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R, Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R, Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R, Gdk.KEY_ISO_Level3_Shift,
}


def gtk_accel_to_cinnamon(name):
    """Gtk accelerator syntax -> Cinnamon's (<Primary> is called <Control>)."""
    return name.replace("<Primary>", "<Control>")


def binding_from_key(keyval, state):
    """Cinnamon binding string for a key press (state is masked to real modifiers)."""
    state = Gdk.ModifierType(int(state) & int(Gtk.accelerator_get_default_mod_mask()))
    return gtk_accel_to_cinnamon(Gtk.accelerator_name(keyval, state) or "")


def split_overlay_key(value):
    parts = str(value or "").split("::")
    return parts[0], (parts[1] if len(parts) > 1 else "")


def compose_overlay_key(binding1, old_value):
    """New "<b1>::<b2>"; b2 is kept only for the stock Super_L::Super_R pair."""
    old1, old2 = split_overlay_key(old_value)
    keep = binding1 == "Super_L" and old2 == "Super_R"
    return "%s::%s" % (binding1, "Super_R" if keep else "")


def binding_label(value, none_text):
    """Human-readable form of the first binding in a Cinnamon "<b1>::<b2>" value."""
    binding = split_overlay_key(value)[0]
    if not binding:
        return none_text
    prefix = ""
    while binding.startswith("<") and ">" in binding:
        mod, binding = binding[:binding.index(">") + 1], binding[binding.index(">") + 1:]
        prefix += _MOD_LABELS.get(mod, mod.strip("<>") + "+")
    key = _KEY_LABELS.get(binding) or (binding.upper() if len(binding) == 1 else binding)
    return prefix + key


# ---------------------------------------------------------------------------
# Config storage
# ---------------------------------------------------------------------------
def warn(message):
    print("win11-menu-settings: " + message, file=sys.stderr)


class ConfigStore:
    """Reads/writes <spices>/<instance>.json (only "value" fields) and touches triggers."""

    def __init__(self, instance_id, spices_dir=None, cache_dir=None):
        self.instance_id = str(instance_id)
        self.spices_dir = os.path.expanduser(
            spices_dir or os.environ.get("WIN11_MENU_SPICES_DIR") or DEFAULT_SPICES_DIR)
        self.cache_dir = os.path.expanduser(
            cache_dir or os.environ.get("WIN11_MENU_CACHE_DIR") or DEFAULT_CACHE_DIR)
        self.path = os.path.join(self.spices_dir, self.instance_id + ".json")

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                return data
            warn("%s is not a JSON object" % self.path)
        except (OSError, ValueError) as exc:
            warn("cannot read %s: %s" % (self.path, exc))
        return None

    def get(self, key, default=None):
        entry = (self._load() or {}).get(key)
        if isinstance(entry, dict) and "value" in entry:
            return entry["value"]
        return default

    def write(self, changes):
        """Set the "value" of existing keys. Returns the keys actually changed."""
        data = self._load()
        if data is None:
            return []
        written = []
        for key, value in changes.items():
            entry = data.get(key)
            if not isinstance(entry, dict) or "value" not in entry:
                warn("unknown key %r skipped" % key)
            elif entry["value"] != value or type(entry["value"]) is not type(value):
                entry["value"] = value
                written.append(key)
        if written:
            self._atomic_dump(data)
            self._touch("refresh-" + self.instance_id)
        return written

    def _atomic_dump(self, data):
        fd, tmp = tempfile.mkstemp(dir=self.spices_dir, prefix="." + self.instance_id + ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=4, ensure_ascii=False)
                handle.write("\n")
            os.chmod(tmp, os.stat(self.path).st_mode & 0o777)
            os.replace(tmp, self.path)
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    def _touch(self, name):
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
            with open(os.path.join(self.cache_dir, name), "w", encoding="utf-8") as handle:
                handle.write("%.6f\n" % time.time())
        except OSError as exc:
            warn("cannot touch %s: %s" % (name, exc))

    def touch_reset_pinned(self):
        self._touch("reset-pinned-" + self.instance_id)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
CSS = b"""
.w11-title { font-weight: bold; }
.w11-sub { opacity: 0.65; font-size: smaller; }
.w11-page-title { font-size: 20pt; font-weight: bold; }
.w11-group-title { font-weight: bold; opacity: 0.85; }
.w11-group { border: 1px solid alpha(currentColor, 0.15); border-radius: 8px; }
.w11-group row { padding: 0; }
.w11-row { padding: 10px 14px; }
.w11-chevron { font-size: 16pt; opacity: 0.6; }
.w11-sidebar row { padding: 8px 12px; border-radius: 6px; margin: 2px 6px; }
"""

SIZE_AUTO_CUSTOM = [("auto", "size_auto_taskbar"), ("custom", "size_custom")]
SEARCH_HEIGHT_MODE = [("auto", "size_auto"), ("custom", "size_custom_f")]
SEARCH_DISPLAY = [("hidden", "search_hidden"), ("icon", "search_icon"),
                  ("pill", "search_pill"), ("box", "search_box")]

def parse_panel_position(enabled_applets, panels_enabled, instance_id):
    """Side ("top" | "bottom" | "left" | "right") of the panel hosting this applet instance, or None.

    enabled_applets: ["panel1:right:3:<uuid>:<instance>", ...]; panels_enabled: ["<id>:<monitor>:<side>", ...]
    """
    panel_id = None
    for entry in enabled_applets or []:
        parts = entry.split(":")
        if len(parts) >= 5 and parts[3] == UUID and parts[4] == str(instance_id):
            panel_id = parts[0].replace("panel", "")
            break
    if panel_id is None:
        return None
    for entry in panels_enabled or []:
        parts = entry.split(":")
        if len(parts) >= 3 and parts[0] == panel_id:
            return parts[2]
    return None


def is_vertical(position):
    return position in ("left", "right")


def panel_position(instance_id):
    """Side of this instance's panel; WIN11_MENU_PANEL_POSITION overrides it (tests)."""
    forced = os.environ.get("WIN11_MENU_PANEL_POSITION")
    if forced:
        return forced
    try:
        settings = Gio.Settings.new("org.cinnamon")
        return parse_panel_position(settings.get_strv("enabled-applets"), settings.get_strv("panels-enabled"), instance_id)
    except Exception:  # missing schema outside Cinnamon
        return None


MENU_SIZES = [("small", "menu_small"), ("medium", "menu_medium"), ("large", "menu_large")]
LANGUAGES = [("en", "English"), ("ptbr", "Português (Brasil)")]  # never translated
# Order matters: this is the top -> bottom order of the "Folders" sub-page. No power row.
FOLDER_ROWS = [
    ("show-settings", "preferences-system-symbolic"),
    ("show-files", "system-file-manager-symbolic"),
    ("show-home", "user-home-symbolic"),
    ("show-network", "network-workgroup-symbolic"),
    ("show-videos", "folder-videos-symbolic"),
    ("show-pictures", "folder-pictures-symbolic"),
    ("show-music", "folder-music-symbolic"),
    ("show-downloads", "folder-download-symbolic"),
    ("show-documents", "folder-documents-symbolic"),
]
PAGES = [("language", "page_language", "preferences-desktop-locale-symbolic"),
         ("layout", "page_layout", "view-grid-symbolic"),
         ("behavior", "page_behavior", "preferences-other-symbolic")]
DEFAULTS = {"language": "en", "overlay-key": "Super_L::Super_R"}


class SettingsWindow(Gtk.Window):
    DEBOUNCE_MS = 150

    def __init__(self, store, page=None):
        super().__init__()
        self.store = store
        lang = store.get("language", "en")
        self.lang = lang if lang in I18N else "en"
        self._relabel = []        # callables re-applying the current language
        self._disabled_options = {}  # combo key -> option ids that cannot be picked
        self.controls = {}        # config key -> widget
        self._loading = True      # True while widgets are being filled from the config
        self._pending = {}        # key -> value waiting for the debounce timer
        self._timer = 0
        self.nav_rows = {}
        self.back_buttons = {}
        self.add_class_provider()

        self.set_default_size(820, 620)
        self.set_size_request(480, 320)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_name("preferences-system")
        self._bind(self.set_title, "window_title")

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(outer)
        body = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        outer.pack_start(body, True, True, 0)
        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        body.pack_start(self._build_sidebar(), False, False, 0)
        body.pack_start(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL), False, False, 0)
        body.pack_start(self.stack, True, True, 0)

        self.stack.add_named(self._build_language_page(), "language")
        self.stack.add_named(self._build_layout_page(), "layout")
        self.stack.add_named(self._build_behavior_page(), "behavior")

        outer.pack_start(Gtk.Separator(), False, False, 0)
        bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        bar.set_border_width(10)
        self.ok_button = Gtk.Button()
        self.ok_button.get_style_context().add_class("suggested-action")
        self.ok_button.set_size_request(96, -1)
        self.ok_button.connect("clicked", lambda *_: self.ok())
        self._bind(self.ok_button.set_label, "ok")
        bar.pack_end(self.ok_button, False, False, 0)
        outer.pack_start(bar, False, False, 0)

        self.connect("delete-event", self._on_delete)
        self.connect("destroy", lambda *_: self.flush())  # never leave a timer behind
        self.connect("key-press-event", self._on_key_press)
        self.connect("key-release-event", self._on_key_release)
        self.editor_button.connect("clicked", lambda *_: spawn(["cinnamon-menu-editor"]))
        self.reset_button.connect("clicked", self._on_reset_clicked)
        self._update_sensitivity()
        self._loading = False
        outer.show_all()  # Gtk.Stack can only switch to visible children
        self.select_page(page if page in dict((p[0], 1) for p in PAGES) else "language")

    # -- language plumbing ---------------------------------------------------
    def t(self, key):
        return I18N[self.lang][key]

    def _bind(self, setter, key):
        """Call setter(text) now and again whenever the language changes."""
        def apply():
            setter(self.t(key))
        apply()
        self._relabel.append(apply)

    def _apply_language(self):
        for apply in self._relabel:
            apply()

    def _on_language_changed(self, combo):
        lang = combo.get_active_id()
        if lang in I18N and lang != self.lang and not self._loading:
            self.lang = lang        # staged: only ok() persists it
            self._apply_language()

    # -- small widget factories ------------------------------------------------
    def add_class_provider(self):
        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        screen = Gdk.Screen.get_default()
        if screen is not None:
            Gtk.StyleContext.add_provider_for_screen(screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    def label(self, key, css=None, tip_key=None):
        lab = Gtk.Label(xalign=0)
        lab.set_line_wrap(True)
        lab.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
        if css:
            lab.get_style_context().add_class(css)
        self._bind(lab.set_text, key)
        if tip_key:
            self._bind(lab.set_tooltip_text, tip_key)
        return lab

    def scrolled(self, child):
        win = Gtk.ScrolledWindow()
        win.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        win.add(child)
        return win

    def page_box(self, title_key=None):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        box.set_border_width(24)
        if title_key:
            box.pack_start(self.label(title_key, "w11-page-title"), False, False, 6)
        return box

    def group(self, box, title_key=None):
        """Titled, framed ListBox appended to box. Returns the ListBox."""
        if title_key:
            title = self.label(title_key, "w11-group-title")
            title.set_margin_top(10)
            box.pack_start(title, False, False, 0)
        listbox = Gtk.ListBox()
        listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        listbox.get_style_context().add_class("w11-group")
        listbox.set_header_func(self._separator_header)
        box.pack_start(listbox, False, False, 0)
        return listbox

    @staticmethod
    def _separator_header(row, before):
        row.set_header(Gtk.Separator() if before is not None else None)

    def row(self, listbox, title_key, control=None, sub_key=None, tip_key=None, icon=None,
            activatable=False):
        """Windows-11-like row: [icon] title (bold) + subtitle (dim) ........ control"""
        lrow = Gtk.ListBoxRow()
        lrow.set_activatable(activatable)
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        hbox.get_style_context().add_class("w11-row")
        lrow.add(hbox)
        if icon:
            hbox.pack_start(Gtk.Image.new_from_icon_name(icon, Gtk.IconSize.LARGE_TOOLBAR), False, False, 0)
        texts = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        texts.set_valign(Gtk.Align.CENTER)
        texts.pack_start(self.label(title_key, "w11-title"), False, False, 0)
        if sub_key:
            texts.pack_start(self.label(sub_key, "w11-sub"), False, False, 0)
        hbox.pack_start(texts, True, True, 0)
        if control is not None:
            control.set_valign(Gtk.Align.CENTER)
            control.set_halign(Gtk.Align.END)
            hbox.pack_end(control, False, False, 0)
        if tip_key:
            self._bind(lrow.set_tooltip_text, tip_key)
        listbox.add(lrow)
        return lrow

    def switch(self, key, default=False):
        sw = Gtk.Switch()
        sw.set_active(bool(self.store.get(key, default)))
        self.controls[key] = sw
        self._watch(key, sw)
        return sw

    def spin(self, key, low, high, default):
        spin = Gtk.SpinButton.new_with_range(low, high, 1)
        spin.set_numeric(True)
        try:
            spin.set_value(float(self.store.get(key, default)))
        except (TypeError, ValueError):
            spin.set_value(default)
        self.controls[key] = spin
        self._watch(key, spin)
        return spin

    def combo(self, key, options, default):
        combo = Gtk.ComboBoxText()
        for ident, text_key in options:
            combo.append(ident, self.t(text_key))
        if not combo.set_active_id(str(self.store.get(key, default))):
            combo.set_active_id(default)

        def relabel():
            for item, (_ident, text_key) in zip(combo.get_model(), options):
                item[0] = self.t(text_key)
        relabel()
        self._relabel.append(relabel)
        for cell in combo.get_cells():
            cell.set_property("ellipsize", Pango.EllipsizeMode.END)
        self.controls[key] = combo
        self._watch(key, combo)
        return combo

    def _disable_option(self, key, ident):
        """Grey out one entry of a combo (it stays visible but cannot be picked)."""
        combo = self.controls[key]
        cell = combo.get_cells()[0]

        def sensitivity(_layout, renderer, model, tree_iter, _data):
            renderer.set_property("sensitive", model.get_value(tree_iter, 1) != ident)
        combo.set_cell_data_func(cell, sensitivity, None)
        self._disabled_options.setdefault(key, set()).add(ident)

    def option_sensitive(self, key, ident):
        return ident not in self._disabled_options.get(key, set())

    def icon_chooser(self, key):
        value = str(self.store.get(key, "") or "")
        if XApp is not None:
            chooser = XApp.IconChooserButton()
            chooser.set_icon(value)
            self.controls[key] = chooser
            self._watch(key, chooser)
            return chooser
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        entry = Gtk.Entry()
        entry.set_text(value)
        entry.set_width_chars(18)
        button = Gtk.Button()
        self._bind(button.set_label, "browse")
        button.connect("clicked", self._on_browse_icon, entry)
        box.pack_start(entry, True, True, 0)
        box.pack_start(button, False, False, 0)
        self.controls[key] = entry
        self._watch(key, entry)
        return box

    def _on_browse_icon(self, _button, entry):
        dialog = Gtk.FileChooserDialog(title=self.t("choose_icon"), transient_for=self,
                                       action=Gtk.FileChooserAction.OPEN)
        dialog.add_button(self.t("cancel"), Gtk.ResponseType.CANCEL)
        dialog.add_button(self.t("ok"), Gtk.ResponseType.OK)
        image_filter = Gtk.FileFilter()
        image_filter.set_name(self.t("images"))
        image_filter.add_mime_type("image/*")
        dialog.add_filter(image_filter)
        if dialog.run() == Gtk.ResponseType.OK:
            entry.set_text(dialog.get_filename() or "")
        dialog.destroy()

    # -- pages -------------------------------------------------------------------
    def _build_sidebar(self):
        self.sidebar = Gtk.ListBox()
        self.sidebar.get_style_context().add_class("w11-sidebar")
        self.sidebar.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.sidebar_rows = {}
        for name, title_key, icon in PAGES:
            row = Gtk.ListBoxRow()
            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            box.pack_start(Gtk.Image.new_from_icon_name(icon, Gtk.IconSize.BUTTON), False, False, 0)
            box.pack_start(self.label(title_key), True, True, 0)
            row.add(box)
            row.page_name = name
            self.sidebar.add(row)
            self.sidebar_rows[name] = row
        self.sidebar.connect("row-selected", self._on_sidebar_selected)
        frame = self.scrolled(self.sidebar)
        frame.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        frame.set_size_request(190, -1)
        return frame

    def _on_sidebar_selected(self, _listbox, row):
        if row is not None:
            self.stack.set_visible_child_name(row.page_name)

    def select_page(self, name):
        self.sidebar.select_row(self.sidebar_rows[name])
        self.stack.set_visible_child_name(name)

    def _build_language_page(self):
        box = self.page_box("page_language")
        group = self.group(box)
        combo = Gtk.ComboBoxText()
        for ident, text in LANGUAGES:
            combo.append(ident, text)
        combo.set_active_id(self.lang)
        combo.connect("changed", self._on_language_changed)
        self.language_combo = combo
        self.row(group, "language_label", combo)
        note = self.label("language_note", "w11-sub")
        note.set_margin_top(6)
        box.pack_start(note, False, False, 0)
        return self.scrolled(box)

    def _build_layout_page(self):
        self.layout_stack = Gtk.Stack()
        self.layout_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self.layout_stack.add_named(self._build_layout_main(), "main")
        self.layout_stack.add_named(self._build_subpage("folders", "section_folders", self._folders_body), "folders")
        self.layout_stack.add_named(self._build_subpage("recent", "section_recent", self._recent_body), "recent")
        return self.layout_stack

    def _build_layout_main(self):
        box = self.page_box("page_layout")
        start = self.group(box, "group_start_button")
        self.row(start, "menu_custom", self.switch("menu-custom", True))
        self.row(start, "menu_icon", self.icon_chooser("menu-icon"))
        self.row(start, "menu_icon_size_mode", self.combo("menu-icon-size-mode", SIZE_AUTO_CUSTOM, "auto"))
        self.row(start, "menu_icon_size", self.spin("menu-icon-size", 16, 64, 32))
        entry = Gtk.Entry()
        entry.set_text(str(self.store.get("menu-label", "") or ""))
        self.controls["menu-label"] = entry
        self._watch("menu-label", entry)
        self.row(start, "menu_label", entry)

        search = self.group(box, "group_search")
        vertical = is_vertical(panel_position(self.store.instance_id))
        self.row(search, "search_display", self.combo("search-display", SEARCH_DISPLAY, "pill"),
                 sub_key="search_vertical_note" if vertical else None)
        if vertical:
            self._disable_option("search-display", "box")
        self.row(search, "search_size_mode", self.combo("search-button-size-mode", SEARCH_HEIGHT_MODE, "auto"))
        self.row(search, "search_pill_height", self.spin("search-pill-height", 20, 60, 30))
        self.row(search, "search_spacing", self.spin("search-button-spacing", 0, 24, 0),
                 tip_key="search_spacing_tip")

        menu = self.group(box, "group_menu")
        self.row(menu, "menu_size", self.combo("menu-size", MENU_SIZES, "large"))
        self.row(menu, "show_avatar", self.switch("show-avatar", True))
        self.row(menu, "show_description", self.switch("show-description", True))

        sections = self.group(box, "group_sections")
        for name, title_key, sub_key, tip_key in (
                ("folders", "section_folders", "section_folders_sub", None),
                ("recent", "section_recent", None, "section_recent_tip")):
            chevron = Gtk.Label(label="\u203a")
            chevron.get_style_context().add_class("w11-chevron")
            nav = self.row(sections, title_key, chevron, sub_key=sub_key, tip_key=tip_key, activatable=True)
            nav.target_page = name
            self.nav_rows[name] = nav
        self.row(sections, "section_all", self.switch("show-all-apps", False), tip_key="section_all_tip")
        sections.connect("row-activated", self._on_section_activated)

        title = self.label("group_actions", "w11-group-title")
        title.set_margin_top(10)
        box.pack_start(title, False, False, 0)
        self.editor_button = Gtk.Button()
        self._bind(self.editor_button.set_label, "action_editor")
        self.reset_button = Gtk.Button()
        self._bind(self.reset_button.set_label, "action_reset")
        for button in (self.editor_button, self.reset_button):
            button.set_halign(Gtk.Align.START)
            box.pack_start(button, False, False, 0)
        return self.scrolled(box)

    def _on_section_activated(self, _listbox, row):
        target = getattr(row, "target_page", None)
        if target:
            self.layout_stack.set_visible_child_name(target)

    def _build_subpage(self, name, title_key, fill):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        header.set_border_width(12)
        back = Gtk.Button.new_from_icon_name("go-previous-symbolic", Gtk.IconSize.BUTTON)
        back.set_relief(Gtk.ReliefStyle.NONE)
        self._bind(back.set_tooltip_text, "back")
        back.connect("clicked", lambda *_: self.layout_stack.set_visible_child_name("main"))
        self.back_buttons[name] = back
        header.pack_start(back, False, False, 0)
        header.pack_start(self.label(title_key, "w11-page-title"), True, True, 0)
        page.pack_start(header, False, False, 0)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        body.set_border_width(24)
        body.set_margin_top(0)
        fill(body)
        page.pack_start(self.scrolled(body), True, True, 0)
        return page

    def _folders_body(self, body):
        intro = self.label("folders_intro", "w11-sub")
        body.pack_start(intro, False, False, 0)
        self.folders_list = self.group(body)
        for key, icon in FOLDER_ROWS:
            lrow = self.row(self.folders_list, key.replace("-", "_"), self.switch(key, True), icon=icon)
            lrow.config_key = key

    def _recent_body(self, body):
        group = self.group(body)
        self.row(group, "show_recent_apps", self.switch("show-recent-apps", True))
        self.row(group, "show_recent_files", self.switch("show-recent-files", False))
        body.pack_start(self.label("recent_files_note", "w11-sub"), False, False, 0)

    def _build_behavior_page(self):
        box = self.page_box("page_behavior")
        group = self.group(box)
        self.overlay_value = str(self.store.get("overlay-key", DEFAULTS["overlay-key"]) or "::")
        self.capturing = False
        self._bare_key = None     # modifier pressed alone, waiting for its release
        self.overlay_button = Gtk.Button()
        self.overlay_button.connect("clicked", lambda *_: self.start_capture())
        self.overlay_button.connect("focus-out-event", lambda *_: self.cancel_capture() and False)
        self._relabel.append(self._refresh_overlay_label)
        self._refresh_overlay_label()
        self.row(group, "overlay_key", self.overlay_button)
        self.row(group, "center_menu", self.switch("center-menu-on-screen", True))
        self.row(group, "activate_on_hover", self.switch("activate-on-hover", False))
        self.row(group, "hover_delay", self.spin("hover-delay", 0, 1000, 0))
        self.row(group, "enable_animation", self.switch("enable-animation", True))
        self.row(group, "enable_autoscroll", self.switch("enable-autoscroll", True))
        return self.scrolled(box)

    # -- overlay key capture -----------------------------------------------------
    def _refresh_overlay_label(self):
        if self.capturing:
            self.overlay_button.set_label(self.t("key_capture"))
        else:
            self.overlay_button.set_label(binding_label(self.overlay_value, self.t("key_none")))

    def start_capture(self):
        self.capturing = True
        self._bare_key = None
        self._refresh_overlay_label()

    def cancel_capture(self):
        was = self.capturing
        self.capturing = False
        self._bare_key = None
        self._refresh_overlay_label()
        return was

    def _commit_binding(self, binding):
        self.capturing = False
        self._bare_key = None
        self.overlay_value = compose_overlay_key(binding, self.overlay_value)
        self._refresh_overlay_label()
        self._queue("overlay-key", self.overlay_value)

    def _on_key_press(self, _win, event):
        keyval, state = event.keyval, int(event.state)
        mods = state & int(Gtk.accelerator_get_default_mod_mask())
        if self.capturing:
            if keyval in MODIFIER_KEYVALS:
                # Only a modifier pressed with nothing else held can be a bare binding.
                self._bare_key = keyval if not mods else None
            elif not mods and keyval == Gdk.KEY_Escape:
                self.cancel_capture()
            elif not mods and keyval == Gdk.KEY_BackSpace:
                self._commit_binding("")
            else:
                self._commit_binding(binding_from_key(Gdk.keyval_to_lower(keyval), mods))
            return True
        if keyval == Gdk.KEY_Escape and not mods:
            self.close_now()
            return True
        return False

    def close_now(self):
        """Same as the window X, but synchronous (Gtk.Window.close() only queues the event)."""
        if not self.emit("delete-event", Gdk.Event.new(Gdk.EventType.DELETE)):
            self.destroy()

    def _on_key_release(self, _win, event):
        if self.capturing and self._bare_key is not None and event.keyval == self._bare_key:
            self._commit_binding(binding_from_key(event.keyval, 0))
            return True
        return self.capturing

    # -- sensitivity ---------------------------------------------------------------
    def _update_sensitivity(self):
        c = self.controls
        display_on = c["search-display"].get_active_id() in ("pill", "box")
        search_custom = display_on and c["search-button-size-mode"].get_active_id() == "custom"
        rules = {
            "menu-icon-size": c["menu-icon-size-mode"].get_active_id() == "custom",
            "search-button-size-mode": display_on,
            "search-pill-height": search_custom,
            "hover-delay": c["activate-on-hover"].get_active(),
        }
        for key, enabled in rules.items():
            row = c[key].get_ancestor(Gtk.ListBoxRow)
            (row or c[key]).set_sensitive(enabled)

    # -- persistence -------------------------------------------------------------
    def _watch(self, key, widget):
        """Write `key` live (debounced) whenever the control changes."""
        if isinstance(widget, Gtk.Switch):
            widget.connect("notify::active", lambda w, _p: self._changed(key, w.get_active()))
        elif isinstance(widget, Gtk.SpinButton):
            widget.connect("value-changed", lambda w: self._changed(key, int(w.get_value())))
        elif isinstance(widget, Gtk.ComboBox):
            widget.connect("changed", lambda w: self._changed(key, w.get_active_id()))
        elif isinstance(widget, Gtk.Entry):
            widget.connect("changed", lambda w: self._changed(key, w.get_text()))
        else:  # XApp.IconChooserButton
            widget.connect("notify::icon", lambda w, _p: self._changed(key, w.get_icon()))

    def _changed(self, key, value):
        if hasattr(self, "overlay_button"):
            self._update_sensitivity()
        if self._loading:
            return
        self._queue(key, value)

    def _queue(self, key, value):
        self._pending[key] = value
        if not self._timer:
            self._timer = GLib.timeout_add(self.DEBOUNCE_MS, self._on_timer)

    def _on_timer(self):
        self._timer = 0
        self.flush()
        return False

    def flush(self):
        """Write queued changes now (one file write per burst)."""
        if self._timer:
            GLib.source_remove(self._timer)
            self._timer = 0
        pending, self._pending = self._pending, {}
        if pending:
            self.store.write(pending)

    def make_reset_dialog(self):
        dialog = Gtk.MessageDialog(transient_for=self, modal=True,
                                   message_type=Gtk.MessageType.QUESTION, text=self.t("reset_question"))
        dialog.add_button(self.t("yes"), Gtk.ResponseType.YES)
        dialog.add_button(self.t("no"), Gtk.ResponseType.NO)
        dialog.set_default_response(Gtk.ResponseType.NO)
        return dialog

    def confirm_reset(self):
        dialog = self.make_reset_dialog()
        answer = dialog.run()
        dialog.destroy()
        return answer == Gtk.ResponseType.YES

    def _on_reset_clicked(self, _button):
        if self.confirm_reset():
            self.store.touch_reset_pinned()

    def _on_delete(self, _win, _event):
        self.flush()      # live changes are kept; the staged language is not
        return False

    def ok(self):
        self.flush()
        self.store.write({"language": self.lang})
        self.destroy()


def spawn(argv):
    """Start a detached helper program; failures are reported, never fatal."""
    try:
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE)
    except GLib.Error as exc:
        warn("cannot start %s: %s" % (argv[0], exc.message))


def application_id(instance_id):
    """D-Bus name that makes the window single-instance per applet instance."""
    clean = "".join(c if c.isalnum() or c == "_" else "_" for c in str(instance_id))
    return "org.cinnamon.Win11MenuSettings.i" + clean


class SettingsApplication(Gtk.Application):
    """Unique per instance id: a second launch just presents the existing window."""

    def __init__(self, instance_id, page="language", spices_dir=None, cache_dir=None):
        super().__init__(application_id=application_id(instance_id),
                         flags=Gio.ApplicationFlags.FLAGS_NONE)
        self._args = (instance_id, spices_dir, cache_dir)
        self._page = page
        self.window = None

    def do_activate(self):
        if self.window is None:
            instance_id, spices_dir, cache_dir = self._args
            self.window = SettingsWindow(ConfigStore(instance_id, spices_dir, cache_dir), page=self._page)
            self.add_window(self.window)   # the app quits when this window is destroyed
            self.window.show_all()
            self.window.select_page(self._page)
        self.window.present()


def main(argv=None):
    parser = argparse.ArgumentParser(description="win11-menu settings window")
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--page", choices=[p[0] for p in PAGES], default="language")
    parser.add_argument("--spices-dir")
    parser.add_argument("--cache-dir")
    args = parser.parse_args(argv)
    app = SettingsApplication(args.instance_id, args.page, args.spices_dir, args.cache_dir)
    return app.run([sys.argv[0]])


if __name__ == "__main__":
    sys.exit(main())
