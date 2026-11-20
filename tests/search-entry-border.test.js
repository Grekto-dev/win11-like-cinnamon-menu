// The Cinnamon theme paints `border: 1px solid <accent>` on #appmenu-search-entry:hover/:focus and the
// win11-frosted-panel extension an accent `border-bottom-color` on focus. On the fully rounded search field both
// read as a stray blue arc/outline. The applet stylesheet must keep those borders neutral in every state.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../stylesheet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rules() {
    const out = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
        out.push({selectors: m[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')), body: m[2]});
    return out;
}
const declared = (body, prop) => (body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)', 'm')) || [])[1];
const NEUTRAL = /^(transparent|rgba\(\s*(255,\s*255,\s*255|0,\s*0,\s*0),\s*[0-9.]+\s*\))$/;
const specificity = sel => ({ids: (sel.match(/#/g) || []).length, classes: (sel.match(/\.[\w-]+|:[\w-]+/g) || []).length});

function winners(selector) {
    // Rules whose selector list contains `selector`.
    return rules().filter(r => r.selectors.includes(selector));
}

for (const state of ['hover', 'focus']) {
    test(`the search entry border stays neutral on :${state} (no theme accent)`, () => {
        const rs = winners(`#appmenu-search-entry.win11-search-entry:${state}`).filter(r => declared(r.body, 'border-color'));
        assert.ok(rs.length, 'a border-color rule overrides the theme accent');
        for (const r of rs) assert.match(declared(r.body, 'border-color').trim(), NEUTRAL);
    });
}

test('inside the frosted start menu the focus/hover borders and underline are neutral and out-rank the extension', () => {
    // The extension's rule is `.win11-frosted-start-menu #appmenu-search-entry.win11-search-entry:focus`
    // (1 id, 3 classes/pseudo) and the light variant adds one more class. These numbers are copied from
    // win11-frosted-panel's stylesheet.css (lines ~353-359 and ~415); the cjs harness in the skill
    // (scripts/css_node_check.sh) checks the real override against the live files.
    const ext = {ids: 1, classes: 3}, extLight = {ids: 1, classes: 4};
    for (const [state, base, min] of [['focus', '.win11-frosted-start-menu', ext], ['hover', '.win11-frosted-start-menu', ext],
        ['focus', '.win11-frosted-start-menu.win11-frosted-start-menu-light', extLight], ['hover', '.win11-frosted-start-menu.win11-frosted-start-menu-light', extLight]]) {
        const sels = rules().flatMap(r => r.selectors.map(s => ({s, body: r.body})))
            .filter(x => x.s.startsWith(base + ' #appmenu-search-entry.win11-search-entry') && x.s.endsWith(':' + state));
        assert.ok(sels.length, `${base} :${state} rule exists`);
        const best = sels.map(x => ({...x, sp: specificity(x.s)})).sort((a, b) => b.sp.classes - a.sp.classes)[0];
        assert.ok(best.sp.ids === min.ids && best.sp.classes > min.classes, `${best.s} must out-rank the extension rule`);
        assert.match(declared(best.body, 'border-color').trim(), NEUTRAL);
        assert.match(declared(best.body, 'border-bottom-color').trim(), NEUTRAL, 'no accent underline');
    }
});

test('no rule of the applet sheet paints an accent colour on the search entry border', () => {
    for (const r of rules().filter(r => r.selectors.some(s => /appmenu-search-entry/.test(s))))
        for (const prop of ['border-color', 'border-bottom-color', 'border'])
            assert.doesNotMatch(declared(r.body, prop) || '', /#[0-9a-f]{3,8}\b|1f9ede|60cdff/i, r.selectors[0] + ' ' + prop);
});
