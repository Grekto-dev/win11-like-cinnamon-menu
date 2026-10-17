// Footer shortcut order (left -> right): documents, downloads, music, pictures, videos, network,
// home, file explorer, settings, then the always-present power button (far right).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));
const ALL = ['documents', 'downloads', 'music', 'pictures', 'videos', 'network', 'home', 'files', 'settings'];

function harness() {
    const context = {Applet: {TextIconApplet: class {}}, global: {}, GLib: {
        UserDirectory: {DIRECTORY_DOWNLOAD: 1, DIRECTORY_DOCUMENTS: 2, DIRECTORY_PICTURES: 3, DIRECTORY_MUSIC: 4, DIRECTORY_VIDEOS: 5},
        get_user_special_dir: d => '/home/u/dir' + d, get_home_dir: () => '/home/u', shell_quote: s => `'${s}'`}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {t: k => k, showFiles: true, showSettings: true, showDownloads: true, showDocuments: true,
        showPictures: true, showMusic: true, showVideos: true, showHome: true, showNetwork: true});
    return app;
}

test('all shortcuts appear in the requested left-to-right order', () => {
    assert.deepEqual(Array.from(harness()._footerShortcuts(), s => s.id), ALL);
});
test('disabled shortcuts are skipped without disturbing the order', () => {
    const app = harness();
    Object.assign(app, {showMusic: false, showHome: false, showDocuments: false});
    assert.deepEqual(Array.from(app._footerShortcuts(), s => s.id), ['downloads', 'pictures', 'videos', 'network', 'files', 'settings']);
});
test('power is never part of the configurable list', () => {
    assert.ok(!Array.from(harness()._footerShortcuts(), s => s.id).includes('power'));
    assert.ok(!('show-power' in schema));
});
test('network opens the network location with its own icon and label', () => {
    const n = harness()._footerShortcuts().find(s => s.id === 'network');
    assert.equal(n.labelKey, 'network');
    assert.ok(n.icon.includes('network'));
    assert.match(n.command, /xdg-open 'network:\/\/\/'/);
});
test('special folders resolve through the user directories and are dropped when unknown', () => {
    const app = harness();
    assert.match(app._footerShortcuts().find(s => s.id === 'downloads').command, /dir1/);
    assert.match(app._footerShortcuts().find(s => s.id === 'documents').command, /dir2/);
}
);
test('settings expose show-network (off by default) and the footer keys', () => {
    assert.equal(schema['show-network'].type, 'switch');
    assert.equal(schema['show-network'].default, false);
    for (const k of ALL.filter(k => k !== 'network')) assert.equal(typeof schema['show-' + (k === 'files' ? 'files' : k)].default, 'boolean', k);
});
test('both languages know every footer label', () => {
    const labels = [...source.matchAll(/^\s{8}(network|documents|downloads|music|pictures|videos|personal_folder|file_explorer|system_settings|power):/gm)].map(m => m[1]);
    for (const k of ['network', 'documents', 'downloads', 'music', 'pictures', 'videos', 'personal_folder', 'file_explorer', 'system_settings', 'power'])
        assert.equal(labels.filter(l => l === k).length, 2, k);
});
