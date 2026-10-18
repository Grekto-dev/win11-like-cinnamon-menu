// Real applet methods, with only GJS actors/IPC stubbed. No live desktop input.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function harness(filter = 'all') {
    const idles = new Map(), providers = [], requests = [], appended = [];
    let next = 0;
    class Actor {
        constructor(props = {}) {Object.assign(this, props); this.visible = true; this.children = []; this.handlers = {}; this.clutter_text = {};}
        show() {this.visible = true;} hide() {this.visible = false;} set_text(s) {this.text = s;}
        add_actor(c) {this.children.push(c); c.parent = this;} add(c) {this.add_actor(c);}
        set_child(c) {this.add_actor(c);} set_style_class_name(s) {this.style_class = s;}
        connect(name, fn) {this.handlers[name] = fn;}
        destroy() {this.destroyed = true; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.destroy_all_children();}
        destroy_all_children() {for (const c of [...this.children]) c.destroy(); this.children = [];}
    }
    const context = {Applet: {TextIconApplet: class {}}, global: {},
        shorten_path: u => u, REMEMBER_RECENT_KEY: 'remember', MATCH_ADDERS: [0, 1, 2, 3],
        St: {Label: Actor, Icon: Actor, BoxLayout: Actor, Bin: Actor, IconType: {SYMBOLIC: 1}, Align: {MIDDLE: 0}},
        PopupMenu: {PopupSeparatorMenuItem: class {constructor() {this.actor = new Actor();}}},
        createAppIcon: () => new Actor(),
        Clutter: {ActorAlign: {CENTER: 1}, BUTTON_PRIMARY: 1, BUTTON_SECONDARY: 3, EVENT_STOP: 'stop', EVENT_PROPAGATE: 'pass', KEY_Down: 'Down', KEY_Up: 'Up', KEY_Return: 'Return'}, Pango: {EllipsizeMode: {END: 1}},
        Mainloop: {idle_add(fn) {const id = ++next; idles.set(id, fn); return id;}, source_remove(id) {idles.delete(id);}},
        GLib: {SOURCE_REMOVE: false, PRIORITY_DEFAULT_IDLE: 200, getenv: () => null,
            get_user_cache_dir: () => '/cache', build_filenamev: parts => parts.join('/')},
        FileSearch: {FileSearchClient: class {constructor(options) {this.options = options;}}},
        AppUtils: {decomp_unstripped: x => x.toLowerCase(), decomp_stripped: x => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''), decomp_string: x => x.toLowerCase()},
        Util: {escapeRegExp: s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},
        XApp: {Favorites: {get_default: () => ({get_favorites: () => []})}},
        SearchProviderManager: {launch_all(q, cb) {providers.push(cb);}},
        Gio: {File: {new_for_path: p => ({get_uri: () => 'file://' + p})}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {_searchFilter: filter, _allAppsData: [], _selectedSearchResultIdx: -1,
        menu: {isOpen: true}, searchResultsListBox: new Actor(), searchPreviewPane: new Actor(),
        searchStatusLabel: new Actor(), privacy_settings: {get_boolean: () => false},
        searchEntry: {text: 'report', get_text() {return this.text;}},
        t: k => k, _getRecentFiles: () => [],
        _createFileSearchClient() {return {search(id,q,limit) {requests.push({id,q,limit});}, cancel(id) {requests.push({cancel:id});}, destroy() {requests.push({destroy:true});}};},
        _addSearchResultRow(item) {this._searchResultsList.push(item); appended.push(item);},
        _selectSearchResult(i) {this._selectedSearchResultIdx = i;}});
    function tick() {
        const jobs = [...idles.entries()]; idles.clear();
        for (const [id, fn] of jobs) if (fn()) idles.set(id, fn);
    }
    return {app, idles, tick, providers, requests, appended, Actor, context};
}

test('the lazy client factory uses the module imported at applet load, not the expired Cinnamon import path', () => {
    const {app} = harness();
    delete app._createFileSearchClient;
    app._appletPath = '/applet';
    const client = app._createFileSearchClient();
    assert.equal(client.options.scriptPath, '/applet/file-search-worker.py');
    assert.equal(client.options.databasePath, '/cache/win11-menu/file-search/names.sqlite');
    assert.equal(typeof client.options.onEvent, 'function');
});

test('file lookup is scheduled outside the keystroke path and streams without waiting for done', () => {
    const {app, requests, tick, appended} = harness();
    app._doSearch('report');
    assert.equal(requests.length, 0, 'no subprocess launch or query while handling the keystroke');
    tick();
    assert.equal(requests.at(-1).q, 'report');
    const id = requests.at(-1).id;
    app._onFileSearchEvent({type: 'results', id, items: [{path:'/home/u/report.txt',name:'report.txt',is_dir:false}]});
    tick();
    assert.equal(appended.length, 1);
    assert.equal(appended[0].uri, 'file:///home/u/report.txt');
    assert.equal(appended[0].kind, 'file');
    assert.equal(app._selectedSearchResultIdx, 0);
});

test('typing a new term cancels the old request and ignores stale worker and Cinnamon provider callbacks', () => {
    const {app, tick, requests, providers, appended} = harness();
    app._doSearch('report'); tick();
    const old = requests.at(-1).id;
    app.searchEntry.text = 'budget'; app._doSearch('budget'); tick();
    assert.ok(requests.some(r => r.cancel === old));
    app._onFileSearchEvent({type:'results',id:old,items:[{path:'/old',name:'old'}]});
    providers[0]({}, [{label:'old provider'}]);
    tick();
    assert.equal(appended.length, 0);
    app._onFileSearchEvent({type:'results',id:requests.at(-1).id,items:[{path:'/new-budget',name:'budget'}]});
    tick();
    assert.equal(appended[0].name, 'budget');
});

test('incremental files are deduplicated and never steal the current selection', () => {
    const {app, tick, requests, appended} = harness();
    app._doSearch('report'); tick();
    app._selectedSearchResultIdx = 3;
    const event = {type:'results',id:requests.at(-1).id,items:[{path:'/report',name:'report'},{path:'/report',name:'report'}]};
    app._onFileSearchEvent(event); tick();
    app._onFileSearchEvent(event); tick();
    assert.equal(appended.length, 1);
    assert.equal(app._selectedSearchResultIdx, 3);
});

test('a punctuation-only filename query does not accidentally match every application', () => {
    const {app, appended, tick, requests} = harness();
    app._allAppsData = [[{get_name:()=> 'Calculator',get_keywords:()=>null,get_description:()=>null,get_id:()=> 'calc.desktop'},[]]];
    app.searchEntry.text = '%';
    app._doSearch('%'); tick();
    assert.equal(appended.length, 0);
    assert.equal(requests.at(-1).q, '%', 'literal punctuation reaches the filename engine');
});

test('punctuation in recent filenames is literal rather than an empty match-all expression', () => {
    const {app, appended} = harness('docs');
    app.privacy_settings.get_boolean = () => true;
    app._getRecentFiles = () => ['ordinary.txt','100%.txt'].map(name=>({name,uri:'file:///'+name,createIcon:()=>({})}));
    app._doSearch('%');
    assert.deepEqual(appended.map(r=>r.name), ['100%.txt']);
});

test('Apps and Settings filters do not create a filesystem worker', () => {
    for (const filter of ['apps','settings']) {
        const {app, tick, requests} = harness(filter);
        app._doSearch('report'); tick();
        assert.equal(requests.length, 0);
    }
});

test('closing/cancelling drops queued rows and all callbacks after teardown are ignored', () => {
    const {app, tick, requests, appended} = harness();
    app._doSearch('report'); tick();
    const id=requests.at(-1).id;
    app._onFileSearchEvent({type:'results',id,items:Array.from({length:80},(_,i)=>({path:'/report'+i,name:'report'+i}))});
    const immediate = appended.length;
    assert.ok(immediate <= 8, 'bounded actors per frame');
    app._destroyFileSearch(); app._destroying = true; tick();
    app._onFileSearchEvent({type:'results',id,items:[{path:'/late',name:'late'}]}); tick();
    assert.equal(appended.length, immediate);
    assert.ok(requests.some(r=>r.destroy));
});

test('worker errors leave application results usable and show a nonblocking status', () => {
    const {app, tick, requests} = harness();
    app._doSearch('report'); tick();
    app._onFileSearchEvent({type:'error',id:requests.at(-1).id,message:'failure'});
    assert.equal(app.searchStatusLabel.text, 'file_search_unavailable');
    assert.equal(app.menu.isOpen, true);
});

test('closing the menu cancels even if setting the empty text emits no changed signal', () => {
    const {app, tick, requests, appended} = harness();
    app._doSearch('report'); tick();
    const id=requests.at(-1).id;
    Object.assign(app, {closeFloatingMenus() {}, _closeFolder() {}, _showStartSubView() {},
        _resetAllAppsNavigation() {}, _updatePanelButtonsActiveState() {}});
    app.searchEntry.set_text = () => {};
    app._onOpenStateChanged(null, false);
    app.menu.isOpen = false;
    app._onFileSearchEvent({type:'results',id,items:[{path:'/late',name:'late'}]}); tick();
    assert.ok(requests.some(r=>r.cancel===id));
    assert.equal(appended.length, 0);
});

test('file and directory search rows use file/folder icons, never an executable icon', () => {
    for (const [isDirectory, expected] of [[false, 'text-x-generic'], [true, 'folder']]) {
        const {app} = harness();
        app._searchResultsList = [];
        const item = {kind:'file',name:'report',uri:'file:///report',isDirectory};
        Object.getPrototypeOf(app)._addSearchResultRow.call(app, item);
        assert.equal(item.actor.children[0].icon_name, expected);
    }
});

test('long filename rows can shrink inside the smaller menu without pushing the preview offscreen', () => {
    const {app} = harness(); app._searchResultsList = [];
    const item={kind:'file',name:'report'.repeat(100),uri:'file:///long'};
    Object.getPrototypeOf(app)._addSearchResultRow.call(app,item);
    assert.equal(item.actor.min_width,0);
    assert.equal(item.actor.children[1].min_width,0);
    assert.equal(item.actor.children[1].natural_width,0);
    assert.equal(item.actor.children[1].children[0].min_width,0);
});

test('filesystem context actions open the result or its folder, never remove/delete an unrelated file', () => {
    const {app} = harness(); const calls=[]; let actions;
    app._showFloatingMenuAtActor = (_anchor, items) => actions = items;
    app.launchRecentUri = uri => calls.push(['open',uri]);
    app._openFileLocation = uri => calls.push(['folder',uri]);
    app._showFileSearchContextMenu({uri:'file:///report'},{});
    assert.equal(actions.length,2);
    actions[0].action(); actions[1].action();
    assert.deepEqual(calls,[['open','file:///report'],['folder','file:///report']]);
});

test('destroying the applet closes the IPC client and cancels its queued work', () => {
    const {app, tick, requests} = harness();
    app._doSearch('report'); tick();
    Object.assign(app, {_cancelTransientInteractions() {}, _cleanupCacheMonitor() {}, emit() {},
        actor: {destroy() {}}, menu: {isOpen: true, destroy() {}}});
    app.destroy();
    assert.ok(requests.some(r => r.destroy));
});

test('no-results is not claimed while the initial file lookup is still in progress', () => {
    const {app, tick, requests} = harness('docs');
    app._doSearch('report'); tick();
    assert.equal(app._emptySearchLabel.visible, false);
    app._onFileSearchEvent({type:'done',id:requests.at(-1).id,truncated:false,indexing:false});
    assert.equal(app._emptySearchLabel.visible, true);
    assert.equal(app.searchStatusLabel.visible, false);
});

function privacyHarness(filter = 'docs') {
    const f = harness(filter), {app, Actor} = f;
    delete app._addSearchResultRow;
    delete app._selectSearchResult;
    Object.assign(app, {showRecentFiles: true, privacy_settings: {get_boolean: () => true},
        _recentFilesCache: {refresh() {}}, _refreshRecentViews() {},
        searchResultsBox: new Actor(), _scrollActorIntoView() {}});
    return f;
}
function historyFile(name, Actor) {
    return {name, uri: 'file:///outside-worker-roots/' + name, createIcon: () => new Actor()};
}

for (const toggle of ['system privacy', 'applet showRecentFiles']) {
    test(`${toggle} immediately revokes history-only search rows and the active preview without restarting lookup`, () => {
        const {app, tick, requests, Actor} = privacyHarness();
        const doc = historyFile('report-private.txt', Actor);
        app._getRecentFiles = () => [doc];
        app._doSearch('report'); tick();
        const removed = app._searchResultsList[0], generation = app._searchGeneration;
        assert.equal(app.searchPreviewPane.children[1].text, doc.name);
        app._onFileSearchEvent({type: 'done', id: requests.at(-1).id});
        const before = requests.length;
        if (toggle === 'system privacy') app.privacy_settings.get_boolean = () => false;
        else app.showRecentFiles = false;
        app._onRecentFilesSettingChanged();
        assert.equal(app._searchResultsList.length, 0, 'outside-root history result disappears synchronously');
        assert.equal(removed.actor.destroyed, true);
        assert.equal(app.searchPreviewPane.children.length, 0, 'no stale preview actions remain');
        assert.equal(app._selectedSearchResultIdx, -1);
        let activated = false;
        app._activateSearchResult = () => activated = true;
        removed.actor.handlers['enter-event']();
        removed.actor.handlers['button-release-event'](removed.actor, {get_button: () => 1});
        assert.equal(activated, false, 'a delayed removed-row callback cannot activate private history');
        assert.equal(app._selectedSearchResultIdx, -1);
        assert.equal(app._emptySearchLabel.visible, true);
        assert.equal(app._emptySearchLabel.text, 'no_results');
        assert.deepEqual(app.searchResultsListBox.children.map(child => child.text), ['no_results'], 'no orphan category headers');
        assert.equal(app._searchGeneration, generation);
        tick();
        assert.equal(requests.length, before, 'no new search or cancellation');
    });
}

test('a history URI independently returned by filesystem keeps its row, selection and preview on revocation', () => {
    const {app, Actor, tick, requests} = privacyHarness();
    const doc = historyFile('report-shared.txt', Actor);
    app._getRecentFiles = () => [doc];
    app._doSearch('report'); tick();
    const row = app._searchResultsList[0], preview = [...app.searchPreviewPane.children];
    app._onFileSearchEvent({type: 'results', id: requests.at(-1).id,
        items: [{path: '/outside-worker-roots/report-shared.txt', name: doc.name}]});
    assert.equal(app._searchResultsList.length, 1, 'one row for the shared URI');
    app.showRecentFiles = false;
    app._onRecentFilesSettingChanged();
    assert.equal(app._searchResultsList[0], row, 'deduplication must not erase independently obtained filesystem provenance');
    assert.notEqual(row.actor.destroyed, true);
    assert.deepEqual(app.searchPreviewPane.children, preview, 'retained preview actors are not rebuilt');
    assert.equal(app._selectedSearchResultIdx, 0);
});

test('static favorite/history duplicates share one independently retained row', () => {
    const {app, context, Actor} = privacyHarness();
    const doc = historyFile('report-favorite.txt', Actor);
    app._getRecentFiles = () => [doc];
    context.Gio.content_type_get_icon = () => ({});
    context.XApp.Favorites.get_default = () => ({get_favorites: () => [
        {display_name: doc.name, uri: doc.uri, cached_mimetype: 'text/plain'}]});
    app._doSearch('report');
    assert.equal(app._searchResultsList.length, 1, 'static duplicate URI must merge provenance');
    const row = app._searchResultsList[0], preview = [...app.searchPreviewPane.children];
    app.privacy_settings.get_boolean = () => false;
    app._onRecentFilesSettingChanged();
    assert.equal(app._searchResultsList[0], row);
    assert.notEqual(row.actor.destroyed, true);
    assert.deepEqual(app.searchPreviewPane.children, preview);
});

test('revocation preserves app/provider/filesystem actors, selection and queued files while hover and keyboard use current indices', () => {
    const {app, Actor, tick, requests, providers} = privacyHarness('all');
    app._getRecentFiles = () => [historyFile('report-private.txt', Actor)];
    app._doSearch('report'); tick();
    providers[0]({on_result_selected() {}}, [{label: 'report-provider'}]);
    app._addSearchResultRow({kind: 'app', name: 'report-app', app: {}});
    const id = requests.at(-1).id;
    app._onFileSearchEvent({type: 'results', id,
        items: Array.from({length: 12}, (_, i) => ({path: '/root/report' + i, name: 'report' + i}))});
    const retained = app._searchResultsList.slice(1), queued = [...app._fileResultsQueue];
    assert.equal(queued.length, 4);
    app._selectSearchResult(1);
    const selected = app._searchResultsList[1], preview = [...app.searchPreviewPane.children];
    const before = requests.length;
    app.showRecentFiles = false; app._onRecentFilesSettingChanged();
    assert.equal(app._searchResultsList[app._selectedSearchResultIdx], selected);
    assert.deepEqual(app.searchPreviewPane.children, preview);
    assert.deepEqual(app._searchResultsList, retained, 'unrelated rows stay in place, not rebuilt');
    assert.deepEqual(Array.from(app._fileResultsQueue), queued);
    const last = retained.at(-1);
    last.actor.handlers['enter-event']();
    assert.equal(app._searchResultsList[app._selectedSearchResultIdx], last, 'hover index follows removed rows');
    let activated;
    app._activateSearchResult = item => activated = item;
    const key = symbol => app._onSearchKeyPress({has_preedit: () => false}, {get_key_symbol: () => symbol});
    key('Return'); assert.equal(activated, last);
    key('Down'); assert.equal(app._searchResultsList[app._selectedSearchResultIdx], retained[0]);
    key('Up'); assert.equal(app._searchResultsList[app._selectedSearchResultIdx], last);
    tick();
    assert.equal(app._searchResultsList.length, retained.length + queued.length);
    assert.equal(requests.length, before, 'lookup continues without restart/cancellation');
    assert.equal(app._searchResultsList[app._selectedSearchResultIdx], last);
});

test('privacy revocation before the deferred worker starts does not flash no-results or alter pending work', () => {
    const {app, Actor, tick, requests, idles} = privacyHarness();
    app._getRecentFiles = () => [historyFile('report-private.txt', Actor)];
    app._doSearch('report');
    const pending = [...idles.keys()], generation = app._searchGeneration;
    app.privacy_settings.get_boolean = () => false;
    app._onRecentFilesSettingChanged();
    assert.equal(app._searchResultsList.length, 0);
    assert.equal(app._emptySearchLabel.visible, false);
    assert.deepEqual([...idles.keys()], pending);
    assert.equal(app._searchGeneration, generation);
    assert.equal(requests.length, 0);
    tick();
    assert.equal(requests.length, 1);
    app._onFileSearchEvent({type: 'done', id: requests[0].id});
    assert.equal(app._emptySearchLabel.visible, true);
});

test('revoking the last history row keeps no-results hidden until lookup completes and accepts the same URI from a later filesystem batch', () => {
    const {app, Actor, tick, requests} = privacyHarness();
    const doc = historyFile('report-later.txt', Actor);
    app._getRecentFiles = () => [doc];
    app._doSearch('report'); tick();
    const id = requests.at(-1).id;
    app.showRecentFiles = false; app._onRecentFilesSettingChanged();
    assert.equal(app._searchResultsList.length, 0);
    assert.equal(app._emptySearchLabel.visible, false, 'lookup is still in progress');
    app._onFileSearchEvent({type: 'results', id,
        items: [{path: '/outside-worker-roots/report-later.txt', name: doc.name}]});
    assert.equal(app._searchResultsList.length, 1, 'revocation releases the old URI dedup entry');
    assert.equal(app._searchResultsList[0].uri, doc.uri);
    assert.equal(app._selectedSearchResultIdx, 0);
    assert.equal(app._emptySearchLabel, null);
    app._onFileSearchEvent({type: 'done', id});
    assert.equal(app.searchPreviewPane.children[1].text, doc.name);
});