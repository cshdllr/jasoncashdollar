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
for (const nativeFrames of [true, false]) {
    const callbacks = new Map();
    let nextId = 0, paints = 0;
    const schedule = callback => { callbacks.set(++nextId, callback); return nextId; };
    const cancel = id => callbacks.delete(id);
    const context = vm.createContext({requestAnimationFrame: schedule, cancelAnimationFrame: cancel});
    vm.runInContext(code, context);
    const video = {readyState: 1, seeking: false, videoWidth: 1920, videoHeight: 1080};
    if (nativeFrames) Object.assign(video, {requestVideoFrameCallback: schedule, cancelVideoFrameCallback: cancel});
    const canvas = {width: 360, height: 202, getContext: () => ({drawImage() { paints++; }})};
    const tick = () => {
        const [id, callback] = callbacks.entries().next().value;
        callbacks.delete(id);
        callback();
    };
    const stop = context.streamVideoMorph(video, canvas);
    assert.equal(canvas.width, 360, 'keep the thumbnail until a decoded frame exists');
    video.readyState = 2;
    tick();
    assert.equal(canvas.width, 1920, 'upgrade the existing animated canvas to full resolution');
    assert.equal(canvas.height, 1080);
    assert.equal(paints, 1);
    video.seeking = true;
    tick();
    assert.equal(paints, 1, 'retain the last frame during a seek');
    stop();
    assert.equal(callbacks.size, 0, 'closing or navigation cancels frame updates');
}
console.log('PASS: frame capture fallbacks, HD morph upgrade, seek handling, callback cleanup, and animation-frame fallback');
