// Menu size is a fixed fraction of the monitor, measured from the reference capture:
// 834x866 px on a 1920x1080 monitor (43.4% x 80.2%), 12 px above a 48 px taskbar.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../applet.js'), 'utf8');

function harness({monitor = {width: 1920, height: 1080}, uiScale = 1, panel = 48, area = null, menuSize = 'large', customMenuWidth = 796, customMenuHeight = 750} = {}) {
    const context = {Applet: {TextIconApplet: class {}}, global: {ui_scale: uiScale},
        Main: {layoutManager: {findMonitorForActor: () => ({index: 0, x: 0, y: 0, ...monitor}), primaryMonitor: {index: 0, ...monitor}}},
        St: {Side: {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3}}};
    const Class = vm.runInNewContext(source.slice(source.indexOf('class Win11MenuApplet'), source.indexOf('\nfunction main')) + '\nWin11MenuApplet', context);
    const app = Object.create(Class.prototype);
    Object.assign(app, {_panelHeight: panel, actor: {}, _orientation: 3, menuSize, customMenuWidth, customMenuHeight,
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
test('1920x1080 and above keep the FHD screen fraction while sub-FHD resolutions follow the compact reference curve', () => {
    for (const [w, h] of [[1920, 1080], [2560, 1440], [3840, 2160]]) {
        const geo = g({monitor: {width: w, height: h}, area: {width: w, height: h - h * 0.0444}});
        assert.ok(Math.abs(geo.width / w - 834 / 1920) < 0.003, `${w}x${h} width ${geo.width / w}`);
        assert.ok(Math.abs(geo.height / h - 866 / 1080) < 0.003, `${w}x${h} height ${geo.height / h}`);
    }
    // On 1366x768, Small matches the 885px compact Windows 11 reference capture height ratio (726 / 885 = 82.03%)
    const small768 = g({menuSize: 'small', monitor: {width: 1366, height: 768}, panel: 40});
    assert.deepEqual([small768.width, small768.height], [557, 630]);
    assert.ok(Math.abs(small768.height / 768 - 726 / 885) < 0.002);
    const medium768 = g({menuSize: 'medium', monitor: {width: 1366, height: 768}, panel: 40});
    assert.deepEqual([medium768.width, medium768.height], [640, 690]);
    const large768 = g({menuSize: 'large', monitor: {width: 1366, height: 768}, panel: 40});
    assert.ok(small768.width < medium768.width && medium768.width < large768.width);
    assert.ok(small768.height < medium768.height && medium768.height < large768.height);
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
        menu: {actor: {set_size() {}, set_clip_to_allocation() {}}, isOpen: false}, menuSize: 'large'});
    app._syncMenuGeometry();
    const p = app._getPinnedMetrics();
    assert.equal(p.cols * p.cellW <= 762 && p.cols * p.cellW > 762 - p.cols, true, `${p.cols}x${p.cellW}`);
});

test('each menu profile preserves crisp icon sizes, Search Home responsive columns, and HiDPI texture sizes', () => {
    const actor = () => ({set_size() {}, set_clip_to_allocation() {}});
    for (const [menuSize, width, height, cols] of [['small', 642, 726, 6], ['medium', 738, 796, 7], ['large', 834, 866, 8]]) {
        for (const [w, h] of [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160], [3440, 1440]]) {
            for (const uiScale of [1, 2]) {
                const app = harness({menuSize, monitor: {width: w, height: h}, uiScale, panel: 40 * uiScale});
                Object.assign(app, {mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false},
                    searchLeftCol: {}, searchPreviewPane: {}});
                app._syncMenuGeometry();
                const geo = app._menuGeometry;
                const p = app._getPinnedMetrics();
                const s = app._getSearchMetrics();
                assert.equal(p.cols, cols);
                assert.equal(p.iconBox, Math.max(1, Math.round(42 * geo.scale)));
                if (w >= 1920 && h >= 1080) {
                    const scale = Math.min(w / 1920, h / 1080);
                    assert.deepEqual([geo.width, geo.height], [Math.floor(width * scale), Math.floor(height * scale)]);
                    assert.equal(p.iconSize, Math.round(32 * scale / uiScale));
                } else if (uiScale === 1) {
                    assert.equal(p.iconSize, 32, `${menuSize}@${w}x${h} keeps 32px icons`);
                }
                assert.ok(p.cols * p.cellW <= app._menuContentSize.width - 2 * p.padX * uiScale);
                assert.ok(s.leftW + 3 * s.topAppCardW + 16 * uiScale + 74 * uiScale <= app._menuContentSize.width);
            }
        }
    }
});

test('custom menu size mode coincides with presets and steps columns/icons proportionally', () => {
    const actor = () => ({set_size() {}, set_clip_to_allocation() {}});
    for (const [w, h] of [[1366, 768], [1920, 1080], [2560, 1440], [3840, 2160]]) {
        const probe = harness({monitor: {width: w, height: h}, panel: 40});
        const bounds = probe._getMenuSizeBounds();
        const smallPreset = probe._getPresetGeometry('small');
        const mediumPreset = probe._getPresetGeometry('medium');
        const largePreset = probe._getPresetGeometry('large');

        // Minimum size equals Small preset
        assert.equal(bounds.minWidth, smallPreset.width);
        assert.equal(bounds.minHeight, smallPreset.height);
        assert.ok(bounds.maxWidth > largePreset.width);
        assert.ok(bounds.maxHeight >= largePreset.height);

        // When custom width/height coincides with Small, Medium, or Large, cols and iconSize match preset
        for (const [presetName, preset, expectedCols] of [
            ['small', smallPreset, 6],
            ['medium', mediumPreset, 7],
            ['large', largePreset, 8],
        ]) {
            const customApp = harness({
                menuSize: 'custom',
                customMenuWidth: preset.width,
                customMenuHeight: preset.height,
                monitor: {width: w, height: h},
                panel: 40,
            });
            Object.assign(customApp, {mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false},
                searchLeftCol: {}, searchPreviewPane: {}});
            customApp._syncMenuGeometry();
            const p = customApp._getPinnedMetrics();
            assert.equal(p.cols, expectedCols, `${presetName}@${w}x${h} cols`);
            assert.equal(p.iconSize, Math.round(32 * Math.max(1, preset.logicalScale)), `${presetName}@${w}x${h} iconSize`);
        }

        // Just above Small width, a 7th column is added and iconSize steps down then grows toward Medium
        const justAboveSmall = harness({
            menuSize: 'custom',
            customMenuWidth: smallPreset.width + 4,
            customMenuHeight: smallPreset.height,
            monitor: {width: w, height: h},
            panel: 40,
        });
        Object.assign(justAboveSmall, {mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false},
            searchLeftCol: {}, searchPreviewPane: {}});
        justAboveSmall._syncMenuGeometry();
        const pStep = justAboveSmall._getPinnedMetrics();
        assert.equal(pStep.cols, 7);
        const maxIcon = Math.round(32 * Math.max(1, smallPreset.logicalScale));
        assert.ok(pStep.iconSize < maxIcon && pStep.iconSize >= Math.round(32 * (6 / 7) * Math.max(1, smallPreset.logicalScale)) - 1);

        // Beyond Large width, a 9th column is added and icons never exceed preset max
        const aboveLarge = harness({
            menuSize: 'custom',
            customMenuWidth: largePreset.width + 20,
            customMenuHeight: largePreset.height,
            monitor: {width: w, height: h},
            panel: 40,
        });
        Object.assign(aboveLarge, {mainContainer: actor(), rootStack: actor(), menu: {actor: actor(), isOpen: false},
            searchLeftCol: {}, searchPreviewPane: {}});
        aboveLarge._syncMenuGeometry();
        const pAboveLarge = aboveLarge._getPinnedMetrics();
        assert.ok(pAboveLarge.cols >= 9);
        assert.ok(pAboveLarge.iconSize <= Math.round(32 * Math.max(1, largePreset.logicalScale)));
    }
});

test('clamping reserves the scaled panel gap as well as the UI margin on every side', () => {
    for (const menuSize of ['small', 'medium', 'large']) {
        for (const orientation of [0, 1, 2, 3]) {
            for (const uiScale of [1, 2]) {
                const app = harness({menuSize, monitor: {width: 7680, height: 4320}, uiScale,
                    area: {width: 1500, height: 1700}});
                app._orientation = orientation;
                const geo = app._getMenuGeometry(), gap = app._getMenuFloatOffset();
                assert.ok(geo.width <= 1500 - 20 * uiScale && geo.height <= 1700 - 20 * uiScale);
                if (orientation === 0 || orientation === 1)
                    assert.ok(geo.width + gap <= 1500, `${menuSize} side ${orientation}: ${geo.width}+${gap}`);
                else
                    assert.ok(geo.height + gap <= 1700, `${menuSize} side ${orientation}: ${geo.height}+${gap}`);
            }
        }
    }
});

test('real popup placement keeps every profile inside offset monitor work areas on all panel sides', () => {
    const Side = {LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3};
    const PanelLoc = {left: 2, right: 3, top: 0, bottom: 1};
    for (const menuSize of ['small', 'medium', 'large']) {
        for (const side of Object.keys(Side)) {
            for (const [width, height, uiScale] of [[1920, 1080, 1], [800, 600, 1], [3840, 2160, 2]]) {
                const vertical = side === 'LEFT' || side === 'RIGHT';
                const thickness = 48 * uiScale;
                const monitor = {x: -width, y: 100, width, height, index: 1};
                const area = {x: monitor.x + (side === 'LEFT' ? thickness : 0), y: monitor.y + (side === 'TOP' ? thickness : 0),
                    width: width - (vertical ? thickness : 0), height: height - (vertical ? 0 : thickness)};
                const app = harness({menuSize, monitor, area, uiScale});
                const geo = app._getMenuGeometry(), gap = app._getMenuFloatOffset();
                const context = {Applet: {AppletPopupMenu: class {}}, St: {Side}, PopupMenu: {PanelLoc},
                    Main: {layoutManager: {findMonitorForActor: () => monitor}, panelManager: {getPanelsInMonitor: () => [{
                        getIsVisible: () => true, panelPosition: PanelLoc[side.toLowerCase()], actor: {width: thickness, height: thickness}
                    }]}}};
                const Popup = vm.runInNewContext(source.slice(source.indexOf('class Win11PopupMenu'), source.indexOf('\nclass Win11MenuApplet')) + '\nWin11PopupMenu', context);
                const menu = Object.assign(Object.create(Popup.prototype), {_orientation: Side[side], sourceActor: {},
                    box: {show() {}}, actor: {visible: true, get_preferred_size: () => [0, 0, geo.width, geo.height]}, launcher: app});
                app.centerMenuOnScreen = true;
                const [x, y] = menu._calculatePosition();
                const label = `${menuSize}/${side}/${width}x${height}@${uiScale}`;
                assert.ok(x >= area.x && y >= area.y && x + geo.width <= area.x + area.width && y + geo.height <= area.y + area.height, label);
                if (side === 'LEFT') assert.equal(x, area.x + gap, label);
                if (side === 'RIGHT') assert.equal(x + geo.width, area.x + area.width - gap, label);
                if (side === 'TOP') assert.equal(y, area.y + gap, label);
                if (side === 'BOTTOM') assert.equal(y + geo.height, area.y + area.height - gap, label);
            }
        }
    }
});
