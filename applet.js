const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const UserWidget = imports.ui.userWidget;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const XApp = imports.gi.XApp;
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const SearchProviderManager = imports.ui.searchProviderManager;
const SignalManager = imports.misc.signalManager;

const AppUtils = (typeof require !== 'undefined') ? require('./appUtils') : imports.appUtils;

let appsys = Cinnamon.AppSystem.get_default();

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();
const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

const POPUP_MIN_WIDTH = 620;
const POPUP_MAX_WIDTH = 920;
const POPUP_MIN_HEIGHT = 520;
const POPUP_MAX_HEIGHT = 1200;

const PINNED_COLS = 8;
const PINNED_CELL_W = 76;
const PINNED_CELL_H = 82;

const FOLDER_COLS = 4;
const FOLDER_CELL_W = 82;
const FOLDER_CELL_H = 86;

const NO_MATCH = 99999;
const MATCH_ADDERS = [
    0,    // name
    1000, // keywords
    2000, // desc
    3000  // id
];

const I18N = {
    en: {
        start: "Start",
        search: "Search",
        search_placeholder: "Search for apps, settings, and documents",
        pinned: "Pinned",
        show_all: "Show all",
        show_less: "Show less",
        recent: "Recent",
        back: "Back",
        all: "All",
        view_list: "View: List",
        view_grid: "View: Grid",
        view_categories: "View: Categories",
        new_badge: "New",
        new_folder: "New folder",
        recently_added: "Recently added",
        just_now: "Just now",
        minutes_ago: "%dm ago",
        hours_ago: "%dh ago",
        days_ago: "%dd ago",
        no_recent_items: "No recent items",
        quick_searches: "Quick searches",
        top_apps: "Top apps",
        qs_focus: "Focus settings",
        qs_sound: "Sound settings",
        qs_bluetooth: "Bluetooth & devices",
        qs_display: "Display settings",
        qs_themes: "Themes & icons",
        qs_search: "Search settings",
        filter_all: "All",
        filter_apps: "Apps",
        filter_docs: "Documents",
        filter_settings: "Settings",
        best_match: "Best match",
        apps_header: "Apps",
        docs_header: "Documents & Recent",
        settings_header: "Settings & More",
        no_results: "No results found for \"%s\"",
        open: "Open",
        pin_to_start: "Pin to Start",
        unpin_from_start: "Unpin from Start",
        remove_from_folder: "Remove from folder",
        add_to_panel: "Add to panel",
        add_to_desktop: "Add to desktop",
        add_to_favorites: "Add to favorites",
        remove_from_favorites: "Remove from favorites",
        run_dedicated_gpu: "Run with dedicated GPU",
        properties: "Properties",
        uninstall: "Uninstall",
        edit_menu: "Edit menu",
        account_settings: "Account settings",
        file_explorer: "File Explorer",
        system_settings: "Settings",
        downloads: "Downloads",
        documents: "Documents",
        pictures: "Pictures",
        music: "Music",
        videos: "Videos",
        personal_folder: "Personal folder",
        power: "Power",
        lock_screen: "Lock",
        log_out: "Sign out",
        suspend: "Sleep",
        restart: "Restart",
        shut_down: "Shut down",
        file_unavailable: "This file is no longer available",
        clear_recent: "Clear recent list"
    },
    ptbr: {
        start: "Iniciar",
        search: "Pesquisar",
        search_placeholder: "Pesquisar aplicativos, configurações e documentos",
        pinned: "Fixado",
        show_all: "Mostrar tudo",
        show_less: "Mostrar menos",
        recent: "Recente",
        back: "Voltar",
        all: "Todos",
        view_list: "Exibição: Lista",
        view_grid: "Exibição: Grade",
        view_categories: "Exibição: Categorias",
        new_badge: "Novo",
        new_folder: "Nova Pasta",
        recently_added: "Adicionados recentemente",
        just_now: "Agora mesmo",
        minutes_ago: "%dm atrás",
        hours_ago: "%dh atrás",
        days_ago: "%dd atrás",
        no_recent_items: "Nenhum item recente",
        quick_searches: "Pesquisas rápidas",
        top_apps: "Principais aplicativos",
        qs_focus: "Configurações de foco",
        qs_sound: "Configurações de som",
        qs_bluetooth: "Bluetooth e dispositivos",
        qs_display: "Configurações de exibição",
        qs_themes: "Configurações de ícones",
        qs_search: "Configurações da pesquisa",
        filter_all: "Tudo",
        filter_apps: "Aplicativos",
        filter_docs: "Documentos",
        filter_settings: "Configurações",
        best_match: "Melhor correspondência",
        apps_header: "Aplicativos",
        docs_header: "Documentos e recentes",
        settings_header: "Configurações e mais",
        no_results: "Nenhum resultado encontrado para \"%s\"",
        open: "Abrir",
        pin_to_start: "Fixar em Iniciar",
        unpin_from_start: "Desafixar de Iniciar",
        remove_from_folder: "Remover da pasta",
        add_to_panel: "Adicionar ao painel",
        add_to_desktop: "Adicionar à área de trabalho",
        add_to_favorites: "Adicionar aos favoritos",
        remove_from_favorites: "Remover dos favoritos",
        run_dedicated_gpu: "Executar com GPU dedicada",
        properties: "Propriedades",
        uninstall: "Desinstalar",
        edit_menu: "Editar menu",
        account_settings: "Configurações da conta",
        file_explorer: "Explorador de Arquivos",
        system_settings: "Configurações",
        downloads: "Downloads",
        documents: "Documentos",
        pictures: "Imagens",
        music: "Música",
        videos: "Vídeos",
        personal_folder: "Pasta pessoal",
        power: "Energia",
        lock_screen: "Bloquear",
        log_out: "Sair",
        suspend: "Suspender",
        restart: "Reiniciar",
        shut_down: "Desligar",
        file_unavailable: "Este arquivo não está mais disponível",
        clear_recent: "Limpar lista de recentes"
    }
};

function shorten_path(path, filename) {
    let str = path.replace("file://", "");
    str = str.replace(GLib.get_home_dir(), "~");
    if (filename)
        str = str.replace("/" + filename, "");
    return str;
}

function createAppIcon(app, size) {
    if (!app) {
        return new St.Icon({
            icon_name: 'application-x-executable',
            icon_size: size,
            icon_type: St.IconType.FULLCOLOR
        });
    }
    let icon = app.create_icon_texture(size);
    if (icon instanceof St.Icon) {
        let gicon = icon.get_gicon();
        if (gicon?.get_names) {
            let iconTheme = Gtk.IconTheme.get_default();
            let hasAnyIcon = gicon.get_names()
                .some(name => iconTheme.lookup_icon(name, size, 0));
            if (!hasAnyIcon) {
                icon = new St.Icon({
                    icon_name: 'application-x-executable',
                    icon_size: size,
                    icon_type: St.IconType.FULLCOLOR
                });
            }
        }
    }
    return icon;
}

/**
 * Draggable tile in the Pinned section (represents either a single App or a Folder of apps)
 */
class PinnedTile {
    constructor(applet, itemData, index) {
        this.applet = applet;
        this.itemData = itemData;
        this.index = index;
        this.currentSlot = index;
        this.currentX = (index % PINNED_COLS) * PINNED_CELL_W;
        this.currentY = Math.floor(index / PINNED_COLS) * PINNED_CELL_H;

        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({
            style_class: 'win11-pinned-tile',
            vertical: true,
            reactive: true,
            track_hover: true,
            can_focus: true,
            width: PINNED_CELL_W,
            height: PINNED_CELL_H,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START
        });
        this.actor._delegate = this;
        this.actor.set_position(this.currentX, this.currentY);

        this.iconContainer = new St.Bin({
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE,
            width: 42,
            height: 42
        });

        let titleText = "";
        if (itemData.type === 'folder') {
            titleText = itemData.name || applet.t('new_folder');
            this.iconActor = this._buildFolderMiniIcon(itemData.apps || []);
            this.iconContainer.set_child(this.iconActor);
        } else {
            this.app = appsys.lookup_app(itemData.id);
            titleText = this.app ? this.app.get_name() : itemData.id;
            this.iconActor = createAppIcon(this.app, applet.applicationIconSize || 32);
            this.iconContainer.set_child(this.iconActor);
        }

        this.label = new St.Label({
            text: titleText,
            style_class: 'win11-pinned-tile-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.label.clutter_text.line_wrap = true;
        this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        this.actor.add_actor(this.iconContainer);
        this.actor.add_actor(this.label);

        this._signals.connect(this.actor, 'button-release-event', this._onButtonRelease.bind(this));

        this._draggable = DND.makeDraggable(this.actor, {
            restoreOnSuccess: false,
            dragActorOpacity: 225
        });
        this._signals.connect(this._draggable, 'drag-begin', this._onDragBegin.bind(this));
        this._signals.connect(this._draggable, 'drag-cancelled', this._onDragCancelled.bind(this));
        this._signals.connect(this._draggable, 'drag-end', this._onDragEnd.bind(this));
    }

    _buildFolderMiniIcon(appIds) {
        let box = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-folder-mini-preview',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        for (let r = 0; r < 2; r++) {
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-folder-mini-row',
                x_align: Clutter.ActorAlign.CENTER
            });
            for (let c = 0; c < 2; c++) {
                let idx = r * 2 + c;
                let cell = new St.Bin({ width: 13, height: 13 });
                if (idx < appIds.length) {
                    let app = appsys.lookup_app(appIds[idx]);
                    if (app) {
                        cell.set_child(createAppIcon(app, 13));
                    }
                }
                row.add_actor(cell);
            }
            box.add_actor(row);
        }
        return box;
    }

    setFolderDropTarget(isTarget) {
        if (isTarget) {
            this.actor.add_style_class_name('win11-pinned-tile-folder-target');
        } else {
            this.actor.remove_style_class_name('win11-pinned-tile-folder-target');
        }
    }

    _onButtonRelease(actor, event) {
        if (DND.isDragging())
            return Clutter.EVENT_PROPAGATE;

        let button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            this.activate();
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.itemData.type === 'app' && this.app) {
                this.applet.showAppContextMenu(this.app, this.actor, { isPinned: true });
            } else if (this.itemData.type === 'folder') {
                this.applet._openFolder(this.itemData.id, true);
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        this.applet.closeFloatingMenus();
        if (this.itemData.type === 'folder') {
            this.applet._openFolder(this.itemData.id, false);
        } else if (this.app) {
            this.applet.launchApp(this.app);
        }
    }

    getDragActor() {
        if (this.itemData.type === 'folder') {
            return this._buildFolderMiniIcon(this.itemData.apps || []);
        } else if (this.app) {
            return createAppIcon(this.app, this.applet.applicationIconSize || 32);
        }
        return new Clutter.Clone({ source: this.iconContainer });
    }

    getDragActorSource() {
        return this.iconContainer;
    }

    _onDragBegin() {
        this.applet.closeFloatingMenus();
        this.applet._onPinnedTileDragBegin(this);
    }

    _onDragCancelled() {
        this.applet._onPinnedTileDragEnd(this, false);
    }

    _onDragEnd() {
        this.applet._onPinnedTileDragEnd(this, true);
    }

    destroy() {
        this._signals.disconnectAllSignals();
        delete this._draggable;
        if (this.actor) {
            delete this.actor._delegate;
            this.actor.destroy();
            this.actor = null;
        }
    }
}

/**
 * Draggable app tile inside an open Folder modal
 */
class FolderAppTile {
    constructor(applet, folderData, appId, index) {
        this.applet = applet;
        this.folderData = folderData;
        this.appId = appId;
        this.app = appsys.lookup_app(appId);
        this.index = index;
        this.currentSlot = index;
        this.currentX = (index % FOLDER_COLS) * FOLDER_CELL_W;
        this.currentY = Math.floor(index / FOLDER_COLS) * FOLDER_CELL_H;

        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({
            style_class: 'win11-pinned-tile',
            vertical: true,
            reactive: true,
            track_hover: true,
            width: FOLDER_CELL_W,
            height: FOLDER_CELL_H,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START
        });
        this.actor._delegate = this;
        this.actor.set_position(this.currentX, this.currentY);

        this.iconContainer = new St.Bin({
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE,
            width: 42,
            height: 42
        });
        this.iconActor = createAppIcon(this.app, applet.applicationIconSize || 32);
        this.iconContainer.set_child(this.iconActor);

        this.label = new St.Label({
            text: this.app ? this.app.get_name() : appId,
            style_class: 'win11-pinned-tile-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.label.clutter_text.line_wrap = true;
        this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        this.actor.add_actor(this.iconContainer);
        this.actor.add_actor(this.label);

        this._signals.connect(this.actor, 'button-release-event', this._onButtonRelease.bind(this));

        this._draggable = DND.makeDraggable(this.actor, {
            restoreOnSuccess: false,
            dragActorOpacity: 225
        });
        this._signals.connect(this._draggable, 'drag-begin', () => {
            this.applet.closeFloatingMenus();
            this.applet._onFolderTileDragBegin(this);
        });
        this._signals.connect(this._draggable, 'drag-cancelled', () => {
            this.applet._onFolderTileDragEnd(this);
        });
        this._signals.connect(this._draggable, 'drag-end', () => {
            this.applet._onFolderTileDragEnd(this);
        });
    }

    _onButtonRelease(actor, event) {
        if (DND.isDragging())
            return Clutter.EVENT_PROPAGATE;

        let button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            if (this.app)
                this.applet.launchApp(this.app);
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.app) {
                this.applet.showAppContextMenu(this.app, this.actor, {
                    isPinned: true,
                    folderId: this.folderData.id
                });
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    getDragActor() {
        return createAppIcon(this.app, this.applet.applicationIconSize || 32);
    }

    getDragActorSource() {
        return this.iconContainer;
    }

    destroy() {
        this._signals.disconnectAllSignals();
        delete this._draggable;
        if (this.actor) {
            delete this.actor._delegate;
            this.actor.destroy();
            this.actor = null;
        }
    }
}

/**
 * PopupMenu subclass that handles Escape key hierarchically (closing folder/subview before closing menu)
 */
class Win11PopupMenu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
    }

    _onOpenStateChanged(menu, open, sourceActor) {
        if (sourceActor && sourceActor.actor) {
            sourceActor.actor.change_style_pseudo_class("checked", false);
            sourceActor.actor.change_style_pseudo_class("active", false);
        }
        if (this.launcher && this.launcher._updatePanelButtonsActiveState) {
            this.launcher._updatePanelButtonsActiveState();
        }
    }

    _calculatePosition() {
        if (!this.launcher || !this.launcher.centerMenuOnScreen) {
            return super._calculatePosition();
        }

        if (!this.actor.visible) {
            this.box.show();
        }
        let [minWidth, minHeight, natWidth, natHeight] = this.actor.get_preferred_size();
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
        if (!monitor) {
            monitor = Main.layoutManager.primaryMonitor || { x: 0, y: 0, width: global.screen_width, height: global.screen_height, index: 0 };
        }

        let x1 = monitor.x;
        let x2 = x1 + monitor.width;
        let y1 = monitor.y;
        let y2 = y1 + monitor.height;

        let panels = Main.panelManager.getPanelsInMonitor(monitor.index);
        let PanelLoc = PopupMenu.PanelLoc || { top: 0, bottom: 1, left: 2, right: 3 };

        for (let panel of panels) {
            if (!panel.getIsVisible()) continue;
            switch (panel.panelPosition) {
                case PanelLoc.top:
                    y1 += panel.actor.height;
                    break;
                case PanelLoc.bottom:
                    y2 -= panel.actor.height;
                    break;
                case PanelLoc.left:
                    x1 += panel.actor.width;
                    break;
                case PanelLoc.right:
                    x2 -= panel.actor.width;
                    break;
            }
        }

        // Windows 11 behavior: the Start menu ALWAYS opens centered horizontally on the monitor/screen
        let screenCenterX = x1 + (x2 - x1) / 2;
        let xPos = screenCenterX - (natWidth / 2);

        if (xPos < x1) xPos = x1;
        else if (xPos + natWidth > x2) xPos = x2 - natWidth;

        let yPos;
        let floatOffset = 10; // Floating margin in Windows 11 style

        switch (this._orientation) {
            case St.Side.TOP:
                this.sideFlipped = false;
                yPos = y1 + floatOffset;
                break;
            case St.Side.BOTTOM:
            default:
                this.sideFlipped = true;
                yPos = y2 - natHeight - floatOffset;
                if (yPos < y1) {
                    yPos = y2 - natHeight;
                }
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                let screenCenterY = y1 + (y2 - y1) / 2;
                yPos = screenCenterY - (natHeight / 2);
                if (yPos < y1) yPos = y1;
                else if (yPos + natHeight > y2) yPos = y2 - natHeight;
                break;
        }

        return [Math.round(xPos), Math.round(yPos)];
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            if (this.launcher && this.launcher._handleEscapeKey()) {
                return Clutter.EVENT_STOP;
            }
            this.close(false);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
}

class Win11MenuApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Win11PopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('appmenu-background');

        // Configure panel actor to hold two independent buttons: Start button + Search button
        // Do NOT use 'applet-box' so the container never gets theme-level hover/checked background
        this.actor.set_style_class_name('win11-applet-container');
        this.actor.track_hover = false;

        this.startButtonBox = new St.BoxLayout({
            style_class: 'win11-start-button grouped-window-list-item-box',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true
        });

        // Move IconApplet's icon box and TextIconApplet's label bin into startButtonBox
        this.actor.remove_actor(this._applet_icon_box);
        this.actor.remove_actor(this._layoutBin);
        this._applet_icon_box.set_fill(false, false);
        this._applet_icon_box.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);
        this.startButtonBox.add(this._applet_icon_box, { y_align: St.Align.MIDDLE, y_fill: false });
        this.startButtonBox.add(this._layoutBin, { y_align: St.Align.MIDDLE, y_fill: false });
        this._layoutBin.hide();
        this.actor.add(this.startButtonBox, { y_align: St.Align.MIDDLE, y_fill: true });

        // Build Taskbar Search Button
        this.searchPanelButton = new St.BoxLayout({
            style_class: 'win11-search-panel-pill',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.searchPanelIcon = new St.Icon({
            icon_name: 'xsi-edit-find',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16,
            style_class: 'system-status-icon',
            y_align: Clutter.ActorAlign.CENTER
        });
        this.searchPanelLabel = new St.Label({
            text: "Search",
            style_class: 'win11-search-panel-pill-label',
            y_align: Clutter.ActorAlign.CENTER
        });
        this.searchPanelButton.add(this.searchPanelIcon, { y_align: St.Align.MIDDLE, y_fill: false });
        this.searchPanelButton.add(this.searchPanelLabel, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.add(this.searchPanelButton, { y_align: St.Align.MIDDLE, y_fill: false });

        // Individualized hover feedback & tooltip for each button
        this.startButtonBox.connect('notify::hover', () => {
            if (this.startButtonBox.hover) {
                this.set_applet_tooltip(this.t('start'));
            }
        });
        this.searchPanelButton.connect('notify::hover', () => {
            if (this.searchPanelButton.hover) {
                this.set_applet_tooltip(this.t('search'));
            }
        });
        this.actor.connect('leave-event', () => {
            this.set_applet_tooltip("");
        });

        // Settings
        this.settings = new Settings.AppletSettings(this, "win11-menu@cinnamon", instance_id);

        this.settings.bind("language", "language", () => this._onLanguageChanged());
        this.settings.bind("show-search-button", "showSearchButton", () => this._updateSearchPanelButton());
        this.settings.bind("search-button-style", "searchButtonStyle", () => this._updateSearchPanelButton());
        this.settings.bind("search-button-size-mode", "searchButtonSizeMode", () => this._updateSearchPanelButton());
        this.settings.bind("search-pill-height", "searchPillHeight", () => this._updateSearchPanelButton());
        this.settings.bind("search-button-spacing", "searchButtonSpacing", () => this._updateSearchPanelButton());

        this.settings.bind("overlay-key", "overlayKey", () => this._updateKeybinding());
        this.settings.bind("menu-custom", "menuCustom", () => this._updateIconAndLabel());
        this.settings.bind("menu-icon", "menuIcon", () => this._updateIconAndLabel());
        this.settings.bind("menu-icon-size-mode", "menuIconSizeMode", () => this._updateIconAndLabel());
        this.settings.bind("menu-icon-size", "menuIconSize", () => this._updateIconAndLabel());
        this.settings.bind("menu-label", "menuLabel", () => this._updateIconAndLabel());

        this.settings.bind("application-icon-size", "applicationIconSize", () => this._fullRefresh());
        this.settings.bind("show-avatar", "showAvatar", () => this._refreshFooter());
        this.settings.bind("show-recents", "showRecents", () => this._refreshRecentSection());
        this.settings.bind("show-description", "showDescription", null);

        this.settings.bind("show-files", "showFiles", () => this._refreshFooter());
        this.settings.bind("show-settings", "showSettings", () => this._refreshFooter());
        this.settings.bind("show-downloads", "showDownloads", () => this._refreshFooter());
        this.settings.bind("show-documents", "showDocuments", () => this._refreshFooter());
        this.settings.bind("show-pictures", "showPictures", () => this._refreshFooter());
        this.settings.bind("show-music", "showMusic", () => this._refreshFooter());
        this.settings.bind("show-videos", "showVideos", () => this._refreshFooter());
        this.settings.bind("show-home", "showHome", () => this._refreshFooter());

        this.settings.bind("enable-autoscroll", "autoscrollEnabled", () => this._updateAutoscroll());
        this.settings.bind("activate-on-hover", "activateOnHover", () => this._updateActivateOnHover());
        this.settings.bind("hover-delay", "hoverDelayMs", () => this._updateActivateOnHover());
        this.settings.bind("enable-animation", "enableAnimation", null);
        this.settings.bind("center-menu-on-screen", "centerMenuOnScreen", () => this._onCenterSettingChanged());

        this.settings.bind("popup-width", "popup_width");
        this.settings.bind("popup-height", "popup_height");
        this.settings.bind("pinned-items", "pinnedItems");
        this.settings.bind("pinned-expanded", "pinnedExpanded");
        this.settings.bind("all-apps-view-mode", "allAppsViewMode");
        this.settings.bind("recent-apps", "recentApps");

        // Context menu item on panel right-click
        this._editMenuItem = new PopupMenu.PopupIconMenuItem(this.t("edit_menu"), "xsi-document-edit", St.IconType.SYMBOLIC);
        this._editMenuItem.connect("activate", () => Util.spawnCommandLine("cinnamon-menu-editor"));
        this._applet_context_menu.addMenuItem(this._editMenuItem);
        this._applet_context_menu.connect("open-state-changed", () => {
            this.actor.change_style_pseudo_class("checked", false);
            this.actor.change_style_pseudo_class("active", false);
            this.actor.change_style_pseudo_class("hover", false);
        });

        // State variables
        this._currentPopupMode = "start"; // "start" or "search"
        this._startSubView = "main";      // "main", "all-recent", or "alphabet-jumper"
        this._searchFilter = "all";       // "all", "apps", "docs", "settings"
        this._allAppsData = [];
        this._allDirsData = [];
        this._knownApps = new Set();
        this._appsWereRefreshed = false;
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
        this._pinnedTiles = [];
        this._folderTiles = [];
        this._dragState = null;
        this._folderDragState = null;
        this._openFolderId = null;
        this._folderRenaming = false;
        this._searchResultsList = [];
        this._selectedSearchResultIdx = -1;
        this._themeAccentCss = "#1f9ede";
        this._themeCardBgCss = "rgba(48, 48, 54, 0.96)";

        this.RecentManager = DocInfo.getDocManager();
        this.privacy_settings = new Gio.Settings({ schema_id: PRIVACY_SCHEMA });
        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);

        this._resizer = new Applet.PopupResizeHandler(
            this.menu.actor,
            () => this._orientation,
            (w, h) => this._onBoxResized(w, h),
            () => this.popup_width * global.ui_scale,
            () => this.popup_height * global.ui_scale
        );

        this.menu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this._buildPopupUI();
        this._ensureInitialPinnedItems();
        this._fullRefresh();

        this._updateKeybinding();
        this._updateIconAndLabel();
        this._updateSearchPanelButton();
        this._updateActivateOnHover();

        Main.themeManager.connect("theme-set", () => {
            this._size_dirty = true;
            this._updateIconAndLabel();
            this._updateThemeColors();
        });
        global.connect("scale-changed", () => {
            this._size_dirty = true;
        });

        appsys.connect('installed-changed', () => this._fullRefresh());
        AppFavorites.getAppFavorites().connect('changed', () => this._refreshFooter());
        this.RecentManager.connect('changed', () => {
            this._refreshRecentSection();
            this._refreshSearchHomeView();
        });
        this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, () => {
            this._refreshRecentSection();
            this._refreshSearchHomeView();
        });

        this.set_show_label_in_vertical_panels(false);
    }

    t(key, ...args) {
        let lang = (this.language === "ptbr") ? "ptbr" : "en";
        let dict = I18N[lang] || I18N.en;
        let str = dict[key] !== undefined ? dict[key] : (I18N.en[key] || key);
        if (args.length > 0) {
            try {
                return str.format(...args);
            } catch (e) {
                return str.replace("%s", args[0]).replace("%d", args[0]);
            }
        }
        return str;
    }

    _updateThemeColors() {
        try {
            if (this.searchEntry && this.searchEntry.get_stage()) {
                let node = this.searchEntry.get_theme_node();
                let [hasSel, selColor] = node.lookup_color('selection-background-color', false);
                if (hasSel && selColor) {
                    this._themeAccentCss = `rgb(${selColor.red}, ${selColor.green}, ${selColor.blue})`;
                }
            }
            if (this.menu && this.menu.actor && this.menu.actor.get_stage()) {
                let menuNode = this.menu.actor.get_theme_node();
                let bg = menuNode.get_background_color();
                if (bg && bg.alpha > 0) {
                    let r = Math.min(255, bg.red + 10);
                    let g = Math.min(255, bg.green + 10);
                    let b = Math.min(255, bg.blue + 12);
                    this._themeCardBgCss = `rgba(${r}, ${g}, ${b}, 0.98)`;
                }
            }
        } catch (e) {
            // Keep fallback theme colors
        }
        this._updatePanelButtonsActiveState();
    }

    _onLanguageChanged() {
        if (this._editMenuItem && this._editMenuItem.label) {
            this._editMenuItem.label.set_text(this.t("edit_menu"));
        }
        this._updateSearchPanelButton();
        this._updateSearchPlaceholder();
        this._refreshPinnedSection();
        this._refreshRecentSection();
        this._refreshAllAppsSection();
        this._refreshSearchHomeView();
        this._refreshFooter();
        this._rebuildSearchFilterPills();
    }

    _updateSearchPanelButton() {
        if (!this.showSearchButton) {
            this.searchPanelButton.hide();
            return;
        }
        this.searchPanelButton.show();
        this.searchPanelLabel.set_text(this.t("search"));

        let spacing = (this.searchButtonSpacing !== undefined) ? this.searchButtonSpacing : 5;
        this.actor.set_style('spacing: ' + spacing + 'px;');

        let ph = this._panelHeight || (this.panel ? this.panel.height : 40);

        if (this.searchButtonStyle === "icon") {
            this.searchPanelButton.set_style_class_name('win11-search-panel-icon-btn grouped-window-list-item-box');
            this.searchPanelLabel.hide();
            this.searchPanelButton.set_height(-1);
            this.searchPanelButton.set_y_align(Clutter.ActorAlign.FILL);

            let iconSize;
            if (this.menuIconSizeMode === "custom") {
                iconSize = Math.min(this.menuIconSize || 32, ph);
            } else {
                iconSize = Math.max(16, Math.min(ph - 6, Math.round(ph * 0.8)));
            }
            this.searchPanelIcon.set_style(null);
            this.searchPanelIcon.set_icon_size(iconSize);
        } else {
            this.searchPanelButton.set_style_class_name('win11-search-panel-pill');
            if (this._orientation === St.Side.LEFT || this._orientation === St.Side.RIGHT) {
                this.searchPanelLabel.hide();
            } else {
                this.searchPanelLabel.show();
            }

            let pillH;
            if (this.searchButtonSizeMode === "custom") {
                pillH = Math.max(20, Math.min(ph, this.searchPillHeight || 30));
            } else {
                // Auto: scale to ~75% of panel height (e.g. 30px on 40px panel)
                pillH = Math.max(24, Math.min(ph - 6, Math.round(ph * 0.75)));
            }

            this.searchPanelButton.set_height(pillH);
            this.searchPanelButton.set_y_align(Clutter.ActorAlign.CENTER);

            let searchIconSize = Math.max(14, Math.min(pillH - 8, Math.round(pillH * 0.54)));
            this.searchPanelIcon.set_style(null);
            this.searchPanelIcon.set_icon_size(searchIconSize);
        }
        this._updatePanelButtonsActiveState();
    }

    _updatePanelButtonsActiveState() {
        let isOpen = this.menu && this.menu.isOpen;
        let inStart = isOpen && this._currentPopupMode === "start";
        let inSearch = isOpen && this._currentPopupMode === "search";

        this.actor.change_style_pseudo_class("checked", false);
        this.actor.change_style_pseudo_class("active", false);
        this.actor.change_style_pseudo_class("hover", false);

        this.startButtonBox.change_style_pseudo_class("checked", inStart);
        this.startButtonBox.change_style_pseudo_class("active", inStart);

        this.searchPanelButton.change_style_pseudo_class("checked", inSearch);
        this.searchPanelButton.change_style_pseudo_class("active", inSearch);

        if (inSearch && this.searchButtonStyle === "pill") {
            this.searchPanelButton.set_style(
                `background-color: ${this._themeAccentCss}; border-color: ${this._themeAccentCss}; color: #ffffff;`
            );
            this.searchPanelIcon.set_style("color: #ffffff;");
            this.searchPanelLabel.set_style("color: #ffffff;");
        } else {
            this.searchPanelButton.set_style(null);
            this.searchPanelIcon.set_style(null);
            this.searchPanelLabel.set_style(null);
        }
    }

    on_applet_clicked(event) {
        let src = event.get_source();
        let clickedSearch = this.showSearchButton &&
                            this.searchPanelButton.visible &&
                            (src === this.searchPanelButton || this.searchPanelButton.contains(src));

        if (clickedSearch) {
            if (this.menu.isOpen) {
                if (this._currentPopupMode === "search") {
                    this.menu.close(this.enableAnimation);
                } else {
                    this._switchToPopupMode("search", true);
                }
            } else {
                this._currentPopupMode = "search";
                this.menu.open(this.enableAnimation);
            }
        } else {
            if (this.menu.isOpen) {
                if (this._currentPopupMode === "start") {
                    this.menu.close(this.enableAnimation);
                } else {
                    this._switchToPopupMode("start", false);
                }
            } else {
                this._currentPopupMode = "start";
                this.menu.open(this.enableAnimation);
            }
        }
    }

    _updateKeybinding() {
        Main.keybindingManager.addXletHotKey(this, "overlay-key", this.overlayKey, () => {
            if (!Main.overview.visible && !Main.expo.visible) {
                if (this.menu.isOpen && this._currentPopupMode === "search") {
                    this._switchToPopupMode("start", false);
                } else {
                    this._currentPopupMode = "start";
                    this.menu.toggle_with_options(this.enableAnimation);
                }
            }
        });
    }

    _setStyle() {
        let icon_type = this._applet_icon.get_icon_type();
        let size;
        let ph = this._panelHeight || (this.panel ? this.panel.height : 40);

        if (this.menuIconSizeMode === "custom") {
            size = Math.min(this.menuIconSize || 32, ph);
        } else {
            // Auto size: scale proportionally to panel height (~80% of panel height, e.g. 32px on 40px panel)
            size = Math.max(16, Math.min(ph - 6, Math.round(ph * 0.8)));
        }

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_style_class_name('system-status-icon');
        }

        this._applet_icon.set_style(null);
        this._applet_icon.set_icon_size(size);
        if (this._applet_icon_box) {
            this._applet_icon_box.set_style(null);
            this._applet_icon_box.set_fill(false, false);
            this._applet_icon_box.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);
        }
    }

    on_panel_height_changed() {
        this._setStyle();
        this._updateIconAndLabel();
        this._updateSearchPanelButton();
    }

    on_panel_icon_size_changed() {
        this._setStyle();
        this._updateIconAndLabel();
        this._updateSearchPanelButton();
    }

    on_orientation_changed(orientation) {
        this._updateIconAndLabel();
        this._updateSearchPanelButton();
        this._size_dirty = true;
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeXletHotKey(this, "overlay-key");
    }

    _updateIconAndLabel() {
        try {
            let iconToUse = this.menuCustom ? this.menuIcon : global.settings.get_string('app-menu-icon-name');
            if (!iconToUse) {
                iconToUse = "linuxmint-logo-ring-symbolic";
            }
            if (GLib.path_is_absolute(iconToUse) && GLib.file_test(iconToUse, GLib.FileTest.EXISTS)) {
                if (iconToUse.includes("-symbolic"))
                    this.set_applet_icon_symbolic_path(iconToUse);
                else
                    this.set_applet_icon_path(iconToUse);
            } else if (Gtk.IconTheme.get_default().has_icon(iconToUse)) {
                if (iconToUse.includes("-symbolic"))
                    this.set_applet_icon_symbolic_name(iconToUse);
                else
                    this.set_applet_icon_name(iconToUse);
            } else {
                this.set_applet_icon_symbolic_name("linuxmint-logo-ring-symbolic");
            }
        } catch (e) {
            this.set_applet_icon_symbolic_name("linuxmint-logo-ring-symbolic");
        }

        this._applet_icon_box.show();

        if (this._orientation === St.Side.LEFT || this._orientation === St.Side.RIGHT) {
            this.set_applet_label("");
            this._layoutBin.hide();
        } else {
            let lbl = this.menuCustom ? (this.menuLabel || "") : "";
            this.set_applet_label(lbl);
            if (lbl && lbl.trim().length > 0) {
                this._layoutBin.show();
            } else {
                this._layoutBin.hide();
            }
        }
    }

    _updateActivateOnHover() {
        if (this._appletEnterEventId > 0) {
            this.startButtonBox.disconnect(this._appletEnterEventId);
            this._appletEnterEventId = 0;
        }
        this._clearHoverDelay();

        if (!this.activateOnHover)
            return;

        this._appletEnterEventId = this.startButtonBox.connect('enter-event', () => {
            if (this.hoverDelayMs > 0) {
                this._appletLeaveEventId = this.startButtonBox.connect('leave-event', () => this._clearHoverDelay());
                this._appletHoverDelayId = Mainloop.timeout_add(this.hoverDelayMs, () => {
                    this._currentPopupMode = "start";
                    if (!this._applet_context_menu.isOpen)
                        this.menu.open(this.enableAnimation);
                    this._clearHoverDelay();
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                this._currentPopupMode = "start";
                if (!this._applet_context_menu.isOpen)
                    this.menu.open(this.enableAnimation);
            }
        });
    }

    _clearHoverDelay() {
        if (this._appletHoverDelayId > 0) {
            Mainloop.source_remove(this._appletHoverDelayId);
            this._appletHoverDelayId = 0;
        }
        if (this._appletLeaveEventId > 0) {
            this.startButtonBox.disconnect(this._appletLeaveEventId);
            this._appletLeaveEventId = 0;
        }
    }

    _launch_editor() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    }

    _reset_menu_size() {
        this.popup_width = 680;
        this.popup_height = 720;
        this._setMenuSize(this.popup_width, this.popup_height);
    }

    _reset_pinned_apps() {
        this.pinnedItems = [];
        this._ensureInitialPinnedItems();
        this._refreshPinnedSection();
    }

    _onBoxResized(width, height) {
        width = (width / global.ui_scale).clamp(POPUP_MIN_WIDTH, POPUP_MAX_WIDTH);
        height = (height / global.ui_scale).clamp(POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT);

        if (!this._resizer.resizingInProgress) {
            this.popup_width = width;
            this.popup_height = height;
        }
        this._setMenuSize(width, height);
    }

    _setMenuSize(width, height) {
        if (!this.mainContainer)
            return;
        this.mainContainer.natural_width = Math.round(width * global.ui_scale);
        this.mainContainer.natural_height = Math.round(height * global.ui_scale);
        this._size_dirty = false;
        if (this.menu && this.menu.isOpen) {
            let [xPos, yPos] = this.menu._calculatePosition();
            this.menu.actor.set_position(xPos, yPos);
        }
    }

    _onCenterSettingChanged() {
        if (this.menu && this.menu.isOpen) {
            let [xPos, yPos] = this.menu._calculatePosition();
            this.menu.actor.set_position(xPos, yPos);
        }
    }

    /* =====================================================================
     * POPUP UI CONSTRUCTION
     * ===================================================================== */
    _buildPopupUI() {
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        // Root overlay container so Folder modals & context/power menus can float cleanly over the menu
        this.rootStack = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true
        });
        section.addActor(this.rootStack, {
            expand: true,
            span: -1,
            align: St.Align.START
        });

        this.mainContainer = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-menu-main-box',
            x_expand: true,
            y_expand: true
        });
        this.rootStack.add_actor(this.mainContainer);
        this._setMenuSize(this.popup_width || 680, this.popup_height || 720);

        // 1. Top Search Entry Bar
        this.topSearchBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-top-search-box',
            x_expand: true
        });

        this._searchPrimaryIcon = new St.Icon({
            style_class: 'win11-search-entry-icon',
            icon_name: 'xsi-edit-find',
            icon_type: St.IconType.SYMBOLIC
        });
        this._searchClearIcon = new St.Icon({
            style_class: 'win11-search-entry-icon',
            icon_name: 'xsi-edit-clear',
            icon_type: St.IconType.SYMBOLIC
        });

        this.searchEntry = new St.Entry({
            name: 'appmenu-search-entry',
            style_class: 'win11-search-entry',
            track_hover: true,
            can_focus: true,
            x_expand: true,
            accessible_role: Atk.Role.ENTRY
        });
        this.searchEntry.set_primary_icon(this._searchPrimaryIcon);
        this._updateSearchPlaceholder();

        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', this._onSearchTextChanged.bind(this));
        this.searchEntryText.connect('key-press-event', this._onSearchKeyPress.bind(this));
        this.searchEntry.connect('button-press-event', () => {
            this.closeFloatingMenus();
            if (this._currentPopupMode === "start" && this.searchEntry.get_text().trim() === "") {
                this._switchToPopupMode("search", true);
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.topSearchBox.add(this.searchEntry, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });
        this.mainContainer.add(this.topSearchBox, { x_fill: true, expand: false });

        // 2. Center Body Area (switches between Start Mode, Search Home Mode, and Search Results Mode)
        this.bodyContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this.mainContainer.add(this.bodyContainer, { expand: true, x_fill: true, y_fill: true });

        this._buildStartModeView();
        this._buildSearchHomeView();
        this._buildSearchResultsView();

        // 3. Bottom Footer Bar (shown in Start Mode)
        this._buildFooterBar();
        this.mainContainer.add(this.footerBar, { x_fill: true, expand: false });

        // 4. Folder Modal Overlay (hidden by default)
        this._buildFolderOverlay();
        this.rootStack.add_actor(this.folderOverlay);

        // 5. Floating Context / Power Menu Layer (hidden by default)
        this._buildFloatingMenuOverlay();
        this.rootStack.add_actor(this.floatingMenuBackdrop);
    }

    _updateSearchPlaceholder() {
        if (!this.searchEntry)
            return;
        this.searchEntry.hint_text = this.t("search_placeholder");
    }

    /* =====================================================================
     * START MODE VIEW (Pinned + Recent + All in unified scroll, plus Recent Subview & Alphabet Jumper)
     * ===================================================================== */
    _buildStartModeView() {
        this.startModeBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });

        // Main unified scrollview for Start Menu (Fixado + Recente + Todos)
        this.startScrollView = new St.ScrollView({
            style_class: 'vfade win11-main-scrollview',
            x_expand: true,
            y_expand: true
        });
        this.startScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.startScrollView.set_clip_to_allocation(true);

        let vscroll = this.startScrollView.get_vscroll_bar();
        vscroll.connect('scroll-start', () => { this.menu.passEvents = true; });
        vscroll.connect('scroll-stop', () => { this.menu.passEvents = false; });

        this.startScrollContent = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-start-scroll-content',
            x_expand: true
        });
        this.startScrollView.add_actor(this.startScrollContent);

        // --- Section 1: Pinned (Fixado) ---
        this.pinnedSectionBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-section-box',
            x_expand: true
        });

        this.pinnedHeaderBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-header',
            x_expand: true
        });
        this.pinnedTitleLabel = new St.Label({
            text: this.t("pinned"),
            style_class: 'win11-section-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.pinnedToggleBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-action-btn',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.pinnedToggleBtnLabel = new St.Label({
            text: this.t("show_less"),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.pinnedToggleBtnIcon = new St.Icon({
            icon_name: 'xsi-go-up-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 12
        });
        this.pinnedToggleBtn.add_actor(this.pinnedToggleBtnLabel);
        this.pinnedToggleBtn.add_actor(this.pinnedToggleBtnIcon);
        this.pinnedToggleBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.pinnedExpanded = !this.pinnedExpanded;
                this._refreshPinnedSection();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.pinnedHeaderBox.add(this.pinnedTitleLabel, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });
        this.pinnedHeaderBox.add(this.pinnedToggleBtn, { expand: false, y_align: St.Align.MIDDLE });

        this.pinnedGridWrapper = new St.Bin({
            style_class: 'win11-pinned-grid-wrapper',
            x_align: St.Align.MIDDLE,
            x_expand: true
        });

        this.pinnedGridActor = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            reactive: true,
            width: PINNED_COLS * PINNED_CELL_W,
            height: 2 * PINNED_CELL_H
        });
        this.pinnedGridActor._delegate = {
            handleDragOver: this._handlePinnedGridDragOver.bind(this),
            handleDragOut: this._handlePinnedGridDragOut.bind(this),
            acceptDrop: this._acceptPinnedGridDrop.bind(this)
        };
        this.pinnedGridWrapper.set_child(this.pinnedGridActor);

        this.pinnedSectionBox.add_actor(this.pinnedHeaderBox);
        this.pinnedSectionBox.add_actor(this.pinnedGridWrapper);
        this.startScrollContent.add_actor(this.pinnedSectionBox);

        // --- Section 2: Recent (Recente) ---
        this.recentSectionBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-section-box',
            x_expand: true
        });
        this.recentHeaderBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-header',
            x_expand: true
        });
        this.recentTitleLabel = new St.Label({
            text: this.t("recent"),
            style_class: 'win11-section-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.recentMoreBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-action-btn',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.recentMoreBtnLabel = new St.Label({
            text: this.t("show_all"),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.recentMoreBtnIcon = new St.Icon({
            icon_name: 'xsi-go-next-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 12
        });
        this.recentMoreBtn.add_actor(this.recentMoreBtnLabel);
        this.recentMoreBtn.add_actor(this.recentMoreBtnIcon);
        this.recentMoreBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._showStartSubView("all-recent");
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.recentHeaderBox.add(this.recentTitleLabel, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });
        this.recentHeaderBox.add(this.recentMoreBtn, { expand: false, y_align: St.Align.MIDDLE });

        this.recentGridBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-recent-grid',
            x_expand: true
        });

        this.recentSectionBox.add_actor(this.recentHeaderBox);
        this.recentSectionBox.add_actor(this.recentGridBox);
        this.startScrollContent.add_actor(this.recentSectionBox);

        // --- Section 3: All (Todos) ---
        this.allAppsSectionBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-section-box',
            x_expand: true
        });
        this.allAppsHeaderBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-header',
            x_expand: true
        });
        this.allAppsTitleLabel = new St.Label({
            text: this.t("all"),
            style_class: 'win11-section-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.allAppsViewBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-action-btn',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.allAppsViewBtnLabel = new St.Label({
            text: this.t("view_list"),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.allAppsViewBtnIcon = new St.Icon({
            icon_name: 'xsi-go-down-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 12
        });
        this.allAppsViewBtn.add_actor(this.allAppsViewBtnLabel);
        this.allAppsViewBtn.add_actor(this.allAppsViewBtnIcon);
        this.allAppsViewBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                let modes = ["list", "grid", "categories"];
                let idx = modes.indexOf(this.allAppsViewMode || "list");
                this.allAppsViewMode = modes[(idx + 1) % modes.length];
                this._refreshAllAppsSection();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.allAppsHeaderBox.add(this.allAppsTitleLabel, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });
        this.allAppsHeaderBox.add(this.allAppsViewBtn, { expand: false, y_align: St.Align.MIDDLE });

        this.allAppsListBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-all-apps-box',
            x_expand: true
        });

        // Alphabet Jumper View (shown when clicking any letter header in All Apps)
        this.alphabetJumperBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-alphabet-jumper',
            x_expand: true,
            visible: false
        });

        this.allAppsSectionBox.add_actor(this.allAppsHeaderBox);
        this.allAppsSectionBox.add_actor(this.alphabetJumperBox);
        this.allAppsSectionBox.add_actor(this.allAppsListBox);
        this.startScrollContent.add_actor(this.allAppsSectionBox);

        this.startModeBox.add(this.startScrollView, { expand: true, x_fill: true, y_fill: true });

        // --- Sub-view: All Recent Items ("Mostrar tudo >" -> "<- Voltar") ---
        this.allRecentSubView = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-start-scroll-content',
            x_expand: true,
            y_expand: true,
            visible: false
        });
        let allRecentHeader = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-header',
            x_expand: true
        });
        this.allRecentSubTitle = new St.Label({
            text: this.t("recent"),
            style_class: 'win11-section-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.allRecentBackBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-section-action-btn',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        let backIcon = new St.Icon({
            icon_name: 'xsi-go-previous-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 12
        });
        this.allRecentBackLabel = new St.Label({
            text: this.t("back"),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.allRecentBackBtn.add_actor(backIcon);
        this.allRecentBackBtn.add_actor(this.allRecentBackLabel);
        this.allRecentBackBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._showStartSubView("main");
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        allRecentHeader.add(this.allRecentSubTitle, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });
        allRecentHeader.add(this.allRecentBackBtn, { expand: false, y_align: St.Align.MIDDLE });

        this.allRecentScrollView = new St.ScrollView({
            style_class: 'vfade win11-main-scrollview',
            x_expand: true,
            y_expand: true
        });
        this.allRecentScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.allRecentListBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-all-apps-box',
            x_expand: true
        });
        this.allRecentScrollView.add_actor(this.allRecentListBox);

        this.allRecentSubView.add(allRecentHeader, { expand: false, x_fill: true });
        this.allRecentSubView.add(this.allRecentScrollView, { expand: true, x_fill: true, y_fill: true });

        this.startModeBox.add(this.allRecentSubView, { expand: true, x_fill: true, y_fill: true });
        this.bodyContainer.add(this.startModeBox, { expand: true, x_fill: true, y_fill: true });
    }

    _showStartSubView(subView) {
        this._startSubView = subView;
        if (subView === "all-recent") {
            this.startScrollView.hide();
            this.allRecentSubView.show();
            this._populateAllRecentSubView();
        } else {
            this.allRecentSubView.hide();
            this.startScrollView.show();
            if (subView === "alphabet-jumper") {
                this.allAppsListBox.hide();
                this.alphabetJumperBox.show();
            } else {
                this.alphabetJumperBox.hide();
                this.allAppsListBox.show();
            }
        }
    }

    /* =====================================================================
     * SEARCH HOME VIEW (Left: Recent, Right: Quick Searches + Top Apps)
     * ===================================================================== */
    _buildSearchHomeView() {
        this.searchHomeBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-search-home-box',
            x_expand: true,
            y_expand: true,
            visible: false
        });

        // Left Column: Recent
        this.searchLeftCol = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-left-col',
            y_expand: true
        });
        this.searchRecentTitle = new St.Label({
            text: this.t("recent"),
            style_class: 'win11-search-col-title'
        });
        this.searchRecentScrollView = new St.ScrollView({
            style_class: 'vfade',
            x_expand: true,
            y_expand: true
        });
        this.searchRecentScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.searchRecentListBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-recent-list',
            x_expand: true
        });
        this.searchRecentScrollView.add_actor(this.searchRecentListBox);

        this.searchLeftCol.add(this.searchRecentTitle, { expand: false, x_fill: true });
        this.searchLeftCol.add(this.searchRecentScrollView, { expand: true, x_fill: true, y_fill: true });

        // Right Column: Quick Searches + Top Apps
        this.searchRightCol = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-right-col',
            x_expand: true,
            y_expand: true
        });

        this.quickSearchesSection = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-quick-searches-box',
            x_expand: true
        });
        this.quickSearchesTitle = new St.Label({
            text: this.t("quick_searches"),
            style_class: 'win11-search-col-title'
        });
        this.quickSearchesChipsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-quick-searches-box',
            x_expand: true
        });
        this.quickSearchesSection.add_actor(this.quickSearchesTitle);
        this.quickSearchesSection.add_actor(this.quickSearchesChipsBox);

        this.topAppsSection = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-top-apps-grid',
            x_expand: true
        });
        this.topAppsTitle = new St.Label({
            text: this.t("top_apps"),
            style_class: 'win11-search-col-title'
        });
        this.topAppsGridBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-top-apps-grid',
            x_expand: true
        });
        this.topAppsSection.add_actor(this.topAppsTitle);
        this.topAppsSection.add_actor(this.topAppsGridBox);

        this.searchRightCol.add(this.quickSearchesSection, { expand: false, x_fill: true });
        this.searchRightCol.add(this.topAppsSection, { expand: true, x_fill: true });

        this.searchHomeBox.add(this.searchLeftCol, { expand: false, y_fill: true });
        this.searchHomeBox.add(this.searchRightCol, { expand: true, x_fill: true, y_fill: true });

        this.bodyContainer.add(this.searchHomeBox, { expand: true, x_fill: true, y_fill: true });
    }

    /* =====================================================================
     * SEARCH RESULTS VIEW (Filter Pills + Results List + Right Preview Card)
     * ===================================================================== */
    _buildSearchResultsView() {
        this.searchResultsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-results-box',
            x_expand: true,
            y_expand: true,
            visible: false
        });

        this.searchFilterBar = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-search-filter-bar',
            x_expand: true
        });
        this._rebuildSearchFilterPills();

        this.searchResultsColumns = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-search-results-columns',
            x_expand: true,
            y_expand: true
        });

        this.searchResultsScrollView = new St.ScrollView({
            style_class: 'vfade',
            x_expand: true,
            y_expand: true
        });
        this.searchResultsScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.searchResultsListBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-results-list-box',
            x_expand: true
        });
        this.searchResultsScrollView.add_actor(this.searchResultsListBox);

        this.searchPreviewPane = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-preview-pane',
            y_expand: true
        });

        this.searchResultsColumns.add(this.searchResultsScrollView, { expand: true, x_fill: true, y_fill: true });
        this.searchResultsColumns.add(this.searchPreviewPane, { expand: false, y_fill: true });

        this.searchResultsBox.add(this.searchFilterBar, { expand: false, x_fill: true });
        this.searchResultsBox.add(this.searchResultsColumns, { expand: true, x_fill: true, y_fill: true });

        this.bodyContainer.add(this.searchResultsBox, { expand: true, x_fill: true, y_fill: true });
    }

    _rebuildSearchFilterPills() {
        if (!this.searchFilterBar)
            return;
        this.searchFilterBar.destroy_all_children();

        const filters = [
            { id: "all", label: this.t("filter_all") },
            { id: "apps", label: this.t("filter_apps") },
            { id: "docs", label: this.t("filter_docs") },
            { id: "settings", label: this.t("filter_settings") }
        ];

        filters.forEach(f => {
            let isActive = this._searchFilter === f.id;
            let btn = new St.BoxLayout({
                style_class: isActive ? 'win11-search-filter-pill-active' : 'win11-search-filter-pill',
                reactive: true,
                track_hover: true
            });
            let lbl = new St.Label({ text: f.label, y_align: Clutter.ActorAlign.CENTER });
            btn.add_actor(lbl);
            btn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                    this._searchFilter = f.id;
                    this._rebuildSearchFilterPills();
                    let query = this.searchEntry.get_text().trim();
                    if (query !== "") {
                        this._doSearch(query);
                    }
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            this.searchFilterBar.add_actor(btn);
        });
    }

    /* =====================================================================
     * BOTTOM FOOTER BAR (User Profile on Left, Quick Places + Power on Right)
     * ===================================================================== */
    _buildFooterBar() {
        this.footerBar = new St.BoxLayout({
            vertical: false,
            style_class: 'appmenu-sidebar win11-footer-bar',
            x_expand: true
        });

        this.userProfileBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-user-profile-btn',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.userProfileBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.menu.close();
                Util.spawnCommandLine("cinnamon-settings user");
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.footerActionsBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-footer-actions-box',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.footerSpacer = new St.Widget({ x_expand: true });

        this.footerBar.add(this.userProfileBtn, { expand: false, y_align: St.Align.MIDDLE });
        this.footerBar.add(this.footerSpacer, { expand: true });
        this.footerBar.add(this.footerActionsBox, { expand: false, y_align: St.Align.MIDDLE });
    }

    _refreshFooter() {
        if (!this.footerBar)
            return;

        // 1. User Avatar & Name
        this.userProfileBtn.destroy_all_children();
        if (this.showAvatar) {
            this.userProfileBtn.show();
            try {
                let user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
                let avatar = new UserWidget.Avatar(user, { iconSize: 28 });
                this.userProfileBtn.add_actor(avatar.actor);
                let updateUser = () => {
                    avatar.update();
                    let realName = user.get_real_name() || GLib.get_real_name() || GLib.get_user_name();
                    if (this._userNameLabel)
                        this._userNameLabel.set_text(realName);
                };
                let realName = (user && user.is_loaded && user.get_real_name()) ? user.get_real_name() : (GLib.get_real_name() || GLib.get_user_name());
                this._userNameLabel = new St.Label({
                    text: realName,
                    style_class: 'win11-user-name-label',
                    y_align: Clutter.ActorAlign.CENTER
                });
                this.userProfileBtn.add_actor(this._userNameLabel);
                if (user) {
                    user.connect('notify::is-loaded', updateUser);
                    user.connect('changed', updateUser);
                    if (user.is_loaded)
                        updateUser();
                }
            } catch (e) {
                let fallbackIcon = new St.Icon({
                    icon_name: 'avatar-default-symbolic',
                    icon_size: 24,
                    icon_type: St.IconType.SYMBOLIC
                });
                let fallbackLabel = new St.Label({
                    text: GLib.get_real_name() || GLib.get_user_name(),
                    style_class: 'win11-user-name-label',
                    y_align: Clutter.ActorAlign.CENTER
                });
                this.userProfileBtn.add_actor(fallbackIcon);
                this.userProfileBtn.add_actor(fallbackLabel);
            }
        } else {
            this.userProfileBtn.hide();
        }

        // 2. Quick Places & Power Button on Right
        this.footerActionsBox.destroy_all_children();

        const addFooterBtn = (iconName, tooltip, onClick) => {
            let btn = new St.Button({
                style_class: 'win11-footer-icon-btn',
                reactive: true,
                track_hover: true,
                accessible_name: tooltip
            });
            let icon = new St.Icon({
                icon_name: iconName,
                icon_size: 16,
                icon_type: St.IconType.SYMBOLIC
            });
            btn.set_child(icon);
            btn.connect('clicked', () => onClick(btn));
            this.footerActionsBox.add_actor(btn);
            return btn;
        };

        if (this.showFiles) {
            addFooterBtn('xsi-folder-symbolic', this.t('file_explorer'), () => {
                this.menu.close();
                Util.spawnCommandLine("xdg-open " + GLib.shell_quote(GLib.get_home_dir()));
            });
        }

        if (this.showSettings) {
            addFooterBtn('xsi-preferences-symbolic', this.t('system_settings'), () => {
                this.menu.close();
                Util.spawnCommandLine("cinnamon-settings");
            });
        }

        const addSpecialDirBtn = (enabled, dirEnum, iconName, labelKey) => {
            if (!enabled)
                return;
            let path = GLib.get_user_special_dir(dirEnum);
            if (!path)
                return;
            addFooterBtn(iconName, this.t(labelKey), () => {
                this.menu.close();
                Util.spawnCommandLine("xdg-open " + GLib.shell_quote(path));
            });
        };

        addSpecialDirBtn(this.showDownloads, GLib.UserDirectory.DIRECTORY_DOWNLOAD, 'folder-download-symbolic', 'downloads');
        addSpecialDirBtn(this.showDocuments, GLib.UserDirectory.DIRECTORY_DOCUMENTS, 'folder-documents-symbolic', 'documents');
        addSpecialDirBtn(this.showPictures, GLib.UserDirectory.DIRECTORY_PICTURES, 'folder-pictures-symbolic', 'pictures');
        addSpecialDirBtn(this.showMusic, GLib.UserDirectory.DIRECTORY_MUSIC, 'folder-music-symbolic', 'music');
        addSpecialDirBtn(this.showVideos, GLib.UserDirectory.DIRECTORY_VIDEOS, 'folder-videos-symbolic', 'videos');

        if (this.showHome) {
            addFooterBtn('user-home-symbolic', this.t('personal_folder'), () => {
                this.menu.close();
                Util.spawnCommandLine("xdg-open " + GLib.shell_quote(GLib.get_home_dir()));
            });
        }

        // Power Button (far right)
        this.powerBtn = addFooterBtn('xsi-shutdown', this.t('power'), (btn) => {
            this.showPowerMenu(btn);
        });
    }

    /* =====================================================================
     * FOLDER OVERLAY MODAL (Rename with "Nova Pasta" pre-selected + Grid + Drag out)
     * ===================================================================== */
    _buildFolderOverlay() {
        this.folderOverlay = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-folder-overlay',
            reactive: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false
        });

        // Clicking outside the folder card (or dropping a folder item on the backdrop)
        this.folderOverlay._delegate = {
            handleDragOver: (source, actor, x, y, time) => {
                if (source instanceof FolderAppTile) {
                    let [r, cardX, cardY] = this.folderCard.transform_stage_point(
                        actor.x + actor.width / 2,
                        actor.y + actor.height / 2
                    );
                    if (cardX < 0 || cardY < 0 || cardX > this.folderCard.width || cardY > this.folderCard.height) {
                        return DND.DragMotionResult.MOVE_DROP;
                    }
                }
                return DND.DragMotionResult.CONTINUE;
            },
            acceptDrop: (source, actor, x, y, time) => {
                if (source instanceof FolderAppTile) {
                    Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                        this._removeAppFromFolder(source.folderData.id, source.appId, true);
                        return false;
                    });
                    return true;
                }
                return false;
            }
        };

        this.folderOverlay.connect('button-release-event', (actor, event) => {
            let src = event.get_source();
            if (src === this.folderOverlay) {
                if (this._folderRenaming) {
                    this._commitFolderRename();
                } else {
                    this._closeFolder();
                }
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.folderCard = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-folder-card',
            reactive: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.folderCard.connect('button-release-event', (actor, event) => {
            let src = event.get_source();
            if (this._folderRenaming && src !== this.folderTitleEntry && !this.folderTitleEntry.contains(src)) {
                this._commitFolderRename();
            }
            return Clutter.EVENT_STOP;
        });

        this.folderHeaderBox = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-folder-header',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.folderTitleBtn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-folder-title-btn',
            reactive: true,
            track_hover: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.folderTitleLabel = new St.Label({
            text: "",
            style_class: 'win11-folder-title-label',
            y_align: Clutter.ActorAlign.CENTER
        });
        let editIcon = new St.Icon({
            icon_name: 'xsi-document-edit-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 14
        });
        this.folderTitleBtn.add_actor(this.folderTitleLabel);
        this.folderTitleBtn.add_actor(editIcon);
        this.folderTitleBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._enterFolderRenameMode();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.folderTitleEntry = new St.Entry({
            name: 'appmenu-search-entry',
            style_class: 'win11-folder-title-entry',
            can_focus: true,
            track_hover: true,
            visible: false
        });
        this.folderTitleEntry.clutter_text.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                this._commitFolderRename();
                return Clutter.EVENT_STOP;
            } else if (symbol === Clutter.KEY_Escape) {
                this._commitFolderRename(true);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.folderHeaderBox.add_actor(this.folderTitleBtn);
        this.folderHeaderBox.add_actor(this.folderTitleEntry);

        this.folderGridActor = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            reactive: true,
            width: FOLDER_COLS * FOLDER_CELL_W,
            height: 2 * FOLDER_CELL_H
        });
        this.folderGridActor._delegate = {
            handleDragOver: this._handleFolderGridDragOver.bind(this),
            acceptDrop: this._acceptFolderGridDrop.bind(this)
        };

        this.folderCard.add_actor(this.folderHeaderBox);
        this.folderCard.add_actor(this.folderGridActor);
        this.folderOverlay.add_actor(this.folderCard);
    }

    _openFolder(folderId, startInRenameMode = false) {
        let folderData = (this.pinnedItems || []).find(item => item.type === 'folder' && item.id === folderId);
        if (!folderData)
            return;

        this._openFolderId = folderId;
        this._updateThemeColors();
        this.folderCard.set_style(`background-color: ${this._themeCardBgCss};`);

        let folderName = folderData.name || this.t('new_folder');
        this.folderTitleLabel.set_text(folderName);
        this.folderTitleEntry.set_text(folderName);

        this._rebuildFolderGrid(folderData);
        this.folderOverlay.show();

        if (startInRenameMode) {
            this._enterFolderRenameMode();
        } else {
            this._folderRenaming = false;
            this.folderTitleEntry.hide();
            this.folderTitleBtn.show();
        }
    }

    _enterFolderRenameMode() {
        let folderData = (this.pinnedItems || []).find(item => item.type === 'folder' && item.id === this._openFolderId);
        if (!folderData)
            return;

        this._folderRenaming = true;
        let currentName = folderData.name || this.t('new_folder');
        this.folderTitleBtn.hide();
        this.folderTitleEntry.show();
        this.folderTitleEntry.set_text(currentName);

        const focusAndSelectAll = () => {
            if (!this._folderRenaming || !this.folderOverlay.visible)
                return GLib.SOURCE_REMOVE;
            let ct = this.folderTitleEntry.clutter_text;
            ct.set_editable(true);
            ct.set_selectable(true);
            global.stage.set_key_focus(ct);
            ct.grab_key_focus();
            ct.set_selection(0, -1);
            return GLib.SOURCE_REMOVE;
        };

        focusAndSelectAll();
        Mainloop.timeout_add(25, focusAndSelectAll);
        Mainloop.timeout_add(90, focusAndSelectAll);
    }

    _commitFolderRename(cancel = false) {
        if (!this._folderRenaming)
            return;
        this._folderRenaming = false;

        let folderData = (this.pinnedItems || []).find(item => item.type === 'folder' && item.id === this._openFolderId);
        if (folderData) {
            if (!cancel) {
                let newName = this.folderTitleEntry.get_text().trim();
                folderData.name = newName !== "" ? newName : this.t('new_folder');
                this._savePinnedItems();
            }
            this.folderTitleLabel.set_text(folderData.name);
        }

        this.folderTitleEntry.hide();
        this.folderTitleBtn.show();
        this._refreshPinnedSection();
    }

    _closeFolder() {
        if (this._folderRenaming) {
            this._commitFolderRename();
        }
        this._openFolderId = null;
        this.folderOverlay.hide();
        this._folderTiles.forEach(t => t.destroy());
        this._folderTiles = [];
    }

    _rebuildFolderGrid(folderData) {
        this._folderTiles.forEach(t => t.destroy());
        this._folderTiles = [];
        this.folderGridActor.destroy_all_children();

        let apps = folderData.apps || [];
        let rows = Math.max(2, Math.ceil(apps.length / FOLDER_COLS));
        this.folderGridActor.set_size(FOLDER_COLS * FOLDER_CELL_W, rows * FOLDER_CELL_H);

        apps.forEach((appId, idx) => {
            let tile = new FolderAppTile(this, folderData, appId, idx);
            this._folderTiles.push(tile);
            this.folderGridActor.add_actor(tile.actor);
        });
    }

    _onFolderTileDragBegin(tile) {
        this._folderDragState = {
            sourceIndex: tile.index,
            previewSlot: tile.index
        };
        tile.actor.opacity = 65;
    }

    _onFolderTileDragEnd(tile) {
        if (tile && tile.actor)
            tile.actor.opacity = 255;
        this._folderDragState = null;
    }

    _handleFolderGridDragOver(source, actor, x, y, time) {
        if (!(source instanceof FolderAppTile))
            return DND.DragMotionResult.NO_DROP;

        if (!this._folderDragState) {
            this._folderDragState = {
                sourceIndex: source.index,
                previewSlot: source.index
            };
        }

        let col = Math.max(0, Math.min(FOLDER_COLS - 1, Math.floor(x / FOLDER_CELL_W)));
        let row = Math.max(0, Math.floor(y / FOLDER_CELL_H));
        let targetSlot = Math.max(0, Math.min(this._folderTiles.length - 1, row * FOLDER_COLS + col));

        if (targetSlot !== this._folderDragState.previewSlot) {
            this._folderDragState.previewSlot = targetSlot;
            let srcIdx = this._folderDragState.sourceIndex;
            this._folderTiles.forEach(t => {
                let newSlot = t.index;
                if (t.index === srcIdx) {
                    newSlot = targetSlot;
                } else if (srcIdx < targetSlot && t.index > srcIdx && t.index <= targetSlot) {
                    newSlot = t.index - 1;
                } else if (srcIdx > targetSlot && t.index >= targetSlot && t.index < srcIdx) {
                    newSlot = t.index + 1;
                }
                if (newSlot !== t.currentSlot) {
                    t.currentSlot = newSlot;
                    t.currentX = (newSlot % FOLDER_COLS) * FOLDER_CELL_W;
                    t.currentY = Math.floor(newSlot / FOLDER_COLS) * FOLDER_CELL_H;
                    t.actor.ease({
                        x: t.currentX,
                        y: t.currentY,
                        duration: 150,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD
                    });
                }
            });
        }
        return DND.DragMotionResult.MOVE_DROP;
    }

    _acceptFolderGridDrop(source, actor, x, y, time) {
        if (!(source instanceof FolderAppTile) || !this._folderDragState)
            return false;

        let srcIdx = this._folderDragState.sourceIndex;
        let dstIdx = this._folderDragState.previewSlot;
        let folderData = source.folderData;

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            if (srcIdx !== dstIdx && folderData && folderData.apps) {
                let [moved] = folderData.apps.splice(srcIdx, 1);
                folderData.apps.splice(dstIdx, 0, moved);
                this._savePinnedItems();
                this._rebuildFolderGrid(folderData);
                this._refreshPinnedSection();
            } else if (source.actor) {
                source.actor.opacity = 255;
            }
            return false;
        });
        return true;
    }

    _removeAppFromFolder(folderId, appId, keepOnPinnedGrid = true) {
        let folderIdx = (this.pinnedItems || []).findIndex(item => item.type === 'folder' && item.id === folderId);
        if (folderIdx === -1)
            return;

        let folderData = this.pinnedItems[folderIdx];
        folderData.apps = (folderData.apps || []).filter(id => id !== appId);

        if (keepOnPinnedGrid) {
            this.pinnedItems.splice(folderIdx + 1, 0, { type: 'app', id: appId });
        }

        // If 1 or 0 apps remain in the folder, dissolve the folder just like Windows 11
        if (folderData.apps.length === 1) {
            let remainingAppId = folderData.apps[0];
            this.pinnedItems[folderIdx] = { type: 'app', id: remainingAppId };
            this._closeFolder();
        } else if (folderData.apps.length === 0) {
            this.pinnedItems.splice(folderIdx, 1);
            this._closeFolder();
        } else if (this._openFolderId === folderId) {
            this._rebuildFolderGrid(folderData);
        }

        this._savePinnedItems();
        this._refreshPinnedSection();
    }

    /* =====================================================================
     * FLOATING CONTEXT MENU & POWER MENU OVERLAY
     * ===================================================================== */
    _buildFloatingMenuOverlay() {
        this.floatingMenuBackdrop = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            reactive: true,
            x_expand: true,
            y_expand: true,
            visible: false
        });
        this.floatingMenuBackdrop.connect('button-press-event', (actor, event) => {
            if (event.get_source() === this.floatingMenuBackdrop) {
                this.closeFloatingMenus();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.floatingMenuBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-floating-menu',
            reactive: true
        });
        this.floatingMenuBackdrop.add_actor(this.floatingMenuBox);
    }

    closeFloatingMenus() {
        if (this.floatingMenuBackdrop) {
            this.floatingMenuBackdrop.hide();
            this.floatingMenuBox.destroy_all_children();
        }
    }

    _showFloatingMenuAtActor(anchorActor, items) {
        this.floatingMenuBox.destroy_all_children();
        this._updateThemeColors();
        this.floatingMenuBox.set_style(`background-color: ${this._themeCardBgCss};`);

        items.forEach(item => {
            if (item.separator) {
                let sep = new PopupMenu.PopupSeparatorMenuItem();
                this.floatingMenuBox.add_actor(sep.actor);
                return;
            }
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-floating-menu-item',
                reactive: true,
                track_hover: true
            });
            if (item.icon) {
                let ic = new St.Icon({
                    icon_name: item.icon,
                    icon_size: 14,
                    icon_type: St.IconType.SYMBOLIC
                });
                row.add_actor(ic);
            }
            let lbl = new St.Label({
                text: item.label,
                y_align: Clutter.ActorAlign.CENTER
            });
            row.add_actor(lbl);
            row.connect('button-release-event', (actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                    this.closeFloatingMenus();
                    item.action();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            this.floatingMenuBox.add_actor(row);
        });

        this.floatingMenuBackdrop.show();

        Mainloop.idle_add(() => {
            if (!this.floatingMenuBackdrop.visible || !anchorActor.get_stage())
                return GLib.SOURCE_REMOVE;
            let [rootX, rootY] = this.rootStack.get_transformed_position();
            let [rootW, rootH] = this.rootStack.get_transformed_size();
            let [actX, actY] = anchorActor.get_transformed_position();
            let [actW, actH] = anchorActor.get_transformed_size();
            let [menuW, menuH] = this.floatingMenuBox.get_transformed_size();

            let relX = actX - rootX;
            let relY = actY - rootY + actH + 4;

            if (relX + menuW > rootW - 12)
                relX = Math.max(12, rootW - menuW - 12);
            if (relY + menuH > rootH - 12)
                relY = Math.max(12, actY - rootY - menuH - 4);

            this.floatingMenuBox.set_position(Math.round(relX), Math.round(relY));
            return GLib.SOURCE_REMOVE;
        });
    }

    showPowerMenu(anchorActor) {
        let items = [
            {
                label: this.t("lock_screen"),
                icon: "xsi-lock-screen",
                action: () => {
                    this.menu.close();
                    let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
                    let screensaver_dialog = GLib.find_program_in_path("cinnamon-screensaver-command");
                    if (screensaver_dialog) {
                        if (screensaver_settings.get_boolean("ask-for-away-message"))
                            Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                        else
                            Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    } else {
                        this._screenSaverProxy.LockRemote("");
                    }
                }
            },
            {
                label: this.t("suspend"),
                icon: "weather-clear-night-symbolic",
                action: () => {
                    this.menu.close();
                    Util.spawnCommandLine("systemctl suspend");
                }
            },
            {
                label: this.t("log_out"),
                icon: "xsi-log-out",
                action: () => {
                    this.menu.close();
                    this._session.LogoutRemote(0);
                }
            },
            {
                label: this.t("restart"),
                icon: "xsi-view-refresh-symbolic",
                action: () => {
                    this.menu.close();
                    Util.spawnCommandLine("systemctl reboot");
                }
            },
            {
                label: this.t("shut_down"),
                icon: "xsi-shutdown",
                action: () => {
                    this.menu.close();
                    this._session.ShutdownRemote();
                }
            }
        ];
        this._showFloatingMenuAtActor(anchorActor, items);
    }

    showAppContextMenu(app, anchorActor, options = {}) {
        if (!app)
            return;
        let appId = app.get_id();
        let isPinned = this.isAppPinned(appId);
        let items = [];

        if (isPinned) {
            items.push({
                label: this.t("unpin_from_start"),
                icon: "xsi-starred",
                action: () => this.unpinApp(appId)
            });
        } else {
            items.push({
                label: this.t("pin_to_start"),
                icon: "view-pin-symbolic",
                action: () => this.pinApp(appId)
            });
        }

        if (options.folderId) {
            items.push({
                label: this.t("remove_from_folder"),
                icon: "xsi-list-remove-symbolic",
                action: () => this._removeAppFromFolder(options.folderId, appId, true)
            });
        }

        if (Main.gpu_offload_supported) {
            items.push({
                label: this.t("run_dedicated_gpu"),
                icon: "xsi-cpu",
                action: () => {
                    try {
                        this.recordRecentApp(appId);
                        app.launch_offloaded(0, [], -1);
                        this.menu.close();
                    } catch (e) {
                        global.logError(e);
                    }
                }
            });
        }

        items.push({
            label: this.t("add_to_panel"),
            icon: "xsi-list-add",
            action: () => this._addAppToPanel(app)
        });

        if (USER_DESKTOP_PATH) {
            items.push({
                label: this.t("add_to_desktop"),
                icon: "xsi-computer",
                action: () => this._addAppToDesktop(app)
            });
        }

        let isFav = AppFavorites.getAppFavorites().isFavorite(appId);
        items.push({
            label: isFav ? this.t("remove_from_favorites") : this.t("add_to_favorites"),
            icon: isFav ? "xsi-starred" : "xsi-non-starred",
            action: () => {
                if (isFav)
                    AppFavorites.getAppFavorites().removeFavorite(appId);
                else
                    AppFavorites.getAppFavorites().addFavorite(appId);
            }
        });

        const appinfo = app.get_app_info();
        if (appinfo && appinfo.get_filename() != null) {
            items.push({
                label: this.t("properties"),
                icon: "xsi-document-properties-symbolic",
                action: () => {
                    this.menu.close();
                    Util.spawnCommandLine("cinnamon-desktop-editor -mlauncher -o" + GLib.shell_quote(appinfo.get_filename()));
                }
            });
        }

        if (this._canUninstallApps && appinfo && appinfo.get_filename() != null) {
            items.push({
                label: this.t("uninstall"),
                icon: "xsi-edit-delete",
                action: () => {
                    this.menu.close();
                    Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + appinfo.get_filename() + "'");
                }
            });
        }

        if (appinfo) {
            let actions = appinfo.list_actions();
            if (actions.length > 0) {
                items.push({ separator: true });
                for (const act of actions) {
                    let label = appinfo.get_action_name(act);
                    let icon = Util.getDesktopActionIcon(act);
                    items.push({
                        label: label,
                        icon: icon,
                        action: () => {
                            this.menu.close();
                            appinfo.launch_action(act, global.create_app_launch_context());
                        }
                    });
                }
            }
        }

        this._showFloatingMenuAtActor(anchorActor, items);
    }

    _addAppToPanel(app) {
        if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
            let new_applet_id = global.settings.get_int("next-applet-id");
            global.settings.set_int("next-applet-id", (new_applet_id + 1));
            let enabled_applets = global.settings.get_strv("enabled-applets");
            enabled_applets.push("panel1:right:0:panel-launchers@cinnamon.org:" + new_applet_id);
            global.settings.set_strv("enabled-applets", enabled_applets);
        }
        let retries = 10;
        Mainloop.timeout_add(100, () => {
            if (retries--) {
                let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                if (!launcherApplet)
                    return true;
                launcherApplet.acceptNewLauncher(app.get_id());
            }
            return false;
        });
        this.menu.close();
    }

    _addAppToDesktop(app) {
        try {
            let file = Gio.file_new_for_path(app.get_app_info().get_filename());
            let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + "/" + file.get_basename());
            file.copy(destFile, 0, null, function() {});
            FileUtils.changeModeGFile(destFile, 755);
        } catch (e) {
            global.log(e);
        }
        this.menu.close();
    }

    /* =====================================================================
     * PINNED APPS MANAGEMENT, DND AUTO-ARRANGE & FOLDER CREATION
     * ===================================================================== */
    _ensureInitialPinnedItems() {
        if (Array.isArray(this.pinnedItems) && this.pinnedItems.length > 0) {
            // Filter out any uninstalled apps
            let cleaned = [];
            for (let item of this.pinnedItems) {
                if (item.type === 'folder' && Array.isArray(item.apps)) {
                    let validApps = item.apps.filter(id => appsys.lookup_app(id) != null);
                    if (validApps.length >= 2) {
                        cleaned.push({ type: 'folder', id: item.id, name: item.name, apps: validApps });
                    } else if (validApps.length === 1) {
                        cleaned.push({ type: 'app', id: validApps[0] });
                    }
                } else if (item.type === 'app' && appsys.lookup_app(item.id) != null) {
                    cleaned.push({ type: 'app', id: item.id });
                }
            }
            if (cleaned.length > 0) {
                this.pinnedItems = cleaned;
                return;
            }
        }

        // Seed default pinned apps from Cinnamon favorites + common system apps
        let seedIds = [];
        let favs = global.settings.get_strv('favorite-apps') || [];
        favs.forEach(id => {
            if (!seedIds.includes(id) && appsys.lookup_app(id))
                seedIds.push(id);
        });

        let [allApps] = AppUtils.getApps();
        const preferredMatches = [
            "nemo.desktop", "org.gnome.Terminal.desktop", "firefox.desktop",
            "cinnamon-settings.desktop", "org.gnome.Calculator.desktop",
            "xed.desktop", "org.x.editor.desktop", "mintinstall.desktop",
            "org.gnome.Screenshot.desktop", "pix.desktop", "celluloid.desktop",
            "rhythmbox.desktop", "thunderbird.desktop", "libreoffice-writer.desktop",
            "libreoffice-calc.desktop", "org.gnome.DiskUtility.desktop",
            "gnome-system-monitor.desktop", " mintupdate.desktop", " synaptic.desktop"
        ];
        preferredMatches.forEach(id => {
            let cleanId = id.trim();
            if (!seedIds.includes(cleanId) && appsys.lookup_app(cleanId)) {
                seedIds.push(cleanId);
            }
        });

        for (let [app] of allApps) {
            if (seedIds.length >= 24)
                break;
            let id = app.get_id();
            if (id && !seedIds.includes(id))
                seedIds.push(id);
        }

        this.pinnedItems = seedIds.map(id => ({ type: 'app', id: id }));
    }

    _savePinnedItems() {
        this.pinnedItems = JSON.parse(JSON.stringify(this.pinnedItems || []));
    }

    isAppPinned(appId) {
        if (!Array.isArray(this.pinnedItems))
            return false;
        for (let item of this.pinnedItems) {
            if (item.type === 'app' && item.id === appId)
                return true;
            if (item.type === 'folder' && Array.isArray(item.apps) && item.apps.includes(appId))
                return true;
        }
        return false;
    }

    pinApp(appId) {
        if (this.isAppPinned(appId))
            return;
        this.pinnedItems.push({ type: 'app', id: appId });
        this._savePinnedItems();
        this._refreshPinnedSection();
    }

    unpinApp(appId) {
        for (let i = this.pinnedItems.length - 1; i >= 0; i--) {
            let item = this.pinnedItems[i];
            if (item.type === 'app' && item.id === appId) {
                this.pinnedItems.splice(i, 1);
            } else if (item.type === 'folder' && Array.isArray(item.apps)) {
                let idx = item.apps.indexOf(appId);
                if (idx !== -1) {
                    this._removeAppFromFolder(item.id, appId, false);
                    return;
                }
            }
        }
        this._savePinnedItems();
        this._refreshPinnedSection();
    }

    _refreshPinnedSection() {
        if (!this.pinnedGridActor)
            return;

        this.pinnedTitleLabel.set_text(this.t("pinned"));
        if (this.pinnedExpanded) {
            this.pinnedToggleBtnLabel.set_text(this.t("show_less"));
            this.pinnedToggleBtnIcon.set_icon_name('xsi-go-up-symbolic');
        } else {
            this.pinnedToggleBtnLabel.set_text(this.t("show_all"));
            this.pinnedToggleBtnIcon.set_icon_name('xsi-go-down-symbolic');
        }

        this._pinnedTiles.forEach(t => t.destroy());
        this._pinnedTiles = [];
        this.pinnedGridActor.destroy_all_children();

        let items = this.pinnedItems || [];
        let maxVisible = this.pinnedExpanded ? items.length : Math.min(items.length, PINNED_COLS * 2);
        let visibleCount = Math.max(1, maxVisible);
        let numRows = Math.max(2, Math.ceil(visibleCount / PINNED_COLS));

        this.pinnedGridActor.set_size(PINNED_COLS * PINNED_CELL_W, numRows * PINNED_CELL_H);

        for (let i = 0; i < maxVisible; i++) {
            let tile = new PinnedTile(this, items[i], i);
            this._pinnedTiles.push(tile);
            this.pinnedGridActor.add_actor(tile.actor);
        }
    }

    _onPinnedTileDragBegin(tile) {
        this._dragState = {
            sourceIndex: tile.index,
            previewSlot: tile.index,
            folderTargetIndex: -1,
            hoverEdgeSlot: -1,
            hoverEdgeStartTime: 0
        };
        tile.actor.opacity = 60;
    }

    _onPinnedTileDragEnd(tile, success) {
        this._pinnedTiles.forEach(t => {
            t.setFolderDropTarget(false);
            if (t.actor)
                t.actor.opacity = 255;
        });
        if (!success) {
            this._resetPinnedTilesPositions();
        }
        this._dragState = null;
    }

    _resetPinnedTilesPositions() {
        this._pinnedTiles.forEach(t => {
            t.currentSlot = t.index;
            t.currentX = (t.index % PINNED_COLS) * PINNED_CELL_W;
            t.currentY = Math.floor(t.index / PINNED_COLS) * PINNED_CELL_H;
            if (t.actor) {
                t.actor.ease({
                    x: t.currentX,
                    y: t.currentY,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            }
        });
    }

    _handlePinnedGridDragOut() {
        this._pinnedTiles.forEach(t => t.setFolderDropTarget(false));
        if (this._dragState) {
            this._dragState.folderTargetIndex = -1;
        }
    }

    _handlePinnedGridDragOver(source, actor, x, y, time) {
        let isPinnedTile = source instanceof PinnedTile;
        let isExternalApp = !isPinnedTile && source && source.app;

        if (!isPinnedTile && !isExternalApp)
            return DND.DragMotionResult.NO_DROP;

        if (isPinnedTile && !this._dragState) {
            this._dragState = {
                sourceIndex: source.index,
                previewSlot: source.index,
                folderTargetIndex: -1,
                hoverEdgeSlot: -1,
                hoverEdgeStartTime: 0
            };
        }

        let canMergeFolder = isExternalApp || (isPinnedTile && source.itemData.type === 'app');

        // 1. Check if cursor is directly over the icon center of any other visible tile -> Folder Creation / Merge Target!
        let foundFolderTarget = null;
        if (canMergeFolder) {
            for (let t of this._pinnedTiles) {
                if (isPinnedTile && t.index === source.index)
                    continue;
                let iconLeft = t.currentX + 17;
                let iconRight = t.currentX + PINNED_CELL_W - 17;
                let iconTop = t.currentY + 6;
                let iconBottom = t.currentY + 48;

                if (x >= iconLeft && x <= iconRight && y >= iconTop && y <= iconBottom) {
                    foundFolderTarget = t;
                    break;
                }
            }
        }

        if (foundFolderTarget) {
            this._pinnedTiles.forEach(t => t.setFolderDropTarget(t === foundFolderTarget));
            if (this._dragState) {
                this._dragState.folderTargetIndex = foundFolderTarget.index;
                this._dragState.hoverEdgeSlot = -1;
            }
            this._externalFolderTargetIndex = foundFolderTarget.index;
            return DND.DragMotionResult.COPY_DROP;
        }

        // 2. Otherwise, we are in Auto-Arrange / Reorder zone!
        this._pinnedTiles.forEach(t => t.setFolderDropTarget(false));
        this._externalFolderTargetIndex = -1;

        if (!isPinnedTile) {
            return DND.DragMotionResult.COPY_DROP;
        }

        this._dragState.folderTargetIndex = -1;

        let col = Math.max(0, Math.min(PINNED_COLS - 1, Math.floor(x / PINNED_CELL_W)));
        let row = Math.max(0, Math.floor(y / PINNED_CELL_H));
        let targetSlot = Math.max(0, Math.min(this._pinnedTiles.length - 1, row * PINNED_COLS + col));

        if (targetSlot !== this._dragState.previewSlot) {
            let now = GLib.get_monotonic_time() / 1000; // ms
            if (this._dragState.hoverEdgeSlot !== targetSlot) {
                this._dragState.hoverEdgeSlot = targetSlot;
                this._dragState.hoverEdgeStartTime = now;
                return DND.DragMotionResult.MOVE_DROP;
            }
            if (now - this._dragState.hoverEdgeStartTime < 75) {
                return DND.DragMotionResult.MOVE_DROP;
            }

            this._dragState.previewSlot = targetSlot;
            this._animatePinnedAutoArrange(this._dragState.sourceIndex, targetSlot);
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    _animatePinnedAutoArrange(sourceIndex, targetSlot) {
        this._pinnedTiles.forEach(t => {
            let newSlot = t.index;
            if (t.index === sourceIndex) {
                newSlot = targetSlot;
            } else if (sourceIndex < targetSlot && t.index > sourceIndex && t.index <= targetSlot) {
                newSlot = t.index - 1;
            } else if (sourceIndex > targetSlot && t.index >= targetSlot && t.index < sourceIndex) {
                newSlot = t.index + 1;
            }

            if (newSlot !== t.currentSlot) {
                t.currentSlot = newSlot;
                t.currentX = (newSlot % PINNED_COLS) * PINNED_CELL_W;
                t.currentY = Math.floor(newSlot / PINNED_COLS) * PINNED_CELL_H;
                t.actor.ease({
                    x: t.currentX,
                    y: t.currentY,
                    duration: 160,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            }
        });
    }

    _acceptPinnedGridDrop(source, actor, x, y, time) {
        let isPinnedTile = source instanceof PinnedTile;
        let isExternalApp = !isPinnedTile && source && source.app;

        if (!isPinnedTile && !isExternalApp)
            return false;

        this._pinnedTiles.forEach(t => t.setFolderDropTarget(false));

        if (isExternalApp) {
            let appId = source.app.get_id();
            let targetIdx = this._externalFolderTargetIndex !== undefined ? this._externalFolderTargetIndex : -1;
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (targetIdx >= 0 && targetIdx < this.pinnedItems.length) {
                    this._mergeAppIntoPinnedTarget(appId, -1, targetIdx);
                } else if (!this.isAppPinned(appId)) {
                    this.pinApp(appId);
                }
                return false;
            });
            return true;
        }

        if (!this._dragState)
            return false;

        let srcIdx = this._dragState.sourceIndex;
        let dstSlot = this._dragState.previewSlot;
        let folderTargetIdx = this._dragState.folderTargetIndex;

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            if (folderTargetIdx !== -1 && folderTargetIdx !== srcIdx) {
                let srcItem = this.pinnedItems[srcIdx];
                if (srcItem && srcItem.type === 'app') {
                    this._mergeAppIntoPinnedTarget(srcItem.id, srcIdx, folderTargetIdx);
                }
            } else if (dstSlot !== srcIdx && srcIdx >= 0 && srcIdx < this.pinnedItems.length) {
                let [moved] = this.pinnedItems.splice(srcIdx, 1);
                this.pinnedItems.splice(dstSlot, 0, moved);
                this._savePinnedItems();
                this._refreshPinnedSection();
            } else {
                this._resetPinnedTilesPositions();
                if (source.actor)
                    source.actor.opacity = 255;
            }
            return false;
        });

        return true;
    }

    _mergeAppIntoPinnedTarget(sourceAppId, sourceIndex, targetIndex) {
        let targetItem = this.pinnedItems[targetIndex];
        if (!targetItem)
            return;

        if (targetItem.type === 'app') {
            if (targetItem.id === sourceAppId)
                return;
            let newFolderId = 'folder_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            let newFolder = {
                type: 'folder',
                id: newFolderId,
                name: this.t('new_folder'),
                apps: [targetItem.id, sourceAppId]
            };
            this.pinnedItems[targetIndex] = newFolder;
            if (sourceIndex >= 0) {
                this.pinnedItems.splice(sourceIndex, 1);
            }
            this._savePinnedItems();
            this._refreshPinnedSection();

            // Open the newly created folder immediately in rename mode with "Nova Pasta" / "New Folder" pre-selected
            Mainloop.timeout_add(35, () => {
                this._openFolder(newFolderId, true);
                return GLib.SOURCE_REMOVE;
            });
        } else if (targetItem.type === 'folder') {
            if (!Array.isArray(targetItem.apps))
                targetItem.apps = [];
            if (!targetItem.apps.includes(sourceAppId))
                targetItem.apps.push(sourceAppId);
            if (sourceIndex >= 0) {
                this.pinnedItems.splice(sourceIndex, 1);
            }
            this._savePinnedItems();
            this._refreshPinnedSection();

            Mainloop.timeout_add(35, () => {
                this._openFolder(targetItem.id, false);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    /* =====================================================================
     * RECENT SECTION & RECENT APPS / FILES TRACKING
     * ===================================================================== */
    recordRecentApp(appId) {
        if (!appId)
            return;
        let list = Array.isArray(this.recentApps) ? [...this.recentApps] : [];
        list = list.filter(entry => entry.id !== appId);
        list.unshift({
            id: appId,
            timestamp: Math.floor(Date.now() / 1000)
        });
        if (list.length > 25)
            list = list.slice(0, 25);
        this.recentApps = list;
    }

    launchApp(app) {
        if (!app)
            return;
        let appId = app.get_id();
        this.recordRecentApp(appId);
        this._knownApps.add(appId || app.get_name());
        app.open_new_window(-1);
        this.menu.close();
    }

    launchRecentUri(uri) {
        try {
            Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
            this.menu.close();
        } catch (e) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(
                source,
                this.t("file_unavailable"),
                e.message
            );
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);
            source.notify(notification);
        }
    }

    _formatRelativeTime(timestampSec) {
        if (!timestampSec)
            return this.t("recently_added");
        let nowSec = Math.floor(Date.now() / 1000);
        let diff = Math.max(0, nowSec - timestampSec);
        if (diff < 60)
            return this.t("just_now");
        let mins = Math.floor(diff / 60);
        if (mins < 60)
            return this.t("minutes_ago", mins);
        let hours = Math.floor(mins / 60);
        if (hours < 24)
            return this.t("hours_ago", hours);
        let days = Math.floor(hours / 24);
        return this.t("days_ago", days);
    }

    _getCombinedRecentItems(maxCount = 24) {
        let items = [];

        // 1. Recently launched apps
        let recentAppEntries = Array.isArray(this.recentApps) ? this.recentApps : [];
        for (let entry of recentAppEntries) {
            let app = appsys.lookup_app(entry.id);
            if (app) {
                items.push({
                    kind: 'app',
                    app: app,
                    title: app.get_name(),
                    subtitle: this.t("recently_added"),
                    pathText: app.get_description() || this.t("recently_added"),
                    timeText: this._formatRelativeTime(entry.timestamp),
                    timestamp: entry.timestamp || 0
                });
            }
        }

        // 2. Recent files from Cinnamon DocManager
        let rememberRecent = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        if (rememberRecent && this.RecentManager && this.RecentManager._infosByTimestamp) {
            let recents = this.RecentManager._infosByTimestamp.filter(info => !info.name.startsWith("."));
            for (let info of recents) {
                let ts = info.mtime || 0;
                let shortPath = shorten_path(info.uriDecoded || info.uri, info.name);
                let timeStr = ts > 0 ? this._formatRelativeTime(ts) : shortPath;
                items.push({
                    kind: 'file',
                    docInfo: info,
                    uri: info.uri,
                    title: info.name,
                    subtitle: timeStr,
                    pathText: shortPath,
                    timeText: timeStr,
                    timestamp: ts
                });
            }
        }

        // If user has fewer than 6 items on a fresh setup, include a few common apps so Recent section looks rich
        if (items.length < 6) {
            let fallbackApps = ["nemo.desktop", "org.gnome.Terminal.desktop", "cinnamon-settings.desktop", "firefox.desktop"];
            for (let id of fallbackApps) {
                if (items.length >= 6)
                    break;
                let app = appsys.lookup_app(id);
                if (app && !items.some(x => x.kind === 'app' && x.app.get_id() === id)) {
                    items.push({
                        kind: 'app',
                        app: app,
                        title: app.get_name(),
                        subtitle: this.t("recently_added"),
                        pathText: app.get_description() || "",
                        timeText: this.t("recently_added"),
                        timestamp: 0
                    });
                }
            }
        }

        return items.slice(0, maxCount);
    }

    _refreshRecentSection() {
        if (!this.recentSectionBox)
            return;

        this.recentTitleLabel.set_text(this.t("recent"));
        this.recentMoreBtnLabel.set_text(this.t("show_all"));
        this.allRecentSubTitle.set_text(this.t("recent"));
        this.allRecentBackLabel.set_text(this.t("back"));

        if (!this.showRecents) {
            this.recentSectionBox.hide();
            return;
        }
        this.recentSectionBox.show();
        this.recentGridBox.destroy_all_children();

        let recentItems = this._getCombinedRecentItems(6);
        if (recentItems.length === 0) {
            let emptyLabel = new St.Label({
                text: this.t("no_recent_items"),
                style_class: 'win11-recent-item-subtitle'
            });
            this.recentGridBox.add_actor(emptyLabel);
            return;
        }

        for (let r = 0; r < Math.ceil(recentItems.length / 2); r++) {
            let rowBox = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-recent-row',
                x_expand: true
            });
            for (let c = 0; c < 2; c++) {
                let idx = r * 2 + c;
                if (idx < recentItems.length) {
                    let itemBtn = this._createRecentItemWidget(recentItems[idx], false);
                    rowBox.add(itemBtn, { expand: true, x_fill: true });
                } else {
                    let spacer = new St.Widget({ x_expand: true });
                    rowBox.add(spacer, { expand: true, x_fill: true });
                }
            }
            this.recentGridBox.add_actor(rowBox);
        }
    }

    _createRecentItemWidget(item, showRightTimestamp = false) {
        let btn = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-recent-item',
            reactive: true,
            track_hover: true,
            x_expand: true
        });

        let icon;
        if (item.kind === 'app') {
            icon = createAppIcon(item.app, 28);
        } else if (item.docInfo) {
            icon = item.docInfo.createIcon(28);
        } else {
            icon = new St.Icon({ icon_name: 'text-x-generic', icon_size: 28 });
        }

        let textBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        let titleLbl = new St.Label({
            text: item.title,
            style_class: 'win11-recent-item-title'
        });
        titleLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        let subText = showRightTimestamp ? (item.pathText || item.subtitle) : item.subtitle;
        let subLbl = new St.Label({
            text: subText,
            style_class: 'win11-recent-item-subtitle'
        });
        subLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        textBox.add_actor(titleLbl);
        textBox.add_actor(subLbl);

        btn.add_actor(icon);
        btn.add(textBox, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });

        if (showRightTimestamp && item.timeText) {
            let timeLbl = new St.Label({
                text: item.timeText,
                style_class: 'win11-recent-time-label',
                y_align: Clutter.ActorAlign.CENTER
            });
            btn.add_actor(timeLbl);
        }

        btn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                if (item.kind === 'app') {
                    this.launchApp(item.app);
                } else if (item.uri) {
                    this.launchRecentUri(item.uri);
                }
                return Clutter.EVENT_STOP;
            } else if (event.get_button() === Clutter.BUTTON_SECONDARY && item.kind === 'app') {
                this.showAppContextMenu(item.app, btn);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return btn;
    }

    _populateAllRecentSubView() {
        this.allRecentListBox.destroy_all_children();
        let allRecent = this._getCombinedRecentItems(30);
        allRecent.forEach(item => {
            let row = this._createRecentItemWidget(item, true);
            this.allRecentListBox.add_actor(row);
        });
    }

    /* =====================================================================
     * ALL APPS SECTION (Todos / All - Alphabetical List, Grid, or Categories)
     * ===================================================================== */
    _fullRefresh() {
        let [apps, dirs] = AppUtils.getApps();
        this._allAppsData = apps;
        this._allDirsData = dirs;

        if (!this._appsWereRefreshed) {
            for (let [app] of apps) {
                this._knownApps.add(app.get_id() || app.get_name());
            }
            this._appsWereRefreshed = true;
        }

        this._refreshPinnedSection();
        this._refreshRecentSection();
        this._refreshAllAppsSection();
        this._refreshSearchHomeView();
        this._refreshFooter();
    }

    _refreshAllAppsSection() {
        if (!this.allAppsListBox)
            return;

        this.allAppsTitleLabel.set_text(this.t("all"));
        let mode = this.allAppsViewMode || "list";
        if (mode === "grid")
            this.allAppsViewBtnLabel.set_text(this.t("view_grid"));
        else if (mode === "categories")
            this.allAppsViewBtnLabel.set_text(this.t("view_categories"));
        else
            this.allAppsViewBtnLabel.set_text(this.t("view_list"));

        this.allAppsListBox.destroy_all_children();
        this._letterHeaderActors = new Map();

        if (mode === "categories") {
            this._buildAllAppsByCategory();
            return;
        }

        // Group apps alphabetically (#, A, B, C, ...)
        let groups = new Map();
        for (let [app] of this._allAppsData) {
            let name = (app.get_name() || "").trim();
            let firstChar = name.length > 0 ? name[0].normalize('NFKD').replace(/\p{Grapheme_Extend}/gu, "").toUpperCase() : "#";
            let letter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
            if (!groups.has(letter))
                groups.set(letter, []);
            groups.get(letter).push(app);
        }

        let sortedLetters = Array.from(groups.keys()).sort((a, b) => {
            if (a === "#") return -1;
            if (b === "#") return 1;
            return a.localeCompare(b);
        });

        for (let letter of sortedLetters) {
            let letterBtn = new St.Button({
                label: letter,
                style_class: 'win11-all-apps-letter-btn',
                reactive: true,
                track_hover: true,
                x_expand: true,
                x_align: St.Align.START
            });
            letterBtn.connect('clicked', () => {
                this._openAlphabetJumper(groups);
            });
            this.allAppsListBox.add_actor(letterBtn);
            this._letterHeaderActors.set(letter, letterBtn);

            let letterApps = groups.get(letter);
            if (mode === "grid") {
                this._addAppsGridRows(this.allAppsListBox, letterApps);
            } else {
                for (let app of letterApps) {
                    let row = this._createAllAppsListRow(app);
                    this.allAppsListBox.add_actor(row);
                }
            }
        }
    }

    _buildAllAppsByCategory() {
        for (let dir of this._allDirsData) {
            let catId = dir.get_menu_id();
            let catName = dir.get_name();
            let catApps = this._allAppsData
                .filter(([app, cats]) => cats.includes(catId))
                .map(([app]) => app);
            if (catApps.length === 0)
                continue;

            let header = new St.Label({
                text: catName,
                style_class: 'win11-all-apps-letter-btn',
                x_expand: true
            });
            this.allAppsListBox.add_actor(header);

            for (let app of catApps) {
                let row = this._createAllAppsListRow(app);
                this.allAppsListBox.add_actor(row);
            }
        }
    }

    _addAppsGridRows(container, appsList) {
        for (let i = 0; i < appsList.length; i += PINNED_COLS) {
            let row = new St.BoxLayout({ vertical: false, x_expand: true });
            for (let c = 0; c < PINNED_COLS; c++) {
                let idx = i + c;
                if (idx < appsList.length) {
                    let app = appsList[idx];
                    let tile = this._createGridAppButton(app);
                    row.add_actor(tile);
                }
            }
            container.add_actor(row);
        }
    }

    _createGridAppButton(app) {
        let box = new St.BoxLayout({
            style_class: 'win11-pinned-tile',
            vertical: true,
            reactive: true,
            track_hover: true,
            width: PINNED_CELL_W,
            height: PINNED_CELL_H,
            x_align: Clutter.ActorAlign.CENTER
        });
        let iconBin = new St.Bin({ width: 42, height: 42, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        iconBin.set_child(createAppIcon(app, this.applicationIconSize || 32));
        let lbl = new St.Label({
            text: app.get_name(),
            style_class: 'win11-pinned-tile-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        lbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        box.add_actor(iconBin);
        box.add_actor(lbl);

        box.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.launchApp(app);
                return Clutter.EVENT_STOP;
            } else if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                this.showAppContextMenu(app, box);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        return box;
    }

    _createAllAppsListRow(app) {
        let row = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-all-apps-item',
            reactive: true,
            track_hover: true,
            x_expand: true
        });

        let icon = createAppIcon(app, 28);
        let labelBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        let nameLbl = new St.Label({
            text: app.get_name(),
            style_class: 'win11-all-apps-item-label'
        });
        nameLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        labelBox.add_actor(nameLbl);

        let appKey = app.get_id() || app.get_name();
        if (this._appsWereRefreshed && !this._knownApps.has(appKey)) {
            let newBadge = new St.Label({
                text: this.t("new_badge"),
                style_class: 'win11-new-badge'
            });
            labelBox.add_actor(newBadge);
        }

        row.add_actor(icon);
        row.add(labelBox, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });

        row._delegate = {
            app: app,
            getDragActor: () => createAppIcon(app, this.applicationIconSize || 32),
            getDragActorSource: () => icon
        };
        DND.makeDraggable(row, { restoreOnSuccess: false, dragActorOpacity: 220 });

        row.connect('button-release-event', (actor, event) => {
            if (DND.isDragging())
                return Clutter.EVENT_PROPAGATE;
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.launchApp(app);
                return Clutter.EVENT_STOP;
            } else if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                this.showAppContextMenu(app, row);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return row;
    }

    _openAlphabetJumper(groups) {
        this.alphabetJumperBox.destroy_all_children();
        const chars = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
        const perRow = 7;

        for (let i = 0; i < chars.length; i += perRow) {
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-alphabet-row',
                x_align: Clutter.ActorAlign.CENTER
            });
            for (let c = 0; c < perRow; c++) {
                let idx = i + c;
                if (idx >= chars.length)
                    break;
                let ch = chars[idx];
                let hasApps = groups.has(ch);
                let cell = new St.Button({
                    label: ch,
                    style_class: hasApps ? 'win11-alphabet-cell' : 'win11-alphabet-cell-disabled',
                    reactive: hasApps,
                    track_hover: hasApps
                });
                if (hasApps) {
                    cell.connect('clicked', () => {
                        this._showStartSubView("main");
                        Mainloop.idle_add(() => {
                            let targetActor = this._letterHeaderActors.get(ch);
                            if (targetActor) {
                                this._scrollActorIntoView(targetActor, this.startScrollView);
                            }
                            return GLib.SOURCE_REMOVE;
                        });
                    });
                }
                row.add_actor(cell);
            }
            this.alphabetJumperBox.add_actor(row);
        }

        this._showStartSubView("alphabet-jumper");
    }

    _scrollActorIntoView(actor, scrollView) {
        try {
            let adj = scrollView.get_vscroll_bar().get_adjustment();
            let [scrollX, scrollY] = scrollView.get_transformed_position();
            let [actX, actY] = actor.get_transformed_position();
            let currentVal = adj.get_value();
            let targetVal = Math.max(0, currentVal + (actY - scrollY) - 12);
            adj.set_value(targetVal);
        } catch (e) {
            // Ignore scroll errors if actor is unmapped
        }
    }

    /* =====================================================================
     * SEARCH HOME VIEW & SEARCH ENGINE (Reused & Enhanced from menu@cinnamon.org)
     * ===================================================================== */
    _refreshSearchHomeView() {
        if (!this.searchHomeBox)
            return;

        this.searchRecentTitle.set_text(this.t("recent"));
        this.quickSearchesTitle.set_text(this.t("quick_searches"));
        this.topAppsTitle.set_text(this.t("top_apps"));

        // 1. Left Column: Recent list
        this.searchRecentListBox.destroy_all_children();
        let recents = this._getCombinedRecentItems(11);
        for (let item of recents) {
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-search-recent-row',
                reactive: true,
                track_hover: true,
                x_expand: true
            });
            let icon = item.kind === 'app'
                ? createAppIcon(item.app, 22)
                : (item.docInfo ? item.docInfo.createIcon(22) : new St.Icon({ icon_name: 'text-x-generic', icon_size: 22 }));
            let lbl = new St.Label({
                text: item.title,
                style_class: 'win11-search-recent-label',
                y_align: Clutter.ActorAlign.CENTER
            });
            lbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            row.add_actor(icon);
            row.add(lbl, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });

            row.connect('button-release-event', (actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                    if (item.kind === 'app')
                        this.launchApp(item.app);
                    else if (item.uri)
                        this.launchRecentUri(item.uri);
                    return Clutter.EVENT_STOP;
                } else if (event.get_button() === Clutter.BUTTON_SECONDARY && item.kind === 'app') {
                    this.showAppContextMenu(item.app, row);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            this.searchRecentListBox.add_actor(row);
        }

        // 2. Right Column Top: Quick Searches (6 pills in 3 rows of 2)
        this.quickSearchesChipsBox.destroy_all_children();
        const quickSearches = [
            { label: this.t("qs_focus"), action: () => Util.spawnCommandLine("cinnamon-settings notifications") },
            { label: this.t("qs_sound"), action: () => Util.spawnCommandLine("cinnamon-settings sound") },
            { label: this.t("qs_bluetooth"), action: () => Util.spawnCommandLine("blueberry") },
            { label: this.t("qs_display"), action: () => Util.spawnCommandLine("cinnamon-settings display") },
            { label: this.t("qs_themes"), action: () => Util.spawnCommandLine("cinnamon-settings themes") },
            { label: this.t("qs_search"), action: () => this.configureApplet() }
        ];

        for (let i = 0; i < quickSearches.length; i += 2) {
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-quick-searches-row',
                x_expand: true
            });
            for (let c = 0; c < 2; c++) {
                let idx = i + c;
                if (idx >= quickSearches.length)
                    break;
                let qs = quickSearches[idx];
                let chip = new St.Button({
                    label: qs.label,
                    style_class: 'win11-quick-search-chip',
                    reactive: true,
                    track_hover: true
                });
                chip.connect('clicked', () => {
                    this.menu.close();
                    qs.action();
                });
                row.add_actor(chip);
            }
            this.quickSearchesChipsBox.add_actor(row);
        }

        // 3. Right Column Bottom: Top Apps (3x2 grid of 6 app cards)
        this.topAppsGridBox.destroy_all_children();
        let topApps = this._getTopApps(6);
        for (let i = 0; i < topApps.length; i += 3) {
            let row = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-top-apps-row',
                x_expand: true
            });
            for (let c = 0; c < 3; c++) {
                let idx = i + c;
                if (idx >= topApps.length)
                    break;
                let app = topApps[idx];
                let card = new St.BoxLayout({
                    vertical: true,
                    style_class: 'win11-top-app-card',
                    reactive: true,
                    track_hover: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER
                });
                let icon = createAppIcon(app, 36);
                let lbl = new St.Label({
                    text: app.get_name(),
                    style_class: 'win11-top-app-card-label',
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER
                });
                lbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
                card.add_actor(icon);
                card.add_actor(lbl);

                card.connect('button-release-event', (actor, event) => {
                    if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                        this.launchApp(app);
                        return Clutter.EVENT_STOP;
                    } else if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                        this.showAppContextMenu(app, card);
                        return Clutter.EVENT_STOP;
                    }
                    return Clutter.EVENT_PROPAGATE;
                });
                row.add_actor(card);
            }
            this.topAppsGridBox.add_actor(row);
        }
    }

    _getTopApps(count = 6) {
        let result = [];
        const addIfValid = (id) => {
            if (result.length >= count)
                return;
            let app = appsys.lookup_app(id);
            if (app && !result.some(a => a.get_id() === app.get_id())) {
                result.push(app);
            }
        };

        // Preferred top apps matching the Windows 11 recording (Settings, Terminal, Software Store, Calculator, Screenshot, Browser)
        const preferredTop = [
            "cinnamon-settings.desktop",
            "org.gnome.Terminal.desktop",
            "mintinstall.desktop",
            "org.gnome.Calculator.desktop",
            "org.gnome.Screenshot.desktop",
            "firefox.desktop",
            "nemo.desktop"
        ];
        preferredTop.forEach(addIfValid);

        for (let item of (this.pinnedItems || [])) {
            if (item.type === 'app')
                addIfValid(item.id);
        }

        for (let [app] of this._allAppsData) {
            if (result.length >= count)
                break;
            addIfValid(app.get_id());
        }
        return result;
    }

    /* =====================================================================
     * SEARCH EXECUTION (Reusing menu@cinnamon.org Search Algorithm)
     * ===================================================================== */
    _onSearchTextChanged() {
        let searchString = this.searchEntry.get_text().trim();
        let hasText = searchString !== "";

        if (hasText) {
            this.searchEntry.set_secondary_icon(this._searchClearIcon);
            if (!this._searchClearClickedId) {
                this._searchClearClickedId = this.searchEntry.connect('secondary-icon-clicked', () => {
                    this.searchEntry.set_text("");
                });
            }
            this.startModeBox.hide();
            this.searchHomeBox.hide();
            this.footerBar.hide();
            this.searchResultsBox.show();
            this._doSearch(searchString);
        } else {
            if (this._searchClearClickedId > 0) {
                this.searchEntry.disconnect(this._searchClearClickedId);
                this._searchClearClickedId = 0;
            }
            this.searchEntry.set_secondary_icon(null);
            this.searchResultsBox.hide();

            if (this._currentPopupMode === "search") {
                this.startModeBox.hide();
                this.footerBar.hide();
                this.searchHomeBox.show();
            } else {
                this.searchHomeBox.hide();
                this.startModeBox.show();
                this.footerBar.show();
            }
        }
    }

    _doSearch(rawPattern) {
        let lowerPattern = AppUtils.decomp_unstripped(rawPattern);
        let pattern = AppUtils.decomp_stripped(rawPattern);

        this.searchResultsListBox.destroy_all_children();
        this._searchResultsList = [];
        this._selectedSearchResultIdx = -1;

        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        // 1. Match Installed Applications (using menu@cinnamon.org's exact MATCH_ADDERS scoring)
        let appMatches = [];
        if (this._searchFilter === "all" || this._searchFilter === "apps" || this._searchFilter === "settings") {
            for (let [app, categories] of this._allAppsData) {
                let isSettingsApp = categories.some(c =>
                    ["preferences", "administration", "settings"].includes(c.toLowerCase())
                );
                if (this._searchFilter === "settings" && !isSettingsApp)
                    continue;
                if (this._searchFilter === "apps" && isSettingsApp)
                    continue;

                let searchStrings = [
                    AppUtils.decomp_string(app.get_name()).replace(/\s/g, ''),
                    app.get_keywords() ? AppUtils.decomp_string(app.get_keywords()) : "",
                    app.get_description() ? AppUtils.decomp_string(app.get_description()).replace(/\s/g, '') : "",
                    app.get_id() ? AppUtils.decomp_string(app.get_id()) : ""
                ];

                for (let i = 0; i < searchStrings.length; i++) {
                    let res = searchStrings[i].match(regexpPattern);
                    if (res) {
                        appMatches.push({
                            kind: 'app',
                            app: app,
                            name: app.get_name(),
                            description: (app.get_description() || "").split("\n")[0],
                            matchIndex: res.index + MATCH_ADDERS[i]
                        });
                        break;
                    }
                }
            }
            appMatches.sort((a, b) => (a.matchIndex - b.matchIndex) || a.name.localeCompare(b.name));
        }

        // 2. Match Favorite Documents & Recent Files
        let docMatches = [];
        if (this._searchFilter === "all" || this._searchFilter === "docs") {
            try {
                let favInfos = XApp.Favorites.get_default().get_favorites(null);
                for (let info of favInfos) {
                    let s = AppUtils.decomp_string(info.display_name).replace(/\s/g, '');
                    let res = s.match(regexpPattern);
                    if (res) {
                        docMatches.push({
                            kind: 'file',
                            name: info.display_name,
                            description: shorten_path(info.uri, info.display_name),
                            uri: info.uri,
                            icon: new St.Icon({
                                gicon: Gio.content_type_get_icon(info.cached_mimetype),
                                icon_size: 28
                            }),
                            matchIndex: res.index
                        });
                    }
                }
            } catch (e) {}

            if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY) && this.RecentManager) {
                let recents = this.RecentManager._infosByTimestamp.filter(info => !info.name.startsWith("."));
                for (let info of recents) {
                    let s = AppUtils.decomp_string(info.name).replace(/\s/g, '');
                    let res = s.match(regexpPattern);
                    if (res) {
                        docMatches.push({
                            kind: 'file',
                            name: info.name,
                            description: shorten_path(info.uriDecoded || info.uri, info.name),
                            uri: info.uri,
                            icon: info.createIcon(28),
                            matchIndex: res.index
                        });
                    }
                }
            }
            docMatches.sort((a, b) => (a.matchIndex - b.matchIndex) || a.name.localeCompare(b.name));
        }

        // Build Results List UI
        let allMatched = [...appMatches, ...docMatches];
        if (allMatched.length > 0) {
            let bestHeader = new St.Label({
                text: this.t("best_match"),
                style_class: 'win11-search-category-label'
            });
            this.searchResultsListBox.add_actor(bestHeader);
            this._addSearchResultRow(allMatched[0]);

            let restApps = appMatches.slice(allMatched[0].kind === 'app' ? 1 : 0, 12);
            if (restApps.length > 0) {
                let appsHdr = new St.Label({
                    text: this.t("apps_header"),
                    style_class: 'win11-search-category-label'
                });
                this.searchResultsListBox.add_actor(appsHdr);
                restApps.forEach(m => this._addSearchResultRow(m));
            }

            let restDocs = docMatches.slice(allMatched[0].kind === 'file' ? 1 : 0, 10);
            if (restDocs.length > 0) {
                let docsHdr = new St.Label({
                    text: this.t("docs_header"),
                    style_class: 'win11-search-category-label'
                });
                this.searchResultsListBox.add_actor(docsHdr);
                restDocs.forEach(m => this._addSearchResultRow(m));
            }

            this._selectSearchResult(0);
        } else {
            let emptyLbl = new St.Label({
                text: this.t("no_results", rawPattern),
                style_class: 'win11-search-category-label'
            });
            this.searchResultsListBox.add_actor(emptyLbl);
            this.searchPreviewPane.destroy_all_children();
        }

        // 3. Query Cinnamon SearchProviderManager asynchronously (just like menu@cinnamon.org)
        if (this._searchFilter === "all" || this._searchFilter === "settings") {
            SearchProviderManager.launch_all(lowerPattern, (provider, results) => {
                try {
                    if (!results || results.length === 0)
                        return;
                    let addedHeader = false;
                    for (let result of results) {
                        if (result.type === 'software')
                            continue;
                        if (!addedHeader) {
                            let hdr = new St.Label({
                                text: this.t("settings_header"),
                                style_class: 'win11-search-category-label'
                            });
                            this.searchResultsListBox.add_actor(hdr);
                            addedHeader = true;
                        }
                        let iconActor = null;
                        if (result.icon) {
                            iconActor = result.icon;
                        } else if (result.icon_app) {
                            iconActor = result.icon_app.create_icon_texture(28);
                        } else if (result.icon_filename) {
                            iconActor = new St.Icon({
                                gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(result.icon_filename) }),
                                icon_size: 28
                            });
                        }
                        this._addSearchResultRow({
                            kind: 'provider',
                            provider: provider,
                            result: result,
                            name: result.label,
                            description: result.description || "",
                            icon: iconActor
                        });
                        if (this._selectedSearchResultIdx === -1) {
                            this._selectSearchResult(0);
                        }
                    }
                } catch (e) {
                    global.log(e);
                }
            });
        }
    }

    _addSearchResultRow(matchItem) {
        let idx = this._searchResultsList.length;
        let row = new St.BoxLayout({
            vertical: false,
            style_class: 'win11-search-result-item',
            reactive: true,
            track_hover: true,
            x_expand: true
        });

        let icon;
        if (matchItem.kind === 'app') {
            icon = createAppIcon(matchItem.app, 28);
        } else if (matchItem.icon) {
            icon = matchItem.icon;
        } else {
            icon = new St.Icon({ icon_name: 'application-x-executable', icon_size: 28 });
        }

        let textBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        let nameLbl = new St.Label({
            text: matchItem.name,
            style_class: 'win11-recent-item-title'
        });
        nameLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        textBox.add_actor(nameLbl);

        if (this.showDescription && matchItem.description) {
            let descLbl = new St.Label({
                text: matchItem.description,
                style_class: 'win11-recent-item-subtitle'
            });
            descLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            textBox.add_actor(descLbl);
        }

        row.add_actor(icon);
        row.add(textBox, { expand: true, x_fill: true, y_align: St.Align.MIDDLE });

        row.connect('enter-event', () => {
            this._selectSearchResult(idx);
        });
        row.connect('button-release-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._activateSearchResult(matchItem);
                return Clutter.EVENT_STOP;
            } else if (event.get_button() === Clutter.BUTTON_SECONDARY && matchItem.kind === 'app') {
                this.showAppContextMenu(matchItem.app, row);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        matchItem.actor = row;
        this._searchResultsList.push(matchItem);
        this.searchResultsListBox.add_actor(row);
    }

    _selectSearchResult(index) {
        if (index < 0 || index >= this._searchResultsList.length)
            return;

        this._selectedSearchResultIdx = index;
        this._searchResultsList.forEach((item, i) => {
            if (item.actor) {
                item.actor.set_style_class_name(
                    i === index ? 'win11-search-result-item win11-search-result-item-selected' : 'win11-search-result-item'
                );
            }
        });

        let selected = this._searchResultsList[index];
        this._updateSearchPreviewPane(selected);
    }

    _updateSearchPreviewPane(item) {
        this.searchPreviewPane.destroy_all_children();
        if (!item)
            return;

        let iconBin = new St.Bin({ x_align: St.Align.MIDDLE });
        if (item.kind === 'app') {
            iconBin.set_child(createAppIcon(item.app, 52));
        } else {
            iconBin.set_child(new St.Icon({ icon_name: 'text-x-generic', icon_size: 48 }));
        }

        let titleLbl = new St.Label({
            text: item.name,
            style_class: 'win11-search-preview-title'
        });
        titleLbl.clutter_text.line_wrap = true;

        this.searchPreviewPane.add_actor(iconBin);
        this.searchPreviewPane.add_actor(titleLbl);

        if (item.description) {
            let descLbl = new St.Label({
                text: item.description,
                style_class: 'win11-search-preview-desc'
            });
            descLbl.clutter_text.line_wrap = true;
            this.searchPreviewPane.add_actor(descLbl);
        }

        let sep = new PopupMenu.PopupSeparatorMenuItem();
        this.searchPreviewPane.add_actor(sep.actor);

        let actionsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'win11-search-preview-actions',
            x_expand: true
        });

        const addActionBtn = (iconName, label, callback) => {
            let btn = new St.BoxLayout({
                vertical: false,
                style_class: 'win11-search-preview-action-btn',
                reactive: true,
                track_hover: true,
                x_expand: true
            });
            let ic = new St.Icon({
                icon_name: iconName,
                icon_size: 14,
                icon_type: St.IconType.SYMBOLIC
            });
            let lbl = new St.Label({ text: label, y_align: Clutter.ActorAlign.CENTER });
            btn.add_actor(ic);
            btn.add_actor(lbl);
            btn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                    callback();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            actionsBox.add_actor(btn);
        };

        addActionBtn('xsi-go-next-symbolic', this.t('open'), () => this._activateSearchResult(item));

        if (item.kind === 'app' && item.app) {
            let appId = item.app.get_id();
            let isPinned = this.isAppPinned(appId);
            addActionBtn(
                isPinned ? 'xsi-starred' : 'view-pin-symbolic',
                isPinned ? this.t('unpin_from_start') : this.t('pin_to_start'),
                () => {
                    if (isPinned)
                        this.unpinApp(appId);
                    else
                        this.pinApp(appId);
                    this._updateSearchPreviewPane(item);
                }
            );
            addActionBtn('xsi-list-add', this.t('add_to_panel'), () => this._addAppToPanel(item.app));
            if (USER_DESKTOP_PATH) {
                addActionBtn('xsi-computer', this.t('add_to_desktop'), () => this._addAppToDesktop(item.app));
            }
        }

        this.searchPreviewPane.add_actor(actionsBox);
    }

    _activateSearchResult(item) {
        if (!item)
            return;
        if (item.kind === 'app') {
            this.launchApp(item.app);
        } else if (item.kind === 'file' && item.uri) {
            this.launchRecentUri(item.uri);
        } else if (item.kind === 'provider' && item.provider) {
            try {
                item.provider.on_result_selected(item.result);
                this.menu.close();
            } catch (e) {
                global.logError(e);
            }
        }
    }

    _onSearchKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (this.searchEntryText.has_preedit())
            return Clutter.EVENT_PROPAGATE;

        if (this.searchResultsBox.visible && this._searchResultsList.length > 0) {
            if (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_KP_Down) {
                let next = (this._selectedSearchResultIdx + 1) % this._searchResultsList.length;
                this._selectSearchResult(next);
                this._scrollActorIntoView(this._searchResultsList[next].actor, this.searchResultsScrollView);
                return Clutter.EVENT_STOP;
            } else if (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_KP_Up) {
                let prev = (this._selectedSearchResultIdx - 1 + this._searchResultsList.length) % this._searchResultsList.length;
                this._selectSearchResult(prev);
                this._scrollActorIntoView(this._searchResultsList[prev].actor, this.searchResultsScrollView);
                return Clutter.EVENT_STOP;
            } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                let selected = this._searchResultsList[this._selectedSearchResultIdx] || this._searchResultsList[0];
                this._activateSearchResult(selected);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /* =====================================================================
     * POPUP OPEN / CLOSE / MODE SWITCHING LIFECYCLE
     * ===================================================================== */
    _handleEscapeKey() {
        if (this.floatingMenuBackdrop && this.floatingMenuBackdrop.visible) {
            this.closeFloatingMenus();
            return true;
        }
        if (this.folderOverlay && this.folderOverlay.visible) {
            if (this._folderRenaming) {
                this._commitFolderRename(true);
            } else {
                this._closeFolder();
            }
            return true;
        }
        if (this.searchEntry && this.searchEntry.get_text().trim() !== "") {
            this.searchEntry.set_text("");
            return true;
        }
        if (this._currentPopupMode === "start" && this._startSubView !== "main") {
            this._showStartSubView("main");
            return true;
        }
        return false;
    }

    _switchToPopupMode(mode, focusSearch = false) {
        this._currentPopupMode = mode;
        this.closeFloatingMenus();
        this._closeFolder();
        this.searchEntry.set_text("");
        this._showStartSubView("main");

        if (mode === "search") {
            this.startModeBox.hide();
            this.searchResultsBox.hide();
            this.footerBar.hide();
            this._refreshSearchHomeView();
            this.searchHomeBox.show();
            global.stage.set_key_focus(this.searchEntry);
        } else {
            this.searchHomeBox.hide();
            this.searchResultsBox.hide();
            this.startModeBox.show();
            this.footerBar.show();
            global.stage.set_key_focus(this.searchEntry);
        }

        this._updatePanelButtonsActiveState();
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            if (this._size_dirty) {
                this._setMenuSize(this.popup_width, this.popup_height);
            }
            this._updateThemeColors();
            this._switchToPopupMode(this._currentPopupMode || "start", this._currentPopupMode === "search");
        } else {
            this.closeFloatingMenus();
            this._closeFolder();
            this.searchEntry.set_text("");
            this._showStartSubView("main");
            try {
                this.startScrollView.get_vscroll_bar().get_adjustment().set_value(0);
            } catch (e) {}
            this._updatePanelButtonsActiveState();
        }
    }

    _updateAutoscroll() {
        if (this.startScrollView)
            this.startScrollView.set_auto_scrolling(this.autoscrollEnabled);
        if (this.allRecentScrollView)
            this.allRecentScrollView.set_auto_scrolling(this.autoscrollEnabled);
        if (this.searchResultsScrollView)
            this.searchResultsScrollView.set_auto_scrolling(this.autoscrollEnabled);
    }

    destroy() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new Win11MenuApplet(orientation, panel_height, instance_id);
}
