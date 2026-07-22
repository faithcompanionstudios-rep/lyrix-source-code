const fs = require('fs');

const appPath = 'src/renderer/App.jsx';
let content = fs.readFileSync(appPath, 'utf8');

// 1. Insert parseSlideLabel
const parse_func = `
const parseSlideLabel = (text, index) => {
    let label = \`Slide \${index + 1}\`;
    let cleanText = text;

    if (typeof text !== 'string') return { label, cleanText: text };

    const lower = text.toLowerCase();
    if (lower.includes('[chorus]') || lower.includes('chorus:')) {
        label = 'Chorus';
        cleanText = text.replace(/\\[?chorus\\]?:?\\n?/i, '').trim();
    } else {
        const match = text.match(/^(\\d+)\\.\\s*/);
        if (match) {
            label = \`Verse \${match[1]}\`;
            cleanText = text.replace(/^(\\d+)\\.\\s*/, '').trim();
        }
    }
    return { label, cleanText };
}
`;
content = content.replace("let smartJumpTimeout = null;", parse_func + "\nlet smartJumpTimeout = null;");

// 2. Add showTeluguTranslations state
const state_def = `    const [showProjectorPreview, setShowProjectorPreview] = useState(() => localStorage.getItem('setting_showProjectorPreview') === 'true');
    const [showTeluguTranslations, setShowTeluguTranslations] = useState(() => localStorage.getItem('lyrixShowTelugu') === 'true');

    useEffect(() => {
        localStorage.setItem('lyrixShowTelugu', showTeluguTranslations);
    }, [showTeluguTranslations]);`;
content = content.replace("    const [showProjectorPreview, setShowProjectorPreview] = useState(() => localStorage.getItem('setting_showProjectorPreview') === 'true');", state_def);

// 3. Modify handleSongSelect to append Telugu slides and useEffect to react to toggles
const handle_select = `        // Ensure slides is an array and clean them for valid display
        const rawSlides = Array.isArray(fullSong.slides) ? fullSong.slides : [fullSong.slides || ""];
        setSlides(rawSlides);`;
const handle_select_new = `        // Ensure slides is an array and clean them for valid display
        const rawSlides = Array.isArray(fullSong.slides) ? [...fullSong.slides] : [fullSong.slides || ""];
        if (showTeluguTranslations && fullSong.teluguSlides && (fullSong.category === 'English Choruses' || fullSong.category === 'English Hymns')) {
            rawSlides.push(...fullSong.teluguSlides.filter(Boolean));
        }
        setSlides(rawSlides);`;
content = content.replace(handle_select, handle_select_new);

const effect_def = `    useEffect(() => {
        if (currentSong) {
            const rawSlides = Array.isArray(currentSong.slides) ? [...currentSong.slides] : [currentSong.slides || ""];
            if (showTeluguTranslations && currentSong.teluguSlides && (currentSong.category === 'English Choruses' || currentSong.category === 'English Hymns')) {
                rawSlides.push(...currentSong.teluguSlides.filter(Boolean));
            }
            setSlides(rawSlides);
        }
    }, [showTeluguTranslations]);`;
content = content.replace("    const executeDelete = async () => {", effect_def + "\n\n    const executeDelete = async () => {");

// 4. Modify projector content payload
const content_payload_old = `const content = typeof currentSlide === 'object' ? (currentSlide.text || '') : (currentSlide || '');`;
const content_payload_new = `const contentRaw = typeof currentSlide === 'object' ? (currentSlide.text || '') : (currentSlide || '');
                    const content = parseSlideLabel(contentRaw, currentSlideIndex).cleanText;`;
content = content.replace(content_payload_old, content_payload_new);

// 5. Modify Slide rendering in Grid
content = content.replace("<span>Slide {idx + 1}</span>", "<span>{parseSlideLabel(slide, idx).label}</span>");
content = content.replace("(slide || <span", "(parseSlideLabel(slide, idx).cleanText || <span");
content = content.replace(" slides[currentSlideIndex]}", " typeof slides[currentSlideIndex] === 'string' ? parseSlideLabel(slides[currentSlideIndex], currentSlideIndex).cleanText : slides[currentSlideIndex]}");

// 6. Add Toggle to Settings
const settings_old = `                                    <h2 className="font-display text-3xl font-bold text-slate-800">Settings</h2>
                                    <p className="text-xs text-slate-400 italic mt-1 font-medium italic">Configure LyriX Desktop to your needs</p>
                                </div>`;
const settings_new = `                                    <h2 className="font-display text-3xl font-bold text-slate-800">Settings</h2>
                                    <p className="text-xs text-slate-400 italic mt-1 font-medium italic">Configure LyriX Desktop to your needs</p>
                                </div>
                                <div className="absolute top-32 left-6 right-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                            <span className="text-xl">🌐</span> Bilingual Projection
                                        </h3>
                                        <label className="flex items-center gap-4 cursor-pointer mt-4">
                                            <div className="relative">
                                                <input type="checkbox" className="sr-only" checked={showTeluguTranslations} onChange={(e) => setShowTeluguTranslations(e.target.checked)} />
                                                <div className={\`block w-12 h-7 rounded-full transition-colors duration-300 \${showTeluguTranslations ? 'bg-indigo-500' : 'bg-slate-200'}\`}></div>
                                                <div className={\`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm \${showTeluguTranslations ? 'translate-x-5' : ''}\`}></div>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Show Telugu Translations for English Songs</span>
                                        </label>
                                        <p className="text-xs text-slate-500 mt-3 font-medium leading-relaxed max-w-xl">When enabled, songs in <span className="font-bold text-slate-700">English Choruses</span> and <span className="font-bold text-slate-700">English Hymns</span> will automatically append their Telugu translated slides to the end of the English slides, allowing you to project both seamlessly.</p>
                                    </div>
                                </div>`;
content = content.replace(settings_old, settings_new);

// 7. Add YouTube button to preview pane header
const yt_old = `                            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{currentSong.category}</div>
                            <div className="font-display font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">
                                {currentSong.title}
                            </div>
                        </div>`;
const yt_new = `                            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{currentSong.category}</div>
                            <div className="font-display font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors flex items-center gap-3">
                                {currentSong.title}
                                {currentSong.youtubeUrl && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); if (window.electron) { const vid = currentSong.youtubeUrl.match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:embed\\/|v\\/|watch\\?v=|watch\\?.+&v=))([\\w-]{11})/); if (vid) window.electron.invoke('media-play-youtube', vid[1]); } }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 hover:-translate-y-0.5 border border-red-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                        Play YouTube
                                    </button>
                                )}
                            </div>
                        </div>`;
content = content.replace(yt_old, yt_new);

fs.writeFileSync(appPath, content, 'utf8');
console.log("Patched successfully with Node.js!");
