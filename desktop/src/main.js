const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer } = require('./server/index.js');
const { initDb, searchSongs, addSong, updateSong, deleteSong, bulkDeleteSongs, recategorizeSong, getNextId, getSong, getCategories, addCategory, updateCategory, deleteCategory, getUncategorizedSongs, getAdminCredentials, setAdminCredentials, verifyAdminCredentials, getSchedule, addToSchedule, addBibleToSchedule, removeFromSchedule, reorderSchedule, clearSchedule, getDbStatus, syncSongs, checkNetwork, getDeletedSongs, restoreSong, clearDeletedSongs, getAppSettings, setForceOffline, setPlaystoreLink } = require('./database/db.js');
const axios = require('axios');
const { spawn } = require('child_process');
const bibleDb = require('./database/bible_db.js');
const { setupBible } = require('./database/bible_setup.js');
const { searchLyrics, fetchLyricsContent } = require('./utils/scraper.js');

const gotTheLock = app.requestSingleInstanceLock();

let mainWindow;
let io; // Declare io in module scope
let projectorWindow = null;
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
            return { username: creds.username }; // Never send hash to renderer
        });
        ipcMain.handle('verify-admin', async (event, username, password) => verifyAdminCredentials(username, password));
        ipcMain.handle('set-admin-credentials', async (event, username, password) => setAdminCredentials(username, password));

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
        
        ipcMain.handle('system:factory-reset', async () => {
            try {
                // Delete data directory containing settings, custom songs, etc.
                const dataDir = path.join(app.getPath('userData'), 'data');
                if (fs.existsSync(dataDir)) {
                    fs.rmSync(dataDir, { recursive: true, force: true });
                }
                
                // Delete bible database
                const bibleDbPath = path.join(app.getPath('userData'), 'bible.db');
                if (fs.existsSync(bibleDbPath)) {
                    fs.unlinkSync(bibleDbPath);
                }
                
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

        ipcMain.handle('bible:import-custom', async (event, name, filePath) => {
            try {
                const fs = require('fs');
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
            const externalDisplay = displays.find((display) => {
                return display.bounds.x !== 0 || display.bounds.y !== 0;
            });

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
                    webSecurity: false
                }
            };

            if (externalDisplay) {
                winOptions.x = externalDisplay.bounds.x + 50;
                winOptions.y = externalDisplay.bounds.y + 50;
                winOptions.fullscreen = true;
                winOptions.alwaysOnTop = true;
            }

            projectorWindow = new BrowserWindow(winOptions);

            if (externalDisplay) {
                projectorWindow.setFullScreen(true);
                projectorWindow.setAlwaysOnTop(true, 'screen-saver');
            }

            if (process.env.NODE_ENV === 'development') {
                projectorWindow.loadURL('http://localhost:5173/projector.html');
            } else {
                projectorWindow.loadFile(path.join(__dirname, '../public/projector.html'));
            }

            // Handle Native Keys on Projector Window
            projectorWindow.webContents.on('before-input-event', (event, input) => {
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

            // When projector finishes loading, resend the current state
            projectorWindow.webContents.on('did-finish-load', () => {
                // Send the correct content type — Bible verse OR song slide (mutually exclusive)
                if (lastBibleVerse) {
                    projectorWindow.webContents.send('bible-verse-update', lastBibleVerse);
                } else if (lastSlide) {
                    projectorWindow.webContents.send('current-slide', { slide: lastSlide });
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
            console.log("Server Status:", data);
            currentServerStatus = data;
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('status-update', data);
            });
        }, { db: dbMethods, scraper: { searchLyrics, fetchLyricsContent } });

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
                else if (lastSlide) socket.emit('current-slide', { slide: lastSlide });
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

        ipcMain.handle('projector-sync', (event, data) => {
            if (io) {
                if (data.type === 'slide') {
                    lastBibleVerse = null; // Clear Bible verse when switching to song slides
                    lastSlide = data.content;
                    io.emit('current-slide', { slide: data.content });
                    if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('current-slide', { slide: data.content });
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
            const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];
            const history = getMediaHistory();

            const videos = files
                .filter(f => videoExtensions.includes(path.extname(f).toLowerCase()))
                .map(f => ({
                    name: f,
                    path: path.join(videosDir, f),
                    played: history.played.includes(f)
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
            const { pathToFileURL } = require('url');
            const videoPath = pathToFileURL(path.join(videosDir, fileName)).href;
            console.log(`[Media] Playing: ${videoPath}`);
            const data = { action: 'media-play', url: videoPath, fileName };

            // Auto-open projector if closed
            let win = projectorWindow;
            if (!win || win.isDestroyed()) {
                win = openProjectorWindow();
                // Wait for it to load before sending command
                await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
            }

            if (io) io.emit('media-command', data);
            if (win && !win.isDestroyed()) {
                console.log(`[Media] Sending IPC to projector: ${fileName}`);
                win.webContents.send('media-command', data);
            }

            // Mark as played automatically
            const history = getMediaHistory();
            if (!history.played.includes(fileName)) {
                history.played.push(fileName);
                saveMediaHistory(history);
            }

            return true;
        });

        ipcMain.handle('media:stop', () => {
            const data = { action: 'media-stop' };
            if (io) io.emit('media-command', data);
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:pause', () => {
            const data = { action: 'media-pause' };
            if (io) io.emit('media-command', data);
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:resume', () => {
            const data = { action: 'media-resume' };
            if (io) io.emit('media-command', data);
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        ipcMain.handle('media:seek', (event, time) => {
            const data = { action: 'media-seek', time };
            if (io) io.emit('media-command', data);
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('media-command', data);
            }
            return true;
        });

        // Forward playback updates from projector to all renderer windows
        ipcMain.on('media:playback-update', (event, payload) => {
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
        setInterval(async () => {
            try {
                const currentVol = await loudness.getVolume();
                const normalizedVol = currentVol / 100;
                if (Math.abs(normalizedVol - lastSystemVolume) > 0.001) {
                    lastSystemVolume = normalizedVol;
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

        app.on('activate', function () {

            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });
}
