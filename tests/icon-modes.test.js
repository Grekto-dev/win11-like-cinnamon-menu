// Three pinned-grid density modes: small (32px, 8 cols), medium (40px, 7 cols), large (48px, 6 cols).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings-schema.json'), 'utf8'));

function harness() {
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: 1},
        Main: {layoutManager: {findMonitorForActor: () => ({index: 0, width: 1920, height: 1080}), primaryMonitor: {index: 0, width: 1920, height: 1080}}},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    const actor = () => ({set_size(w, h) {this.width = w; this.height = h;}, set_clip_to_allocation() {}});
    Object.assign(app, {_panelHeight: 48, actor: {}, _orientation: 3, _getMenuAvailableArea: () => ({width: 1920, height: 1032}),
        mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false}});
    return app;
}
const metrics = (app, mode) => {
    app.iconSizeMode = mode; app._syncMenuGeometry();
    const p = app._getPinnedMetrics(), f = app._getFolderMetrics();
    return {p, f};
};

test('medium mode is 7 columns with icons between small and large', () => {
    const app = harness();
    const s = metrics(app, 'standard').p, m = metrics(app, 'medium').p, l = metrics(app, 'large').p;
    assert.equal(m.cols, 7);
    assert.equal(m.iconSize, 40);
    assert.ok(s.iconSize < m.iconSize && m.iconSize < l.iconSize);
    assert.ok(s.iconBox < m.iconBox && m.iconBox < l.iconBox);
    assert.ok(s.cellH < m.cellH && m.cellH < l.cellH);
    assert.ok(s.cellW < m.cellW && m.cellW < l.cellW);
});
test('every mode fits its grid inside the locked menu and keeps merge zones inside the cell', () => {
    const app = harness();
    for (const mode of ['standard', 'medium', 'large']) {
        const {p, f} = metrics(app, mode);
        assert.ok(p.cols * p.cellW <= app._menuContentSize.width, mode);
        assert.ok(p.iconBox < p.cellH, mode);
        assert.ok(p.mergeTop + p.mergeBottom < p.cellH, mode);
        assert.ok(f.iconBox < f.cellH && f.cols * f.cellW <= app._menuContentSize.width, mode);
    }
});
test('unknown or missing mode behaves as small; small stays unchanged', () => {
    const app = harness();
    const small = metrics(app, 'standard').p;
    assert.deepEqual([small.cols, small.cellW, small.cellH, small.iconSize, small.iconBox], [8, 95, 82, 32, 42]);
    assert.equal(metrics(app, undefined).p.cols, 8);
    assert.equal(metrics(app, 'bogus').p.cols, 8);
});
test('schema offers the medium value and keeps small as the default', () => {
    const values = Object.values(schema['icon-size-mode'].options);
    assert.deepEqual(values, ['standard', 'medium', 'large']);
    assert.equal(schema['icon-size-mode'].default, 'standard');
});
