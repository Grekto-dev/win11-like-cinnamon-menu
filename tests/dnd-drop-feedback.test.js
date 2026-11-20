// Windows-11-style drag-over feedback of pinned tiles. Runs the real PinnedTile methods in a VM with fake actors.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

class FakeActor {
    constructor(props = {}) {
        Object.assign(this, {opacity: 255, scale_x: 1, scale_y: 1, translation_x: 0, translation_y: 0, children: [], child: null}, props);
    }
    set_pivot_point(x, y) {this.pivot = [x, y];}
    add_child(c) {this.children.push(c);}
    add_actor(c) {this.children.push(c);}
    set_child(c) {this.child = c;}
    get_child() {return this.child;}
    set_style_class_name(n) {this.style_class = n;}
    destroy() {this.destroyed = true;}
}
function appletHarness() {
    class PinnedTile {
        constructor(applet, itemData, index) {Object.assign(this, {itemData, index, currentX: 0, currentY: 0, actor: new FakeActor()});}
        destroy() {}
    }
    const context = {Applet: {TextIconApplet: class {}}, PinnedTile, FolderAppTile: class {},
        Mainloop: {timeout_add: () => 1, source_remove() {}}, Meta: {LaterType: {BEFORE_REDRAW: 0}, later_add() {}},
        GLib: {SOURCE_REMOVE: false, get_monotonic_time: () => 0},
        DND: {isDragging: () => false, addDragMonitor() {}, removeDragMonitor() {}},
        Clutter: {AnimationMode: {EASE_OUT_QUAD: 0}, EVENT_STOP: true, EVENT_PROPAGATE: false},
        PINNED_COLS: 8, PINNED_CELL_W: 76, PINNED_CELL_H: 82, FOLDER_COLS: 4, FOLDER_CELL_W: 82, FOLDER_CELL_H: 86};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {pinnedItems: [], _pinnedTiles: [], _folderTiles: [], enableAnimation: false, t: key => key,
        _savePinnedItems() {}, _refreshPinnedSection() {}, _activeDndSource: null});
    return {app, Class, context};
}
function load() {
    const created = [];
    const make = kind => class extends FakeActor {constructor(p) {super(p); this.kind = kind; created.push(this);}};
    const context = {
        St: {Bin: make('Bin'), Widget: make('Widget'), BoxLayout: make('BoxLayout'), Label: make('Label'), Align: {START: 'st-start', MIDDLE: 'st-middle', END: 'st-end'}},
        Clutter: {BinLayout: class {}, ActorAlign: {CENTER: 'center', START: 'start'}},
        Pango: {}, DND: {isDragging: () => false}, SignalManager: {SignalManager: class {}},
        createAppIcon: (app, size) => new FakeActor({kind: 'Icon', iconSize: size, app}),
        appsys: {lookup_app: id => ({id})},
    };
    const Tile = vm.runInNewContext(source.slice(source.indexOf('const DROP_FEEDBACK'), source.indexOf('/**\n * Draggable app tile inside an open Folder modal')) + '\nPinnedTile', context);
    return {Tile, created};
}
function makeTile(itemData, metricsOverride = {}) {
    const {Tile, created} = load();
    const metrics = Object.assign({iconBox: 42, scale: 1, logicalScale: 1, iconSize: 32}, metricsOverride);
    const calls = [];
    const applet = {enableAnimation: true, applicationIconSize: 32, _getPinnedMetrics: () => metrics,
        _animateActor(actor, props, duration) {calls.push({actor, props: Object.assign({}, props), duration}); Object.assign(actor, props);}};
    const tile = Object.create(Tile.prototype);
    const iconActor = new FakeActor({kind: 'Icon', iconSize: 32});
    const iconContainer = new FakeActor({kind: 'Bin'});
    iconContainer.set_child(iconActor);
    const label = new FakeActor({kind: 'Label'});
    Object.assign(tile, {applet, itemData, iconActor, iconContainer, label, actor: new FakeActor()});
    return {tile, calls, iconActor, iconContainer, label, created, metrics, Tile};
}
const approx = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('an app merge target shrinks into the top-left cell of a folder plate and hides its label', () => {
    const {tile, calls, iconActor, iconContainer, label, created} = makeTile({type: 'app', id: 'edge'});
    tile.setFolderDropTarget(true);
    const wrapper = iconContainer.child;
    assert.notEqual(wrapper, iconActor, 'icon is hosted by an overlay so a plate can sit behind it');
    assert.equal(wrapper.children.length, 2);
    const [plate, icon] = wrapper.children;
    assert.equal(icon, iconActor);
    assert.equal(plate.style_class, 'win11-folder-mini-preview');
    assert.equal(plate.width, 38); assert.equal(plate.height, 38);
    // a plain St.Widget centred with Clutter alignment: an St.Bin stretched to the whole icon box on the real shell
    assert.equal(plate.kind, 'Widget');
    assert.equal(plate.x_align, 'center'); assert.equal(plate.y_align, 'center');
    // default metrics: plate left 2 + border 1 + padding 4 + half a 13px cell = 13.5 vs icon centre 21
    approx(iconActor.scale_x, 13 / 32); approx(iconActor.scale_y, 13 / 32);
    approx(iconActor.translation_x, -7.5); approx(iconActor.translation_y, -7.5);
    assert.deepEqual(iconActor.pivot, [0.5, 0.5]);
    assert.equal(plate.opacity, 255);
    assert.equal(label.opacity, 0);
    const byActor = a => calls.find(c => c.actor === a);
    assert.ok(byActor(label).duration <= 120, 'the label goes away quickly');
    assert.ok(byActor(iconActor).duration >= 150 && byActor(iconActor).duration <= 250);
    assert.ok(byActor(plate).duration >= 100 && byActor(plate).duration <= 250);
    assert.equal(created.filter(a => a.kind === 'Widget').length, 2, 'one overlay (wrapper + plate) is created');
});

test('leaving an app merge target restores icon, label and hides the plate; re-entering reuses the overlay', () => {
    const {tile, iconActor, iconContainer, label, created} = makeTile({type: 'app', id: 'edge'});
    tile.setFolderDropTarget(true);
    const wrapper = iconContainer.child, plate = wrapper.children[0];
    tile.setFolderDropTarget(false);
    assert.equal(iconActor.scale_x, 1); assert.equal(iconActor.scale_y, 1);
    assert.equal(iconActor.translation_x, 0); assert.equal(iconActor.translation_y, 0);
    assert.equal(label.opacity, 255);
    assert.equal(plate.opacity, 0);
    const widgets = created.filter(a => a.kind === 'Widget').length;
    tile.setFolderDropTarget(true);
    assert.equal(created.filter(a => a.kind === 'Widget').length, widgets, 'overlay is built once');
    assert.equal(iconContainer.child, wrapper);
});

test('a folder target shrinks its plate to about 78% about its centre and keeps its label', () => {
    const {tile, calls, iconActor, iconContainer, label, created} = makeTile({type: 'folder', id: 'f', apps: ['a', 'b']});
    tile.setFolderDropTarget(true);
    approx(iconActor.scale_x, 0.78, 0.04); approx(iconActor.scale_y, 0.78, 0.04);
    assert.deepEqual(iconActor.pivot, [0.5, 0.5]);
    assert.equal(label.opacity, 255, 'folder label stays');
    assert.equal(iconContainer.child, iconActor, 'no overlay for folders');
    assert.equal(created.length, 0);
    const call = calls.find(c => c.actor === iconActor);
    assert.ok(call.duration >= 150 && call.duration <= 250);
    tile.setFolderDropTarget(false);
    assert.equal(iconActor.scale_x, 1); assert.equal(iconActor.scale_y, 1);
});

test('repeating the same target state, or clearing a tile that never was a target, does nothing', () => {
    const {tile, calls} = makeTile({type: 'app', id: 'edge'});
    tile.setFolderDropTarget(false);
    assert.equal(calls.length, 0, 'every drag end clears every tile; that must stay free');
    tile.setFolderDropTarget(true);
    const n = calls.length;
    tile.setFolderDropTarget(true);
    assert.equal(calls.length, n);
});

test('the shrunken icon lands exactly on the first cell of the real folder preview at every size', () => {
    for (const m of [{}, {iconBox: 63, scale: 1.5, logicalScale: 1.5, iconSize: 48}, {iconBox: 84, scale: 2, logicalScale: 1, iconSize: 64},
                     {iconBox: 36, scale: 0.85, logicalScale: 0.85, iconSize: 27}]) {
        const {tile, iconActor, iconContainer, created, metrics} = makeTile({type: 'app', id: 'edge'}, m);
        tile.applet.applicationIconSize = metrics.iconSize;
        iconActor.iconSize = metrics.iconSize;
        tile.setFolderDropTarget(true);
        const plate = iconContainer.child.children[0];
        const folder = tile._buildFolderMiniIcon(['edge']);          // what a one-app folder tile would draw
        const row = folder.children[0], cell = row.children[0];
        const cellIcon = cell.child;
        assert.ok(cellIcon, 'first cell holds the app icon');
        // scaled size == the folder's own first-cell icon size (in the same logical units as the icon)
        approx(iconActor.iconSize * iconActor.scale_x, cellIcon.iconSize, 0.6);
        assert.equal(plate.width, folder.width, JSON.stringify(m)); assert.equal(plate.height, folder.height);
        // the icon moves up and to the left, but stays inside the plate
        assert.ok(iconActor.translation_x < 0 && iconActor.translation_y < 0);
        assert.ok(Math.abs(iconActor.translation_x) < plate.width / 2 && Math.abs(iconActor.translation_y) < plate.height / 2);
    }
});

test('with animations disabled the feedback applies immediately through the applet animation helper', () => {
    const {tile, iconActor, label} = makeTile({type: 'app', id: 'edge'});
    const applet = tile.applet;
    applet.enableAnimation = false;
    applet._animateActor = (actor, props) => Object.assign(actor, props);   // the real helper does exactly this when disabled
    tile.setFolderDropTarget(true);
    approx(iconActor.scale_x, 13 / 32); assert.equal(label.opacity, 0);
});

test('a freshly merged folder tile fades in; an enlarged existing folder settles back from the shrunken size', () => {
    let r = makeTile({type: 'folder', id: 'new', apps: ['a', 'b']});
    r.tile.playDropSettle('create');
    assert.ok(r.calls.length >= 1);
    const fade = r.calls.find(c => c.props.opacity === 255);
    assert.ok(fade && fade.duration >= 150 && fade.duration <= 300, 'fade-in');
    assert.equal(r.iconContainer.opacity, 255, 'ends fully visible');
    r = makeTile({type: 'folder', id: 'f', apps: ['a', 'b', 'c']});
    r.tile.playDropSettle('append');
    const first = r.calls[0];
    assert.equal(first.props.scale_x, 1);
    assert.equal(r.iconActor.scale_x, 1);
});

test('merging records which tile should settle, and the next refresh animates only that tile', () => {
    const {app, Class} = appletHarness();
    app.pinnedItems = [{type: 'app', id: 'a'}, {type: 'app', id: 'b'}];
    app._savePinnedItems = () => {}; let refreshed = 0; app._refreshPinnedSection = () => {refreshed++;};
    app._mergeAppIntoPinnedTarget('b', 1, 0);
    assert.equal(refreshed, 1);
    assert.equal(app._dropSettle.kind, 'create');
    assert.equal(app._dropSettle.id, app.pinnedItems[0].id);
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['x']}, {type: 'app', id: 'y'}];
    app._mergeAppIntoPinnedTarget('y', 1, 0);
    assert.deepEqual({...app._dropSettle}, {id: 'f', kind: 'append'});
});

test('refresh consumes the pending settle exactly once and leaves other tiles alone', () => {
    const {app, Class, context} = appletHarness();
    const settled = [];
    context.PinnedTile.prototype.playDropSettle = function (kind) {settled.push([this.itemData.id, kind]);};
    app.pinnedItems = [{type: 'folder', id: 'f', apps: ['a', 'b']}, {type: 'app', id: 'z'}];
    app.pinnedGridActor = {destroy_all_children() {}, set_size() {}, add_actor() {}};
    app.pinnedTitleLabel = app.pinnedToggleBtnLabel = {set_text() {}};
    app.pinnedToggleBtnIcon = {set_icon_name() {}};
    app.pinnedExpanded = true;
    app._dropSettle = {id: 'f', kind: 'create'};
    Class.prototype._refreshPinnedSection.call(app);
    assert.deepEqual(settled, [['f', 'create']]);
    assert.equal(app._dropSettle, null);
    Class.prototype._refreshPinnedSection.call(app);
    assert.equal(settled.length, 1, 'no replay on the next refresh');
});
