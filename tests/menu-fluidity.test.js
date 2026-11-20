// Fluidity work: cheaper menu open and search. Runs the real applet methods in a VM with minimal fakes.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function make(extra = {}) {
    let nowUs = 0;
    const idles = [];
    const writes = [];
    class FakeTip {
        constructor(actor, text, checkLabel, extras) {
            Object.assign(this, {actor, text, checkLabel, extras, destroyed: false, hidden: 0, entered: []});
            FakeTip.created.push(this);
        }
        _onEnterEvent(a, e) {this.entered.push([a, e]);}
        hide() {this.hidden++;}
        destroy() {this.destroyed = true;}
    }
    FakeTip.created = [];
    const context = Object.assign({
        Applet: {TextIconApplet: class {}},
        Win11AboveTooltip: FakeTip,
        Clutter: {EVENT_PROPAGATE: false, EVENT_STOP: true, AnimationMode: {EASE_OUT_QUAD: 0}},
        Mainloop: {idle_add: fn => {idles.push(fn); return idles.length;}, timeout_add: () => 1, source_remove() {}},
        GLib: {
            get_monotonic_time: () => nowUs,
            get_user_cache_dir: () => '/cache', build_filenamev: parts => parts.join('/'),
            mkdir_with_parents: () => 0, file_set_contents: (p, data) => {writes.push([p, data]); return true;},
            SOURCE_REMOVE: false,
        },
        DND: {isDragging: () => false},
        Meta: {LaterType: {BEFORE_REDRAW: 0}, later_add() {}},
        PINNED_COLS: 8, PINNED_CELL_W: 76, PINNED_CELL_H: 82, FOLDER_COLS: 4, FOLDER_CELL_W: 82, FOLDER_CELL_H: 86,
    }, extra);
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    return {app, Class, context, FakeTip, idles, writes, advance: ms => {nowUs += ms * 1000;}};
}
function fakeActor() {
    const handlers = {};
    return {handlers, destroyed: false,
        connect(name, fn) {const id = Object.keys(handlers).length + 1; handlers[id] = {name, fn}; return id;},
        disconnect(id) {delete handlers[id];},
        emit(name, ...args) {for (const [id, h] of Object.entries(handlers)) if (h.name === name) h.fn(this, ...args);},
        count(name) {return Object.values(handlers).filter(h => h.name === name).length;}};
}

// ---------------------------------------------------------------- lazy tooltips
test('attaching a tooltip creates nothing until the pointer first enters the actor', () => {
    const {app, FakeTip} = make();
    const actor = fakeActor();
    const handle = app._attachEllipsisTooltip(actor, 'Name', {label: 1}, [{label: 2, text: 'd'}]);
    assert.equal(FakeTip.created.length, 0, 'no St.Label / Gio.Settings / signals at build time');
    assert.equal(actor._win11Tooltip, undefined);
    assert.equal(actor.count('enter-event'), 1);
    assert.ok(handle && typeof handle.hide === 'function' && typeof handle.destroy === 'function');
    handle.hide();   // must be safe before creation
});

test('the first enter creates the tooltip once, replays that enter on it and stops listening', () => {
    const {app, FakeTip} = make();
    const actor = fakeActor();
    app._attachEllipsisTooltip(actor, 'Name', 'lbl', []);
    const ev = {x: 1};
    actor.emit('enter-event', ev);
    assert.equal(FakeTip.created.length, 1);
    const tip = FakeTip.created[0];
    assert.deepEqual([tip.text, tip.checkLabel], ['Name', 'lbl']);
    assert.deepEqual(tip.entered, [[actor, ev]], 'the enter that triggered creation is not lost');
    assert.equal(actor._win11Tooltip, tip);
    assert.ok(app._activeTooltips.has(tip));
    assert.equal(actor.count('enter-event'), 0, 'the one-shot listener is gone');
    actor.emit('enter-event', ev);
    assert.equal(FakeTip.created.length, 1);
});

test('the actor destroy handler runs the full tooltip cleanup only once a tooltip exists', () => {
    const {app} = make();
    const actor = fakeActor();
    app._attachEllipsisTooltip(actor, 'Name', null, []);
    assert.equal(actor.count('destroy'), 0, 'nothing to clean up before creation');
    actor.emit('enter-event', {});
    assert.equal(actor.count('destroy'), 1);
    actor.emit('destroy');
    assert.equal(app._activeTooltips.size, 0);
});

test('destroy-all and hide-all only touch tooltips that were created; footer tooltips stay eager', () => {
    const {app, FakeTip} = make();
    const a = fakeActor(), b = fakeActor(), footer = fakeActor();
    app._attachEllipsisTooltip(a, 'A', null, []);
    app._attachEllipsisTooltip(b, 'B', null, []);
    a.emit('enter-event', {});
    app._attachFooterTooltip(footer, 'Settings');
    assert.equal(FakeTip.created.length, 2, 'footer built at once (a handful), rows lazily');
    app._hideAllTooltips();
    app._destroyAllTooltips();
    assert.ok(FakeTip.created.every(t => t.destroyed));
    assert.equal(app._activeTooltips.size, 0);
    b.emit('enter-event', {});          // a leftover row must not resurrect a tooltip after teardown
    app._destroying = true;
    const c = fakeActor(); app._attachEllipsisTooltip(c, 'C', null, []); c.emit('enter-event', {});
    assert.equal(FakeTip.created.length, 3, 'only b (before teardown) was created; c is refused while destroying');
});

test('an actor without text gets no tooltip and no listener', () => {
    const {app} = make();
    const actor = fakeActor();
    assert.equal(app._attachEllipsisTooltip(actor, '', null, []), null);
    assert.equal(actor.count('enter-event'), 0);
});

// ---------------------------------------------------------------- live size state
function sizeApp(geo) {
    const m = make();
    Object.assign(m.app, {_destroying: false, instance_id: 7, _menuGeometry: geo || {width: 800, height: 900},
        _getMenuSizeBounds: () => ({minWidth: 1, maxWidth: 2, minHeight: 3, maxHeight: 4})});
    return m;
}
test('the live-size JSON is not rewritten when nothing changed', () => {
    const {app, writes} = sizeApp();
    app._writeLiveSizeState(false);
    app._writeLiveSizeState(false);
    app._writeLiveSizeState(false);
    assert.equal(writes.length, 1, 'opening the menu must not hit the disk every time');
});
test('a changed size, or a requested sync, still writes', () => {
    const {app, writes} = sizeApp();
    const step = (fn, expected, why) => {fn(); assert.equal(writes.length, expected, why);};
    step(() => app._writeLiveSizeState(false), 1, 'first plain write');
    step(() => {app._menuGeometry = {width: 801, height: 900}; app._writeLiveSizeState(false);}, 2, 'size changed');
    step(() => app._writeLiveSizeState(false), 2, 'same size again: skipped');
    step(() => app._writeLiveSizeState(true), 3, 'sync write is delivered');
    step(() => app._writeLiveSizeState(true), 4, 'and delivered again even though identical');
    step(() => app._writeLiveSizeState(false), 5, 'plain write after a sync write differs (syncValues flag)');
    step(() => app._writeLiveSizeState(false), 5, 'and plain duplicates are skipped again afterwards');
});
test('a failed write is retried on the next call instead of being cached as done', () => {
    const {app, writes, context} = sizeApp();
    let fail = true;
    context.GLib.file_set_contents = (p, d) => {if (fail) throw new Error('disk full'); writes.push([p, d]); return true;};
    app._writeLiveSizeState(false);
    assert.equal(writes.length, 0);
    fail = false;
    app._writeLiveSizeState(false);
    assert.equal(writes.length, 1);
});
test('the written payload keeps its fields and a timestamp', () => {
    const {app, writes} = sizeApp();
    app._writeLiveSizeState(true);
    const data = JSON.parse(writes[0][1]);
    assert.deepEqual([data.width, data.height, data.minWidth, data.maxHeight, data.syncValues], [800, 900, 1, 4, true]);
    assert.equal(typeof data.timestamp, 'number');
    assert.equal(writes[0][0], '/cache/win11-menu/live-size-7.json');
});

// ---------------------------------------------------------------- pinned tile reset
test('resetting pinned tile positions skips tiles already in place and animates only the displaced ones', () => {
    const {app} = make();
    const calls = [];
    app._animateActor = (actor, props, ms) => calls.push([actor, props, ms]);
    app._getPinnedMetrics = () => ({cols: 4, cellW: 100, cellH: 80});
    const cancelled = [];
    const mk = (index, x, y) => ({index, currentSlot: 9, actor: {x, y, remove_all_transitions() {cancelled.push(index);}}});
    const settled = mk(0, 0, 0), moved = mk(5, 0, 0), gone = {index: 2, currentSlot: 2, actor: null};
    app._pinnedTiles = [settled, moved, gone];
    app._resetPinnedTilesPositions();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], moved.actor);
    assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({x: 100, y: 80}));
    assert.deepEqual([...cancelled], [0], 'a tile already home has any queued displacement cancelled instead of animated');
    assert.equal(settled.currentSlot, 0, 'bookkeeping is still reset for every tile');
    assert.equal(moved.currentSlot, 5);
    assert.deepEqual([settled.currentX, settled.currentY], [0, 0]);
});

// ---------------------------------------------------------------- time-sliced file results
function batchApp(rowCost) {
    const m = make();
    const rows = [];
    Object.assign(m.app, {_destroying: false, _fileSearchId: 1, _searchGeneration: 1, menu: {isOpen: true},
        _fileResultsQueue: Array.from({length: 20}, (_, i) => ({i})), _streamedFileHeader: {}, _fileResultCount: 0,
        _selectedSearchResultIdx: 0, searchResultsListBox: {add_actor() {}}, _hideEmptySearchLabel() {},
        _selectSearchResult() {}, _addSearchResultRow(item) {rows.push(item.i); m.advance(rowCost);}});
    return {...m, rows};
}
test('file result rows are built within a frame budget, then the rest waits for the next idle', () => {
    const {app, rows, idles} = batchApp(5);
    app._renderFileSearchBatch();
    assert.ok(rows.length >= 1 && rows.length <= 3, 'about one frame of work (5 ms rows): ' + rows.length);
    assert.equal(app._fileResultsQueue.length, 20 - rows.length);
    assert.equal(idles.length, 1, 'the remainder is scheduled, not dropped');
});
test('cheap rows still go through in batches of at most 8 as before', () => {
    const {app, rows, idles} = batchApp(0.1);
    app._renderFileSearchBatch();
    assert.equal(rows.length, 8);
    assert.equal(idles.length, 1);
});
test('a single very slow row still makes progress (at least one row per slice)', () => {
    const {app, rows, idles} = batchApp(50);
    app._renderFileSearchBatch();
    assert.equal(rows.length, 1);
    idles.shift()();
    assert.equal(rows.length, 2, 'every slice builds one more even when it is already over budget');
});
test('draining the queue across slices builds every row exactly once, in order', () => {
    const {app, rows, idles} = batchApp(5);
    app._renderFileSearchBatch();
    while (idles.length) idles.shift()();
    assert.deepEqual(rows, Array.from({length: 20}, (_, i) => i));
    assert.equal(app._fileResultCount, 20);
});
