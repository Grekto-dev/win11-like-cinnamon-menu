// Taskbar search: hidden | icon | pill (icon + label) | box (real, mirrored text field).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));

function harness(extra = {}) {
    const calls = [];
    const context = {Applet: {TextIconApplet: class {}}, global: {},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}, TextDirection: {LTR: 0, RTL: 1}},
        Clutter: {ActorAlign: {FILL: 0, CENTER: 1}, EVENT_STOP: true, EVENT_PROPAGATE: false, KEY_Escape: 65307, KEY_Return: 65293}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const widget = name => ({name, visible: true, text: '', hide() {this.visible = false;}, show() {this.visible = true;},
        set_text(t) {this.text = t; calls.push([name, 'set_text', t]);}, get_text() {return this.text;},
        set_style() {}, set_icon_size(n) {this.iconSize = n;}, set_style_class_name(c) {this.cls = c;},
        set_height(h) {this.height = h;}, set_width(w) {this.width = w;}, set_y_align() {},
        set_reactive(v) {this.reactive = v;}, set_hint_text(t) {this.hint = t;}, change_style_pseudo_class() {},
        set_vertical(v) {this.vertical = v;}, set_x_align() {}});
    Object.assign(app, {_orientation: 3, _panelHeight: 48, searchButtonSizeMode: 'auto', searchPillHeight: 30, searchButtonSpacing: 0,
        menuIconSizeMode: 'auto', actor: {set_style() {}, get_text_direction: () => 0},
        searchPanelButton: widget('button'), searchPanelLabel: widget('label'), searchPanelIcon: widget('icon'),
        searchPanelEntry: widget('panelEntry'), searchEntry: widget('menuEntry'),
        t: s => s, _updatePanelButtonsActiveState() {}, _applyVerticalSearchLabel() {}, _clearVerticalSearchLabel() {}}, extra);
    return {app, calls, context};
}

test('schema: four taskbar search modes, pill (current look) is the default', () => {
    assert.deepEqual(Object.values(schema['search-display'].options), ['hidden', 'icon', 'pill', 'box']);
    assert.equal(schema['search-display'].default, 'pill');
});
test('hidden hides the whole search control and removes the extra gaps', () => {
    const {app} = harness({searchDisplay: 'hidden', searchButtonSpacing: 12});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.visible, false);
});
test('icon shows only the magnifier', () => {
    const {app} = harness({searchDisplay: 'icon'});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.visible, true);
    assert.equal(app.searchPanelLabel.visible, false);
    assert.equal(app.searchPanelEntry.visible, false);
});
test('pill shows icon + label at natural width (existing look)', () => {
    const {app} = harness({searchDisplay: 'pill'});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelLabel.visible, true);
    assert.equal(app.searchPanelEntry.visible, false);
    assert.equal(app.searchPanelButton.width, -1);
    assert.equal(app.searchPanelButton.height, 36);
});
test('box keeps the pill look and height but is a wide field (~4.9x the panel thickness)', () => {
    const {app} = harness({searchDisplay: 'box'});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelButton.cls, 'win11-search-panel-pill');
    assert.equal(app.searchPanelButton.height, 36);
    assert.equal(app.searchPanelButton.width, Math.round(48 * 4.9));
    assert.equal(app.searchPanelEntry.visible, true);
    assert.equal(app.searchPanelLabel.visible, false);
    assert.equal(app.searchPanelEntry.hint, 'search');
    assert.ok(app.searchPanelButton.width > 36 * 3);
});
test('box width follows the panel thickness', () => {
    const a = harness({searchDisplay: 'box', _panelHeight: 40}).app;
    const b = harness({searchDisplay: 'box', _panelHeight: 64}).app;
    a._updateSearchPanelButton(); b._updateSearchPanelButton();
    assert.equal(a.searchPanelButton.width, Math.round(40 * 4.9));
    assert.equal(b.searchPanelButton.width, Math.round(64 * 4.9));
});
test('vertical panels cannot host a text box: it is disabled and the vertical icon + label is shown', () => {
    const {app} = harness({searchDisplay: 'box', _orientation: 0});
    Object.assign(app, {_applyVerticalSearchLabel() {}, _clearVerticalSearchLabel() {}});
    app.searchPanelButton.set_vertical = function (v) {this.vertical = v;};
    app.searchPanelButton.set_x_align = () => {};
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelEntry.visible, false);
    assert.equal(app.searchPanelLabel.visible, true);
    assert.equal(app.searchPanelButton.vertical, true);
});
test('unknown values behave as pill', () => {
    const {app} = harness({searchDisplay: 'weird'});
    app._updateSearchPanelButton();
    assert.equal(app.searchPanelLabel.visible, true);
});

// ---- mirroring ----
function mirrorHarness() {
    const h = harness({searchDisplay: 'box'});
    h.app._mirroringSearch = false;
    return h;
}
test('typing in the panel box mirrors into the menu search field', () => {
    const {app} = mirrorHarness();
    app.searchPanelEntry.text = 'calc';
    app._mirrorSearchText('panel');
    assert.equal(app.searchEntry.text, 'calc');
});
test('typing in the menu search field mirrors into the panel box', () => {
    const {app} = mirrorHarness();
    app.searchEntry.text = 'term';
    app._mirrorSearchText('menu');
    assert.equal(app.searchPanelEntry.text, 'term');
});
test('mirroring does not loop and does not rewrite identical text', () => {
    const {app} = mirrorHarness();
    let writes = 0;
    app.searchEntry.set_text = function (t) {this.text = t; writes++; app._mirrorSearchText('menu');};
    app.searchPanelEntry.text = 'x';
    app._mirrorSearchText('panel');
    app._mirrorSearchText('panel');
    assert.equal(writes, 1, 'the echo from the menu field is swallowed and an identical value is not rewritten');
    assert.equal(app.searchPanelEntry.text, 'x');
});

// ---- activation ----
test('the box is inactive by default and only becomes editable when clicked', () => {
    const {app} = mirrorHarness();
    app.searchPanelText = {set_editable(v) {this.editable = v;}, set_reactive(v) {this.reactive = v;}};
    app._deactivateSearchBox();
    assert.equal(app.searchPanelEntry.reactive, false);
    assert.equal(app.searchPanelText.editable, false);
    // The inner ClutterText is a separate reactive actor: if it stays reactive it swallows
    // the click that must reach the applet, and the menu never opens.
    assert.equal(app.searchPanelText.reactive, false);
    app._activateSearchBox();
    assert.equal(app._searchBoxActive, true);
    assert.equal(app.searchPanelEntry.reactive, true);
    assert.equal(app.searchPanelText.editable, true);
    assert.equal(app.searchPanelText.reactive, true);
});
test('focus goes to the panel box only while it is active in search mode', () => {
    const {app} = mirrorHarness();
    app.searchPanelText = {name: 'panelText'}; app.searchEntryText = {name: 'menuText'};
    app._currentPopupMode = 'search';
    assert.equal(app._searchFocusTarget().name, 'menuText');
    app._searchBoxActive = true;
    assert.equal(app._searchFocusTarget().name, 'panelText');
    app._currentPopupMode = 'start';
    assert.equal(app._searchFocusTarget().name, 'menuText');
});

// ---- click routing ----
function clickHarness(mode, open, popupMode) {
    const log = [];
    const h = harness({searchDisplay: mode, showSearchButton: true});
    Object.assign(h.app, {_currentPopupMode: popupMode, enableAnimation: false,
        menu: {isOpen: open, open() {log.push('open');}, close() {log.push('close');}},
        _switchToPopupMode: (m, f) => log.push('switch:' + m), _activateSearchBox() {log.push('activate');},
        _focusSearchEntry() {log.push('focus');}});
    h.app.searchPanelButton.contains = () => false;
    const ev = {get_source: () => h.app.searchPanelButton};
    return {app: h.app, log, click: () => h.app.on_applet_clicked(ev)};
}
test('box mode click on a closed menu activates the box and opens search', () => {
    const {log, click} = clickHarness('box', false, 'start');
    click();
    assert.deepEqual(log, ['activate', 'open']);
});
test('box mode click while search is open keeps it open and refocuses the box', () => {
    const {log, click} = clickHarness('box', true, 'search');
    click();
    assert.deepEqual(log, ['activate', 'focus']);
});
test('box mode click while start is open switches to search with the box active', () => {
    const {log, click} = clickHarness('box', true, 'start');
    click();
    assert.deepEqual(log, ['activate', 'switch:search']);
});
test('pill mode keeps toggling (click on open search closes it)', () => {
    const {log, click} = clickHarness('pill', true, 'search');
    click();
    assert.deepEqual(log, ['close']);
});
test('hidden mode never routes clicks to search', () => {
    const {log, click} = clickHarness('hidden', false, 'start');
    click();
    assert.deepEqual(log, ['open']);
});

// ---- keyboard forwarded from the panel box ----
test('panel box forwards navigation keys to the menu search handler and Escape clears/closes', () => {
    const {app} = mirrorHarness();
    const seen = [];
    app._onSearchKeyPress = (a, e) => {seen.push(e.sym); return true;};
    app._handleEscapeKey = () => false;
    let closed = 0;
    app.menu = {close() {closed++;}};
    assert.equal(app._onPanelSearchKeyPress({}, {get_key_symbol: () => 65293, sym: 'enter'}), true);
    assert.deepEqual(seen, ['enter']);
    assert.equal(app._onPanelSearchKeyPress({}, {get_key_symbol: () => 65307}), true);
    assert.equal(closed, 1);
});

// ---- migration from the old two settings ----
function migrationApp(props) {
    const {app} = harness(props);
    app.settingsVersion = 1;
    return app;
}
test('legacy show-search-button=false migrates to hidden', () => {
    const app = migrationApp({showSearchButton: false, searchButtonStyle: 'pill', searchDisplay: 'pill', showRecents: true});
    app._migrateLegacySettings();
    assert.equal(app.searchDisplay, 'hidden');
    assert.equal(app.settingsVersion, 2);
});
test('legacy icon style migrates to icon, pill stays pill', () => {
    const a = migrationApp({showSearchButton: true, searchButtonStyle: 'icon', searchDisplay: 'pill', showRecents: true});
    a._migrateLegacySettings();
    assert.equal(a.searchDisplay, 'icon');
    const b = migrationApp({showSearchButton: true, searchButtonStyle: 'pill', searchDisplay: 'pill', showRecents: true});
    b._migrateLegacySettings();
    assert.equal(b.searchDisplay, 'pill');
});
test('legacy show-recents=false turns both new recent toggles off; already migrated settings are untouched', () => {
    const a = migrationApp({showSearchButton: true, searchButtonStyle: 'pill', searchDisplay: 'box', showRecents: false,
        showRecentApps: true, showRecentFiles: true});
    a._migrateLegacySettings();
    assert.equal(a.showRecentApps, false);
    assert.equal(a.showRecentFiles, false);
    const b = migrationApp({showSearchButton: false, searchDisplay: 'box', showRecents: false, showRecentApps: true});
    b.settingsVersion = 2;
    b._migrateLegacySettings();
    assert.equal(b.searchDisplay, 'box');
    assert.equal(b.showRecentApps, true);
});

// ---- lifecycle ----
test('closing the menu deactivates the box and clears both fields', () => {
    const {app} = mirrorHarness();
    Object.assign(app, {searchPanelText: {set_editable() {}, set_reactive() {}}, closeFloatingMenus() {}, _closeFolder() {},
        _showStartSubView() {}, startScrollView: {get_vscroll_bar: () => ({get_adjustment: () => ({set_value() {}})})}});
    app._searchBoxActive = true;
    app._onOpenStateChanged(app.menu, false);
    assert.equal(app._searchBoxActive, false);
    assert.equal(app.searchPanelEntry.reactive, false);
    assert.equal(app.searchEntry.text, '');
});
test('switching to the start view deactivates the box', () => {
    const {app} = mirrorHarness();
    Object.assign(app, {searchPanelText: {set_editable() {}, set_reactive() {}}, closeFloatingMenus() {}, _closeFolder() {}, _showStartSubView() {},
        _updatePanelButtonsActiveState() {}, _refreshSearchHomeView() {}, _focusSearchEntry() {},
        startModeBox: {show() {}, hide() {}}, searchHomeBox: {show() {}, hide() {}},
        searchResultsBox: {hide() {}}, footerBar: {show() {}, hide() {}}});
    app._searchBoxActive = true;
    app._switchToPopupMode('start');
    assert.equal(app._searchBoxActive, false);
});
test('keys typed in the panel box use the panel text for IME preedit, not the menu field', () => {
    const {app} = mirrorHarness();
    app.searchEntryText = {has_preedit() {throw new Error('wrong field');}};
    app.searchResultsBox = {visible: false};
    const panelText = {has_preedit: () => true};
    assert.equal(app._onSearchKeyPress(panelText, {get_key_symbol: () => 97}), false);
});
