const axios = require('axios');
const bibleDb = require('./bible_db');
const fs = require('fs');
const path = require('path');

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const HINDI_URL = 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Hindi/bible.json';
const TELUGU_URL = 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Telugu/bible.json';

const standardBooks = JSON.parse(fs.readFileSync(path.join(__dirname, 'book_list.json'), 'utf8'));

async function setupBible(onProgress) {
    try {
        if (onProgress) onProgress('Reading KJV Translation from disk...', 10);
        const kjvData = JSON.parse(fs.readFileSync(path.join(__dirname, 'bibles', 'kjv.json'), 'utf8'));

        if (onProgress) onProgress('Normalizing KJV...', 30);
        let normalizedKJV = normalizeKJV(kjvData);
        normalizedKJV = patchKJV(normalizedKJV);

        if (onProgress) onProgress('Importing KJV to Database...', 50);
        bibleDb.importTranslation('KJV', normalizedKJV);

        if (onProgress) onProgress('Reading Hindi Translation from disk...', 60);
        const hindiData = JSON.parse(fs.readFileSync(path.join(__dirname, 'bibles', 'hindi.json'), 'utf8'));

        if (onProgress) onProgress('Normalizing Hindi...', 80);
        let normalizedHindi = normalizeHindi(hindiData);
        normalizedHindi = patchHindi(normalizedHindi);

        if (onProgress) onProgress('Importing Hindi to Database...', 75);
        bibleDb.importTranslation('HINDI', normalizedHindi);

        if (onProgress) onProgress('Reading Telugu Translation from disk...', 85);
        const teluguData = JSON.parse(fs.readFileSync(path.join(__dirname, 'bibles', 'telugu.json'), 'utf8'));

        if (onProgress) onProgress('Normalizing Telugu...', 95);
        let normalizedTelugu = normalizeHindi(teluguData); // It's in the same format as Hindi
        normalizedTelugu = patchTelugu(normalizedTelugu);

        if (onProgress) onProgress('Importing Telugu to Database...', 98);
        bibleDb.importTranslation('TELUGU', normalizedTelugu);

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

function patchHindi(data) {
    try {
        // Judges 10 (Book 7, index 6)
        if (data[6] && data[6].chapters[9]) {
            data[6].chapters[9].verses = data[6].chapters[9].verses.slice(0, 18);
        }
        // Micah 3 (Book 33, index 32)
        if (data[32] && data[32].chapters[2]) {
            data[32].chapters[2].verses = data[32].chapters[2].verses.slice(0, 12);
        }
    } catch (e) { console.error('Error patching Hindi', e); }
    return data;
}

function patchTelugu(data) {
    try {
        if (data[6] && data[6].chapters[9]) {
            data[6].chapters[9].verses = data[6].chapters[9].verses.slice(0, 18);
        }
        if (data[32] && data[32].chapters[2]) {
            data[32].chapters[2].verses = data[32].chapters[2].verses.slice(0, 12);
        }
    } catch (e) { console.error('Error patching Telugu', e); }
    return data;
}

function patchKJV(data) {
    try {
        const reindex = (b, c) => {
            if (data[b] && data[b].chapters[c]) {
                data[b].chapters[c].verses.forEach((v, i) => { v.verse = i + 1; });
            }
        };

        const mergeVerses = (b, c, v1, v2) => {
            if (data[b] && data[b].chapters[c] && data[b].chapters[c].verses[v1] && data[b].chapters[c].verses[v2]) {
                data[b].chapters[c].verses[v1].text += " " + data[b].chapters[c].verses[v2].text;
                data[b].chapters[c].verses.splice(v2, 1);
                reindex(b, c);
            }
        };

        const insertVerse = (b, c, index, text) => {
            if (data[b] && data[b].chapters[c]) {
                data[b].chapters[c].verses.splice(index, 0, { verse: 0, text });
                reindex(b, c);
            }
        };

        // Fixing Split Verses (where the translation accidentally split one verse into two)
        mergeVerses(8, 19, 41, 42); // 1 Sam 20
        mergeVerses(10, 21, 52, 53); // 1 Kings 22
        mergeVerses(62, 0, 13, 14); // 3 John 1
        mergeVerses(65, 11, 16, 17); // Rev 12

        // Fixing Missing Verses (where the translation skipped a verse entirely, throwing off all numbers after it)
        // Inserting the actual KJV text for the missing verses.
        insertVerse(39, 1, 15, "Then Herod, when he saw that he was mocked of the wise men, was exceeding wroth, and sent forth, and slew all the children that were in Bethlehem, and in all the coasts thereof, from two years old and under, according to the time which he had diligently enquired of the wise men."); // Matt 2:16
        insertVerse(39, 21, 0, "And Jesus answered and spake unto them again by parables, and said,"); // Matt 22:1
        insertVerse(39, 25, 37, "Then saith he unto them, My soul is exceeding sorrowful, even unto death: tarry ye here, and watch with me."); // Matt 26:38
        insertVerse(40, 3, 39, "And he said unto them, Why are ye so fearful? how is it that ye have no faith?"); // Mark 4:40
        insertVerse(40, 6, 10, "But ye say, If a man shall say to his father or mother, It is Corban, that is to say, a gift, by whatsoever thou mightest be profited by me; he shall be free."); // Mark 7:11
        insertVerse(40, 7, 7, "So they did eat, and were filled: and they took up of the broken meat that was left seven baskets."); // Mark 8:8
    } catch (e) { console.error('Error patching KJV', e); }
    return data;
}

module.exports = { setupBible, normalizeKJV, normalizeHindi };
