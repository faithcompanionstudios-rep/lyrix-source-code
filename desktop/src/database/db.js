const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { transliterate } = require('../utils/transliterator');

let BUNDLED_SONGS_PATH;   // Read-only, inside app package
let CUSTOM_SONGS_PATH;    // User-added/edited songs in userData
let DELETED_BUNDLED_PATH; // IDs of bundled songs user deleted
let SCHEDULE_BACKUP_PATH;
let CATEGORIES_BACKUP_PATH;
let DELETED_SONGS_PATH;   // Recycle bin
let APP_SETTINGS_PATH;
let OLD_SONGS_BACKUP_PATH; // Legacy path for migration

let forceOfflineMode = false;
let playstoreLink = 'https://play.google.com/store/apps/details?id=com.faithcompanionstudios.lyrix';
let projectorDisplayId = null;

const DEFAULT_CATEGORIES = [
    'English Choruses',
    'English Hymns',
    'Telugu Songs',
    'Hindi Songs',
    'Marathi Songs',
    'Special Songs',
    'Children Songs'
];

const DEFAULT_ADMIN = {
    username: 'admin',
    passwordHash: crypto.createHash('sha256').update('admin').digest('hex'),
    isPasswordProtected: true
};

let songsCache = [];           // Merged view (bundled + custom)
let customSongsCache = [];     // Only custom/edited songs
let deletedBundledIds = [];    // IDs of bundled songs user deleted
let bundledSongIds = new Set(); // Track which IDs come from bundle
let scheduleCache = [];
let localScheduleUpdatedAt = 0;
let categoriesCache = [...DEFAULT_CATEGORIES];
let adminCredentials = null;
let dbStatus = 'connecting';
let authPromise = null;
let isOffline = false;

// ─── Helpers ────────────────────────────────────────────────────────────────

function broadcastDbStatus() {
    if (global.broadcastDbStatus) {
        global.broadcastDbStatus({
            status: 'local-mode',
            authenticated: true,
            isOffline: true
        });
    }
}

async function checkNetwork() {
    return true;
}

const normalize = (text) => {
    if (!text) return '';
    return text.toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
};

const capitalizeFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

function getCategoryPrefix(category) {
    const map = {
        'English Choruses': 'C',
        'English Hymns': 'H',
        'Telugu Songs': 'T',
        'Hindi Songs': 'HI',
        'Marathi Songs': 'M',
        'Special Songs': 'S',
        'Children Songs': 'CH'
    };
    if (map[category]) return map[category];
    const words = category.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return category.substring(0, 2).toUpperCase();
}

async function ensureAuth() {
    return true;
}

async function syncRemoteData() {
    return true;
}

// ─── Init ────────────────────────────────────────────────────────────────────

function rebuildSongsCache(bundledSongs) {
    // 1. Filter out user-deleted bundled songs
    let filtered = bundledSongs.filter(s => !deletedBundledIds.includes(s.id));

    // 2. Build custom map for overrides
    const customMap = new Map(customSongsCache.map(s => [s.id, s]));

    // 3. Overlay edits onto bundled songs
    const merged = filtered.map(s => {
        if (customMap.has(s.id)) {
            const custom = customMap.get(s.id);
            // Preserve new database fields that might not exist in old custom saves
            if (s.teluguSlides && !custom.teluguSlides) custom.teluguSlides = s.teluguSlides;
            if (s.youtubeUrl && !custom.youtubeUrl) custom.youtubeUrl = s.youtubeUrl;
            return custom;
        }
        return s;
    });

    // 4. Add purely new custom songs (IDs not in the bundle)
    const bundledIdSet = new Set(bundledSongs.map(s => s.id));
    const newCustom = customSongsCache.filter(s => !bundledIdSet.has(s.id));

    songsCache = [...merged, ...newCustom].map(song => {
        if (!song.romanizedTitle && /[^\u0000-\u007F]/.test(song.title || '')) {
            song.romanizedTitle = transliterate(song.title || '');
        }
        if (!song.searchContent && song.slides) {
            const fullLyrics = Array.isArray(song.slides) ? song.slides.join(' ') : (song.slides || '');
            if (/[^\u0000-\u007F]/.test(fullLyrics)) {
                song.searchContent = transliterate(fullLyrics);
            }
        }
        
        // Pre-compute normalized strings to drastically save CPU/memory on every keystroke
        song._idNorm = normalize(song.id || '');
        song._tNorm = normalize(song.title || '');
        song._rNorm = normalize(song.romanizedTitle || '');
        const slidesArray = Array.isArray(song.slides) ? song.slides : [song.slides || ''];
        song._lNorm = normalize(slidesArray.join(' '));
        song._sNorm = normalize(song.searchContent || '');
        song._cNorm = normalize(song.category || '');

        return song;
    });
    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
}

async function initDb(userDataPath) {
    console.log('Initializing DB with persistent storage...');

    // Set up persistent paths
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    BUNDLED_SONGS_PATH = path.join(__dirname, 'songs.json');
    CUSTOM_SONGS_PATH = path.join(dataDir, 'custom_songs.json');
    DELETED_BUNDLED_PATH = path.join(dataDir, 'deleted_bundled.json');
    OLD_SONGS_BACKUP_PATH = path.join(dataDir, 'songs.json');
    SCHEDULE_BACKUP_PATH = path.join(dataDir, 'schedule.json');
    CATEGORIES_BACKUP_PATH = path.join(dataDir, 'categories.json');
    DELETED_SONGS_PATH = path.join(dataDir, 'deleted_songs.json');
    APP_SETTINGS_PATH = path.join(dataDir, 'app_settings.json');

    // Load App Settings
    try {
        if (fs.existsSync(APP_SETTINGS_PATH)) {
            const settings = JSON.parse(fs.readFileSync(APP_SETTINGS_PATH, 'utf-8'));
            forceOfflineMode = settings.forceOffline || false;
            if (settings.playstoreLink) playstoreLink = settings.playstoreLink;
            if (settings.projectorDisplayId) projectorDisplayId = settings.projectorDisplayId;
            if (settings.adminCredentials) {
                adminCredentials = settings.adminCredentials;
            }
        }
    } catch (err) { console.error('Failed to load app settings:', err); }

    // ─── Load Bundled Songs (read-only from app package) ─────────────────
    let bundledSongs = [];
    try {
        bundledSongs = JSON.parse(fs.readFileSync(BUNDLED_SONGS_PATH, 'utf-8'));
        bundledSongIds = new Set(bundledSongs.map(s => s.id));
        console.log(`Loaded ${bundledSongs.length} bundled songs from package.`);
    } catch (err) { console.error('Failed to load bundled songs:', err); }

    // ─── One-time Migration from old single-file system ─────────────────
    if (fs.existsSync(OLD_SONGS_BACKUP_PATH) && !fs.existsSync(CUSTOM_SONGS_PATH)) {
        try {
            console.log('Migrating from legacy single-file songs system...');
            const oldSongs = JSON.parse(fs.readFileSync(OLD_SONGS_BACKUP_PATH, 'utf-8'));
            const bundledMap = new Map(bundledSongs.map(s => [s.id, JSON.stringify(s.slides)]));

            // Songs in old data that are NOT in bundle = custom songs
            // Songs in old data that ARE in bundle but have different slides = user edits
            customSongsCache = oldSongs.filter(s => {
                if (!bundledSongIds.has(s.id)) return true; // purely custom
                const bundledSlides = bundledMap.get(s.id);
                return bundledSlides && JSON.stringify(s.slides) !== bundledSlides; // edited
            });

            fs.writeFileSync(CUSTOM_SONGS_PATH, JSON.stringify(customSongsCache, null, 2));
            // Rename old file so migration doesn't re-run
            fs.renameSync(OLD_SONGS_BACKUP_PATH, path.join(dataDir, 'songs_legacy_backup.json'));
            console.log(`Migration complete: ${customSongsCache.length} custom/edited songs extracted.`);
        } catch (err) { console.error('Migration failed:', err); }
    }

    // ─── Load Custom Songs ───────────────────────────────────────────────
    try {
        if (fs.existsSync(CUSTOM_SONGS_PATH)) {
            const local = JSON.parse(fs.readFileSync(CUSTOM_SONGS_PATH, 'utf-8'));
            if (Array.isArray(local)) customSongsCache = local;
        }
    } catch (err) { console.error('Failed to load custom songs:', err); }

    // ─── Load Deleted Bundled IDs ────────────────────────────────────────
    try {
        if (fs.existsSync(DELETED_BUNDLED_PATH)) {
            const local = JSON.parse(fs.readFileSync(DELETED_BUNDLED_PATH, 'utf-8'));
            if (Array.isArray(local)) deletedBundledIds = local;
        }
    } catch (err) { console.error('Failed to load deleted bundled list:', err); }

    // ─── Merge into final songsCache ─────────────────────────────────────
    rebuildSongsCache(bundledSongs);
    console.log(`Songs ready: ${songsCache.length} total (${bundledSongs.length} bundled, ${customSongsCache.length} custom).`);
    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);

    // ─── Load Schedule & Categories ──────────────────────────────────────
    try {
        if (fs.existsSync(SCHEDULE_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(SCHEDULE_BACKUP_PATH, 'utf-8'));
            if (local && typeof local === 'object' && local.items) {
                scheduleCache = local.items;
                localScheduleUpdatedAt = local.updatedAt || 0;
            } else if (Array.isArray(local)) {
                scheduleCache = local;
                localScheduleUpdatedAt = 0;
            }
            if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
        }
        if (fs.existsSync(CATEGORIES_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(CATEGORIES_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(local)) categoriesCache = local;
        }
    } catch (err) {
        console.error('Failed to load schedule/categories:', err);
    }

    console.log('Init sequence: Pure Local Mode active. Skipping Firebase.');
    isOffline = true;
    dbStatus = 'local-mode';
    broadcastDbStatus();
    return true;
}

async function loadConfig() {
    // Config now only relies on local fallback.
    return true;
}

// ─── Optimistic Updates ──────────────────────────────────────────────────────

function saveCustomSongs() {
    try { fs.writeFileSync(CUSTOM_SONGS_PATH, JSON.stringify(customSongsCache, null, 2)); } catch (e) { }
    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
}

function saveDeletedBundled() {
    try { fs.writeFileSync(DELETED_BUNDLED_PATH, JSON.stringify(deletedBundledIds, null, 2)); } catch (e) { }
}

function saveLocalSchedule() {
    try { 
        localScheduleUpdatedAt = Date.now();
        const data = { 
            items: scheduleCache, 
            updatedAt: localScheduleUpdatedAt 
        };
        fs.writeFileSync(SCHEDULE_BACKUP_PATH, JSON.stringify(data, null, 2)); 
    } catch (e) { }
    if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
}

function saveLocalCategories() {
    try { fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2)); } catch (e) { }
    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
}

// ─── Categories ──────────────────────────────────────────────────────────────

function getCategories() {
    return categoriesCache;
}

async function addCategory(name) {
    const trimmed = capitalizeFirst(name.trim());
    if (!trimmed || categoriesCache.includes(trimmed)) throw new Error('Category already exists or invalid name');

    // Optimistic
    categoriesCache = [...categoriesCache, trimmed];
    saveLocalCategories();

    return categoriesCache;
}

async function updateCategory(oldName, newName) {
    const trimmed = capitalizeFirst(newName.trim());
    if (!trimmed) throw new Error('Invalid category name');

    // Optimistic
    categoriesCache = categoriesCache.map(c => c === oldName ? trimmed : c);
    songsCache = songsCache.map(s => s.category === oldName ? { ...s, category: trimmed, updatedAt: Date.now() } : s);
    customSongsCache = customSongsCache.map(s => s.category === oldName ? { ...s, category: trimmed, updatedAt: Date.now() } : s);
    scheduleCache = scheduleCache.map(i => i.category === oldName ? { ...i, category: trimmed } : i);

    saveLocalCategories();
    saveCustomSongs();
    saveLocalSchedule();

    return categoriesCache;
}

async function deleteCategory(name) {
    // Optimistic
    categoriesCache = categoriesCache.filter(c => c !== name);
    saveLocalCategories();

    return categoriesCache;
}

function getUncategorizedSongs() {
    return songsCache.filter(s => !categoriesCache.includes(s.category));
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function getAdminCredentials() {
    return adminCredentials || { ...DEFAULT_ADMIN };
}

async function setAdminCredentials(username, plainPassword, isPasswordProtected = true) {
    const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
    const creds = { username: username.trim(), passwordHash, isPasswordProtected };
    adminCredentials = creds;
    saveAppSettings();
    return true;
}

function verifyAdminCredentials(username, plainPassword) {
    const creds = getAdminCredentials();
    const hash = crypto.createHash('sha256').update(plainPassword).digest('hex');
    return creds.username === username.trim() && creds.passwordHash === hash;
}

// ─── Songs ───────────────────────────────────────────────────────────────────

function getSong(id) {
    return songsCache.find(s => s.id === id);
}

function searchSongs(queryStr, filter = 'All', preferredCategory = null) {
    const source = filter !== 'All' ? songsCache.filter(s => s.category === filter) : songsCache;
    if (!queryStr) return source.slice(0, 2000);
    return performRobustSearch(queryStr, source, preferredCategory);
}

// ─── Fuzzy Search: Levenshtein Distance ─────────────────────────────────────
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

function performRobustSearch(queryStr, source, preferredCategory = null) {
    const qNorm = normalize(queryStr);
    const tokens = qNorm.split(' ').filter(t => t.length > 0);
    if (tokens.length === 0) return source.slice(0, 2000);

    const scored = source.map(song => {
        // Use pre-computed normalized fields
        const idNorm = song._idNorm || normalize(song.id || '');
        const titleNorm = song._tNorm || normalize(song.title || '');
        const romanizedTitleNorm = song._rNorm || '';
        const lyricsNorm = song._lNorm || '';
        const searchContentNorm = song._sNorm || '';
        const catNorm = song._cNorm || '';

        let score = 0;

        // 1. Exact ID Match (Highest Priority)
        if (idNorm === qNorm) {
            score += 200;
        }

        // 2. Numeric ID Matching (e.g., query "7" matches ID "H7", "T7", "H70")
        const idDigits = idNorm.replace(/\D/g, '');
        const isQueryOnlyDigits = /^\d+$/.test(qNorm);

        if (isQueryOnlyDigits) {
            if (idDigits === qNorm) {
                // Exact numeric match: "7" → H7, C7 (+150)
                score += 150;
            } else if (idDigits.startsWith(qNorm)) {
                // Prefix numeric match: "12" → H120, H121 (+70)
                score += 70;
            } else if (idDigits.includes(qNorm)) {
                // Partial numeric match: "2" → H120 (+30)
                score += 30;
            }
        }

        // 2b. Partial string ID match (e.g. "h7" partial matches "h70")
        if (!isQueryOnlyDigits && idNorm.includes(qNorm) && idNorm !== qNorm) {
            score += 60;
        }

        // 3. Category Bias (If query is numeric and across all, prioritize the active category)
        if (preferredCategory && song.category === preferredCategory) {
            score += 50;
        }

        // 4. Title Matches
        if (titleNorm === qNorm || (romanizedTitleNorm && romanizedTitleNorm === qNorm)) {
            score += 100;
        } else if (titleNorm.startsWith(qNorm) || (romanizedTitleNorm && romanizedTitleNorm.startsWith(qNorm))) {
            score += 80;
        } else if (titleNorm.includes(qNorm) || (romanizedTitleNorm && romanizedTitleNorm.includes(qNorm))) {
            // Prevent '7' matching '70' in title if query is numeric
            if (!isQueryOnlyDigits || (titleNorm.match(new RegExp(`\\b${qNorm}\\b`))) || (romanizedTitleNorm && romanizedTitleNorm.match(new RegExp(`\\b${qNorm}\\b`)))) {
                score += 60;
            }
        }

        // 5. Tokenized Title Match
        if (score < 60 && (tokens.every(t => titleNorm.includes(t)) || (romanizedTitleNorm && tokens.every(t => romanizedTitleNorm.includes(t))))) {
            score += 40;
        }

        // 6. Lyrics Content Match
        if (lyricsNorm.includes(qNorm) || (searchContentNorm && searchContentNorm.includes(qNorm))) {
            score += 20;
        } else if (tokens.length > 1 && (tokens.every(t => lyricsNorm.includes(t)) || (searchContentNorm && tokens.every(t => searchContentNorm.includes(t))))) {
            score += 10;
        }

        // 7. Category Text Match
        if (tokens.every(t => catNorm.includes(t))) {
            score += 5;
        }

        // 8. Fuzzy Title Match (typo tolerance for queries 3+ chars)
        // Skip fuzzy if we already have a strong match to save CPU
        if (score === 0 && qNorm.length >= 3 && !isQueryOnlyDigits && qNorm.length < 20) {
            // Split title into words and check each token against each word
            const titleWords = titleNorm.split(' ');
            for (const token of tokens) {
                if (token.length < 3) continue;
                for (const word of titleWords) {
                    if (word.length < 3) continue;
                    const maxDist = token.length <= 4 ? 1 : 2; // Allow 1 typo for short words, 2 for longer
                    const dist = levenshtein(token, word.substring(0, token.length + 2));
                    if (dist <= maxDist) {
                        score += Math.max(1, 15 - dist * 5); // 15 for exact-ish, 10 for 1-off, 5 for 2-off
                        break;
                    }
                }
            }
        }

        return { song, score };
    });

    return scored
        .filter(r => r.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            // secondary sort by ID numerically for consistency
            return a.song.id.localeCompare(b.song.id, undefined, { numeric: true });
        })
        .map(r => r.song)
        .slice(0, 2000);
}

async function addSong(songData) {
    const title = capitalizeFirst((songData.title || '').trim());
    if (!title) throw new Error('Title is required');

    const titleNorm = normalize(title);
    if (songsCache.find(s => normalize(s.title) === titleNorm)) throw new Error(`A song titled "${title}" already exists`);

    let romanizedTitle = songData.romanizedTitle;
    let searchContent = songData.searchContent;
    
    // Auto-transliterate if missing
    if (!romanizedTitle && /[^\u0000-\u007F]/.test(title)) {
        romanizedTitle = transliterate(title);
    }
    if (!searchContent && songData.slides) {
        const fullLyrics = Array.isArray(songData.slides) ? songData.slides.join(' ') : songData.slides;
        if (/[^\u0000-\u007F]/.test(fullLyrics)) {
            searchContent = transliterate(fullLyrics);
        }
    }

    const finalSong = { ...songData, title, romanizedTitle, searchContent, titleNormalized: titleNorm, updatedAt: Date.now(), isCustom: true };

    // Add to both caches
    customSongsCache.push(finalSong);
    songsCache.push(finalSong);
    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveCustomSongs();

    return finalSong;
}

async function updateSong(songData) {
    const title = capitalizeFirst((songData.title || '').trim());
    if (!title) throw new Error('Title is required');

    let romanizedTitle = songData.romanizedTitle;
    let searchContent = songData.searchContent;
    
    // Auto-transliterate if missing
    if (!romanizedTitle && /[^\u0000-\u007F]/.test(title)) {
        romanizedTitle = transliterate(title);
    }
    if (!searchContent && songData.slides) {
        const fullLyrics = Array.isArray(songData.slides) ? songData.slides.join(' ') : songData.slides;
        if (/[^\u0000-\u007F]/.test(fullLyrics)) {
            searchContent = transliterate(fullLyrics);
        }
    }

    const finalSong = { ...songData, title, romanizedTitle, searchContent, titleNormalized: normalize(title), updatedAt: Date.now() };

    // Update in merged cache
    songsCache = songsCache.map(s => s.id === finalSong.id ? finalSong : s);
    scheduleCache = scheduleCache.map(item => item.songId === finalSong.id ? { ...item, title } : item);

    // If editing a bundled song, store the override in custom; otherwise update custom directly
    const existingCustomIdx = customSongsCache.findIndex(s => s.id === finalSong.id);
    if (existingCustomIdx >= 0) {
        customSongsCache[existingCustomIdx] = { ...finalSong, isCustom: true };
    } else {
        // Must be a bundled song being edited for the first time
        customSongsCache.push({ ...finalSong, isCustom: true });
    }

    saveCustomSongs();
    saveLocalSchedule();

    return finalSong;
}

async function getNextId(category) {
    const prefix = getCategoryPrefix(category);
    const existingIds = songsCache
        .map(s => s.id)
        .filter(id => id.startsWith(prefix) && /^\d+$/.test(id.replace(prefix, '')))
        .map(id => parseInt(id.replace(prefix, '')))
        .sort((a, b) => a - b);

    const nextNum = existingIds.length > 0 ? existingIds[existingIds.length - 1] + 1 : 1;
    return `${prefix}${nextNum}`;
}

async function recategorizeSong(songId, newCategory) {
    const song = getSong(songId);
    if (!song || song.category === newCategory) return song;

    const newId = await getNextId(newCategory);
    const updatedSong = { ...song, id: newId, category: newCategory, updatedAt: Date.now(), isCustom: true };

    // Remove old from songsCache, add new
    songsCache = songsCache.filter(s => s.id !== songId);
    songsCache.push(updatedSong);

    // If it was a bundled song, soft-delete the original and add as custom
    if (bundledSongIds.has(songId)) {
        if (!deletedBundledIds.includes(songId)) {
            deletedBundledIds.push(songId);
            saveDeletedBundled();
        }
        // Remove any existing custom override for old ID
        customSongsCache = customSongsCache.filter(s => s.id !== songId);
    } else {
        // Was a custom song — remove old entry
        customSongsCache = customSongsCache.filter(s => s.id !== songId);
    }
    // Add recategorized song as custom
    customSongsCache.push(updatedSong);

    scheduleCache = scheduleCache.map(i => i.songId === songId ? { ...i, songId: newId, category: newCategory } : i);

    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveCustomSongs();
    saveLocalSchedule();

    return updatedSong;
}

async function deleteSong(id) {
    const song = songsCache.find(s => s.id === id);
    
    // Save to recycle bin before deleting
    if (song) {
        try {
            saveToRecycleBin(song);
        } catch (e) { console.error('Recycle bin save failed:', e); }
    }

    // Remove from merged cache
    songsCache = songsCache.filter(s => s.id !== id);
    scheduleCache = scheduleCache.filter(i => i.songId !== id);

    // Handle bundled vs custom
    if (bundledSongIds.has(id)) {
        // Soft-delete bundled song
        if (!deletedBundledIds.includes(id)) {
            deletedBundledIds.push(id);
            saveDeletedBundled();
        }
        // Also remove any custom override
        customSongsCache = customSongsCache.filter(s => s.id !== id);
    } else {
        // Hard-delete custom song
        customSongsCache = customSongsCache.filter(s => s.id !== id);
    }

    saveCustomSongs();
    saveLocalSchedule();

    return true;
}

async function bulkDeleteSongs(ids) {
    // Save all songs to recycle bin before deleting
    try {
        const songsToDelete = songsCache.filter(s => ids.includes(s.id));
        for (const song of songsToDelete) {
            saveToRecycleBin(song);
        }
    } catch (e) { console.error('Recycle bin bulk save failed:', e); }

    // Separate bundled vs custom IDs
    const bundledToDelete = ids.filter(id => bundledSongIds.has(id));
    const customToDelete = ids.filter(id => !bundledSongIds.has(id));

    // Soft-delete bundled songs
    for (const id of bundledToDelete) {
        if (!deletedBundledIds.includes(id)) deletedBundledIds.push(id);
    }
    if (bundledToDelete.length > 0) saveDeletedBundled();

    // Remove from caches
    songsCache = songsCache.filter(s => !ids.includes(s.id));
    customSongsCache = customSongsCache.filter(s => !ids.includes(s.id));
    scheduleCache = scheduleCache.filter(item => !ids.includes(item.songId));
    saveCustomSongs();
    saveLocalSchedule();

    return { deleted: ids.length };
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

function getSchedule() {
    return scheduleCache;
}

function getScheduleUpdatedAt() {
    return localScheduleUpdatedAt;
}

async function addToSchedule(songId) {
    const song = getSong(songId);
    if (!song) throw new Error('Song not found');
    
    // Ensure we have a clean title, fallback to preview or ID if completely missing
    // mobile uses displayTitle, our desktop app uses title.
    const displayTitle = song.displayTitle || song.title || song.preview || song.titleNormalized || (song.slides && song.slides[0] ? song.slides[0].split('\n')[0] : song.id);
    
    const newItem = { 
        instanceId: Date.now().toString(), 
        songId: song.id, 
        title: displayTitle, 
        category: song.category 
    };
    
    scheduleCache = [...scheduleCache, newItem];
    saveLocalSchedule();

    return scheduleCache;
}

async function addBibleToSchedule(title, slides) {
    const newItem = {
        instanceId: Date.now().toString(),
        songId: `bible-${Date.now()}`,
        title: title,
        category: 'Bible Reading',
        isBibleReading: true,
        slides: slides
    };

    scheduleCache = [...scheduleCache, newItem];
    saveLocalSchedule();

    return scheduleCache;
}

async function removeFromSchedule(instanceId) {
    scheduleCache = scheduleCache.filter(i => i.instanceId !== instanceId);
    saveLocalSchedule();
    return scheduleCache;
}

async function reorderSchedule(newSchedule) {
    scheduleCache = newSchedule;
    saveLocalSchedule();
    return scheduleCache;
}

async function clearSchedule() {
    scheduleCache = [];
    saveLocalSchedule();
    return [];
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncSongs() {
    return { success: true, count: songsCache.length };
}

function getDbStatus() {
    broadcastDbStatus(); // Refresh status on query
    return { status: 'local-mode', authenticated: true, isOffline: true };
}

// ─── Recycle Bin ──────────────────────────────────────────────────────────────

const MAX_RECYCLE_BIN = 50;

function loadRecycleBin() {
    try {
        if (DELETED_SONGS_PATH && fs.existsSync(DELETED_SONGS_PATH)) {
            return JSON.parse(fs.readFileSync(DELETED_SONGS_PATH, 'utf-8'));
        }
    } catch (e) { console.error('Failed to load recycle bin:', e); }
    return [];
}

function saveRecycleBin(bin) {
    try {
        if (DELETED_SONGS_PATH) {
            fs.writeFileSync(DELETED_SONGS_PATH, JSON.stringify(bin, null, 2));
        }
    } catch (e) { console.error('Failed to save recycle bin:', e); }
}

function saveToRecycleBin(song) {
    const bin = loadRecycleBin();
    bin.unshift({ ...song, deletedAt: Date.now() });
    // Cap at MAX_RECYCLE_BIN entries (FIFO)
    while (bin.length > MAX_RECYCLE_BIN) bin.pop();
    saveRecycleBin(bin);
}

function getDeletedSongs() {
    return loadRecycleBin();
}

async function restoreSong(deletedSongId) {
    const bin = loadRecycleBin();
    const idx = bin.findIndex(s => s.id === deletedSongId || s.deletedAt?.toString() === deletedSongId);
    if (idx === -1) throw new Error('Song not found in recycle bin');

    const song = bin[idx];
    bin.splice(idx, 1);
    saveRecycleBin(bin);

    // Assign a new sequential ID in the song's original category
    const category = song.category || 'English Choruses';
    const newId = await getNextId(category);

    // Clean up recycle bin metadata
    const { deletedAt, ...songData } = song;
    const restoredSong = { ...songData, id: newId, updatedAt: Date.now(), isCustom: true };

    // If restoring a bundled song, remove it from deleted list so it reappears
    if (bundledSongIds.has(song.id)) {
        deletedBundledIds = deletedBundledIds.filter(id => id !== song.id);
        saveDeletedBundled();
    }

    // Add to both caches as a custom song
    customSongsCache.push(restoredSong);
    songsCache.push(restoredSong);
    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveCustomSongs();

    return restoredSong;
}

function clearDeletedSongs() {
    saveRecycleBin([]);
    return true;
}

// ─── App Settings ─────────────────────────────────────────────────────────────

function getAppSettings() {
    return { forceOffline: forceOfflineMode, playstoreLink, projectorDisplayId };
}

function saveAppSettings() {
    try {
        if (APP_SETTINGS_PATH) {
            fs.writeFileSync(APP_SETTINGS_PATH, JSON.stringify({ 
                forceOffline: forceOfflineMode,
                playstoreLink,
                projectorDisplayId,
                adminCredentials: adminCredentials 
            }, null, 2));
        }
    } catch (e) { console.error('Failed to save app settings:', e); }
}

function setForceOffline(isForceOffline) {
    forceOfflineMode = isForceOffline;
    saveAppSettings();
    return { success: true };
}

function setPlaystoreLink(link) {
    playstoreLink = link;
    saveAppSettings();
    return { success: true };
}

function setProjectorDisplayId(id) {
    projectorDisplayId = id;
    saveAppSettings();
    return { success: true };
}

module.exports = {
    initDb,
    searchSongs,
    getSong,
    addSong,
    updateSong,
    deleteSong,
    bulkDeleteSongs,
    recategorizeSong,
    getNextId,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getUncategorizedSongs,
    getAdminCredentials,
    setAdminCredentials,
    verifyAdminCredentials,
    getSchedule,
    getScheduleUpdatedAt,
    addToSchedule,
    addBibleToSchedule,
    removeFromSchedule,
    reorderSchedule,
    clearSchedule,
    getDbStatus,
    syncSongs,
    checkNetwork,
    getCategoryPrefix,
    getDeletedSongs,
    restoreSong,
    clearDeletedSongs,
    getAppSettings,
    setForceOffline,
    setPlaystoreLink,
    setProjectorDisplayId
};
