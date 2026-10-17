// "All" and "Recent" sections: independent visibility toggles.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));

function harness(props = {}) {
    const idles = [];
    const apps = {a: {get_id: () => 'a', get_name: () => 'AppA', get_description: () => 'd'},
        'nemo.desktop': {get_id: () => 'nemo.desktop', get_name: () => 'Files', get_description: () => ''}};
    const context = {Applet: {TextIconApplet: class {}}, global: {},
        REMEMBER_RECENT_KEY: 'remember', shorten_path: (u, n) => n,
        appsys: {lookup_app: id => apps[id] || null},
        Mainloop: {idle_add: fn => {idles.push(fn); return idles.length;}, source_remove() {}},
        GLib: {SOURCE_REMOVE: false},
        St: {BoxLayout: class {constructor() {this.layout_manager = {};} add() {} add_actor() {}}, Widget: class {}, Label: class {}, Align: {MIDDLE: 0}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const box = () => ({visible: true, show() {this.visible = true;}, hide() {this.visible = false;}, destroy_all_children() {},
        set_text() {}, add_actor() {}});
    Object.assign(app, {t: k => k, showRecentApps: true, showRecentFiles: true, showAllApps: true,
        recentApps: [{id: 'a', timestamp: 5}], _formatRelativeTime: () => 'now',
        privacy_settings: {get_boolean: () => true},
        RecentManager: {_infosByTimestamp: [{name: 'doc.txt', uri: 'file:///doc.txt', uriDecoded: '/doc.txt', mtime: 9}]},
        allAppsSectionBox: box(), recentSectionBox: box(), recentGridBox: box(), recentTitleLabel: box(),
        recentMoreBtnLabel: box(), allRecentSubTitle: box(), allRecentBackLabel: box(), _destroying: false,
        _createRecentItemWidget: () => box(), menu: {isOpen: true}}, props);
    return {app, idles};
}
const kinds = app => Array.from(app._getCombinedRecentItems(30), i => i.kind + ':' + (i.title));

test('schema: three section switches default on', () => {
    for (const k of ['show-all-apps', 'show-recent-apps', 'show-recent-files']) {
        assert.equal(schema[k].type, 'switch'); assert.equal(schema[k].default, true);
    }
});
test('both recent kinds appear by default', () => {
    const k = kinds(harness().app);
    assert.ok(k.includes('app:AppA') && k.includes('file:doc.txt'));
});
test('recent apps off removes recent and filler apps but keeps files', () => {
    const k = kinds(harness({showRecentApps: false}).app);
    assert.deepEqual(k, ['file:doc.txt']);
});
test('recent files off keeps apps only', () => {
    const k = kinds(harness({showRecentFiles: false}).app);
    assert.ok(!k.some(x => x.startsWith('file:')));
    assert.ok(k.includes('app:AppA'));
});
test('both recent toggles off hide the whole recent section', () => {
    const {app} = harness({showRecentApps: false, showRecentFiles: false});
    app._refreshRecentSection();
    assert.equal(app.recentSectionBox.visible, false);
});
test('either recent toggle on shows the section', () => {
    const {app} = harness({showRecentApps: false});
    app.recentSectionBox.visible = false;
    app._refreshRecentSection();
    assert.equal(app.recentSectionBox.visible, true);
});
test('All off hides the All section; on shows it again', () => {
    const {app} = harness({showAllApps: false});
    app._applyAllAppsVisibility();
    assert.equal(app.allAppsSectionBox.visible, false);
    app.showAllApps = true;
    app._applyAllAppsVisibility();
    assert.equal(app.allAppsSectionBox.visible, true);
});
test('hidden All section builds no rows and schedules no work', () => {
    const {app, idles} = harness({showAllApps: false});
    app._queueAllAppsMaterialize();
    assert.equal(idles.length, 0);
    assert.equal(app._materializeAllAppsInView(), 0);
});
test('re-enabling All queues the visible groups', () => {
    const {app, idles} = harness({showAllApps: true});
    app._allAppsGroups = [];
    app._applyAllAppsVisibility();
    assert.equal(idles.length, 1);
});
