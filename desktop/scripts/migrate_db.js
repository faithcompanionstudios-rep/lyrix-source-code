const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../../../church-songs-app/src/data/books');
const TARGET_FILE = path.join(__dirname, '../src/database/songs.json');

// Helper to extract YouTube ID
function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Map the books to LyriX Categories
const BOOK_MAP = [
    { file: 'choruses.json', category: 'English Choruses', prefix: 'C' },
    { file: 'hymns.json', category: 'English Hymns', prefix: 'H' },
    { file: 'aradhana.json', category: 'Telugu Songs', prefix: 'T' },
    { file: 'supplement.json', category: 'Special Songs', prefix: 'S' }
];

async function migrate() {
    console.log('Starting migration...');
    let allSongs = [];
    
    for (const book of BOOK_MAP) {
        const filePath = path.join(SOURCE_DIR, book.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let idCounter = 1;

        data.forEach(song => {
            // Split lyrics into slides
            const slides = (song.lyrics || '').split('\n\n').map(s => s.trim()).filter(s => s.length > 0);
            
            // Handle Telugu lyrics
            let teluguSlides = [];
            if (song.teluguLyrics) {
                teluguSlides = song.teluguLyrics.split('\n\n').map(s => s.trim());
                // Align array lengths
                while (teluguSlides.length < slides.length) teluguSlides.push(null);
                while (slides.length < teluguSlides.length) slides.push(null);
            } else if (book.category === 'Telugu Songs') {
                // Aradhana book has Telugu lyrics in the primary 'lyrics' field in source, but we put it in slides
                // We leave teluguSlides empty/null
            }

            const hasTelugu = teluguSlides.some(s => s && s.length > 0);
            const title = (song.title || '').trim();

            let searchContent = '';
            if (song.romanizedTitle) searchContent += song.romanizedTitle + ' ';
            if (song.romanizedLyrics) searchContent += song.romanizedLyrics.replace(/\n/g, ' ') + ' ';
            searchContent = searchContent.trim();

            const migratedSong = {
                id: `${book.prefix}${idCounter++}`,
                title: title,
                titleNormalized: title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/gi, '').replace(/\s+/g, " ").trim(),
                romanizedTitle: song.romanizedTitle || undefined,
                searchContent: searchContent || undefined,
                category: book.category,
                slides: slides,
                teluguSlides: hasTelugu ? teluguSlides : undefined,
                hasTeluguTranslation: hasTelugu,
                youtubeUrl: song.youtube || undefined,
                youtubeId: extractVideoId(song.youtube),
                tags: song.tags || [],
                preview: slides.length > 0 && slides[0] ? slides[0].split('\n')[0] : title,
                updatedAt: Date.now(),
                isCustom: false
            };

            allSongs.push(migratedSong);
        });
        
        console.log(`Migrated ${data.length} songs from ${book.file}`);
    }

    // Write to LyriX database
    fs.writeFileSync(TARGET_FILE, JSON.stringify(allSongs, null, 2), 'utf-8');
    console.log(`\nMigration complete! Total songs written: ${allSongs.length}`);
}

migrate();
