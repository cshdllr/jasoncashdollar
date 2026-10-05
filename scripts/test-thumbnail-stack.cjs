// Run with node scripts/test-thumbnail-stack.cjs.
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const start = source.indexOf('    function enableThumbnailStack(');
const code = source.slice(start, source.indexOf('\n    projects.forEach', start));
const classes = new Set(), events = {}, observed = [];
let resize, collapse;
const thumbnails = [0, 0, 56].map(width => ({
    width,
    style: {setProperty(name, value) { this[name] = value; }}
}));
const strip = {
    children: thumbnails, columnGap: '8px', scrollLeft: 0,
    addEventListener(name, fn) { events[name] = fn; }
};
const shell = {
    classList: {add: name => classes.add(name), remove: name => classes.delete(name)},
    addEventListener(name, fn) { events[name] = fn; },
    matches: () => false, querySelector: () => null
};
const context = vm.createContext({
    getComputedStyle: element => element,
    ResizeObserver: class {
        constructor(callback) { resize = callback; }
        observe(element) { observed.push(element); }
    },
    desktopStacks: {matches: true, addEventListener() {}},
    dialog: {open: false, addEventListener() {}},
    updateInlineVideos() {}, clearTimeout() {},
    setTimeout(callback) { collapse = callback; }
});
vm.runInContext(code, context);
context.enableThumbnailStack(shell, strip);
assert.deepEqual(observed, thumbnails);
assert.equal(thumbnails[2].style['--row-x'], '16px');
// Lazy-loaded covers replace zero-width placeholders with fractional widths.
thumbnails[0].width = '47.9766px';
thumbnails[1].width = '48.7578px';
resize();
assert.equal(thumbnails[1].style['--row-x'], '55.9766px');
assert.ok(Math.abs(parseFloat(thumbnails[2].style['--row-x']) - 112.7344) < 0.0001);
events.pointerover({target: {closest: () => thumbnails[0]}});
assert.ok(classes.has('is-expanded'));
events.pointerleave();
collapse();
assert.ok(!classes.has('is-expanded'));
// A later responsive size change must also update the collapsed positions.
thumbnails[0].width = '40px';
resize();
assert.equal(thumbnails[1].style['--row-x'], '48px');
console.log('PASS: lazy cover loading, fractional widths, expand/collapse, resizing');
