'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.join(__dirname, '../recentFiles.js');
const {RecentFilesCache} = fs.existsSync(modulePath) ? require(modulePath) : {};

function appletFixture(props = {}, extraContext = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
    class Actor {
        constructor(props = {}) {Object.assign(this, props); this.children = []; this.handlers = {}; this.clutter_text = {}; this.layout_manager = {};}
        add_actor(child) {this.children.push(child);} add(child) {this.add_actor(child);}
        destroy_all_children() {this.children = [];} set_clip_to_allocation() {}
        set_text(text) {this.text = text;} show() {this.visible = true;} hide() {this.visible = false;}
        connect(name, callback) {this.handlers[name] = callback; return 1;}
    }
    const apps = Object.fromEntries(Array.from({length: 25}, (_, i) => [String(i), {
        get_id: () => String(i), get_name: () => 'App ' + i, get_description: () => 'App description'
    }]));
    apps['nemo.desktop'] = {get_id: () => 'nemo.desktop', get_name: () => 'Files', get_description: () => ''};
    const idles = new Map(); let nextIdle = 1;
    const context = {Applet: {TextIconApplet: class {}}, REMEMBER_RECENT_KEY: 'remember-recent-files',
        Mainloop: {idle_add(fn) {const id = nextIdle++; idles.set(id, fn); return id;}, source_remove(id) {idles.delete(id);}},
        GLib: {SOURCE_REMOVE: false},
        PRIVACY_SCHEMA: 'org.cinnamon.desktop.privacy', RecentFiles: {RecentFilesCache},
        appsys: {lookup_app: id => apps[id] || null},
        St: {BoxLayout: Actor, Button: Actor, Label: Actor, Icon: Actor, Widget: Actor, Align: {MIDDLE: 0}},
        Clutter: {ActorAlign: {CENTER: 0}, BUTTON_PRIMARY: 1, BUTTON_SECONDARY: 3, EVENT_STOP: 'stop', EVENT_PROPAGATE: 'pass'},
        Pango: {EllipsizeMode: {END: 1}}, global: {ui_scale: 1},
        shorten_path: uri => uri, createAppIcon: () => new Actor(), ...extraContext};
    const AppletClass = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(AppletClass.prototype);
    Object.assign(app, {t: (key, value) => key + (value === undefined ? '' : ':' + value),
        showRecentApps: true, showRecentFiles: true, recentApps: [],
        privacy_settings: {get_boolean: () => true},
        _recentFilesCache: {getFiles: () => [{name: 'new.txt', uri: 'file:///fixture/new.txt',
            uriDecoded: '/fixture/new.txt', mtime: 1000, createIcon: size => new Actor({size})}]},
        allRecentListBox: new Actor()}, props);
    return {app, Actor, source, idles, flush() {
        while (idles.size) {const [id, fn] = idles.entries().next().value; idles.delete(id); fn();}
    }};
}

function recent(name, modified, extras = {}) {
    return {get_uri: () => 'file:///fixture/' + name, get_display_name: () => name,
        get_modified: () => modified, get_private_hint: () => false,
        get_mime_type: () => 'text/plain', get_gicon: () => ({name: 'text-x-generic'}), ...extras};
}
function fixture(records = []) {
    const idle = new Map(), queries = [], changes = [], cancelled = [];
    let nextId = 1, enabled = true, reads = 0;
    const manager = {get_items() {reads++; return records;}, remove_item(uri) {
        records = records.filter(record => record.get_uri() !== uri); return true;
    }};
    const Gio = {Cancellable: class {cancel() {cancelled.push(this);}},
        FileQueryInfoFlags: {NONE: 0}, FileType: {REGULAR: 1, DIRECTORY: 2},
        File: {new_for_uri(uri) {return {get_path: () => uri.startsWith('file:///') ? decodeURIComponent(uri.slice(7)) : null,
            get_uri: () => uri, query_info_async(attributes, flags, priority, cancellable, callback) {
                queries.push({uri, attributes, cancellable, finish: (ok = true, attrs = {}) => callback({
                    query_info_finish() {if (!ok) throw new Error('missing'); return {
                        get_is_hidden: () => !!attrs.hidden, get_file_type: () => attrs.type || 1,
                        has_attribute: key => key === 'access::can-read',
                        get_attribute_boolean: () => attrs.readable !== false
                    };}
                }, {})});
            }};}}};
    assert.equal(typeof RecentFilesCache, 'function', 'recentFiles exports the asynchronous snapshot model');
    const cache = new RecentFilesCache({manager, Gio, priority: 0, enabled: () => enabled,
        schedule(fn) {const id = nextId++; idle.set(id, fn); return id;},
        unschedule(id) {idle.delete(id);}, createIcon: (gicon, size) => ({gicon, size}),
        onChanged: () => changes.push(cache.getFiles())});
    return {cache, queries, changes, cancelled, manager, Gio,
        setEnabled(value) {enabled = value;}, get reads() {return reads;},
        flush() {while (idle.size) {const [id, fn] = idle.entries().next().value; idle.delete(id); fn();}},
        completeAll() {for (let index = 0; index < queries.length; index++) queries[index].finish();}};
}

test('snapshot is deferred, validates asynchronously, and includes all real modified times newest first', () => {
    const f = fixture(Array.from({length: 40}, (_, i) => recent('doc' + i, i + 100)));
    f.cache.refresh();
    assert.equal(f.reads, 0, 'no Gtk enumeration in constructor/refresh caller');
    assert.equal(f.queries.length, 0);
    assert.deepEqual(f.cache.getFiles(), []);
    f.flush();
    assert.equal(f.reads, 1);
    assert.ok(f.queries.length > 0 && f.queries.length <= 8, 'bounded concurrent filesystem requests');
    f.completeAll();
    const files = f.cache.getFiles();
    assert.equal(files.length, 40, 'not Cinnamon DocManager\'s twenty-record cap');
    assert.deepEqual(files.map(file => file.mtime), Array.from({length: 40}, (_, i) => 139 - i));
    assert.equal(files[0].uriDecoded, '/fixture/doc39');
    assert.equal(files[0].mimeType, 'text/plain');
    assert.deepEqual(files[0].createIcon(28), {gicon: {name: 'text-x-generic'}, size: 28});
});

test('remote history is not probed or mounted while refreshing local recent files', () => {
    const f = fixture([recent('remote.txt',100,{get_uri:()=> 'smb://server/share/remote.txt'}),recent('local.txt',90)]);
    f.cache.refresh(); f.flush();
    assert.deepEqual(f.queries.map(q=>q.uri),['file:///fixture/local.txt']);
    f.completeAll();
    assert.deepEqual(f.cache.getFiles().map(r=>r.name),['local.txt']);
});

test('private, hidden, missing, unreadable and duplicate entries never enter the snapshot', () => {
    const f = fixture([
        recent('valid.txt', 101), recent('valid.txt', 202), recent('gone.txt', 303),
        recent('private.txt', 404, {get_private_hint: () => true}),
        recent('.hidden.txt', 505), recent('inside.txt', 606, {get_uri: () => 'file:///fixture/.secret/inside.txt'}),
        recent('hidden-attribute.txt', 707), recent('unreadable.txt', 808),
        recent('invalid-time.txt', NaN)
    ]);
    f.cache.refresh(); f.flush();
    assert.ok(!f.queries.some(q => /private|secret|\.hidden|invalid-time/.test(q.uri)), 'exclude metadata-private entries before probing');
    for (const query of f.queries) query.finish(!query.uri.endsWith('/gone.txt'), {
        hidden: query.uri.endsWith('/hidden-attribute.txt'), readable: !query.uri.endsWith('/unreadable.txt')
    });
    assert.deepEqual(f.cache.getFiles().map(doc => [doc.name, doc.mtime]), [['valid.txt', 202]]);
});

test('privacy/toggle off performs no reads and synchronously revokes pending and published files', () => {
    const f = fixture([recent('document.txt', 100)]);
    f.setEnabled(false); f.cache.refresh(); f.flush();
    assert.equal(f.reads, 0); assert.equal(f.queries.length, 0);
    f.setEnabled(true); f.cache.refresh(); f.flush();
    const oldQuery = f.queries[0];
    f.setEnabled(false); f.cache.refresh();
    assert.deepEqual(f.cache.getFiles(), []);
    assert.equal(f.cancelled.length, 1);
    oldQuery.finish(); f.flush();
    assert.deepEqual(f.cache.getFiles(), [], 'late query must not resurrect revoked history');
    assert.equal(f.reads, 1);
    f.setEnabled(true); f.cache.refresh(); f.flush(); f.queries[1].finish();
    assert.equal(f.cache.getFiles().length, 1);
    f.setEnabled(false); f.cache.refresh();
    assert.deepEqual(f.cache.getFiles(), [], 'published snapshot disappears before returning');
    assert.deepEqual(f.changes.at(-1), []);
});

test('history changes and destroy cancel old generations, idle work, and prevent resurrection', () => {
    const f = fixture([recent('old.txt', 100)]);
    f.cache.refresh(); f.flush();
    const old = f.queries[0];
    f.manager.get_items = () => [recent('new.txt', 200)];
    f.cache.refresh(); f.flush();
    f.queries[1].finish(); old.finish();
    assert.deepEqual(f.cache.getFiles().map(doc => doc.name), ['new.txt']);
    f.cache.refresh(); f.flush();
    const pending = f.queries[2];
    f.cache.destroy(); pending.finish(); f.cache.refresh(); f.flush();
    assert.deepEqual(f.cache.getFiles(), []);
    assert.equal(f.queries.length, 3);
    const queued = fixture([recent('queued.txt', 300)]);
    queued.cache.refresh(); queued.cache.destroy(); queued.flush();
    assert.equal(queued.reads, 0);
});

test('mixed recent items sort real file/app timestamps before limiting and never add filler apps', () => {
    const {app} = appletFixture({recentApps: Array.from({length: 25}, (_, i) => ({id: String(i), timestamp: 900 - i}))});
    const items = app._getCombinedRecentItems(6);
    assert.equal(items[0].kind, 'file', 'a new file cannot be starved behind 25 apps');
    assert.equal(items[0].timestamp, 1000);
    assert.deepEqual(Array.from(items, item => item.timestamp), [1000, 900, 899, 898, 897, 896]);
    app.recentApps = []; app.showRecentFiles = false;
    assert.equal(app._getCombinedRecentItems(6).length, 0, 'no unlaunched common apps');
    app.showRecentFiles = true;
    assert.equal(app._getRecentFiles().length, 1);
    app.privacy_settings.get_boolean = () => false;
    app._recentFilesCache.getFiles = () => {throw new Error('privacy-off must not consume documents');};
    assert.equal(app._getRecentFiles().length, 0);
});

test('applet initializes recents lazily, revokes every recent view immediately, and disconnects signals', () => {
    const f = fixture([recent('document.txt', 100)]), idle = new Map(), disconnected = [];
    let nextId = 1, privacy = false, created = 0, historyChanged, privacyChanged;
    f.manager.connect = (signal, fn) => {assert.equal(signal, 'changed'); historyChanged = fn; return 77;};
    f.manager.disconnect = id => disconnected.push(['recent', id]);
    const privacySettings = {get_boolean: () => privacy, connect(signal, fn) {
        assert.equal(signal, 'changed::remember-recent-files'); privacyChanged = fn; return 88;
    }, disconnect: id => disconnected.push(['privacy', id])};
    const {app} = appletFixture({_recentFilesCache: null, privacy_settings: privacySettings}, {
        Gtk: {RecentManager: {get_default() {created++; return f.manager;}}}, Gio: f.Gio,
        GLib: {PRIORITY_LOW: 300, SOURCE_REMOVE: false},
        Mainloop: {idle_add(fn) {const id = nextId++; idle.set(id, fn); return id;}, source_remove(id) {idle.delete(id);}}
    });
    const views = [];
    app._refreshRecentSection = () => views.push('start');
    app._populateAllRecentSubView = () => views.push('all');
    app._refreshSearchHomeView = () => views.push('search-home');
    app._setupRecentFiles();
    const flush = () => {while (idle.size) {const [id, fn] = idle.entries().next().value; idle.delete(id); fn();}};
    flush(); assert.equal(created, 0, 'privacy disabled must not initialize/read GTK history');
    privacy = true; privacyChanged();
    assert.equal(created, 0, 'setting callback does not synchronously create Gtk manager');
    flush(); f.completeAll();
    assert.equal(app._getRecentFiles().length, 1);
    views.length = 0; privacy = false; privacyChanged();
    assert.equal(app._getRecentFiles().length, 0);
    assert.deepEqual(new Set(views), new Set(['start', 'all', 'search-home']));
    assert.equal(app.showRecentFiles, true, 'system privacy never overwrites the applet switch');
    privacy = true; privacyChanged(); flush();
    historyChanged(); flush();
    const pending = f.queries.at(-1);
    app._destroyRecentFiles(); pending.finish(); flush();
    assert.deepEqual(disconnected, [['recent', 77], ['privacy', 88]]);
    assert.equal(app._getRecentFiles().length, 0);
    app._destroyRecentFiles();
    assert.equal(disconnected.length, 2, 'teardown is idempotent');
});

test('All Recents renders an empty state and displays full history paths beside actual relative timestamps', () => {
    const {app, flush} = appletFixture();
    app._getCombinedRecentItems = () => [];
    app._populateAllRecentSubView();
    assert.equal(app.allRecentListBox.children.length, 1);
    assert.equal(app.allRecentListBox.children[0].text, 'no_recent_items');
    const now = Math.floor(Date.now() / 1000);
    assert.equal(app._formatRelativeTime(now - 120), 'minutes_ago:2');
    const doc = {kind: 'file', title: 'report.txt', uri: 'file:///fixture/report.txt',
        pathText: '/fixture/report.txt', subtitle: 'minutes_ago:2', timeText: 'minutes_ago:2'};
    const row = app._createRecentItemWidget(doc, true);
    assert.equal(row.children[1].children[1].text, '/fixture/report.txt');
    assert.equal(row.children[2].text, 'minutes_ago:2');
    const many = Array.from({length: 45}, (_, i) => ({...doc, title: 'report' + i}));
    app._getCombinedRecentItems = limit => many.slice(0, limit);
    app._populateAllRecentSubView(); flush();
    assert.equal(app.allRecentListBox.children.length, 45, 'Show all must not silently cap history at thirty');
});

test('recent file row opens files and floating context actions open parent/remove history only', () => {
    const opened = [], removed = [], refreshes = [], calls = [];
    const uri = 'file:///fixture/report.txt';
    const {app} = appletFixture({
        launchRecentUri: target => opened.push(target),
        RecentManager: {remove_item: target => removed.push(target)},
        _recentFilesCache: {getFiles: () => [{uri}], refresh: () => refreshes.push('refresh')},
        _showFloatingMenuAtActor: (anchor, items) => calls.push({anchor, items})
    }, {Gio: {File: {new_for_uri(target) {
        assert.equal(target, uri);
        return {get_parent: () => ({get_uri: () => 'file:///fixture'})};
    }}}});
    const row = app._createRecentItemWidget({kind: 'file', title: 'report.txt', uri}, true);
    assert.equal(row.handlers['button-release-event'](row, {get_button: () => 1}), 'stop');
    assert.deepEqual(opened, [uri]);
    assert.equal(row.handlers['button-release-event'](row, {get_button: () => 3}), 'stop');
    assert.equal(calls[0].anchor, row);
    assert.deepEqual(Array.from(calls[0].items, item => item.label), ['open', 'open_file_location', 'remove_from_recents']);
    calls[0].items[1].action();
    assert.deepEqual(opened, [uri, 'file:///fixture']);
    calls[0].items[2].action();
    assert.deepEqual(removed, [uri]);
    assert.equal(refreshes.length, 1);
    app.privacy_settings.get_boolean = () => false;
    calls[0].items[2].action();
    assert.equal(removed.length, 1, 'revoked context cannot manipulate hidden history');
});

test('Search Home file context is floating and privacy revocation clears existing UI including context', () => {
    let privateMode = false;
    const menus = [], {app, Actor} = appletFixture();
    for (const key of ['searchHomeBox', 'searchRecentTitle', 'quickSearchesTitle', 'topAppsTitle',
        'searchRecentListBox', 'quickSearchesChipsBox', 'topAppsGridBox', 'floatingMenuBackdrop', 'floatingMenuBox']) app[key] = new Actor();
    app._getTopApps = () => [];
    app.privacy_settings.get_boolean = () => !privateMode;
    app._showFloatingMenuAtActor = (anchor, items) => {menus.push(items); app.floatingMenuBackdrop.show();};
    app._recentFilesCache.refresh = () => app._refreshRecentViews();
    app._refreshRecentViews();
    const row = app.searchRecentListBox.children[0];
    assert.equal(row.handlers['button-release-event'](row, {get_button: () => 3}), 'stop');
    assert.equal(menus.length, 1);
    privateMode = true; app._onRecentFilesSettingChanged();
    assert.equal(app.searchRecentListBox.children.length, 0);
    assert.equal(app.allRecentListBox.children[0].text, 'no_recent_items');
    assert.equal(app.floatingMenuBackdrop.visible, false, 'privacy disables old file context as well');
});

for (const toggle of ['privacy', 'showRecentFiles']) {
    test(`${toggle} revokes active history search even when the cache emits no change, preserving independently selected favorites`, () => {
        const {app, Actor} = appletFixture();
        const history = {kind: 'file', uri: 'file:///outside-roots/private.txt', fileSources: new Set(['recent']), actor: new Actor()};
        const favorite = {kind: 'file', uri: 'file:///favorites/kept.txt', fileSources: new Set(['favorite']), actor: new Actor()};
        let destroyed = 0, refreshes = 0;
        history.actor.destroy = () => destroyed++;
        app._recentFilesCache.refresh = () => refreshes++;
        app._searchResultsList = [history, favorite];
        app._selectedSearchResultIdx = 1;
        app.searchPreviewPane = new Actor();
        const preview = new Actor(); app.searchPreviewPane.add_actor(preview);
        app._selectSearchResult = () => {throw new Error('retained selection must not rebuild its preview');};
        if (toggle === 'privacy') app.privacy_settings.get_boolean = () => false;
        else app.showRecentFiles = false;
        app._onRecentFilesSettingChanged();
        assert.equal(destroyed, 1);
        assert.deepEqual(Array.from(app._searchResultsList), [favorite]);
        assert.equal(app._selectedSearchResultIdx, 0);
        assert.equal(app.searchPreviewPane.children[0], preview);
        assert.equal(refreshes, 1);
        app._onRecentFilesSettingChanged();
        assert.equal(destroyed, 1, 'revocation is idempotent');
        app._destroying = true;
        app._onRecentFilesSettingChanged();
        app._revokeRecentSearchResults();
        assert.equal(refreshes, 2, 'late setting notifications cannot operate after teardown');
        assert.equal(app.searchPreviewPane.children[0], preview);
    });
}

test('backend enumeration and synchronous async-API failures are isolated and can recover on the next change', () => {
    const f = fixture([recent('bad-backend.txt', 100), recent('good.txt', 200)]);
    const makeFile = f.Gio.File.new_for_uri;
    f.Gio.File.new_for_uri = uri => {
        const file = makeFile(uri);
        if (uri.endsWith('bad-backend.txt')) file.query_info_async = () => {throw new Error('unsupported backend');};
        return file;
    };
    f.cache.refresh(); assert.doesNotThrow(() => f.flush()); f.completeAll();
    assert.deepEqual(f.cache.getFiles().map(file => file.name), ['good.txt']);
    const getItems = f.manager.get_items;
    f.manager.get_items = () => {throw new Error('history unavailable');};
    f.cache.refresh(); assert.doesNotThrow(() => f.flush());
    assert.deepEqual(f.cache.getFiles(), []);
    f.manager.get_items = getItems; f.cache.refresh(); f.flush(); f.queries.at(-1).finish();
    assert.equal(f.cache.getFiles().length, 1);
});

test('recent settings and documentation describe usable privacy-aware history, not a placeholder', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));
    assert.match(schema['show-recent-files'].tooltip || '', /privacy/i);
    const settings = fs.readFileSync(path.join(__dirname, '../win11-menu-settings.py'), 'utf8');
    assert.match(settings, /recent_files_note/);
    assert.match(settings, /remember-recent-files/);
    const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
    assert.doesNotMatch(readme, /recent-files toggle is a placeholder/);
    assert.match(readme, /history only/i);
});

test('large All Recents histories render in bounded idle batches that cannot survive revocation or teardown', () => {
    const {app, Actor, flush, idles} = appletFixture({_recentFilesCache: null});
    const many = Array.from({length: 1000}, (_, i) => ({kind: 'file', uri: 'file:///fixture/' + i, title: String(i)}));
    app._getCombinedRecentItems = () => many;
    app._createRecentItemWidget = item => new Actor({text: item.title});
    app._populateAllRecentSubView();
    assert.ok(app.allRecentListBox.children.length <= 20, 'large histories cannot synchronously build every actor');
    assert.equal(idles.size, 1);
    flush(); assert.equal(app.allRecentListBox.children.length, 1000);
    app._populateAllRecentSubView();
    app._getCombinedRecentItems = () => [];
    app._populateAllRecentSubView(); flush();
    assert.equal(app.allRecentListBox.children.length, 1);
    assert.equal(app.allRecentListBox.children[0].text, 'no_recent_items');
    app._getCombinedRecentItems = () => many;
    app._populateAllRecentSubView(); app._destroyRecentFiles();
    assert.equal(idles.size, 0, 'teardown cancels pending actor construction');
});

test('production recent paths contain no synchronous filesystem/content calls and both applet teardowns cancel history', () => {
    const model = fs.readFileSync(modulePath, 'utf8'), {source, app} = appletFixture();
    assert.doesNotMatch(model, /\b(?:query_exists|query_info|load_contents|load_contents_async|read|read_async|enumerate_children)\s*\(/);
    for (const name of ['_getRecentFiles', '_getCombinedRecentItems', '_populateAllRecentSubView']) {
        assert.doesNotMatch(String(app[name]), /(?:get_items|query_info|query_exists|load_contents|\.refresh\s*\()/);
    }
    for (const name of ['on_applet_removed_from_panel', 'destroy']) assert.match(String(app[name]), /this\._destroyRecentFiles\(\)/);
    assert.doesNotMatch(String(app._removeRecentFile), /\.(?:delete|trash|unlink|remove)\s*\(/);
    assert.doesNotMatch(source, /_infosByTimestamp/, 'all recent consumers must use validated history');
});

test('real Gtk/Gio fixture loads full XBEL timestamps and validates existence asynchronously without touching user history', {
    skip: !fs.existsSync('/usr/bin/cjs')
}, () => {
    const os = require('node:os'), {spawnSync} = require('node:child_process');
    const storage = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'win11-recent-fixture-'));
    // Expose the fixture via a non-hidden path: the required scratch directory
    // lives under .hermes and must correctly be rejected as a hidden ancestor.
    const dir = path.join(__dirname, 'fixtures', path.basename(storage));
    fs.symlinkSync(storage, dir, 'dir');
    try {
        fs.writeFileSync(path.join(dir, 'present.txt'), 'fixture');
        const script = `
            imports.gi.versions.Gtk = '3.0';
            imports.searchPath.unshift(${JSON.stringify(path.resolve(__dirname, '..'))});
            const {Gtk, Gio, GLib} = imports.gi;
            const root = ${JSON.stringify(dir)};
            const marks = new GLib.BookmarkFile();
            const uri = GLib.filename_to_uri(root + '/present.txt', null);
            const missing = GLib.filename_to_uri(root + '/missing.txt', null);
            const privateUri = GLib.filename_to_uri(root + '/private.txt', null);
            for (const [u, name, stamp] of [[uri, 'present.txt', 1700000001], [missing, 'missing.txt', 1700000002], [privateUri, 'private.txt', 1700000003]]) {
                marks.set_title(u, name); marks.set_mime_type(u, 'text/plain');
                marks.add_application(u, 'Fixture', 'fixture %u');
                marks.set_added(u, stamp); marks.set_modified(u, stamp); marks.set_visited(u, stamp);
            }
            marks.set_is_private(privateUri, true);
            marks.to_file(root + '/recent.xbel');
            const manager = new Gtk.RecentManager({filename: root + '/recent.xbel'});
            const loop = new GLib.MainLoop(null, false);
            let cache;
            cache = new imports.recentFiles.RecentFilesCache({manager, Gio, priority: GLib.PRIORITY_LOW,
                enabled: () => true, schedule: fn => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, fn),
                unschedule: id => GLib.source_remove(id), createIcon: (icon, size) => icon,
                onChanged: () => {
                    if (!cache) return;
                    const docs = cache.getFiles();
                    if (docs.length) {
                        print(JSON.stringify(docs.map(doc => ({name: doc.name, uri: doc.uri, mtime: doc.mtime,
                            mimeType: doc.mimeType, hasIcon: !!doc.gicon}))));
                        cache.destroy(); loop.quit();
                    }
                }});
            cache.refresh();
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {cache.destroy(); loop.quit(); return false;});
            loop.run();
        `;
        const result = spawnSync('/usr/bin/cjs', ['-c', script], {encoding: 'utf8', timeout: 6000,
            env: {...process.env, XDG_DATA_HOME: dir, XDG_CACHE_HOME: dir, XDG_CONFIG_HOME: dir}});
        assert.equal(result.status, 0, result.stderr || String(result.error));
        const docs = JSON.parse(result.stdout.trim());
        assert.deepEqual(docs, [{name: 'present.txt', uri: 'file://' + dir + '/present.txt',
            mtime: 1700000001, mimeType: 'text/plain', hasIcon: true}]);
        assert.equal(fs.readFileSync(path.join(dir, 'present.txt'), 'utf8'), 'fixture');
    } finally {fs.unlinkSync(dir); fs.rmSync(storage, {recursive: true, force: true});}
});
