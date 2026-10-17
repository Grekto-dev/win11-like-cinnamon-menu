// The "All" section holds ~675 of the menu's ~1100 actors. Measured live: realizing
// them is the one-time first-open cost (~700 ms vs ~250 ms without them), so rows
// are built per letter group only when their reserved slot nears the viewport.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

class Actor {
    constructor(props = {}) {Object.assign(this, props); this.children = []; this.hidden = false;}
    add_actor(c) {this.children.push(c);}
    add(c) {this.children.push(c);}
    connect() {return 1;}
    set_height(h) {this.height = h;}
    get_preferred_height() {return [0, (this.children.length || 1) * 40];}
    destroy_all_children() {this.children = [];}
    get_transformed_position() {return [0, this.y || 0];}
}
function harness({apps = 60, mode = 'list', open = true} = {}) {
    let next = 1;
    const idles = new Map();
    const context = {Applet: {TextIconApplet: class {}},
        St: {Button: Actor, BoxLayout: Actor, Label: Actor, Align: {START: 0}},
        Clutter: {ActorAlign: {CENTER: 0}}, Pango: {EllipsizeMode: {END: 1}},
        Mainloop: {idle_add: (fn) => {const id = next++; idles.set(id, fn); return id;},
            source_remove: id => idles.delete(id)},
        GLib: {SOURCE_REMOVE: false, SOURCE_CONTINUE: true}, global: {ui_scale: 1},
        DND: {isDragging: () => false}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const data = Array.from({length: apps}, (_, i) => [{get_name: () => letters[i % 26] + 'pp' + i, get_id: () => 'app' + i}, ['cat']]);
    const built = [];
    Object.assign(app, {allAppsListBox: new Actor(), allAppsTitleLabel: {set_text() {}}, allAppsViewBtnLabel: {set_text() {}},
        _pinnedTiles: [], _folderTiles: [], _folderRenameTimers: [],
        allAppsViewMode: mode, _allAppsData: data, _allDirsData: [], _destroying: false,
        menu: {isOpen: open}, t: s => s, _getPinnedMetrics: () => ({cols: 8, cellW: 76, cellH: 82}),
        startScrollView: Object.assign(new Actor(), {y: 0, height: 600}),
        _createAllAppsListRow(a) {built.push(a.get_id()); return new Actor();},
        _addAppsGridRows(box, list) {for (const a of list) built.push(a.get_id());}});
    const flush = () => {for (const [id, fn] of [...idles]) {idles.delete(id); if (fn()) idles.set(id, fn);}};
    return {app, built, idles, flush, context};
}

test('refreshing "All" creates headers and reserved slots but no application rows', () => {
    const {app, built} = harness();
    app._refreshAllAppsSection();
    assert.equal(built.length, 0);
    assert.equal(app._allAppsGroups.length, 26);
    for (const g of app._allAppsGroups) {
        assert.ok(g.body.height > 0, 'slot reserves scroll height before rows exist');
        assert.equal(g.built, false);
    }
});

test('only groups near the viewport are built, a bounded number per idle tick', () => {
    const {app, built, flush} = harness();
    app._refreshAllAppsSection();
    app._allAppsGroups.forEach((g, i) => {g.body.y = 700 + i * 200;});
    app.startScrollView.y = 0; app.startScrollView.height = 600;
    app._allAppsRowHeight = 40;
    const n = app._materializeAllAppsInView(2);
    assert.equal(n, 2);
    assert.deepEqual(Array.from(app._allAppsGroups.map(g => g.built).slice(0, 4)), [true, true, false, false]);
    assert.ok(built.length > 0 && built.length < 60);
    assert.equal(app._allAppsGroups[0].body.height, -1, 'built slot returns to natural height');
});

test('groups far below the viewport stay unbuilt', () => {
    const {app, built} = harness();
    app._refreshAllAppsSection();
    app._allAppsGroups.forEach((g, i) => {g.body.y = 5000 + i * 200;});
    assert.equal(app._materializeAllAppsInView(), 0);
    assert.equal(built.length, 0);
});

test('nothing is built while the menu is closed (actors are unmapped)', () => {
    const {app, built} = harness({open: false});
    app._refreshAllAppsSection();
    app._allAppsGroups.forEach(g => {g.body.y = 0;});
    assert.equal(app._materializeAllAppsInView(), 0);
    assert.equal(built.length, 0);
});

test('alphabet jump builds its target group on demand', () => {
    const {app, built} = harness();
    app._refreshAllAppsSection();
    app._ensureAllAppsGroup('M');
    assert.ok(app._allAppsGroups.find(g => g.key === 'M').built);
    assert.equal(app._allAppsGroups.filter(g => g.built).length, 1);
    assert.ok(built.every(id => Number(id.slice(3)) % 26 === 12));
    app._ensureAllAppsGroup('M');
    assert.equal(built.length, new Set(built).size, 'second request does not rebuild');
});

test('rebuilding the section cancels queued work from the previous generation', () => {
    const {app, built, idles, flush} = harness();
    app._refreshAllAppsSection();
    app._queueAllAppsMaterialize();
    assert.equal(idles.size, 1);
    app.menu.isOpen = false;
    app._refreshAllAppsSection();
    assert.equal(idles.size, 0, 'stale idle removed');
    app._queueAllAppsMaterialize();
    app._queueAllAppsMaterialize();
    assert.equal(idles.size, 1, 'queued once however often it is requested');
    app._destroying = true;
    flush();
    assert.equal(built.length, 0);
});

test('measured row height replaces the estimate for slots that are still unbuilt', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    const before = app._allAppsGroups[5].body.height;
    app._allAppsGroups[0].body.y = 10;
    app._allAppsGroups[0].body.get_preferred_height = () => [0, app._allAppsGroups[0].apps.length * 61];
    app._buildAllAppsGroup(app._allAppsGroups[0]);
    assert.equal(app._allAppsRowHeight, 61);
    assert.notEqual(app._allAppsGroups[5].body.height, before);
    assert.equal(app._allAppsGroups[5].body.height, 61 * app._allAppsGroups[5].apps.length);
});

test('teardown cancels the idle that materializes rows', () => {
    const {app, idles} = harness();
    app._refreshAllAppsSection();
    app._queueAllAppsMaterialize();
    app._destroying = true;
    app._cancelTransientInteractions();
    assert.equal(idles.size, 0);
});

test('cancelling transient interactions on an open menu requeues pending materialization', () => {
    const {app, idles} = harness();
    app._refreshAllAppsSection();
    app._queueAllAppsMaterialize();
    app._cancelTransientInteractions();
    assert.equal(idles.size, 1);
});

test('showing the main start view queues materialization (search -> start switch)', () => {
    const {app, idles} = harness();
    Object.assign(app, {allRecentSubView: {hide() {}, show() {}}, alphabetJumperBox: {hide() {}, show() {}}});
    app.startScrollView.hide = () => {}; app.startScrollView.show = () => {};
    app.allAppsListBox.show = () => {}; app.allAppsListBox.hide = () => {};
    app._refreshAllAppsSection();
    app._cancelAllAppsMaterialize();
    idles.clear();
    app._showStartSubView('main');
    assert.equal(idles.size, 1);
});
