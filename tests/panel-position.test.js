// Start/search popup placement for panels on any side, and the vertical search button.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

const PanelLoc = {top: 0, bottom: 1, left: 2, right: 3};
const SIDE = {TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3};
function menuHarness({orientation, panels, nat = [834, 866], monitor = {x: 0, y: 0, width: 1920, height: 1080, index: 0}, offset = 12}) {
    const context = {Applet: {TextIconApplet: class {}, AppletPopupMenu: class {}}, global: {},
        St: {Side: SIDE}, PopupMenu: {PanelLoc},
        Main: {layoutManager: {findMonitorForActor: () => monitor, primaryMonitor: monitor},
            panelManager: {getPanelsInMonitor: () => panels.map(([pos, w, h]) =>
                ({getIsVisible: () => true, panelPosition: pos, actor: {width: w, height: h}}))}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11PopupMenu'), source.indexOf('\nclass Win11MenuApplet')) + '\nWin11PopupMenu', context);
    const menu = Object.create(Class.prototype);
    Object.assign(menu, {_orientation: orientation, sourceActor: {}, box: {show() {}},
        actor: {visible: true, get_preferred_size: () => [0, 0, nat[0], nat[1]]},
        launcher: {centerMenuOnScreen: true, _getMenuFloatOffset: () => offset}});
    return menu;
}

test('bottom panel: menu above it, centred, 12 px gap (unchanged)', () => {
    const m = menuHarness({orientation: SIDE.BOTTOM, panels: [[PanelLoc.bottom, 1920, 48]]});
    assert.deepEqual(Array.from(m._calculatePosition()), [543, 1080 - 48 - 866 - 12]);
    assert.equal(m.sideFlipped, true);
});
test('top panel: menu BELOW the panel with the same gap', () => {
    const m = menuHarness({orientation: SIDE.TOP, panels: [[PanelLoc.top, 1920, 48]]});
    assert.deepEqual(Array.from(m._calculatePosition()), [543, 48 + 12]);
    assert.equal(m.sideFlipped, false);
});
test('left vertical panel: menu to the RIGHT of the bar, vertically centred in the work area', () => {
    const m = menuHarness({orientation: SIDE.LEFT, panels: [[PanelLoc.left, 48, 1080]]});
    assert.deepEqual(Array.from(m._calculatePosition()), [48 + 12, 107]);
    assert.equal(m.sideFlipped, false, 'Cinnamon: sideFlipped means the panel is on the right; here it is on the left');
});
test('right vertical panel: menu to the LEFT of the bar', () => {
    const m = menuHarness({orientation: SIDE.RIGHT, panels: [[PanelLoc.right, 48, 1080]]});
    assert.deepEqual(Array.from(m._calculatePosition()), [1920 - 48 - 834 - 12, 107]);
    assert.equal(m.sideFlipped, true, 'panel on the right: the slide starts at the bar');
});
test('other panels on the same monitor shrink the area the menu is placed in', () => {
    const top = menuHarness({orientation: SIDE.TOP, panels: [[PanelLoc.top, 1920, 48], [PanelLoc.bottom, 1920, 40]]});
    assert.deepEqual(Array.from(top._calculatePosition()), [543, 60]);
    const left = menuHarness({orientation: SIDE.LEFT, panels: [[PanelLoc.left, 48, 1080], [PanelLoc.top, 1920, 30]]});
    const [x, y] = left._calculatePosition();
    assert.equal(x, 60);
    assert.equal(y, 30 + Math.round((1050 - 866) / 2));
});
test('the menu never leaves the work area on small monitors', () => {
    const small = {x: 0, y: 0, width: 800, height: 600, index: 0};
    const left = menuHarness({orientation: SIDE.LEFT, panels: [[PanelLoc.left, 48, 600]], nat: [700, 700], monitor: small});
    const [lx, ly] = left._calculatePosition();
    assert.ok(lx >= 48 && ly >= 0 && ly + 700 <= 600 || ly === 0);
    const right = menuHarness({orientation: SIDE.RIGHT, panels: [[PanelLoc.right, 48, 600]], nat: [700, 700], monitor: small});
    assert.ok(right._calculatePosition()[0] >= 0);
});
test('second monitor offsets are respected for a left panel', () => {
    const m2 = {x: 1920, y: 0, width: 1920, height: 1080, index: 1};
    const m = menuHarness({orientation: SIDE.LEFT, panels: [[PanelLoc.left, 48, 1080]], monitor: m2});
    assert.deepEqual(Array.from(m._calculatePosition()), [1920 + 48 + 12, 107]);
});

// ---- vertical search button ----
function searchHarness(orientation, mode, extra = {}) {
    const calls = {};
    const context = {Applet: {TextIconApplet: class {}}, global: {},
        St: {Side: SIDE, TextDirection: {LTR: 0, RTL: 1}},
        Clutter: {ActorAlign: {FILL: 0, CENTER: 1, START: 2}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const w = name => ({name, visible: true, text: '', hide() {this.visible = false;}, show() {this.visible = true;},
        set_text(t) {this.text = t;}, set_style() {}, set_icon_size(n) {this.iconSize = n;}, set_style_class_name(c) {this.cls = c;},
        set_height(h) {this.height = h;}, set_width(v) {this.width = v;}, set_y_align() {}, set_x_align(a) {this.xAlign = a;},
        set_vertical(v) {this.vertical = v;}, set_hint_text() {}, set_reactive(v) {this.reactive = v;}});
    Object.assign(app, {_orientation: orientation, _panelHeight: 48, searchDisplay: mode, searchButtonSizeMode: 'auto', searchPillHeight: 30,
        searchButtonSpacing: 0, menuIconSizeMode: 'auto', actor: {set_style() {}, get_text_direction: () => 0},
        searchPanelButton: w('button'), searchPanelLabel: w('label'), searchPanelIcon: w('icon'), searchPanelEntry: w('entry'),
        t: s => s, _updatePanelButtonsActiveState() {},
        _applyVerticalSearchLabel(angle) {calls.angle = angle;}, _clearVerticalSearchLabel() {calls.cleared = true;}}, extra);
    return {app, calls};
}
test('vertical panel + icon+label: the pill is stacked vertically with a rotated label', () => {
    for (const [orientation, angle] of [[SIDE.LEFT, -90], [SIDE.RIGHT, 90]]) {
        const {app, calls} = searchHarness(orientation, 'pill');
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.vertical, true);
        assert.equal(app.searchPanelLabel.visible, true);
        assert.equal(calls.angle, angle);
        assert.equal(app.searchPanelEntry.visible, false);
        assert.equal(app.searchPanelButton.width, 36, 'the pill thickness is its width in a vertical bar');
        assert.equal(app.searchPanelButton.height, -1);
    }
});
test('vertical panel + search box: the box is disabled and the vertical icon+label is used instead', () => {
    const {app, calls} = searchHarness(SIDE.LEFT, 'box');
    assert.equal(app._searchMode(), 'pill');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelEntry.visible, false);
    assert.equal(app.searchPanelLabel.visible, true);
    assert.equal(calls.angle, -90);
});
test('vertical panel + icon only: no label, normal icon button', () => {
    const {app} = searchHarness(SIDE.RIGHT, 'icon');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelLabel.visible, false);
    assert.equal(app.searchPanelButton.vertical, false);
});
test('horizontal panels restore the horizontal pill and drop the rotation', () => {
    const {app, calls} = searchHarness(SIDE.BOTTOM, 'pill');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.vertical, false);
    assert.equal(calls.cleared, true);
    assert.equal(app.searchPanelButton.width, -1);
    assert.equal(app.searchPanelButton.height, 36);
});
test('the search box still works in a horizontal panel', () => {
    const {app} = searchHarness(SIDE.TOP, 'box');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelEntry.visible, true);
    assert.equal(app.searchPanelButton.width, Math.round(48 * 4.9));
});

// ---- rotated label geometry ----
function rotationHarness() {
    const context = {Applet: {TextIconApplet: class {}}, global: {}, St: {Side: SIDE}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const log = {};
    app.searchPanelLabel = {rotation_angle_z: 0, get_stage: () => ({}), set_pivot_point(x, y) {log.pivot = [x, y];},
        get_preferred_width: () => [0, 60], get_preferred_height: () => [0, 16],
        set_size(w, h) {log.labelSize = [w, h];}, set_position(x, y) {log.labelPos = [x, y];}};
    app.searchPanelLabelBin = {set_size(w, h) {log.binSize = [w, h];}};
    return {app, log};
}
test('the rotated label keeps its natural size (no ellipsis) inside a bin with swapped dimensions, centred', () => {
    const {app, log} = rotationHarness();
    app._applyVerticalSearchLabel(-90);
    assert.equal(app.searchPanelLabel.rotation_angle_z, -90);
    assert.deepEqual(log.pivot, [0.5, 0.5]);
    assert.deepEqual(log.labelSize, [60, 16], 'natural width, so it is not truncated');
    assert.deepEqual(log.binSize, [16, 60], 'the rotated footprint');
    assert.deepEqual(log.labelPos, [-22, 22], 'the centres coincide');
});
test('a changed label (language, font) is re-measured: the old fixed size is cleared before measuring', () => {
    const {app, log} = rotationHarness();
    const order = [];
    const label = app.searchPanelLabel;
    label.set_size = (w, h) => order.push(['set_size', w, h]);
    label.get_preferred_width = () => {order.push(['measure']); return [0, 80];};
    app._applyVerticalSearchLabel(-90);
    assert.deepEqual(order[0], ['set_size', -1, -1]);
    assert.deepEqual(order[1], ['measure']);
    assert.deepEqual(order[order.length - 1], ['set_size', 80, 16]);
});
test('clearing the rotation restores the natural layout', () => {
    const {app, log} = rotationHarness();
    app._applyVerticalSearchLabel(90);
    app._clearVerticalSearchLabel();
    assert.equal(app.searchPanelLabel.rotation_angle_z, 0);
    assert.deepEqual(log.binSize, [-1, -1]);
    assert.deepEqual(log.labelSize, [-1, -1]);
    assert.deepEqual(log.labelPos, [0, 0]);
});
test('rotation is applied once the label is on stage', () => {
    const {app, log} = rotationHarness();
    app.searchPanelLabel.get_stage = () => null;
    app._applyVerticalSearchLabel(90);
    assert.equal(log.binSize, undefined, 'measuring an off-stage widget would only log criticals');
    app.searchPanelLabel.get_stage = () => ({});
    app._refreshVerticalSearchLabel();
    assert.deepEqual(log.binSize, [16, 60]);
});
