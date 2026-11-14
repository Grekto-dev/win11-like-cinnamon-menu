// Truncation tooltips for secondary labels (descriptions, paths) of search and recent rows.
// Real applet code with fake Clutter/St actors: no desktop, no X input.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

const MONITOR = {x: 0, y: 0, width: 1920, height: 1080};

// ---- the tooltip class, on a base that mirrors Cinnamon's TooltipBase contract ----
function tooltipHarness(dragging = false) {
    class FakeTooltipActor {
        constructor(text) {
            this.text = text; this.visible = false; this.maxWidth = Infinity; this.style = '';
            this.clutter_text = {line_wrap: false, line_wrap_mode: null};
            this.position = null;
        }
        get_text() {return this.text;} set_text(t) {this.text = t;}
        set_style(s) {this.style = s; const m = /max-width:\s*([\d.]+)px/.exec(s); this.maxWidth = m ? Number(m[1]) : Infinity;}
        get_preferred_width() {const w = Math.min(this.text.length * 7, this.maxWidth); return [w, w];}
        get_preferred_height(forWidth) {const lines = this.clutter_text.line_wrap ? Math.ceil(this.text.length * 7 / forWidth) : 1; return [lines * 18, lines * 18];}
        set_position(x, y) {this.position = [x, y];}
        show() {this.visible = true;} hide() {this.visible = false;} raise_top() {} is_finalized() {return false;}
    }
    class FakeBase {
        constructor(item, text) {
            this.item = item; this.visible = false; this.preventShow = false; this.mousePosition = null;
            this._tooltip = new FakeTooltipActor(text); this.baseMotionCalls = 0;
        }
        _roundedMousePosition(event) {return [Math.round(event.x), Math.round(event.y)];}
        _onMotionEvent(actor, event) {
            this.baseMotionCalls++;
            if (!this.visible) this.mousePosition = this._roundedMousePosition(event);
        }
        _hide() {this.hide();}
        hide() {this._tooltip.hide(); this.visible = false;}
        destroy() {}
    }
    const context = {Tooltips: {Tooltip: FakeBase}, Pango: {WrapMode: {WORD_CHAR: 2}}, DND: {isDragging: () => dragging},
        Main: {layoutManager: {findMonitorForActor: () => MONITOR, primaryMonitor: MONITOR}}};
    const start = source.indexOf('const TooltipParent');
    const end = source.indexOf('\n/**\n * Draggable tile in the Pinned section');
    assert.ok(start > 0 && end > start, 'tooltip class markers not found');
    return vm.runInNewContext(source.slice(start, end) + '\nWin11AboveTooltip', context);
}

function fakeLabel(text, {cut = false, box = [10, 10, 100, 20]} = {}) {
    const [x, y, w, h] = box;
    return {
        get_text: () => text, get_width: () => w, get_height: () => h,
        get_transformed_position: () => [x, y], get_transformed_size: () => [w, h],
        clutter_text: {line_wrap: false, get_layout: () => ({is_ellipsized: () => cut}),
            get_preferred_width: () => [0, w], get_preferred_height: () => [0, h]}
    };
}
const row = (y = 300) => ({get_transformed_position: () => [10, y], get_transformed_size: () => [320, 52]});
const LONG = 'Inicie aplicativos para criar documentos de texto, planilhas, apresentações, desenhos, fórmulas e bancos de dados ou abra documentos recém utilizados & <b>nada</b>.';

function setup({nameCut = false, descCut = true, desc = LONG, dragging = false} = {}) {
    const Tip = tooltipHarness(dragging);
    const name = fakeLabel('LibreOffice', {cut: nameCut, box: [10, 10, 100, 20]});
    const description = fakeLabel(desc, {cut: descCut, box: [10, 32, 100, 18]});
    const tip = new Tip(row(), 'LibreOffice', name, [{label: description, text: desc}]);
    return {tip, name, description};
}
const hover = (tip, x, y) => {tip.mousePosition = [x, y]; tip.show(); return tip._tooltip;};

test('hovering a truncated description shows the full description even when the name fits', () => {
    const {tip} = setup({nameCut: false, descCut: true});
    const shown = hover(tip, 20, 40);
    assert.equal(shown.visible, true);
    assert.equal(shown.text, LONG, 'literal text: markup characters and ampersands untouched');
});

test('hovering the name still shows the name when the name is truncated', () => {
    const {tip} = setup({nameCut: true, descCut: true});
    const shown = hover(tip, 20, 15);
    assert.equal(shown.visible, true);
    assert.equal(shown.text, 'LibreOffice');
});

test('a fitting description falls back to the truncated name instead of showing nothing', () => {
    const {tip} = setup({nameCut: true, descCut: false});
    const shown = hover(tip, 20, 40);
    assert.equal(shown.visible, true);
    assert.equal(shown.text, 'LibreOffice');
});

test('nothing is shown when the label under the pointer fits and the name fits', () => {
    const {tip} = setup({nameCut: false, descCut: false});
    assert.equal(hover(tip, 20, 40).visible, false);
});

test('a truncated description is silent while the pointer is on a name that fits', () => {
    const {tip} = setup({nameCut: false, descCut: true});
    assert.equal(hover(tip, 20, 15).visible, false);
});

test('no tooltip while a drag is in progress, for either label', () => {
    const {tip} = setup({nameCut: true, descCut: true, dragging: true});
    assert.equal(hover(tip, 20, 40).visible, false);
    assert.equal(hover(tip, 20, 15).visible, false);
});

test('long text is wrapped inside a bounded width and stays on the monitor', () => {
    const {tip} = setup({descCut: true});
    const shown = hover(tip, 20, 40);
    assert.match(shown.style, /max-width:\s*\d+px/);
    assert.equal(shown.clutter_text.line_wrap, true);
    assert.equal(shown.clutter_text.line_wrap_mode, 2, 'wraps at words, falling back to characters');
    const [x, y] = shown.position;
    const [w] = shown.get_preferred_width(-1);
    const [h] = shown.get_preferred_height(w);
    assert.ok(w <= 480, 'bounded width: ' + w);
    assert.ok(h > 18, 'wrapped onto several lines: ' + h);
    assert.ok(x >= MONITOR.x + 6 && x + w <= MONITOR.x + MONITOR.width - 6, 'horizontally on screen');
    assert.ok(y >= MONITOR.y + 6 && y + h <= MONITOR.y + MONITOR.height, 'vertically on screen');
    assert.ok(y + h <= 300, 'placed above the row when there is room');
});

test('moving from the name to the description while visible swaps the tooltip instead of keeping the old text', () => {
    const {tip} = setup({nameCut: true, descCut: true});
    hover(tip, 20, 15);
    assert.equal(tip.visible, true);
    tip.visible = true;
    tip._onMotionEvent(null, {x: 20, y: 15});
    assert.equal(tip.visible, true, 'staying on the same label keeps the tooltip');
    tip._onMotionEvent(null, {x: 20, y: 40});
    assert.equal(tip.visible, false, 'a different label hides the old text and re-arms the timer');
    assert.deepEqual(Array.from(tip.mousePosition), [20, 40]);
    assert.equal(hover(tip, 20, 40).text, LONG);
});

test('the name tooltip stays put while the pointer moves over a description that fits', () => {
    const {tip} = setup({nameCut: true, descCut: false});
    hover(tip, 20, 40);
    assert.equal(tip.visible, true);
    assert.equal(tip._tooltip.text, 'LibreOffice');
    tip._onMotionEvent(null, {x: 24, y: 41});
    tip._onMotionEvent(null, {x: 30, y: 42});
    assert.equal(tip.visible, true, 'the effective target did not change, so nothing flickers');
    assert.equal(tip._tooltip.visible, true);
});

test('a tall wrapped tooltip placed below the row never runs off the bottom of the monitor', () => {
    const Tip = tooltipHarness();
    const nearTop = {get_transformed_position: () => [10, 4], get_transformed_size: () => [320, 52]};
    const description = fakeLabel(LONG, {cut: true, box: [10, 32, 100, 18]});
    const tip = new Tip(nearTop, 'N', fakeLabel('N'), [{label: description, text: LONG}]);
    const shown = hover(tip, 20, 40);
    const [, y] = shown.position;
    const [w] = shown.get_preferred_width(-1);
    const [h] = shown.get_preferred_height(w);
    assert.ok(y >= MONITOR.y + 6, 'not above the top edge');
    assert.ok(y + h <= MONITOR.y + MONITOR.height - 6, 'fully above the bottom edge: ' + (y + h));
    const bottom = {get_transformed_position: () => [10, 1060], get_transformed_size: () => [320, 52]};
    const low = new Tip(bottom, 'N', fakeLabel('N'), [{label: description, text: LONG}]);
    const lowShown = hover(low, 20, 40);
    assert.ok(lowShown.position[1] + h <= MONITOR.y + MONITOR.height - 6, 'near the bottom edge it still fits');
});

test('plain-text guarantee does not depend on the default markup flag', () => {
    const {tip} = setup({descCut: true});
    const calls = [];
    tip._tooltip.clutter_text.set_use_markup = value => calls.push(value);
    hover(tip, 20, 40);
    assert.deepEqual(calls, [false]);
});

test('without secondary labels the tooltip behaves exactly as before', () => {
    const Tip = tooltipHarness();
    const cut = new Tip(row(), 'Name', fakeLabel('Name', {cut: true}));
    cut.mousePosition = [0, 0]; cut.show();
    assert.equal(cut._tooltip.visible, true);
    const fits = new Tip(row(), 'Name', fakeLabel('Name'));
    fits.mousePosition = [0, 0]; fits.show();
    assert.equal(fits._tooltip.visible, false);
    const footer = new Tip(row(), 'Account settings', null);
    footer.mousePosition = [0, 0]; footer.show();
    assert.equal(footer._tooltip.visible, true, 'footer tooltips (no label to check) always show');
});

// ---- call sites: real row builders, tooltip attachment observed through a spy ----
function rowHarness(props = {}) {
    class Actor {
        constructor(p = {}) {Object.assign(this, p); this.children = []; this.handlers = {}; this.clutter_text = {};}
        add_actor(c) {this.children.push(c);} add(c) {this.children.push(c);} set_child(c) {this.children.push(c);}
        connect(n, fn) {this.handlers[n] = fn;} set_clip_to_allocation() {} set_style() {}
        set_text(s) {this.text = s;} destroy() {}
    }
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: 1},
        St: {Label: Actor, Icon: Actor, BoxLayout: Actor, Bin: Actor, IconType: {SYMBOLIC: 1}, Align: {MIDDLE: 0}},
        Clutter: {ActorAlign: {CENTER: 1}, BUTTON_PRIMARY: 1, BUTTON_SECONDARY: 3, EVENT_STOP: 'stop', EVENT_PROPAGATE: 'pass'},
        Pango: {EllipsizeMode: {END: 1}}, createAppIcon: () => new Actor(), PopupMenu: {PopupSeparatorMenuItem: class {constructor() {this.actor = new Actor();}}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const attached = [];
    Object.assign(app, {listIconSize: 28, showDescription: true, _searchResultsList: [], searchResultsListBox: new Actor(),
        _attachEllipsisTooltip(actor, text, checkLabel, extras) {attached.push({actor, text, checkLabel, extras});}}, props);
    return {app, attached};
}

test('search rows give the description its own truncation tooltip', () => {
    const {app, attached} = rowHarness();
    const item = {kind: 'file', name: 'report.txt', description: '/home/user/very/long/path/report.txt', uri: 'file:///r'};
    app._addSearchResultRow(item);
    assert.equal(attached.length, 1);
    const textBox = attached[0].actor.children[1];
    assert.equal(attached[0].checkLabel, textBox.children[0]);
    assert.equal(attached[0].extras.length, 1);
    assert.equal(attached[0].extras[0].label, textBox.children[1]);
    assert.equal(attached[0].extras[0].text, '/home/user/very/long/path/report.txt');
});

test('search rows without a visible description keep the name-only tooltip', () => {
    for (const props of [{showDescription: false}, {}]) {
        const {app, attached} = rowHarness(props);
        app._addSearchResultRow({kind: 'file', name: 'report.txt', description: props.showDescription === false ? 'hidden' : '', uri: 'file:///r'});
        assert.equal(attached.length, 1);
        assert.deepEqual(Array.from(attached[0].extras || []), []);
    }
});

test('recent rows give the subtitle or full path its own truncation tooltip', () => {
    for (const [timestamps, expected] of [[true, '/fixture/report.txt'], [false, 'minutes_ago:2']]) {
        const {app, attached} = rowHarness();
        app._createRecentItemWidget({kind: 'file', title: 'report.txt', uri: 'file:///fixture/report.txt',
            pathText: '/fixture/report.txt', subtitle: 'minutes_ago:2', timeText: 'minutes_ago:2'}, timestamps);
        assert.equal(attached.length, 1);
        const textBox = attached[0].actor.children[1].children ? attached[0].actor.children[1] : null;
        assert.ok(textBox, 'text box located');
        assert.equal(attached[0].extras.length, 1);
        assert.equal(attached[0].extras[0].label, textBox.children[1]);
        assert.equal(attached[0].extras[0].text, expected);
    }
});
