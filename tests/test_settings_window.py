# -*- coding: utf-8 -*-
"""Tests for win11-menu-settings.py (the GTK3 settings window).

Run:  /usr/bin/python3 -m unittest discover -s tests -p 'test_*.py'
Window tests need a display (DISPLAY) and are skipped without one.
"""
import contextlib
import copy
import importlib.util
import io
import json
import os
import shutil
import tempfile
import time
import unittest
import unittest.mock
import warnings

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gio, GLib, Gtk  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MODULE_PATH = os.path.join(os.path.dirname(HERE), "win11-menu-settings.py")


def load_module():
    spec = importlib.util.spec_from_file_location("win11_menu_settings", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# (key, type, default, value) for every setting the window touches, plus keys it must leave alone.
FIXTURE_KEYS = [
    ("language", "combobox", "en", "en"),
    ("menu-custom", "switch", True, True),
    ("menu-icon", "iconfilechooser", "linuxmint-logo-ring-symbolic", "linuxmint-logo-ring-symbolic"),
    ("menu-icon-size-mode", "combobox", "auto", "auto"),
    ("menu-icon-size", "spinbutton", 32, 32),
    ("menu-label", "entry", "", ""),
    ("search-display", "combobox", "pill", "pill"),
    ("search-button-size-mode", "combobox", "auto", "auto"),
    ("search-pill-height", "spinbutton", 30, 30),
    ("search-button-spacing", "spinbutton", 0, 0),
    ("icon-size-mode", "combobox", "standard", "standard"),
    ("show-avatar", "switch", True, True),
    ("show-description", "switch", True, True),
    ("show-all-apps", "switch", False, False),
    ("show-settings", "switch", True, True),
    ("show-files", "switch", True, True),
    ("show-home", "switch", True, True),
    ("show-network", "switch", False, False),
    ("show-videos", "switch", False, False),
    ("show-pictures", "switch", True, True),
    ("show-music", "switch", False, False),
    ("show-downloads", "switch", True, True),
    ("show-documents", "switch", True, True),
    ("show-recent-apps", "switch", True, True),
    ("show-recent-files", "switch", False, False),
    ("overlay-key", "keybinding", "Super_L::Super_R", "Super_L::Super_R"),
    ("center-menu-on-screen", "switch", True, True),
    ("activate-on-hover", "switch", False, False),
    ("hover-delay", "spinbutton", 0, 0),
    ("enable-animation", "switch", True, True),
    ("enable-autoscroll", "switch", True, True),
    ("pinned-items", "generic", [], [{"type": "app", "id": "org.gnome.Calculator.desktop"}]),
]
INSTANCE = "42"


def fixture_data():
    data = {"layout1": {"type": "layout", "pages": ["general"]}}
    for key, kind, default, value in FIXTURE_KEYS:
        data[key] = {"type": kind, "default": default, "value": value, "description": "d \u00e7"}
    return data


class TempDirsMixin:
    """Temp spices/cache dirs wired through the env overrides; real config untouched."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="w11-settings-test-")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.spices = os.path.join(self.tmp, "spices")
        self.cache = os.path.join(self.tmp, "cache")
        os.makedirs(self.spices)
        self.config_path = os.path.join(self.spices, INSTANCE + ".json")
        self.write_config(fixture_data())
        env = {"WIN11_MENU_SPICES_DIR": self.spices, "WIN11_MENU_CACHE_DIR": self.cache}
        patcher = unittest.mock.patch.dict(os.environ, env)
        patcher.start()
        self.addCleanup(patcher.stop)

    def write_config(self, data):
        with open(self.config_path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=4, ensure_ascii=False)

    def read_config(self):
        with open(self.config_path, encoding="utf-8") as handle:
            return json.load(handle)

    def trigger(self, name="refresh-" + INSTANCE):
        return os.path.join(self.cache, name)

    def trigger_text(self, name="refresh-" + INSTANCE):
        with open(self.trigger(name), encoding="utf-8") as handle:
            return handle.read()


class I18NTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_languages_have_identical_key_sets(self):
        en, pt = self.mod.I18N["en"], self.mod.I18N["ptbr"]
        self.assertEqual(sorted(self.mod.I18N), ["en", "ptbr"])
        self.assertEqual(set(en) - set(pt), set())
        self.assertEqual(set(pt) - set(en), set())

    def test_no_value_is_empty_or_bilingual(self):
        for lang, table in self.mod.I18N.items():
            self.assertGreater(len(table), 20, lang)
            for key, value in table.items():
                self.assertTrue(value.strip(), "%s/%s is empty" % (lang, key))
                self.assertNotIn(" / ", value, "%s/%s looks bilingual" % (lang, key))


class ConfigStoreTest(TempDirsMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def make_store(self):
        return self.mod.ConfigStore(INSTANCE)

    def test_env_overrides_select_directories(self):
        store = self.make_store()
        self.assertEqual(store.path, self.config_path)
        self.assertEqual(store.cache_dir, self.cache)

    def test_write_changes_only_the_value_of_one_key(self):
        before = self.read_config()
        self.assertEqual(self.make_store().write({"show-music": True}), ["show-music"])
        after = self.read_config()
        expected = copy.deepcopy(before)
        expected["show-music"]["value"] = True
        self.assertEqual(after, expected)
        self.assertEqual(list(after), list(before))  # key order preserved

    def test_write_touches_trigger_with_fresh_content_each_time(self):
        store = self.make_store()
        store.write({"show-music": True})
        first = self.trigger_text()
        self.assertTrue(first.strip())
        time.sleep(0.01)
        store.write({"show-music": False})
        self.assertNotEqual(self.trigger_text(), first)

    def test_missing_key_is_skipped_with_warning_and_does_not_crash(self):
        before = self.read_config()
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            written = self.make_store().write({"no-such-key": 1})
        self.assertEqual(written, [])
        self.assertIn("no-such-key", err.getvalue())
        self.assertEqual(self.read_config(), before)
        self.assertFalse(os.path.exists(self.trigger()))

    def test_one_write_for_several_keys_and_valid_keys_survive_a_bad_one(self):
        with contextlib.redirect_stderr(io.StringIO()):
            written = self.make_store().write({"show-music": True, "bogus": 1, "hover-delay": 250})
        self.assertEqual(written, ["show-music", "hover-delay"])
        config = self.read_config()
        self.assertEqual((config["show-music"]["value"], config["hover-delay"]["value"]), (True, 250))

    def test_unchanged_value_does_not_rewrite_or_touch(self):
        self.assertEqual(self.make_store().write({"show-avatar": True}), [])
        self.assertFalse(os.path.exists(self.trigger()))

    def test_write_is_atomic_and_leaves_no_temp_files(self):
        self.make_store().write({"show-music": True})
        self.assertEqual(os.listdir(self.spices), [INSTANCE + ".json"])

    def test_unicode_is_not_escaped(self):
        self.make_store().write({"menu-label": "Iniciar \u00e7"})
        with open(self.config_path, encoding="utf-8") as handle:
            self.assertIn("Iniciar \u00e7", handle.read())

    def test_get_returns_value_or_default_and_missing_file_is_safe(self):
        store = self.make_store()
        self.assertEqual(store.get("hover-delay", 5), 0)
        self.assertEqual(store.get("nope", "dflt"), "dflt")
        os.remove(self.config_path)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.make_store().get("hover-delay", 5), 5)
            self.assertEqual(self.make_store().write({"hover-delay": 1}), [])

    def test_touch_reset_pinned_creates_instance_trigger(self):
        self.make_store().touch_reset_pinned()
        self.assertTrue(self.trigger_text("reset-pinned-" + INSTANCE).strip())


def walk(widget):
    yield widget
    if isinstance(widget, Gtk.Container):
        for child in widget.get_children():
            yield from walk(child)


def visible_texts(root):
    """Every user-visible string: labels, button labels, tooltips, combo entries."""
    texts = set()
    for widget in walk(root):
        if isinstance(widget, Gtk.Label):
            texts.add(widget.get_text())
        elif isinstance(widget, Gtk.Button) and not isinstance(widget, Gtk.ComboBox):
            texts.add(widget.get_label() or "")
        if isinstance(widget, Gtk.ComboBox) and widget.get_model() is not None:
            texts.update(row[0] for row in widget.get_model())
        texts.add(widget.get_tooltip_text() or "")
    texts.discard("")
    return texts


@unittest.skipUnless(Gtk.init_check()[0], "needs a display")
class WindowTestCase(TempDirsMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def open_window(self, page=None, **overrides):
        data = self.read_config()
        for key, value in overrides.items():
            data[key]["value"] = value
        self.write_config(data)
        win = self.mod.SettingsWindow(self.mod.ConfigStore(INSTANCE), page=page)
        self.addCleanup(win.destroy)
        return win

    def settle(self, win):
        win.flush()
        while Gtk.events_pending():
            Gtk.main_iteration()


class StagedLanguageTest(WindowTestCase):
    def test_window_opens_in_the_saved_language(self):
        win = self.open_window(language="ptbr")
        self.assertEqual(win.get_title(), self.mod.I18N["ptbr"]["window_title"])
        win = self.open_window(language="en")
        self.assertEqual(win.get_title(), self.mod.I18N["en"]["window_title"])

    def test_combo_relabels_everything_at_once_without_mixing_languages(self):
        win = self.open_window(language="en")
        en, pt = self.mod.I18N["en"], self.mod.I18N["ptbr"]
        win.language_combo.set_active_id("ptbr")
        texts = visible_texts(win)
        self.assertEqual(win.get_title(), pt["window_title"])
        leftovers = {v for k, v in en.items() if v != pt[k]} & texts
        self.assertEqual(leftovers, set())
        self.assertIn(pt["page_layout"], texts)
        self.assertIn(pt["search_pill"], texts)
        # ...and back again
        win.language_combo.set_active_id("en")
        self.assertEqual({v for k, v in pt.items() if v != en[k]} & visible_texts(win), set())

    def test_language_is_written_only_on_ok(self):
        win = self.open_window(language="en")
        win.language_combo.set_active_id("ptbr")
        self.settle(win)
        self.assertEqual(self.read_config()["language"]["value"], "en")
        self.assertFalse(os.path.exists(self.trigger()))
        win.ok()
        self.assertEqual(self.read_config()["language"]["value"], "ptbr")
        self.assertTrue(os.path.exists(self.trigger()))

    def test_closing_with_x_discards_the_staged_language(self):
        win = self.open_window(language="en")
        win.language_combo.set_active_id("ptbr")
        win.emit("delete-event", Gdk.Event.new(Gdk.EventType.DELETE))
        self.assertEqual(self.read_config()["language"]["value"], "en")

    def test_initial_page_is_selectable(self):
        win = self.open_window(page="behavior")
        self.assertEqual(win.stack.get_visible_child_name(), "behavior")
        self.assertEqual(self.open_window().stack.get_visible_child_name(), "language")


def find_all(root, kind):
    return [w for w in walk(root) if isinstance(w, kind)]


class PageStructureTest(WindowTestCase):
    def test_every_page_body_is_inside_a_scrolled_window(self):
        win = self.open_window()
        pages = [win.stack.get_child_by_name(n) for n in ("language", "layout", "behavior")]
        pages += list(win.layout_stack.get_children())
        self.assertEqual(len(pages), 3 + 3)
        for page in pages:
            self.assertTrue(find_all(page, Gtk.ScrolledWindow), type(page).__name__)
        # the content really sits inside the scrolled window, not next to it
        for name in ("language", "behavior"):
            self.assertIsInstance(win.stack.get_child_by_name(name), Gtk.ScrolledWindow)
        self.assertIsInstance(win.layout_stack.get_child_by_name("main"), Gtk.ScrolledWindow)

    def test_folders_page_lists_the_nine_rows_in_order_without_power(self):
        expected = ["show-settings", "show-files", "show-home", "show-network", "show-videos",
                    "show-pictures", "show-music", "show-downloads", "show-documents"]
        for lang in ("ptbr", "en"):
            win = self.open_window(language=lang)
            rows = win.folders_list.get_children()
            self.assertEqual([r.config_key for r in rows], expected)
            titles = [find_all(r, Gtk.Label)[0].get_text() for r in rows]
            table = self.mod.I18N[lang]
            self.assertEqual(titles, [table[k.replace("-", "_")] for k in expected])
            self.assertEqual(len(find_all(win.folders_list, Gtk.Switch)), 9)
            self.assertEqual(len(find_all(win.folders_list, Gtk.Image)), 9)

    def test_back_button_and_navigation_rows_move_between_sub_pages(self):
        win = self.open_window()
        self.assertEqual(win.layout_stack.get_visible_child_name(), "main")
        sections = win.nav_rows
        sections["folders"].get_parent().emit("row-activated", sections["folders"])
        self.assertEqual(win.layout_stack.get_visible_child_name(), "folders")
        win.back_buttons["folders"].clicked()
        self.assertEqual(win.layout_stack.get_visible_child_name(), "main")
        sections["recent"].get_parent().emit("row-activated", sections["recent"])
        self.assertEqual(win.layout_stack.get_visible_child_name(), "recent")


class LiveWriteTest(WindowTestCase):
    CASES = [
        ("show-music", lambda c: c.set_active(True), True),
        ("show-all-apps", lambda c: c.set_active(True), True),
        ("hover-delay", lambda c: c.set_value(250), 250),
        ("menu-icon-size", lambda c: c.set_value(48), 48),
        ("search-display", lambda c: c.set_active_id("box"), "box"),
        ("icon-size-mode", lambda c: c.set_active_id("large"), "large"),
        ("menu-label", lambda c: c.set_text("Iniciar"), "Iniciar"),
        ("menu-icon", lambda c: c.set_icon("/tmp/some-logo.png"), "/tmp/some-logo.png"),
    ]

    def test_every_control_writes_its_key_after_the_debounce(self):
        for key, act, expected in self.CASES:
            with self.subTest(key=key):
                win = self.open_window()
                act(win.controls[key])
                self.assertNotEqual(self.read_config()[key]["value"], expected, "must be debounced")
                self.settle(win)
                self.assertEqual(self.read_config()[key]["value"], expected)
                self.assertTrue(os.path.exists(self.trigger()))
                os.remove(self.trigger())

    def test_nothing_is_written_while_the_window_loads(self):
        before = self.read_config()
        win = self.open_window()
        self.settle(win)
        self.assertEqual(self.read_config(), before)
        self.assertFalse(os.path.exists(self.trigger()))

    def test_a_burst_of_changes_is_a_single_write(self):
        win = self.open_window()
        with unittest.mock.patch.object(win.store, "write", wraps=win.store.write) as write:
            for value in range(1, 11):
                win.controls["hover-delay"].set_value(value * 10)
            win.controls["show-music"].set_active(True)
            deadline = time.time() + 1.0
            while time.time() < deadline and not write.called:
                Gtk.main_iteration_do(False)
                time.sleep(0.01)
            time.sleep(0.2)
            while Gtk.events_pending():
                Gtk.main_iteration()
        self.assertEqual(write.call_count, 1)
        self.assertEqual(write.call_args[0][0], {"hover-delay": 100, "show-music": True})

    def test_closing_with_x_still_saves_pending_live_changes(self):
        win = self.open_window()
        win.controls["show-music"].set_active(True)
        win.emit("delete-event", Gdk.Event.new(Gdk.EventType.DELETE))
        self.assertTrue(self.read_config()["show-music"]["value"])

    def test_key_missing_from_the_config_file_does_not_crash(self):
        data = self.read_config()
        del data["search-display"]
        self.write_config(data)
        win = self.mod.SettingsWindow(self.mod.ConfigStore(INSTANCE))
        self.addCleanup(win.destroy)
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            win.controls["search-display"].set_active_id("box")
            win.controls["show-music"].set_active(True)
            self.settle(win)
        self.assertIn("search-display", err.getvalue())
        self.assertTrue(self.read_config()["show-music"]["value"])


class SingleInstanceTest(TempDirsMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_application_id_is_per_instance_and_valid(self):
        self.assertEqual(self.mod.application_id("31"), "org.cinnamon.Win11MenuSettings.i31")
        self.assertNotEqual(self.mod.application_id("31"), self.mod.application_id("32"))
        self.assertTrue(Gio.Application.id_is_valid(self.mod.application_id("we ird/id")))

    def test_application_is_unique_and_importable_without_display(self):
        app = self.mod.SettingsApplication(INSTANCE, "language")
        self.assertEqual(app.get_application_id(), self.mod.application_id(INSTANCE))
        self.assertFalse(app.get_flags() & Gio.ApplicationFlags.NON_UNIQUE)

    @unittest.skipUnless(Gtk.init_check()[0] and os.environ.get("DBUS_SESSION_BUS_ADDRESS"),
                         "needs a display and a session bus")
    def test_second_launch_presents_the_first_window_and_exits(self):
        import subprocess
        import sys
        instance = "unittest%d" % os.getpid()      # never collides with a real applet instance
        with open(os.path.join(self.spices, instance + ".json"), "w", encoding="utf-8") as handle:
            json.dump(fixture_data(), handle)
        cmd = [sys.executable, MODULE_PATH, "--instance-id", instance]
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        name = self.mod.application_id(instance)

        def owned():
            reply = bus.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                                  "NameHasOwner", GLib.Variant("(s)", (name,)), None,
                                  Gio.DBusCallFlags.NONE, 2000, None)
            return reply.unpack()[0]

        first = subprocess.Popen(cmd, env=os.environ.copy())
        self.addCleanup(first.wait)
        self.addCleanup(first.terminate)
        deadline = time.time() + 15
        while time.time() < deadline and not owned():
            self.assertIsNone(first.poll(), "first process died")
            time.sleep(0.1)
        self.assertTrue(owned(), "first process never registered on the bus")
        second = subprocess.run(cmd, env=os.environ.copy(), timeout=15)
        self.assertEqual(second.returncode, 0)
        self.assertIsNone(first.poll(), "first window must keep running")


class SensitivityTest(WindowTestCase):
    def active(self, win, key):
        return win.controls[key].is_sensitive()

    def test_icon_size_spin_only_in_custom_mode(self):
        win = self.open_window(**{"menu-icon-size-mode": "auto"})
        self.assertFalse(self.active(win, "menu-icon-size"))
        win.controls["menu-icon-size-mode"].set_active_id("custom")
        self.assertTrue(self.active(win, "menu-icon-size"))
        self.assertTrue(self.open_window(**{"menu-icon-size-mode": "custom"}).controls["menu-icon-size"].is_sensitive())

    def test_search_height_controls_follow_display_and_size_mode(self):
        matrix = [("hidden", "auto", False, False), ("icon", "custom", False, False),
                  ("pill", "auto", True, False), ("pill", "custom", True, True),
                  ("box", "auto", True, False), ("box", "custom", True, True)]
        for display, mode, combo_on, spin_on in matrix:
            with self.subTest(display=display, mode=mode):
                win = self.open_window(**{"search-display": display, "search-button-size-mode": mode})
                self.assertEqual(self.active(win, "search-button-size-mode"), combo_on)
                self.assertEqual(self.active(win, "search-pill-height"), spin_on)
        win = self.open_window(**{"search-display": "hidden", "search-button-size-mode": "custom"})
        win.controls["search-display"].set_active_id("box")
        self.assertTrue(self.active(win, "search-pill-height"))
        win.controls["search-button-size-mode"].set_active_id("auto")
        self.assertFalse(self.active(win, "search-pill-height"))
        self.assertTrue(self.active(win, "search-button-spacing"))

    def test_hover_delay_only_when_hover_activation_is_on(self):
        win = self.open_window(**{"activate-on-hover": False})
        self.assertFalse(self.active(win, "hover-delay"))
        win.controls["activate-on-hover"].set_active(True)
        self.assertTrue(self.active(win, "hover-delay"))


def key_event(win, keyval, state=0, release=False):
    event = Gdk.Event.new(Gdk.EventType.KEY_RELEASE if release else Gdk.EventType.KEY_PRESS)
    event.window = win.get_window()
    event.keyval = keyval
    event.state = Gdk.ModifierType(state)
    return win.emit("key-release-event" if release else "key-press-event", event)


class OverlayKeyTest(WindowTestCase):
    def open_realized(self, **overrides):
        win = self.open_window(**overrides)
        win.realize()
        return win

    def stored(self, win):
        self.settle(win)
        return self.read_config()["overlay-key"]["value"]

    def test_button_shows_the_binding_in_human_form(self):
        win = self.open_realized()
        self.assertEqual(win.overlay_button.get_label(), "Super")
        win = self.open_realized(**{"overlay-key": "<Control>Escape::"})
        self.assertEqual(win.overlay_button.get_label(), "Ctrl+Esc")

    def test_click_enters_capture_mode_and_a_combination_is_stored(self):
        win = self.open_realized(language="ptbr")
        win.overlay_button.clicked()
        self.assertEqual(win.overlay_button.get_label(), self.mod.I18N["ptbr"]["key_capture"])
        key_event(win, Gdk.KEY_Escape, Gdk.ModifierType.CONTROL_MASK)
        self.assertEqual(self.stored(win), "<Control>Escape::")
        self.assertEqual(win.overlay_button.get_label(), "Ctrl+Esc")

    def test_bare_modifier_press_and_release_is_a_valid_binding(self):
        win = self.open_realized(**{"overlay-key": "<Control>Escape::"})
        win.overlay_button.clicked()
        key_event(win, Gdk.KEY_Super_L)
        self.assertEqual(win.overlay_button.get_label(), "Super" if False else self.mod.I18N["en"]["key_capture"])
        key_event(win, Gdk.KEY_Super_L, release=True)
        self.assertEqual(self.stored(win), "Super_L::")

    def test_modifier_held_while_another_key_follows_is_not_a_bare_binding(self):
        win = self.open_realized()
        win.overlay_button.clicked()
        key_event(win, Gdk.KEY_Control_L)
        key_event(win, Gdk.KEY_t, Gdk.ModifierType.CONTROL_MASK)
        key_event(win, Gdk.KEY_Control_L, release=True)
        self.assertEqual(self.stored(win), "<Control>t::")

    def test_super_l_keeps_super_r_as_second_binding(self):
        win = self.open_realized()
        win.overlay_button.clicked()
        key_event(win, Gdk.KEY_Super_L)
        key_event(win, Gdk.KEY_Super_L, release=True)
        self.settle(win)
        self.assertEqual(self.read_config()["overlay-key"]["value"], "Super_L::Super_R")

    def test_escape_cancels_capture_without_closing_or_writing(self):
        win = self.open_realized()
        closed = []
        win.connect("destroy", lambda *_: closed.append(1))
        win.overlay_button.clicked()
        key_event(win, Gdk.KEY_Escape)
        self.assertEqual(self.stored(win), "Super_L::Super_R")
        self.assertEqual(win.overlay_button.get_label(), "Super")
        self.assertEqual(closed, [])

    def test_backspace_clears_the_binding(self):
        win = self.open_realized()
        win.overlay_button.clicked()
        key_event(win, Gdk.KEY_BackSpace)
        self.assertEqual(self.stored(win), "::")
        self.assertEqual(win.overlay_button.get_label(), self.mod.I18N["en"]["key_none"])
        win.language_combo.set_active_id("ptbr")
        self.assertEqual(win.overlay_button.get_label(), self.mod.I18N["ptbr"]["key_none"])


class ActionsAndWindowTest(WindowTestCase):
    def test_editor_button_launches_cinnamon_menu_editor(self):
        win = self.open_window()
        with unittest.mock.patch.object(self.mod, "spawn") as spawn:
            win.editor_button.clicked()
        spawn.assert_called_once_with(["cinnamon-menu-editor"])

    def test_reset_pinned_touches_trigger_only_after_confirmation(self):
        win = self.open_window()
        with unittest.mock.patch.object(win, "confirm_reset", return_value=False):
            win.reset_button.clicked()
        self.assertFalse(os.path.exists(self.trigger("reset-pinned-" + INSTANCE)))
        with unittest.mock.patch.object(win, "confirm_reset", return_value=True):
            win.reset_button.clicked()
        self.assertTrue(self.trigger_text("reset-pinned-" + INSTANCE).strip())

    def test_reset_dialog_is_localized_with_yes_no(self):
        for lang in ("ptbr", "en"):
            win = self.open_window(language=lang)
            dialog = win.make_reset_dialog()
            self.addCleanup(dialog.destroy)
            table = self.mod.I18N[lang]
            self.assertEqual(dialog.get_property("text"), table["reset_question"])
            with warnings.catch_warnings():     # get_action_area is deprecated but still the simplest probe
                warnings.simplefilter("ignore", DeprecationWarning)
                area = dialog.get_action_area()
            self.assertEqual(sorted(b.get_label() for b in find_all(area, Gtk.Button)),
                             sorted([table["yes"], table["no"]]))

    def test_escape_closes_the_window_and_enter_does_not(self):
        win = self.open_window()
        win.realize()
        destroyed = []
        win.connect("destroy", lambda *_: destroyed.append(1))
        win.controls["menu-label"].set_text("x")
        key_event(win, Gdk.KEY_Return)
        win.controls["menu-label"].emit("activate")
        self.assertEqual(destroyed, [])
        key_event(win, Gdk.KEY_Escape)
        self.assertEqual(destroyed, [1])
        self.assertEqual(self.read_config()["language"]["value"], "en")

    def test_geometry_icon_and_ok_button(self):
        win = self.open_window()
        self.assertTrue(win.get_resizable())
        self.assertEqual(win.get_default_size(), (820, 620))
        self.assertEqual(win.get_size_request(), (480, 320))
        self.assertEqual(win.get_icon_name(), "preferences-system")
        self.assertEqual(win.ok_button.get_label(), "OK")
        self.assertTrue(win.ok_button.get_style_context().has_class("suggested-action"))
        self.assertEqual(len(win.sidebar.get_children()), 3)

    def test_specified_tooltips_follow_the_language(self):
        win = self.open_window(language="en")
        for lang in ("en", "ptbr"):
            win.language_combo.set_active_id(lang)
            table = self.mod.I18N[lang]
            texts = visible_texts(win)
            for key in ("search_spacing_tip", "section_recent_tip", "section_all_tip"):
                self.assertIn(table[key], texts)
        self.assertEqual(win.nav_rows["recent"].get_tooltip_text(), self.mod.I18N["ptbr"]["section_recent_tip"])

    def test_sub_pages_have_a_back_header_with_their_title(self):
        win = self.open_window(language="ptbr")
        for name, key in (("folders", "section_folders"), ("recent", "section_recent")):
            page = win.layout_stack.get_child_by_name(name)
            self.assertIn(self.mod.I18N["ptbr"][key], [l.get_text() for l in find_all(page, Gtk.Label)])
            self.assertIn(win.back_buttons[name], list(walk(page)))


class AcceleratorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_primary_becomes_control(self):
        self.assertEqual(self.mod.gtk_accel_to_cinnamon("<Primary>Escape"), "<Control>Escape")
        self.assertEqual(self.mod.gtk_accel_to_cinnamon("<Primary><Alt>t"), "<Control><Alt>t")

    def test_bare_modifier_is_kept(self):
        self.assertEqual(self.mod.gtk_accel_to_cinnamon("Super_L"), "Super_L")

    def test_binding_from_key_uses_cinnamon_syntax(self):
        gdk = self.mod.Gdk
        self.assertEqual(self.mod.binding_from_key(gdk.KEY_Escape, gdk.ModifierType.CONTROL_MASK),
                         "<Control>Escape")
        self.assertEqual(self.mod.binding_from_key(gdk.KEY_Super_L, 0), "Super_L")

    def test_overlay_value_keeps_second_binding_only_for_super_pair(self):
        self.assertEqual(self.mod.compose_overlay_key("Super_L", "Super_L::Super_R"), "Super_L::Super_R")
        self.assertEqual(self.mod.compose_overlay_key("<Control>Escape", "Super_L::Super_R"), "<Control>Escape::")
        self.assertEqual(self.mod.compose_overlay_key("Super_L", "<Control>Escape::"), "Super_L::")
        self.assertEqual(self.mod.compose_overlay_key("", "Super_L::Super_R"), "::")

    def test_label_is_human_readable(self):
        label = self.mod.binding_label
        self.assertEqual(label("Super_L::Super_R", "None"), "Super")
        self.assertEqual(label("<Control>Escape::", "None"), "Ctrl+Esc")
        self.assertEqual(label("<Control><Alt>t::", "None"), "Ctrl+Alt+T")
        self.assertEqual(label("::", "None"), "None")
        self.assertEqual(label("", "None"), "None")


if __name__ == "__main__":
    unittest.main()
