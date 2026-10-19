// Public branding may change without migrating the installed applet identity.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const projectName = 'Win11-Like Cinnamon Menu';
const repository = 'https://github.com/Grekto-dev/win11-like-cinnamon-menu';

test('the public project name changes without changing the installed UUID', () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
    assert.equal(metadata.name, projectName);
    assert.equal(metadata.uuid, 'win11-menu@cinnamon');
    assert.equal(metadata.website, repository);
});

test('installation documentation uses the renamed repository and preserves the applet directory', () => {
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    assert.equal(readme.split('\n')[0], '# ' + projectName);
    assert.ok(readme.includes('git clone ' + repository + '.git ~/.local/share/cinnamon/applets/win11-menu@cinnamon'));
    assert.ok(readme.includes('**"' + projectName + '"**'));
    assert.ok(!readme.includes('github.com/Grekto-dev/win11-menu'));
});

test('stylesheet header follows the public project name', () => {
    const css = fs.readFileSync(path.join(root, 'stylesheet.css'), 'utf8');
    assert.equal(css.split('\n')[1], ' * ' + projectName);
});
