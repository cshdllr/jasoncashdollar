const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../previews.js'), 'utf8');
const code = source.slice(source.indexOf('    function createPreviewPermalinks('), source.indexOf('    function enableRubberBand('));
const data = readFileSync(join(__dirname, '../data/previews.js'), 'utf8');
const projects = JSON.parse(data.slice(data.indexOf(' = ') + 3).trim().replace(/;$/, ''));
const entries = projects.flatMap(project => project.items.map(item => ({project, item})));
function setup(hash = '', initialEntries = entries) {
    const events = {}, history = [{url: '/index.html?test=1' + hash, state: {existing: true}}];
    let position = 0, opened = false, current = -1, closing = false, router;
    const location = {pathname: '/index.html', search: '?test=1', hash};
    const setURL = url => { location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; };
    const travel = direction => {
        position += direction;
        setURL(history[position].url);
        events.popstate();
        events.hashchange();
    };
    const browser = {location, addEventListener(name, fn) { events[name] = fn; }, history: {
        get state() { return history[position].state; },
        pushState(state, _, url) { history.splice(++position); history.push({state, url}); setURL(url); },
        replaceState(state, _, url) { history[position] = {state, url}; setURL(url); },
        back() { travel(-1); }
    }};
    const viewer = {
        isOpen: () => opened, isClosing: () => closing, current: () => current,
        open(index) { opened = true; closing = false; current = index; router.open(index); },
        show(index) { current = index; closing = false; router.update(index); },
        close() { closing = true; router.close(); opened = false; }
    };
    const context = vm.createContext({});
    vm.runInContext(code, context);
    router = context.createPreviewPermalinks(initialEntries, viewer, browser);
    return {router, viewer, history, location, browser, travel,
        paste(hash) { location.hash = hash; events.hashchange(); },
        get current() { return current; }, get opened() { return opened; }};
}
const first = setup('#work');
first.router.sync();
assert.equal(first.opened, false, 'ordinary anchors leave the viewer closed');
first.viewer.open(0);
const firstHash = first.location.hash;
assert.equal(first.history.length, 2);
assert.equal(first.browser.history.state.existing, true);
first.viewer.show(1);
assert.equal(first.history.length, 2, 'browsing media does not flood history');
const secondHash = first.location.hash;
assert.notEqual(firstHash, secondHash);
assert.ok(first.history[1].url.startsWith('/index.html?test=1#'));
first.travel(-1);
assert.equal(first.opened, false, 'Back closes the viewer');
assert.equal(first.location.hash, '#work');
first.travel(1);
assert.equal(first.opened, true, 'Forward reopens the current media');
assert.equal(first.current, 1);
first.viewer.close();
assert.equal(first.location.hash, '#work', 'explicit close returns to the original anchor');
const direct = setup(secondHash);
direct.router.sync();
assert.equal(direct.current, 1);
assert.equal(direct.history.length, 1, 'deep links do not add a history entry');
direct.viewer.close();
assert.equal(direct.location.hash, '', 'closing a direct link stays on this page');
direct.paste(firstHash);
assert.equal(direct.current, 0);
direct.paste('#%not-valid');
assert.equal(direct.opened, false, 'malformed fragments do not throw');
const reordered = setup(firstHash, [...entries].reverse());
reordered.router.sync();
assert.equal(reordered.current, entries.length - 1, 'permalinks survive media reordering');
const all = setup();
const hashes = entries.map((_, i) => { all.viewer.show(i); return all.location.hash; });
assert.equal(new Set(hashes).size, entries.length, 'all current media have unique links');
const book = entries.findIndex(({item}) => item.type === 'book');
const bookLink = setup(hashes[book]);
bookLink.router.sync();
assert.equal(bookLink.current, book, 'encoded book titles round-trip');
console.log('PASS: deep links, URL updates, Back/Forward, close, query strings, malformed anchors, stable IDs, and book links');
