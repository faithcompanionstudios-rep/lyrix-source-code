import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import QRCode from 'react-qr-code';
import Tooltip from './components/Tooltip';
import securityImg from '../assets/security.png';

// Helper to strip leading numbers (e.g. "1. Title" -> "Title")
const cleanText = (text) => text ? text.replace(/^\d+\.?\s*/, '') : '';

const CustomSelect = ({ value, onChange, options, className, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div className="relative w-full" ref={selectRef}>
            <div
                className={clsx("flex items-center justify-between cursor-pointer focus:outline-none transition-all group", className)}
                onClick={() => setIsOpen(!isOpen)}
                tabIndex={0}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <div className="ml-2 w-5 h-5 rounded-full bg-slate-100/50 group-hover:bg-slate-200/50 flex items-center justify-center transition-colors">
                    <svg className={clsx("w-3.5 h-3.5 text-slate-500 transition-transform duration-200", isOpen ? "rotate-180 text-indigo-500" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-y-auto max-h-56 p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {options.map((option, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                "px-3 py-2.5 my-0.5 text-sm cursor-pointer transition-all rounded-xl flex items-center justify-between",
                                value === option.value
                                    ? "bg-indigo-50/80 text-indigo-700 font-bold shadow-sm italic"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium italic"
                            )}
                            onClick={() => {
                                onChange({ target: { value: option.value } });
                                setIsOpen(false);
                            }}
                        >
                            <span className="truncate pr-4">{option.label}</span>
                            {value === option.value && (
                                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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

    // Auto-dismiss custom alerts after 0.5 seconds
    useEffect(() => {
        if (customAlert) {
            const timer = setTimeout(() => setCustomAlert(null), 500);
            return () => clearTimeout(timer);
        }
    }, [customAlert]);

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
    const [appVersion, setAppVersion] = useState('1.6.4');
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

    useEffect(() => {
        if (window.electron && window.electron.setTitlebarTheme) {
            window.electron.setTitlebarTheme(showCloseConfirm ? 'dark' : 'light');
        }
    }, [showCloseConfirm]);


    // Library Categories
    const DEFAULT_CATEGORIES = ['English Choruses', 'English Hymns', 'Telugu Songs', 'Hindi Songs', 'Marathi Songs', 'Special Songs', 'Children Songs'];
    const [allCategories, setAllCategories] = useState(DEFAULT_CATEGORIES);
    const [visibleCategories, setVisibleCategories] = useState(() => {
        const saved = localStorage.getItem('setting_visibleCategories');
        return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
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
    const [adminTab, setAdminTab] = useState('categories'); // categories, uncategorized, bulk_delete, church_profile, projector, app_behavior, system

    // Admin Categories Manager State
    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);
    const [editCategoryInput, setEditCategoryInput] = useState('');

    // Admin Bulk Delete State
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkSongsList, setBulkSongsList] = useState([]);
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);

    // Admin Uncategorized State
    const [uncategorizedSongs, setUncategorizedSongs] = useState([]);

    // Rollback State
    const [availableRollbacks, setAvailableRollbacks] = useState([]);
    const [isLoadingRollbacks, setIsLoadingRollbacks] = useState(false);

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
        localStorage.setItem('setting_previewFont', previewFont);
        localStorage.setItem('setting_maxRemoteDevices', maxRemoteDevices);
        localStorage.setItem('setting_churchName', churchName);
        localStorage.setItem('setting_churchPlace', churchPlace);
        localStorage.setItem('setting_visibleCategories', JSON.stringify(visibleCategories));
        localStorage.setItem('setting_showAppControls', showAppControls);
        localStorage.setItem('setting_showDatabaseManagement', showDatabaseManagement);

        // Removed aggressive pruning: we now trust visibleCategories from localStorage or remote.
    }, [favourites, fontSize, isBold, color, backgroundColor, backgroundImage, textAlign, fontFamily, defaultCategory, autoFormat, previewMode, previewFont, maxRemoteDevices, churchName, churchPlace, visibleCategories, showAppControls, showDatabaseManagement, allCategories]);

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

            // Fetch previous releases if in settings
            if (activeTab === 'settings' && availableRollbacks.length === 0 && !isLoadingRollbacks) {
                setIsLoadingRollbacks(true);
                window.electron.invoke('get-previous-releases').then(releases => {
                    setAvailableRollbacks(releases);
                    setIsLoadingRollbacks(false);
                }).catch(() => setIsLoadingRollbacks(false));
            }

            // DB Status Listener
            window.electron.invoke('get-db-status').then(status => {
                if (status) setDbStatus(status);
            });

            // Fetch dynamic categories
            window.electron.invoke('get-categories').then(cats => {
                if (cats && Array.isArray(cats)) {
                    setAllCategories(cats);
                    // Prune deleted, and add any newly created categories to visibleCategories
                    setVisibleCategories(prev => {
                        // Only remove categories that are DEFINITELY gone from allCategories
                        // But don't prune if allCategories is just empty (startup/offline)
                        if (cats.length === 0) return prev;
                        return prev.filter(c => cats.includes(c));
                    });
                }
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

            const unsubSongsUpdate = window.electron.onSongsUpdate((event, songs) => {
                // Ensure the library refreshes when local songs are loaded or remote changes arrive
                handleSearch(searchQueryRef.current, activeFilterRef.current);
            });

            const unsubCategoriesUpdate = window.electron.onCategoriesUpdate((event, cats) => {
                if (cats && Array.isArray(cats)) {
                    setAllCategories(cats);
                    setVisibleCategories(prev => {
                        // Only remove categories that are DEFINITELY gone from allCategories
                        // But don't prune if allCategories is just empty (startup/offline)
                        if (cats.length === 0) return prev;
                        return prev.filter(c => cats.includes(c));
                    });
                }
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
                if (unsubCategoriesUpdate) unsubCategoriesUpdate();
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

            // Add directly with an auto-dismissing notification
            const newSchedule = await window.electron.invoke('add-to-schedule', songId);
            setSchedule(newSchedule);
            setCustomAlert('Added to schedule');
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
                // If it's a numeric search, we search across all categories but then filter to visible ones
                const isNumeric = q && !isNaN(q.trim()) && q.trim().length > 0;
                const searchFilter = isNumeric ? 'All' : filter;

                let results = await window.electron.invoke('search-songs', q, searchFilter, filter);

                if (isNumeric) {
                    // Filter numeric results to only show visible categories
                    results = results.filter(s => visibleCategories.includes(s.category));
                }

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

                    <div className="flex-1 py-6 space-y-1">
                        <div className="flex w-full gap-2 px-3 mb-4">
                            <Tooltip text="Create a new song entry" position="right" className="flex-[3]">
                                <button
                                    onClick={() => { setAddSongInitialData(null); setShowAddModal(true); }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02]"
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    New Song
                                </button>
                            </Tooltip>
                            <Tooltip text="Import slides from PowerPoint (.pptx)" position="right" className="flex-1">
                                <button
                                    onClick={async () => {
                                        const res = await window.electron.invoke('import-pptx');
                                        if (res && res.success) {
                                            setAddSongInitialData({ title: res.filename, preview: res.slides.join('\n\n\n') });
                                            setShowAddModal(true);
                                        } else if (res && res.error) {
                                            setCustomAlert("Error importing PPTX: " + res.error);
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-all font-bold shadow-sm flex items-center justify-center group"
                                >
                                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-orange-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 3h-15C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zm-9 14.5c0 .28-.22.5-.5.5h-5c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5h5c.28 0 .5.22.5.5v11zm8 0c0 .28-.22.5-.5.5h-6c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5h6c.28 0 .5.22.5.5v11zM7.5 10c-.83 0-1.5.67-1.5 1.5S6.67 13 7.5 13 9 12.33 9 11.5 8.33 10 7.5 10z" /></svg>
                                </button>
                            </Tooltip>
                        </div>

                        <div className="px-3 space-y-1">
                            <NavItem icon={<LibraryIcon />} label="Song Library" active={activeTab === 'library'} onClick={() => { setActiveTab('library'); handleSearch('', 'All'); }} />
                            <NavItem icon={<HeartIcon />} label="Favourites" active={activeTab === 'favourites'} onClick={() => { setActiveTab('favourites'); handleSearch('', 'All'); }} />
                            <NavItem icon={<GlobeIcon />} label="Search Web" active={activeTab === 'web'} onClick={() => setActiveTab('web')} />
                            <NavItem icon={<CalendarIcon />} label="Sunday Service" active={activeTab === 'service'} onClick={() => { setActiveTab('service'); handleSearch('', 'All'); }} />
                            <div className="pt-6">
                                <NavItem icon={<SettingsIcon />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                            </div>
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
                    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                        {/* Settings Header - Always show logout/login */}
                        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0 shadow-sm z-10">
                            <div>
                                <h2 className="font-display text-3xl font-bold text-slate-800">{isAdminLoggedIn ? 'Admin Panel' : 'Settings'}</h2>
                                {isAdminLoggedIn ? (
                                    <p className="text-xs text-indigo-500 italic mt-1 font-bold">Logged in as Administrator</p>
                                ) : (
                                    <p className="text-xs text-slate-400 italic mt-1 font-medium italic">Configure LyriX Desktop to your needs</p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                {!isAdminLoggedIn ? (
                                    <button
                                        onClick={() => setShowAdminLoginModal(true)}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        Admin Login
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsAdminLoggedIn(false)}
                                        className="px-6 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        Exit Admin
                                    </button>
                                )}
                            </div>
                        </div>


                        <div className="flex-1 overflow-y-auto p-8">
                            {isAdminLoggedIn ? (
                                /* ADMIN VIEW CONTENTS */
                                <div className="space-y-6 animate-fade-in w-full max-w-6xl mx-auto">
                                    <div className="flex gap-2 flex-wrap mb-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                                        {[
                                            { id: 'categories', label: 'Categories' },
                                            { id: 'uncategorized', label: 'Uncategorized' },
                                            { id: 'bulk_delete', label: 'Bulk Delete' },
                                            { id: 'security', label: 'Security' },
                                            { id: 'system', label: 'System Rollback' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setAdminTab(tab.id)}
                                                className={clsx(
                                                    "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                                                    adminTab === tab.id
                                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                                                        : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="pt-2">
                                        {adminTab === 'categories' && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 font-display">Category Management</h3>
                                                <div className="flex gap-2 mb-4">
                                                    <input
                                                        type="text"
                                                        value={newCategoryInput}
                                                        onChange={(e) => setNewCategoryInput(e.target.value)}
                                                        onKeyDown={async (e) => {
                                                            if (e.key === 'Enter' && newCategoryInput.trim()) {
                                                                await window.electron.invoke('add-category', newCategoryInput.trim());
                                                                setNewCategoryInput('');
                                                                setCustomAlert('Category added!');
                                                            }
                                                        }}
                                                        placeholder="New Category Name..."
                                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm italic font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (newCategoryInput.trim()) {
                                                                try {
                                                                    await window.electron.invoke('add-category', newCategoryInput.trim());
                                                                    setNewCategoryInput('');
                                                                    setCustomAlert('Category added!');
                                                                } catch (err) {
                                                                    setCustomAlert('Error: ' + (err?.message || 'Could not add category'));
                                                                }
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold transition-all active:scale-95"
                                                    >Add</button>
                                                </div>
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    {allCategories.map((cat) => (
                                                        <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                            {editingCategory === cat ? (
                                                                <div className="flex-1 flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={editCategoryInput}
                                                                        autoFocus
                                                                        onChange={(e) => setEditCategoryInput(e.target.value)}
                                                                        className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-sm italic font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                                        onKeyDown={async (e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const newName = editCategoryInput.trim();
                                                                                if (newName && newName !== cat) {
                                                                                    try {
                                                                                        await window.electron.invoke('update-category', cat, newName);
                                                                                        setCustomAlert(`Renamed to "${newName}"`);
                                                                                    } catch (err) {
                                                                                        setCustomAlert('Error: ' + (err?.message || 'Could not rename'));
                                                                                    }
                                                                                }
                                                                                setEditingCategory(null);
                                                                                setEditCategoryInput('');
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingCategory(null);
                                                                                setEditCategoryInput('');
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={async () => {
                                                                            const newName = editCategoryInput.trim();
                                                                            if (newName && newName !== cat) {
                                                                                try {
                                                                                    await window.electron.invoke('update-category', cat, newName);
                                                                                    setCustomAlert(`Renamed to "${newName}"`);
                                                                                } catch (err) {
                                                                                    setCustomAlert('Error: ' + (err?.message || 'Could not rename'));
                                                                                }
                                                                            }
                                                                            setEditingCategory(null);
                                                                            setEditCategoryInput('');
                                                                        }}
                                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEditingCategory(null); setEditCategoryInput(''); }}
                                                                        className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                                                                    >Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="font-bold text-slate-700 text-sm italic">{cat}</span>
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => { setEditingCategory(cat); setEditCategoryInput(cat); }}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                                        ><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await window.electron.invoke('delete-category', cat);
                                                                                    setCustomAlert(`Deleted "${cat}"`);
                                                                                } catch (err) {
                                                                                    setCustomAlert('Error: ' + (err?.message || 'Could not delete'));
                                                                                }
                                                                            }}
                                                                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                                                        ><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {adminTab === 'uncategorized' && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 font-display">Uncategorized Songs</h3>
                                                {uncategorizedSongs.length === 0 ? <p className="text-slate-400 italic">No uncategorized songs.</p> : (
                                                    <div className="space-y-3">
                                                        {uncategorizedSongs.map(song => (
                                                            <div key={song.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                                                                <div className="font-bold text-sm text-slate-800 italic">{song.title}</div>
                                                                <select className="px-3 py-1 bg-white border border-slate-300 rounded text-sm italic font-medium cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" onChange={async (e) => { if (e.target.value) await window.electron.invoke('recategorize-song', song.id, e.target.value); }}>
                                                                    <option value="">Assign...</option>
                                                                    {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {adminTab === 'bulk_delete' && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 font-display">Bulk Delete Songs</h3>
                                                <div className="mb-4 flex gap-4 items-end">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">Select Category</label>
                                                        <select
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold italic focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                                                            value={bulkCategory}
                                                            onChange={(e) => {
                                                                setBulkCategory(e.target.value);
                                                                if (e.target.value) {
                                                                    window.electron.invoke('search-songs', '', e.target.value).then(setBulkSongsList);
                                                                } else {
                                                                    setBulkSongsList([]);
                                                                }
                                                                setBulkSelectedIds([]);
                                                            }}
                                                        >
                                                            <option value="">Choose category...</option>
                                                            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                {bulkSongsList.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                                            <div className="text-xs font-bold text-slate-500 italic">{bulkSelectedIds.length} of {bulkSongsList.length} selected</div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setBulkSelectedIds(bulkSongsList.map(s => s.id))} className="text-[10px] font-bold text-indigo-600 hover:underline px-2">Select All</button>
                                                                <button onClick={() => setBulkSelectedIds([])} className="text-[10px] font-bold text-slate-400 hover:underline px-2">Clear</button>
                                                            </div>
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                            {bulkSongsList.map(song => (
                                                                <label key={song.id} className="flex items-center gap-3 p-2 hover:bg-indigo-50/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-indigo-100">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={bulkSelectedIds.includes(song.id)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) setBulkSelectedIds([...bulkSelectedIds, song.id]);
                                                                            else setBulkSelectedIds(bulkSelectedIds.filter(id => id !== song.id));
                                                                        }}
                                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-bold text-slate-700 truncate">{song.title}</div>
                                                                        <div className="text-[10px] text-slate-400 italic">ID: {song.id}</div>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                                                            <button
                                                                disabled={bulkSelectedIds.length === 0}
                                                                onClick={() => {
                                                                    setConfirmPrompt({
                                                                        title: 'Bulk Delete',
                                                                        message: `Are you sure you want to delete ${bulkSelectedIds.length} selected songs? This cannot be undone!`,
                                                                        confirmText: `Delete ${bulkSelectedIds.length} Songs`,
                                                                        confirmStyle: 'red',
                                                                        onConfirm: async () => {
                                                                            await window.electron.invoke('bulk-delete-songs', bulkSelectedIds);
                                                                            setBulkSongsList(prev => prev.filter(s => !bulkSelectedIds.includes(s.id)));
                                                                            setBulkSelectedIds([]);
                                                                            setCustomAlert(`Successfully deleted ${bulkSelectedIds.length} songs.`);
                                                                            handleSearch('', activeFilter); // Refresh library
                                                                        }
                                                                    });
                                                                }}
                                                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                                            >
                                                                Delete Selected
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {adminTab === 'system' && (
                                            <div className="animate-fade-in-up">
                                                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-8 relative overflow-hidden group">
                                                    <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                                        <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                                                    </div>
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                </div>
                                                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">System Version & Rollback</h3>
                                                            </div>
                                                            <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic">If you encounter bugs in a new release, you can instantly rollback to a previous version. Your song data will remain safe.</p>
                                                        </div>
                                                        <div className="px-4 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                                            Active: v{appVersion}
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                                                        {isLoadingRollbacks ? (
                                                            <div className="flex items-center justify-center py-6 gap-3">
                                                                <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Fetching previous versions...</span>
                                                            </div>
                                                        ) : availableRollbacks.length > 0 ? (
                                                            <div className="space-y-4">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Available Fallback Versions</label>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {availableRollbacks.slice(0, 3).map(rollback => (
                                                                        <div key={rollback.tag} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group/v transition-all hover:border-amber-200">
                                                                            <div>
                                                                                <div className="text-sm font-bold text-slate-700 tracking-tight">{rollback.tag} <span className="text-[10px] text-slate-400 font-normal italic ml-2">{new Date(rollback.published_at).toLocaleDateString()}</span></div>
                                                                                <div className="text-[10px] text-slate-400 italic mt-0.5">{rollback.name || 'Stable Release'}</div>
                                                                            </div>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const confirmed = window.confirm(`Are you sure you want to rollback to ${rollback.tag}? This will download ${rollback.assets[0].name} and restart the application.`);
                                                                                    if (confirmed) {
                                                                                        setCustomAlert(`Starting Rollback to ${rollback.tag}...`);
                                                                                        const res = await window.electron.invoke('trigger-rollback', rollback.assets[0].browser_download_url);
                                                                                        if (res && !res.success) setCustomAlert("Rollback failed: " + res.error);
                                                                                    }
                                                                                }}
                                                                                className="px-4 py-2 bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-amber-100/50 active:scale-95 shadow-sm"
                                                                            >
                                                                                Downgrade to {rollback.tag}
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-4">
                                                                <p className="text-xs text-slate-400 italic font-medium">No previous versions available for rollback.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {adminTab === 'security' && (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                                                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-8">
                                                    <h3 className="text-xl font-bold text-slate-800 mb-8 font-display flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        </div>
                                                        Admin Credentials
                                                    </h3>
                                                    <div className="space-y-6">
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Admin Username</label>
                                                            <input
                                                                type="text"
                                                                value={adminUsernameInput}
                                                                onChange={(e) => setAdminUsernameInput(e.target.value)}
                                                                placeholder="New username..."
                                                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm italic font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">New Password</label>
                                                                <input
                                                                    type="password"
                                                                    value={adminPasswordInput}
                                                                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                                                                    placeholder="••••••••"
                                                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm italic font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Confirm Password</label>
                                                                <input
                                                                    type="password"
                                                                    id="confirmPassword"
                                                                    placeholder="••••••••"
                                                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm italic font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="pt-4">
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmInput = document.getElementById('confirmPassword');
                                                                    if (!adminUsernameInput || !adminPasswordInput) {
                                                                        setCustomAlert('Username and Password cannot be empty.');
                                                                        return;
                                                                    }
                                                                    if (adminPasswordInput !== confirmInput.value) {
                                                                        setCustomAlert('Passwords do not match.');
                                                                        return;
                                                                    }
                                                                    const success = await window.electron.invoke('set-admin-credentials', adminUsernameInput, adminPasswordInput);
                                                                    if (success) {
                                                                        setCustomAlert('Admin credentials updated successfully! Please login again with new details.');
                                                                        setIsAdminLoggedIn(false);
                                                                        setAdminPasswordInput('');
                                                                        confirmInput.value = '';
                                                                    }
                                                                }}
                                                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] uppercase tracking-widest"
                                                            >
                                                                Update Security Details
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-900/20 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden h-full">
                                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                                        <svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" /></svg>
                                                    </div>

                                                    {/* Security image removed at user request */}

                                                    <h4 className="text-xl font-bold text-white mb-2">Protect Your Workspace</h4>
                                                    <p className="text-indigo-100 text-sm leading-relaxed max-w-xs italic mb-8">
                                                        Keep your lyrics management safe. We recommend using a unique password and updating it regularly.
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-4 w-full">
                                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                                            <div className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Status</div>
                                                            <div className="text-white text-sm font-bold italic">Encrypted</div>
                                                        </div>
                                                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                                            <div className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Access</div>
                                                            <div className="text-white text-sm font-bold italic">Restricted</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* PUBLIC VIEW */
                                <div className="space-y-8 w-full max-w-6xl mx-auto pb-12">
                                    {/* 1. Church Profile Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-6 relative group overflow-hidden">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Church Profile</h3>
                                            </div>
                                            <button
                                                onClick={() => setIsEditingProfile(!isEditingProfile)}
                                                className={clsx(
                                                    "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm border",
                                                    isEditingProfile
                                                        ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {isEditingProfile ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Save Profile
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        Edit Profile
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Church Name</label>
                                                <input
                                                    type="text"
                                                    disabled={!isEditingProfile}
                                                    value={churchName}
                                                    onChange={(e) => setChurchName(e.target.value)}
                                                    placeholder="Enter church name..."
                                                    className={clsx(
                                                        "w-full px-5 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-sm italic border",
                                                        isEditingProfile
                                                            ? "bg-white border-emerald-500 ring-4 ring-emerald-500/10 text-slate-800"
                                                            : "bg-slate-50/50 border-transparent text-slate-500 cursor-not-allowed"
                                                    )}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Location</label>
                                                <input
                                                    type="text"
                                                    disabled={!isEditingProfile}
                                                    value={churchPlace}
                                                    onChange={(e) => setChurchPlace(e.target.value)}
                                                    placeholder="City, Country..."
                                                    className={clsx(
                                                        "w-full px-5 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-sm italic border",
                                                        isEditingProfile
                                                            ? "bg-white border-emerald-500 ring-4 ring-emerald-500/10 text-slate-800"
                                                            : "bg-slate-50/50 border-transparent text-slate-500 cursor-not-allowed"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Database & Cloud */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                                        <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                            <DatabaseIcon className="w-48 h-48" />
                                        </div>
                                        <div className="flex items-start justify-between mb-8">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                        <DatabaseIcon className="w-5 h-5" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Database & Cloud</h3>
                                                </div>
                                                <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic">Manage your song database and cloud synchronization status.</p>
                                            </div>
                                            <div className={clsx(
                                                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border shadow-sm",
                                                dbStatus.status === 'connected' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                            )}>
                                                <div className={clsx("w-2 h-2 rounded-full", dbStatus.status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-red-500")}></div>
                                                {dbStatus.status === 'connected' ? "Connected" : "Disconnected"}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 shadow-inner group/db">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cloud Sync</span>
                                                        <span className="text-sm font-bold text-slate-700">Firestore Database</span>
                                                    </div>
                                                    {isSyncing ? (
                                                        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <button
                                                            onClick={async () => {
                                                                setIsSyncing(true);
                                                                try { await window.electron.invoke('sync-songs'); setCustomAlert("Database synced successfully!"); }
                                                                catch (e) { setCustomAlert("Sync failed: " + e.message); }
                                                                finally { setIsSyncing(false); }
                                                            }}
                                                            className="px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest group-hover/db:shadow-md"
                                                        >
                                                            Sync Now
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 italic">Push local changes and pull updates from the cloud.</p>
                                            </div>

                                            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 shadow-inner group/rec">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Check</span>
                                                        <span className="text-sm font-bold text-slate-700">Connection Health</span>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const status = await window.electron.invoke('get-db-status');
                                                            setDbStatus(status);
                                                            setCustomAlert(status.status === 'connected' ? "Connection verified!" : "Unable to reach database.");
                                                        }}
                                                        className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest group-hover/rec:shadow-md"
                                                    >
                                                        Reconnect
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400 italic">Verify your connection to the Firebase services.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Mobile & Remote Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-8 relative group">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Mobile Remote Control</h3>
                                                </div>
                                                <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic">Control LyriX Stage seamlessly from your smartphone! Navigate to the address below in your web browser.</p>
                                            </div>
                                            <div className={clsx(
                                                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border shadow-sm transition-all duration-500",
                                                (status === 'Running' && connections > 0)
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100"
                                                    : "bg-slate-50 text-slate-400 border-slate-200"
                                            )}>
                                                <div className={clsx(
                                                    "w-2 h-2 rounded-full",
                                                    (status === 'Running' && connections > 0) ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                                                )}></div>
                                                {status === 'Running' ? (connections > 0 ? "Live" : "Standby") : status}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50 shadow-inner">
                                            <div className="flex items-center gap-6">
                                                <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-100">
                                                    <QRCode value={`https://github.com/justforaitoolz-ops/LyriX-Church-System/releases/latest/download/LyriX-Mobile.apk`} size={110} level="M" fgColor="#1e293b" />
                                                </div>
                                                <div className="space-y-4 flex-1">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Server Address</label>
                                                        <div className="text-base font-bold text-slate-800 tracking-tight font-mono break-all leading-tight italic opacity-90">http://{ip}:3001</div>
                                                        <div className="text-[10px] text-slate-400 italic">Scan QR code with your phone's camera</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={async () => { const newStatus = await window.electron.invoke('refresh-ip'); setIp(newStatus.ip); setStatus(newStatus.status); }} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 transition-all shadow-sm active:scale-95 flex items-center gap-1.5"><RefreshIcon className="w-3.5 h-3.5" /> Refresh</button>
                                                        <div className="text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                                                            <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", connections > 0 ? "bg-emerald-500" : "bg-blue-500")}></div>
                                                            <strong>{connections} / {maxRemoteDevices}</strong> <span className="opacity-50 italic uppercase text-[9px]">Devices</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t lg:border-t-0 lg:border-l border-slate-200/50 pt-6 lg:pt-0 lg:pl-10 h-full flex flex-col justify-center">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shadow-inner">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 0l-2-2m2 2l2-2" /></svg>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 tracking-tight">Mobile App Download</h4>
                                                </div>
                                                <p className="text-[10px] text-slate-400 italic leading-relaxed mb-4">Download the APK directly to manage your song library from anywhere!</p>
                                                <button onClick={() => window.electron.invoke('open-url', 'https://github.com/justforaitoolz-ops/LyriX-Church-System/releases/latest/download/LyriX-Mobile.apk')} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 uppercase tracking-widest">Download APK</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Visible Categories Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-6 relative group">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Visible Library Categories</h3>
                                            </div>
                                            <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic">Select which categories appear as tabs in the Song Library.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3 pt-2">
                                            {allCategories.map(cat => {
                                                const isVisible = visibleCategories.includes(cat);
                                                return (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setVisibleCategories(prev => isVisible ? prev.filter(c => c !== cat) : [...prev, cat])}
                                                        className={clsx(
                                                            "px-5 py-2.5 rounded-2xl text-[11px] transition-all border shadow-sm active:scale-95 flex items-center gap-2",
                                                            isVisible
                                                                ? "bg-indigo-600 text-white border-indigo-700 shadow-indigo-200 italic"
                                                                : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600 font-medium"
                                                        )}
                                                    >
                                                        {cat}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>


                                    {/* 5. Projector Styling Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative group">
                                        <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                            <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2h-1v-2h1v-2h-1V8h1V6h-1V4H4v2h1v2H4v2h1v2H4v2h1v2H4v2h1v2H4v2h17zm-15-2V6h12v8H6z" /></svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4h10l2 2v10l-2 2H7l-2-2V6l2-2zM7 9h10M9 13h6" /></svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Projector Styling</h3>
                                            </div>
                                            <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic">Customize how lyrics appear on the big screen! These changes update instantly in the live projector window.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                                            {/* Font Size Sub-card */}
                                            <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 flex flex-col justify-between shadow-inner h-full">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Font Size</label>

                                                {/* Preview Area */}
                                                <div className="flex-1 flex items-center justify-center bg-white/40 rounded-2xl mb-3 border border-slate-100 overflow-hidden min-h-[60px]">
                                                    <div className="italic font-extrabold text-slate-400 opacity-50 select-none tracking-tight" style={{ fontSize: `${fontSize * 4}px`, lineHeight: 1 }}>
                                                        Aa
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <input type="range" min="3" max="15" step="0.5" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                                    <span className="text-sm font-bold text-indigo-600 w-8 text-right italic font-mono">{fontSize}</span>
                                                </div>
                                            </div>

                                            {/* Color Theme Sub-card */}
                                            <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 flex flex-col justify-between shadow-inner h-full">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Color Theme</label>

                                                {/* Preview Area */}
                                                <div className="flex-1 flex items-center justify-center rounded-2xl mb-3 border border-slate-200 shadow-inner overflow-hidden min-h-[60px]" style={{ backgroundColor: backgroundColor || '#000000' }}>
                                                    <div className="font-extrabold tracking-tighter italic" style={{ color: color || '#ffffff', fontSize: '18px' }}>
                                                        Preview
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Text</span>
                                                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                                                    </div>
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">BACKGROUND</span>
                                                        <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-full h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Text Aspects Sub-card */}
                                            <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 flex flex-col justify-between shadow-inner h-full">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-3 block">Text Aspects & Fonts</label>
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm h-[52px] items-center">
                                                        <button onClick={() => setIsBold(!isBold)} className={clsx("flex-1 h-full rounded-xl text-[10px] font-bold transition-all", isBold ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600 uppercase")}>BOLD</button>
                                                        <div className="w-[1px] h-6 bg-slate-200"></div>
                                                        <CustomSelect
                                                            value={textAlign}
                                                            onChange={(e) => setTextAlign(e.target.value)}
                                                            options={[
                                                                { value: "left", label: "Left" },
                                                                { value: "center", label: "Center" },
                                                                { value: "right", label: "Right" }
                                                            ]}
                                                            className="flex-1 h-full bg-transparent text-[10px] font-bold px-3 focus:ring-0 cursor-pointer text-slate-600 italic focus:border-indigo-500 rounded-xl"
                                                        />
                                                    </div>
                                                    <CustomSelect
                                                        value={fontFamily}
                                                        onChange={(e) => setFontFamily(e.target.value)}
                                                        options={[
                                                            { value: "sans-serif", label: "Projector: Modern (Sans)" },
                                                            { value: "serif", label: "Projector: Classic (Serif)" },
                                                            { value: "'Times New Roman', Times, serif", label: "Projector: Times New Roman" },
                                                            { value: "'Arial', sans-serif", label: "Projector: Arial" }
                                                        ]}
                                                        placeholder="Projector Font"
                                                        className="w-full px-4 py-2 bg-white border border-slate-100 rounded-2xl text-[10px] font-bold text-slate-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm leading-none italic"
                                                    />
                                                    <CustomSelect
                                                        value={previewFont}
                                                        onChange={(e) => setPreviewFont(e.target.value)}
                                                        options={[
                                                            { value: "lyrics", label: "Preview: Classic (Lora Serif)" },
                                                            { value: "sans", label: "Preview: Modern (Inter Sans)" }
                                                        ]}
                                                        placeholder="Preview Font"
                                                        className="w-full px-4 py-2 bg-white border border-slate-100 rounded-2xl text-[10px] font-bold text-slate-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm leading-none italic"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. App Behavior Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-6 relative group">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Application Behavior</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Default Category</label>
                                                    <CustomSelect
                                                        value={defaultCategory}
                                                        onChange={(e) => setDefaultCategory(e.target.value)}
                                                        options={allCategories.map(cat => ({ value: cat, label: cat }))}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 focus:bg-white focus:border-indigo-500 transition-all shadow-inner italic"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Lyrics Preview Layout</label>
                                                    <CustomSelect
                                                        value={previewMode}
                                                        onChange={(e) => setPreviewMode(e.target.value)}
                                                        options={[
                                                            { value: "single", label: "Single Slide (Large Text)" },
                                                            { value: "grid", label: "Grid Overview (Compact)" }
                                                        ]}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 focus:bg-white focus:border-indigo-500 transition-all shadow-inner italic"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3 pt-6">
                                                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-white hover:border-indigo-100 transition-all shadow-inner group/tog">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-sm group-hover/tog:text-indigo-600 transition-colors">Auto-Format Lyrics</span>
                                                        <span className="text-[10px] text-slate-400 italic">Automatically try to format pasted lyrics into stanzas.</span>
                                                    </div>
                                                    <div className="relative w-10 h-5 shrink-0">
                                                        <input type="checkbox" checked={autoFormat} onChange={(e) => setAutoFormat(e.target.checked)} className="peer sr-only" id="tog-auto" />
                                                        <label htmlFor="tog-auto" className="block w-10 h-5 bg-slate-200 rounded-full cursor-pointer transition-colors peer-checked:bg-indigo-600"></label>
                                                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5 shadow-sm"></div>
                                                    </div>
                                                </label>
                                                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-white hover:border-indigo-100 transition-all shadow-inner group/tog">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-sm group-hover/tog:text-indigo-600 transition-colors">Show Application Controls</span>
                                                        <span className="text-[10px] text-slate-400 italic">Show or hide the system refresh, zoom, and developer tools.</span>
                                                    </div>
                                                    <div className="relative w-10 h-5 shrink-0">
                                                        <input type="checkbox" checked={showAppControls} onChange={(e) => setShowAppControls(e.target.checked)} className="peer sr-only" id="tog-controls" />
                                                        <label htmlFor="tog-controls" className="block w-10 h-5 bg-slate-200 rounded-full cursor-pointer transition-colors peer-checked:bg-indigo-600"></label>
                                                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5 shadow-sm"></div>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6.5 Application Controls Card */}
                                    {showAppControls && (
                                        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative group animate-fade-in mb-8">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Application Controls</h3>
                                            </div>
                                            <p className="text-slate-500 text-sm max-w-xl leading-relaxed italic mb-6">Advanced controls for managing the application window and zoom levels.</p>

                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'reload')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Reload</span>
                                                </button>
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'fullscreen')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Screen</span>
                                                </button>
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'zoom-in')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Zoom+</span>
                                                </button>
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'zoom-out')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Zoom-</span>
                                                </button>
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'zoom-reset')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Reset</span>
                                                </button>
                                                <button
                                                    onClick={() => window.electron.invoke('app-control', 'devtools')}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-[1.5rem] transition-all group/btn"
                                                >
                                                    <svg className="w-5 h-5 text-slate-400 group-hover/btn:text-indigo-600 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/btn:text-slate-800">Tools</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {/* 7. Version & Updates Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative group mb-8">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">LyriX Desktop v{appVersion}</h3>
                                                    <div className="flex items-center gap-2 h-4">
                                                        {updateStatus === 'checking' && <span className="text-[11px] font-semibold text-slate-400 animate-pulse italic">Checking for updates...</span>}
                                                        {updateStatus === 'available' && <span className="text-[11px] font-semibold text-indigo-600 italic">Update Available! Version {updateInfo?.version} is ready.</span>}
                                                        {(updateStatus === 'not-available' || !updateStatus) && <span className="text-[11px] font-semibold text-slate-400 italic">Your app is up to date.</span>}
                                                        {updateStatus === 'error' && <span className="text-[11px] font-semibold text-red-500 italic">Error: {updateError || 'Could not check for updates.'}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setUpdateStatus('checking');
                                                    try {
                                                        const res = await window.electron.invoke('check-for-updates');
                                                        if (!res || !res.updateInfo) setUpdateStatus('not-available');
                                                    } catch (e) {
                                                        setUpdateStatus('error');
                                                        setUpdateError(e.message || 'Check failed');
                                                    }
                                                }}
                                                className={clsx(
                                                    "px-8 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 border",
                                                    updateStatus === 'checking' ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                                )}
                                            >
                                                Check for Updates
                                            </button>
                                        </div>
                                        {updateStatus === 'available' && (
                                            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex justify-between items-center animate-fade-in shadow-inner">
                                                <div className="text-xs font-semibold text-indigo-800 italic">Version {updateInfo?.version} is ready to download!</div>
                                                <button onClick={() => window.electron.invoke('start-download')} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-md hover:bg-indigo-700 transition-all uppercase tracking-wider">Download Now</button>
                                            </div>
                                        )}
                                        {updateStatus === 'downloading' && (
                                            <div className="mt-6 space-y-2.5">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                                    <span>Downloading Content...</span>
                                                    <span>{Math.round(updateProgress)}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                        {updateStatus === 'downloaded' && (
                                            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center animate-fade-in shadow-inner">
                                                <div className="text-xs font-semibold text-emerald-800 italic">Update successfully downloaded. Restart to apply.</div>
                                                <button onClick={() => window.electron.invoke('install-update')} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold shadow-md hover:bg-emerald-700 transition-all uppercase tracking-wider">Restart & Install</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 8. Database Management Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative group mb-8">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center shadow-inner">
                                                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Database Maintenance</h3>
                                                    <p className="text-[11px] font-semibold text-slate-400 italic">Safely synchronize your library with the cloud using Last-Write-Wins.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setCustomAlert('Starting Deep Sync... Please wait.');
                                                    try {
                                                        const res = await window.electron.invoke('sync-songs');
                                                        setCustomAlert(`Sync Complete! Verified ${res.count} items.`);
                                                        handleSearch('', activeFilter); // Refresh UI
                                                    } catch (e) {
                                                        setCustomAlert('Sync failed. Please check your internet connection.');
                                                    }
                                                }}
                                                className="px-8 py-3 bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
                                            >
                                                <RefreshIcon className="w-3.5 h-3.5" />
                                                Deep Library Sync
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* List Column (Library, Favourites, or Schedule) */}
                        {activeTab === 'library' || activeTab === 'favourites' ? (
                            <div className="w-[320px] flex flex-col border-r border-slate-200 bg-white z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                                {/* Search Header */}
                                <div className="p-4 border-b border-slate-100 space-y-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all italic"
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
                                    }).map(song => (
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

                                                    <Tooltip text="Add to Sunday schedule" position="left">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddToSchedule(song.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                        </button>
                                                    </Tooltip>
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
                                setConfirmPrompt={setConfirmPrompt}
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
                    </div>
                )
                }
                {
                    showAddModal && (
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
                    )
                }

                {/* Generic Confirm Modal */}
                {
                    confirmPrompt && (
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
                    )
                }

                {/* Custom Alert Modal */}
                {
                    customAlert && (
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
                    )
                }

                {/* Overwrite Confirmation Modal (Promise-based) */}
                {
                    overwritePrompt && (
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
                    )
                }

                {/* Schedule Add Confirmation Modal has been replaced by a toast */}

                {/* Delete Confirmation Modal */}
                {
                    songToDelete && (
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
                    )
                }

                {/* Exit Confirmation Modal */}

                {/* Admin Login Modal */}
                {
                    showAdminLoginModal && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                            <div className="bg-white rounded-[2rem] shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-inner">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 italic">Admin Login</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                                        <input
                                            type="text"
                                            value={adminUsernameInput}
                                            onChange={(e) => setAdminUsernameInput(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition-all font-medium italic"
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
                                                    const valid = await window.electron.invoke('verify-admin', adminUsernameInput, adminPasswordInput);
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
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition-all font-medium italic"
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
                                            const valid = await window.electron.invoke('verify-admin', adminUsernameInput, adminPasswordInput);
                                            if (valid) {
                                                setIsAdminLoggedIn(true);
                                                setShowAdminLoginModal(false);
                                                setAdminPasswordInput('');
                                                setAdminLoginError('');
                                            } else {
                                                setAdminLoginError('Invalid username or password.');
                                            }
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                    >
                                        Login
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    showCloseConfirm && (
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
                    )
                }

                {/* First Launch Welcome Modal (Multi-step) */}
                {
                    welcomeStep > 0 && (
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
                    )
                }

                {/* Mobile App Download QR Modal */}
                {
                    showMobileDownloadQR && (
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
                    )
                }

                {/* Confirmation Prompt */}
                {
                    confirmPrompt && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
                            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col items-center text-center">
                                <div className={clsx(
                                    "w-20 h-20 rounded-3xl flex items-center justify-center shadow-inner mb-6",
                                    confirmPrompt.confirmStyle === 'red' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                                )}>
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">{confirmPrompt.title}</h3>
                                <p className="text-slate-500 leading-relaxed mb-8 italic">{confirmPrompt.message}</p>

                                <div className="flex flex-col w-full gap-3">
                                    <button
                                        onClick={() => setConfirmPrompt(null)}
                                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await confirmPrompt.onConfirm();
                                            setConfirmPrompt(null);
                                        }}
                                        className={clsx(
                                            "w-full py-4 text-white rounded-2xl text-sm font-bold shadow-xl transition-all active:scale-95",
                                            confirmPrompt.confirmStyle === 'red' ? "bg-red-600 hover:bg-red-700 shadow-red-500/30" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                                        )}
                                    >
                                        {confirmPrompt.confirmText || 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Overwrite Prompt */}
                {
                    overwritePrompt && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[260] flex items-center justify-center p-4">
                            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full animate-fade-in border border-slate-100 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center shadow-inner mb-6">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Song Exists</h3>
                                <p className="text-slate-500 leading-relaxed mb-8 italic">A song titled "{overwritePrompt.title}" already exists. Do you want to update the existing song or cancel?</p>

                                <div className="flex flex-col w-full gap-3">
                                    <button
                                        onClick={() => { overwritePrompt.resolve(false); setOverwritePrompt(null); }}
                                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => { overwritePrompt.resolve(true); setOverwritePrompt(null); }}
                                        className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-amber-500/30 transition-all active:scale-95"
                                    >
                                        Update Existing
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
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
                    <Tooltip text={isFavourite ? "Remove from Favourites" : "Add to Favourites"}>
                        <button
                            onClick={onToggleFavourite}
                            disabled={!currentSong}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                isFavourite
                                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 disabled:opacity-50"
                            )}
                        >
                            <HeartIcon className={clsx("w-3 h-3", isFavourite ? "fill-current" : "")} />
                            {isFavourite ? 'Favourited' : 'Favourite'}
                        </button>
                    </Tooltip>
                    <Tooltip text="Edit Lyrics">
                        <button
                            onClick={onEdit}
                            disabled={!currentSong}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 disabled:opacity-50"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit
                        </button>
                    </Tooltip>
                    <Tooltip text="Delete Song">
                        <button
                            onClick={onDelete}
                            disabled={!currentSong}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                        </button>
                    </Tooltip>
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

function SundayServiceList({ schedule, onRemove, onReorder, onSelect, onRefresh, currentSongId, isAdminLoggedIn, setConfirmPrompt }) {
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
                    <Tooltip text="Clear Schedule" position="bottom">
                        <button
                            onClick={() => {
                                setConfirmPrompt({
                                    title: 'Clear Schedule',
                                    message: 'Are you sure you want to clear the entire schedule? This will remove all songs from the Sunday Service list.',
                                    confirmText: 'Clear All',
                                    confirmStyle: 'red',
                                    onConfirm: async () => {
                                        if (window.electron) {
                                            await window.electron.invoke('clear-schedule');
                                            if (onRefresh) onRefresh(true);
                                        }
                                    }
                                });
                            }}
                            className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </Tooltip>
                    <Tooltip text="Refresh Schedule" position="bottom">
                        <button
                            onClick={() => onRefresh && onRefresh(true)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        >
                            <RefreshIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
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
    const [lyrics, setLyrics] = useState(initialData?.lyrics || initialData?.preview || '');
    const [loading, setLoading] = useState(false);

    const isEdit = initialData?.isEdit;

    useEffect(() => {
        // Auto-generate ID if not provided OR if category changes (even in edit mode)
        const categoryChanged = initialData?.category && initialData.category !== category;
        const isNewSong = !isEdit;

        if (isNewSong || categoryChanged) {
            async function fetchNextId() {
                if (window.electron) {
                    const nextId = await window.electron.invoke('get-next-id', category);
                    setId(nextId);
                }
            }
            fetchNextId();
        }
    }, [category]);

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
                    (!initialData || s.id !== initialData.id) &&
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
                        // Check if category changed
                        if (initialData && category !== initialData.category) {
                            // First move the song (this deletes old, creates new ID, and shifts others)
                            const recatResult = await window.electron.invoke('recategorize-song', initialData.id, category);
                            // Now update the other fields (title, lyrics) using the NEW ID
                            songData.id = recatResult.id;
                            await window.electron.invoke('update-song', songData);
                        } else {
                            await window.electron.invoke('update-song', songData);
                        }
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
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all italic"
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
                                    className="w-full h-full min-h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm whitespace-pre-wrap leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 italic"
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
