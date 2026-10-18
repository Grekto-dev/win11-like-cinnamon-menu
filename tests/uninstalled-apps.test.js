// Real applet/tile methods; registry and Cinnamon actors/scheduler are isolated fixtures.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../applet.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function harness(ids = ['kept.desktop']) {
    const installed = new Set(ids), timers = new Map();
    let next = 1, dragging = false;
    const context = {
        Applet: {TextIconApplet: class {}},
        appsys: {lookup_app: id => installed.has(id) ? {get_id: () => id} : null},
        AppUtils: {getApps: () => [[], []]},
        global: {settings: {get_strv: () => []}},
        Mainloop: {timeout_add: (_ms, fn) => {const id = next++; timers.set(id, fn); return id;}, source_remove: id => timers.delete(id)},
        DND: {isDragging: () => dragging},
        Clutter: {BUTTON_PRIMARY: 1, BUTTON_SECONDARY: 3, EVENT_STOP: true, EVENT_PROPAGATE: false}
    };
    context.PinnedTile = vm.runInNewContext(source.slice(source.indexOf('class PinnedTile'), source.indexOf('class FolderAppTile')) + '\nPinnedTile', context);
    context.FolderAppTile = vm.runInNewContext(source.slice(source.indexOf('class FolderAppTile'), source.indexOf('class Win11PopupMenu')) + '\nFolderAppTile', context);
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {pinnedItems: [], _pinnedTiles: [], _folderTiles: [], saves: 0, refreshes: 0, contextItems: null,
        t: key => key, _savePinnedItems() {this.saves++; this.pinnedItems = plain(this.pinnedItems);},
        _fullRefresh() {this.refreshes++;}, _refreshPinnedSection() {}, closeFloatingMenus() {},
        _closeFolder() {this.closedFolder = true; this._openFolderId = null;},
        _rebuildFolderGrid(folder) {this.rebuiltFolder = plain(folder);},
        _showFloatingMenuAtActor(anchor, items) {this.contextItems = items; this.contextAnchor = anchor;},
        _stopDndTracking() {}, _handlePinnedGridDragOut() {}, _resetPinnedTilesPositions() {}});
    function flush() {
        for (const [id, callback] of [...timers]) {
            timers.delete(id); if (callback()) timers.set(id, callback);
        }
    }
    return {app, Class, context, installed, timers, flush, drag: value => {dragging = value;}};
}

test('right-click on an unavailable root pin offers working Unpin without an app object', () => {
    const {app, context} = harness();
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}];
    const tile = Object.assign(Object.create(context.PinnedTile.prototype), {
        applet: app, itemData: app.pinnedItems[0], app: null, actor: {}
    });
    assert.equal(tile._onButtonRelease(tile.actor, {get_button: () => 3}), true);
    assert.ok(app.contextItems, 'the unavailable pin must not swallow the context click');
    assert.deepEqual(Array.from(app.contextItems, x => x.label), ['unpin_from_start']);
    app.contextItems[0].action();
    assert.deepEqual(plain(app.pinnedItems), []);
});

test('right-click on an unavailable folder member can remove it while keeping the folder', () => {
    const {app, context} = harness();
    const folder = {type: 'folder', id: 'f', name: 'Personal', apps: ['kept.desktop', 'removed.desktop']};
    app.pinnedItems = [folder];
    const tile = Object.assign(Object.create(context.FolderAppTile.prototype), {
        applet: app, folderData: folder, appId: 'removed.desktop', app: null, actor: {}
    });
    tile._onButtonRelease(tile.actor, {get_button: () => 3});
    assert.ok(app.contextItems, 'missing folder members must still offer Unpin');
    assert.deepEqual(Array.from(app.contextItems, x => x.label), ['unpin_from_start']);
    app.contextItems[0].action();
    assert.deepEqual(plain(app.pinnedItems), [{...folder, apps: ['kept.desktop']}]);
});

test('installed-app changes prune vanished pins and folder members, preserving order and folder identity', () => {
    const {app} = harness();
    const kept = {type: 'app', id: 'kept.desktop', extra: 'keep'};
    const folder = {type: 'folder', id: 'f', name: 'Personal', apps: ['removed.desktop', 'kept.desktop'], extra: {color: 2}};
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}, folder,
        {type: 'folder', id: 'empty', name: 'Empty', apps: ['removed.desktop']}, kept];
    app._openFolderId = 'f';
    assert.equal(typeof app._onInstalledAppsChanged, 'function');
    app._onInstalledAppsChanged();
    assert.deepEqual(plain(app.pinnedItems), [{...folder, apps: ['kept.desktop']}, kept]);
    assert.deepEqual(app.rebuiltFolder, {...folder, apps: ['kept.desktop']});
    assert.equal(app.saves, 1);
    assert.equal(app.refreshes, 1);
    app._onInstalledAppsChanged();
    assert.equal(app.saves, 1, 'unchanged models must not be rewritten');
});

test('uninstall cleanup waits for drag source release and a queued drop transaction', () => {
    for (const kind of ['root', 'folder', 'external']) {
        const h = harness(['kept.desktop', 'new.desktop']);
        const {app, context} = h;
        const before = [{type: 'app', id: 'removed.desktop'}, {type: 'app', id: 'kept.desktop'}];
        app.pinnedItems = plain(before);
        app._activeDndSource = kind === 'root' ? Object.create(context.PinnedTile.prototype)
            : kind === 'folder' ? Object.create(context.FolderAppTile.prototype) : {};
        let commits = 0;
        app._pendingDndCommit = () => {
            assert.deepEqual(plain(app.pinnedItems), before, 'pruning must not mutate a pending DND transaction');
            commits++;
            app.pinnedItems.push({type: 'app', id: 'new.desktop'});
        };
        h.drag(true);
        app._onInstalledAppsChanged();
        assert.deepEqual(plain(app.pinnedItems), before);
        assert.equal(app.refreshes, 0);
        h.flush();
        assert.equal(commits, 0);
        h.drag(false);
        app._onInstalledAppsChanged(); // Source object still protected until completion.
        assert.equal(app.refreshes, 0);
        h.flush();
        assert.equal(commits, 1);
        assert.equal(app.refreshes, 1);
        assert.deepEqual(plain(app.pinnedItems), [{type: 'app', id: 'kept.desktop'}, {type: 'app', id: 'new.desktop'}]);
        assert.equal(app._installedAppsRefreshPending, false);
        assert.equal(h.timers.size, 0);
    }
});

test('startup removes an all-orphan saved list instead of replacing it with default pins', () => {
    const {app, context} = harness();
    context.global.settings.get_strv = () => ['kept.desktop'];
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}];
    app._ensureInitialPinnedItems();
    assert.deepEqual(plain(app.pinnedItems), []);
    assert.equal(app.saves, 1);
});

test('closing during a deferred uninstall cannot lose the cleanup or commit a cancelled drop', () => {
    const h = harness();
    const {app} = h;
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}, {type: 'app', id: 'kept.desktop'}];
    app._cancelAllAppsMaterialize = () => {};
    app._cancelCategoryScroll = () => {};
    app._cancelFolderRenameTimers = () => {};
    app._activeDndSource = {};
    let committed = false;
    app._pendingDndCommit = () => {committed = true;};
    h.drag(true);
    app._onInstalledAppsChanged();
    app._cancelTransientInteractions();
    h.drag(false);
    h.flush();
    assert.equal(committed, false);
    assert.deepEqual(plain(app.pinnedItems), [{type: 'app', id: 'kept.desktop'}]);
    assert.equal(app.refreshes, 1);
    assert.equal(h.timers.size, 0);
});

test('a stale non-null Cinnamon app object still offers only Unpin after removal', () => {
    const {app} = harness();
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}];
    app.showAppContextMenu({get_id: () => 'removed.desktop'}, {});
    assert.deepEqual(Array.from(app.contextItems, x => x.label), ['unpin_from_start']);
    app.contextItems[0].action();
    assert.deepEqual(plain(app.pinnedItems), []);
});

test('uninstalling the final folder member closes only the empty folder and keeps remaining pins', () => {
    const {app} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', name: 'Personal', apps: ['removed.desktop']},
        {type: 'app', id: 'kept.desktop'}];
    app._openFolderId = 'f';
    app._onInstalledAppsChanged();
    assert.equal(app.closedFolder, true);
    assert.deepEqual(plain(app.pinnedItems), [{type: 'app', id: 'kept.desktop'}]);
    assert.equal(app.saves, 1);
});

test('destroy cancels a deferred registry cleanup and ignores later signals', () => {
    const h = harness();
    const {app} = h;
    app.pinnedItems = [{type: 'app', id: 'removed.desktop'}];
    app._cancelAllAppsMaterialize = () => {};
    app._cancelCategoryScroll = () => {};
    app._cancelFolderRenameTimers = () => {};
    h.drag(true);app._onInstalledAppsChanged();
    assert.equal(h.timers.size, 1);
    app._destroying = true;app._cancelTransientInteractions();
    h.drag(false);h.flush();app._onInstalledAppsChanged();
    assert.equal(h.timers.size, 0);
    assert.equal(app.saves, 0);
    assert.equal(app.refreshes, 0);
});

test('registry changes use a managed connection rather than a reload-leaking callback', () => {
    assert.match(source, /this\._geometrySignals\.connect\(appsys, 'installed-changed', \(\) => this\._onInstalledAppsChanged\(\)\)/);
    assert.doesNotMatch(source, /appsys\.connect\('installed-changed'/);
});
