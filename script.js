/** @typedef {{ startTime: number, endTime: number, caption: string }} Entry */
/** @typedef {{ column: number, entry: Entry }} ColEntry */
/** @typedef {{ time: number, captions: string[] }} EntryRow */

/** @type {{ name: string, entries: Entry[] }[]} */
let columns = [];

/**
 *
 * @param {number} time
 * @returns {string}
 */
function prettyTime(time) {
    const seconds = Math.floor((time / 1000) % 60);
    const mins = Math.floor((time / (1000 * 60)) % 60);
    const hours = Math.floor(time / (1000 * 60 * 60));
    return `${
        hours.toString().padStart(2, '0')
    }:${mins.toString().padStart(2, '0')}:${
        seconds.toString().padStart(2, '0')
    }`;
}

/**
 * @returns {ColEntry[]}
 */
function entriesByTime() {
    const allEntries = columns
        .flatMap((col, idx) => col.entries.map(entry => ({ column: idx, entry })));
    allEntries.sort((a, b) => a.entry.startTime - b.entry.startTime);
    return allEntries;
}

/**
 * @param {Map<number, Entry>} current
 * @returns {EntryRow}
 */
function makeEntryRow(current) {
    let captions = [];
    for(let idx = 0; idx < columns.length; idx += 1) {
        const entry = current.get(idx);
        captions.push(entry === undefined ? '' : entry.caption);
    }

    return {
        time: Array.from(current.values())
            .reduce((p, c) => Math.min(p, c.startTime), Number.MAX_VALUE),
        captions
    };
}

/**
 *
 * @param {IterableIterator<ColEntry>} orderedEntries
 * @returns {IterableIterator<EntryRow>}
 */
function* syncronizedEntries(orderedEntries) {
    /** @type Map<number, Entry> */
    let current = new Map();

    for(const entry of orderedEntries) {
        if(current.size > 0) {
            const maxTime = Array.from(current.values())
                .reduce((p, c) => Math.min(p, c.endTime), Number.MAX_VALUE);

            if(current.has(entry.column) || entry.entry.startTime > maxTime) {
                yield makeEntryRow(current);
                current = new Map();
            }
        }

        current.set(entry.column, entry.entry);

    }

    if(current.size > 0)
        yield makeEntryRow(current);
}

function renderColumns() {
    const header = document.querySelector('thead');
    if(header instanceof HTMLTableSectionElement) {
        while(header.firstChild)
            header.firstChild.remove();

        const tr = document.createElement('tr');

        {
            const th = document.createElement('th');
            th.textContent = 'Time';
            tr.appendChild(th);
        }

        for(const column of columns) {
            const th = document.createElement('th');
            th.textContent = column.name;
            tr.appendChild(th);
        }

        header.appendChild(tr);
    }

    const rows = syncronizedEntries(entriesByTime()[Symbol.iterator]());

    const body = document.querySelector('tbody');
    if(body instanceof HTMLTableSectionElement) {
        while(body.firstChild)
            body.firstChild.remove();

        for(const row of rows) {
            const tr = document.createElement('tr');

            {
                const td = document.createElement('td');
                td.textContent = prettyTime(row.time);
                tr.appendChild(td);
            }

            for(const caption of row.captions) {
                const td = document.createElement('td');
                td.textContent = caption;
                tr.appendChild(td);
            }

            body.appendChild(tr);
        }
    }
}

/**
 *
 * @param {IterableIterator<string>} lines
 * @returns {undefined | Entry}
 */
function parseEntry(lines) {
    {
        const line = lines.next();
        if(line.done)
            return undefined;
        if(!/^\d+$/.test(line.value)) {
            console.warn(`Could not read entry number in '${line}'`);
            return undefined;
        }
    }

    /** @type {number} */
    let startTime;
    let endTime;
    {
        const line = lines.next();
        if(line.done) {
            console.warn(`Unexpected EOF when parsing time`);
            return undefined;
        }
        const match = /^(\d\d):(\d\d):(\d\d),(\d+)\s-->\s(\d\d):(\d\d):(\d\d),(\d+)$/.exec(line.value)
        if(match === null) {
            console.warn(`Invalid time format: '${line}'`);
            return undefined;
        }

        startTime = parseInt(match[4])
            + parseInt(match[3]) * 1000
            + parseInt(match[2]) * 1000 * 60
            + parseInt(match[1]) * 1000 * 60 * 60;

        endTime = parseInt(match[8])
            + parseInt(match[7]) * 1000
            + parseInt(match[6]) * 1000 * 60
            + parseInt(match[5]) * 1000 * 60 * 60;
    }

    /** @type {string[]} */
    let captions = [];
    while(true) {
        const line = lines.next();
        if(line.done || line.value === '') {
            return { startTime, endTime, caption: captions.join('\n') };
        } else {
            captions = captions.concat(line.value);
        }
    }
}

/**
 *
 * @param {IterableIterator<string>} lines
 * @returns {IterableIterator<Entry>}
 */
function* parseEntries(lines) {
    while(true) {
        const entry = parseEntry(lines);
        if(entry !== undefined)
            yield entry;
        else
            break;
    }
}

/**
 * @argument {string} name
 * @argument {string} content */
function addColumn(name, content) {
    // parse entries
    const lines = content.split('\n').map(line => line.trim());
    const entries = Array.from(parseEntries(lines[Symbol.iterator]()));
    columns = columns.concat([{ name, entries }]);
    renderColumns();
}

/** @argument {HTMLInputElement} inputElement */
function setupInputElement(inputElement) {
    inputElement.addEventListener('change', e => {
        const file = inputElement.files !== null ? inputElement.files[0] : undefined;
        if (file !== undefined) {
            const fileReader = new FileReader();
            fileReader.onload = e => {
                if (e.target instanceof FileReader) {
                    /** @type {any} */
                    const contents = e.target.result;
                    inputElement.value = '';
                    addColumn(file.name, contents);
                }
            };
            fileReader.readAsText(file);
        }
    });
}

function init() {
    const inputElement = document.querySelector('#file-adder');
    if (inputElement instanceof HTMLInputElement)
        setupInputElement(inputElement);
}

if (document.readyState === 'complete')
    init();
else
    window.addEventListener('load', init);
