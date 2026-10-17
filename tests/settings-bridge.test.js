// Bridge between the standalone GTK settings window and the applet.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function harness(exists = true) {
    const spawned = [];
    const context = {Applet: {TextIconApplet: class {configureApplet(tab) {spawned.push(['native', tab]);}}}, global: {logWarning() {}},
        GLib: {file_test: () => exists, FileTest: {EXISTS: 1}, build_filenamev: parts => parts.join('/'),
            get_user_cache_dir: () => '/home/u/.cache', get_home_dir: () => '/home/u'},
        Util: {spawn: argv => spawned.push(argv)}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {instance_id: 31, _appletPath: '/apps/win11-menu@cinnamon'});
    return {app, spawned, context};
}

test('Configure opens the custom window for this instance', () => {
    const {app, spawned} = harness();
    app.configureApplet();
    assert.deepEqual(Array.from(spawned[0]), ['/usr/bin/python3', '/apps/win11-menu@cinnamon/win11-menu-settings.py', '--instance-id', '31']);
});
test('Configure falls back to the native settings window when the script is missing', () => {
    const {app, spawned} = harness(false);
    app.configureApplet(2);
    assert.deepEqual(spawned, [['native', 2]]);
});
test('refresh trigger re-reads the settings file for this instance only', () => {
    const {app} = harness();
    let updates = 0;
    app.settings = {remoteUpdate() {updates++;}};
    app._onCacheTrigger('refresh-31');
    app._onCacheTrigger('refresh-all');
    app._onCacheTrigger('refresh-23');
    assert.equal(updates, 2);
});
test('reset-pinned trigger resets this instance only', () => {
    const {app} = harness();
    let resets = 0;
    app._reset_pinned_apps = () => {resets++;};
    app._onCacheTrigger('reset-pinned-31');
    app._onCacheTrigger('reset-pinned-23');
    app._onCacheTrigger('something-else');
    assert.equal(resets, 1);
});
test('a failing settings reload never throws into the shell', () => {
    const {app} = harness();
    app.settings = {remoteUpdate() {throw new Error('boom');}};
    assert.doesNotThrow(() => app._onCacheTrigger('refresh-31'));
});
test('main passes the applet path along', () => {
    assert.match(source, /new Win11MenuApplet\(orientation, panel_height, instance_id, metadata\)/);
});
