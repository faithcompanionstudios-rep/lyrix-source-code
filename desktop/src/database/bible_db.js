const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'bible.db');
let db;

function initBibleDb() {
    if (db) return db;
    
    db = new Database(dbPath);
    
    // Create Tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS translations (
            id TEXT PRIMARY KEY,
            name TEXT,
            language TEXT
        );

        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY,
            name TEXT,
            testament TEXT,
            chapters_count INTEGER
        );

        CREATE TABLE IF NOT EXISTS verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            translation_id TEXT,
            book_id INTEGER,
            chapter INTEGER,
            verse INTEGER,
            text TEXT,
            FOREIGN KEY (translation_id) REFERENCES translations(id),
            FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_id, chapter);
    `);

    // Insert Translations if they don't exist
    const insertTranslation = db.prepare('INSERT OR IGNORE INTO translations (id, name, language) VALUES (?, ?, ?)');
    insertTranslation.run('KJV', 'King James Version', 'English');
    insertTranslation.run('HINDI', 'BSI Hindi / Community', 'Hindi');
    insertTranslation.run('TELUGU', 'Telugu / Community', 'Telugu');

    return db;
}

const bibleDb = {
    getBooks: () => {
        const db = initBibleDb();
        return db.prepare('SELECT * FROM books ORDER BY id ASC').all();
    },
    
    getChapters: (bookId) => {
        const db = initBibleDb();
        const row = db.prepare('SELECT chapters_count FROM books WHERE id = ?').get(bookId);
        return row ? row.chapters_count : 0;
    },

    getVerses: (translationId, bookId, chapter) => {
        const db = initBibleDb();
        return db.prepare('SELECT * FROM verses WHERE translation_id = ? AND book_id = ? AND chapter = ? ORDER BY verse ASC').all(translationId, bookId, chapter);
    },

    searchVerses: (translationId, query) => {
        const db = initBibleDb();
        // Split query into keywords for AND-based matching
        const keywords = query.trim().split(/\s+/).filter(k => k.length >= 2);
        if (keywords.length === 0) return [];

        // Build WHERE clause: each keyword must appear in the text
        const conditions = keywords.map(() => 'v.text LIKE ?').join(' AND ');
        const params = [translationId, ...keywords.map(k => `%${k}%`)];

        return db.prepare(
            `SELECT v.*, b.name as book_name FROM verses v JOIN books b ON v.book_id = b.id WHERE v.translation_id = ? AND ${conditions} ORDER BY v.book_id, v.chapter, v.verse LIMIT 50`
        ).all(...params);
    },

    // Used by the setup utility
    importTranslation: (translationId, booksData) => {
        const db = initBibleDb();
        const insertVerse = db.prepare('INSERT INTO verses (translation_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)');
        const insertBook = db.prepare('INSERT OR REPLACE INTO books (id, name, testament, chapters_count) VALUES (?, ?, ?, ?)');

        const transaction = db.transaction((books) => {
            // Delete existing for this translation if any (to avoid duplicates)
            db.prepare('DELETE FROM verses WHERE translation_id = ?').run(translationId);
            
            books.forEach((book, bIdx) => {
                const bookId = bIdx + 1;
                insertBook.run(bookId, book.name, bookId <= 39 ? 'OT' : 'NT', book.chapters.length);
                
                book.chapters.forEach((chapter) => {
                    chapter.verses.forEach((verse) => {
                        insertVerse.run(translationId, bookId, chapter.chapter, verse.verse, verse.text);
                    });
                });
            });
        });

        transaction(booksData);
    },

    deleteTranslation: (translationId) => {
        const db = initBibleDb();
        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM verses WHERE translation_id = ?').run(translationId);
            db.prepare('DELETE FROM translations WHERE id = ?').run(translationId);
        });
        transaction();
    },

    resetBibleDb: () => {
        if (db) {
            db.close();
            db = null;
        }
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    }
};

module.exports = bibleDb;
