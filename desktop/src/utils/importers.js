const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const db = require('../database/db');

// ─── Parse-Only Functions (for preview/verification) ────────────────────────

function parseOpenLyricsXml(filePath) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const title = $('properties titles title').first().text().trim();
    if (!title) throw new Error("No title found in XML");

    const slides = [];
    $('lyrics verse').each((i, el) => {
        let lines = [];
        $(el).find('lines').each((j, lineEl) => {
            const html = $(lineEl).html() || '';
            const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/(<([^>]+)>)/gi, "");
            if (text.trim()) lines.push(text.trim());
        });
        if (lines.length > 0) slides.push(lines.join('\n'));
    });

    if (slides.length === 0) throw new Error("No lyrics found");

    return [{ title, slides, slideCount: slides.length, source: path.basename(filePath) }];
}

function parseOpenLPSqlite(filePath) {
    const Database = require('better-sqlite3');
    const sqliteDb = new Database(filePath, { readonly: true });
    
    let rows = [];
    try {
        rows = sqliteDb.prepare("SELECT title, lyrics FROM songs").all();
    } catch (e) {
        sqliteDb.close();
        throw new Error("Invalid OpenLP database format");
    }
    sqliteDb.close();

    const parsed = [];
    for (const row of rows) {
        try {
            const title = row.title.trim();
            if (!title) continue;

            const slides = [];
            if (row.lyrics && row.lyrics.includes('<song')) {
                const $ = cheerio.load(row.lyrics, { xmlMode: true });
                $('lyrics verse').each((i, el) => {
                    const text = $(el).text().replace(/<br\s*\/?>/gi, '\n').trim();
                    if (text) slides.push(text);
                });
            } else if (row.lyrics) {
                const blocks = row.lyrics.split(/\n\s*\n/);
                blocks.forEach(b => {
                    if (b.trim()) slides.push(b.trim());
                });
            }

            if (slides.length === 0) continue;

            parsed.push({ title, slides, slideCount: slides.length, source: path.basename(filePath) });
        } catch (e) {
            // Skip songs that fail to parse
        }
    }
    
    return parsed;
}

function parseLyrixJson(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) throw new Error("Invalid format: expected an array of songs.");

    const parsed = [];
    for (const song of data) {
        if (!song.title || !song.slides) continue;
        parsed.push({
            title: song.title,
            slides: song.slides,
            slideCount: song.slides.length,
            category: song.category || null,
            source: path.basename(filePath)
        });
    }
    return parsed;
}

async function parsePptx(filePath) {
    const JSZip = require('jszip');
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    
    // Find all slide XML files
    const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    
    // Sort slides numerically
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)[1]);
        const numB = parseInt(b.match(/slide(\d+)/)[1]);
        return numA - numB;
    });

    const slides = [];

    for (const slideFile of slideFiles) {
        const xml = await zip.file(slideFile).async("string");
        const $ = cheerio.load(xml, { xmlMode: true });
        
        let slideText = '';
        $('a\\:t').each((i, el) => {
            slideText += $(el).text() + '\n';
        });
        
        const cleanText = slideText.trim().replace(/\n+/g, '\n');
        if (cleanText) slides.push(cleanText);
    }

    if (slides.length === 0) throw new Error("No text found in presentation slides");

    const title = path.basename(filePath, path.extname(filePath));
    return [{ title, slides, slideCount: slides.length, source: path.basename(filePath) }];
}

/**
 * Parse files without importing — returns array of preview items.
 * Each item: { title, slides, slideCount, source, category? }
 */
async function parseFiles(filePaths) {
    const previews = [];
    const errors = [];

    for (const filePath of filePaths) {
        const ext = filePath.split('.').pop().toLowerCase();
        try {
            if (ext === 'xml') {
                previews.push(...parseOpenLyricsXml(filePath));
            } else if (ext === 'sqlite') {
                previews.push(...parseOpenLPSqlite(filePath));
            } else if (ext === 'lyrx' || ext === 'json') {
                previews.push(...parseLyrixJson(filePath));
            } else if (ext === 'pptx' || ext === 'ppt' || ext === 'ppsx') {
                previews.push(...await parsePptx(filePath));
            } else {
                errors.push(`Format .${ext} is not supported for song import.`);
            }
        } catch (e) {
            errors.push(`Failed to parse ${path.basename(filePath)}: ${e.message}`);
        }
    }

    return { previews, errors };
}

// ─── Import Functions (actually insert into DB) ─────────────────────────────

/**
 * Import selected songs into the database.
 * @param {Array} songs - Array of { title, slides, category? } objects
 * @param {string} defaultCategory - Fallback category
 * @returns {{ success: boolean, count: number, errors: string[] }}
 */
async function importSelectedSongs(songs, defaultCategory) {
    const imported = [];
    const skipped = [];
    const errors = [];

    for (const song of songs) {
        try {
            const category = song.category || defaultCategory || 'English Choruses';
            const id = await db.getNextId(category);
            const songData = {
                id,
                title: song.title,
                category,
                slides: song.slides
            };
            await db.addSong(songData);
            imported.push(song.title);
        } catch (e) {
            if (e.message.includes('already exists')) {
                skipped.push(song.title);
            } else {
                errors.push(`${song.title}: ${e.message}`);
            }
        }
    }

    return { success: true, count: imported.length, skipped: skipped.length, skippedTitles: skipped, errors };
}

// ─── Legacy Import Functions (kept for backward compat) ─────────────────────

async function importOpenLyricsXml(filePath, defaultCategory) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const title = $('properties titles title').first().text().trim();
    if (!title) throw new Error("No title found in XML");

    const slides = [];
    $('lyrics verse').each((i, el) => {
        let lines = [];
        $(el).find('lines').each((j, lineEl) => {
            // Replace <br/> with newline
            const html = $(lineEl).html() || '';
            const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/(<([^>]+)>)/gi, "");
            if (text.trim()) lines.push(text.trim());
        });
        if (lines.length > 0) slides.push(lines.join('\n'));
    });

    if (slides.length === 0) throw new Error("No lyrics found");

    const category = defaultCategory || 'English Choruses';
    const id = await db.getNextId(category);

    const songData = {
        id,
        title,
        category,
        slides
    };

    try {
        await db.addSong(songData);
        return { success: true, title };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function importOpenLPSqlite(filePath, defaultCategory) {
    const Database = require('better-sqlite3');
    const sqliteDb = new Database(filePath, { readonly: true });
    
    let rows = [];
    try {
        rows = sqliteDb.prepare("SELECT title, lyrics FROM songs").all();
    } catch (e) {
        sqliteDb.close();
        throw new Error("Invalid OpenLP database format");
    }
    sqliteDb.close();

    const imported = [];
    const errors = [];

    for (const row of rows) {
        try {
            const title = row.title.trim();
            if (!title) continue;

            const slides = [];
            if (row.lyrics && row.lyrics.includes('<song')) {
                const $ = cheerio.load(row.lyrics, { xmlMode: true });
                $('lyrics verse').each((i, el) => {
                    const text = $(el).text().replace(/<br\s*\/?>/gi, '\n').trim();
                    if (text) slides.push(text);
                });
            } else if (row.lyrics) {
                const blocks = row.lyrics.split(/\n\s*\n/);
                blocks.forEach(b => {
                    if (b.trim()) slides.push(b.trim());
                });
            }

            if (slides.length === 0) continue;

            const category = defaultCategory || 'English Choruses';
            const id = await db.getNextId(category);

            const songData = { id, title, category, slides };
            try {
                await db.addSong(songData);
                imported.push(title);
            } catch (e) {
                if (!e.message.includes('already exists')) {
                    errors.push(`${title}: ${e.message}`);
                }
            }
        } catch (e) {
            errors.push(`${row.title}: ${e.message}`);
        }
    }
    
    return { success: true, count: imported.length, errors };
}

async function importLyrixJson(filePath, defaultCategory) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const imported = [];
    const errors = [];
    if (!Array.isArray(data)) throw new Error("Invalid format: expected an array of songs.");

    for (const song of data) {
        if (!song.title || !song.slides) {
            errors.push(`${song.title || 'Unknown'}: Missing title or slides`);
            continue;
        }
        
        try {
            const category = song.category || defaultCategory || 'English Choruses';
            const id = await db.getNextId(category);
            const songData = {
                id,
                title: song.title,
                category,
                slides: song.slides
            };
            await db.addSong(songData);
            imported.push(song.title);
        } catch (e) {
            if (!e.message.includes('already exists')) {
                errors.push(`${song.title}: ${e.message}`);
            }
        }
    }
    return { success: true, count: imported.length, errors };
}

async function importPptx(filePath, defaultCategory) {
    const previews = await parsePptx(filePath);
    if (previews.length === 0) throw new Error("No lyrics found in presentation");

    const song = previews[0];
    const category = defaultCategory || 'English Choruses';
    const id = await db.getNextId(category);

    const songData = {
        id,
        title: song.title,
        category,
        slides: song.slides
    };

    try {
        await db.addSong(songData);
        return { success: true, count: 1, errors: [] };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    importOpenLyricsXml,
    importOpenLPSqlite,
    importLyrixJson,
    importPptx,
    parseFiles,
    importSelectedSongs
};
