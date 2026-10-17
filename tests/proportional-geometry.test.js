// Menu size is a fixed fraction of the monitor, measured from the reference capture:
// 834x866 px on a 1920x1080 monitor (43.4% x 80.2%), 12 px above a 48 px taskbar.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function harness({monitor = {width: 1920, height: 1080}, uiScale = 1, panel = 48, area = null} = {}) {
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: uiScale},
        Main: {layoutManager: {findMonitorForActor: () => ({index: 0, x: 0, y: 0, ...monitor}), primaryMonitor: {index: 0, ...monitor}}},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {_panelHeight: panel, actor: {}, _orientation: 3,
        _getMenuAvailableArea: () => area || {width: monitor.width, height: monitor.height - panel}});
    return app;
}
const g = opts => harness(opts)._getMenuGeometry();

test('reference monitor 1920x1080 gives the measured 834x866 menu', () => {
    const geo = g();
    assert.deepEqual([geo.width, geo.height], [834, 866]);
});
test('panel thickness no longer changes the menu size', () => {
    for (const panel of [30, 48, 64]) assert.deepEqual([g({panel}).width, g({panel}).height], [834, 866]);
});
test('every 16:9 resolution keeps the same fraction of the screen', () => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]]) {
        const geo = g({monitor: {width: w, height: h}, area: {width: w, height: h - h * 0.0444}});
        assert.ok(Math.abs(geo.width / w - 834 / 1920) < 0.003, `${w}x${h} width ${geo.width / w}`);
        assert.ok(Math.abs(geo.height / h - 866 / 1080) < 0.003, `${w}x${h} height ${geo.height / h}`);
    }
});
test('HiDPI: the same fraction whether or not the shell scales the UI', () => {
    const a = g({monitor: {width: 3840, height: 2160}, uiScale: 2, panel: 96, area: {width: 3840, height: 2064}});
    const b = g({monitor: {width: 3840, height: 2160}, uiScale: 1, panel: 48, area: {width: 3840, height: 2112}});
    assert.deepEqual([a.width, a.height], [1668, 1732]);
    assert.deepEqual([b.width, b.height], [1668, 1732]);
});
test('ultra-wide screens keep the menu aspect ratio instead of stretching it', () => {
    const geo = g({monitor: {width: 3440, height: 1440}, area: {width: 3440, height: 1380}});
    assert.ok(Math.abs(geo.width / geo.height - 834 / 866) < 0.003);
    assert.ok(Math.abs(geo.height / 1440 - 866 / 1080) < 0.003);
});
test('the menu never exceeds the work area even on tiny screens', () => {
    const geo = g({monitor: {width: 1920, height: 1080}, area: {width: 600, height: 500}});
    assert.ok(geo.width <= 580 && geo.height <= 480);
    assert.ok(Math.abs(geo.width / geo.height - 834 / 866) < 0.003);
});
test('the gap above the taskbar scales with the menu (12 px at the reference size)', () => {
    assert.equal(harness()._getMenuFloatOffset(), 12);
    assert.equal(harness({monitor: {width: 3840, height: 2160}, area: {width: 3840, height: 2064}})._getMenuFloatOffset(), 24);
});
test('the pinned grid spans the content width of the new menu (834 - 72 px padding)', () => {
    const app = harness();
    Object.assign(app, {mainContainer: {set_size() {}, set_clip_to_allocation() {}}, rootStack: {set_size() {}, set_clip_to_allocation() {}},
        menu: {actor: {set_size() {}, set_clip_to_allocation() {}}, isOpen: false}, iconSizeMode: 'standard'});
    app._syncMenuGeometry();
    const p = app._getPinnedMetrics();
    assert.equal(p.cols * p.cellW <= 762 && p.cols * p.cellW > 762 - p.cols, true, `${p.cols}x${p.cellW}`);
});
