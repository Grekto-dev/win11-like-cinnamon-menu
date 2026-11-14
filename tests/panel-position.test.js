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
function searchHarness(orientation, mode, extra = {}, uiScale = 1) {
    const calls = {};
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: uiScale},
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
test('Start highlight expands horizontally while retaining a small 2px margin and stable neighbours', () => {
    const {app} = searchHarness(SIDE.BOTTOM, 'pill');
    let style;
    app.startButtonBox = {set_style: s => {style = s;}, get_stage: () => ({}), get_theme_node: () => ({
        get_padding: () => 8, get_margin: () => 0
    })};
    app._updateSearchPanelButton();
    const css = Object.fromEntries((style || '').split(';').filter(s => s.trim()).map(s => s.split(':').map(v => v.trim())));
    assert.equal(css['padding-left'], '6px');
    assert.equal(css['padding-right'], '6px');
    assert.equal(css['margin-left'], '2px');
    assert.equal(css['margin-right'], '2px');
    assert.equal(parseFloat(css['padding-left']) + parseFloat(css['margin-left']), 8);
    assert.equal(parseFloat(css['padding-right']) + parseFloat(css['margin-right']), 8);
    assert.doesNotMatch(style, /(?:^|;)\s*(?:width|height|padding-top|padding-bottom|margin-top|margin-bottom):/);
});

test('Start inset preserves asymmetric theme geometry, RTL, HiDPI and repeated updates', () => {
    for (const scale of [1, 2]) {
        for (const rtl of [false, true]) {
            const {app} = searchHarness(SIDE.TOP, 'hidden', {}, scale);
            let style;
            app.actor.get_text_direction = () => rtl ? 1 : 0;
            app.startButtonBox = {set_style: s => {style = s;}, get_stage: () => ({}), get_theme_node: () => {
                assert.equal(style, null, 'read the original theme, not the previous inline inset');
                return {get_padding: side => (side === SIDE.LEFT ? 8 : 6) * scale,
                    get_margin: side => (side === SIDE.LEFT ? 2 : 4) * scale};
            }};
            for (let repeat = 0; repeat < 3; repeat++) {
                app._updateSearchPanelButton();
                assert.equal(style, 'padding-left: 6px; margin-left: 4px; padding-right: 4px; margin-right: 6px;');
            }
        }
    }
});
test('Start inset never generates negative padding in compact themes', () => {
    const {app} = searchHarness(SIDE.BOTTOM, 'pill');
    let style;
    app.startButtonBox = {set_style: s => {style = s;}, get_stage: () => ({}),
        get_theme_node: () => ({get_padding: () => 2, get_margin: () => 1})};
    app._updateSearchPanelButton();
    assert.equal(style, 'padding-left: 0px; margin-left: 3px; padding-right: 0px; margin-right: 3px;');
});
test('Start construction waits for stage attachment before reading its theme', () => {
    const {app} = searchHarness(SIDE.BOTTOM, 'pill');
    let style = 'old';
    app.startButtonBox = {set_style: s => {style = s;}, get_stage: () => null,
        get_theme_node: () => {throw new Error('unattached actor');}};
    assert.doesNotThrow(() => app._updateSearchPanelButton());
    assert.equal(style, null);
});

test('vertical controls use the actual panel width, without Start padding widening the bar', () => {
    const {app} = searchHarness(SIDE.LEFT, 'pill');
    const styles = [];
    app.panel = {actor: {width: 47}};
    app.startButtonBox = {set_style: s => styles.push(s), get_stage: () => ({}),
        get_theme_node: () => ({get_padding: () => 8, get_margin: () => 0})};
    let rootStyle;
    app.actor.set_style = s => rootStyle = s;
    app._updateSearchPanelButton();
    assert.match(rootStyle, /width: 47px/);
    assert.deepEqual(styles, ['padding: 0;']);
    app._orientation = SIDE.BOTTOM;
    app._updateSearchPanelButton();
    assert.doesNotMatch(rootStyle, /width:/);
    assert.match(styles.at(-1), /padding-left: 6px; margin-left: 2px;/, 'horizontal inset restored');
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

test('custom Search icon size is independent of the Start icon size', () => {
    const {app} = searchHarness(SIDE.BOTTOM, 'icon', {
        searchButtonSizeMode: 'custom', searchPillHeight: 32, menuIconSizeMode: 'custom', menuIconSize: 44
    });
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.width, 32);
    assert.equal(app.searchPanelButton.height, 32);
    assert.equal(app.searchPanelIcon.iconSize, 24);
    app.searchButtonSizeMode = 'auto';
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.width, -1);
    assert.equal(app.searchPanelButton.height, -1);
    assert.equal(app.searchPanelIcon.iconSize, 44);
});

// Exercise both real render and active-state methods: the layout-only harness
// deliberately stubs the latter and cannot catch inline-style replacement bugs.
function searchStyleHarness(orientation, mode, extra = {}, uiScale = 1) {
    const {app} = searchHarness(orientation, mode, extra, uiScale);
    delete app._updatePanelButtonsActiveState;
    app.menu = {isOpen: false};
    app._themeAccentCss = '#123456';
    app.startButtonBox = {set_style() {}, get_stage: () => null};
    for (const actor of [app.actor, app.startButtonBox, app.searchPanelButton]) {
        actor.pseudo = {};
        actor.change_style_pseudo_class = (name, value) => actor.pseudo[name] = value;
    }
    for (const actor of [app.searchPanelButton, app.searchPanelIcon, app.searchPanelLabel])
        actor.set_style = style => actor.style = style;
    return app;
}

test('Search style lifecycle: custom icon geometry survives rendering and active-only open/close; Auto clears it', () => {
    const geometry = 'padding: 0; margin: 0; min-width: 0; min-height: 0;';
    for (const orientation of Object.values(SIDE)) {
        for (const scale of [1, 2]) {
            const app = searchStyleHarness(orientation, 'icon', {
                searchButtonSizeMode: 'custom', searchPillHeight: 32, _panelHeight: 48 * scale
            }, scale);
            for (const initialMode of ['closed', 'search', 'start']) {
                app.menu.isOpen = initialMode !== 'closed';
                app._currentPopupMode = initialMode;
                app._updateSearchPanelButton();
                assert.equal(app.searchPanelButton.style, geometry, `render: ${initialMode}, side ${orientation}, scale ${scale}`);
                for (const popupMode of ['search', 'closed', 'start', 'closed']) {
                    app.menu.isOpen = popupMode !== 'closed';
                    app._currentPopupMode = popupMode;
                    app._updatePanelButtonsActiveState();
                    assert.equal(app.searchPanelButton.style, geometry, `active only: ${popupMode}`);
                    assert.equal(app.searchPanelButton.width, 32 * scale);
                    assert.equal(app.searchPanelButton.height, 32 * scale);
                    assert.equal(app.searchPanelIcon.style, null);
                    assert.equal(app.searchPanelButton.pseudo.checked, popupMode === 'search');
                    assert.equal(app.startButtonBox.pseudo.checked, popupMode === 'start');
                }
            }
            app.searchButtonSizeMode = 'auto';
            app._updateSearchPanelButton();
            assert.equal(app.searchPanelButton.width, -1);
            assert.equal(app.searchPanelButton.height, -1);
            for (const popupMode of ['search', 'closed', 'start', 'closed']) {
                app.menu.isOpen = popupMode !== 'closed';
                app._currentPopupMode = popupMode;
                app._updatePanelButtonsActiveState();
                assert.equal(app.searchPanelButton.style, null, 'Auto restores theme geometry');
            }
        }
    }
});

test('Search style lifecycle: leaving custom icon mode preserves pill accent colors and clears old geometry', () => {
    for (const sizeMode of ['custom', 'auto']) {
        const app = searchStyleHarness(SIDE.BOTTOM, 'icon', {searchButtonSizeMode: 'custom', searchPillHeight: 32});
        app._updateSearchPanelButton();
        app.searchDisplay = 'pill';
        app.searchButtonSizeMode = sizeMode;
        app.menu.isOpen = true;
        app._currentPopupMode = 'search';
        app._updateSearchPanelButton();
        const accent = 'background-color: #123456; border-color: #123456; color: #ffffff;';
        assert.equal(app.searchPanelButton.style, accent);
        for (const popupMode of ['closed', 'start', 'search', 'closed']) {
            app.menu.isOpen = popupMode !== 'closed';
            app._currentPopupMode = popupMode;
            app._updatePanelButtonsActiveState();
            assert.equal(app.searchPanelButton.style, popupMode === 'search' ? accent : null);
            assert.equal(app.searchPanelIcon.style, popupMode === 'search' ? 'color: #ffffff;' : null);
            assert.equal(app.searchPanelLabel.style, popupMode === 'search' ? 'color: #ffffff;' : null);
        }
    }
});

test('custom width applies to both the Search button and search bar, Auto restores their original width', () => {
    for (const mode of ['pill', 'box']) {
        const {app} = searchHarness(SIDE.BOTTOM, mode, {searchButtonSizeMode: 'custom', searchPillHeight: 34, searchCustomWidth: 250});
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.width, 250);
        assert.equal(app.searchPanelButton.height, 34);
        app.searchButtonSizeMode = 'auto';
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.width, mode === 'box' ? Math.round(48 * 4.9) : -1);
        assert.equal(app.searchPanelButton.height, 36);
    }
});

test('the custom-width settings binding immediately redraws Search', () => {
    const line = source.split('\n').find(line => line.includes('this.settings.bind("search-custom-width"'));
    assert.ok(line, 'the renderer must bind the persisted width');
    const {app} = searchHarness(SIDE.BOTTOM, 'box');
    let renders = 0;
    app._updateSearchPanelButton = () => renders++;
    app.settings = {bind(key, property, callback) {assert.equal(key, 'search-custom-width');assert.equal(property, 'searchCustomWidth');callback();}};
    vm.runInNewContext('(function(){' + line + '})').call(app);
    assert.equal(renders, 1);
});

test('vertical custom size uses panel thickness and a configurable along-panel length', () => {
    for (const orientation of [SIDE.LEFT, SIDE.RIGHT]) {
        const {app} = searchHarness(orientation, 'pill', {searchButtonSizeMode: 'custom', searchPillHeight: 32, searchCustomWidth: 180});
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.width, 32);
        assert.equal(app.searchPanelButton.height, 180);
        app.searchCustomWidth = 0;
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.height, -1);
    }
});

test('explicit narrow widths clip their content and Auto removes clipping again', () => {
    const {app} = searchHarness(SIDE.BOTTOM, 'pill', {searchButtonSizeMode: 'custom', searchCustomWidth: 40});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.clip_to_allocation, true);
    app.searchButtonSizeMode = 'auto';app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.clip_to_allocation, false);
});

test('custom dimensions use logical pixels at HiDPI and keep icons inside the control', () => {
    for (const mode of ['icon', 'pill', 'box']) {
        const {app} = searchHarness(SIDE.BOTTOM, mode, {searchButtonSizeMode: 'custom', searchPillHeight: 32, searchCustomWidth: 250, _panelHeight: 96}, 2);
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.height, 64);
        assert.equal(app.searchPanelButton.width, mode === 'icon' ? 64 : 500);
        assert.equal(app.searchPanelIcon.iconSize, mode === 'icon' ? 24 : 17);
        assert.ok(app.searchPanelIcon.iconSize * 2 < app.searchPanelButton.height);
    }
});

test('custom bounds and width zero preserve safe legacy heights and natural widths', () => {
    for (const [height, width, expectedH, expectedW] of [
        [-10, -20, 20, -1], [500, 9999, 48, 800], [30, 0, 30, -1], [32, NaN, 32, -1]
    ]) {
        const {app} = searchHarness(SIDE.BOTTOM, 'pill', {searchButtonSizeMode: 'custom', searchPillHeight: height, searchCustomWidth: width});
        app._updateSearchPanelButton();
        assert.equal(app.searchPanelButton.height, expectedH);
        assert.equal(app.searchPanelButton.width, expectedW);
    }
    const {app} = searchHarness(SIDE.BOTTOM, 'box', {searchButtonSizeMode: 'custom', searchPillHeight: 30});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.width, Math.round(48 * 4.9), 'old custom-height configs keep automatic width');
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
