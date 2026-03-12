const { db, auth } = require('../firebaseConfig.js');
const { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, getDoc, query, orderBy, writeBatch, getDocFromCache } = require('firebase/firestore');
const { signInAnonymously } = require('firebase/auth');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SONGS_BACKUP_PATH = path.join(__dirname, 'songs.json');
const SCHEDULE_BACKUP_PATH = path.join(__dirname, 'schedule.json');
const CATEGORIES_BACKUP_PATH = path.join(__dirname, 'categories.json');

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
    passwordHash: crypto.createHash('sha256').update('admin').digest('hex')
};

let songsCache = [];
let scheduleCache = [];
let categoriesCache = [...DEFAULT_CATEGORIES];
let adminCredentials = null;
let dbStatus = 'connecting';
let authPromise = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function broadcastDbStatus() {
    if (global.broadcastDbStatus) {
        global.broadcastDbStatus({ status: dbStatus, authenticated: !!auth.currentUser });
    }
}

const normalize = (text) => {
    if (!text) return '';
    return text.toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const capitalizeFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Get the prefix for a given category name
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
    // For custom categories: use first 2 uppercase letters
    const words = category.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return category.substring(0, 2).toUpperCase();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function ensureAuth() {
    if (auth.currentUser) {
        if (dbStatus !== 'connected') { dbStatus = 'connected'; broadcastDbStatus(); }
        return;
    }
    if (authPromise) return authPromise;

    dbStatus = 'authenticating';
    broadcastDbStatus();

    authPromise = signInAnonymously(auth)
        .then(() => {
            dbStatus = 'connected';
            broadcastDbStatus();
            authPromise = null;
        })
        .catch(err => {
            dbStatus = 'auth_error';
            if (global.broadcastDbStatus) {
                const errorDetail = err.code ? `[${err.code}] ${err.message}` : err.message || JSON.stringify(err);
                global.broadcastDbStatus({ status: 'auth_error', authenticated: false, error: errorDetail });
            }
            authPromise = null;
            throw err;
        });
    return authPromise;
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function initDb() {
    console.log('Initializing DB cache...');

    // OFFLINE FIRST: Load local backups immediately
    try {
        if (fs.existsSync(SONGS_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(SONGS_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(local) && local.length > 0) {
                songsCache = local;
                console.log(`Loaded ${songsCache.length} songs from local backup`);
                if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
            }
        }
        if (fs.existsSync(SCHEDULE_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(SCHEDULE_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(local)) {
                scheduleCache = local;
                if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
            }
        }
        if (fs.existsSync(CATEGORIES_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(CATEGORIES_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(local) && local.length > 0) categoriesCache = local;
        }
    } catch (err) {
        console.error('Failed to load local backups:', err);
    }

    try { await ensureAuth(); } catch (err) { /* logged in ensureAuth */ }

    // Load config (categories + admin credentials)
    await loadConfig();

    // Subscribe to Songs
    const songsQuery = query(collection(db, 'songs'), orderBy('id'));
    onSnapshot(songsQuery, (snapshot) => {
        const songs = snapshot.docs.map(d => d.data());
        songs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
        songsCache = songs;
        console.log(`Songs cache updated: ${songsCache.length} songs`);
        try { fs.writeFileSync(SONGS_BACKUP_PATH, JSON.stringify(songsCache, null, 2)); } catch (e) { }
        if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
    }, (err) => console.error('Songs listener error:', err));

    // Subscribe to Schedule
    const scheduleRef = doc(db, 'schedules', 'sunday-service');
    onSnapshot(scheduleRef, (snap) => {
        if (snap.exists()) {
            scheduleCache = snap.data().items || [];
            try { fs.writeFileSync(SCHEDULE_BACKUP_PATH, JSON.stringify(scheduleCache, null, 2)); } catch (e) { }
            if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
        } else {
            setDoc(scheduleRef, { items: [] });
            scheduleCache = [];
        }
    });

    return true;
}

async function loadConfig() {
    try {
        const configRef = doc(db, 'config', 'app-config');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            if (Array.isArray(data.categories) && data.categories.length > 0) {
                categoriesCache = data.categories;
                fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2));
            }
        } else {
            // First launch — create default config
            await setDoc(configRef, { categories: DEFAULT_CATEGORIES, version: '1.3.9' });
            categoriesCache = [...DEFAULT_CATEGORIES];
            fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2));
            console.log('Created default app config in Firestore');
        }

        // Load admin credentials
        const adminRef = doc(db, 'config', 'admin-credentials');
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
            adminCredentials = adminSnap.data();
        } else {
            await setDoc(adminRef, DEFAULT_ADMIN);
            adminCredentials = { ...DEFAULT_ADMIN };
            console.log('Created default admin credentials in Firestore');
        }
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

// ─── Categories ──────────────────────────────────────────────────────────────

function getCategories() {
    return categoriesCache;
}

async function addCategory(name) {
    const trimmed = capitalizeFirst(name.trim());
    if (!trimmed || categoriesCache.includes(trimmed)) throw new Error('Category already exists or invalid name');
    const newCategories = [...categoriesCache, trimmed];
    await setDoc(doc(db, 'config', 'app-config'), { categories: newCategories }, { merge: true });
    categoriesCache = newCategories;
    try { fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2)); } catch (e) { }
    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    return categoriesCache;
}

async function updateCategory(oldName, newName) {
    await ensureAuth();
    const trimmed = capitalizeFirst(newName.trim());
    if (!trimmed) throw new Error('Invalid category name');

    // 1. Update categories config
    const newCategories = categoriesCache.map(c => c === oldName ? trimmed : c);
    await setDoc(doc(db, 'config', 'app-config'), { categories: newCategories }, { merge: true });
    categoriesCache = newCategories;
    try { fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2)); } catch (e) { }

    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    // 2. Update category field in all affected songs without changing IDs
    const affectedSongs = songsCache.filter(s => s.category === oldName);
    if (affectedSongs.length > 0) {
        let batches = [writeBatch(db)];
        let current = batches[0];
        let opsCount = 0;

        for (const song of affectedSongs) {
            if (opsCount >= 490) {
                current = writeBatch(db);
                batches.push(current);
                opsCount = 0;
            }
            const updatedSong = { ...song, category: trimmed, updatedAt: Date.now() };
            current.set(doc(db, 'songs', song.id), updatedSong, { merge: true });

            // Optimistic update
            songsCache = songsCache.map(s => s.id === song.id ? updatedSong : s);
            opsCount++;
        }

        // Update schedule if affected
        let currentSchedule = [...scheduleCache];
        let scheduleChanged = false;
        currentSchedule = currentSchedule.map(item => {
            if (item.category === oldName) {
                scheduleChanged = true;
                return { ...item, category: trimmed };
            }
            return item;
        });

        if (scheduleChanged) {
            scheduleCache = currentSchedule;
            if (opsCount >= 499) { current = writeBatch(db); batches.push(current); opsCount = 0; }
            current.set(doc(db, 'schedules', 'sunday-service'), { items: currentSchedule });
            if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
            opsCount++;
        }

        Promise.all(batches.map(b => b.commit()))
            .then(() => console.log(`Renamed category ${oldName} -> ${trimmed} for ${affectedSongs.length} songs`))
            .catch(e => console.error('Batch error renaming category in songs:', e));

        if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
    }

    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    return categoriesCache;
}

async function deleteCategory(name) {
    const newCategories = categoriesCache.filter(c => c !== name);
    await setDoc(doc(db, 'config', 'app-config'), { categories: newCategories }, { merge: true });
    categoriesCache = newCategories;
    try { fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2)); } catch (e) { }
    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    if (global.broadcastCategoriesUpdate) global.broadcastCategoriesUpdate(categoriesCache);
    return categoriesCache;
}

// Songs whose category is not in the current categories list
function getUncategorizedSongs() {
    return songsCache.filter(s => !categoriesCache.includes(s.category));
}

// ─── Admin Credentials ───────────────────────────────────────────────────────

function getAdminCredentials() {
    return adminCredentials || { ...DEFAULT_ADMIN };
}

async function setAdminCredentials(username, plainPassword) {
    const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
    const creds = { username: username.trim(), passwordHash };
    await setDoc(doc(db, 'config', 'admin-credentials'), creds);
    adminCredentials = creds;
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

function searchSongs(queryStr, filter = 'All') {
    const source = filter !== 'All' ? songsCache.filter(s => s.category === filter) : songsCache;
    if (!queryStr) return source.slice(0, 2000);
    return performRobustSearch(queryStr, source);
}

function performRobustSearch(queryStr, source) {
    const qNorm = normalize(queryStr);
    const tokens = qNorm.split(' ').filter(t => t.length > 0);
    if (tokens.length === 0) return source.slice(0, 2000);

    const scored = source.map(song => {
        const titleNorm = normalize(song.title || '');
        const idNorm = normalize(song.id || '');
        const isExactId = idNorm === qNorm;
        const isExactTitle = titleNorm === qNorm;
        const startsWithTitle = titleNorm.startsWith(qNorm);
        const phraseInTitle = titleNorm.includes(qNorm);
        const lyricsNorm = normalize((song.slides || []).join(' '));
        const catNorm = normalize(song.category || '');

        let score = 0;
        if (isExactId) score += 200;
        else if (isExactTitle) score += 100;
        else if (startsWithTitle) score += 80;
        else if (phraseInTitle) score += 60;
        if (score === 0 && tokens.every(t => titleNorm.includes(t))) score += 40;
        if (lyricsNorm.includes(qNorm)) score += 20;
        if (tokens.every(t => catNorm.includes(t))) score += 10;
        if (score === 0 && tokens.every(t => lyricsNorm.includes(t))) score += 5;

        return { song, score };
    });

    return scored
        .filter(r => r.score > 0)
        .sort((a, b) => b.score !== a.score ? b.score - a.score : (a.song.title || '').localeCompare(b.song.title || ''))
        .map(r => r.song)
        .slice(0, 2000);
}

async function addSong(songData) {
    await ensureAuth();

    const title = capitalizeFirst((songData.title || '').trim());
    if (!title) throw new Error('Title is required');

    // Dedup check (local cache, 0 DB reads)
    const titleNorm = normalize(title);
    const duplicate = songsCache.find(s => normalize(s.title) === titleNorm && s.id !== songData.id);
    if (duplicate) throw new Error(`A song titled "${duplicate.title}" (${duplicate.id}) already exists`);

    const finalSong = { ...songData, title, titleNormalized: titleNorm, updatedAt: Date.now() };
    await setDoc(doc(db, 'songs', finalSong.id), finalSong);
    return finalSong;
}

async function updateSong(songData) {
    await ensureAuth();

    const title = capitalizeFirst((songData.title || '').trim());
    if (!title) throw new Error('Title is required');

    const titleNorm = normalize(title);
    const duplicate = songsCache.find(s => normalize(s.title) === titleNorm && s.id !== songData.id);
    if (duplicate) throw new Error(`A song titled "${duplicate.title}" (${duplicate.id}) already exists`);

    const finalSong = { ...songData, title, titleNormalized: titleNorm, updatedAt: Date.now() };
    await setDoc(doc(db, 'songs', finalSong.id), finalSong, { merge: true });

    // If title changed, sync schedule items that reference this song
    const oldSong = songsCache.find(s => s.id === finalSong.id);
    if (oldSong && oldSong.title !== title) {
        const updatedSchedule = scheduleCache.map(item =>
            item.songId === finalSong.id ? { ...item, title } : item
        );
        if (JSON.stringify(updatedSchedule) !== JSON.stringify(scheduleCache)) {
            await setDoc(doc(db, 'schedules', 'sunday-service'), { items: updatedSchedule });
            scheduleCache = updatedSchedule;
            if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
        }
    }

    return finalSong;
}

async function getNextId(category) {
    const prefix = getCategoryPrefix(category);
    const existingIds = songsCache
        .map(s => s.id)
        .filter(id => id.startsWith(prefix) && /^\d+$/.test(id.replace(prefix, '')))
        .map(id => parseInt(id.replace(prefix, '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    const nextNum = existingIds.length > 0 ? existingIds[existingIds.length - 1] + 1 : 1;
    return `${prefix}${nextNum}`;
}

// Recategorize a song: assigns new ID in new category, renumbers old category
async function recategorizeSong(songId, newCategory) {
    await ensureAuth();

    const song = getSong(songId);
    if (!song) throw new Error('Song not found');
    if (song.category === newCategory) return song;

    const oldPrefix = getCategoryPrefix(song.category);
    const oldMatch = songId.match(/^([a-zA-Z]+)(\d+)$/);
    if (!oldMatch) throw new Error('Invalid song ID format');
    const deletedNum = parseInt(oldMatch[2]);

    // 1. Assign new ID in new category
    const newId = await getNextId(newCategory);
    const updatedSong = { ...song, id: newId, category: newCategory, updatedAt: Date.now() };

    // 2. Find songs to shift down in old category
    const songsToShift = songsCache
        .filter(s => {
            const m = s.id.match(/^([a-zA-Z]+)(\d+)$/);
            return m && m[1] === oldPrefix && parseInt(m[2]) > deletedNum;
        })
        .sort((a, b) => {
            const nA = parseInt(a.id.match(/\d+/)[0]);
            const nB = parseInt(b.id.match(/\d+/)[0]);
            return nA - nB;
        });

    // 3. Optimistic cache update
    songsCache = songsCache.filter(s => s.id !== songId);
    songsCache.push(updatedSong);

    // 4. Update schedule references
    let currentSchedule = [...scheduleCache];
    let scheduleChanged = false;
    currentSchedule = currentSchedule.map(item => {
        if (item.songId === songId) {
            scheduleChanged = true;
            return { ...item, songId: newId, category: newCategory };
        }
        return item;
    });

    // 5. Build batches
    let batches = [writeBatch(db)];
    let current = batches[0];
    let opsCount = 0;

    // Delete old, create new
    current.delete(doc(db, 'songs', songId));
    current.set(doc(db, 'songs', newId), updatedSong);
    opsCount += 2;

    // Shift old-category songs down
    for (const s of songsToShift) {
        if (opsCount >= 490) {
            current = writeBatch(db);
            batches.push(current);
            opsCount = 0;
        }
        const oldId = s.id;
        const num = parseInt(oldId.match(/\d+/)[0]);
        const shiftedId = `${oldPrefix}${num - 1}`;
        const shiftedSong = { ...s, id: shiftedId };

        // Optimistic cache update
        songsCache = songsCache.filter(s2 => s2.id !== oldId);
        songsCache.push(shiftedSong);

        current.set(doc(db, 'songs', shiftedId), shiftedSong);
        current.delete(doc(db, 'songs', oldId));
        opsCount += 2;

        // Fix schedule refs for shifted songs
        currentSchedule = currentSchedule.map(item => {
            if (item.songId === oldId) {
                scheduleChanged = true;
                return { ...item, songId: shiftedId };
            }
            return item;
        });
    }

    // Sort cache
    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    // Update schedule if changed
    if (scheduleChanged) {
        scheduleCache = currentSchedule;
        if (opsCount >= 499) { current = writeBatch(db); batches.push(current); }
        current.set(doc(db, 'schedules', 'sunday-service'), { items: currentSchedule });
        if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
    }

    // Fire and forget batches
    ensureAuth().then(() => {
        Promise.all(batches.map(b => b.commit()))
            .then(() => console.log(`Recategorized ${songId} → ${newId}, shifted ${songsToShift.length} songs`))
            .catch(e => console.error('Recategorize batch error:', e));
    });

    return updatedSong;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteSong(id) {
    songsCache = songsCache.filter(s => s.id !== id);

    const match = id.match(/^([a-zA-Z]+)(\d+)$/);
    if (!match) {
        deleteDoc(doc(db, 'songs', id)).catch(e => console.error(e));
        return true;
    }

    const prefix = match[1];
    const deletedNum = parseInt(match[2]);

    const songsToShift = songsCache
        .filter(s => {
            const m = s.id.match(/^([a-zA-Z]+)(\d+)$/);
            return m && m[1] === prefix && parseInt(m[2]) > deletedNum;
        })
        .sort((a, b) => parseInt(a.id.match(/\d+/)[0]) - parseInt(b.id.match(/\d+/)[0]));

    let currentSchedule = [...scheduleCache];
    let scheduleChanged = false;
    let batches = [writeBatch(db)];
    let current = batches[0];
    let opsCount = 1;
    current.delete(doc(db, 'songs', id));

    for (const song of songsToShift) {
        if (opsCount >= 490) { current = writeBatch(db); batches.push(current); opsCount = 0; }
        const oldId = song.id;
        const num = parseInt(oldId.match(/\d+/)[0]);
        const newId = `${prefix}${num - 1}`;
        const newSongData = { ...song, id: newId };

        songsCache = songsCache.filter(s => s.id !== oldId);
        songsCache.push(newSongData);

        current.set(doc(db, 'songs', newId), newSongData);
        current.delete(doc(db, 'songs', oldId));
        opsCount += 2;

        currentSchedule = currentSchedule.map(item => {
            if (item.songId === oldId) { scheduleChanged = true; return { ...item, songId: newId }; }
            return item;
        });
    }

    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    if (scheduleChanged) {
        scheduleCache = currentSchedule;
        if (opsCount >= 499) { current = writeBatch(db); batches.push(current); }
        current.set(doc(db, 'schedules', 'sunday-service'), { items: currentSchedule });
        if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
    }

    ensureAuth().then(() => {
        Promise.all(batches.map(b => b.commit()))
            .then(() => console.log(`Deleted ${id}, shifted ${songsToShift.length} songs`))
            .catch(e => console.error('Batch error:', e));
    });

    return true;
}

// Bulk delete multiple songs (admin panel) — no ID shifting, pure delete
async function bulkDeleteSongs(ids) {
    await ensureAuth();
    if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0 };

    let batches = [writeBatch(db)];
    let current = batches[0];
    let opsCount = 0;

    for (const id of ids) {
        if (opsCount >= 490) { current = writeBatch(db); batches.push(current); opsCount = 0; }
        current.delete(doc(db, 'songs', id));
        opsCount++;
    }

    // Optimistic: remove from cache
    songsCache = songsCache.filter(s => !ids.includes(s.id));
    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);

    // Remove from schedule if needed
    const removed = new Set(ids);
    const newSchedule = scheduleCache.filter(item => !removed.has(item.songId));
    if (newSchedule.length !== scheduleCache.length) {
        scheduleCache = newSchedule;
        current.set(doc(db, 'schedules', 'sunday-service'), { items: newSchedule });
        if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
    }

    await Promise.all(batches.map(b => b.commit()));
    console.log(`Bulk deleted ${ids.length} songs`);
    return { deleted: ids.length };
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

function getSchedule() {
    return scheduleCache;
}

async function addToSchedule(songId) {
    await ensureAuth();
    const song = getSong(songId);
    if (!song) throw new Error('Song not found');

    const newItem = {
        instanceId: Date.now().toString(),
        songId: song.id,
        title: song.title || song.preview,
        category: song.category
    };
    const newSchedule = [...scheduleCache, newItem];
    await setDoc(doc(db, 'schedules', 'sunday-service'), { items: newSchedule });
    return newSchedule;
}

async function removeFromSchedule(instanceId) {
    await ensureAuth();
    const newSchedule = scheduleCache.filter(i => i.instanceId !== instanceId);
    await setDoc(doc(db, 'schedules', 'sunday-service'), { items: newSchedule });
    return newSchedule;
}

async function reorderSchedule(newSchedule) {
    await ensureAuth();
    await setDoc(doc(db, 'schedules', 'sunday-service'), { items: newSchedule });
    return newSchedule;
}

async function clearSchedule() {
    await ensureAuth();
    await setDoc(doc(db, 'schedules', 'sunday-service'), { items: [] });
    scheduleCache = [];
    return [];
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncSongs() {
    console.log('Manual sync triggered...');
    await ensureAuth();
    const snapshot = await getDocs(query(collection(db, 'songs'), orderBy('id')));
    const songs = snapshot.docs.map(d => d.data());
    songs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    songsCache = songs;
    try { fs.writeFileSync(SONGS_BACKUP_PATH, JSON.stringify(songsCache, null, 2)); } catch (e) { }
    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
    return { success: true, count: songsCache.length };
}

function getDbStatus() {
    return { status: dbStatus, authenticated: !!auth.currentUser };
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
    addToSchedule,
    removeFromSchedule,
    reorderSchedule,
    clearSchedule,
    getDbStatus,
    syncSongs,
    getCategoryPrefix
};
