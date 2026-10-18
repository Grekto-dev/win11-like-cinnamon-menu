// Menu-size profiles vary outer bounds/density, not the reference icon size.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));

function harness() {
    let next = 1, dragging = false;
    const timers = new Map();
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: 1}, Clutter: {ActorBox: class {}},
        PinnedTile: class {}, FolderAppTile: class {},
        Mainloop: {timeout_add: (_ms, fn) => {const id = next++; timers.set(id, fn); return id;}, source_remove: id => timers.delete(id)},
        DND: {isDragging: () => dragging, addDragMonitor() {}, removeDragMonitor() {}, DragMotionResult: {NO_DROP: 0, MOVE_DROP: 1}},
        Main: {layoutManager: {findMonitorForActor: () => ({index: 0, width: 1920, height: 1080}), primaryMonitor: {index: 0, width: 1920, height: 1080}}},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const actor = () => ({set_size(w, h) {this.width = w; this.height = h;}, set_clip_to_allocation() {}});
    Object.assign(app, {_panelHeight: 48, actor: {}, _orientation: 3, _getMenuAvailableArea: () => ({width: 1920, height: 1032}),
        mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false}, _pinnedTiles: [], _folderTiles: []});
    app.fixture = {context, setDragging(value) {dragging = value;}, flush() {
        for (const [id, fn] of [...timers]) {if (!timers.has(id)) continue; timers.delete(id); if (fn()) timers.set(id, fn);}
    }};
    return app;
}
const metrics = (app, mode) => {
    app.menuSize = mode; app._syncMenuGeometry();
    const p = app._getPinnedMetrics(), f = app._getFolderMetrics();
    return {p, f};
};

test('small, medium and large reproduce the reference bounds with fixed 32px icons', () => {
    const app = harness();
    for (const [size, width, height, cols] of [['small', 642, 726, 6], ['medium', 738, 796, 7], ['large', 834, 866, 8]]) {
        const {p, f} = metrics(app, size);
        assert.deepEqual([app.menu.actor.width, app.menu.actor.height, p.cols, p.iconSize], [width, height, cols, 32], size);
        assert.deepEqual([p.iconBox, p.cellH, f.iconSize, f.cellW, f.cellH], [42, 82, 32, 82, 86], size);
        assert.equal(p.cellW, Math.floor((width - 72) / cols), size);
    }
});
test('every profile fits its grid and keeps DND merge zones inside the cell', () => {
    const app = harness();
    for (const size of ['small', 'medium', 'large']) {
        const {p, f} = metrics(app, size);
        assert.ok(p.cols * p.cellW <= app._menuContentSize.width, size);
        assert.ok(p.iconBox < p.cellH, size);
        assert.ok(p.mergeTop + p.mergeBottom < p.cellH, size);
        assert.ok(2 * p.mergeInset < p.cellW, size);
        assert.ok(f.iconBox < f.cellH && f.cols * f.cellW <= app._menuContentSize.width, size);
    }
});
test('unknown or missing profile defaults to the modern large menu', () => {
    const app = harness();
    for (const size of [undefined, 'bogus', '__proto__', 'constructor', 'toString', 'large']) {
        const p = metrics(app, size).p;
        assert.deepEqual([app.menu.actor.width, app.menu.actor.height, p.cols, p.cellW, p.cellH, p.iconSize, p.iconBox], [834, 866, 8, 95, 82, 32, 42]);
    }
});
module.exports = {harness};

test('category columns fit the active menu profile instead of assuming the large reference width', () => {
    const app = harness();
    for (const [size, cols] of [['small', 3], ['medium', 3], ['large', 4]]) {
        const {p} = metrics(app, size);
        const m = app._getCategoryMetrics();
        assert.equal(m.cols, cols, size);
        assert.ok(m.cols * (m.tile + m.gap) <= p.cols * p.cellW, size);
    }
});
test('native theme chrome and section padding cannot push hit targets outside the content', () => {
    const app = harness();
    app.menu.actor.get_theme_node = () => ({get_content_box: box => ({get_size: () => [box.x2 - 180, box.y2 - 40]})});
    for (const size of ['small', 'medium', 'large']) {
        const {p, f} = metrics(app, size);
        assert.ok(p.cols * p.cellW <= app._menuContentSize.width - 52, size);
        assert.ok(f.cols * f.cellW <= app._menuContentSize.width - 104, size);
        assert.ok(p.mergeInset * 2 < p.cellW && p.iconBox < p.cellW, size);
    }
});

test('each profile uses its real metrics for pinned/folder DND insertion, merge and cancellation', () => {
    for (const size of ['small', 'medium', 'large']) {
        const app = harness(), {context, flush} = app.fixture;
        const {p, f} = metrics(app, size);
        const actor = () => ({remove_all_transitions() {}});
        app._pinnedTiles = Array.from({length: p.cols + 3}, (_, index) => Object.assign(new context.PinnedTile(), {
            index, actor: actor(), itemData: {id: `app${index}`, type: 'app'}, setFolderDropTarget(v) {this.target = v;}
        }));
        app.pinnedItems = app._pinnedTiles.map(t => t.itemData);
        app._resetPinnedTilesPositions();
        const source = app._pinnedTiles[0];
        app._onPinnedTileDragBegin(source);
        app._handlePinnedGridDragOver(source, null, 2 * p.cellW + 1, 2 * p.cellH - 1, 0);
        flush();
        assert.equal(app._dragState.previewSlot, p.cols + 2, size);
        assert.deepEqual([source.currentX, source.currentY], [2 * p.cellW, p.cellH], size);
        app._onPinnedTileDragEnd(source, false);
        flush();
        assert.deepEqual([source.currentX, source.currentY], [0, 0], size);
        app._onPinnedTileDragBegin(source);
        app._handlePinnedGridDragOver(source, null, 1.5 * p.cellW, (p.mergeTop + p.mergeBottom) / 2, 0);
        flush();
        assert.equal(app._dragState.folderTargetIndex, 1, size);
        assert.equal(app._pinnedTiles[1].target, true, size);
        app._onPinnedTileDragEnd(source, false);
        flush();

        app._folderTiles = Array.from({length: 5}, (_, index) => Object.assign(new context.FolderAppTile(), {
            index, currentSlot: index, actor: actor(), currentX: index % f.cols * f.cellW, currentY: Math.floor(index / f.cols) * f.cellH
        }));
        const folderSource = app._folderTiles[0];
        app._handleFolderGridDragOver(folderSource, null, 1, f.cellH + 1, 0);
        assert.equal(app._folderDragState.previewSlot, 4, size);
        assert.deepEqual([folderSource.currentX, folderSource.currentY], [0, f.cellH], size);
    }
});

test('a live menu-size change waits for DND source release, then applies once without changing pins or folders', () => {
    const app = harness(), {setDragging, flush} = app.fixture;
    metrics(app, 'large');
    const pins = [{id: 'folder', type: 'folder', apps: ['a', 'b']}], renders = [];
    Object.assign(app, {pinnedItems: pins, _openFolderId: 'folder',
        _refreshPinnedSection() {renders.push('pins');}, _rebuildFolderGrid(f) {renders.push(f.id);},
        _refreshAllAppsSection() {}, _refreshRecentSection() {}});
    setDragging(true);
    app._activeDndSource = {};
    app.menuSize = 'small';
    app._onLayoutChanged();
    assert.equal(app.menu.actor.width, 834);
    assert.equal(app._getPinnedMetrics().cols, 8);
    assert.deepEqual(renders, []);
    app._scheduleDndCompletion();
    flush();
    assert.equal(app.menu.actor.width, 834, 'drag-end alone is not source release');
    setDragging(false);
    flush();
    assert.equal(app.menu.actor.width, 642);
    assert.equal(app._getPinnedMetrics().cols, 6);
    assert.equal(app.pinnedItems, pins);
    assert.equal(app._openFolderId, 'folder');
    assert.deepEqual(renders, ['pins', 'folder']);
    flush();
    assert.deepEqual(renders, ['pins', 'folder']);
});

test('schema and live binding expose Menu size, retaining the old key only for migration', () => {
    assert.equal(schema['icon-size-mode'].type, 'generic');
    assert.equal(schema['icon-size-mode'].default, 'standard');
    assert.equal(schema['menu-size'].default, 'large');
    assert.equal(schema['menu-size'].description, 'Menu size / Tamanho do menu');
    assert.deepEqual(Object.values(schema['menu-size'].options), ['small', 'medium', 'large']);
    assert.ok(schema.layout1['appearance-menu'].keys.includes('menu-size'));
    assert.ok(!schema.layout1['appearance-menu'].keys.includes('icon-size-mode'));
    assert.match(source, /bind\("menu-size", "menuSize", \(\) => this\._onLayoutChanged\(\)\)/);
    assert.match(source, /bind\("icon-size-mode", "iconSizeMode", null\)/);
});
test('version 1 and 2 migration reverses old icon labels while preserving effective column counts and all user data', () => {
    for (const version of [1, 2]) {
        for (const [old, size, cols] of [['standard', 'large', 8], ['medium', 'medium', 7], ['large', 'small', 6], ['unknown', 'large', 8], ['__proto__', 'large', 8]]) {
            const app = harness();
            const pins = [{type: 'folder', id: 'f', apps: ['a.desktop']}];
            Object.assign(app, {settingsVersion: version, iconSizeMode: old, menuSize: 'large', pinnedItems: pins,
                showSearchButton: true, searchButtonStyle: 'pill', searchDisplay: 'box', showRecents: true,
                showRecentApps: true, showRecentFiles: true, menuIcon: 'user-icon', language: 'ptbr'});
            app._migrateLegacySettings();
            assert.equal(app.menuSize, size, `${version}/${old}`);
            assert.equal(app.settingsVersion, 3);
            assert.equal(app.iconSizeMode, old);
            assert.equal(app.pinnedItems, pins);
            assert.equal(app.menuIcon, 'user-icon');
            assert.equal(app.language, 'ptbr');
            assert.equal(app.searchDisplay, 'box');
            app._syncMenuGeometry();
            assert.equal(app._getPinnedMetrics().cols, cols);
            app.menuSize = 'medium';
            app._migrateLegacySettings();
            assert.equal(app.menuSize, 'medium', 'migration must not replay over later choices');
        }
    }
});
