const axios = require('axios');
const bibleDb = require('./bible_db');
const fs = require('fs');
const path = require('path');

const standardBooks = JSON.parse(fs.readFileSync(path.join(__dirname, 'book_list.json'), 'utf8'));

async function setupBible(onProgress) {
    try {
        const { app } = require('electron');
        const biblesDir = path.join(app.getPath('userData'), 'bibles');
        
        if (!fs.existsSync(biblesDir)) {
             if (onProgress) onProgress('No bibles directory found.', 100);
             return { success: true };
        }
        
        const files = fs.readdirSync(biblesDir).filter(f => f.toLowerCase().endsWith('.json'));
        let step = 0;
        const totalSteps = files.length * 3; // read, normalize, import
        
        for (const file of files) {
            const langId = file.replace(/\.json$/i, '').toUpperCase();
            if (onProgress) onProgress(`Reading ${langId} module...`, Math.floor((step / totalSteps) * 100));
            step++;
            
            let rawData = fs.readFileSync(path.join(biblesDir, file), 'utf8');
            const data = JSON.parse(rawData.replace(/^\uFEFF/, '').trim());
            
            if (onProgress) onProgress(`Normalizing ${langId}...`, Math.floor((step / totalSteps) * 100));
            step++;
            
            let normalized;
            if (Array.isArray(data)) {
                normalized = normalizeKJV(data);
            } else if (data.Book) {
                normalized = normalizeHindi(data);
            } else {
                console.error(`Unknown format for bible module: ${file}`);
                step++;
                continue;
            }
            
            if (onProgress) onProgress(`Importing ${langId} to Database...`, Math.floor((step / totalSteps) * 100));
            step++;
            bibleDb.importTranslation(langId, normalized);
        }

        if (onProgress) onProgress('Bible Setup Complete!', 100);
        return { success: true };
    } catch (error) {
        console.error('Bible Setup Error:', error);
        return { success: false, error: error.message };
    }
}

function normalizeKJV(data) {
    // KJV data is an array of books
    return data.map((book, bIdx) => {
        return {
            name: standardBooks[bIdx] || book.name,
            chapters: book.chapters.map((chapterVerses, cIdx) => {
                return {
                    chapter: cIdx + 1,
                    verses: chapterVerses.map((vText, vIdx) => ({
                        verse: vIdx + 1,
                        text: vText
                    }))
                };
            })
        };
    });
}

function normalizeHindi(data) {
    // Hindi data is { Book: [ { Chapter: [ { Verse: [ { Verse: "..." } ] } ] } ] }
    return data.Book.map((book, bIdx) => {
        return {
            name: standardBooks[bIdx],
            chapters: book.Chapter.map((chapter, cIdx) => {
                return {
                    chapter: cIdx + 1,
                    verses: chapter.Verse.map((verse, vIdx) => ({
                        verse: vIdx + 1,
                        text: verse.Verse
                    }))
                };
            })
        };
    });
}

module.exports = { setupBible, normalizeKJV, normalizeHindi };
