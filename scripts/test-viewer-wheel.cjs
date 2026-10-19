// Exercise the actual trackpad handler with deterministic gesture timing.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const code = source.slice(source.indexOf('    function enableWheelNavigation('), source.indexOf('    enableWheelNavigation(dialog, navigate);'));
function setup() {
    let now = 0;
    const events = {}, directions = [];
    const context = vm.createContext({ Date: { now: () => now } });
    vm.runInContext(code, context);
    context.enableWheelNavigation({ clientWidth: 1000, addEventListener: (name, fn) => events[name] = fn }, direction => directions.push(direction));
    return {
        directions,
        close: () => events.close(),
        wheel(dx, dy = 0, options = {}, delay = 16) {
            now += delay;
            const event = { deltaX: dx, deltaY: dy, deltaMode: 0, cancelable: true,
                target: { closest: () => false }, preventDefault() { this.prevented = true; }, ...options };
            events.wheel(event);
            return event;
        }
    };
}
const swipe = setup();
assert.equal(swipe.wheel(20, 2).prevented, true);
assert.deepEqual(swipe.directions, [], 'small movements should not navigate');
swipe.wheel(35, 3);
for (let i = 0; i < 60; i++) swipe.wheel(10);
assert.deepEqual(swipe.directions, [1], 'a long momentum tail must not skip slides');
swipe.wheel(-60, 0, {}, 250);
assert.deepEqual(swipe.directions, [1, -1], 'a new gesture can go back');
swipe.close();
swipe.wheel(60);
assert.deepEqual(swipe.directions, [1, -1, 1], 'closing resets the gesture');
const repeated = setup();
repeated.wheel(60);
for (const delta of [40, 30, 20, 15, 10, 7, 5, 3, 2, 1, 1, 1]) repeated.wheel(delta);
assert.deepEqual(repeated.directions, [1], 'decaying inertia cannot advance again');
for (const delta of [4, 8, 15, 30, 35]) repeated.wheel(delta);
assert.deepEqual(repeated.directions, [1, 1], 'a new swipe can advance without a quiet gap');
for (const delta of [20, 15, 10, 7, 5, 3, 2, 1, 1, 1, 1, 1]) repeated.wheel(delta);
repeated.wheel(-60);
assert.deepEqual(repeated.directions, [1, 1, -1], 'a deliberate reversal unlocks during the tail');
const shortPause = setup(); shortPause.wheel(60); shortPause.wheel(60, 0, {}, 160);
assert.deepEqual(shortPause.directions, [1, 1], 'a short pause starts the next swipe');
const acceleration = setup();
for (const delta of [20, 35, 60, 100, 160]) acceleration.wheel(delta);
assert.deepEqual(acceleration.directions, [1], 'initial acceleration is still one swipe');
const vertical = setup();
assert.equal(vertical.wheel(2, 30).prevented, undefined);
vertical.wheel(80, 2);
assert.deepEqual(vertical.directions, [], 'vertical gestures stay vertical');
for (const options of [{ ctrlKey: true }, { metaKey: true }, { target: { closest: () => true } }]) {
    const ignored = setup();
    assert.equal(ignored.wheel(100, 0, options).prevented, undefined);
    assert.deepEqual(ignored.directions, []);
}
for (const [dx, dy, options] of [[0, 60, { shiftKey: true }], [4, 0, { deltaMode: 1 }], [1, 0, { deltaMode: 2 }]]) {
    const normalized = setup();
    normalized.wheel(dx, dy, options);
    assert.deepEqual(normalized.directions, [1]);
}
console.log('PASS: trackpad direction, threshold, momentum, new gestures, close reset, vertical scroll, pinch zoom, controls, and wheel units');
