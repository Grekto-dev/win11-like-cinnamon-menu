'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the actual GJS module. Only the GI/event-loop boundary is simulated;
// no desktop, applet configuration, worker database or user files are touched.
function harness(options = {}) {
    const tasks = [];
    const timers = new Map();
    const processes = [];
    const events = [];
    let timerId = 0;
    let spawnFailure = null;
    const later = fn => tasks.push(fn);
    class Cancellable {
        constructor() { this.cancelled = false; }
        cancel() { this.cancelled = true; }
    }
    class Stream {
        constructor() {
            this.reads = [];
            this.chunks = [];
            this.readSizes = [];
            this.writes = [];
            this.pendingWrites = [];
            this.closed = false;
            this.maxPendingWrites = 0;
        }
        read_line_async(priority, cancellable, cb) {
            this.reads.push({cancellable, cb});
        }
        read_line_finish_utf8(result) {
            if (result.error) throw result.error;
            return [result.line, result.line === null ? 0 : Buffer.byteLength(result.line)];
        }
        send(line) {
            assert.equal(this.reads.length, 1, 'exactly one outstanding stdout read');
            if (this.reads[0].count) {
                const text = typeof line === 'object' && line !== null ? JSON.stringify(line) : line;
                this.sendRaw(line === null ? null : Buffer.from(text + '\n'));
                return;
            }
            const {cb} = this.reads.shift();
            later(() => cb(this, {line: typeof line === 'object' && line !== null ? JSON.stringify(line) : line}));
        }
        read_bytes_async(count, priority, cancellable, cb) {
            this.readSizes.push(count);
            this.reads.push({count, cancellable, cb});
            this.pump();
        }
        read_bytes_finish(result) {
            if (result.error) throw result.error;
            return {get_data: () => result.bytes};
        }
        sendRaw(bytes) { this.chunks.push(bytes); this.pump(); }
        pump() {
            if (!this.reads.length || !this.chunks.length) return;
            const {count, cb} = this.reads.shift();
            let bytes = this.chunks.shift();
            if (bytes && bytes.length > count) {
                this.chunks.unshift(bytes.subarray(count));
                bytes = bytes.subarray(0, count);
            }
            later(() => cb(this, {bytes: bytes || new Uint8Array()}));
        }
        failRead() {
            const {cb} = this.reads.shift();
            later(() => cb(this, {error: new Error('private read detail')}));
        }
        write_all_async(bytes, priority, cancellable, cb) {
            this.writes.push(Buffer.from(bytes).toString('utf8'));
            this.pendingWrites.push({bytes, cancellable, cb});
            this.maxPendingWrites = Math.max(this.maxPendingWrites, this.pendingWrites.length);
        }
        write_all_finish(result) {
            if (result.error) throw result.error;
            return [true, result.length];
        }
        completeWrite(error = null) {
            assert.ok(this.pendingWrites.length, 'a write must be pending');
            const {bytes, cb} = this.pendingWrites.shift();
            later(() => cb(this, {error, length: bytes.length}));
        }
        close_async(priority, cancellable, cb) {
            this.closed = true;
            if (cb) later(() => cb(this, {}));
        }
        close_finish() { return true; }
    }
    class Process {
        constructor(argv, flags) {
            this.argv = argv;
            this.flags = flags;
            this.stdin = new Stream();
            this.stdout = new Stream();
            this.forceExits = 0;
            this.waiters = [];
        }
        get_stdin_pipe() { return this.stdin; }
        get_stdout_pipe() { return this.stdout; }
        force_exit() { this.forceExits++; }
        wait_async(cancellable, cb) { this.waiters.push(cb); }
        wait_finish(result) { if (result.error) throw result.error; return true; }
        exit() { for (const cb of this.waiters.splice(0)) later(() => cb(this, {})); }
    }
    const decodedSizes = [];
    const Gio = {
        Cancellable,
        MemoryInputStream: {new_from_bytes(bytes) { return {bytes: bytes.data}; }},
        SubprocessFlags: {STDIN_PIPE: 1, STDOUT_PIPE: 4, STDERR_SILENCE: 32},
        Subprocess: {new(argv, flags) {
            if (spawnFailure) throw spawnFailure;
            const child = new Process(argv, flags);
            processes.push(child);
            return child;
        }},
        DataInputStream: class extends Stream {
            constructor({base_stream}) {
                super();
                if (!base_stream.bytes) return base_stream;
                this.bytes = base_stream.bytes;
            }
            read_line_async(priority, cancellable, cb) {
                decodedSizes.push(this.bytes.length);
                later(() => cb(this, {bytes: this.bytes}));
            }
            read_line_finish_utf8(result) {
                const text = new TextDecoder('utf-8', {fatal: true}).decode(result.bytes);
                return [text.replace(/\n$/, ''), result.bytes.length - 1];
            }
        },
    };
    const Mainloop = {
        timeout_add(ms, fn) { const id = ++timerId; timers.set(id, fn); return id; },
        source_remove(id) { timers.delete(id); },
    };
    const context = vm.createContext({
        imports: {gi: {Gio, GLib: {PRIORITY_DEFAULT: 0, Bytes: class {
            constructor(data) { this.data = Uint8Array.from(data); }
        }}}, mainloop: Mainloop,
            byteArray: {fromString: s => Uint8Array.from(Buffer.from(s))}},
        module: {exports: {}},
    });
    const filename = path.join(__dirname, '..', 'fileSearchClient.js');
    if (fs.existsSync(filename)) vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
    const Client = context.FileSearchClient;
    assert.equal(typeof Client, 'function', 'exports the GJS FileSearchClient class');
    assert.equal(context.module.exports.FileSearchClient, Client, 'also exports for Node');
    const client = new Client({scriptPath: '/tmp/worker with \' quotes.py',
        databasePath: '/tmp/a db;$(no).sqlite', roots: ['/tmp/a b', '/tmp/$(no)'],
        onEvent: event => events.push(JSON.parse(JSON.stringify(event))), ...options});
    return {
        client, events, processes, timers, decodedSizes,
        flush() { let n = 0; while (tasks.length) { assert.ok(++n < 1000, 'no busy loop'); tasks.shift()(); } },
        tick() { for (const [id, fn] of [...timers]) { timers.delete(id); if (fn()) timers.set(id, fn); } },
        spawnFailure(error) { spawnFailure = error; },
    };
}

function commands(child) { return child.stdin.writes.map(line => JSON.parse(line)); }

test('query truncation never splits a UTF16 surrogate pair at the protocol boundary', () => {
    const h = harness();
    h.client.search(1, 'x'.repeat(1023) + '📁tail');
    assert.equal(commands(h.processes[0])[0].query, 'x'.repeat(1023));
});

test('the module can also be required by Node without a global imports object', () => {
    const filename = path.join(__dirname, '..', 'fileSearchClient.js');
    assert.doesNotThrow(() => {
        const {FileSearchClient} = require(filename);
        assert.equal(typeof FileSearchClient, 'function');
        const client = new FileSearchClient({scriptPath: '/unused'});
        client.destroy();
    });
});

test('forwards live UTF8 results and status before done', () => {
    const h = harness();
    h.client.search(7, 'résumé');
    const child = h.processes[0];
    child.stdout.send({type: 'results', id: 7, items: [
        {path: '/home/Δ/résumé', name: 'résumé', is_dir: false},
    ]}); h.flush();
    assert.deepEqual(h.events, [{type: 'results', id: 7, items: [
        {path: '/home/Δ/résumé', name: 'résumé', is_dir: false},
    ]}]);
    child.stdout.send({type: 'status', id: 7, indexing: true, scanned: 12}); h.flush();
    assert.equal(h.events.at(-1).type, 'status');
    child.stdout.send({type: 'done', id: 7, truncated: true, indexing: true}); h.flush();
    assert.deepEqual(h.events.at(-1), {type: 'done', id: 7, truncated: true, indexing: true});
});

test('an empty replacement revokes prior results without starting another worker', () => {
    const h = harness();
    h.client.search(1, 'old');
    const child = h.processes[0];
    h.client.search(2, '  ');
    child.stdout.send({type: 'results', id: 1, items: []}); h.flush();
    assert.deepEqual(h.events, []);
    child.stdin.completeWrite(); h.flush();
    assert.deepEqual(commands(child).at(-1), {op: 'cancel', id: 1});
    assert.equal(h.processes.length, 1);
});

test('wire generations cannot overflow the JSON safe-integer protocol', () => {
    const h = harness();
    h.client.search(Number.MAX_SAFE_INTEGER, 'old');
    const old = h.processes[0];
    h.client.search(1, 'new');
    assert.equal(h.processes.length, 2, 'generation rollover starts a fresh isolated session');
    assert.equal(old.forceExits, 1);
    assert.equal(commands(h.processes[1])[0].id, 1);
    assert.deepEqual(h.events, []);
});

test('reusing caller ids cannot resurrect responses from a previous query generation', () => {
    const h = harness();
    h.client.search(5, 'old');
    const child = h.processes[0];
    child.stdin.completeWrite(); h.flush();
    h.client.cancel(5);
    child.stdin.completeWrite(); h.flush();
    h.client.search(5, 'new');
    const wireId = commands(child).at(-1).id;
    assert.notEqual(wireId, 5, 'same public id receives a fresh protocol generation');
    child.stdout.send({type: 'results', id: 5, items: []}); h.flush();
    assert.deepEqual(h.events, []);
    child.stdout.send({type: 'results', id: wireId, items: []}); h.flush();
    assert.deepEqual(h.events, [{type: 'results', id: 5, items: []}], 'public id is preserved');
});

test('cancelling an unsent query cancels the actual in-flight worker query and drops pending work', () => {
    const h = harness();
    h.client.search(1, 'running');
    const child = h.processes[0];
    h.client.search(2, 'not sent');
    h.client.cancel(2);
    child.stdin.completeWrite(); h.flush();
    assert.deepEqual(commands(child), [{op: 'search', id: 1, query: 'running', limit: 80}, {op: 'cancel', id: 1}]);
});

test('stdout framing is bounded before line decoding, even without a newline', () => {
    const h = harness();
    h.client.search(1, 'x');
    const child = h.processes[0];
    assert.ok(child.stdout.readSizes.length > 0, 'reads bounded byte chunks, not an unbounded pipe line');
    child.stdout.sendRaw(Buffer.alloc(600 * 1024, 120)); h.flush();
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].type, 'error');
    assert.equal(child.forceExits, 1);
    assert.equal(h.decodedSizes.length, 0, 'oversized lines never reach read_line_async');
    assert.ok(child.stdout.readSizes.every(size => size <= 4096));
});

test('bounded stdout framing preserves split UTF8 and multiple incremental lines in one chunk', () => {
    const h = harness();
    h.client.search(1, 'x');
    const child = h.processes[0];
    const first = Buffer.from(JSON.stringify({type: 'results', id: 1,
        items: [{path: '/résumé', name: 'résumé', is_dir: false}]}) + '\n');
    const split = first.indexOf(Buffer.from('é')) + 1;
    child.stdout.sendRaw(first.subarray(0, split)); h.flush();
    assert.deepEqual(h.events, []);
    child.stdout.sendRaw(Buffer.concat([first.subarray(split),
        Buffer.from('{"type":"done","id":1,"indexing":false,"truncated":false}\n')])); h.flush();
    assert.equal(h.events[0].items[0].name, 'résumé');
    assert.deepEqual(h.events.map(e => e.type), ['results', 'done']);
    assert.equal(h.decodedSizes.length, 2, 'UTF8 is decoded using async DataInputStream finish');
    child.stdout.sendRaw(Buffer.from([0xff, 0x0a])); h.flush();
    assert.equal(h.events.at(-1).type, 'error');
    assert.equal(child.forceExits, 0, 'one bad UTF8 line is recoverable');
});

test('destroy is lazy and idempotent, drops pending delivery and schedules one bounded shutdown', () => {
    const idle = harness();
    idle.client.destroy(); idle.client.destroy(); idle.client.search(1, 'never');
    assert.equal(idle.processes.length, 0);
    assert.equal(idle.timers.size, 0);
    const h = harness();
    h.client.search(1, 'one');
    const child = h.processes[0];
    h.client.search(2, 'pending');
    child.stdout.send({type: 'results', id: 2, items: []});
    h.client.destroy(); h.client.destroy();
    assert.equal(child.stdin.pendingWrites[0].cancellable.cancelled, true);
    h.flush();
    assert.deepEqual(h.events, []);
    child.stdin.completeWrite(new Error('cancelled')); h.flush();
    assert.deepEqual(commands(child), [{op: 'search', id: 1, query: 'one', limit: 80}, {op: 'shutdown'}]);
    assert.equal(child.stdin.maxPendingWrites, 1);
    child.stdin.completeWrite(); h.flush();
    assert.equal(child.stdin.closed, true);
    child.exit(); h.flush();
    assert.equal(h.timers.size, 0, 'graceful exit removes fallback timer');
    h.tick();
    assert.equal(child.forceExits, 0);
    assert.deepEqual(h.events, []);
});

test('destroy kills an unresponsive worker once, even if writes and read completions arrive late', () => {
    const h = harness();
    h.client.search(1, 'x');
    const child = h.processes[0];
    h.client.destroy();
    assert.equal(h.timers.size, 1);
    h.tick(); h.tick();
    assert.equal(child.forceExits, 1);
    child.stdin.completeWrite(new Error('late cancelled'));
    child.stdout.failRead(); h.flush();
    assert.equal(commands(child).length, 1, 'cannot enqueue shutdown after the force exit');
    assert.deepEqual(h.events, []);
    assert.equal(h.timers.size, 0);
});

test('spawn failures and missing script configuration are bounded and retry only on a new search', () => {
    const h = harness();
    h.spawnFailure(new Error('private path /secret'));
    assert.doesNotThrow(() => h.client.search(1, 'x'));
    h.flush(); h.tick();
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].type, 'error');
    assert.ok(!h.events[0].message.includes('/secret'));
    h.spawnFailure(null);
    h.client.search(2, 'y');
    assert.equal(h.processes.length, 1);
    const missing = harness({scriptPath: ''});
    assert.doesNotThrow(() => missing.client.search(1, 'x'));
    assert.equal(missing.events[0].type, 'error');
    assert.equal(missing.processes.length, 0);
});

for (const failure of ['EOF', 'read', 'write']) {
    test(`${failure} failure detaches worker once, ignores late callbacks and permits explicit recovery`, () => {
        const h = harness();
        h.client.search(1, 'x');
        const old = h.processes[0];
        if (failure === 'EOF') old.stdout.send(null);
        if (failure === 'read') old.stdout.failRead();
        if (failure === 'write') old.stdin.completeWrite(new Error('private write detail'));
        assert.doesNotThrow(() => h.flush());
        assert.equal(h.events.length, 1);
        assert.equal(h.events[0].type, 'error');
        assert.equal(old.forceExits, 1);
        assert.equal(old.stdout.reads.length, failure === 'write' ? 1 : 0);
        h.client.search(2, 'next');
        const current = h.processes[1];
        if (old.stdin.pendingWrites.length) old.stdin.completeWrite(new Error('late failure'));
        if (old.stdout.reads.length) old.stdout.send({type: 'results', id: 2, items: []});
        h.flush();
        assert.equal(h.events.length, 1, 'old generation cannot report against a new request');
        current.stdout.send({type: 'results', id: 2, items: []}); h.flush();
        assert.equal(h.events.at(-1).type, 'results');
        assert.equal(old.forceExits, 1);
    });
}

test('malformed worker events are bounded errors; records are sanitized and capped across batches', () => {
    const h = harness();
    h.client.search(1, 'x');
    const child = h.processes[0];
    for (const line of ['not json', 'null', '[]', '{"type":"bogus","id":1}',
        '{"type":"status","id":1,"scanned":-3}', '{"type":"results","id":1,"items":{}}']) {
        child.stdout.send(line); h.flush();
    }
    assert.equal(h.events.filter(e => e.type === 'error').length, 1, 'one protocol diagnostic per search');
    assert.ok(h.events[0].message.length <= 256);
    const bad = [null, {}, {path: 'relative', name: 'bad', is_dir: false},
        {path: '/valid', name: 4, is_dir: false}, {path: '/valid', name: 'bad', is_dir: 'false'},
        {path: '/nul\u0000hidden', name: 'bad', is_dir: false},
        {path: '/valid', name: 'bad\u0000name', is_dir: false}];
    const valid = Array.from({length: 90}, (_, i) => ({path: `/a/${i}`, name: `entry${i}`,
        is_dir: i % 2 === 0, untrusted: 'drop'}));
    child.stdout.send({type: 'results', id: 1, items: bad.concat(valid.slice(0, 50))}); h.flush();
    child.stdout.send({type: 'results', id: 1, items: valid.slice(50)}); h.flush();
    const items = h.events.filter(e => e.type === 'results').flatMap(e => e.items);
    assert.equal(items.length, 80);
    assert.deepEqual(items[0], {path: '/a/0', name: 'entry0', is_dir: true});
    child.stdout.send({type: 'done', id: 1, indexing: false, truncated: false, unknown: 1}); h.flush();
    assert.deepEqual(h.events.at(-1), {type: 'done', id: 1, indexing: false, truncated: true});
});

test('consumer exceptions never escape or stop subsequent worker delivery', () => {
    const h = harness({onEvent() { throw new Error('consumer failure'); }});
    h.client.search(1, 'x');
    h.processes[0].stdout.send({type: 'results', id: 1, items: []});
    assert.doesNotThrow(() => h.flush());
    assert.equal(h.processes[0].stdout.reads.length, 1);
});

test('serializes async writes and coalesces a burst to only the latest bounded query', () => {
    const h = harness();
    h.client.search(1, 'first');
    const child = h.processes[0];
    for (let id = 2; id <= 1000; id++) h.client.search(id, 'é'.repeat(2000), 900);
    assert.equal(child.stdin.writes.length, 1, 'no parallel writes or unbounded write backlog');
    child.stdin.completeWrite(); h.flush();
    assert.equal(child.stdin.writes.length, 2, 'intermediate pending searches are replaced');
    assert.deepEqual(commands(child).at(-1), {op: 'search', id: 1000, query: 'é'.repeat(1024), limit: 80});
    assert.equal(child.stdin.maxPendingWrites, 1);
    assert.ok(Buffer.byteLength(child.stdin.writes.at(-1)) < 13000);
    child.stdin.completeWrite(); h.flush();
    h.client.search(1001, 'a', -4);
    assert.equal(commands(child).at(-1).limit, 1);
});

test('rejects invalid request values without spawning or serializing unsafe values', () => {
    const h = harness();
    for (const id of [null, undefined, '1', NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) h.client.search(id, 'x');
    h.client.search(1, {});
    assert.equal(h.processes.length, 0);
});

test('cancel and replacement suppress stale ids, including callbacks already queued', () => {
    const h = harness();
    h.client.search(1, 'one');
    const child = h.processes[0];
    child.stdin.completeWrite(); h.flush();
    child.stdout.send({type: 'results', id: 1, items: []});
    h.client.search(2, 'two');
    h.flush();
    assert.deepEqual(h.events, []);
    child.stdout.send({type: 'done', id: 1, indexing: false, truncated: false}); h.flush();
    assert.deepEqual(h.events, []);
    h.client.cancel(1); // A late cancel must not revoke the newer request.
    child.stdout.send({type: 'status', id: 2, indexing: true, scanned: 2}); h.flush();
    assert.equal(h.events.length, 1);
    child.stdout.send({type: 'results', id: 2, items: []});
    h.client.cancel(2); h.flush();
    assert.equal(h.events.length, 1);
    child.stdin.completeWrite(); h.flush();
    while (child.stdin.pendingWrites.length) { child.stdin.completeWrite(); h.flush(); }
    assert.ok(commands(child).some(command => command.op === 'cancel' && command.id === 2));
    h.client.search(3, 'three');
    child.stdout.send({type: 'results', id: 3, items: []}); h.flush();
    assert.equal(h.events.at(-1).id, 3);
});

test('construction and empty queries are lazy; first search uses literal argv and async stdin', () => {
    const h = harness();
    assert.equal(h.processes.length, 0);
    h.client.search(1, '');
    h.client.search(2, '   ');
    assert.equal(h.processes.length, 0);
    h.client.search(3, 'report');
    assert.equal(h.processes.length, 1);
    const child = h.processes[0];
    assert.deepEqual(Array.from(child.argv), ['/usr/bin/python3', '-u', '/tmp/worker with \' quotes.py',
        '--database', '/tmp/a db;$(no).sqlite', '--root', '/tmp/a b', '--root', '/tmp/$(no)']);
    assert.equal(child.flags, 1 | 4 | 32, 'stderr is silenced, not an unconsumed pipe');
    assert.deepEqual(commands(child), [{op: 'search', id: 3, query: 'report', limit: 80}]);
    assert.equal(child.stdin.pendingWrites.length, 1);
    child.stdin.completeWrite(); h.flush();
    h.client.search(4, 'next');
    assert.equal(h.processes.length, 1, 'worker is reused');
    assert.equal(commands(child).at(-1).query, 'next');
});
