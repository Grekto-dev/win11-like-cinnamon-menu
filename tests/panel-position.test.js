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
        searchPanelButton: w('button'), searchPanelLabel: w('label'), searchPanelIcon: w('icon'), searchPanelEntry: w('entry'), searchPanelLabelBin: w('bin'),
        t: s => s, _updatePanelButtonsActiveState() {},
        _applyVerticalSearchLabel() {calls.verticalText = true;}, _clearVerticalSearchLabel() {calls.cleared = true;}}, extra);
    return {app, calls};
}
test('vertical panel + icon+label: the pill is stacked vertically with upright letters', () => {
    for (const orientation of [SIDE.LEFT, SIDE.RIGHT]) {
        const {app, calls} = searchHarness(orientation, 'pill');
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.vertical, true);
        assert.equal(app.searchPanelLabel.visible, true);
        assert.equal(calls.verticalText, true);
        assert.equal(app.searchPanelEntry.visible, false);
        assert.equal(app.searchPanelButton.width, 36, 'the pill thickness is its width in a vertical bar');
        assert.equal(app.searchPanelButton.height, -1);
    }
});
test('vertical: the letter column and icon are centred across the bar', () => {
    const {app} = searchHarness(SIDE.LEFT, 'pill');
    const aligns = [];
    app.searchPanelLabelBin = {set_x_align: a => aligns.push(['x', a]), set_y_align: a => aligns.push(['y', a])};
    app.searchPanelIcon.set_x_align = a => aligns.push(['icon', a]);
    app._updateSearchPanelButton();
    assert.deepEqual(aligns.filter(a => a[0] === 'x'), [['x', 1]], 'Clutter.ActorAlign.CENTER');
    assert.deepEqual(aligns.filter(a => a[0] === 'icon'), [['icon', 1]]);
    const horizontal = searchHarness(SIDE.BOTTOM, 'pill');
    const h = [];
    horizontal.app.searchPanelLabelBin = {set_x_align: a => h.push(a), set_y_align() {}};
    horizontal.app.searchPanelIcon.set_x_align = () => {};
    horizontal.app._updateSearchPanelButton();
    assert.deepEqual(h, [0], 'Clutter.ActorAlign.FILL again in a horizontal bar');
});
test('vertical controls use the actual panel width, without Start padding widening the bar', () => {
    const {app} = searchHarness(SIDE.LEFT, 'pill');
    const styles = [];
    app.panel = {actor: {width: 47}};
    app.startButtonBox = {set_style: s => styles.push(s)};
    let rootStyle;
    app.actor.set_style = s => rootStyle = s;
    app._updateSearchPanelButton();
    assert.match(rootStyle, /width: 47px/);
    assert.deepEqual(styles, ['padding: 0;']);
    app._orientation = SIDE.BOTTOM;
    app._updateSearchPanelButton();
    assert.doesNotMatch(rootStyle, /width:/);
    assert.equal(styles.at(-1), null, 'horizontal theme padding restored');
});
test('vertical bars keep the extra Search gaps vertical: spacing between children and padding below, nothing sideways', () => {
    const calls = [];
    const {app} = searchHarness(SIDE.LEFT, 'pill', {searchButtonSpacing: 12});
    app.actor.set_style = s => calls.push(s);
    app._updateSearchPanelButton();
    assert.match(calls[0], /spacing: 12px/);
    assert.match(calls[0], /padding-bottom: 12px/);
    assert.doesNotMatch(calls[0], /padding-(left|right)/);
});
test('vertical panel + search box: the box is disabled and the vertical icon+label is used instead', () => {
    const {app, calls} = searchHarness(SIDE.LEFT, 'box');
    assert.equal(app._searchMode(), 'pill');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelEntry.visible, false);
    assert.equal(app.searchPanelLabel.visible, true);
    assert.equal(calls.verticalText, true);
});
test('vertical panel + icon only: no label, normal icon button', () => {
    const {app} = searchHarness(SIDE.RIGHT, 'icon');
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelLabel.visible, false);
    assert.equal(app.searchPanelButton.vertical, false);
});
test('horizontal panels restore the horizontal pill and word', () => {
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

// ---- upright letters, one per line ----
function labelHarness(text = 'Search') {
    const context = {Applet: {TextIconApplet: class {}}, global: {}, St: {Side: SIDE},
        Pango: {Alignment: {LEFT: 0, CENTER: 1}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const label = {text: '', rotation_angle_z: 0, set_text(t) {this.text = t;},
        set_pivot_point() {}, set_size() {}, set_position() {}, get_stage: () => null,
        clutter_text: {set_line_alignment(v) {this.lineAlignment = v;}}};
    Object.assign(app, {searchPanelLabel: label, searchPanelLabelBin: {set_size() {}}, t: () => text});
    return {app, label};
}
test('letters are upright and stacked top to bottom, not a rotated word', () => {
    const {app, label} = labelHarness();
    app._applyVerticalSearchLabel();
    assert.equal(label.text, 'S\ne\na\nr\nc\nh');
    assert.equal(label.rotation_angle_z, 0);
    assert.equal(label.clutter_text.lineAlignment, 1, 'each line centred across the bar');
});
test('language changes immediately rebuild the stacked label without a fixed footprint', () => {
    const {app, label} = labelHarness();
    app._applyVerticalSearchLabel();
    app.t = () => 'Pesquisar';
    app._applyVerticalSearchLabel();
    assert.equal(label.text, 'P\ne\ns\nq\nu\ni\ns\na\nr');
});
test('returning to a horizontal bar restores the original word and alignment', () => {
    const {app, label} = labelHarness();
    app._applyVerticalSearchLabel();
    app._clearVerticalSearchLabel();
    assert.equal(label.text, 'Search');
    assert.equal(label.rotation_angle_z, 0);
    assert.equal(label.clutter_text.lineAlignment, 0);
});
