// Real layout methods, with only Cinnamon actor/environment boundaries stubbed.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));
function harness(panelHeight = 48, scale = 1, area = {width: 1920, height: 1032}) {
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: scale},
        Main: {layoutManager: {findMonitorForActor: () => ({index: 0, width: area.width, height: area.height + panelHeight}), primaryMonitor: {index: 0, width: area.width, height: area.height + panelHeight}}},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}},
        PINNED_COLS: 8, PINNED_CELL_W: 76, PINNED_CELL_H: 82,
        FOLDER_COLS: 4, FOLDER_CELL_W: 82, FOLDER_CELL_H: 86};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const actor = () => ({set_size(w, h) {this.width = w; this.height = h;}, set_clip_to_allocation(v) {this.clip = v;}});
    Object.assign(app, {_panelHeight: panelHeight, actor: {}, _orientation: 3,
        _getMenuAvailableArea: () => area, mainContainer: actor(), rootStack: actor(),
        menu: {actor: actor(), isOpen: false}, popup_width: 900, popup_height: 1100});
    return {app, context, Class};
}
test('menu is locked to the screen-proportional 834x866, ignoring legacy dimensions', () => {
    const {app} = harness();
    app._syncMenuGeometry();
    for (const actor of [app.menu.actor, app.rootStack, app.mainContainer]) {
        assert.equal(actor.width, 834);
        assert.equal(actor.height, 866);
        assert.equal(actor.clip, true);
    }
    assert.equal(app.popup_width, 900, 'legacy settings are never overwritten');
});
test('menu scales once on HiDPI and uniformly clamps to available monitor area', () => {
    const {app} = harness(96, 2, {width: 1280, height: 900});
    const g = app._getMenuGeometry();
    assert.ok(g.width <= 1260 && g.height <= 880);
    assert.ok(Math.abs(g.width / g.height - 834 / 866) < 0.003);
    const normal = harness(96, 2, {width: 3840, height: 2064}).app._getMenuGeometry();
    assert.equal(normal.width, 1668);
    assert.equal(normal.height, 1732);
});
test('manual resizing controls and persisted size schema are absent', () => {
    assert.equal(source.includes('Applet.PopupResizeHandler'), false);
    assert.equal(source.includes('_onBoxResized('), false);
    assert.equal(source.includes('_reset_menu_size('), false);
    for (const key of ['popup-width', 'popup-height', 'reset-menu-size-button']) assert.equal(schema[key], undefined);
});
test('panel height and orientation changes re-sync immediately; the size follows the screen, not the panel', () => {
    const {app} = harness();
    let refreshes = 0;
    Object.assign(app, {_setStyle() {}, _updateIconAndLabel() {}, _updateSearchPanelButton() {},
        _onLayoutChanged() {refreshes++; this._syncMenuGeometry();}});
    app._panelHeight = 60;
    app.on_panel_height_changed();
    assert.equal(app.menu.actor.width, 834);
    app.on_orientation_changed(0);
    assert.equal(app._orientation, 0);
    assert.equal(refreshes, 2);
});
test('Start icon stays native and discoverable with all theme categories and local images', () => {
    assert.ok(schema.layout1['appearance-panel'].keys.includes('menu-icon'));
    assert.equal(schema['menu-icon'].type, 'iconfilechooser');
    assert.equal(schema['menu-icon'].default, 'linuxmint-logo-ring-symbolic');
    assert.equal(schema['menu-icon'].default_category, undefined, 'do not force the Mint-only category');
    assert.match(schema['menu-icon'].tooltip, /image.*imagem/i);
});
test('Start icon rendering accepts themed names and existing local images without replacing saved settings', () => {
    const {app, context} = harness();
    const calls = [];
    context.GLib = {path_is_absolute: s => s.startsWith('/'), file_test: () => true, FileTest: {EXISTS: 1}};
    context.Gtk = {IconTheme: {get_default: () => ({has_icon: () => true})}};
    Object.assign(app, {menuCustom: true, _applet_icon_box: {show() {}}, _layoutBin: {hide() {}, show() {}},
        set_applet_label() {}, set_applet_icon_name: s => calls.push(['theme', s]),
        set_applet_icon_path: s => calls.push(['file', s]), set_applet_icon_symbolic_name: s => calls.push(['symbolic', s])});
    for (const icon of ['start-here', '/home/user/custom start.png']) {
        app.menuIcon = icon;
        app._updateIconAndLabel();
        assert.equal(app.menuIcon, icon);
    }
    assert.deepEqual(calls, [['theme', 'start-here'], ['file', '/home/user/custom start.png']]);
});
test('icon modes keep 32px/eight columns by default and 48px/six columns when large', () => {
    const {app} = harness();
    assert.equal(schema['icon-size-mode'].default, 'standard');
    app._syncMenuGeometry();
    let p = app._getPinnedMetrics();
    assert.deepEqual([p.cols, p.cellW, p.cellH, p.iconSize, p.iconBox], [8, 95, 82, 32, 42]);
    app.iconSizeMode = 'large';
    app._syncMenuGeometry();
    p = app._getPinnedMetrics();
    assert.deepEqual([p.cols, p.cellW, p.cellH, p.iconSize, p.iconBox], [6, 127, 104, 48, 58]);
    const f = app._getFolderMetrics();
    assert.deepEqual([f.cols, f.cellW, f.cellH, f.iconSize], [4, 104, 108, 48]);
});
test('all grid metrics share the clamped panel scale, without double-scaling icon textures', () => {
    const {app} = harness(96, 2, {width: 3840, height: 2064});
    app._syncMenuGeometry();
    let p = app._getPinnedMetrics();
    assert.deepEqual([p.cellW, p.cellH, p.iconSize], [190, 164, 32]);
    app._getMenuAvailableArea = () => ({width: 600, height: 500});
    app._syncMenuGeometry();
    p = app._getPinnedMetrics();
    assert.ok(p.cellW * p.cols < app.rootStack.width);
    assert.ok(p.iconBox < p.cellH);
});
test('changing icon mode live reflows both grids but preserves pins and open folder', () => {
    const {app} = harness();
    const pins = [{type: 'folder', id: 'folder', apps: ['a', 'b']}];
    const calls = [];
    Object.assign(app, {pinnedItems: pins, _openFolderId: 'folder',
        _refreshPinnedSection() {calls.push('pins');}, _rebuildFolderGrid(f) {calls.push(f.id);},
        _refreshAllAppsSection() {}, _refreshRecentSection() {}});
    app.iconSizeMode = 'large';
    app._onLayoutChanged();
    assert.equal(app.pinnedItems, pins);
    assert.equal(app._openFolderId, 'folder');
    assert.deepEqual(calls, ['pins', 'folder']);
    assert.equal(app._getPinnedMetrics().cols, 6);
});
test('real pinned and folder tiles allocate enough space for large icons, with bounded labels', () => {
    const {app, context} = harness();
    class Actor {
        constructor(props = {}) {Object.assign(this, props); this.children = []; this.clutter_text = {};}
        set_position(x, y) {this.x = x; this.y = y;}
        set_child(child) {this.child = child;}
        add_actor(child) {this.children.push(child);}
        set_style(style) {this.style = style;}
        set_clip_to_allocation(v) {this.clip = v;}
    }
    Object.assign(context.St, {BoxLayout: Actor, Bin: Actor, Label: Actor, Align: {MIDDLE: 0}});
    Object.assign(context, {Clutter: {ActorAlign: {CENTER: 0, START: 1}},
        Pango: {WrapMode: {WORD_CHAR: 0}, EllipsizeMode: {END: 1}},
        SignalManager: {SignalManager: class {connect() {}}}, DND: {makeDraggable: () => ({})},
        appsys: {lookup_app: () => ({get_name: () => 'A very long application name'.repeat(10)})},
        createAppIcon: (_app, size) => ({iconSize: size})});
    const Tiles = vm.runInNewContext(source.slice(source.indexOf('class PinnedTile'), source.indexOf('/**\n * PopupMenu subclass')) + '\n({PinnedTile, FolderAppTile})', context);
    app.iconSizeMode = 'large';
    app._syncMenuGeometry();
    const pin = new Tiles.PinnedTile(app, {id: 'app', type: 'app'}, 7);
    const folder = new Tiles.FolderAppTile(app, {id: 'f'}, 'app', 4);
    assert.deepEqual([pin.actor.width, pin.actor.height, pin.actor.x, pin.actor.y], [127, 104, 127, 104]);
    assert.deepEqual([folder.actor.width, folder.actor.height, folder.actor.x, folder.actor.y], [104, 108, 0, 108]);
    for (const tile of [pin, folder]) {
        assert.equal(tile.iconActor.iconSize, 48);
        assert.equal(tile.iconContainer.width, 58);
        assert.equal(tile.actor.clip, true);
        assert.ok(tile.label.height <= 28);
    }
});
test('three recent rows use equal tracks and bounded ellipsized labels for unequal filenames', () => {
    const {app, context} = harness();
    class Actor {
        constructor(props = {}) {
            if ('homogeneous' in props) throw new Error('No property homogeneous on StBoxLayout');
            Object.assign(this, props); this.children = []; this.clutter_text = {};
            this.layout_manager = {homogeneous: false};
        }
        add_actor(child) {this.children.push(child);}
        add(child) {this.children.push(child);}
        connect() {}
        show() {}
        set_text() {}
        set_style(s) {this.style = s;}
        set_clip_to_allocation(v) {this.clip = v;}
        destroy_all_children() {this.children = [];}
    }
    Object.assign(context.St, {BoxLayout: Actor, Widget: Actor, Label: Actor, Icon: Actor, Align: {MIDDLE: 0}});
    Object.assign(context, {Clutter: {ActorAlign: {CENTER: 0}}, Pango: {EllipsizeMode: {END: 1}}});
    const fixtures = require('./fixtures/recent-items.js');
    Object.assign(app, {showRecentApps: true, showRecentFiles: true, t: s => s,
        _getCombinedRecentItems: () => fixtures,
        recentSectionBox: new Actor(), recentTitleLabel: new Actor(), recentMoreBtnLabel: new Actor(),
        allRecentSubTitle: new Actor(), allRecentBackLabel: new Actor(), recentGridBox: new Actor()});
    app._refreshRecentSection();
    assert.equal(app.recentGridBox.children.length, 3);
    for (const row of app.recentGridBox.children) {
        assert.equal(row.layout_manager.homogeneous, true, 'both tracks must have equal width independent of their natural widths');
        assert.equal(row.min_width, 0);
        assert.equal(row.children.length, 2);
        for (const item of row.children) {
            assert.equal(item.height, 52);
            assert.equal(item.min_width, 0);
            const text = item.children[1];
            assert.equal(text.min_width, 0);
            for (const label of text.children) {
                assert.equal(label.min_width, 0);
                assert.equal(label.clutter_text.line_wrap, false);
                assert.equal(label.clutter_text.ellipsize, 1);
            }
        }
    }
});
test('locked outer bounds reserve theme chrome instead of clipping the footer', () => {
    const {app, context} = harness();
    context.Clutter = {ActorBox: class {}};
    const themed = (horizontal, vertical) => ({get_theme_node: () => ({get_content_box: box =>
        ({get_size: () => [box.x2 - horizontal, box.y2 - vertical]})})});
    Object.assign(app.menu.actor, themed(2, 2));
    app.menu.box = themed(20, 40);
    app._popupSectionActor = themed(0, 0);
    app._syncMenuGeometry();
    assert.deepEqual([app.menu.actor.width, app.menu.actor.height], [834, 866]);
    assert.deepEqual([app.rootStack.width, app.rootStack.height], [812, 824]);
    assert.deepEqual([app.mainContainer.width, app.mainContainer.height], [812, 824]);
});
test('all-apps grid uses the selected column count instead of stale eight-column constants', () => {
    const {app, context} = harness();
    context.St.BoxLayout = class {constructor() {this.children = [];} add_actor(c) {this.children.push(c);}};
    const rows = [];
    app._createGridAppButton = x => x;
    app.iconSizeMode = 'large';
    app._syncMenuGeometry();
    app._addAppsGridRows({add_actor: row => rows.push(row)}, Array.from({length: 14}, (_, i) => i));
    assert.deepEqual(rows.map(r => r.children.length), [6, 6, 2]);
});
module.exports = {harness, source, schema};
