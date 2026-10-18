/* Persistent, lazy JSONL transport for the file-search worker. */
// GI is intentionally not loaded in Node; tests inject it at the VM boundary.
const Gio = typeof imports !== 'undefined' ? imports.gi.Gio : null;
const GLib = typeof imports !== 'undefined' ? imports.gi.GLib : null;
const Mainloop = typeof imports !== 'undefined' ? imports.mainloop : null;
const ByteArray = typeof imports !== 'undefined' ? imports.byteArray : null;
const MAX_LINE_BYTES = 512 * 1024;
const READ_CHUNK_BYTES = 4096;

var FileSearchClient = class FileSearchClient {
    constructor({scriptPath, databasePath, roots = [], onEvent} = {}) {
        this._scriptPath = scriptPath;
        this._databasePath = databasePath;
        this._roots = roots.slice();
        this._onEvent = onEvent;
        this._session = null;
        this._activeId = null;
        this._destroyed = false;
    }

    search(id, query, limit = 80) {
        if (this._destroyed || !Number.isSafeInteger(id) || typeof query !== 'string') return;
        query = query.slice(0, 1024);
        // Do not create a lone surrogate when truncating an emoji filename.
        if (/[\uD800-\uDBFF]$/.test(query)) query = query.slice(0, -1);
        if (!query.trim()) { this.cancel(this._activeId); return; }
        if (this._session && this._session.lastWireId === Number.MAX_SAFE_INTEGER) {
            const old = this._session;
            this._session = null;
            old.stopped = true;
            old.pending = null;
            old.cancel.cancel();
            this._kill(old);
        }
        limit = Number.isFinite(limit) ? Math.max(1, Math.min(80, Math.floor(limit))) : 80;
        this._activeId = id;
        this._reportedError = false;
        this._resultLimit = limit;
        this._resultCount = 0;
        this._truncated = false;
        if (!this._session) {
            try {
                if (typeof this._scriptPath !== 'string' || !this._scriptPath || this._scriptPath.includes('\u0000'))
                    throw new Error('Missing worker path');
                const argv = ['/usr/bin/python3', '-u', this._scriptPath];
                if (this._databasePath) argv.push('--database', this._databasePath);
                for (const root of this._roots) argv.push('--root', root);
                const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDIN_PIPE |
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
                this._session = {process, cancel: new Gio.Cancellable(),
                    frame: new Uint8Array(MAX_LINE_BYTES + 1), frameLength: 0,
                    chunk: null, offset: 0};
                this._session.input = process.get_stdin_pipe();
                this._session.output = process.get_stdout_pipe();
                this._read(this._session);
            } catch (_) {
                if (this._session) this._fail(this._session, 'Unable to start file search worker.');
                else this._error('Unable to start file search worker.');
            }
        }
        if (this._session) {
            // Callers may reuse ids; each query still needs a distinct wire id.
            const previous = this._session.lastWireId;
            this._wireId = previous === undefined ? id : Math.max(id, previous + 1);
            this._session.lastWireId = this._wireId;
            this._queue(this._session, {op: 'search', id: this._wireId, query, limit});
        }
    }

    cancel(id) {
        if (this._destroyed || id !== this._activeId) return;
        this._activeId = null;
        const session = this._session;
        if (!session) return;
        this._queue(session, {op: 'cancel', id: session.sentId});
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._activeId = null;
        this._onEvent = null;
        const session = this._session;
        this._session = null;
        if (!session) return;
        session.stopped = true;
        session.teardown = true;
        session.pending = null;
        session.cancel.cancel();
        session.killTimer = Mainloop.timeout_add(500, () => {
            session.killTimer = 0;
            this._kill(session);
            return false;
        });
        try {
            session.process.wait_async(null, (process, result) => {
                try { process.wait_finish(result); }
                catch (_) { this._kill(session); return; }
                session.exited = true;
                this._clearKillTimer(session);
                if (session.shutdownCancel) session.shutdownCancel.cancel();
                this._close(session.input);
                this._close(session.output);
            });
        } catch (_) { this._kill(session); }
        if (!session.writing) this._shutdown(session);
    }

    _clearKillTimer(session) {
        if (!session.killTimer) return;
        Mainloop.source_remove(session.killTimer);
        session.killTimer = 0;
    }

    _kill(session) {
        if (session.killed || session.exited) return;
        session.killed = true;
        this._clearKillTimer(session);
        if (session.shutdownCancel) session.shutdownCancel.cancel();
        try { session.process.force_exit(); } catch (_) { /* Process may have exited. */ }
        this._close(session.input);
        this._close(session.output);
    }

    _shutdown(session) {
        if (session.shutdownSent || session.killed || session.exited) return;
        session.shutdownSent = true;
        session.shutdownCancel = new Gio.Cancellable();
        const bytes = ByteArray.fromString('{"op":"shutdown"}\n');
        try {
            session.input.write_all_async(bytes, GLib.PRIORITY_DEFAULT, session.shutdownCancel,
                (stream, result) => {
                    try { stream.write_all_finish(result); }
                    catch (_) { this._kill(session); return; }
                    this._close(stream);
                });
        } catch (_) { this._kill(session); }
    }

    _queue(session, command) {
        session.pending = command;
        if (!session.writing) this._write(session);
    }

    _write(session) {
        if (!this._isCurrent(session) || !session.pending) return;
        if (session.pending.op === 'search') session.sentId = session.pending.id;
        const bytes = ByteArray.fromString(JSON.stringify(session.pending) + '\n');
        session.pending = null;
        session.writing = true;
        try {
            session.input.write_all_async(bytes, GLib.PRIORITY_DEFAULT, session.cancel, (stream, result) => {
                let failed = false;
                try { stream.write_all_finish(result); }
                catch (_) { failed = true; }
                session.writing = false;
                if (session.teardown) { this._shutdown(session); return; }
                if (failed) { this._fail(session, 'Unable to write to file search worker.'); return; }
                if (this._isCurrent(session)) this._write(session);
            });
        } catch (_) { this._fail(session, 'Unable to write to file search worker.'); }
    }

    _emit(event) {
        if (this._destroyed || this._activeId === null || !this._onEvent) return;
        try { this._onEvent(event); } catch (_) { /* Never unwind into Cinnamon. */ }
    }

    _error(message) {
        if (this._reportedError || this._activeId === null) return;
        this._reportedError = true;
        this._emit({type: 'error', id: this._activeId, message: message.slice(0, 256)});
    }

    _handleEvent(event) {
        if (!event || Array.isArray(event) || !Number.isSafeInteger(event.id)) {
            this._error('Invalid file search worker response.');
            return;
        }
        if (this._activeId === null || event.id !== this._wireId) return;
        const id = this._activeId;
        if (event.type === 'results' && Array.isArray(event.items)) {
            const items = [];
            for (const item of event.items) {
                if (!item || typeof item.path !== 'string' || item.path[0] !== '/' ||
                    item.path.includes('\u0000') || typeof item.name !== 'string' ||
                    item.name.includes('\u0000') || typeof item.is_dir !== 'boolean') continue;
                if (this._resultCount >= this._resultLimit) { this._truncated = true; break; }
                items.push({path: item.path, name: item.name, is_dir: item.is_dir});
                this._resultCount++;
            }
            this._emit({type: 'results', id, items});
        } else if (event.type === 'status' && typeof event.indexing === 'boolean' &&
            Number.isSafeInteger(event.scanned) && event.scanned >= 0) {
            this._emit({type: 'status', id, indexing: event.indexing, scanned: event.scanned});
        } else if (event.type === 'done' && typeof event.indexing === 'boolean' &&
            typeof event.truncated === 'boolean') {
            this._emit({type: 'done', id, indexing: event.indexing,
                truncated: event.truncated || this._truncated});
        } else if (event.type === 'error' && typeof event.message === 'string') {
            this._error(event.message);
        } else {
            this._error('Invalid file search worker response.');
        }
    }

    _isCurrent(session) {
        return !this._destroyed && this._session === session && !session.stopped;
    }

    _close(stream) {
        if (!stream) return;
        try {
            stream.close_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
                try { source.close_finish(result); } catch (_) { /* Best effort cleanup. */ }
            });
        } catch (_) { /* It may already be closing. */ }
    }

    _fail(session, message) {
        if (!this._isCurrent(session)) return;
        this._session = null;
        session.stopped = true;
        session.pending = null;
        session.cancel.cancel();
        try { session.process.force_exit(); } catch (_) { /* Process may have exited. */ }
        this._close(session.input);
        this._close(session.output);
        this._error(message);
    }

    // DataInputStream.read_line_async on the live pipe has no size limit.
    // Frame bounded byte chunks first, then use GIO's UTF8 line decoder on a
    // bounded memory stream. A missing newline cannot grow shell memory forever.
    _read(session) {
        if (!this._isCurrent(session)) return;
        try {
            session.output.read_bytes_async(READ_CHUNK_BYTES, GLib.PRIORITY_DEFAULT,
                session.cancel, (stream, result) => {
                    let chunk;
                    try { chunk = stream.read_bytes_finish(result).get_data(); }
                    catch (_) { this._fail(session, 'Unable to read file search worker response.'); return; }
                    if (!this._isCurrent(session)) return;
                    if (!chunk.length) { this._fail(session, 'File search worker disconnected.'); return; }
                    session.chunk = chunk;
                    session.offset = 0;
                    this._consume(session);
                });
        } catch (_) { this._fail(session, 'Unable to read file search worker response.'); }
    }

    _consume(session) {
        if (!this._isCurrent(session)) return;
        const chunk = session.chunk;
        let end = session.offset;
        while (end < chunk.length && chunk[end] !== 10) end++;
        const size = end - session.offset;
        if (session.frameLength + size > MAX_LINE_BYTES) {
            this._fail(session, 'File search worker response exceeded the line limit.');
            return;
        }
        session.frame.set(chunk.subarray(session.offset, end), session.frameLength);
        session.frameLength += size;
        session.offset = end;
        if (end === chunk.length) {
            session.chunk = null;
            this._read(session);
            return;
        }
        session.offset++;
        session.frame[session.frameLength] = 10;
        try {
            const bytes = new GLib.Bytes(session.frame.subarray(0, session.frameLength + 1));
            const memory = Gio.MemoryInputStream.new_from_bytes(bytes);
            const decoder = new Gio.DataInputStream({base_stream: memory});
            session.decoder = decoder;
            session.frameLength = 0;
            decoder.read_line_async(GLib.PRIORITY_DEFAULT, session.cancel, (stream, result) => {
                let line;
                let valid = true;
                try { [line] = stream.read_line_finish_utf8(result); }
                catch (_) { valid = false; }
                session.decoder = null;
                this._close(stream);
                if (!this._isCurrent(session)) return;
                if (valid) {
                    try { this._handleEvent(JSON.parse(line)); }
                    catch (_) { this._error('Invalid file search worker response.'); }
                } else this._error('Invalid UTF8 file search worker response.');
                this._consume(session);
            });
        } catch (_) { this._fail(session, 'Unable to decode file search worker response.'); }
    }
};

if (typeof module !== 'undefined') module.exports = {FileSearchClient};
