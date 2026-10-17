// Opening-latency regressions. Measured live: a key-focus transition onto the big
// menu actor restyles its whole subtree (~250 ms with ~1100 actors, twice per open).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function harness() {
    const calls = [];
    const text = {name: 'text', grab_key_focus() {calls.push('text.grab'); focus = text;}};
    let focus = null;
    const context = {Applet: {TextIconApplet: class {}},
        global: {stage: {get_key_focus: () => focus, set_key_focus(a) {calls.push('stage.set_key_focus:' + (a && a.name)); focus = a;}}},
        DND: {isDragging: () => false}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const entry = {name: 'entry', get_text: () => entryText, set_text(v) {entryText = v; calls.push('entry.set_text');}};
    let entryText = '';
    const originalGrab = () => calls.push('menu.actor.grab (restyles the whole menu)');
    Object.assign(app, {searchEntry: entry, searchEntryText: text,
        menu: {isOpen: true, actor: {grab_key_focus: originalGrab}}});
    return {app, context, calls, text, setFocus: v => {focus = v;}, setEntryText: v => {entryText = v;}};
}

test('focusing the search entry targets its ClutterText directly and only once', () => {
    const {app, calls} = harness();
    app._focusSearchEntry();
    app._focusSearchEntry();
    assert.deepEqual(calls, ['text.grab']);
});

test('the popup manager focus request is redirected away from the big menu actor', () => {
    const {app, calls} = harness();
    app._installMenuFocusRedirect();
    app.menu.actor.grab_key_focus();
    assert.deepEqual(calls, ['text.grab']);
    assert.ok(!calls.some(c => c.startsWith('menu.actor')));
});

test('focus redirect falls back to the stock behaviour before the search entry exists', () => {
    const {app, calls} = harness();
    app._installMenuFocusRedirect();
    app.searchEntryText = null;
    app.menu.actor.grab_key_focus();
    assert.deepEqual(calls, ['menu.actor.grab (restyles the whole menu)']);
});

test('switching popup mode never refocuses an already focused entry or clears empty text', () => {
    const {app, calls, text, setFocus} = harness();
    Object.assign(app, {closeFloatingMenus() {}, _closeFolder() {}, _showStartSubView() {},
        _updatePanelButtonsActiveState() {}, _refreshSearchHomeView() {},
        startModeBox: {show() {}, hide() {}}, searchHomeBox: {show() {}, hide() {}},
        searchResultsBox: {hide() {}}, footerBar: {show() {}, hide() {}}});
    setFocus(text);
    app._switchToPopupMode('start');
    app._switchToPopupMode('search');
    assert.deepEqual(calls, []);
});
