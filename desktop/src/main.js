const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, nativeTheme, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer } = require('./server/index.js');
const { initDb, searchSongs, addSong, updateSong, deleteSong, bulkDeleteSongs, recategorizeSong, getNextId, getSong, getCategories, addCategory, updateCategory, deleteCategory, getUncategorizedSongs, getAdminCredentials, setAdminCredentials, verifyAdminCredentials, getSchedule, addToSchedule, addBibleToSchedule, removeFromSchedule, reorderSchedule, clearSchedule, getDbStatus, syncSongs, checkNetwork, getDeletedSongs, restoreSong, clearDeletedSongs, getAppSettings, setForceOffline, setPlaystoreLink, setProjectorDisplayId } = require('./database/db.js');
const axios = require('axios');
const { spawn } = require('child_process');
const bibleDb = require('./database/bible_db.js');
const { setupBible } = require('./database/bible_setup.js');
const { searchLyrics, fetchLyricsContent } = require('./utils/scraper.js');
const { transliterateToNative } = require('./utils/transliterator.js');

// Global Error Handlers to prevent native Electron crash dialogs
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-error', { 
            title: 'System Error',
            message: error.message
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-error', { 
            title: 'Background Process Error',
            message: msg
        });
    }
});

const gotTheLock = app.requestSingleInstanceLock();

let mainWindow;
let io; // Declare io in module scope
let projectorWindow = null;
let helpWindow = null;
let lastBibleVerse = null; // Store last Bible verse for projector sync
let lastIsBlack = false;
let lastSlide = null;
let lastProjectorSettings = null; // Cache projector settings for new connections
let currentServerStatus = { status: 'Disconnected', ip: 'Unknown', connections: 0 };

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.webContents.send('app-running-alert');
        }
    });

    function createWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow = new BrowserWindow({
            width,
            height,
            titleBarStyle: 'hidden',
            autoHideMenuBar: true,
            title: 'LyriX Desktop',
            backgroundColor: '#ffffff',
            show: false,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                backgroundThrottling: false
            },
            icon: path.join(__dirname, '../public/icon.png')
        });

        mainWindow.once('ready-to-show', () => {
            mainWindow.maximize();
            mainWindow.show();
        });

        if (process.env.NODE_ENV === 'development') {
            mainWindow.loadURL('http://localhost:5173');
        } else {
            mainWindow.loadFile(path.join(__dirname, '../renderer_dist/index.html'));
        }

        // DevTools can still be opened via Application Controls in Settings tab

        // Set title and icon if DevTools is detached into its own window
        mainWindow.webContents.on('devtools-opened', () => {
            const devToolsWebContents = mainWindow.webContents.devToolsWebContents;
            if (devToolsWebContents) {
                const devToolsWindow = BrowserWindow.fromWebContents(devToolsWebContents);
                if (devToolsWindow && devToolsWindow !== mainWindow) {
                    const setCustomTitle = () => {
                        devToolsWindow.setTitle('LyriX Developer Console');
                        devToolsWindow.setIcon(path.join(__dirname, '../public/icon.ico'));
                    };

                    setCustomTitle();

                    devToolsWindow.on('page-title-updated', (e) => {
                        e.preventDefault();
                        setCustomTitle();
                    });
                }
            }
        });

        // App close confirmation removed for MS Store compatibility
        // Custom window control handlers (replaces native titleBarOverlay)
        ipcMain.handle('window-minimize', () => mainWindow && mainWindow.minimize());
        ipcMain.handle('window-maximize', () => {
            if (mainWindow) {
                if (mainWindow.isMaximized()) mainWindow.unmaximize();
                else mainWindow.maximize();
            }
        });
        ipcMain.handle('window-close', () => {
            if (mainWindow) mainWindow.close();
        });
        ipcMain.handle('window-is-maximized', () => mainWindow ? mainWindow.isMaximized() : false);

        // When the main window closes (crash, force-close, or normal exit),
        // ensure the projector and help windows are also destroyed
        mainWindow.on('closed', () => {
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.destroy();
            }
            if (helpWindow && !helpWindow.isDestroyed()) {
                helpWindow.destroy();
            }
            mainWindow = null;
        });
    }

    // Global hook for DB to convert updates
    global.broadcastScheduleUpdate = (schedule) => {
        if (io) {
            io.emit('schedule-updated', schedule);
        }
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => w.webContents.send('schedule-updated', schedule));
    };

    global.broadcastSongsUpdate = (songs) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => w.webContents.send('songs-updated', songs));
    };

    global.broadcastDbStatus = (status) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => w.webContents.send('db-status-updated', status));
    };

    global.broadcastCategoriesUpdate = (categories) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => w.webContents.send('categories-updated', categories));
    };

    app.whenReady().then(() => {
        if (process.platform === 'win32') {
            app.setAppUserModelId('com.lyrix.desktop');
        }
        nativeTheme.themeSource = 'light';

        // Spoof headers removed - using native webview httpreferrer instead

        session.defaultSession.webRequest.onHeadersReceived(
            { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
            (details, callback) => {
                const responseHeaders = Object.assign({}, details.responseHeaders);

                // Strip headers that prevent embedding
                const headersToRemove = ['x-frame-options', 'X-Frame-Options', 'content-security-policy', 'Content-Security-Policy'];
                headersToRemove.forEach(header => {
                    if (responseHeaders[header]) {
                        delete responseHeaders[header];
                    }
                });

                callback({ cancel: false, responseHeaders: responseHeaders });
            }
        );
        // Data Migration (src/database -> userData/data) — only schedule & categories need legacy migration
        // Songs are now split: bundled songs read from package, custom songs in userData
        const userDataPath = app.getPath('userData');
        const oldDataDir = path.join(__dirname, 'database');
        const newDataDir = path.join(userDataPath, 'data');

        if (!fs.existsSync(newDataDir)) {
            fs.mkdirSync(newDataDir, { recursive: true });
        }

        ['schedule.json', 'categories.json'].forEach(file => {
            const oldPath = path.join(oldDataDir, file);
            const newPath = path.join(newDataDir, file);
            if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
                try {
                    fs.copyFileSync(oldPath, newPath);
                    console.log(`Migrated ${file} to persistent storage`);
                } catch (e) {
                    console.error(`Failed to migrate ${file}:`, e);
                }
            }
        });

        initDb(userDataPath);

        // Setup dynamic Bible modules directory
        const biblesDir = path.join(userDataPath, 'bibles');
        if (!fs.existsSync(biblesDir)) {
            fs.mkdirSync(biblesDir, { recursive: true });
        }
        
        // Copy bundled KJV as default if no bibles exist in the user's data folder
        const defaultKjvPath = path.join(__dirname, 'database', 'bibles', 'kjv.json');
        const userKjvPath = path.join(biblesDir, 'kjv.json');
        if (fs.existsSync(defaultKjvPath) && !fs.existsSync(userKjvPath)) {
            try {
                fs.copyFileSync(defaultKjvPath, userKjvPath);
                console.log(`Copied default KJV Bible to persistent storage`);
            } catch (e) {
                console.error(`Failed to copy default KJV:`, e);
            }
        }

        // Start periodic network check
        setInterval(() => {
            checkNetwork();
        }, 3000); // Every 3s

        createWindow();
        console.log("App Ready");

        ipcMain.handle('check-for-updates', async () => {
            require('electron').shell.openExternal('ms-windows-store://pdp/?ProductId=9N4WPTQ6G7M6');
            return { isStore: true };
        });



        ipcMain.handle('get-app-version', () => {
            return app.getVersion();
        });

        // IPC Handlers for Renderer
        ipcMain.handle('search-songs', async (event, query, category, preferredCategory) => {
            return searchSongs(query, category, preferredCategory);
        });

        ipcMain.handle('get-next-id', async (event, category) => {
            return getNextId(category);
        });

        ipcMain.handle('transliterate-typing', async (event, { text, targetLanguage }) => {
            return transliterateToNative(text, targetLanguage);
        });

        ipcMain.handle('add-song', async (event, songData) => {
            return addSong(songData);
        });

        ipcMain.handle('update-song', async (event, songData) => updateSong(songData));
        ipcMain.handle('get-song', async (event, id) => getSong(id));
        ipcMain.handle('delete-song', async (event, id) => deleteSong(id));

        // Schedule Handlers
        ipcMain.handle('get-schedule', async () => getSchedule());
        ipcMain.handle('add-to-schedule', async (event, songId) => addToSchedule(songId));
        ipcMain.handle('remove-from-schedule', async (event, instanceId) => removeFromSchedule(instanceId));
        ipcMain.handle('reorder-schedule', async (event, newOrder) => reorderSchedule(newOrder));
        ipcMain.handle('clear-schedule', async () => clearSchedule());
        ipcMain.handle('get-db-status', async () => getDbStatus());

        // Category Handlers
        ipcMain.handle('get-categories', async () => getCategories());
        ipcMain.handle('add-category', async (event, name) => addCategory(name));
        ipcMain.handle('update-category', async (event, oldName, newName) => updateCategory(oldName, newName));
        ipcMain.handle('delete-category', async (event, name) => deleteCategory(name));
        ipcMain.handle('get-uncategorized-songs', async () => getUncategorizedSongs());

        // Bible Schedule Handler
        ipcMain.handle('bible:add-to-schedule', async (event, title, slides) => {
            return addBibleToSchedule(title, slides);
        });

        // Admin Handlers
        ipcMain.handle('get-admin-credentials', async () => {
            const creds = getAdminCredentials();
            return { username: creds.username, isPasswordProtected: creds.isPasswordProtected !== false }; // Never send hash to renderer
        });
        ipcMain.handle('verify-admin', async (event, username, password) => verifyAdminCredentials(username, password));
        ipcMain.handle('set-admin-credentials', async (event, username, password, isPasswordProtected) => setAdminCredentials(username, password, isPasswordProtected));

        // Bulk & Recategorize Handlers
        ipcMain.handle('bulk-delete-songs', async (event, ids) => bulkDeleteSongs(ids));
        ipcMain.handle('recategorize-song', async (event, songId, newCategory) => recategorizeSong(songId, newCategory));

        // Recycle Bin Handlers
        ipcMain.handle('get-deleted-songs', async () => getDeletedSongs());
        ipcMain.handle('restore-song', async (event, id) => restoreSong(id));
        ipcMain.handle('clear-deleted-songs', async () => clearDeletedSongs());
        // Offline Mode Settings Handlers
        ipcMain.handle('get-app-settings', async () => getAppSettings());
        ipcMain.handle('set-playstore-link', async (event, link) => setPlaystoreLink(link));
        ipcMain.handle('set-projector-display', async (event, id) => {
            setProjectorDisplayId(id);
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                const displays = screen.getAllDisplays();
                let targetDisplay = displays.find(d => String(d.id) === String(id));

                if (!targetDisplay) {
                    // Fallback to first external display or primary display if "Default" is selected
                    targetDisplay = displays.find(display => display.bounds.x !== 0 || display.bounds.y !== 0) || screen.getPrimaryDisplay();
                }

                if (targetDisplay) {
                    // Check if projector is already on the target display — skip if so
                    const currentBounds = projectorWindow.getBounds();
                    const isAlreadyOnTarget =
                        currentBounds.x >= targetDisplay.bounds.x &&
                        currentBounds.x < targetDisplay.bounds.x + targetDisplay.bounds.width &&
                        currentBounds.y >= targetDisplay.bounds.y &&
                        currentBounds.y < targetDisplay.bounds.y + targetDisplay.bounds.height;

                    if (isAlreadyOnTarget) {
                        // Already on the right display, just ensure it's fullscreen and focused
                        if (!projectorWindow.isFullScreen()) projectorWindow.setFullScreen(true);
                        setTimeout(() => {
                            if (projectorWindow && !projectorWindow.isDestroyed()) {
                                projectorWindow.setAlwaysOnTop(true, 'screen-saver');
                                projectorWindow.focus();
                            }
                        }, 300);
                        return;
                    }

                    // Most reliable approach: close and reopen on the target display.
                    // All projector state (slides, settings, background) is synced 
                    // server-side and restores automatically on reconnect.
                    projectorWindow.close();
                    // projectorWindow is set to null in the 'closed' event handler.
                    // Wait for close to fully process, then reopen on the new display.
                    setTimeout(() => {
                        openProjectorWindow();
                    }, 300);
                }
            }
        });

        ipcMain.handle('system:get-displays', async () => {
            const displays = screen.getAllDisplays();
            return displays.map((d, index) => ({
                id: d.id,
                bounds: d.bounds,
                scaleFactor: d.scaleFactor,
                isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
                label: `Display ${index + 1} ${d.bounds.x === 0 && d.bounds.y === 0 ? '(Primary)' : ''} - ${d.bounds.width}x${d.bounds.height}`
            }));
        });

        // Bible Module Handlers
        ipcMain.handle('bible:get-books', async () => {
            const books = bibleDb.getBooks();
            console.log('[Bible Debug] get-books count:', books.length);
            return books;
        });
        ipcMain.handle('bible:get-chapters', async (event, bookId) => bibleDb.getChapters(bookId));
        ipcMain.handle('bible:get-verses', async (event, translationId, bookId, chapter) => {
            const verses = bibleDb.getVerses(translationId, bookId, chapter);
            console.log(`[Bible Debug] get-verses(${translationId}, book=${bookId}, ch=${chapter}) => ${verses.length} verses, first text: "${(verses[0]?.text || '').substring(0, 50)}"`);
            return verses;
        });
        ipcMain.handle('bible:search', async (event, translationId, query) => bibleDb.searchVerses(translationId, query));
        ipcMain.handle('bible:setup-status', async () => {
            const books = bibleDb.getBooks();
            console.log('[Bible Debug] setup-status: books =', books.length, ', ready =', books.length > 0);
            return { ready: books.length > 0 };
        });
        ipcMain.handle('bible:reset-db', async () => {
            bibleDb.resetBibleDb();
            // Re-initialize the DB (creates fresh tables)
            bibleDb.initBibleDb ? bibleDb.initBibleDb() : null;
            return { success: true };
        });

        // ─── Dynamic Bible Modules Handlers ─────────────────────────────────────
        ipcMain.handle('bible:get-local-modules', async () => {
            const biblesDir = path.join(app.getPath('userData'), 'bibles');
            if (!fs.existsSync(biblesDir)) return [];
            try {
                const files = fs.readdirSync(biblesDir).filter(f => f.toLowerCase().endsWith('.json'));
                return files.map(f => {
                    const id = f.replace('.json', '');
                    const stat = fs.statSync(path.join(biblesDir, f));
                    return { id: id.toLowerCase(), fileName: f, size: stat.size, mtime: stat.mtimeMs };
                });
            } catch (e) {
                console.error("Failed to read local bibles:", e);
                return [];
            }
        });

        ipcMain.handle('bible:download-module', async (event, url, id) => {
            const biblesDir = path.join(app.getPath('userData'), 'bibles');
            const targetPath = path.join(biblesDir, `${id}.json`);
            try {
                const axios = require('axios');
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                fs.writeFileSync(targetPath, response.data);
                return { success: true };
            } catch (error) {
                console.error(`Failed to download bible ${id}:`, error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('bible:delete-module', async (event, id) => {
            const biblesDir = path.join(app.getPath('userData'), 'bibles');
            const targetPath = path.join(biblesDir, `${id}.json`);
            try {
                if (fs.existsSync(targetPath)) {
                    if (id.toLowerCase() === 'kjv') {
                        return { success: false, error: "Cannot delete the core KJV translation." };
                    }
                    fs.unlinkSync(targetPath);
                    return { success: true };
                }
                return { success: false, error: "File not found." };
            } catch (e) {
                return { success: false, error: e.message };
            }
        });
        // ────────────────────────────────────────────────────────────────────────

        ipcMain.handle('system:factory-reset', async () => {
            try {
                // Delete data directory containing settings, custom songs, etc.
                const dataDir = path.join(app.getPath('userData'), 'data');
                if (fs.existsSync(dataDir)) {
                    fs.rmSync(dataDir, { recursive: true, force: true });
                }

                // Delete bible database (using reset method to ensure SQLite connection is closed first)
                bibleDb.resetBibleDb();

                // Relaunch application to apply fresh state
                app.relaunch();
                app.exit(0);
                return true;
            } catch (e) {
                console.error("Factory reset error:", e);
                return false;
            }
        });

        ipcMain.handle('bible:reset-and-rebuild', async () => {
            try {
                // Step 1: Wipe the database
                bibleDb.resetBibleDb();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('bible:setup-progress', { message: 'Database wiped. Re-downloading...', progress: 5 });
                }
                // Step 2: Immediately re-run the full setup
                const result = await setupBible((message, progress) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('bible:setup-progress', { message, progress });
                    }
                });
                return result;
            } catch (error) {
                console.error('Bible reset-and-rebuild error:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('app:restart', async () => {
            app.isQuitting = true; // Bypass the exit confirmation
            app.relaunch();
            app.quit();
            return true;
        });
        ipcMain.handle('bible:setup-start', async () => {
            return setupBible((message, progress) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('bible:setup-progress', { message, progress });
                }
            });
        });

        ipcMain.handle('dialog:open-file', async () => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Bible JSON',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
                properties: ['openFile']
            });
            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        });

        // ─── Import: Step 1 — Preview (parse files, return song list for verification) ───
        ipcMain.handle('dialog:preview-import', async () => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Files to Import',
                filters: [
                    { name: 'Supported Formats', extensions: ['sqlite', 'xml', 'txt', 'json', 'csv', 'lyrx', 'osz', 'vvl', 'pptx', 'docx', 'rtf', 'html', 'pdf'] },
                    { name: 'Plain Text', extensions: ['txt'] },
                    { name: 'OpenSong', extensions: ['xml'] },
                    { name: 'JSON', extensions: ['json'] },
                    { name: 'CSV', extensions: ['csv'] },
                    { name: 'LyriX Cast', extensions: ['lyrx'] },
                    { name: 'OpenLP Song Export', extensions: ['osz'] },
                    { name: 'OpenLP Database', extensions: ['sqlite'] },
                    { name: 'VerseVIEW', extensions: ['vvl'] },
                    { name: 'PowerPoint', extensions: ['pptx'] },
                    { name: 'Word Document', extensions: ['docx'] },
                    { name: 'Rich Text', extensions: ['rtf'] },
                    { name: 'HTML', extensions: ['html'] },
                    { name: 'PDF (import text only)', extensions: ['pdf'] }
                ],
                properties: ['openFile', 'multiSelections']
            });
            if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' };

            const { parseFiles } = require('./utils/importers.js');
            const { previews, errors } = await parseFiles(result.filePaths);

            return { success: true, previews, errors, fileCount: result.filePaths.length };
        });

        // ─── Import: Step 2 — Confirm (import selected songs into DB) ────────────
        ipcMain.handle('dialog:confirm-import', async (event, selectedSongs, category) => {
            const { importSelectedSongs } = require('./utils/importers.js');
            return await importSelectedSongs(selectedSongs, category);
        });

        // ─── Legacy import handler (kept for backward compat) ────────────────────
        ipcMain.handle('dialog:import-songs-db', async (event, category) => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Songs Database',
                filters: [
                    { name: 'Supported Formats', extensions: ['sqlite', 'xml', 'txt', 'json', 'csv', 'lyrx', 'osz', 'vvl', 'pptx', 'docx', 'rtf', 'html', 'pdf'] },
                    { name: 'Plain Text', extensions: ['txt'] },
                    { name: 'OpenSong', extensions: ['xml'] },
                    { name: 'JSON', extensions: ['json'] },
                    { name: 'CSV', extensions: ['csv'] },
                    { name: 'LyriX Cast', extensions: ['lyrx'] },
                    { name: 'OpenLP Song Export', extensions: ['osz'] },
                    { name: 'OpenLP Database', extensions: ['sqlite'] },
                    { name: 'VerseVIEW', extensions: ['vvl'] },
                    { name: 'PowerPoint', extensions: ['pptx'] },
                    { name: 'Word Document', extensions: ['docx'] },
                    { name: 'Rich Text', extensions: ['rtf'] },
                    { name: 'HTML', extensions: ['html'] },
                    { name: 'PDF (import text only)', extensions: ['pdf'] }
                ],
                properties: ['openFile', 'multiSelections']
            });
            if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' };

            const { importOpenLyricsXml, importOpenLPSqlite, importLyrixJson, importPptx } = require('./utils/importers.js');

            let totalImported = 0;
            let totalErrors = [];

            for (const filePath of result.filePaths) {
                const ext = filePath.split('.').pop().toLowerCase();
                try {
                    if (ext === 'xml') {
                        const res = await importOpenLyricsXml(filePath, category);
                        if (res.success) totalImported++;
                        else totalErrors.push(res.error);
                    } else if (ext === 'sqlite') {
                        const res = await importOpenLPSqlite(filePath, category);
                        if (res.success) {
                            totalImported += res.count;
                            totalErrors.push(...res.errors);
                        } else {
                            totalErrors.push(res.error);
                        }
                    } else if (ext === 'lyrx' || ext === 'json') {
                        const res = await importLyrixJson(filePath, category);
                        if (res.success) {
                            totalImported += res.count;
                            totalErrors.push(...res.errors);
                        } else {
                            totalErrors.push(res.error);
                        }
                    } else if (ext === 'pptx' || ext === 'ppt' || ext === 'ppsx') {
                        const res = await importPptx(filePath, category);
                        if (res.success) {
                            totalImported += res.count;
                            totalErrors.push(...res.errors);
                        } else {
                            totalErrors.push(res.error);
                        }
                    } else {
                        totalErrors.push(`Format .${ext} is not supported for song import.`);
                    }
                } catch (e) {
                    totalErrors.push(`Failed to import ${require('path').basename(filePath)}: ${e.message}`);
                }
            }

            return { success: true, count: totalImported, errors: totalErrors };
        });

        // ─── Export: Get songs by category for export selection ───────────────────
        ipcMain.handle('get-songs-for-export', async () => {
            const categories = getCategories();
            const allSongs = searchSongs('', 'All');

            // Group songs by category with counts
            const grouped = {};
            for (const cat of categories) {
                grouped[cat] = allSongs.filter(s => s.category === cat).map(s => ({
                    id: s.id,
                    title: s.title || s.displayTitle || 'Untitled',
                    category: s.category,
                    slides: s.slides,
                    slideCount: Array.isArray(s.slides) ? s.slides.length : 0
                }));
            }
            // Also add any uncategorized
            const uncategorized = allSongs.filter(s => !categories.includes(s.category));
            if (uncategorized.length > 0) {
                for (const s of uncategorized) {
                    const cat = s.category || 'Uncategorized';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push({
                        id: s.id,
                        title: s.title || s.displayTitle || 'Untitled',
                        category: s.category,
                        slides: s.slides,
                        slideCount: Array.isArray(s.slides) ? s.slides.length : 0
                    });
                }
            }

            return grouped;
        });

        // ─── Export: Save selected songs to file ─────────────────────────────────
        ipcMain.handle('dialog:export-selected-songs', async (event, { songs, format = 'lyrx' }) => {
            const { dialog } = require('electron');
            const songCount = songs.length;
            const ext = format === 'json' ? 'json' : 'lyrx';
            const typeName = format === 'json' ? 'JSON File' : 'LyriX Cast';

            const defaultName = songCount === 1
                ? `${songs[0].title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.${ext}`
                : `LyriX_Export_${songCount}_Songs.${ext}`;

            const result = await dialog.showSaveDialog(mainWindow, {
                title: `Export ${songCount} Song${songCount > 1 ? 's' : ''}`,
                defaultPath: defaultName,
                filters: [{ name: typeName, extensions: [ext] }]
            });
            if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

            try {
                const exportData = songs.map(s => ({
                    title: s.title,
                    category: s.category,
                    slides: s.slides
                }));
                fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
                return { success: true, count: songCount };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // ─── Legacy export handler (kept for backward compat) ────────────────────
        ipcMain.handle('dialog:export-songs-db', async () => {
            const { dialog } = require('electron');
            const result = await dialog.showSaveDialog(mainWindow, {
                title: 'Export Custom Songs',
                defaultPath: 'LyriX_Custom_Songs_Backup.lyrx',
                filters: [{ name: 'LyriX Cast', extensions: ['lyrx'] }]
            });
            if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

            try {
                const fs = require('fs');
                const path = require('path');
                const userDataPath = app.getPath('userData');
                const sourceDb = path.join(userDataPath, 'data', 'custom_songs.json');

                if (fs.existsSync(sourceDb)) {
                    fs.copyFileSync(sourceDb, result.filePath);
                    return { success: true };
                } else {
                    return { success: false, error: 'No custom songs found to export.' };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('dialog:open-image', async () => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Watermark Logo',
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
                properties: ['openFile']
            });
            if (result.canceled || result.filePaths.length === 0) return null;
            const path = result.filePaths[0];
            const ext = path.split('.').pop().toLowerCase();
            let mime = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
            else if (ext === 'svg') mime = 'image/svg+xml';
            else if (ext === 'webp') mime = 'image/webp';

            const fs = require('fs');
            const b64 = fs.readFileSync(path).toString('base64');
            return `data:${mime};base64,${b64}`;
        });

        ipcMain.handle('bible:import-custom', async (event, name, filePath) => {
            try {
                const fs = require('fs');
                let fileData = fs.readFileSync(filePath, 'utf8');
                // Strip BOM (Byte Order Mark) and any leading whitespace that can break JSON.parse
                fileData = fileData.replace(/^\uFEFF/, '').trim();
                const data = JSON.parse(fileData);
                const { normalizeKJV, normalizeHindi } = require('./database/bible_setup.js');
                let normalized;
                if (Array.isArray(data)) {
                    normalized = normalizeKJV(data);
                } else if (data.Book) {
                    normalized = normalizeHindi(data);
                } else {
                    return { success: false, error: 'Unrecognized Bible JSON format.' };
                }
                const localBibleDb = require('./database/bible_db.js');
                localBibleDb.importTranslation(name.toUpperCase(), normalized);
                return { success: true };
            } catch (error) {
                console.error('Bible Custom Import Error:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('refresh-ip', async () => {
            const { getAllLocalIPs } = require('./server/index.js');
            const allIps = getAllLocalIPs();

            // Cycle IP: find current index and pick next, or reset to 0
            let currentIndex = allIps.indexOf(currentServerStatus.ip);
            let nextIndex = (currentIndex + 1) % allIps.length;
            const newIp = allIps[nextIndex];

            currentServerStatus.ip = newIp;
            const updatedStatus = { ...currentServerStatus, ip: newIp };

            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) win.webContents.send('status-update', updatedStatus);
            });
            return updatedStatus;
        });

        ipcMain.handle('search-lyrics', async (event, query) => {
            return await searchLyrics(query);
        });
        ipcMain.handle('set-titlebar-theme', () => {
            // No-op: titleBarOverlay removed in favour of custom React window controls
        });

        ipcMain.handle('app-control', (event, command) => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;

            switch (command) {
                case 'reload': win.reload(); break;
                case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
                case 'zoom-in': win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); break;
                case 'zoom-out': win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); break;
                case 'zoom-reset': win.webContents.setZoomLevel(0); break;
                case 'devtools': win.webContents.toggleDevTools(); break;
            }
        });

        ipcMain.handle('close-projector-window', () => {
            if (projectorWindow) {
                projectorWindow.close();
                return false; // Tells UI it is closed
            }
            return false;
        });

        ipcMain.handle('open-help-window', () => {
            if (helpWindow) {
                if (helpWindow.isMinimized()) helpWindow.restore();
                helpWindow.focus();
                return true;
            }
            helpWindow = new BrowserWindow({
                width: 900,
                height: 800,
                autoHideMenuBar: true,
                title: 'LyriX Stage - Help & Guide',
                icon: path.join(__dirname, '../public/icon.png'),
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });
            helpWindow.loadFile(path.join(__dirname, '../public/help.html'));
            helpWindow.on('closed', () => { helpWindow = null; });
            return true;
        });

        ipcMain.handle('open-projector-window', () => {
            if (projectorWindow) {
                // Already open — just return true, do NOT close
                if (projectorWindow.isMinimized()) projectorWindow.restore();
                projectorWindow.focus();
                return true;
            }
            openProjectorWindow();
            return true;
        });

        function openProjectorWindow() {
            if (projectorWindow) return projectorWindow;

            if (io) io.emit('projector-status', true);

            const displays = screen.getAllDisplays();
            const appSettings = getAppSettings();
            let selectedDisplayId = appSettings.projectorDisplayId;

            // Default to first external display if no preference saved or saved display not found
            let targetDisplay = displays.find(d => d.id === selectedDisplayId);

            if (!targetDisplay) {
                targetDisplay = displays.find(display => display.bounds.x !== 0 || display.bounds.y !== 0);
            }

            let winOptions = {
                width: 800,
                height: 600,
                autoHideMenuBar: true,
                title: 'LyriX Stage',
                backgroundColor: '#000000',
                icon: path.join(__dirname, '../public/icon.png'),
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    contextIsolation: true,
                    nodeIntegration: false,
                    webSecurity: false,
                    backgroundThrottling: false,
                    webviewTag: true
                }
            };

            if (targetDisplay) {
                winOptions.x = targetDisplay.bounds.x + 50;
                winOptions.y = targetDisplay.bounds.y + 50;
                winOptions.fullscreen = true;
                winOptions.alwaysOnTop = true;
            }

            projectorWindow = new BrowserWindow(winOptions);

            if (targetDisplay) {
                projectorWindow.setFullScreen(true);
                projectorWindow.setAlwaysOnTop(true, 'screen-saver');
            }

            if (process.env.NODE_ENV === 'development') {
                // Always load projector from file:// so it can access local file:// video URLs
                // (http:// origin cannot load file:// resources in Chromium)
                projectorWindow.loadFile(path.join(__dirname, '../public/projector.html'));
            } else {
                projectorWindow.loadFile(path.join(__dirname, '../public/projector.html'));
            }

            projectorWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
                console.log(`[Projector Log] ${message} (${sourceId}:${line})`);
            });

            // Handle Native Keys on Projector Window
            projectorWindow.webContents.on('before-input-event', (event, input) => {
                if (input.type !== 'keyDown') return;
                if (input.key === 'Escape' && projectorWindow) {
                    projectorWindow.close();
                    event.preventDefault();
                } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'b', 'B'].includes(input.key)) {
                    // Forward slide navigation keys back to main window
                    BrowserWindow.getAllWindows().forEach(win => {
                        if (win !== projectorWindow && !win.isDestroyed()) {
                            win.webContents.send('projector-key-press', input.key);
                        }
                    });
                    event.preventDefault();
                }
            });

            projectorWindow.on('closed', () => {
                projectorWindow = null;
                if (io) io.emit('projector-status', false);
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('projector-state-changed', false);
                    }
                });
            });

            // Notify all renderer windows that projector is now open
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed() && win !== projectorWindow) {
                    win.webContents.send('projector-state-changed', true);
                }
            });

            // When projector finishes loading, resend the current state
            projectorWindow.webContents.on('did-finish-load', () => {
                // Send the correct content type — Bible verse OR song slide (mutually exclusive)
                if (lastBibleVerse) {
                    projectorWindow.webContents.send('bible-verse-update', lastBibleVerse);
                } else if (lastSlide) {
                    projectorWindow.webContents.send('current-slide', typeof lastSlide === 'string' ? { slide: lastSlide } : lastSlide);
                }
                // Also resend black/blank state
                if (lastIsBlack) {
                    projectorWindow.webContents.send('blank-screen', lastIsBlack);
                }
                // Resend cached settings (font, colors, watermark, etc.)
                if (lastProjectorSettings) {
                    projectorWindow.webContents.send('settings-update', lastProjectorSettings);
                }
            });

            return projectorWindow;
        }

        ipcMain.handle('toggle-projector-window', () => {
            if (projectorWindow) {
                projectorWindow.close();
                return false;
            }
            openProjectorWindow();
            return true;
        });

        ipcMain.handle('fetch-lyrics-content', async (event, url) => {
            return await fetchLyricsContent(url);
        });

        // Pass db and scraper to server
        const dbMethods = { searchSongs, getSchedule, clearSchedule, addToSchedule, addSong };
        io = startServer((data) => {
            currentServerStatus = { ...currentServerStatus, ...data };
            if (currentServerStatus.ip === 'Unknown' || !currentServerStatus.ip) {
                const { getAllLocalIPs } = require('./server/index.js');
                currentServerStatus.ip = getAllLocalIPs()[0] || 'Unknown';
            }
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) win.webContents.send('status-update', currentServerStatus);
            });
        }, { db: dbMethods, scraper: { searchLyrics, fetchLyricsContent }, userDataPath: app.getPath('userData') });

        // Auto-refresh IP when network changes
        setInterval(() => {
            if (currentServerStatus.status !== 'Running') return;
            const { getAllLocalIPs } = require('./server/index.js');
            const currentIps = getAllLocalIPs();
            // If the currently selected IP is no longer valid, automatically switch to a valid one
            if (currentIps.length > 0 && !currentIps.includes(currentServerStatus.ip)) {
                currentServerStatus.ip = currentIps[0];
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) win.webContents.send('status-update', currentServerStatus);
                });
            }
        }, 5000);

        ipcMain.handle('get-server-status', () => currentServerStatus);

        if (io) {
            io.on('connection', (socket) => {
                const clientType = socket.handshake.query.type || 'remote';

                if (clientType === 'remote') {
                    let remoteCount = 0;
                    io.sockets.sockets.forEach(s => {
                        // Count other remote clients (excluding this one if it's already added)
                        if (s.id !== socket.id && (s.handshake.query.type === 'remote' || !s.handshake.query.type)) {
                            remoteCount++;
                        }
                    });

                    if (remoteCount >= 1) {
                        console.log("Main Process: Connection rejected (Max remote devices reached).");
                        socket.emit('connection-rejected', { reason: 'Another remote is already connected. Please disconnect it first.' });
                        socket.disconnect(true);
                        return;
                    }
                }

                console.log("Main Process: Client Connected", socket.id, "Type:", clientType);

                // Send initial schedule and states
                socket.emit('schedule-updated', getSchedule());
                socket.emit('projector-status', !!projectorWindow);
                socket.emit('blank-screen', lastIsBlack);
                if (lastBibleVerse) socket.emit('bible-verse-update', lastBibleVerse);
                else if (lastSlide) socket.emit('current-slide', typeof lastSlide === 'string' ? { slide: lastSlide } : lastSlide);
                // Send cached projector settings so new connections get correct font/colors
                if (lastProjectorSettings) socket.emit('settings-update', lastProjectorSettings);

                socket.on('fetch-schedule', () => {
                    socket.emit('schedule-updated', getSchedule());
                });

                socket.on('search', (query) => {
                    const results = searchSongs(query);
                    socket.emit('search-results', results);
                });

                socket.on('add-to-schedule', async (songId) => {
                    const list = await addToSchedule(songId);
                    io.emit('schedule-updated', list); // Broadcast to all mobiles
                    // Also update renderer windows
                    BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
                });

                socket.on('remove-from-schedule', async (instanceId) => {
                    const list = await removeFromSchedule(instanceId);
                    io.emit('schedule-updated', list);
                    BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
                });

                socket.on('reorder-schedule', async (newOrder) => {
                    const list = await reorderSchedule(newOrder);
                    io.emit('schedule-updated', list);
                    BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
                });

                socket.on('command', (cmd) => {
                    console.log("Main Process Cmd:", cmd);
                    if (cmd.action === 'search-song') {
                        // Legacy single song load support
                        const songs = searchSongs(cmd.query || '');
                        if (songs.length > 0) {
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('remote-command', { action: 'set-song', song: songs[0] });
                            });
                        }
                    } else if (cmd.action === 'set-song-by-id') {
                        let song = getSong(cmd.id);
                        if (!song && cmd.id.startsWith('bible-')) {
                            const scheduleItem = getSchedule().find(s => s.songId === cmd.id);
                            if (scheduleItem && scheduleItem.isBibleReading) {
                                song = { ...scheduleItem, id: scheduleItem.songId };
                            }
                        }
                        if (song) {
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('remote-command', { action: 'set-song', song: song });
                            });
                        }
                    } else if (cmd.action === 'blank-screen') {
                        // Forward blank screen toggle to all renderer windows to maintain React state
                        BrowserWindow.getAllWindows().forEach(win => {
                            win.webContents.send('remote-command', { action: 'blank-screen' });
                        });
                    } else if (cmd.action === 'open-projector') {
                        if (!projectorWindow) {
                            openProjectorWindow();
                        } else {
                            if (projectorWindow.isMinimized()) projectorWindow.restore();
                            projectorWindow.focus();
                        }
                        BrowserWindow.getAllWindows().forEach(win => {
                            win.webContents.send('remote-command', cmd);
                        });
                    } else {
                        BrowserWindow.getAllWindows().forEach(win => {
                            win.webContents.send('remote-command', cmd);
                        });
                    }
                });
            });
        }

        ipcMain.handle('open-url', (event, url) => {
            shell.openExternal(url);
        });

        ipcMain.handle('media-play-youtube', (event, videoId) => {
            const data = { action: 'media-play-youtube', videoId: videoId };
            if (!projectorWindow || projectorWindow.isDestroyed()) {
                // Auto-open projector window, then play once loaded
                openProjectorWindow();
                projectorWindow.webContents.once('did-finish-load', () => {
                    setTimeout(() => {
                        if (io) io.emit('media-command', data);
                        if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('media-command', data);
                    }, 1500); // small delay to let socket.io connect
                });
            } else {
                if (io) io.emit('media-command', data);
                projectorWindow.webContents.send('media-command', data);
            }
        });

        ipcMain.handle('projector-sync', (event, data) => {
            if (io) {
                if (data.type === 'slide') {
                    lastBibleVerse = null; // Clear Bible verse when switching to song slides
                    lastSlide = { slide: data.content, category: data.category };
                    io.emit('current-slide', lastSlide);
                    if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('current-slide', lastSlide);
                } else if (data.type === 'black') {
                    lastIsBlack = data.isBlack;
                    io.emit('blank-screen', data.isBlack);
                    if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('blank-screen', data.isBlack);
                } else if (data.type === 'bible-verse') {
                    lastSlide = null; // Clear song slide when switching to Bible verse
                    lastBibleVerse = data.content; // Store for projector reopens
                    io.emit('bible-verse-update', data.content);
                    if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('bible-verse-update', data.content);
                }
            }
        });

        ipcMain.handle('send-stage-message', (event, message) => {
            if (io) {
                io.emit('stage-message', message);
            }
        });

        ipcMain.handle('update-projector-settings', (event, settings) => {
            // Cache settings for future connections
            lastProjectorSettings = { ...lastProjectorSettings, ...settings };
            if (settings.maxRemoteDevices !== undefined) {
                globalMaxDevices = settings.maxRemoteDevices;
            }
            if (io) {
                io.emit('settings-update', settings);
                if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('settings-update', settings);
            }
        });

        ipcMain.handle('select-image-file', async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
                return `file://${result.filePaths[0].replace(/\\/g, '/')}`;
            }
            return null;
        });

        // ─── Reusable PPTX/PPT Parsing Engine ──────────────────────────────────
        async function parsePptxFile(filePath) {
            let actualPath = filePath;
            const isLegacy = filePath.toLowerCase().endsWith('.ppt');

            if (isLegacy) {
                try {
                    const tempPptxPath = path.join(require('os').tmpdir(), `lyrix_import_${Date.now()}.pptx`);
                    const script = `
$ppt = New-Object -ComObject PowerPoint.Application
$presentation = $ppt.Presentations.Open("${filePath}", [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
$presentation.SaveAs("${tempPptxPath}", 24)
$presentation.Close()
$ppt.Quit()
`;
                    const tempScriptPath = path.join(require('os').tmpdir(), `lyrix_convert_${Date.now()}.ps1`);
                    fs.writeFileSync(tempScriptPath, script);

                    require('child_process').execSync(`powershell.exe -ExecutionPolicy Bypass -File "${tempScriptPath}"`, { windowsHide: true });

                    actualPath = tempPptxPath;
                    try { fs.unlinkSync(tempScriptPath); } catch (e) { }
                } catch (e) {
                    return { success: false, error: "Legacy .ppt file detected, but Microsoft PowerPoint is not installed or failed to convert it. Please save it as a .pptx file manually and try again." };
                }
            }

            const data = fs.readFileSync(actualPath);

            if (isLegacy) {
                try { fs.unlinkSync(actualPath); } catch (e) { }
            }

            const JSZip = require('jszip');
            const cheerio = require('cheerio');
            const zip = await JSZip.loadAsync(data);

            const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k));
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

            const rawSlides = [];
            for (const filename of slideFiles) {
                const xml = await zip.file(filename).async("string");
                const $ = cheerio.load(xml, { xmlMode: true });

                const textBlocks = [];

                $('p\\:sp, p\\:graphicFrame').each((i, el) => {
                    const $el = $(el);

                    const phType = $el.find('p\\:ph').attr('type');
                    if (['ftr', 'slidenum', 'dt'].includes(phType)) return;

                    const yAttr = $el.find('a\\:off').attr('y');
                    const y = yAttr ? parseInt(yAttr, 10) : 0;

                    let shapeText = [];
                    $el.find('a\\:p').each((j, pNode) => {
                        let pText = "";
                        $(pNode).find('a\\:t').each((k, tNode) => {
                            pText += $(tNode).text();
                        });
                        if (pText.trim()) shapeText.push(pText.trim());
                    });

                    const combinedText = shapeText.join('\n').trim();
                    if (combinedText) {
                        textBlocks.push({ text: combinedText, y: y });
                    }
                });

                textBlocks.sort((a, b) => a.y - b.y);

                const slideLines = textBlocks.map(b => b.text);
                if (slideLines.length > 0) {
                    rawSlides.push(slideLines.join('\n'));
                }
            }

            // ── Auto-Split: Break slides with >4 lines into balanced halves ──
            const MAX_LINES = 4;
            const slides = [];
            for (const slideText of rawSlides) {
                const lines = slideText.split('\n');
                if (lines.length <= MAX_LINES) {
                    slides.push(slideText);
                } else {
                    // Split into balanced chunks of MAX_LINES
                    for (let i = 0; i < lines.length; i += MAX_LINES) {
                        const chunk = lines.slice(i, i + MAX_LINES).join('\n');
                        if (chunk.trim()) slides.push(chunk);
                    }
                }
            }

            if (slides.length === 0) {
                return { success: false, error: "No lyrics could be extracted. The file might be empty, or the text is embedded in unsupported images/structures." };
            }

            const originalName = path.basename(filePath, path.extname(filePath));
            return { success: true, slides, filename: originalName };
        }

        // ─── Import via File Dialog ──────────────────────────────────────────
        ipcMain.handle('import-pptx', async () => {
            try {
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppsx', 'pptm', 'ppt'] }]
                });
                if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true };
                return await parsePptxFile(result.filePaths[0]);
            } catch (e) {
                console.error("PPTX Import Error:", e);
                return { success: false, error: e.message };
            }
        });

        // ─── Import via Drag & Drop (receives file path directly) ────────────
        ipcMain.handle('import-pptx-path', async (event, filePath) => {
            try {
                if (!filePath || !fs.existsSync(filePath)) {
                    return { success: false, error: "File not found." };
                }
                const ext = path.extname(filePath).toLowerCase();
                if (!['.pptx', '.ppsx', '.pptm', '.ppt'].includes(ext)) {
                    return { success: false, error: "Unsupported file type. Please drop a .pptx or .ppt file." };
                }
                return await parsePptxFile(filePath);
            } catch (e) {
                console.error("PPTX Drag Import Error:", e);
                return { success: false, error: e.message };
            }
        });

        // ─── XML Import via Drag & Drop (receives file path directly) ────────────
        ipcMain.handle('import-xml-path', async (event, filePath) => {
            try {
                if (!filePath || !fs.existsSync(filePath)) {
                    return { success: false, error: "File not found." };
                }
                const ext = path.extname(filePath).toLowerCase();
                if (ext !== '.xml') {
                    return { success: false, error: "Unsupported file type. Please drop an .xml file." };
                }
                const { parseFiles } = require('./utils/importers.js');
                const result = parseFiles([filePath]);
                if (result.previews && result.previews.length > 0) {
                    const song = result.previews[0];
                    return { success: true, filename: song.title, slides: song.slides };
                } else {
                    return { success: false, error: result.errors[0] || "Could not parse XML file" };
                }
            } catch (e) {
                console.error("XML Drag Import Error:", e);
                return { success: false, error: e.message };
            }
        });



        // --- Media Player Handlers ---
        const mediaHistoryPath = path.join(newDataDir, 'media_history.json');
        const videosDir = path.join(app.getPath('documents'), 'LyriX', 'Videos');

        if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
        }

        const getMediaHistory = () => {
            if (fs.existsSync(mediaHistoryPath)) {
                try {
                    return JSON.parse(fs.readFileSync(mediaHistoryPath, 'utf8'));
                } catch (e) {
                    return { played: [] };
                }
            }
            return { played: [] };
        };

        const saveMediaHistory = (history) => {
            fs.writeFileSync(mediaHistoryPath, JSON.stringify(history, null, 2));
        };

        ipcMain.handle('media:get-list', async () => {
            if (!fs.existsSync(videosDir)) return { videos: [], next: null };

            const files = fs.readdirSync(videosDir);
            const mediaExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.pptx', '.ppt', '.ppsx'];
            const history = getMediaHistory();

            const videos = files
                .filter(f => mediaExtensions.includes(path.extname(f).toLowerCase()))
                .map(f => ({
                    name: f,
                    path: path.join(videosDir, f),
                    played: history.played.includes(f),
                    isPpt: ['.pptx', '.ppt', '.ppsx'].includes(path.extname(f).toLowerCase())
                }))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            const next = videos.find(v => !v.played) || null;

            return { videos, next, path: videosDir };
        });

        ipcMain.handle('media:mark-played', async (event, fileName) => {
            const history = getMediaHistory();
            if (history.played.includes(fileName)) {
                history.played = history.played.filter(name => name !== fileName);
            } else {
                history.played.push(fileName);
            }
            saveMediaHistory(history);
            return history;
        });

        ipcMain.handle('media:reset-history', async () => {
            saveMediaHistory({ played: [] });
            return { played: [] };
        });

        ipcMain.handle('media:play', async (event, fileName) => {
            const ext = path.extname(fileName).toLowerCase();
            const absPath = path.join(videosDir, fileName);
            
            // Mark as played automatically
            const history = getMediaHistory();
            if (!history.played.includes(fileName)) {
                history.played.push(fileName);
                saveMediaHistory(history);
            }

            if (['.pptx', '.ppt', '.ppsx'].includes(ext)) {
                console.log(`[Media] Launching PPT: ${absPath}`);
                require('child_process').exec(`start "" powerpnt /S "${absPath}"`, (err) => {
                    if (err) {
                        require('electron').shell.openPath(absPath);
                    }
                });
                return true;
            }

            const { pathToFileURL } = require('url');
            const videoPath = pathToFileURL(absPath).href;
            console.log(`[Media] Playing: ${videoPath}`);
            lastSlide = null;
            lastBibleVerse = null;
            const data = { action: 'media-play', url: videoPath, fileName };

            // Auto-open projector if closed
            let win = projectorWindow;
            if (!win || win.isDestroyed()) {
                win = openProjectorWindow();
                // dom-ready fires earlier than did-finish-load (doesn't wait for fonts/CSS)
                await new Promise(resolve => win.webContents.once('dom-ready', resolve));
            }

            if (win && !win.isDestroyed()) {
                console.log(`[Media] Sending IPC to projector: ${fileName}`);
                win.webContents.send('media-command', data);
            }

            return true;
        });

        ipcMain.handle('media:browse-video', async () => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                title: 'Select Media/Presentation to Play',
                properties: ['openFile'],
                filters: [
                    { name: 'Media & Presentations', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'pptx', 'ppt', 'ppsx'] }
                ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
                return result.filePaths[0];
            }
            return null;
        });

        ipcMain.handle('media:play-absolute', async (event, absolutePath) => {
            const ext = path.extname(absolutePath).toLowerCase();
            const fileName = path.basename(absolutePath);

            if (['.pptx', '.ppt', '.ppsx'].includes(ext)) {
                console.log(`[Media] Launching Absolute PPT: ${absolutePath}`);
                require('child_process').exec(`start "" powerpnt /S "${absolutePath}"`, (err) => {
                    if (err) {
                        require('electron').shell.openPath(absolutePath);
                    }
                });
                return fileName;
            }

            const { pathToFileURL } = require('url');
            const videoPath = pathToFileURL(absolutePath).href;
            console.log(`[Media] Playing Absolute: ${videoPath}`);
            lastSlide = null;
            lastBibleVerse = null;
            const data = { action: 'media-play', url: videoPath, fileName };

            let win = projectorWindow;
            if (!win || win.isDestroyed()) {
                win = openProjectorWindow();
                await new Promise(resolve => win.webContents.once('dom-ready', resolve));
            }

            if (win && !win.isDestroyed()) {
                win.webContents.send('media-command', data);
            }

            return fileName;
        });

        ipcMain.handle('media:play-youtube', async (event, videoId) => {
            console.log(`[Media] Playing YouTube: ${videoId}`);
            lastSlide = null;
            lastBibleVerse = null;
            const data = { action: 'media-play-youtube', videoId };

            // Auto-open projector if closed
            let win = projectorWindow;
            if (!win || win.isDestroyed()) {
                win = openProjectorWindow();
                await new Promise(resolve => win.webContents.once('dom-ready', resolve));
            }

            if (win && !win.isDestroyed()) {
                win.webContents.send('media-command', data);
            }

            return true;
        });

        ipcMain.handle('media:stop', () => {
            const data = { action: 'media-stop' };
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:pause', () => {
            const data = { action: 'media-pause' };
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:resume', () => {
            const data = { action: 'media-resume' };
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:seek', (event, time) => {
            const data = { action: 'media-seek', time };
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        // Forward playback updates from projector to all renderer windows
        ipcMain.on('media:playback-update', (event, payload) => {
            console.log('[Media Debug] Playback update received:', JSON.stringify(payload));
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed() && win.webContents !== event.sender) {
                    win.webContents.send('media:playback-update', payload);
                }
            });
        });

        // System Volume Polling & Initial Sync
        const loudness = require('loudness');
        let lastSystemVolume = -1;

        ipcMain.handle('media:get-volume', async () => {
            try {
                const vol = await loudness.getVolume();
                return vol / 100;
            } catch (e) {
                return 1.0;
            }
        });

        // Background poller for physical volume keys
        let lastSystemMute = false;
        setInterval(async () => {
            try {
                const currentVol = await loudness.getVolume();
                const isMuted = await loudness.getMuted();
                const normalizedVol = isMuted ? 0 : (currentVol / 100);

                if (Math.abs(normalizedVol - lastSystemVolume) > 0.001 || isMuted !== lastSystemMute) {
                    lastSystemVolume = normalizedVol;
                    lastSystemMute = isMuted;
                    BrowserWindow.getAllWindows().forEach(win => {
                        if (!win.isDestroyed()) {
                            win.webContents.send('media:system-volume-changed', normalizedVol);
                        }
                    });
                }
            } catch (e) { }
        }, 1000);

        ipcMain.handle('media:set-volume', async (event, volume) => {
            try {
                const volPercent = Math.round(volume * 100);
                await loudness.setVolume(volPercent);
                lastSystemVolume = volume; // Prevent loop

                // Still notify projector for UI feedback if needed
                const data = { action: 'media-volume', volume };
                if (io) io.emit('media-command', data);
                if (projectorWindow && !projectorWindow.isDestroyed()) {
                    projectorWindow.webContents.send('media-command', data);
                }
                return true;
            } catch (e) {
                console.error("Volume set failed:", e);
                return false;
            }
        });

        ipcMain.handle('media:open-folder', () => {
            const { shell } = require('electron');
            shell.openPath(videosDir);
        });

        ipcMain.handle('import-custom-font', async (event, language) => {
            if (!language) return { success: false, error: 'Language must be specified' };
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: `Import Custom Font for ${language}`,
                filters: [
                    { name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) return { success: false };

            const sourcePath = result.filePaths[0];
            const fileName = require('path').basename(sourcePath);
            const safeLang = language.replace(/[^a-zA-Z0-9_-]/g, '_');
            const fontsDir = require('path').join(app.getPath('userData'), 'fonts', safeLang);
            const fs = require('fs');
            if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

            const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const destPath = require('path').join(fontsDir, safeName);
            try {
                fs.copyFileSync(sourcePath, destPath);
                return { success: true, fileName: safeLang + '/' + safeName, language: language };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        // Returns an object containing all fonts categorized by language: { "Telugu": ["Ramabhadra.ttf"], ... }
        ipcMain.handle('get-custom-fonts', () => {
            const baseFontsDir = require('path').join(app.getPath('userData'), 'fonts');
            const fs = require('fs');
            if (!fs.existsSync(baseFontsDir)) return {};
            
            const fontMap = {};
            // If there are legacy fonts in the root of /fonts, map them to "legacy"
            const rootFiles = fs.readdirSync(baseFontsDir, { withFileTypes: true });
            const legacyFonts = rootFiles.filter(f => f.isFile() && f.name.match(/\.(ttf|otf|woff|woff2)$/i)).map(f => f.name);
            if (legacyFonts.length > 0) fontMap['legacy'] = legacyFonts;

            // Read language subdirectories
            const dirs = rootFiles.filter(f => f.isDirectory());
            for (const dir of dirs) {
                const langPath = require('path').join(baseFontsDir, dir.name);
                const fonts = fs.readdirSync(langPath).filter(f => f.match(/\.(ttf|otf|woff|woff2)$/i));
                fontMap[dir.name.toLowerCase()] = fonts.map(f => dir.name + '/' + f);
            }
            return fontMap;
        });

        ipcMain.handle('delete-custom-font', (event, language, fileName) => {
            const baseFontsDir = require('path').join(app.getPath('userData'), 'fonts');
            const fs = require('fs');
            // fileName may include language subfolder (e.g. "Telugu/font.ttf") or be a plain filename for legacy fonts
            const fontPath = require('path').join(baseFontsDir, fileName);
            try {
                if (fs.existsSync(fontPath)) {
                    fs.unlinkSync(fontPath);
                    return { success: true };
                }
                return { success: false, error: 'Font file not found' };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        ipcMain.handle('import-background-media', async (event) => {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Background Media',
                filters: [
                    { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'mp4', 'webm', 'gif'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) return { success: false };

            const sourcePath = result.filePaths[0];
            const fileName = require('path').basename(sourcePath);
            const mediaDir = require('path').join(app.getPath('userData'), 'media');
            const fs = require('fs');
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

            const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const destPath = require('path').join(mediaDir, safeName);
            try {
                fs.copyFileSync(sourcePath, destPath);
                return { success: true, fileName: safeName };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        ipcMain.handle('get-background-media', () => {
            const mediaDir = require('path').join(app.getPath('userData'), 'media');
            const fs = require('fs');
            if (!fs.existsSync(mediaDir)) return [];
            return fs.readdirSync(mediaDir).filter(f => f.match(/\.(jpg|jpeg|png|mp4|webm|gif)$/i));
        });

        ipcMain.handle('delete-background-media', (event, fileName) => {
            const mediaDir = require('path').join(app.getPath('userData'), 'media');
            const fs = require('fs');
            const mediaPath = require('path').join(mediaDir, fileName);
            try {
                if (fs.existsSync(mediaPath)) {
                    fs.unlinkSync(mediaPath);
                    return { success: true };
                }
                return { success: false, error: 'Media file not found' };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        app.on('activate', function () {

            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    // Safety net: if the app is quitting, forcefully destroy all child windows
    app.on('before-quit', () => {
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.destroy();
        }
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });
}
