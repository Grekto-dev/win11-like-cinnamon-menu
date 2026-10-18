'use strict';

// Gtk.RecentManager supplies the complete, in-memory history. Only the idle
// refresh path enumerates it; callers (menu open/search) consume a snapshot.
var RecentFilesCache = class RecentFilesCache {
    constructor(options) {
        this._options = options;
        this._files = [];
        this._idleId = 0;
        this._generation = 0;
        this._cancellable = null;
        this._destroyed = false;
    }

    getFiles() {
        return !this._destroyed && this._options.enabled() ? this._files.slice() : [];
    }

    refresh() {
        if (this._destroyed) return;
        const generation = ++this._generation;
        if (this._idleId) this._options.unschedule(this._idleId);
        this._idleId = 0;
        if (this._cancellable) this._cancellable.cancel();
        this._cancellable = null;
        this._files = [];
        this._options.onChanged();
        if (!this._options.enabled()) return;
        this._idleId = this._options.schedule(() => {
            this._idleId = 0;
            if (generation === this._generation && this._options.enabled()) this._load(generation);
            return false;
        });
    }

    destroy() {
        this._destroyed = true;
        this._generation++;
        if (this._idleId) this._options.unschedule(this._idleId);
        this._idleId = 0;
        if (this._cancellable) this._cancellable.cancel();
        this._cancellable = null;
        this._files = [];
    }

    _load(generation) {
        const options = this._options;
        const Gio = options.Gio;
        const cancellable = this._cancellable = new Gio.Cancellable();
        const isCurrent = () => !this._destroyed && generation === this._generation && options.enabled();
        const recordsByUri = new Map();
        let history;
        try { history = options.manager.get_items(); } catch (e) {
            this._cancellable = null;
            return;
        }
        for (const record of history) {
            try {
                if (record.get_private_hint()) continue;
                const uri = record.get_uri();
                const file = Gio.File.new_for_uri(uri);
                const path = file.get_path();
                const name = record.get_display_name();
                const mtime = Number(record.get_modified());
                // Recent files must not auto-connect network backends or request credentials.
                if (!path || !name || name.startsWith('.') || !Number.isFinite(mtime) || mtime <= 0 ||
                    path.split('/').some(part => part.startsWith('.'))) continue;
                if (!recordsByUri.has(uri) || recordsByUri.get(uri).mtime < mtime) {
                    const doc = {name, uri, uriDecoded: path || uri, mtime,
                        mimeType: record.get_mime_type(), gicon: record.get_gicon()};
                    doc.createIcon = size => options.createIcon(doc.gicon, size);
                    recordsByUri.set(uri, {doc, file, mtime});
                }
            } catch (e) { /* Malformed records must not prevent other history. */ }
        }
        const records = Array.from(recordsByUri.values());
        const results = [];
        let cursor = 0, active = 0;
        const pump = () => {
            if (!isCurrent()) return;
            while (active < 8 && cursor < records.length) {
                const {doc, file} = records[cursor++];
                active++;
                try { file.query_info_async('standard::type,standard::is-hidden,access::can-read',
                    Gio.FileQueryInfoFlags.NONE, options.priority, cancellable, (source, result) => {
                        try {
                            const info = source.query_info_finish(result);
                            if (isCurrent() && !info.get_is_hidden() && (!info.has_attribute('access::can-read') ||
                                info.get_attribute_boolean('access::can-read'))) results.push(doc);
                        } catch (e) { /* Missing or inaccessible file. */ }
                        active--;
                        pump();
                    });
                } catch (e) { active--; }
            }
            if (cursor === records.length && active === 0) {
                this._cancellable = null;
                this._files = results.sort((a, b) => b.mtime - a.mtime);
                options.onChanged();
            }
        };
        pump();
    }
};

if (typeof module !== 'undefined') module.exports = {RecentFilesCache};
