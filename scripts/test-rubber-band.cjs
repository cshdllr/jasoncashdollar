// Run with node scripts/test-rubber-band.cjs. Exercises real gallery code with
// a deterministic wheel clock so momentum cannot hide timing regressions.
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const code = source.slice(source.indexOf('    function enableRubberBand('), source.indexOf('    function enableThumbnailStack('));
function setup({reduced = false, collapsed = false} = {}) {
    let now = 0, id = 0;
    const timers = new Map(), events = {}, globalEvents = {}, animations = [];
    const timer = (fn, delay) => { timers.set(++id, {at: now + delay, fn}); return id; };
    const classes = new Set();
    const strip = {
        scrollLeft: 400, scrollWidth: 960, clientWidth: 560,
        parentElement: {matches: () => collapsed},
        style: {removeProperty(name) { delete this[name]; }},
        classList: {add: n => classes.add(n), remove: n => classes.delete(n)},
        addEventListener: (name, fn) => events[name] = fn,
        animate(frames, options) {
            let done, reject;
            const animation = {frames, options, started: now, canceled: false,
                finished: new Promise((resolve, fail) => { done = resolve; reject = fail; }),
                cancel() { this.canceled = true; timers.delete(finish); reject(); }};
            const finish = timer(done, options.duration);
            animations.push(animation);
            return animation;
        }
    };
    const ctx = vm.createContext({setTimeout: timer, clearTimeout: id => timers.delete(id),
        desktopStacks: {matches: true}, reducedMotion: {matches: reduced, addEventListener() {}},
        window: {addEventListener: (name, fn) => globalEvents[name] = fn}});
    vm.runInContext(code, ctx);ctx.enableRubberBand(strip);
    return {strip, animations, classes,
        wheel(delta, extra = {}) { const e = {deltaX: delta, deltaY: 0, deltaMode: 0, cancelable: true, preventDefault() { this.prevented = true; }, ...extra};events.wheel(e);return e; },
        reset() { globalEvents.blur(); },
        async advance(ms) {
            const end = now + ms;
            while (true) {
                const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;timers.delete(next[0]);next[1].fn();await Promise.resolve();
            }
            now = end;await Promise.resolve();
        }
    };
}
(async () => {
    const idle = setup();idle.wheel(80);assert.ok(idle.strip.style.translate);await idle.advance(411);
    assert.equal(idle.animations.length, 1);assert.equal(idle.animations[0].started, 70);
    assert.equal(idle.strip.style.translate, undefined);assert.ok(idle.animations[0].canceled);
    const tail = setup();
    for (let i = 0; i < 100; i++) { tail.wheel(2); await tail.advance(16); }
    assert.equal(tail.animations.length, 1, 'outward momentum must not restart or postpone return');
    assert.equal(tail.strip.style.translate, undefined);
    tail.wheel(-24);assert.equal(tail.strip.scrollLeft, 376, 'reverse scroll responds immediately');
    const left = setup();left.strip.scrollLeft=0;left.wheel(-100);await left.advance(411);
    assert.equal(left.strip.style.translate, undefined);assert.equal(left.strip.scrollLeft, 0);
    const shifted = setup();shifted.wheel(0, {deltaY:100,shiftKey:true});await shifted.advance(411);
    assert.equal(shifted.animations.length,1);
    const still = setup({reduced:true});still.wheel(100);await still.advance(500);assert.equal(still.animations.length,0);
    const vertical = setup();assert.equal(vertical.wheel(0,{deltaY:100}).prevented, undefined);
    const stack = setup({collapsed:true});assert.equal(stack.wheel(100).prevented, undefined);
    const interrupted = setup();interrupted.wheel(100);await interrupted.advance(100);interrupted.reset();await interrupted.advance(500);
    assert.equal(interrupted.strip.style.translate,undefined);assert.equal(interrupted.classes.size,0);
    console.log('PASS: stationary pointer, sustained momentum, both edges, reversal, Shift-wheel, reduced motion, vertical scrolling, collapsed stacks, interruption');
})().catch(error => { console.error(error);process.exitCode=1; });
