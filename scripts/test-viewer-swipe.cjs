// Exercise touch gestures against the actual viewer handler without a browser.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const code = source.slice(source.indexOf('    function enableSwipeNavigation('), source.indexOf('    enableSwipeNavigation(rail, navigate);'));
const touch = (x, y = 100, identifier = 1) => ({ clientX: x, clientY: y, identifier });
function setup() {
    const events = {}, directions = [];
    const surface = { clientWidth: 318, addEventListener(name, fn) { events[name] = fn; } };
    const ctx = vm.createContext({ Date });
    vm.runInContext(code, ctx);
    ctx.enableSwipeNavigation(surface, direction => directions.push(direction));
    function emit(type, touches, changedTouches = [], interactive = false) {
        const event = { touches, changedTouches, target: { closest: () => interactive }, cancelable: true,
            preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
        events[type](event);
        return event;
    }
    return { directions, emit };
}
for (const [end, expected] of [[140, 1], [260, -1]]) {
    const test = setup();
    test.emit('touchstart', [touch(200)]);
    assert.equal(test.emit('touchmove', [touch(end)]).prevented, true);
    test.emit('touchend', [], [touch(end)]);
    assert.deepEqual(test.directions, [expected]);
    const click = test.emit('click', []);
    assert.ok(click.prevented && click.stopped, 'swipe must not also activate a neighboring card');
}
const vertical = setup();
vertical.emit('touchstart', [touch(200)]);
assert.equal(vertical.emit('touchmove', [touch(195, 150)]).prevented, undefined);
vertical.emit('touchend', [], [touch(100, 180)]);
assert.deepEqual(vertical.directions, [], 'vertical gesture remains vertical');
const tap = setup();
tap.emit('touchstart', [touch(200)]);
tap.emit('touchend', [], [touch(195)]);
assert.deepEqual(tap.directions, []);
assert.equal(tap.emit('click', []).prevented, undefined);
for (const mode of ['pinch', 'cancel', 'interactive', 'different-finger']) {
    const test = setup();
    test.emit('touchstart', [touch(200)], [], mode === 'interactive');
    if (mode === 'pinch') test.emit('touchmove', [touch(140), touch(260, 100, 2)]);
    if (mode === 'cancel') test.emit('touchcancel', []);
    test.emit('touchend', [], [touch(100, 100, mode === 'different-finger' ? 2 : 1)]);
    assert.deepEqual(test.directions, [], mode);
}
console.log('PASS: left/right swipes, mobile threshold, vertical scroll, taps, pinch, cancellation, controls, and click suppression');
