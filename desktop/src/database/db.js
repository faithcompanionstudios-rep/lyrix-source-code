const { db, auth } = require('../firebaseConfig.js');
const { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, getDoc, query, orderBy, writeBatch, getDocFromCache } = require('firebase/firestore');
const { signInAnonymously } = require('firebase/auth');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

let SONGS_BACKUP_PATH;
let SCHEDULE_BACKUP_PATH;
let CATEGORIES_BACKUP_PATH;

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
            status: isOffline ? 'disconnected' : dbStatus,
            authenticated: !!auth.currentUser,
            isOffline: isOffline
        });
    }
}

async function checkNetwork() {
    // Use a raw TCP connection to a known IP to bypass ALL caching (OS, router, DNS)
    // 8.8.8.8:53 is Google's public DNS - a well-known, reliable endpoint
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = 2500;
        let done = false;

        const onOnline = () => {
            if (done) return;
            done = true;
            socket.destroy();
            if (isOffline) {
                isOffline = false;
                console.log('Network Status: Connected');
                broadcastDbStatus();
                if (!auth.currentUser) ensureAuth().catch(() => { });
            }
            resolve(true);
        };

        const onOffline = () => {
            if (done) return;
            done = true;
            socket.destroy();
            if (!isOffline) {
                isOffline = true;
                console.log('Network Status: Disconnected');
                broadcastDbStatus();
            }
            resolve(false);
        };

        socket.setTimeout(timeout);
        socket.once('connect', onOnline);
        socket.once('timeout', onOffline);
        socket.once('error', onOffline);
        socket.connect(53, '8.8.8.8');
    });
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

// ─── Auth ────────────────────────────────────────────────────────────────────

async function ensureAuth() {
    if (isOffline) return;
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
            broadcastDbStatus();
            authPromise = null;
            throw err;
        });
    return authPromise;
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function initDb(userDataPath) {
    console.log('Initializing DB with persistent storage...');

    // Set up persistent paths
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    SONGS_BACKUP_PATH = path.join(dataDir, 'songs.json');
    SCHEDULE_BACKUP_PATH = path.join(dataDir, 'schedule.json');
    CATEGORIES_BACKUP_PATH = path.join(dataDir, 'categories.json');

    // Load local backups IMMEDIATELY
    try {
        if (fs.existsSync(SONGS_BACKUP_PATH)) {
            const local = JSON.parse(fs.readFileSync(SONGS_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(local)) {
                songsCache = local;
                if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
            }
        }
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
        console.error('Failed to load local backups:', err);
    }

    // Initial network check
    await checkNetwork();

    // Start background auth and listeners
    ensureAuth()
        .then(() => loadConfig())
        .then(() => {
            // Subscribe to Songs
            const songsQuery = query(collection(db, 'songs'), orderBy('id'));
            onSnapshot(songsQuery, (snapshot) => {
                if (snapshot.metadata.fromCache && isOffline) return;
                
                const remoteSongs = snapshot.docs.map(d => d.data());
                
                // Smart Merge (Last-Write-Wins)
                let hasChanges = false;
                const newCache = [...songsCache];
                
                remoteSongs.forEach(remoteSong => {
                    const localIndex = newCache.findIndex(s => s.id === remoteSong.id);
                    if (localIndex === -1) {
                        // New song from remote
                        newCache.push(remoteSong);
                        hasChanges = true;
                    } else {
                        const localSong = newCache[localIndex];
                        // Only update if remote is strictly newer
                        if ((remoteSong.updatedAt || 0) > (localSong.updatedAt || 0)) {
                            newCache[localIndex] = remoteSong;
                            hasChanges = true;
                        }
                    }
                });

                if (hasChanges) {
                    songsCache = newCache;
                    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
                    fs.writeFileSync(SONGS_BACKUP_PATH, JSON.stringify(songsCache, null, 2));
                    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
                }
            }, (err) => console.error('Songs listener error:', err));

            // Subscribe to Schedule
            const scheduleRef = doc(db, 'schedules', 'sunday-service');
            onSnapshot(scheduleRef, (snap) => {
                if (snap.exists() && (!snap.metadata.fromCache || !isOffline)) {
                    const remoteSchedule = snap.data().items || [];
                    
                    // Simple logic: if local schedule is DIFFERENT from remote, but we are just connecting,
                    // we should check if we had pending local changes.
                    // For now, we use a simple 'Remote Wins' but ONLY if the local data isn't newer.
                    // Since schedule is a single document, we'll check its updatedAt if available.
                    
                    const remoteUpdatedAt = snap.data().updatedAt || 0;
                    
                    // To prevent the "wipeout" bug: 
                    if (remoteSchedule.length === 0 && scheduleCache.length > 0 && !snap.data().updatedAt) {
                        console.log('Sync: Preserving local schedule from wipeout');
                        return;
                    }

                    // Smart Merge: Only overwrite if remote is truly newer
                    if (remoteUpdatedAt > localScheduleUpdatedAt) {
                        console.log('Sync: Updating local schedule from Cloud');
                        scheduleCache = remoteSchedule;
                        localScheduleUpdatedAt = remoteUpdatedAt;
                        // Persist with metadata
                        const data = { items: scheduleCache, updatedAt: localScheduleUpdatedAt };
                        fs.writeFileSync(SCHEDULE_BACKUP_PATH, JSON.stringify(data, null, 2));
                        if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
                    } else if (localScheduleUpdatedAt > remoteUpdatedAt && !isOffline) {
                        // Local is newer, push to cloud
                        console.log('Sync: Pushing local schedule to Cloud');
                        setDoc(scheduleRef, { items: scheduleCache, updatedAt: localScheduleUpdatedAt });
                    }
                    // Removed redundant write that was stripping metadata
                }
            });
        })
        .catch(err => console.log("Init sequence: offline or auth failed, using local cache."));

    return true;
}

async function loadConfig() {
    try {
        const configRef = doc(db, 'config', 'app-config');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            const data = configSnap.data();
            if (Array.isArray(data.categories)) {
                categoriesCache = data.categories;
                fs.writeFileSync(CATEGORIES_BACKUP_PATH, JSON.stringify(categoriesCache, null, 2));
            }
        }

        const adminRef = doc(db, 'config', 'admin-credentials');
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
            adminCredentials = adminSnap.data();
        }
    } catch (err) {
        console.error('Failed to load config from Firebase:', err);
    }
}

// ─── Optimistic Updates ──────────────────────────────────────────────────────

function saveLocalSongs() {
    try { fs.writeFileSync(SONGS_BACKUP_PATH, JSON.stringify(songsCache, null, 2)); } catch (e) { }
    if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
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

    // Background Firebase
    if (!isOffline) {
        setDoc(doc(db, 'config', 'app-config'), { categories: categoriesCache }, { merge: true }).catch(e => console.error(e));
    }
    return categoriesCache;
}

async function updateCategory(oldName, newName) {
    const trimmed = capitalizeFirst(newName.trim());
    if (!trimmed) throw new Error('Invalid category name');

    // Optimistic
    categoriesCache = categoriesCache.map(c => c === oldName ? trimmed : c);
    songsCache = songsCache.map(s => s.category === oldName ? { ...s, category: trimmed, updatedAt: Date.now() } : s);
    scheduleCache = scheduleCache.map(i => i.category === oldName ? { ...i, category: trimmed } : i);

    saveLocalCategories();
    saveLocalSongs();
    saveLocalSchedule();

    // Background Firebase
    if (!isOffline) {
        try {
            await ensureAuth();
            await setDoc(doc(db, 'config', 'app-config'), { categories: categoriesCache }, { merge: true });

            // Batch update songs in Firebase
            const affectedSongs = songsCache.filter(s => s.category === trimmed);
            if (affectedSongs.length > 0) {
                let batches = [writeBatch(db)];
                let cur = batches[0];
                let count = 0;
                for (const s of affectedSongs) {
                    if (count >= 490) { cur = writeBatch(db); batches.push(cur); count = 0; }
                    cur.set(doc(db, 'songs', s.id), s, { merge: true });
                    count++;
                }
                cur.set(doc(db, 'schedules', 'sunday-service'), { items: scheduleCache });
                await Promise.all(batches.map(b => b.commit()));
            }
        } catch (e) { console.error("Firebase sync failed:", e); }
    }
    return categoriesCache;
}

async function deleteCategory(name) {
    // Optimistic
    categoriesCache = categoriesCache.filter(c => c !== name);
    saveLocalCategories();

    if (!isOffline) {
        setDoc(doc(db, 'config', 'app-config'), { categories: categoriesCache }, { merge: true }).catch(e => console.error(e));
    }
    return categoriesCache;
}

function getUncategorizedSongs() {
    return songsCache.filter(s => !categoriesCache.includes(s.category));
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function getAdminCredentials() {
    return adminCredentials || { ...DEFAULT_ADMIN };
}

async function setAdminCredentials(username, plainPassword) {
    const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
    const creds = { username: username.trim(), passwordHash };
    adminCredentials = creds;
    if (!isOffline) await setDoc(doc(db, 'config', 'admin-credentials'), creds);
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

function performRobustSearch(queryStr, source, preferredCategory = null) {
    const qNorm = normalize(queryStr);
    const tokens = qNorm.split(' ').filter(t => t.length > 0);
    if (tokens.length === 0) return source.slice(0, 2000);

    const scored = source.map(song => {
        const titleNorm = normalize(song.title || '');
        const idNorm = normalize(song.id || '');
        const slidesArray = Array.isArray(song.slides) ? song.slides : [song.slides || ''];
        const lyricsNorm = normalize(slidesArray.join(' '));
        const catNorm = normalize(song.category || '');

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
        if (titleNorm === qNorm) {
            score += 100;
        } else if (titleNorm.startsWith(qNorm)) {
            score += 80;
        } else if (titleNorm.includes(qNorm)) {
            // Prevent '7' matching '70' in title if query is numeric
            if (!isQueryOnlyDigits || (titleNorm.match(new RegExp(`\\b${qNorm}\\b`)))) {
                score += 60;
            }
        }

        // 5. Tokenized Title Match
        if (score < 60 && tokens.every(t => titleNorm.includes(t))) {
            score += 40;
        }

        // 6. Lyrics Content Match
        if (lyricsNorm.includes(qNorm)) {
            score += 20;
        } else if (tokens.length > 1 && tokens.every(t => lyricsNorm.includes(t))) {
            score += 10;
        }

        // 7. Category Text Match
        if (tokens.every(t => catNorm.includes(t))) {
            score += 5;
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

    const finalSong = { ...songData, title, titleNormalized: titleNorm, updatedAt: Date.now() };

    // Optimistic
    songsCache.push(finalSong);
    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveLocalSongs();

    // Background
    if (!isOffline) {
        ensureAuth().then(() => setDoc(doc(db, 'songs', finalSong.id), finalSong)).catch(e => console.error(e));
    }
    return finalSong;
}

async function updateSong(songData) {
    const title = capitalizeFirst((songData.title || '').trim());
    if (!title) throw new Error('Title is required');

    const finalSong = { ...songData, title, titleNormalized: normalize(title), updatedAt: Date.now() };

    // Optimistic
    songsCache = songsCache.map(s => s.id === finalSong.id ? finalSong : s);
    scheduleCache = scheduleCache.map(item => item.songId === finalSong.id ? { ...item, title } : item);
    saveLocalSongs();
    saveLocalSchedule();

    // Background
    if (!isOffline) {
        ensureAuth().then(() => {
            setDoc(doc(db, 'songs', finalSong.id), finalSong, { merge: true });
            setDoc(doc(db, 'schedules', 'sunday-service'), { items: scheduleCache });
        }).catch(e => console.error(e));
    }
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

    const oldPrefix = getCategoryPrefix(song.category);
    const match = songId.match(/^([a-zA-Z]+)(\d+)$/);
    if (!match) throw new Error('Invalid ID format');
    const deletedNum = parseInt(match[2]);

    const newId = await getNextId(newCategory);
    const updatedSong = { ...song, id: newId, category: newCategory, updatedAt: Date.now() };

    // Shift logic (Optimistic)
    songsCache = songsCache.filter(s => s.id !== songId);
    songsCache.push(updatedSong);

    const toShift = songsCache.filter(s => {
        const m = s.id.match(/^([a-zA-Z]+)(\d+)$/);
        return m && m[1] === oldPrefix && parseInt(m[2]) > deletedNum;
    }).sort((a, b) => parseInt(a.id.match(/\d+/)[0]) - parseInt(b.id.match(/\d+/)[0]));

    for (const s of toShift) {
        const num = parseInt(s.id.match(/\d+/)[0]);
        const shiftedId = `${oldPrefix}${num - 1}`;
        songsCache = songsCache.map(i => i.id === s.id ? { ...i, id: shiftedId } : i);
        scheduleCache = scheduleCache.map(i => i.songId === s.id ? { ...i, songId: shiftedId } : i);
    }

    scheduleCache = scheduleCache.map(i => i.songId === songId ? { ...i, songId: newId, category: newCategory } : i);

    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveLocalSongs();
    saveLocalSchedule();

    // Background Firebase
    if (!isOffline) {
        ensureAuth().then(async () => {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'songs', songId));
            batch.set(doc(db, 'songs', newId), updatedSong);
            
            // Shift logic in Firebase (Atomic)
            for (const s of toShift) {
                const num = parseInt(s.id.match(/\d+/)[0]);
                const oldId = s.id;
                const shiftedId = `${oldPrefix}${num - 1}`;
                const shiftedSong = { ...s, id: shiftedId, updatedAt: Date.now() };
                batch.delete(doc(db, 'songs', oldId));
                batch.set(doc(db, 'songs', shiftedId), shiftedSong);
            }
            
            batch.set(doc(db, 'schedules', 'sunday-service'), { 
                items: scheduleCache,
                updatedAt: Date.now()
            });
            await batch.commit();
        }).catch(e => console.error("Firebase recategorize failed:", e));
    }

    return updatedSong;
}

async function deleteSong(id) {
    const match = id.match(/^([a-zA-Z]+)(\d+)$/);
    if (!match) {
        songsCache = songsCache.filter(s => s.id !== id);
        saveLocalSongs();
        if (!isOffline) deleteDoc(doc(db, 'songs', id)).catch(e => console.error(e));
        return true;
    }

    const prefix = match[1];
    const deletedNum = parseInt(match[2]);

    // Optimistic Shift
    songsCache = songsCache.filter(s => s.id !== id);
    const toShift = songsCache.filter(s => {
        const m = s.id.match(/^([a-zA-Z]+)(\d+)$/);
        return m && m[1] === prefix && parseInt(m[2]) > deletedNum;
    }).sort((a, b) => parseInt(a.id.match(/\d+/)[0]) - parseInt(b.id.match(/\d+/)[0]));

    for (const s of toShift) {
        const num = parseInt(s.id.match(/\d+/)[0]);
        const newId = `${prefix}${num - 1}`;
        songsCache = songsCache.map(i => i.id === s.id ? { ...i, id: newId } : i);
        scheduleCache = scheduleCache.map(i => i.songId === s.id ? { ...i, songId: newId } : i);
    }
    scheduleCache = scheduleCache.filter(i => i.songId !== id);

    songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    saveLocalSongs();
    saveLocalSchedule();

    if (!isOffline) {
        ensureAuth().then(async () => {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'songs', id));
            
            // Shift items in Firebase (Atomic)
            for (const s of toShift) {
                const num = parseInt(s.id.match(/\d+/)[0]);
                const oldId = s.id;
                const newId = `${prefix}${num - 1}`;
                const shiftedSong = { ...s, id: newId, updatedAt: Date.now() };
                batch.delete(doc(db, 'songs', oldId));
                batch.set(doc(db, 'songs', newId), shiftedSong);
            }
            
            batch.set(doc(db, 'schedules', 'sunday-service'), { 
                items: scheduleCache,
                updatedAt: Date.now()
            });
            await batch.commit();
        }).catch(e => console.error("Firebase delete failed:", e));
    }
    return true;
}

async function bulkDeleteSongs(ids) {
    songsCache = songsCache.filter(s => !ids.includes(s.id));
    scheduleCache = scheduleCache.filter(item => !ids.includes(item.songId));
    saveLocalSongs();
    saveLocalSchedule();

    if (!isOffline) {
        ensureAuth().then(async () => {
            let batches = [writeBatch(db)];
            let cur = batches[0];
            let count = 0;
            for (const id of ids) {
                if (count >= 490) { cur = writeBatch(db); batches.push(cur); count = 0; }
                cur.delete(doc(db, 'songs', id));
                count++;
            }
            cur.set(doc(db, 'schedules', 'sunday-service'), { items: scheduleCache });
            await Promise.all(batches.map(b => b.commit()));
        });
    }
    return { deleted: ids.length };
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

function getSchedule() {
    return scheduleCache;
}

async function addToSchedule(songId) {
    const song = getSong(songId);
    if (!song) throw new Error('Song not found');
    
    // Ensure we have a clean title, fallback to ID if completely missing
    const displayTitle = song.title || song.titleNormalized || song.id;
    
    const newItem = { 
        instanceId: Date.now().toString(), 
        songId: song.id, 
        title: displayTitle, 
        category: song.category 
    };
    
    scheduleCache = [...scheduleCache, newItem];
    saveLocalSchedule();

    if (!isOffline) {
        ensureAuth().then(() => setDoc(doc(db, 'schedules', 'sunday-service'), { 
            items: scheduleCache,
            updatedAt: Date.now()
        }));
    }
    return scheduleCache;
}

async function removeFromSchedule(instanceId) {
    scheduleCache = scheduleCache.filter(i => i.instanceId !== instanceId);
    saveLocalSchedule();
    if (!isOffline) {
        ensureAuth().then(() => setDoc(doc(db, 'schedules', 'sunday-service'), { 
            items: scheduleCache,
            updatedAt: Date.now()
        }));
    }
    return scheduleCache;
}

async function reorderSchedule(newSchedule) {
    scheduleCache = newSchedule;
    saveLocalSchedule();
    if (!isOffline) {
        ensureAuth().then(() => setDoc(doc(db, 'schedules', 'sunday-service'), { 
            items: scheduleCache,
            updatedAt: Date.now()
        }));
    }
    return scheduleCache;
}

async function clearSchedule() {
    scheduleCache = [];
    saveLocalSchedule();
    if (!isOffline) {
        ensureAuth().then(() => setDoc(doc(db, 'schedules', 'sunday-service'), { 
            items: [],
            updatedAt: Date.now()
        }));
    }
    return [];
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncSongs() {
    if (!await checkNetwork()) throw new Error("Cannot sync: Hardware is offline.");

    console.log('Synchronizing with Cloud...');
    await ensureAuth();

    // 1. Pull latest from Cloud
    const snapshot = await getDocs(query(collection(db, 'songs'), orderBy('id')));
    const remoteSongs = snapshot.docs.map(d => d.data());

    // 2. Bidirectional Merge (Last-Write-Wins)
    const remoteMap = new Map(remoteSongs.map(s => [s.id, s]));
    const localMap = new Map(songsCache.map(s => [s.id, s]));
    
    let hasLocalChanges = false;
    let hasRemoteChanges = false;
    const batch = writeBatch(db);
    let batchCount = 0;

    // Check remote songs vs local
    remoteSongs.forEach(remoteSong => {
        const localSong = localMap.get(remoteSong.id);
        if (!localSong) {
            // New song from cloud
            songsCache.push(remoteSong);
            hasLocalChanges = true;
        } else if ((remoteSong.updatedAt || 0) > (localSong.updatedAt || 0)) {
            // Cloud is newer
            songsCache = songsCache.map(s => s.id === remoteSong.id ? remoteSong : s);
            hasLocalChanges = true;
        } else if ((localSong.updatedAt || 0) > (remoteSong.updatedAt || 0)) {
            // Local is newer, push to cloud
            if (batchCount < 490) {
                batch.set(doc(db, 'songs', localSong.id), localSong);
                batchCount++;
                hasRemoteChanges = true;
            }
        }
    });

    // Check local songs that don't exist in remote
    songsCache.forEach(localSong => {
        if (!remoteMap.has(localSong.id)) {
            // Local-only song, push to cloud
            if (batchCount < 490) {
                batch.set(doc(db, 'songs', localSong.id), localSong);
                batchCount++;
                hasRemoteChanges = true;
            }
        }
    });

    if (hasRemoteChanges) await batch.commit();
    if (hasLocalChanges) {
        songsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
        saveLocalSongs();
    }

    // Sync Categories & Schedule
    await loadConfig();
    saveLocalCategories();

    // Pull final schedule (LWW)
    const scheduleSnap = await getDoc(doc(db, 'schedules', 'sunday-service'));
    if (scheduleSnap.exists()) {
        const remoteSched = scheduleSnap.data();
        if ((remoteSched.updatedAt || 0) > (scheduleCache.updatedAt || 0)) {
           scheduleCache = remoteSched.items || [];
           saveLocalSchedule();
        }
    }

    return { success: true, count: songsCache.length };
}

function getDbStatus() {
    broadcastDbStatus(); // Refresh status on query
    return { status: isOffline ? 'disconnected' : dbStatus, authenticated: !!auth.currentUser, isOffline };
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
    checkNetwork,
    getCategoryPrefix
};
