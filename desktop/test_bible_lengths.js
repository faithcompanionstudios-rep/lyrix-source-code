const axios = require('axios');
const fs = require('fs');

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const HINDI_URL = 'https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Hindi/bible.json';

const standardBooks = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

function normalizeKJV(kjvData) {
    return kjvData.map((book, bIdx) => {
        return {
            name: standardBooks[bIdx],
            chapters: book.chapters.map((chapter, cIdx) => {
                return {
                    chapter: cIdx + 1,
                    verses: chapter.map((verseText, vIdx) => ({
                        verse: vIdx + 1,
                        text: verseText
                    }))
                };
            })
        };
    });
}

function normalizeHindi(data) {
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

async function test() {
    console.log('Downloading KJV...');
    const kjvRes = await axios.get(KJV_URL);
    let kjvData = kjvRes.data;
    // Strip BOM if present
    if (typeof kjvData === 'string') {
        kjvData = JSON.parse(kjvData.replace(/^\uFEFF/, ''));
    }

    console.log('Downloading Hindi...');
    const hindiRes = await axios.get(HINDI_URL);
    let hindiData = hindiRes.data;

    console.log('Normalizing...');
    const normalizedKJV = normalizeKJV(kjvData);
    const normalizedHindi = normalizeHindi(hindiData);

    let mismatches = 0;
    for (let bIdx = 0; bIdx < 66; bIdx++) {
        const kjvBook = normalizedKJV[bIdx];
        const hiBook = normalizedHindi[bIdx];

        if (!kjvBook || !hiBook) continue;

        for (let cIdx = 0; cIdx < kjvBook.chapters.length; cIdx++) {
            const kjvChap = kjvBook.chapters[cIdx];
            const hiChap = hiBook.chapters[cIdx];

            if (!hiChap) continue;

            const kjvLen = kjvChap.verses.length;
            const hiLen = hiChap.verses.length;

            if (kjvLen !== hiLen) {
                console.log(`Mismatch -> Book: ${kjvBook.name} (${bIdx+1}), Chapter: ${cIdx+1} | KJV: ${kjvLen}, Hindi: ${hiLen}`);
                mismatches++;
            }
        }
    }
    console.log('Total mismatches:', mismatches);
}

test().catch(console.error);
