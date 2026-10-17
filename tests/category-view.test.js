// "All" section, category view: tiles with a 2x2 preview of the category's apps (reference: 154x153 px
// tiles on a 1920x1080 screen, 29 px apart, label underneath). Categories come from the system menu tree.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

class Actor {
    constructor(props = {}) {Object.assign(this, props); this.children = []; this.handlers = {}; this.visible = true; this.styleClass = props.style_class;}
    add_actor(c) {this.children.push(c);}
    add(c) {this.children.push(c);}
    set_child(c) {this.child = c; this.children = [c];}
    set_size(w, h) {this.width = w; this.height = h;}
    set_width(w) {this.width = w;}
    set_height(h) {this.height = h;}
    set_style(s) {this.style = s;}
    set_text(t) {this.text = t;}
    connect(name, fn) {this.handlers[name] = fn; return 1;}
    destroy_all_children() {this.children = [];}
    show() {this.visible = true;}
    hide() {this.visible = false;}
    get clutter_text() {return this._ct || (this._ct = {});}
}
const dir = (id, name) => ({get_menu_id: () => id, get_name: () => name});
const mkApp = n => ({get_id: () => n + '.desktop', get_name: () => n});
function harness({scale = 1, mode = 'categories', uiScale = 1} = {}) {
    const launched = [], floating = [], idles = [], scrolled = [];
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: 1},
        St: {Button: Actor, BoxLayout: Actor, Label: Actor, Icon: Actor, Bin: Actor, Widget: Actor, Align: {MIDDLE: 0, START: 1}, IconType: {SYMBOLIC: 0}},
        Clutter: {ActorAlign: {CENTER: 0, START: 1}, BUTTON_PRIMARY: 1, EVENT_STOP: true, EVENT_PROPAGATE: false},
        Pango: {EllipsizeMode: {END: 1}},
        createAppIcon: (a, size) => ({kind: 'icon', app: a.get_name(), size}),
        Mainloop: {idle_add(fn) {idles.push(fn); return idles.length;}, timeout_add(ms, fn) {idles.push(fn); return idles.length + 100;}, source_remove() {}}, GLib: {SOURCE_REMOVE: false}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const apps = {
        acc: ['Orca', 'Onboard', 'Magnifier'].map(mkApp),
        dev: ['Meld', 'Geany', 'Vim', 'Code', 'Git Cola'].map(mkApp),
        empty: []};
    const data = [];
    for (const [cat, list] of Object.entries(apps)) for (const a of list) data.push([a, [cat]]);
    Object.assign(app, {t: k => ({view_categories: 'View: Category', back: 'Back'}[k] || k), _destroying: false,
        allAppsViewMode: mode, _allAppsData: data, _openCategoryId: null,
        _allDirsData: [dir('acc', 'Accessibility'), dir('empty', 'Nothing'), dir('dev', 'Development')],
        allAppsListBox: new Actor(), allAppsTitleLabel: new Actor(), allAppsViewBtnLabel: new Actor(),
        allAppsHeaderBox: new Actor(), startScrollView: Object.assign(new Actor(), {y: 0, height: 600}),
        _getPinnedMetrics: () => ({cols: 8, cellW: 95 * scale, cellH: 82 * scale, scale, logicalScale: scale / uiScale}),
        _uiScale: uiScale,
        launchApp: a => launched.push(a.get_name()), _createAllAppsListRow: a => ({kind: 'row', app: a.get_name()}),
        _scrollActorIntoView: (a, v) => scrolled.push(a), _cancelAllAppsMaterialize() {}, _showFloatingMenuAtActor: (anchor, items) => floating.push(items),
        menu: {isOpen: true, close() {launched.push('menu.close');}}, _pinnedTiles: [], _folderTiles: []});
    return {app, launched, floating, idles, scrolled};
}
const walk = (n, out = []) => {out.push(n); for (const c of n.children || []) walk(c, out); return out;};
const tilesOf = app => walk(app.allAppsListBox).filter(n => n.styleClass === 'win11-category-tile');
const labelsOf = app => walk(app.allAppsListBox).filter(n => n.styleClass === 'win11-category-label').map(n => n.text);

test('data: only categories that have apps, in the system order, apps in menu order', () => {
    const {app} = harness();
    const cats = app._categoryTilesData();
    assert.deepEqual(Array.from(cats, c => c.name), ['Accessibility', 'Development']);
    assert.deepEqual(Array.from(cats[1].apps, a => a.get_name()), ['Meld', 'Geany', 'Vim', 'Code', 'Git Cola']);
});
test('categories mode shows one tile per category with its name underneath and builds no list rows', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    assert.equal(tilesOf(app).length, 2);
    assert.deepEqual(labelsOf(app), ['Accessibility', 'Development']);
    assert.equal(walk(app.allAppsListBox).filter(n => n.kind === 'row').length, 0);
    assert.deepEqual(Array.from(app._allAppsGroups), []);
});
test('each tile previews at most four apps as a 2x2 grid of mini icons', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    const [acc, dev] = tilesOf(app);
    const minis = t => walk(t).filter(n => n.styleClass === 'win11-category-mini');
    assert.equal(minis(acc).length, 3);
    assert.equal(minis(dev).length, 4);
    const rows = walk(dev).filter(n => n.styleClass === 'win11-category-tile-row');
    assert.equal(rows.length, 2);
    assert.deepEqual(Array.from(rows, r => r.children.length), [2, 2]);
});
test('tile geometry follows the reference (154 px, 29 px gap, 36 px icons) and scales with the menu', () => {
    const m1 = harness({scale: 1}).app._getCategoryMetrics(), m2 = harness({scale: 2}).app._getCategoryMetrics();
    assert.deepEqual([m1.tile, m1.gap, m1.icon, m1.mini, m1.cols], [154, 29, 36, 68, 4]);
    assert.deepEqual([m2.tile, m2.gap, m2.icon, m2.mini, m2.cols], [308, 58, 72, 136, 4]);
});
test('HiDPI: icon textures and CSS lengths are logical (St multiplies them by ui_scale), set_size stays in stage pixels', () => {
    const {app} = harness({scale: 2, uiScale: 2});
    const m = app._getCategoryMetrics();
    assert.deepEqual([m.tile, m.gap, m.mini, m.cols], [308, 58, 136, 4], 'actor sizes are stage pixels');
    assert.equal(m.icon, 36, 'icon textures use scale / ui_scale');
    assert.equal(m.gapCss, 29, 'CSS margin is logical');
    app._refreshAllAppsSection();
    const cell = walk(app.allAppsListBox).find(n => n.styleClass === 'win11-category-cell');
    assert.match(cell.style, /margin-right: 29px/);
    const mini = walk(app.allAppsListBox).find(n => n.styleClass === 'win11-category-mini');
    assert.deepEqual([mini.width, mini.height], [136, 136]);
    assert.equal(mini.children[0].size, 36);
});
test('Escape only steps back from a category while the category view is active', () => {
    const {app} = harness();
    Object.assign(app, {floatingMenuBackdrop: null, folderOverlay: null, searchEntry: {get_text: () => ''}, _currentPopupMode: 'start', _startSubView: 'main'});
    app._openCategoryId = 'dev';
    app.allAppsViewMode = 'list';
    assert.equal(app._handleEscapeKey(), false);
});
test('tiles wrap into rows of the computed column count', () => {
    const {app} = harness();
    app._allDirsData = Array.from({length: 6}, (_, i) => dir('c' + i, 'Cat' + i));
    app._allAppsData = app._allDirsData.map((d, i) => [mkApp('App' + i), ['c' + i]]);
    app._refreshAllAppsSection();
    const rows = walk(app.allAppsListBox).filter(n => n.styleClass === 'win11-category-row');
    assert.deepEqual(Array.from(rows, r => r.children.length), [4, 2]);
});
test('mini icon cells are 68 px and leave a border of the tile that opens the category', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    const minis = walk(tilesOf(app)[1]).filter(n => n.styleClass === 'win11-category-mini');
    for (const m of minis) assert.deepEqual([m.width, m.height], [68, 68]);
    assert.ok(154 - 2 * 68 >= 12, 'visible border around the 2x2 block stays clickable for the tile');
});
test('clicking a mini icon launches that app and closes the menu without opening the category', () => {
    const {app, launched} = harness();
    app._refreshAllAppsSection();
    const mini = walk(tilesOf(app)[1]).filter(n => n.styleClass === 'win11-category-mini')[2];
    mini.handlers.clicked(mini);
    assert.deepEqual(launched, ['Vim']);
    assert.equal(app._openCategoryId, null);
});
test('clicking the tile opens the category with a back header and all its apps', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    tilesOf(app)[1].handlers.clicked();
    assert.equal(app._openCategoryId, 'dev');
    const all = walk(app.allAppsListBox);
    assert.equal(all.filter(n => n.styleClass === 'win11-category-tile').length, 0);
    assert.deepEqual(all.filter(n => n.kind === 'row').map(n => n.app), ['Meld', 'Geany', 'Vim', 'Code', 'Git Cola']);
    const back = all.find(n => n.styleClass === 'win11-category-back');
    assert.ok(back);
    assert.ok(all.some(n => n.text === 'Development'));
    back.handlers.clicked();
    assert.equal(app._openCategoryId, null);
    assert.equal(tilesOf(app).length, 2);
});
function scrollHarness() {
    const h = harness();
    const handlers = [], timers = [];
    const adj = {connect(name, fn) {handlers.push([name, fn]); return handlers.length;}, disconnect(id) {handlers[id - 1] = null;}};
    h.app.startScrollView.get_vscroll_bar = () => ({get_adjustment: () => adj});
    h.app._scrollActorIntoView = a => h.scrolled.push(a === h.app.allAppsHeaderBox ? 'header' : 'other');
    return {...h, handlers, timers, fireUpper: () => handlers.filter(Boolean).filter(([n]) => n === 'notify::upper').forEach(([, fn]) => fn())};
}
test('opening a category scrolls to its header once the new content has been allocated', () => {
    const {app, scrolled, fireUpper} = scrollHarness();
    app._refreshAllAppsSection();
    app._openCategory('dev');
    assert.deepEqual(scrolled, [], 'the rebuilt content has no size yet; scrolling now would be clamped away');
    fireUpper();
    assert.deepEqual(scrolled, ['header']);
    fireUpper();
    assert.deepEqual(scrolled, ['header'], 'one-shot: later resizes do not yank the scroll position');
});
test('a safety timer scrolls anyway when the content height does not change', () => {
    const {app, scrolled, idles} = scrollHarness();
    app._refreshAllAppsSection();
    app._openCategory('dev');
    assert.ok(app._categoryScrollTimer, 'fallback registered');
    app._finishCategoryScroll();
    assert.deepEqual(scrolled, ['header']);
});
test('Escape inside an open category goes back instead of closing the menu', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    app._openCategory('acc');
    Object.assign(app, {floatingMenuBackdrop: null, folderOverlay: null, searchEntry: {get_text: () => ''},
        _currentPopupMode: 'start', _startSubView: 'main'});
    assert.equal(app._handleEscapeKey(), true);
    assert.equal(app._openCategoryId, null);
});
test('closing the menu or changing the view mode forgets the open category', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    app._openCategory('dev');
    app._setAllAppsViewMode('list');
    assert.equal(app._openCategoryId, null);
    assert.equal(app.allAppsViewMode, 'list');
    app._setAllAppsViewMode('categories');
    app._openCategory('dev');
    app._resetAllAppsNavigation();
    assert.equal(app._openCategoryId, null);
});
test('view dropdown lists List, Grid and Category, marks the current one and applies the choice', () => {
    const {app, floating} = harness();
    app._showAllAppsViewMenu({});
    const items = floating[0];
    assert.deepEqual(Array.from(items, i => i.label), ['view_option_list', 'view_option_grid', 'view_option_categories']);
    assert.deepEqual(Array.from(items, i => !!i.icon), [false, false, true]);
    items[1].action();
    assert.equal(app.allAppsViewMode, 'grid');
});
test('the header shows "View: Category" like the reference', () => {
    const {app} = harness();
    app._refreshAllAppsSection();
    assert.equal(app.allAppsViewBtnLabel.text, 'View: Category');
});
test('both languages know the view labels', () => {
    for (const k of ['view_option_list', 'view_option_grid', 'view_option_categories', 'view_categories'])
        assert.equal([...source.matchAll(new RegExp('^\\s{8}' + k + ':', 'gm'))].length, 2, k);
    assert.match(source, /view_categories: "Exibição: Categoria"/);
    assert.match(source, /view_categories: "View: Category"/);
});
