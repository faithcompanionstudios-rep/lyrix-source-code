const axios = require('axios');
const bibleDb = require('./bible_db');
const fs = require('fs');
const path = require('path');

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const HINDI_URL = 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Hindi/bible.json';

const standardBooks = JSON.parse(fs.readFileSync(path.join(__dirname, 'book_list.json'), 'utf8'));

async function setupBible(onProgress) {
    try {
        if (onProgress) onProgress('Downloading KJV Translation...', 10);
        const kjvRes = await axios.get(KJV_URL);
        const kjvData = kjvRes.data;

        if (onProgress) onProgress('Normalizing KJV...', 30);
        const normalizedKJV = normalizeKJV(kjvData);

        if (onProgress) onProgress('Importing KJV to Database...', 50);
        bibleDb.importTranslation('KJV', normalizedKJV);

        if (onProgress) onProgress('Downloading Hindi Translation...', 60);
        const hindiRes = await axios.get(HINDI_URL);
        const hindiData = hindiRes.data;

        if (onProgress) onProgress('Normalizing Hindi...', 80);
        const normalizedHindi = normalizeHindi(hindiData);

        if (onProgress) onProgress('Importing Hindi to Database...', 90);
        bibleDb.importTranslation('HINDI', normalizedHindi);

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

module.exports = { setupBible };
