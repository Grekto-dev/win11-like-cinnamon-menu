// Executes real applet methods in a VM; only Cinnamon actors/scheduler are stubbed.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../applet.js'), 'utf8');
function harness() {
    let next = 1;
    const timers = new Map();
    class PinnedTile {
        constructor(applet, itemData, index) {
            if (!applet) return;
            Object.assign(this, {itemData, index, currentSlot: index, currentX: (index % 8) * 76, currentY: Math.floor(index / 8) * 82, actor: actor()});
            this.actor.set_position(this.currentX, this.currentY);
        }
        setFolderDropTarget() {}
        destroy() {this.actor = null;}
    }
    class FolderAppTile {
        constructor(applet, folderData, appId, index) {
            if (!applet) return;
            Object.assign(this, {folderData, appId, index, currentSlot: index, currentX: (index % 4) * 82, currentY: Math.floor(index / 4) * 86, actor: actor()});
            this.actor.set_position(this.currentX, this.currentY);
        }
        destroy() {this.actor = null;}
    }
    const context = {Applet: {TextIconApplet: class {}}, PinnedTile, FolderAppTile,
        Mainloop: {timeout_add: (delay, fn) => {let id = next++; timers.set(id, fn); return id;},
            source_remove: id => timers.delete(id)},
        Meta: {LaterType: {BEFORE_REDRAW: 0}, later_add: (_type, fn) => {timers.set(next++, fn);}},
        GLib: {SOURCE_REMOVE: false, get_monotonic_time: () => 0},
        DND: {isDragging: () => false, addDragMonitor() {}, removeDragMonitor() {},
            DragMotionResult: {NO_DROP: 0, MOVE_DROP: 1, COPY_DROP: 2, CONTINUE: 3}},
        Clutter: {AnimationMode: {EASE_OUT_QUAD: 0}, EVENT_STOP: true, EVENT_PROPAGATE: false},
        PINNED_COLS: 8, PINNED_CELL_W: 76, PINNED_CELL_H: 82,
        FOLDER_COLS: 4, FOLDER_CELL_W: 82, FOLDER_CELL_H: 86};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {pinnedItems: [], _pinnedTiles: [], _folderTiles: [], enableAnimation: false,
        t: key => key, saves: 0, closes: 0, rebuilds: 0, opens: 0,
        _savePinnedItems() {this.saves++;}, _refreshPinnedSection() {},
        _rebuildFolderGrid() {this.rebuilds++;}, _closeFolder() {this.closes++; this._openFolderId = null;},
        _openFolder() {this.opens++;}, closeFloatingMenus() {}});
    function flush() {for (const [id, fn] of [...timers]) {if (!timers.has(id)) continue; timers.delete(id); if (fn()) timers.set(id, fn);}}
    function tile(index, data = {type: 'app', id: 'app' + index}) {
        const t = Object.assign(new PinnedTile(), {index, itemData: data, currentSlot: index,
            currentX: index * 76, currentY: 0, target: false,
            setFolderDropTarget(value) {this.target = value;}, actor: actor()});
        app._pinnedTiles.push(t); return t;
    }
    function actor() {return {opacity: 255, x: 0, y: 0, remove_all_transitions() {},
        ease(props) {this.animationFrom = {x: this.x, y: this.y}; Object.assign(this, props); if (props.onComplete) props.onComplete();},
        set_position(x, y) {this.x = x; this.y = y;}};}
    return {app, flush, timers, tile, actor, FolderAppTile, Class, context};
}

test('menu event capture yields to the real DND grab until drag completion', () => {
    const {app, context, tile, flush} = harness();
    app.menu = {passEvents: false};
    context.DND.isDragging = () => true;
    const dragged = tile(0);
    app._onPinnedTileDragBegin(dragged);
    assert.equal(app.menu.passEvents, true);
    app._onPinnedTileDragEnd(dragged, false);
    assert.equal(app.menu.passEvents, true);
    context.DND.isDragging = () => false;
    flush();
    assert.equal(app.menu.passEvents, false);
});

test('renaming returns focus to the menu before hiding the entry', () => {
    const {app} = harness();
    const order = [];
    app._folderRenaming = true;
    app.menu = {isOpen: true, actor: {grab_key_focus() {order.push('focus');}}};
    app.folderTitleEntry = {hide() {order.push('hide');}};
    app.folderTitleBtn = {show() {}};
    app._commitFolderRename();
    assert.deepEqual(order, ['focus', 'hide']);
});

test('closing a folder returns focus before the overlay disappears', () => {
    const {app, Class, actor} = harness();
    const order = [];
    app._closeFolder = Class.prototype._closeFolder;
    app.menu = {isOpen: true, actor: {grab_key_focus() {order.push('focus');}}};
    app.folderCard = actor();
    app.folderOverlay = {visible: true, hide() {order.push('hide');}};
    app._closeFolder();
    assert.deepEqual(order, ['focus', 'hide']);
});

test('extracting one of two apps preserves the open single-app folder', () => {
    const {app} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}, {type: 'app', id: 'c'}];
    app._openFolderId = 'f';
    app._removeAppFromFolder('f', 'a', true, 2);
    assert.equal(app.pinnedItems[0].type, 'folder');
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b']);
    assert.equal(app._openFolderId, 'f');
    assert.equal(app.closes, 0);
    assert.deepEqual(app.pinnedItems.map(i => i.id), ['f', 'c', 'a']);
});

test('merging creates a closed folder without delayed rename or opening', () => {
    const {app, flush, timers} = harness();
    app.pinnedItems = [{type: 'app', id: 'a'}, {type: 'app', id: 'b'}];
    app._mergeAppIntoPinnedTarget('a', 0, 1);
    flush();
    assert.equal(app.opens, 0);
    assert.equal(timers.size, 0);
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b', 'a']);
});

test('stationary center hover arms merge only after dwell; leave cancels it', () => {
    const {app, tile, flush, timers} = harness();
    const dragged = tile(0); tile(1); tile(2);
    app._onPinnedTileDragBegin(dragged);
    app._handlePinnedGridDragOver(dragged, null, 110, 25, 0);
    assert.equal(app._dragState.folderTargetIndex, -1);
    assert.equal(app._pinnedTiles[1].target, false);
    flush();
    assert.equal(app._dragState.folderTargetIndex, 1);
    assert.equal(app._pinnedTiles[1].target, true);
    app._handlePinnedGridDragOut();
    assert.equal(app._dragState.folderTargetIndex, -1);
    assert.equal(timers.size, 0);
});

test('stationary edge hover reorders before release and preview stays stable', () => {
    const {app, tile, flush} = harness();
    const dragged = tile(0); tile(1); tile(2);
    app._onPinnedTileDragBegin(dragged);
    app._handlePinnedGridDragOver(dragged, null, 154, 65, 0);
    flush();
    assert.equal(app._dragState.previewSlot, 2);
    assert.deepEqual(app._pinnedTiles.map(t => t.currentSlot), [2, 0, 1]);
    app._handlePinnedGridDragOver(dragged, null, 154, 65, 0);
    flush();
    assert.deepEqual(app._pinnedTiles.map(t => t.currentSlot), [2, 0, 1]);
    app._onPinnedTileDragEnd(dragged, false);
    assert.deepEqual(app._pinnedTiles.map(t => t.currentSlot), [0, 1, 2]);
});

test('folder reorder cancel restores original slots without saving', () => {
    const {app, actor, FolderAppTile} = harness();
    const folder = {type: 'folder', id: 'f', apps: ['a', 'b']};
    app.pinnedItems = [folder];
    const dragged = Object.assign(new FolderAppTile(), {index: 0, appId: 'a', folderData: folder, actor: actor()});
    app._folderTiles = [dragged, {index: 1, actor: actor()}];
    app._onFolderTileDragBegin(dragged);
    app._handleFolderGridDragOver(dragged, null, 90, 20, 0);
    app._onFolderTileDragEnd(dragged, false);
    assert.deepEqual(app._folderTiles.map(t => t.currentSlot), [0, 1]);
    assert.equal(app.saves, 0);
});

test('two successive folder reorders use current persisted tree, not stale tile data', () => {
    const {app, flush, actor, FolderAppTile, Class} = harness();
    app._savePinnedItems = function () {Class.prototype._savePinnedItems.call(this); this.saves++;};
    const stale = {type: 'folder', id: 'f', apps: ['a', 'b', 'c']};
    app.pinnedItems = JSON.parse(JSON.stringify([stale]));
    const dragged = Object.assign(new FolderAppTile(), {index: 0, appId: 'a', folderData: stale, actor: actor()});
    app._folderDragState = {sourceIndex: 0, previewSlot: 2};
    assert.equal(app._acceptFolderGridDrop(dragged, null, 0, 0, 0), true);
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b', 'c', 'a']);
    app._folderDragState = {sourceIndex: 0, previewSlot: 1};
    dragged.appId = 'b';
    app._acceptFolderGridDrop(dragged, null, 0, 0, 0);
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['c', 'b', 'a']);
});

test('folder extraction commits selected root slot only after DND completion', () => {
    const {app, context, flush, actor, FolderAppTile} = harness();
    app.pinnedItems = [{type: 'app', id: 'c'}, {type: 'folder', id: 'f', apps: ['a', 'b']}];
    app._openFolderId = 'f';
    const dragged = Object.assign(new FolderAppTile(), {appId: 'a', folderData: app.pinnedItems[1],
        actor: actor(), app: {get_id: () => 'a'}});
    app._dragState = {sourceIndex: -1, previewSlot: 0, folderTargetIndex: -1};
    context.DND.isDragging = () => true;
    assert.equal(app._acceptPinnedGridDrop(dragged, null, 2, 65, 0), true);
    flush();
    assert.deepEqual(app.pinnedItems.map(i => i.id), ['c', 'f']);
    context.DND.isDragging = () => false;
    flush();
    assert.deepEqual(app.pinnedItems.map(i => i.id), ['a', 'c', 'f']);
    assert.deepEqual(Array.from(app.pinnedItems[2].apps), ['b']);
    assert.equal(app._openFolderId, 'f');
});

test('dropping an external existing member onto its own folder is a no-op after DND completion', () => {
    const {app, context, flush, timers} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}];
    const before = JSON.stringify(app.pinnedItems);
    const source = {app: {get_id: () => 'a'}};
    app._dragState = {sourceIndex: -1, previewSlot: 0, folderTargetIndex: 0};
    context.DND.isDragging = () => true;
    assert.equal(app._acceptPinnedGridDrop(source, null, 0, 0, 0), true);
    flush();
    assert.equal(JSON.stringify(app.pinnedItems), before);
    assert.equal(app.saves, 0);
    context.DND.isDragging = () => false;
    flush();
    assert.equal(JSON.stringify(app.pinnedItems), before);
    assert.equal(app.saves, 0);
    assert.equal(timers.size, 0);
});

test('dropping an external existing member onto another folder still moves it', () => {
    const {app, flush} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']},
        {type: 'folder', id: 'g', apps: ['c']}];
    app._dragState = {sourceIndex: -1, previewSlot: 0, folderTargetIndex: 1};
    assert.equal(app._acceptPinnedGridDrop({app: {get_id: () => 'a'}}, null, 0, 0, 0), true);
    flush();
    assert.equal(JSON.stringify(app.pinnedItems), JSON.stringify([
        {type: 'folder', id: 'f', apps: ['b']},
        {type: 'folder', id: 'g', apps: ['c', 'a']}
    ]));
    assert.equal(app.saves, 1);
});

test('dropping an external existing member onto a root slot still extracts it', () => {
    const {app, flush} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}];
    app._dragState = {sourceIndex: -1, previewSlot: 0, folderTargetIndex: -1};
    assert.equal(app._acceptPinnedGridDrop({app: {get_id: () => 'a'}}, null, 0, 65, 0), true);
    flush();
    assert.equal(JSON.stringify(app.pinnedItems), JSON.stringify([
        {type: 'app', id: 'a'}, {type: 'folder', id: 'f', apps: ['b']}
    ]));
    assert.equal(app.saves, 1);
});

test('single-app folders survive initialization', () => {
    const {app, context} = harness();
    context.appsys = {lookup_app: () => ({})};
    app.pinnedItems = [{type: 'folder', id: 'f', name: 'keep name', apps: ['a']}];
    app._ensureInitialPinnedItems();
    assert.equal(app.pinnedItems[0].type, 'folder');
    assert.equal(app.pinnedItems[0].name, 'keep name');
});

test('merging an externally dragged already-pinned app moves its root occurrence', () => {
    const {app} = harness();
    app.pinnedItems = [{type: 'app', id: 'a'}, {type: 'app', id: 'b'}, {type: 'app', id: 'c'}];
    app._mergeAppIntoPinnedTarget('a', -1, 1);
    assert.deepEqual(app.pinnedItems.map(i => i.type), ['folder', 'app']);
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b', 'a']);
});

test('folder backdrop fills root and outside release closes even during rename', () => {
    const {app, context} = harness();
    class Widget {
        constructor(props = {}) {Object.assign(this, props); this.handlers = {}; this.clutter_text = this;}
        connect(name, fn) {this.handlers[name] = fn;}
        add_actor() {}
    }
    context.St = {BoxLayout: Widget, Widget, Label: Widget, Icon: Widget, Entry: Widget, IconType: {SYMBOLIC: 0}};
    Object.assign(context.Clutter, {ActorAlign: {CENTER: 'center', FILL: 'fill'}, FixedLayout: class {}, BinLayout: class {}});
    app._buildFolderOverlay();
    assert.equal(app.folderOverlay.x_align, 'fill');
    assert.equal(app.folderOverlay.y_align, 'fill');
    app._folderRenaming = true;
    let renames = 0;
    app._commitFolderRename = () => {renames++;};
    const result = app.folderOverlay.handlers['button-release-event'](app.folderOverlay,
        {get_source: () => app.folderOverlay});
    assert.equal(result, true);
    assert.equal(app.closes, 1);
});

test('folder backdrop routes actual pointer to arbitrary root slot, never drag icon center', () => {
    const {app, context, FolderAppTile} = harness();
    class Widget {
        constructor(props = {}) {Object.assign(this, props); this.clutter_text = this;}
        connect() {} add_actor() {}
    }
    context.St = {BoxLayout: Widget, Widget, Label: Widget, Icon: Widget, Entry: Widget, IconType: {SYMBOLIC: 0}};
    Object.assign(context.Clutter, {ActorAlign: {CENTER: 0, FILL: 1}, FixedLayout: class {}, BinLayout: class {}});
    context.global = {get_pointer: () => [710, 360]};
    app._buildFolderOverlay();
    app.folderCard.transform_stage_point = (x, y) => [true, x - 800, y - 500];
    app.folderCard.width = 300; app.folderCard.height = 200;
    app.pinnedGridActor = {width: 608, height: 400, transform_stage_point: (x, y) => [true, x - 650, y - 300]};
    let coords;
    app._handlePinnedGridDragOver = (_s, _a, x, y) => {coords = [x, y]; return 1;};
    app._acceptPinnedGridDrop = (_s, _a, x, y) => {coords = [x, y]; return true;};
    const tile = Object.assign(new FolderAppTile(), {folderData: {id: 'f'}});
    app.folderOverlay._delegate.handleDragOver(tile, {x: 999, y: 999, width: 32, height: 32}, 0, 0, 0);
    assert.deepEqual(coords, [60, 60]);
    assert.equal(app.folderOverlay._delegate.acceptDrop(tile, null, 0, 0, 0), true);
    assert.deepEqual(coords, [60, 60]);
});

test('Escape propagates to Cinnamon DND instead of dismissing folder/menu mid-drag', () => {
    let dismissed = 0;
    const context = {Applet: {AppletPopupMenu: class {}},
        DND: {isDragging: () => true}, Clutter: {KEY_Escape: 9, EVENT_PROPAGATE: false, EVENT_STOP: true}};
    const Popup = vm.runInNewContext(source.slice(source.indexOf('class Win11PopupMenu'), source.indexOf('class Win11MenuApplet')) + '\nWin11PopupMenu', context);
    const popup = Object.create(Popup.prototype);
    popup.launcher = {_handleEscapeKey() {dismissed++; return true;}};
    assert.equal(popup._onKeyPressEvent(null, {get_key_symbol: () => 9}), false);
    assert.equal(dismissed, 0);
});

test('folder reordering never commits or rebuilds while DND still owns source', () => {
    const {app, context, actor, FolderAppTile, flush} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}];
    app._openFolderId = 'f';
    const tile = Object.assign(new FolderAppTile(), {index: 0, appId: 'a', folderData: app.pinnedItems[0], actor: actor()});
    app._folderDragState = {sourceIndex: 0, previewSlot: 1};
    context.DND.isDragging = () => true;
    app._acceptFolderGridDrop(tile, null, 0, 0, 0);
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['a', 'b']);
    assert.equal(app.rebuilds, 0);
    context.DND.isDragging = () => false;
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b', 'a']);
});

test('drag monitor cancels stationary hover on leaving grid and cleans up after end', () => {
    const {app, context, tile, flush, timers} = harness();
    const monitors = new Set();
    context.DND.addDragMonitor = monitor => monitors.add(monitor);
    context.DND.removeDragMonitor = monitor => monitors.delete(monitor);
    app.pinnedGridActor = {width: 608, height: 400, transform_stage_point: (x, y) => [true, x, y]};
    const dragged = tile(0); tile(1);
    app._onPinnedTileDragBegin(dragged);
    app._handlePinnedGridDragOver(dragged, null, 110, 25, 0);
    assert.equal(monitors.size, 1);
    [...monitors][0].dragMotion({source: dragged, x: -20, y: -20});
    assert.equal(app._pinnedHoverTimer, 0);
    app._onPinnedTileDragEnd(dragged, false);
    flush();
    assert.equal(monitors.size, 0);
    assert.equal(timers.size, 0);
});

test('disabled animations settle tile previews immediately without easing', () => {
    const {app, tile} = harness();
    tile(0); const displaced = tile(1);
    let animations = 0;
    displaced.actor.ease = () => {animations++;};
    app._animatePinnedAutoArrange(0, 1);
    assert.equal(animations, 0);
    assert.equal(displaced.actor.x, 0);
    assert.equal(displaced.currentSlot, 0);
});

test('folder card animates open and close, and interrupted close cannot hide reopened folder', () => {
    const {app, actor, Class} = harness();
    const transitions = [];
    app.enableAnimation = true;
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a']}];
    app.folderCard = Object.assign(actor(), {set_style() {}, set_pivot_point() {}, ease: props => transitions.push(props)});
    app.folderOverlay = {visible: false, show() {this.visible = true;}, hide() {this.visible = false;}};
    const title = {set_text() {}, hide() {}, show() {}};
    app.folderTitleLabel = title; app.folderTitleBtn = title; app.folderTitleEntry = title;
    app._updateThemeColors = () => {};
    Class.prototype._openFolder.call(app, 'f');
    assert.equal(app.folderCard.opacity, 0);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].opacity, 255);
    Class.prototype._closeFolder.call(app);
    assert.equal(app.folderOverlay.visible, true);
    const close = transitions[1];
    assert.ok(close.duration > 0);
    Class.prototype._openFolder.call(app, 'f');
    close.onComplete();
    assert.equal(app.folderOverlay.visible, true);
});

test('a pinned refresh cannot destroy an actor owned by an active drag', () => {
    const {app, tile, Class} = harness();
    const dragged = tile(0);
    let destroyed = 0;
    dragged.destroy = () => {destroyed++;};
    app._activeDndSource = dragged;
    app.pinnedGridActor = {destroy_all_children() {}, set_size() {}};
    app.pinnedTitleLabel = app.pinnedToggleBtnLabel = {set_text() {}};
    app.pinnedToggleBtnIcon = {set_icon_name() {}};
    Class.prototype._refreshPinnedSection.call(app);
    assert.equal(destroyed, 0);
    assert.equal(app._deferredPinnedRefresh, true);
});

test('close cancels pending drop and focus timers, including animation-disabled path', () => {
    const {app, actor, Class, timers, context, flush} = harness();
    app.folderCard = actor();
    app.folderOverlay = {visible: true, hide() {this.visible = false;}};
    app._folderRenameTimers = [context.Mainloop.timeout_add(25, () => {throw Error('late focus');})];
    let commits = 0;
    app._queueDndCommit(null, () => {commits++;});
    Class.prototype._closeFolder.call(app);
    assert.equal(timers.size, 0);
    flush();
    assert.equal(commits, 0);
    assert.equal(app.folderOverlay.visible, false);
});

test('external insertion previews make room without moving any root tile to negative slots', () => {
    const {app, tile} = harness();
    tile(0); tile(1); tile(2);
    app._animatePinnedAutoArrange(-1, 1);
    assert.deepEqual(app._pinnedTiles.map(t => t.currentSlot), [0, 2, 3]);
});

test('folder refresh defers until source drag has completed', () => {
    const {app, actor, FolderAppTile, Class} = harness();
    let destroyed = 0;
    app._activeDndSource = new FolderAppTile();
    app._folderTiles = [{actor: actor(), destroy() {destroyed++;}}];
    app.folderGridActor = {destroy_all_children() {}, set_size() {}};
    Class.prototype._rebuildFolderGrid.call(app, {id: 'f', apps: []});
    assert.equal(destroyed, 0);
    assert.equal(app._deferredFolderRefresh, true);
});

test('destroy cancels dwell, focus, deferred commits and drag monitors', () => {
    const {app, context, tile, timers, Class} = harness();
    const dragged = tile(0); tile(1);
    app._onPinnedTileDragBegin(dragged);
    app._handlePinnedGridDragOver(dragged, null, 110, 20, 0);
    app._folderRenameTimers = [context.Mainloop.timeout_add(25, () => {})];
    app._queueDndCommit(dragged, () => {});
    app.actor = {destroy() {}}; app.menu = {destroy() {}}; app.emit = () => {};
    Class.prototype.destroy.call(app);
    assert.equal(timers.size, 0);
    assert.equal(app._dndMonitor, null);
    assert.equal(app._pendingDndCommit, null);
});

test('merge target styling reserves its border instead of changing tile geometry', () => {
    const css = fs.readFileSync(require('node:path').join(__dirname, '../stylesheet.css'), 'utf8');
    const normal = css.match(/\.win11-pinned-tile\s*\{([^}]+)\}/)[1];
    assert.match(normal, /border:\s*1px solid transparent/);
});

test('a target removed while a drop is deferred cannot lose the source folder app', () => {
    const {app, actor, FolderAppTile, flush} = harness();
    const folder = {type: 'folder', id: 'f', apps: ['a', 'b']};
    app.pinnedItems = [folder, {type: 'app', id: 'target'}];
    const tile = Object.assign(new FolderAppTile(), {appId: 'a', folderData: folder, actor: actor()});
    app._dragState = {sourceIndex: -1, previewSlot: 0, folderTargetIndex: 1};
    app._acceptPinnedGridDrop(tile, null, 0, 0, 0);
    app.pinnedItems.pop();
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['a', 'b']);
});

test('closing after drag-end but before deferred commit releases pinned source protection', () => {
    const {app, tile, actor, Class} = harness();
    const source = tile(0);
    app._queueDndCommit(source, () => {});
    app.folderCard = actor();
    app.folderOverlay = {visible: false, hide() {}};
    Class.prototype._closeFolder.call(app);
    assert.equal(app._activeDndSource, null);
});

test('external drag cancellation clears its stationary hover without a source signal hook', () => {
    const {app, context, tile, flush, timers} = harness();
    tile(0); tile(1);
    app.pinnedItems = app._pinnedTiles.map(t => t.itemData);
    const source = {app: {get_id: () => 'external'}};
    context.DND.isDragging = () => true;
    app._handlePinnedGridDragOver(source, null, 110, 20, 0);
    context.DND.isDragging = () => false;
    flush();
    assert.equal(app._dragState, null);
    assert.equal(app._pinnedHoverTimer, 0);
    assert.equal(timers.size, 0);
});

test('last extraction removes only the now-empty folder and honors the selected slot', () => {
    for (const [slot, expected] of [[0, ['a', 'c', 'd', 'e']], [3, ['c', 'd', 'a', 'e']], [4, ['c', 'd', 'e', 'a']]]) {
        const {app} = harness();
        app._openFolderId = 'f';
        app.pinnedItems = [{type: 'app', id: 'c'}, {type: 'folder', id: 'f', apps: ['a']},
            {type: 'app', id: 'd'}, {type: 'app', id: 'e'}];
        app._removeAppFromFolder('f', 'a', true, slot);
        assert.deepEqual(app.pinnedItems.map(i => i.id), expected);
        assert.equal(app.closes, 1);
        assert.equal(app.saves, 1);
    }
});

test('missing or repeated extraction cannot insert a phantom or duplicate app', () => {
    const {app} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}];
    app._removeAppFromFolder('f', 'missing', true, 0);
    assert.equal(app.saves, 0);
    app._removeAppFromFolder('f', 'a', true, 0);
    app._removeAppFromFolder('f', 'a', true, 0);
    assert.deepEqual(app.pinnedItems.map(i => i.id), ['a', 'f']);
    assert.equal(app.saves, 1);
});

test('existing folder merge appends once and remains closed', () => {
    const {app, flush} = harness();
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['b']}];
    app._mergeAppIntoPinnedTarget('a', -1, 0);
    app._mergeAppIntoPinnedTarget('a', -1, 0);
    flush();
    assert.deepEqual(Array.from(app.pinnedItems[0].apps), ['b', 'a']);
    assert.equal(app.opens, 0);
});

test('folder compaction animates surviving apps from their previous coordinates', () => {
    const {app, FolderAppTile, Class} = harness();
    app.enableAnimation = true;
    const old = {id: 'f', apps: ['a', 'b']};
    app._folderTiles = [new FolderAppTile(app, old, 'a', 0), new FolderAppTile(app, old, 'b', 1)];
    app.folderGridActor = {destroy_all_children() {}, set_size() {}, add_actor() {}};
    Class.prototype._rebuildFolderGrid.call(app, {id: 'f', apps: ['b']});
    assert.equal(app._folderTiles[0].actor.animationFrom?.x, 82);
    assert.equal(app._folderTiles[0].actor.x, 0);
});

test('root compaction animates surviving tiles instead of snapping on refresh', () => {
    const {app, tile, Class} = harness();
    app.enableAnimation = true;
    tile(0, {type: 'app', id: 'a'}); const kept = tile(1, {type: 'app', id: 'b'});
    kept.actor.x = 76;
    app.pinnedItems = [{type: 'app', id: 'b'}];
    app.pinnedGridActor = {destroy_all_children() {}, set_size() {}, add_actor() {}};
    app.pinnedTitleLabel = app.pinnedToggleBtnLabel = {set_text() {}};
    app.pinnedToggleBtnIcon = {set_icon_name() {}};
    Class.prototype._refreshPinnedSection.call(app);
    assert.equal(app._pinnedTiles[0].actor.animationFrom?.x, 76);
    assert.equal(app._pinnedTiles[0].actor.x, 0);
});

module.exports = {harness};
