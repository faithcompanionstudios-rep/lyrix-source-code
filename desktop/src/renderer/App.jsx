import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import QRCode from 'react-qr-code';

// Helper to strip leading numbers (e.g. "1. Title" -> "Title")
const cleanText = (text) => text ? text.replace(/^\d+\.?\s*/, '') : '';

function App() {
    const [status, setStatus] = useState('Disconnected');
    const [ip, setIp] = useState('Unknown');
    const [connections, setConnections] = useState(0);
    const [currentSong, setCurrentSong] = useState(null);
    const [slides, setSlides] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [isBlack, setIsBlack] = useState(false);
    const [isProjectorOpen, setIsProjectorOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeTab, setActiveTab] = useState('library');
    const [activeFilter, setActiveFilter] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addSongInitialData, setAddSongInitialData] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [customAlert, setCustomAlert] = useState(null);
    const [songToDelete, setSongToDelete] = useState(null);
    const [overwritePrompt, setOverwritePrompt] = useState(null);
    const [confirmPrompt, setConfirmPrompt] = useState(null);
    const [dbStatus, setDbStatus] = useState({ status: 'connecting', authenticated: false });
    const searchQueryRef = useRef('');
    const activeFilterRef = useRef('All');

    useEffect(() => {
        searchQueryRef.current = searchQuery;
        activeFilterRef.current = activeFilter;
    }, [searchQuery, activeFilter]);

    // Update State
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, not-available, downloading, downloaded, error
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateError, setUpdateError] = useState('');
    const [appVersion, setAppVersion] = useState('1.2.5');
    const [isSyncing, setIsSyncing] = useState(false);

    const confirmOverwrite = (title) => {
        return new Promise((resolve) => {
            setOverwritePrompt({ title, resolve });
        });
    };

    // Projector Settings (with localStorage persistence)
    const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('setting_fontSize')) || 5);
    const [isBold, setIsBold] = useState(() => localStorage.getItem('setting_isBold') !== 'false'); // default true
    const [color, setColor] = useState(() => localStorage.getItem('setting_color') || '#ffffff');
    const [backgroundColor, setBackgroundColor] = useState(() => localStorage.getItem('setting_backgroundColor') || '#000000');
    const [backgroundImage, setBackgroundImage] = useState(() => localStorage.getItem('setting_backgroundImage') || '');
    const [textAlign, setTextAlign] = useState(() => localStorage.getItem('setting_textAlign') || 'center');
    const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('setting_fontFamily') || 'sans-serif');

    // App Settings
    const [defaultCategory, setDefaultCategory] = useState(() => localStorage.getItem('setting_defaultCategory') || 'Special Songs');
    const [autoFormat, setAutoFormat] = useState(() => localStorage.getItem('setting_autoFormat') !== 'false');
    const [previewMode, setPreviewMode] = useState(() => localStorage.getItem('setting_previewMode') || 'single'); // 'single' or 'grid'
    const [previewFont, setPreviewFont] = useState(() => localStorage.getItem('setting_previewFont') || 'lyrics'); // 'lyrics' or 'sans'
    const [maxRemoteDevices, setMaxRemoteDevices] = useState(() => Number(localStorage.getItem('setting_maxRemoteDevices')) || 1);
    const [churchName, setChurchName] = useState(() => localStorage.getItem('setting_churchName') || '');
    const [churchPlace, setChurchPlace] = useState(() => localStorage.getItem('setting_churchPlace') || '');
    const [isEditingProfile, setIsEditingProfile] = useState(() => !localStorage.getItem('setting_churchName'));
    const [welcomeStep, setWelcomeStep] = useState(() => !localStorage.getItem('setting_churchName') ? 1 : 0);
    const [showAppControls, setShowAppControls] = useState(() => localStorage.getItem('setting_showAppControls') !== 'false');
    const [showDatabaseManagement, setShowDatabaseManagement] = useState(() => localStorage.getItem('setting_showDatabaseManagement') !== 'false');
    const [showMobileDownloadQR, setShowMobileDownloadQR] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Library Categories
    const [allCategories, setAllCategories] = useState(['English Choruses', 'English Hymns', 'Telugu Songs', 'Hindi Songs', 'Marathi Songs', 'Special Songs', 'Children Songs']);
    const [visibleCategories, setVisibleCategories] = useState(() => {
        const saved = localStorage.getItem('setting_visibleCategories');
        return saved ? JSON.parse(saved) : ['English Choruses', 'English Hymns', 'Telugu Songs', 'Hindi Songs', 'Marathi Songs', 'Special Songs', 'Children Songs'];
    });
    const [favourites, setFavourites] = useState(() => {
        const saved = localStorage.getItem('setting_favourites');
        return saved ? JSON.parse(saved) : [];
    });

    // Admin Panel State
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
    const [adminUsernameInput, setAdminUsernameInput] = useState('');
    const [adminPasswordInput, setAdminPasswordInput] = useState('');
    const [adminLoginError, setAdminLoginError] = useState('');
    const [adminTab, setAdminTab] = useState('categories'); // categories, uncategorized, bulk_delete, church_profile, projector, app_behavior

    // Admin Categories Manager State
    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);

    // Admin Bulk Delete State
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkSongsList, setBulkSongsList] = useState([]);
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);

    // Admin Uncategorized State
    const [uncategorizedSongs, setUncategorizedSongs] = useState([]);

    const stateRef = useRef({ slides: [], index: 0, currentSong: null, isModalOpen: false, schedule: [] });

    useEffect(() => { stateRef.current = { slides, index: currentSlideIndex, currentSong, isModalOpen: showAddModal || !!songToDelete, schedule }; }, [slides, currentSlideIndex, currentSong, showAddModal, songToDelete, schedule]);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('setting_favourites', JSON.stringify(favourites));
        localStorage.setItem('setting_fontSize', fontSize);
        localStorage.setItem('setting_isBold', isBold);
        localStorage.setItem('setting_color', color);
        localStorage.setItem('setting_backgroundColor', backgroundColor);
        localStorage.setItem('setting_backgroundImage', backgroundImage);
        localStorage.setItem('setting_textAlign', textAlign);
        localStorage.setItem('setting_fontFamily', fontFamily);
        localStorage.setItem('setting_defaultCategory', defaultCategory);
        localStorage.setItem('setting_autoFormat', autoFormat);
        localStorage.setItem('setting_previewMode', previewMode);
        localStorage.setItem('setting_maxRemoteDevices', maxRemoteDevices);
        localStorage.setItem('setting_churchName', churchName);
        localStorage.setItem('setting_churchPlace', churchPlace);
        localStorage.setItem('setting_visibleCategories', JSON.stringify(visibleCategories));
        localStorage.setItem('setting_showAppControls', showAppControls);
        localStorage.setItem('setting_showDatabaseManagement', showDatabaseManagement);
    }, [favourites, fontSize, isBold, color, backgroundColor, backgroundImage, textAlign, fontFamily, defaultCategory, autoFormat, previewMode, maxRemoteDevices, churchName, churchPlace, visibleCategories, showAppControls, showDatabaseManagement]);

    useEffect(() => {
        if (window.electron) {
            const unsubStatus = window.electron.onStatus((event, data) => {
                setStatus(data.status);
                setIp(data.ip);
                if (data.connections !== undefined) setConnections(data.connections);
            });

            // Fetch initial status on mount
            window.electron.invoke('get-server-status').then(data => {
                if (data && data.status) {
                    setStatus(data.status);
                    setIp(data.ip);
                    if (data.connections !== undefined) setConnections(data.connections);
                }
            });

            // Fetch app version
            window.electron.invoke('get-app-version').then(v => {
                if (v) setAppVersion(v);
            });

            // DB Status Listener
            window.electron.invoke('get-db-status').then(status => {
                if (status) setDbStatus(status);
            });

            // Fetch dynamic categories
            window.electron.invoke('get-categories').then(cats => {
                if (cats && Array.isArray(cats)) setAllCategories(cats);
            });

            const unsubDbStatusUpdate = window.electron.onDbStatus((event, status) => {
                setDbStatus(status);
                // Refresh categories when DB status changes (e.g. initial connection)
                if (status.status === 'connected') {
                    window.electron.invoke('get-categories').then(cats => {
                        if (cats && Array.isArray(cats)) setAllCategories(cats);
                    });
                }
            });

            const unsubProjectorState = window.electron.onProjectorStateChanged((event, isOpen) => {
                setIsProjectorOpen(isOpen);
            });

            const handleKeyDown = async (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return; // Don't trigger shortcuts when typing
                }

                if (e.key === 'Escape') {
                    // Only close if it's actually open, to prevent Escape from opening it
                    setIsProjectorOpen(prev => {
                        if (prev && window.electron) {
                            window.electron.invoke('toggle-projector-window').then(isOpen => setIsProjectorOpen(isOpen));
                        }
                        return prev;
                    });
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    const { slides, index } = stateRef.current;
                    if (slides && index < slides.length - 1) setCurrentSlideIndex(index + 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    const { index } = stateRef.current;
                    if (index > 0) setCurrentSlideIndex(index - 1);
                } else if (e.key === 'Delete') {
                    const { currentSong, isModalOpen } = stateRef.current;
                    if (currentSong && !isModalOpen) {
                        setSongToDelete(currentSong);
                    }
                }
            };
            window.addEventListener('keydown', handleKeyDown);

            const unsubRemote = window.electron.onRemoteCommand((event, cmd) => {
                const { slides, index } = stateRef.current;
                if (cmd.action === 'next-slide') { if (index < slides.length - 1) setCurrentSlideIndex(index + 1); }
                else if (cmd.action === 'prev-slide') { if (index > 0) setCurrentSlideIndex(index - 1); }
                else if (cmd.action === 'blank-screen') { setIsBlack(prev => !prev); }
                else if (cmd.action === 'set-song') { selectSong(cmd.song); }
                else if (cmd.action === 'next-song') {
                    const { schedule, currentSong } = stateRef.current;
                    if (schedule.length > 1) {
                        const currentIndex = schedule.findIndex(s => s.instanceId === (currentSong?.instanceId || currentSong?.id));
                        if (currentIndex < schedule.length - 1) {
                            selectSong(schedule[currentIndex + 1]);
                        }
                    }
                }
                else if (cmd.action === 'prev-song') {
                    const { schedule, currentSong } = stateRef.current;
                    if (schedule.length > 1) {
                        const currentIndex = schedule.findIndex(s => s.instanceId === (currentSong?.instanceId || currentSong?.id));
                        if (currentIndex > 0) {
                            selectSong(schedule[currentIndex - 1]);
                        }
                    }
                }
            });

            const unsubKeyPress = window.electron.onProjectorKeyPress((event, key) => {
                const { slides, index } = stateRef.current;
                if (key === 'ArrowRight' || key === 'ArrowDown') {
                    if (slides && index < slides.length - 1) setCurrentSlideIndex(index + 1);
                } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
                    if (index > 0) setCurrentSlideIndex(index - 1);
                }
            });

            const unsubSchedule = window.electron.onScheduleUpdate((event, list) => setSchedule(list));

            const unsubUpdateStatus = window.electron.onUpdateStatus((event, status, data) => {
                setUpdateStatus(status);
                if (status === 'available') setUpdateInfo(data);
                if (status === 'error') setUpdateError(data);
                if (status === 'downloaded') {
                    setCustomAlert('Update downloaded! The app will restart to apply the update.');
                    setTimeout(() => window.electron.invoke('install-update'), 3000);
                }
            });

            const unsubUpdateProgress = window.electron.onUpdateProgress((event, percent) => {
                setUpdateStatus('downloading');
                setUpdateProgress(percent);
            });

            const unsubSongsUpdate = window.electron.onSongsUpdate(() => {
                handleSearch(searchQueryRef.current, activeFilterRef.current);
            });

            const unsubAppRunning = window.electron.onAppRunningAlert(() => {
                setCustomAlert('The application is already running.');
            });

            const unsubCloseConfirm = window.electron.onConfirmAppClose(() => {
                setShowCloseConfirm(true);
            });

            handleSearch('', 'All');
            fetchSchedule();

            // Splash screen animation sequence with Greetings
            const splash = document.getElementById('startup-splash');
            if (splash) {
                setTimeout(() => {
                    const greetings = [
                        "Praise the Lord! Welcome Home.",
                        "Grace and Peace to you in His Name.",
                        "Welcome! May His presence be with you.",
                        "Blessings! Rejoice in the Lord always.",
                        "He is Good! Welcome to His sanctuary.",
                        "Jesus is Lord! Walk in His light today.",
                        "Be encouraged! Faith over fear.",
                        "Abundant Grace is yours today.",
                        "Praise Him! Let your breath be praise.",
                        "The Lord is your Shepherd! Rest in Him.",
                        "Victory is yours in Jesus Name!",
                        "Peace be with you as you worship.",
                        "Walking in the Spirit, full of joy!",
                        "Hallelujah! Praise be to our King.",
                        "His mercies are new for you this morning.",
                        "Transformed by Grace, called by Name.",
                        "Christ in you, the hope of glory!",
                        "Worship Him in Spirit and Truth today.",
                        "He is Risen! New life belongs to you.",
                        "Let your light shine for His glory.",
                        "Be still and know that He is God.",
                        "Strength for today, hope for tomorrow.",
                        "Greater is He that is in you!",
                        "Nothing is impossible with our God!",
                        "Rooted and grounded in His perfect love.",
                        "The joy of the Lord is your strength!",
                        "Blessed to be a blessing to others.",
                        "In everything give thanks and rejoice!",
                        "Seek Him first, and all will be well.",
                        "He who began a good work in you...",
                        "Trust in the Lord with all your heart!",
                        "His love endures forever and ever!",
                        "You are chosen, holy, and dearly loved!",
                        "Come as you are, His arms are open.",
                        "Stay encouraged! He is working for you."
                    ];
                    const randGreeting = greetings[Math.floor(Math.random() * greetings.length)];
                    const cName = localStorage.getItem('setting_churchName') || '';
                    const cPlace = localStorage.getItem('setting_churchPlace') || '';

                    if (cName) {
                        // Change from logo to text
                        splash.innerHTML = `
                            <div style="text-align: center; animation: fade-in 0.8s ease-out;">
                                <h1 class="font-serif" style="font-size: 2.75rem; font-weight: bold; color: #1e293b; margin-bottom: 0.5rem;">${randGreeting}</h1>
                                <p class="font-display" style="font-size: 1.15rem; color: #475569; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em;">${cName} ${cPlace ? `&bull; ${cPlace}` : ''}</p>
                            </div>
                        `;
                    }

                    setTimeout(() => {
                        splash.style.opacity = '0';
                        splash.style.visibility = 'hidden';
                        setTimeout(() => splash.remove(), 600);
                    }, cName ? 2500 : 800); // Wait longer if showing greeting

                }, 3000); // 3s logo pulse (increased by 2s)
            }

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                if (unsubStatus) unsubStatus();
                if (unsubProjectorState) unsubProjectorState();
                if (unsubRemote) unsubRemote();
                if (unsubKeyPress) unsubKeyPress();
                if (unsubSchedule) unsubSchedule();
                if (unsubUpdateStatus) unsubUpdateStatus();
                if (unsubUpdateProgress) unsubUpdateProgress();
                if (unsubSongsUpdate) unsubSongsUpdate();
                if (unsubAppRunning) unsubAppRunning();
                if (unsubDbStatusUpdate) unsubDbStatusUpdate();
            };
        }
    }, []);

    // Sync Projector whenever state changes or new devices connect
    useEffect(() => {
        if (window.electron) {
            const content = (slides && slides.length > 0) ? slides[currentSlideIndex] : "";
            window.electron.invoke('projector-sync', { type: 'slide', content });
            window.electron.invoke('projector-sync', { type: 'black', isBlack });
        }
    }, [currentSlideIndex, slides, isBlack, connections]);

    // Sync Settings
    useEffect(() => {
        if (window.electron) {
            window.electron.invoke('update-projector-settings', {
                fontSize, isBold, color, backgroundColor, backgroundImage, textAlign, fontFamily, maxRemoteDevices, churchName, churchPlace
            });
        }
    }, [fontSize, isBold, color, backgroundColor, backgroundImage, textAlign, fontFamily, maxRemoteDevices, churchName, churchPlace, connections]);

    const fetchSchedule = async (isManual = false) => {
        if (window.electron) {
            const list = await window.electron.invoke('get-schedule');
            setSchedule(list);
            if (isManual) {
                setCustomAlert("Schedule Refreshed");
            }
        }
    };

    const handleAddToSchedule = async (songId) => {
        if (window.electron) {
            const alreadyExists = schedule.some(item => item.songId === songId);
            if (alreadyExists) {
                setCustomAlert('This song is already in the schedule!');
                return;
            }

            // Add directly and show toast
            const newSchedule = await window.electron.invoke('add-to-schedule', songId);
            setSchedule(newSchedule);
            setCustomAlert(`Added to schedule`);
        }
    };

    const handleRemoveFromSchedule = async (instanceId) => {
        if (window.electron) {
            const newSchedule = await window.electron.invoke('remove-from-schedule', instanceId);
            setSchedule(newSchedule);
            if (currentSong?.instanceId === instanceId) {
                // Optionally clear current song if removed
            }
        }
    };

    const handleReorderSchedule = async (newOrder) => {
        if (window.electron) {
            const list = await window.electron.invoke('reorder-schedule', newOrder);
            setSchedule(list);
        }
    }

    const handleXMLImport = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        const existingSongs = await window.electron.invoke('search-songs', '', 'All');
        const sanitizeTitle = t => (t || "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const text = await file.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                // Get Title
                let titleNode = xmlDoc.getElementsByTagName('title')[0] || xmlDoc.getElementsByTagNameNS('*', 'title')[0];
                let rawTitle = titleNode ? titleNode.textContent : file.name.replace(/\.xml$/i, "");
                // Use the same cleaning logic as the rest of the app
                const title = cleanText(rawTitle.replace(/^[-_]+/, '').replace(/\s+/g, ' ').trim());

                // Get Verses
                const verses = xmlDoc.querySelectorAll("song lyrics verse lines");
                let slides = [];
                verses.forEach(v => {
                    // OpenLyrics uses <br/> to split lines
                    let htmlContent = v.innerHTML;
                    // Replace <br/>, <br />, <br></br> with strict newline
                    let rawText = htmlContent.replace(/<br\s*\/?>/gi, '\n');
                    // Remove any remaining tags that might be inside (like chords etc in some dialects)
                    rawText = rawText.replace(/<[^>]*>?/gm, '');

                    if (rawText.trim()) {
                        slides.push(rawText.trim());
                    }
                });

                if (slides.length === 0) {
                    // Fallback just in case standard tags missed
                    slides.push("(No lyrics found in XML)");
                }

                // Check for duplicates in the pre-fetched list
                const duplicateSong = existingSongs.find(s => s.title && sanitizeTitle(s.title) === sanitizeTitle(title));

                if (duplicateSong) {
                    const shouldOverwrite = await confirmOverwrite(title);
                    if (shouldOverwrite) {
                        const updatedSong = {
                            ...duplicateSong,
                            slides: slides,
                            // Preserve the original id and category
                        };
                        await window.electron.invoke('update-song', updatedSong);
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }
                    continue; // Done with this file (whether updated or skipped)
                }

                // If not a duplicate, add as new
                const catToUse = (defaultCategory && defaultCategory !== 'All') ? defaultCategory : 'Special Songs';
                const newId = await window.electron.invoke('get-next-id', catToUse);
                const newSong = {
                    id: newId,
                    title: title,
                    category: catToUse,
                    slides: slides
                };

                await window.electron.invoke('add-song', newSong);
                addedCount++;
            } catch (err) {
                console.error("Failed to parse " + file.name, err);
            }
        }

        setCustomAlert(`Import Complete! Added: ${addedCount}. Updated: ${updatedCount}. Skipped: ${skippedCount}.`);

        // Refresh library by triggering an empty search
        handleSearch('', activeFilter);

        // Reset file input
        e.target.value = null;
    };

    const handleSearch = async (q, filter = activeFilter) => {
        setSearchQuery(q);
        setActiveFilter(filter);
        if (window.electron && window.electron.invoke) {
            try {
                const results = await window.electron.invoke('search-songs', q, filter);
                setSearchResults(results);
            } catch (e) { console.error(e); }
        }
    };

    const handleToggleProjector = async () => {
        if (window.electron) {
            const isOpen = await window.electron.invoke('toggle-projector-window');
            setIsProjectorOpen(isOpen);
        }
    };

    const selectSong = async (song) => {
        let fullSong = song;

        // If schedule item (has songId but might lack slides), fetch full details
        if ((!fullSong.slides || fullSong.slides.length === 0) && fullSong.songId && window.electron) {
            try {
                const fetched = await window.electron.invoke('get-song', fullSong.songId);
                if (fetched) {
                    // Merge fetched data but keep instance specific data if any
                    fullSong = { ...fetched, ...song, slides: fetched.slides };
                }
            } catch (e) {
                console.error("Failed to fetch full song details:", e);
            }
        }

        setCurrentSong(fullSong);
        // Ensure slides is an array and clean them for valid display
        const rawSlides = Array.isArray(fullSong.slides) ? fullSong.slides : [fullSong.slides || ""];
        setSlides(rawSlides);
        setCurrentSlideIndex(0);
        setIsBlack(false);
    };

    const executeDelete = async () => {
        if (!songToDelete) return;
        if (window.electron && window.electron.deleteSong) {
            await window.electron.deleteSong(songToDelete.id);
            // Refresh list
            handleSearch(searchQuery, activeFilter);
            if (currentSong?.id === songToDelete.id) {
                setCurrentSong(null);
                setSlides([]);
            }
            setSongToDelete(null);
        }
    };

    const handleDelete = () => {
        if (!currentSong) return;
        setSongToDelete(currentSong);
    };

    useEffect(() => {
        const handleEnter = (e) => {
            if (e.key === 'Enter' && songToDelete) {
                e.preventDefault();
                executeDelete();
            }
        };
        if (songToDelete) {
            window.addEventListener('keydown', handleEnter);
            return () => window.removeEventListener('keydown', handleEnter);
        }
    }, [songToDelete, executeDelete]);

    return (
        <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden">
            {/* Custom OS Title Bar */}
            <div
                className="h-10 bg-white text-slate-800 flex items-center px-4 w-full select-none shrink-0 relative z-[200]"
                style={{ WebkitAppRegion: 'drag' }}
            >
                <img src="./icon.ico" className="w-5 h-5 mr-3 drop-shadow" alt="LyriX Logo" />
                <span className="font-bold text-[13px] tracking-widest uppercase text-slate-800">LyriX Desktop</span>
            </div>
            {/* Full-width border element behind the overlay area */}
            <div className="absolute top-10 left-0 w-full h-[1px] bg-slate-200 z-50 pointer-events-none"></div>

            {/* Main Application Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Column 1: Navigation Sidebar (240px) */}
                <div className="w-[240px] flex flex-col border-r border-slate-200 bg-slate-50/50 shrink-0">
                    {/* Logo Area */}
                    <div className="h-32 flex flex-col items-center justify-center border-b border-slate-100 p-4 shrink-0">
                        <img src="./icon.ico" fetchPriority="high" className="w-16 h-16 mb-2 drop-shadow-lg" alt="LyriX Logo" />
                        <div className="text-sm font-bold text-slate-600 tracking-widest uppercase">LyriX Stage</div>
                    </div>

                    <div className="flex-1 py-6 px-3 space-y-1">
                        <button
                            onClick={() => { setAddSongInitialData(null); setShowAddModal(true); }}
                            className="w-full flex items-center gap-3 px-3 py-3 mb-4 rounded-xl text-sm font-bold transition-all duration-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02]"
                        >
                            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            Add New Song
                        </button>

                        <NavItem icon={<LibraryIcon />} label="Song Library" active={activeTab === 'library'} onClick={() => setActiveTab('library')} />
                        <NavItem icon={<HeartIcon />} label="Favourites" active={activeTab === 'favourites'} onClick={() => setActiveTab('favourites')} />
                        <NavItem icon={<GlobeIcon />} label="Search Web" active={activeTab === 'web'} onClick={() => setActiveTab('web')} />
                        <NavItem icon={<CalendarIcon />} label="Sunday Service" active={activeTab === 'service'} onClick={() => setActiveTab('service')} />
                        <div className="pt-6">
                            <NavItem icon={<SettingsIcon />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-4 border-t border-slate-200 text-center space-y-2">
                        <button
                            onClick={handleToggleProjector}
                            className={clsx(
                                "w-full py-1.5 rounded text-xs font-bold transition-colors mb-2",
                                isProjectorOpen
                                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                            )}
                        >
                            {isProjectorOpen ? "Close Projector Window" : "Open Projector Window"}
                        </button>
                        <div className="text-[10px] text-slate-400 font-medium pt-1 italic">version {appVersion} &copy; ChurchLyriXApp</div>
                    </div>
                </div>

                {/* Main Content Area */}
                {activeTab === 'web' ? (
                    <WebSearch onImport={(data) => { setAddSongInitialData(data); setShowAddModal(true); }} setCustomAlert={setCustomAlert} />
                ) : activeTab === 'settings' ? (
                    <div className="flex-1 flex flex-col bg-slate-50 p-8 overflow-y-auto">
                        <h2 className="font-display text-3xl font-bold text-slate-800 mb-6">Settings</h2>

                        <div className="space-y-6">

                            {/* Admin Access Panel */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <span className={clsx("p-1.5 rounded-lg", isAdminLoggedIn ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600")}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        </span>
                                        Admin Panel Access
                                    </h3>
                                    {!isAdminLoggedIn ? (
                                        <button
                                            onClick={() => setShowAdminLoginModal(true)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md shadow-slate-800/20 transition-all"
                                        >
                                            Login as Admin
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsAdminLoggedIn(false)}
                                            className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-bold transition-all border border-rose-200"
                                        >
                                            Logout
                                        </button>
                                    )}
                                </div>
                                {!isAdminLoggedIn && (
                                    <div className="text-sm text-slate-500 italic mt-3">
                                        Login to manage categories, perform bulk deletions, and access restricted app settings.
                                    </div>
                                )}

                                {isAdminLoggedIn && (
                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { id: 'categories', label: 'Categories' },
                                                { id: 'uncategorized', label: 'Uncategorized' },
                                                { id: 'bulk_delete', label: 'Bulk Delete' },
                                                { id: 'church_profile', label: 'Church Profile' },
                                                { id: 'projector', label: 'Projector Styling' },
                                                { id: 'app_behavior', label: 'App Behavior' }
                                            ].map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setAdminTab(tab.id)}
                                                    className={clsx(
                                                        "px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all border",
                                                        adminTab === tab.id
                                                            ? "bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/20"
                                                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                                                    )}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Categories Management Panel */}
                            {isAdminLoggedIn && adminTab === 'categories' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        </span>
                                        Category Management
                                    </h3>

                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={newCategoryInput}
                                            onChange={(e) => setNewCategoryInput(e.target.value)}
                                            placeholder="New Category Name..."
                                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (newCategoryInput.trim()) {
                                                    await window.electron.invoke('add-category', newCategoryInput.trim());
                                                    setNewCategoryInput('');
                                                }
                                            }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                        {allCategories.map((cat, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                {editingCategory === cat ? (
                                                    <div className="flex flex-1 gap-2 mr-2">
                                                        <input
                                                            type="text"
                                                            defaultValue={cat}
                                                            autoFocus
                                                            onBlur={() => setEditingCategory(null)}
                                                            onKeyDown={async (e) => {
                                                                if (e.key === 'Enter') {
                                                                    const targetCat = e.target.value.trim();
                                                                    if (targetCat && targetCat !== cat) {
                                                                        await window.electron.invoke('update-category', { oldName: cat, newName: targetCat });
                                                                    }
                                                                    setEditingCategory(null);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingCategory(null);
                                                                }
                                                            }}
                                                            className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm outline-none"
                                                        />
                                                        <span className="text-[10px] text-slate-400 self-center italic">Press Enter to save</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-medium text-slate-700 text-sm">{cat}</span>
                                                )}

                                                <div className="flex gap-1">
                                                    <button onClick={() => setEditingCategory(cat)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Rename">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => {
                                                        setConfirmPrompt({
                                                            title: 'Delete Category',
                                                            message: `Delete category "${cat}"? Songs in it will become Uncategorized.`,
                                                            confirmText: 'Delete',
                                                            confirmStyle: 'red',
                                                            onConfirm: async () => {
                                                                await window.electron.invoke('delete-category', cat);
                                                                if (defaultCategory === cat) setDefaultCategory('Special Songs');
                                                            }
                                                        });
                                                    }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Uncategorized Songs Panel */}
                            {isAdminLoggedIn && adminTab === 'uncategorized' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </span>
                                            Uncategorized Songs
                                        </h3>
                                        <button onClick={async () => {
                                            const res = await window.electron.invoke('get-uncategorized-songs');
                                            setUncategorizedSongs(res || []);
                                        }} className="text-sm font-bold text-blue-600 hover:text-blue-800">Refresh List</button>
                                    </div>
                                    <p className="text-sm text-slate-500 italic mb-4">Songs with a missing or deleted category end up here. Assign them to a valid category.</p>

                                    {uncategorizedSongs.length === 0 ? (
                                        <div className="text-center p-6 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 italic">No uncategorized songs found.</div>
                                    ) : (
                                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                            {uncategorizedSongs.map(song => (
                                                <div key={song.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <div className="font-bold text-slate-800 text-sm mb-2"><span className="text-slate-500 font-mono text-xs mr-2">{song.id}</span>{song.title}</div>
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm shadow-sm"
                                                            onChange={async (e) => {
                                                                if (e.target.value) {
                                                                    await window.electron.invoke('recategorize-song', song.id, e.target.value);
                                                                    // Refresh list
                                                                    const res = await window.electron.invoke('get-uncategorized-songs');
                                                                    setUncategorizedSongs(res || []);
                                                                }
                                                            }}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Assign to Category...</option>
                                                            {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bulk Delete Panel */}
                            {isAdminLoggedIn && adminTab === 'bulk_delete' && (
                                <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5">
                                    <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
                                        <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </span>
                                        Bulk Delete Mode
                                    </h3>
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg mb-4">
                                        <p className="text-sm text-red-800 font-medium mb-2 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            Danger Zone
                                        </p>
                                        <p className="text-xs text-red-600 italic">Select a category below to load songs for deletion. Multiple songs can be selected.</p>
                                    </div>

                                    <div className="mb-4">
                                        <select
                                            value={bulkCategory}
                                            onChange={async (e) => {
                                                setBulkCategory(e.target.value);
                                                const res = await window.electron.invoke('search-songs', '', e.target.value);
                                                setBulkSongsList(res || []);
                                                setBulkSelectedIds([]);
                                            }}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                                        >
                                            <option value="" disabled>Select a category...</option>
                                            {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    {bulkCategory && bulkSongsList.length > 0 && (
                                        <>
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <span className="text-xs font-bold text-slate-500 uppercase">{bulkSongsList.length} Songs Found</span>
                                                <button
                                                    onClick={() => {
                                                        if (bulkSelectedIds.length === bulkSongsList.length) setBulkSelectedIds([]);
                                                        else setBulkSelectedIds(bulkSongsList.map(s => s.id));
                                                    }}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                                                >
                                                    {bulkSelectedIds.length === bulkSongsList.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="space-y-1 mb-4 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-1 bg-slate-50">
                                                {bulkSongsList.map(song => (
                                                    <label key={song.id} className={clsx("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors", bulkSelectedIds.includes(song.id) ? "bg-red-100" : "hover:bg-slate-200/50")}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                            checked={bulkSelectedIds.includes(song.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setBulkSelectedIds([...bulkSelectedIds, song.id]);
                                                                else setBulkSelectedIds(bulkSelectedIds.filter(id => id !== song.id));
                                                            }}
                                                        />
                                                        <div className="flex-1 pr-2 truncate text-sm text-slate-800 font-medium">
                                                            <span className="text-slate-500 font-mono text-xs w-12 inline-block">{song.id}</span>
                                                            {song.title}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            <button
                                                disabled={bulkSelectedIds.length === 0}
                                                onClick={async () => {
                                                    if (confirm(`Are you sure you want to PERMANENTLY delete ${bulkSelectedIds.length} songs?`)) {
                                                        await window.electron.invoke('bulk-delete-songs', bulkSelectedIds);
                                                        // Refresh
                                                        const res = await window.electron.invoke('search-songs', '', bulkCategory);
                                                        setBulkSongsList(res || []);
                                                        setBulkSelectedIds([]);
                                                        setCustomAlert(`Successfully deleted ${bulkSelectedIds.length} songs.`);
                                                    }
                                                }}
                                                className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Delete Selected ({bulkSelectedIds.length})
                                            </button>
                                        </>
                                    )}
                                    {bulkCategory && bulkSongsList.length === 0 && (
                                        <div className="text-center p-6 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 italic">No songs in this category.</div>
                                    )}
                                </div>
                            )}

                            {/* Church Profile Group */}
                            {isAdminLoggedIn && adminTab === 'church_profile' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                            </span>
                                            Church Profile
                                        </h3>
                                        <button
                                            onClick={() => setIsEditingProfile(!isEditingProfile)}
                                            className={clsx(
                                                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all border",
                                                isEditingProfile
                                                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                            )}
                                        >
                                            {isEditingProfile ? 'Save' : 'Edit'}
                                        </button>
                                    </div>
                                    <div className="text-sm text-slate-500 italic mb-4">
                                        Details entered here will appear on the splash screen when starting the application and as a watermark on the projector window.
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Church Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Grace Community Church"
                                                value={churchName}
                                                onChange={(e) => setChurchName(e.target.value)}
                                                disabled={!isEditingProfile}
                                                className={clsx(
                                                    "w-full p-2.5 rounded-lg text-sm transition-all duration-300 font-medium border italic",
                                                    isEditingProfile
                                                        ? "bg-white border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-sm"
                                                        : "bg-slate-50/50 border-slate-200 text-slate-800 cursor-default opacity-80"
                                                )}
                                            />
                                        </div>
                                        <div>
                                            <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Location / Place</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., New York, NY"
                                                value={churchPlace}
                                                onChange={(e) => setChurchPlace(e.target.value)}
                                                disabled={!isEditingProfile}
                                                className={clsx(
                                                    "w-full p-2.5 rounded-lg text-sm transition-all duration-300 font-medium border italic",
                                                    isEditingProfile
                                                        ? "bg-white border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-sm"
                                                        : "bg-slate-50/50 border-slate-200 text-slate-800 cursor-default opacity-80"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Database Connection Status Group */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
                                    <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                        <DatabaseIcon className="w-5 h-5" />
                                    </span>
                                    Database Connection
                                </h3>
                                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-3 h-3 rounded-full animate-pulse",
                                            dbStatus.status === 'connected' ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]" :
                                                dbStatus.status === 'authenticating' ? "bg-yellow-500" : "bg-red-500"
                                        )}></div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 capitalize">{dbStatus.status.replace('_', ' ')}</div>
                                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cloud Sync: {dbStatus.authenticated ? 'Active' : 'Offline'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async () => {
                                                if (isSyncing) return;
                                                setIsSyncing(true);
                                                try {
                                                    const result = await window.electron.invoke('sync-songs');
                                                    if (result.success) {
                                                        setCustomAlert(`Sync Complete! ${result.count} songs up to date.`);
                                                    }
                                                } catch (e) {
                                                    setCustomAlert(`Sync Failed: ${e.message}`);
                                                } finally {
                                                    setIsSyncing(false);
                                                }
                                            }}
                                            disabled={isSyncing}
                                            className={clsx(
                                                "px-4 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2",
                                                isSyncing
                                                    ? "bg-indigo-50 text-indigo-400 border-indigo-100 cursor-not-allowed"
                                                    : "bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                                            )}
                                        >
                                            <svg className={clsx("w-3 h-3", isSyncing && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            {isSyncing ? 'Syncing...' : 'Sync'}
                                        </button>
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="px-4 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Reconnect
                                        </button>
                                    </div>
                                </div>
                                {dbStatus.status === 'auth_error' && (
                                    <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 italic">
                                        <div className="font-bold mb-1">Authentication Failed:</div>
                                        <div className="font-mono bg-white/50 p-1.5 rounded border border-red-100/50 break-all">
                                            {dbStatus.error || "Permission Denied: Please check your Firebase configuration or internet connection."}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Remote Group */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </span>
                                    Mobile Remote Control
                                </h3>
                                <div className="text-sm text-slate-500 italic mb-4">
                                    Control LyriX Stage seamlessly from your smartphone or tablet! Just grab your mobile device, ensure it is connected to the same Wi-Fi network as this computer, and navigate to the address below in your web browser.
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-inner">
                                    <div className="flex items-center gap-6">
                                        {status === 'Running' && ip !== 'Unknown' && (
                                            <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-lg flex-shrink-0">
                                                <QRCode value={`http://${ip}:3001`} size={80} level="L" />
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Server Address</span>
                                            <span className="text-lg font-mono font-bold italic text-slate-800 select-all tracking-tight">
                                                {status === 'Running' && ip !== 'Unknown' ? `http://${ip}:3001` : 'Offline'}
                                            </span>
                                            {status === 'Running' && ip !== 'Unknown' && (
                                                <span className="text-xs text-slate-500 mt-2 font-medium">Scan QR code with your phone's camera</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center flex-shrink-0">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${status === 'Running' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                            <div className={`w-2 h-2 rounded-full ${status === 'Running' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                            {status === 'Running' ? 'Active' : 'Offline'}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (window.electron && window.electron.invoke) {
                                                    await window.electron.invoke('refresh-ip');
                                                }
                                            }}
                                            className="mt-2 px-3 py-1 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 text-slate-500"
                                            title="Refresh IP Address"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Refresh IP
                                        </button>
                                        {status === 'Running' && (
                                            <div className="text-xs mt-2 font-medium flex items-center justify-center gap-2 text-slate-500">
                                                <span>{connections} /</span>
                                                <select
                                                    value={maxRemoteDevices}
                                                    onChange={(e) => setMaxRemoteDevices(Number(e.target.value))}
                                                    className="bg-transparent border-b border-slate-300 outline-none text-slate-800 font-bold focus:border-indigo-500 transition-colors mx-1 italic"
                                                >
                                                    {[...Array(5)].map((_, i) => (
                                                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                                                    ))}
                                                </select>
                                                <span>Limit</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile App Download Group */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v3m0 0l-2-2m2 2l2-2" />
                                        </svg>
                                    </span>
                                    Mobile App Download
                                </h3>
                                <div className="text-sm text-slate-500 italic mb-4">
                                    Download the official LyriX Mobile App to control this computer and manage your song library from anywhere!
                                </div>
                                <div className="flex items-center justify-between bg-blue-50/50 rounded-xl p-5 border border-blue-100/50">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">Get the APK Directly</span>
                                        <span className="text-xs text-slate-500 mt-1">Scan the QR code to download the latest mobile version.</span>
                                    </div>
                                    <button
                                        onClick={() => setShowMobileDownloadQR(true)}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all font-sans"
                                    >
                                        Show QR Code
                                    </button>
                                </div>
                            </div>

                            {/* Projector Styling Group */}
                            {isAdminLoggedIn && adminTab === 'projector' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                                        </span>
                                        Projector Styling
                                    </h3>
                                    <div className="space-y-4">
                                        {/* Font Size & Bold */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="font-semibold text-slate-700 text-xs uppercase">Font Size</label>
                                                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">{fontSize}vw</span>
                                                </div>
                                                <input type="range" min="2" max="15" step="0.5" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Emphasis</label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={isBold} onChange={(e) => setIsBold(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                                    <span className="text-sm text-slate-600 font-medium">Bold Text</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Colors & Background */}
                                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Text Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 p-0 border border-slate-200 rounded cursor-pointer" />
                                                    <span className="text-xs font-mono text-slate-400">{color}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Background Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={backgroundColor} onChange={(e) => { setBackgroundColor(e.target.value); setBackgroundImage(''); }} className="h-9 w-16 p-0 border border-slate-200 rounded cursor-pointer" />
                                                    <span className="text-xs font-mono text-slate-400">{backgroundColor}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Background Image */}
                                        <div className="pt-4 border-t border-slate-50">
                                            <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Background Wallpaper</label>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={async () => {
                                                        if (window.electron) {
                                                            const path = await window.electron.invoke('select-image-file');
                                                            if (path) setBackgroundImage(path);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                                >
                                                    Upload Image...
                                                </button>
                                                {backgroundImage && (
                                                    <button onClick={() => setBackgroundImage('')} className="text-xs text-red-500 font-medium hover:text-red-700">Remove</button>
                                                )}
                                            </div>
                                            {backgroundImage && (
                                                <div className="mt-2 h-24 w-full rounded-lg bg-cover bg-center border border-slate-200" style={{ backgroundImage: `url("${backgroundImage}")` }}></div>
                                            )}
                                        </div>

                                        {/* Alignment & Font Family */}
                                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Align Text</label>
                                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg inline-flex">
                                                    {['left', 'center', 'right'].map(align => (
                                                        <button
                                                            key={align}
                                                            onClick={() => setTextAlign(align)}
                                                            className={clsx("p-1.5 rounded-md transition-all", textAlign === align ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                                                        >
                                                            <div className="w-5 h-5 flex items-center justify-center">
                                                                {align === 'left' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h8" /></svg>}
                                                                {align === 'center' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M9 18h6" /></svg>}
                                                                {align === 'right' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M12 18h8" /></svg>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Font Family</label>
                                                <select
                                                    value={fontFamily}
                                                    onChange={(e) => setFontFamily(e.target.value)}
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm italic"
                                                >
                                                    <option value="sans-serif">Modern (Sans)</option>
                                                    <option value="serif">Classic (Serif)</option>
                                                    <option value="monospace">Typewriter</option>
                                                    <option value="'Courier New', Courier, monospace">Courier</option>
                                                    <option value="'Times New Roman', Times, serif">Times New Roman</option>
                                                    <option value="'Arial', sans-serif">Arial</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* App Behavior Group */}
                            {isAdminLoggedIn && adminTab === 'app_behavior' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                        </span>
                                        Application Behavior
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Default Category</label>
                                            <p className="text-xs text-slate-400 italic mb-2">Category selected by default when adding new songs.</p>
                                            <select
                                                value={defaultCategory}
                                                onChange={(e) => setDefaultCategory(e.target.value)}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm italic"
                                            >
                                                <option value="English Choruses">English Choruses</option>
                                                <option value="English Hymns">English Hymns</option>
                                                <option value="Telugu Songs">Telugu Songs</option>
                                                <option value="Hindi Songs">Hindi Songs</option>
                                                <option value="Special Songs">Special Songs</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Lyrics Preview Layout</label>
                                                <p className="text-xs text-slate-400 italic mb-2">Choose how slides are displayed in the main preview window.</p>
                                                <select
                                                    value={previewMode}
                                                    onChange={(e) => {
                                                        setPreviewMode(e.target.value);
                                                        localStorage.setItem('setting_previewMode', e.target.value);
                                                    }}
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm italic"
                                                >
                                                    <option value="single">Single Slide (Large Text)</option>
                                                    <option value="grid">Grid View (All Slides Interactive)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-2">Preview Font</label>
                                                <p className="text-xs text-slate-400 italic mb-2">Choose the font for the lyrics preview pane.</p>
                                                <select
                                                    value={previewFont}
                                                    onChange={(e) => {
                                                        setPreviewFont(e.target.value);
                                                        localStorage.setItem('setting_previewFont', e.target.value);
                                                    }}
                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm italic"
                                                >
                                                    <option value="lyrics">Classic (Lora Serif)</option>
                                                    <option value="sans">Modern (Inter Sans)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-1">Auto-Format Lyrics</label>
                                                <p className="text-xs text-slate-400 italic">Automatically try to format pasted lyrics into stanzas.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={autoFormat} onChange={(e) => setAutoFormat(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-1">Show Application Controls</label>
                                                <p className="text-xs text-slate-400 italic">Show or hide the system refresh, zoom, and developer tools.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={showAppControls} onChange={(e) => setShowAppControls(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-xs uppercase block mb-1">Show Database Management</label>
                                                <p className="text-xs text-slate-400 italic">Show or hide the XML import and database tools.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={showDatabaseManagement} onChange={(e) => setShowDatabaseManagement(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        <div className="pt-4 border-t border-slate-50">
                                            <label className="font-semibold text-slate-700 text-xs uppercase block mb-3">Visible Library Categories</label>
                                            <p className="text-xs text-slate-400 italic mb-4">Select which categories appear as tabs in the Song Library.</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                {allCategories.map(cat => (
                                                    <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleCategories.includes(cat)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setVisibleCategories([...visibleCategories, cat]);
                                                                } else {
                                                                    setVisibleCategories(visibleCategories.filter(c => c !== cat));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 transition-all"
                                                        />
                                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors">{cat}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* App Version & Updates Group */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </span>
                                    Version & Updates
                                </h3>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">LyriX Desktop v{appVersion}</div>
                                        <div className="text-xs text-slate-500 italic mt-1">
                                            {updateStatus === 'idle' && 'Your app is up to date.'}
                                            {updateStatus === 'checking' && 'Checking for updates...'}
                                            {updateStatus === 'available' && `New version ${updateInfo?.version} available!`}
                                            {updateStatus === 'not-available' && 'You have the latest version.'}
                                            {updateStatus === 'downloading' && `Downloading update: ${Math.round(updateProgress)}%`}
                                            {updateStatus === 'downloaded' && 'Update ready to install.'}
                                            {updateStatus === 'error' && `Update Error: ${updateError}`}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setUpdateStatus('checking');
                                                window.electron.invoke('check-for-updates').catch(err => {
                                                    setUpdateStatus('error');
                                                    setUpdateError(err.message);
                                                });
                                            }}
                                            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                                            className={clsx(
                                                "px-4 py-2 rounded-lg text-sm font-bold transition-all border",
                                                updateStatus === 'available'
                                                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700 shadow-md"
                                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            {updateStatus === 'available' ? 'Review Update' : 'Check for Updates'}
                                        </button>
                                        {updateStatus === 'available' && (
                                            <button
                                                onClick={() => window.electron.invoke('start-download')}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
                                            >
                                                Download Now
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {updateStatus === 'downloading' && (
                                    <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
                                    </div>
                                )}
                            </div>

                            {/* Database Management Group */}
                            {showDatabaseManagement && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                                        </span>
                                        Database Management
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                            <div>
                                                <label className="font-semibold text-slate-700 text-sm block mb-1">Import OpenLyrics Database (.xml)</label>
                                                <p className="text-xs text-slate-400 italic">Import songs from an OpenLP or OpenLyrics exported database. Duplicates will be skipped or overwritten.</p>
                                            </div>
                                            <label className="shrink-0 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                Import XML
                                                <input
                                                    type="file"
                                                    accept=".xml"
                                                    multiple
                                                    className="hidden"
                                                    onChange={handleXMLImport}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Application Controls Group */}
                            {showAppControls && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        </span>
                                        Application Controls
                                    </h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        <button onClick={() => window.electron?.appControl('reload')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Reload App
                                        </button>
                                        <button onClick={() => window.electron?.appControl('fullscreen')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            Toggle Fullscreen
                                        </button>
                                        <button onClick={() => window.electron?.appControl('devtools')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                            Developer Tools
                                        </button>
                                        <button onClick={() => window.electron?.appControl('zoom-in')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                            Zoom In
                                        </button>
                                        <button onClick={() => window.electron?.appControl('zoom-out')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                                            Zoom Out
                                        </button>
                                        <button onClick={() => window.electron?.appControl('zoom-reset')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Reset Zoom
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                ) : (
                    <>
                        {/* List Column (Library, Favourites, or Schedule) */}
                        {activeTab === 'library' || activeTab === 'favourites' ? (
                            <div className="w-[320px] flex flex-col border-r border-slate-200 bg-white z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                                {/* Search Header */}
                                <div className="p-4 border-b border-slate-100 space-y-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            value={searchQuery}
                                            onChange={(e) => handleSearch(e.target.value)}
                                        />
                                        <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {['All', ...visibleCategories].map(f => (
                                            <FilterChip key={f} label={f.replace(' Songs', '').replace('English ', '')} active={activeFilter === f} onClick={() => handleSearch(searchQuery, f)} />
                                        ))}
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto w-full">
                                    <div className="text-[10px] font-bold text-slate-400 px-4 py-2 uppercase tracking-wider bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md italic">
                                        Showing top results
                                    </div>
                                    {searchResults.filter(song => {
                                        if (activeTab === 'favourites') return favourites.includes(song.id);
                                        return activeFilter === 'All' ? visibleCategories.includes(song.category) : true;
                                    }).slice(0, 100).map(song => (
                                        <div
                                            key={song.id}
                                            onClick={() => selectSong(song)}
                                            className={clsx(
                                                "px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50 group relative",
                                                currentSong?.id === song.id ? "bg-blue-50/60" : ""
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="font-semibold text-slate-800 text-sm">{cleanText((song.title || song.preview || '').split('\n')[0].substring(0, 40)) || 'Untitled'}...</div>
                                                    <div className="text-xs text-slate-500 mt-1 line-clamp-1 italic">{song.category}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={clsx(
                                                        "text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-600 bg-blue-100",
                                                        currentSong?.id === song.id ? "bg-blue-200 text-blue-700" : ""
                                                    )}>{song.id}</span>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddToSchedule(song.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {currentSong?.id === song.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                                        </div>
                                    ))}
                                </div>

                                {/* List Footer */}
                                <div className="p-2 border-t border-slate-100 text-center text-[10px] text-slate-400 bg-slate-50/30 italic">
                                    Showing {searchResults.length} {searchResults.length === 1 ? 'Song' : 'Songs'}
                                </div>
                            </div>
                        ) : (
                            <SundayServiceList
                                schedule={schedule}
                                onRemove={handleRemoveFromSchedule}
                                onReorder={handleReorderSchedule}
                                onRefresh={() => { fetchSchedule(); setCustomAlert("Schedule synced successfully."); }}
                                onSelect={(song) => {
                                    selectSong(song);
                                    if (!isProjectorOpen) {
                                        handleToggleProjector();
                                    }
                                }}
                                currentSongId={currentSong?.id}
                                isAdminLoggedIn={isAdminLoggedIn}
                            />
                        )}

                        {/* Preview & Controls Column (Shared) */}
                        <SongPreviewControls
                            currentSong={currentSong}
                            slides={slides}
                            currentSlideIndex={currentSlideIndex}
                            setCurrentSlideIndex={setCurrentSlideIndex}
                            isBlack={isBlack}
                            setIsBlack={setIsBlack}
                            previewMode={previewMode}
                            previewFont={previewFont}
                            onDelete={handleDelete}
                            isFavourite={currentSong && favourites.includes(currentSong.id)}
                            onToggleFavourite={() => {
                                if (!currentSong) return;
                                setFavourites(prev =>
                                    prev.includes(currentSong.id)
                                        ? prev.filter(id => id !== currentSong.id)
                                        : [...prev, currentSong.id]
                                );
                            }}
                            onEdit={() => {
                                if (!currentSong) return;
                                const slides = Array.isArray(currentSong.slides) ? currentSong.slides : [currentSong.slides || ""];
                                // Join slides with double newline for editing
                                const lyrics = slides.join('\n\n');
                                setAddSongInitialData({
                                    id: currentSong.id,
                                    title: currentSong.preview || currentSong.title,
                                    category: currentSong.category,
                                    lyrics: lyrics,
                                    isEdit: true
                                });
                                setShowAddModal(true);
                            }}
                        />
                    </>
                )}

                {showAddModal && (
                    <AddSongModal
                        initialData={addSongInitialData}
                        onConfirmOverwrite={confirmOverwrite}
                        defaultCategory={defaultCategory} // Pass default category
                        onClose={() => { setShowAddModal(false); setAddSongInitialData(null); }}
                        onSave={(savedSong) => {
                            handleSearch('', activeFilter);
                            if (currentSong && savedSong?.id === currentSong.id) {
                                selectSong(savedSong);
                            }
                        }}
                    />
                )}

                {/* Generic Confirm Modal */}
                {confirmPrompt && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100">
                            <div className="flex items-start gap-4">
                                <div className={clsx(
                                    "shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner mt-0.5",
                                    confirmPrompt.confirmStyle === 'red' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                                )}>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">{confirmPrompt.title || "Confirm Action"}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed italic">{confirmPrompt.message}</p>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setConfirmPrompt(null)}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirmPrompt.onConfirm) confirmPrompt.onConfirm();
                                        setConfirmPrompt(null);
                                    }}
                                    className={clsx(
                                        "flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95",
                                        confirmPrompt.confirmStyle === 'red' ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                                    )}
                                >
                                    {confirmPrompt.confirmText || "Confirm"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Alert Modal */}
                {customAlert && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100">
                            <div className="flex items-start gap-4">
                                <div className="shrink-0 w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner mt-0.5">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Notice</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed italic">{customAlert}</p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setCustomAlert(null)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Overwrite Confirmation Modal (Promise-based) */}
                {overwritePrompt && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100">
                            <div className="flex items-start gap-4">
                                <div className="shrink-0 w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner mt-0.5">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Overwrite Song?</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed italic">The song <span className="font-bold text-slate-700 not-italic">"{overwritePrompt.title}"</span> already exists. Do you want to replace it?</p>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => { overwritePrompt.resolve(false); setOverwritePrompt(null); }}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
                                >
                                    Skip Import
                                </button>
                                <button
                                    onClick={() => { overwritePrompt.resolve(true); setOverwritePrompt(null); }}
                                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                                >
                                    Overwrite
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Schedule Add Confirmation Modal has been replaced by a toast */}

                {/* Delete Confirmation Modal */}
                {songToDelete && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100">
                            <div className="flex items-start gap-4">
                                <div className="shrink-0 w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-inner mt-0.5">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Forever</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed italic">Delete <span className="font-bold text-slate-700 not-italic">"{songToDelete.title || songToDelete.id}"</span>? This cannot be undone.</p>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setSongToDelete(null)}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                >
                                    Delete Song
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Exit Confirmation Modal */}

                {/* Admin Login Modal */}
                {showAdminLoginModal && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-inner">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <h3 className="text-xl font-black text-slate-800">Admin Login</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={adminUsernameInput}
                                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition-all font-medium"
                                        placeholder="Enter admin username"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={adminPasswordInput}
                                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                const valid = await window.electron.invoke('verify-admin', { user: adminUsernameInput, pass: adminPasswordInput });
                                                if (valid) {
                                                    setIsAdminLoggedIn(true);
                                                    setShowAdminLoginModal(false);
                                                    setAdminPasswordInput('');
                                                    setAdminLoginError('');
                                                } else {
                                                    setAdminLoginError('Invalid username or password.');
                                                }
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition-all font-medium"
                                        placeholder="Enter admin password"
                                    />
                                </div>
                                {adminLoginError && (
                                    <p className="text-xs text-red-500 font-bold bg-red-50 py-2 px-3 rounded-lg border border-red-100">{adminLoginError}</p>
                                )}
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAdminLoginModal(false);
                                        setAdminPasswordInput('');
                                        setAdminLoginError('');
                                    }}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const valid = await window.electron.invoke('verify-admin', { user: adminUsernameInput, pass: adminPasswordInput });
                                        if (valid) {
                                            setIsAdminLoggedIn(true);
                                            setShowAdminLoginModal(false);
                                            setAdminPasswordInput('');
                                            setAdminLoginError('');
                                        } else {
                                            setAdminLoginError('Invalid username or password.');
                                        }
                                    }}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                                >
                                    Login
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showCloseConfirm && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center shadow-inner mb-6 animate-bounce-subtle">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Wait a moment!</h3>
                            <p className="text-slate-500 leading-relaxed mb-8 italic">Are you sure you want to close the application?</p>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all active:scale-95"
                                >
                                    Stay Here
                                </button>
                                <button
                                    onClick={() => window.electron.invoke('exit-app')}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-rose-500/30 transition-all active:scale-95"
                                >
                                    Exit Now
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* First Launch Welcome Modal (Multi-step) */}
                {welcomeStep > 0 && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[560px] overflow-hidden animate-fade-in border border-slate-200/50 flex flex-col">
                            {/* Header Area */}
                            <div className="bg-slate-50 border-b border-slate-100 py-6 px-8 text-center relative overflow-hidden shrink-0">

                                {welcomeStep === 1 && (
                                    <div className="animate-fade-in">
                                        <img src="./icon.ico" className="w-16 h-16 mx-auto mb-4 drop-shadow-md relative z-10" alt="LyriX Logo" />
                                        <h2 className="text-2xl font-bold text-slate-800 relative z-10">Welcome to LyriX Stage!</h2>
                                        <p className="text-sm text-slate-500 mt-2 relative z-10">Let's set up your profile to get started.</p>
                                    </div>
                                )}

                                {welcomeStep === 2 && (
                                    <div className="animate-fade-in">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 relative z-10">Adding Songs</h2>
                                        <p className="text-sm text-slate-500 mt-2 relative z-10">Build your library easily.</p>
                                    </div>
                                )}

                                {welcomeStep === 3 && (
                                    <div className="animate-fade-in">
                                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 relative z-10">Presenting Lyrics</h2>
                                        <p className="text-sm text-slate-500 mt-2 relative z-10">Control the screen with ease.</p>
                                    </div>
                                )}

                                {welcomeStep === 4 && (
                                    <div className="animate-fade-in">
                                        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 relative z-10">Mobile Remote Control</h2>
                                        <p className="text-sm text-slate-500 mt-2 relative z-10">Control LyriX right from your phone.</p>
                                    </div>
                                )}

                                {welcomeStep === 5 && (
                                    <div className="animate-fade-in">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 relative z-10">Mobile Scheduling</h2>
                                        <p className="text-sm text-slate-500 mt-2 relative z-10">Build the service from anywhere.</p>
                                    </div>
                                )}
                            </div>

                            {/* Form & Content Area */}
                            <div className="px-8 py-5 flex-1 flex flex-col">
                                {welcomeStep === 1 && (
                                    <div className="animate-fade-in h-full flex flex-col">
                                        <div className="space-y-6 flex-1">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Church/Organization Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Grace Fellowship Church"
                                                    value={churchName}
                                                    onChange={(e) => setChurchName(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-400 transition-all italic font-medium"
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Location / City <span className="text-slate-400 font-normal lowercase tracking-normal">(Optional)</span></label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. New York, NY"
                                                    value={churchPlace}
                                                    onChange={(e) => setChurchPlace(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-400 transition-all italic font-medium"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (churchName.trim().length > 0) setWelcomeStep(2);
                                            }}
                                            disabled={!churchName.trim()}
                                            className="w-full mt-auto py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next Step &rarr;
                                        </button>
                                    </div>
                                )}

                                {welcomeStep === 2 && (
                                    <div className="animate-fade-in h-full flex flex-col">
                                        <div className="space-y-3 text-slate-600 text-sm flex-1">
                                            <p>You can add songs to your database in two ways:</p>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-blue-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
                                                <div><strong className="text-slate-800">Manual Entry:</strong> Click "Add New Song" in the sidebar to type or paste a song directly.</div>
                                            </div>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-blue-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg></div>
                                                <div><strong className="text-slate-800">Web Search:</strong> Switch to the "Search Web" tab to automatically download lyrics from the internet!</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-auto pt-4">
                                            <button onClick={() => setWelcomeStep(1)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">Back</button>
                                            <button onClick={() => setWelcomeStep(3)} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">Next &rarr;</button>
                                        </div>
                                    </div>
                                )}

                                {welcomeStep === 3 && (
                                    <div className="animate-fade-in h-full flex flex-col">
                                        <div className="space-y-3 text-slate-600 text-sm flex-1">
                                            <p>When you have a song selected, you'll see the preview pane.</p>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-indigo-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
                                                <div><strong className="text-slate-800">Projector Window:</strong> Click "Open Projector Window" at the bottom left to launch the second screen. Move it to your projector display.</div>
                                            </div>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-indigo-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg></div>
                                                <div><strong className="text-slate-800">Changing Slides:</strong> You can click the slides in the preview pane, or simply use your keyboard <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-xs">&larr;</kbd> <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-xs">&rarr;</kbd> keys!</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-auto pt-4">
                                            <button onClick={() => setWelcomeStep(2)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">Back</button>
                                            <button onClick={() => setWelcomeStep(4)} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">Next &rarr;</button>
                                        </div>
                                    </div>
                                )}

                                {welcomeStep === 4 && (
                                    <div className="animate-fade-in h-full flex flex-col">
                                        <div className="space-y-3 text-slate-600 text-sm flex-1">
                                            <p>You can control the live lyrics right from your smartphone!</p>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-purple-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                                                <div><strong className="text-slate-800">Finding the Link:</strong> Go to the <strong>Settings</strong> tab and scroll down to the "Mobile Remote Control" section.</div>
                                            </div>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-purple-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg></div>
                                                <div><strong className="text-slate-800">Scan & Go:</strong> Scan the QR code with your phone camera! Make sure your PC and phone are on the same Wi-Fi network.</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-auto pt-4">
                                            <button onClick={() => setWelcomeStep(3)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">Back</button>
                                            <button onClick={() => setWelcomeStep(5)} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">Next &rarr;</button>
                                        </div>
                                    </div>
                                )}

                                {welcomeStep === 5 && (
                                    <div className="animate-fade-in h-full flex flex-col">
                                        <div className="space-y-3 text-slate-600 text-sm flex-1">
                                            <p>Our most powerful feature: The entire Sunday Service schedule syncs in real-time with the Mobile Web Remote!</p>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-emerald-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                                                <div><strong className="text-slate-800">Add from anywhere:</strong> The worship leader can open the Remote App on their phone, search the library, and add songs directly to the main computer's schedule without touching the PC!</div>
                                            </div>
                                            <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="mt-0.5 text-emerald-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div>
                                                <div><strong className="text-slate-800">Instant Sync:</strong> As soon as a song is scheduled from the phone, the tech strictly needs to click <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-xs">&rarr;</kbd> to go live.</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-auto pt-4">
                                            <button onClick={() => setWelcomeStep(4)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">Back</button>
                                            <button onClick={() => { setWelcomeStep(0); setIsEditingProfile(false); }} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">Complete Tour ✨</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dots */}
                            {welcomeStep > 0 && (
                                <div className="flex justify-center gap-2 pb-5 shrink-0">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <div key={s} className={clsx("w-2 h-2 rounded-full transition-all", welcomeStep === s ? "bg-blue-500 w-4" : "bg-slate-200")}></div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile App Download QR Modal */}
                {showMobileDownloadQR && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col items-center">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Download Mobile App</h3>
                            <p className="text-sm text-slate-500 text-center mb-8 italic px-4">Scan this QR code with your phone to jump straight to the direct APK download.</p>

                            <div className="bg-white p-6 border-4 border-slate-50 rounded-[2rem] shadow-inner mb-8">
                                <QRCode value={`https://github.com/justforaitoolz-ops/LyriX-Church-System/releases/download/v${appVersion}/LyriX-Mobile.apk`} size={200} level="M" />
                            </div>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => setShowMobileDownloadQR(false)}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


function SongPreviewControls({ currentSong, slides, currentSlideIndex, setCurrentSlideIndex, isBlack, setIsBlack, previewMode, previewFont, onEdit, onDelete, isFavourite, onToggleFavourite }) {
    return (
        <div className="flex-1 flex flex-col bg-slate-50/30 relative min-h-0">

            {/* Main Preview */}
            <div className="flex-1 flex flex-col p-8 relative overflow-hidden">
                {currentSong ? (
                    <div className={clsx("flex-1 transition-opacity duration-500 flex flex-col min-h-0", isBlack ? "opacity-0" : "opacity-100")}>
                        {previewMode === 'grid' ? (
                            <div className="flex-1 overflow-y-auto p-4 -m-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                                    {slides.map((slide, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setCurrentSlideIndex(idx)}
                                            className={clsx(
                                                "min-h-[160px] bg-white rounded-xl p-5 border-2 cursor-pointer transition-all flex flex-col group relative overflow-hidden",
                                                currentSlideIndex === idx
                                                    ? "border-blue-500 ring-4 ring-blue-500/20 shadow-md"
                                                    : "border-slate-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 shadow-sm"
                                            )}
                                        >
                                            <div className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex justify-between items-center shrink-0">
                                                <span>Slide {idx + 1}</span>
                                                {currentSlideIndex === idx && (
                                                    <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shadow-sm border border-blue-100/50">
                                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div> Live
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center text-center">
                                                <p className={clsx(
                                                    previewFont === 'lyrics' ? "font-lyrics italic" : "font-sans",
                                                    "text-[13px] leading-relaxed whitespace-pre-line my-auto",
                                                    currentSlideIndex === idx ? "text-slate-900 font-bold" : "text-slate-600 font-medium"
                                                )}>
                                                    {slide || <span className={clsx(previewFont === 'lyrics' ? "font-lyrics" : "font-sans", "text-slate-300 italic")}>Blank Slide</span>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center max-w-4xl">
                                    <h2 className={clsx(
                                        "text-2xl md:text-3xl font-bold text-slate-800 leading-tight mb-8 tracking-tight",
                                        previewFont === 'lyrics' ? "font-lyrics italic" : "font-sans"
                                    )}>
                                        {slides[currentSlideIndex]}
                                    </h2>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center opacity-40">
                            <div className="text-6xl mb-4">👋</div>
                            <div className="text-xl font-medium text-slate-400">Select a song to preview</div>
                        </div>
                    </div>
                )}

                {isBlack && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                        <div className="bg-slate-800 text-white px-6 py-2 rounded-full shadow-xl font-bold tracking-widest uppercase text-sm animate-pulse">
                            Black Screen Active
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Control Bar */}
            <div className="h-16 bg-white border-t border-slate-200 flex items-center justify-between px-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onToggleFavourite}
                        disabled={!currentSong}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            isFavourite
                                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 disabled:opacity-50"
                        )}
                        title={isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                    >
                        <HeartIcon className={clsx("w-3 h-3", isFavourite ? "fill-current" : "")} />
                        {isFavourite ? 'Favourited' : 'Favourite'}
                    </button>
                    <button
                        onClick={onEdit}
                        disabled={!currentSong}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 disabled:opacity-50"
                        title="Edit Lyrics"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={!currentSong}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                        title="Delete Song"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                    </button>
                    <button
                        onClick={() => setIsBlack(!isBlack)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                            isBlack
                                ? "bg-red-100 text-red-600 border-red-200"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        )}
                    >
                        <div className={clsx("w-2 h-2 rounded-full", isBlack ? "bg-red-500" : "bg-slate-400")}></div>
                        {isBlack ? 'OFF AIR' : 'LIVE'}
                    </button>
                    <span className="text-xs text-slate-400 italic">
                        {isBlack ? 'Projector is blacked out' : 'Projector showing content'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { if (currentSlideIndex > 0) setCurrentSlideIndex(i => i - 1) }}
                        disabled={!currentSong || currentSlideIndex === 0}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="text-sm font-medium text-slate-500 w-16 text-center tabular-nums">
                        {currentSong ? `${currentSlideIndex + 1} / ${slides.length}` : '- / -'}
                    </div>

                    <button
                        onClick={() => { if (currentSlideIndex < slides.length - 1) setCurrentSlideIndex(i => i + 1) }}
                        disabled={!currentSong || currentSlideIndex === slides.length - 1}
                        className="p-2 rounded-full hover:bg-blue-50 text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

function SundayServiceList({ schedule, onRemove, onReorder, onSelect, onRefresh, currentSongId, isAdminLoggedIn }) {
    if (schedule.length === 0) {
        return (
            <div className="w-[320px] bg-slate-50 flex flex-col items-center justify-center text-slate-400 section-split-border">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-200">
                    <CalendarIcon className="w-8 h-8 opacity-20" />
                </div>
                <h3 className="text-base font-bold text-slate-600 mb-1">Schedule Empty</h3>
                <p className="text-xs text-center max-w-[200px] leading-relaxed">Add songs from the Library using the <span className="font-bold">+</span> button.</p>
            </div>
        )
    }

    const moveItem = (e, index, direction) => {
        e.stopPropagation();
        const newSchedule = [...schedule];
        if (direction === 'up' && index > 0) {
            [newSchedule[index], newSchedule[index - 1]] = [newSchedule[index - 1], newSchedule[index]];
            onReorder(newSchedule);
        } else if (direction === 'down' && index < newSchedule.length - 1) {
            [newSchedule[index], newSchedule[index + 1]] = [newSchedule[index + 1], newSchedule[index]];
            onReorder(newSchedule);
        }
    };

    return (
        <div className="w-[320px] flex flex-col border-r border-slate-200 bg-white z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    <span className="text-blue-600"><CalendarIcon /></span>
                    Sunday Service
                </h2>
                <div className="flex items-center gap-2">
                    {isAdminLoggedIn && (
                        <button
                            onClick={() => {
                                setConfirmPrompt({
                                    title: 'Clear Schedule',
                                    message: 'Are you sure you want to clear the entire schedule? This will remove all songs from the Sunday Service list.',
                                    confirmText: 'Clear All',
                                    confirmStyle: 'red',
                                    onConfirm: () => {
                                        onRefresh && window.electron?.invoke('clear-schedule').then(() => onRefresh(true));
                                    }
                                });
                            }}
                            className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                            title="Clear Schedule"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                    <button
                        onClick={() => onRefresh && onRefresh(true)}
                        className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        title="Refresh Schedule"
                    >
                        <RefreshIcon className="w-4 h-4" />
                    </button>
                    <div className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full italic">
                        {schedule.length}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {schedule.map((item, index) => (
                    <div
                        key={item.instanceId}
                        onClick={() => onSelect(item)}
                        className={clsx(
                            "py-2 px-3 border-b border-slate-50 cursor-pointer transition-all group flex items-center gap-3",
                            currentSongId === item.id ? "bg-blue-50" : "hover:bg-slate-50"
                        )}
                    >
                        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-300 bg-slate-100 rounded">
                            {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className={clsx(
                                "font-bold text-sm truncate",
                                currentSongId === item.id ? "text-blue-700" : "text-slate-700"
                            )}>
                                {cleanText(item.title?.split('\n')[0])}
                            </h4>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.songId} • {item.category}</div>
                        </div>

                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => moveItem(e, index, 'up')}
                                disabled={index === 0}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 disabled:opacity-0"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(item.instanceId); }}
                                className="p-1 hover:bg-red-100 rounded text-slate-300 hover:text-red-500"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                            <button
                                onClick={(e) => moveItem(e, index, 'down')}
                                disabled={index === schedule.length - 1}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 disabled:opacity-0"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function NavItem({ icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                active
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-100 font-medium hover:text-slate-900"
            )}
        >
            <div className={clsx("w-5 h-5 transition-transform", active ? "text-blue-600 scale-110 drop-shadow-sm" : "text-slate-400")}>{icon}</div>
            {label}
        </button>
    )
}

function FilterChip({ label, active, onClick }) {
    return (
        <button onClick={onClick} className={clsx(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
            active
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
        )}>
            {label}
        </button>
    )
}

function AddSongModal({ onClose, onSave, initialData, defaultCategory, onConfirmOverwrite }) {
    const [category, setCategory] = useState(initialData?.category || defaultCategory || 'Special Songs');
    const [id, setId] = useState(initialData?.id || '');
    const [title, setTitle] = useState(initialData?.title || '');
    const [lyrics, setLyrics] = useState(initialData?.lyrics || '');
    const [loading, setLoading] = useState(false);

    const isEdit = initialData?.isEdit;

    useEffect(() => {
        // Auto-generate ID only if not provided and when category changes (and NOT in edit mode)
        if (!initialData?.id && !isEdit) {
            async function fetchNextId() {
                if (window.electron) {
                    const nextId = await window.electron.invoke('get-next-id', category);
                    setId(nextId);
                }
            }
            fetchNextId();
        }
    }, [category, initialData, isEdit]);

    const handleSave = async () => {
        if (!id || !lyrics || !title.trim()) return;
        setLoading(true);

        const rawLines = lyrics.split('\n'); // Don't trim/filter yet, we need to respect double newlines
        const slides = [];
        let currentSlide = [];

        let buildingSlide = false;

        // Smart split logic:
        // Use double newlines (\n\n) as explicit slide separators.
        // If no double newlines, use default 6-line buffer.

        const hasDoubleNewlines = lyrics.includes('\n\n');

        if (hasDoubleNewlines) {
            // Split by double newline to get distinct slides
            const rawSlides = lyrics.split(/\n\s*\n/);
            rawSlides.forEach(slideText => {
                const cleanedLines = slideText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l)
                    .map(l => l.replace(/^\d+\.?\s*/, '')); // Strip leading numbers

                if (cleanedLines.length > 0) {
                    slides.push(cleanedLines.join('\n'));
                }
            });
        } else {
            // Fallback to line-count splitting
            const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l);
            lines.forEach((line, i) => {
                const cleanLine = line.replace(/^\d+\.?\s*/, '');
                currentSlide.push(cleanLine);
                if (currentSlide.length >= 6 || i === lines.length - 1) {
                    if (currentSlide.length > 0) {
                        slides.push(currentSlide.join('\n'));
                        currentSlide = [];
                    }
                }
            });
        }

        const songData = {
            id,
            category,
            title: cleanText(title || 'Unknown Song'),
            slides
        };

        // If not explicit title, infer from first slide
        if (!title && slides.length > 0) {
            songData.title = cleanText(slides[0].split('\n')[0]);
        }

        const resolvedTitle = songData.title;

        try {
            if (window.electron) {
                // Duplicate check for New Songs (and Title changes in Edit)
                const existingSongs = await window.electron.invoke('search-songs', '', 'All');
                const sanitizeTitle = t => (t || "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const duplicateSong = existingSongs.find(s =>
                    s.id !== id &&
                    s.title &&
                    sanitizeTitle(s.title) === sanitizeTitle(resolvedTitle)
                );

                if (duplicateSong) {
                    const shouldOverwrite = await onConfirmOverwrite(resolvedTitle);
                    if (!shouldOverwrite) {
                        setLoading(false);
                        return; // Abort save
                    }
                    // If overwrite, we actually update the duplicate song's ID's slides
                    songData.id = duplicateSong.id;
                    songData.category = duplicateSong.category; // Keep original category
                    await window.electron.invoke('update-song', songData);
                } else {
                    // Normal behavior
                    if (isEdit) {
                        await window.electron.invoke('update-song', songData);
                    } else {
                        await window.electron.invoke('add-song', songData);
                    }
                }

                onSave(songData);
                onClose();
            }
        } catch (e) {
            setCustomAlert('Failed to save song: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 sm:pt-20">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[85vh] border border-slate-200/60 shadow-indigo-500/10">
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-display text-xl font-bold text-slate-800">{isEdit ? 'Edit Song' : 'Add New Song'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                            <select
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm italic"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            >
                                {window.electron && JSON.parse(localStorage.getItem('setting_visibleCategories') || '[]').map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                                {/* Fallback if no local storage yet */}
                                {!window.electron && ['English Choruses', 'English Hymns', 'Telugu Songs', 'Hindi Songs', 'Marathi Songs', 'Special Songs', 'Children Songs'].map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Song ID</label>
                            <input
                                type="text"
                                disabled={isEdit}
                                className={clsx(
                                    "w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono italic",
                                    isEdit ? "opacity-50 cursor-not-allowed bg-slate-100" : ""
                                )}
                                value={id}
                                onChange={e => setId(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            className={clsx(
                                "w-full p-2 bg-slate-50 border rounded-lg text-sm italic",
                                !title.trim() ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-red-50" : "border-slate-200"
                            )}
                            placeholder="Song Title"
                            value={title}
                            onChange={e => {
                                const val = e.target.value;
                                if (val.length > 0) {
                                    setTitle(val.charAt(0).toUpperCase() + val.slice(1));
                                } else {
                                    setTitle(val);
                                }
                            }}
                        />
                        {!title.trim() && <p className="text-xs text-red-500 mt-1 italic">Title is required.</p>}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Lyrics</label>
                            <button
                                onClick={() => {
                                    // Smart formatting logic
                                    let text = lyrics.trim();

                                    // 1. Normalize line endings
                                    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                                    // 2. Identify if it's a "blob" (few double newlines)
                                    const doubleNewlines = (text.match(/\n\n/g) || []).length;
                                    const lines = text.split('\n').filter(l => l.trim().length > 0);

                                    if (doubleNewlines < lines.length / 6) {
                                        let newText = "";
                                        let lineCount = 0;

                                        lines.forEach((line, i) => {
                                            newText += line.trim() + "\n";
                                            lineCount++;

                                            const nextLine = lines[i + 1];
                                            const seemsLikeNewStanza = lineCount >= 4;

                                            if (seemsLikeNewStanza) {
                                                newText += "\n";
                                                lineCount = 0;
                                            }
                                        });
                                        text = newText;
                                    } else {
                                        // Already has structure, just ensure double spacing is clean
                                        text = text.replace(/\n\n+/g, '\n\n');
                                    }

                                    setLyrics(text.trim());
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                                ✨ Auto-Format
                            </button>
                        </div>
                        <textarea
                            className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-sans leading-relaxed focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono whitespace-pre-wrap italic"
                            placeholder="Paste lyrics here..."
                            value={lyrics}
                            onChange={e => setLyrics(e.target.value)}
                        ></textarea>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !id || !lyrics || !title.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? 'Saving...' : (isEdit ? 'Save Song' : 'Add Song')}
                    </button>
                </div>
            </div>
        </div>
    )
}

function WebSearch({ onImport, setCustomAlert }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [viewingUrl, setViewingUrl] = useState(null);
    const [fetchedContent, setFetchedContent] = useState('');
    const [fetchingContent, setFetchingContent] = useState(false);

    const handleSearch = async () => {
        if (!query) return;
        if (!navigator.onLine) {
            setCustomAlert("No internet connection. Please connect to a network to search the web.");
            return;
        }

        setLoading(true);
        setResults([]);
        setViewingUrl(null);
        try {
            const res = await window.electron.invoke('search-lyrics', query);
            setResults(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleView = async (url) => {
        if (!navigator.onLine) {
            setCustomAlert("No internet connection. Please connect to a network to fetch lyrics.");
            return;
        }

        setViewingUrl(url);
        setFetchingContent(true);
        setFetchedContent('');
        try {
            const content = await window.electron.invoke('fetch-lyrics-content', url);
            setFetchedContent(content);
        } catch (e) {
            setFetchedContent("Error fetching content.");
        } finally {
            setFetchingContent(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">
            {/* Search Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex gap-2 shadow-sm z-10">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Search for song title, lyrics..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <div className="absolute left-3 top-3 text-slate-400"><GlobeIcon /></div>
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-70"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {viewingUrl ? (
                    // Content View
                    <div className="absolute inset-0 flex flex-col bg-white animate-fade-in">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <button onClick={() => setViewingUrl(null)} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                Back to Results
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onImport({ lyrics: fetchedContent, title: query })}
                                    disabled={!fetchedContent || fetchingContent}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-green-500/30 transition-all"
                                >
                                    Import to Library
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {fetchingContent ? (
                                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="text-sm text-slate-400 font-medium">Fetching content...</div>
                                </div>
                            ) : (
                                <textarea
                                    className="w-full h-full min-h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm whitespace-pre-wrap leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={fetchedContent}
                                    onChange={e => setFetchedContent(e.target.value)}
                                ></textarea>
                            )}
                        </div>
                    </div>
                ) : (
                    // Results List
                    <div className="h-full overflow-y-auto p-4 space-y-2">
                        {loading && (
                            <div className="flex items-center justify-center p-8">
                                <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                            </div>
                        )}
                        {results.length === 0 && !loading && (
                            <div className="text-center py-20 opacity-50">
                                <div className="text-4xl mb-4">🔍</div>
                                <div className="text-lg font-medium text-slate-400">Search for lyrics to get started</div>
                            </div>
                        )}
                        {results.map((r, i) => (
                            <div
                                key={i}
                                onClick={() => handleView(r.url)}
                                className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group"
                            >
                                <div className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{r.title}</div>
                                <div className="text-xs text-slate-400 mt-1 truncate">{r.url}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// Icons
const LibraryIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
const GlobeIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
const CalendarIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
const SettingsIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
const HeartIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
const RefreshIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
const DatabaseIcon = (props) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>

export default App
