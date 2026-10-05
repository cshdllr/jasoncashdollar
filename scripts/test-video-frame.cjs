// Exercise the browser failures that previously aborted video-project clicks.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const code = source.slice(source.indexOf('    function captureVideoFrame('), source.indexOf('    function updateInlineVideos('));
const ready = { classList: { contains: () => true }, readyState: 2, seeking: false, videoWidth: 360, videoHeight: 224 };
const fallback = 'images/previews/instagram-fundraisers-1.webp';
function setup({ exportError = false, drawError = false, noContext = false } = {}) {
    const canvas = {
        getContext: () => noContext ? null : { drawImage() { if (drawError) throw new Error('Frame unavailable'); } },
        toDataURL() {
            if (exportError) { const error = new Error('Tainted canvas'); error.name = 'SecurityError'; throw error; }
            return 'data:image/png;base64,frame';
        }
    };
    const context = vm.createContext({ document: { createElement: () => canvas } });
    vm.runInContext(code, context);
    return context;
}
assert.equal(setup().framePoster(ready, fallback), 'data:image/png;base64,frame');
for (const options of [{ exportError: true }, { drawError: true }, { noContext: true }]) {
    assert.equal(setup(options).framePoster(ready, fallback), fallback, JSON.stringify(options));
}
for (const video of [null, { ...ready, readyState: 1 }, { ...ready, seeking: true }, { ...ready, videoWidth: 0 }]) {
    assert.equal(setup().framePoster(video, fallback), fallback);
}
assert.equal(setup({ drawError: true }).captureVideoFrame(ready), null, 'opening/closing ghost also falls back');
console.log('PASS: playable video, blocked canvas export, unavailable frame/context, and unready video');
