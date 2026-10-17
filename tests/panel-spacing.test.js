// Run with: node --test tests/panel-spacing.test.js
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../applet.js'), 'utf8');
const start = source.indexOf('    _updateSearchPanelButton() {');
const end = source.indexOf('\n    _updatePanelButtonsActiveState()', start);
const update = vm.runInNewContext('({' + source.slice(start, end) + '})._updateSearchPanelButton', {
    St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}, TextDirection: {LTR: 0, RTL: 1}},
    Clutter: {ActorAlign: {FILL: 0, CENTER: 1}}
});
function render(spacing, visible = true, orientation = 3, rtl = false) {
    let style = '';
    const noop = () => {};
    const widget = () => ({hide: noop, show: noop, set_text: noop, set_style: noop,
        set_icon_size: noop, set_style_class_name: noop, set_height: noop, set_y_align: noop});
    update.call({showSearchButton: visible, searchButtonSpacing: spacing, _orientation: orientation,
        actor: {set_style: s => {style = s;}, get_text_direction: () => rtl ? 1 : 0},
        searchPanelButton: widget(), searchPanelLabel: widget(), searchPanelIcon: widget(),
        t: s => s, _updatePanelButtonsActiveState: noop});
    return Object.fromEntries(style.split(';').filter(s => s.trim()).map(s => s.split(':').map(x => x.trim())));
}
test('one spacing value increases both gaps by the same amount', () => {
    const css = render(12);
    assert.equal(css.spacing, '12px');
    assert.equal(css['padding-right'], '12px');
});
test('zero keeps the existing minimum geometry', () => {
    assert.equal(render(0).spacing, '0px');
    assert.equal(render(0)['padding-right'], '0px');
});
test('clamps extra spacing between 0 and 24 pixels', () => {
    assert.equal(render(-8).spacing, '0px');
    assert.equal(render(100)['padding-right'], '24px');
});
test('hiding Search removes both extra gaps', () => {
    assert.equal(render(12, false).spacing, '0px');
    assert.equal(render(12, false)['padding-right'], '0px');
});
test('vertical panels add the trailing gap below Search', () => {
    assert.equal(render(8, true, 0)['padding-bottom'], '8px');
});
test('right-to-left panels add the trailing gap on the left', () => {
    assert.equal(render(8, true, 3, true)['padding-left'], '8px');
});
