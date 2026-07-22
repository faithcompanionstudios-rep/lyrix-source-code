const fs = require('fs');
const appPath = 'src/renderer/App.jsx';
let content = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update SongPreviewControls signature
const oldSig = `function SongPreviewControls({ currentSong, slides, currentSlideIndex, setCurrentSlideIndex, isBlack, setIsBlack, previewMode, setPreviewMode, previewFont, onEdit, onDelete, isFavourite, onToggleFavourite, isProjectorOpen, onOpenProjector }) {`;
const newSig = `function SongPreviewControls({ currentSong, slides, currentSlideIndex, setCurrentSlideIndex, isBlack, setIsBlack, previewMode, setPreviewMode, previewFont, onEdit, onDelete, isFavourite, onToggleFavourite, isProjectorOpen, onOpenProjector, showTeluguTranslations, setShowTeluguTranslations }) {`;
content = content.replace(oldSig, newSig);

// 2. Add header inside SongPreviewControls
const oldRenderStart = `    return (
        <div className="flex-1 flex flex-col bg-slate-50/30 relative min-h-0">

            {/* Main Preview */}`;
const newRenderStart = `    return (
        <div className="flex-1 flex flex-col bg-slate-50/30 relative min-h-0">

            {/* Dynamic Header */}
            {currentSong && (
                <div className="h-[72px] bg-white border-b border-slate-200/60 flex items-center justify-between px-8 shrink-0 shadow-sm z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shadow-inner">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-0.5">{currentSong.category}</div>
                            <div className="font-display font-bold text-slate-800 text-xl leading-tight flex items-center gap-3">
                                {currentSong.title}
                                {currentSong.youtubeUrl && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); if (window.electron) { const vid = currentSong.youtubeUrl.match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:embed\\/|v\\/|watch\\?v=|watch\\?.+&v=))([\\w-]{11})/); if (vid) window.electron.invoke('media-play-youtube', vid[1]); } }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 hover:-translate-y-0.5 border border-red-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ml-2"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                        Play YouTube
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {(currentSong.category === 'English Choruses' || currentSong.category === 'English Hymns') && currentSong.teluguSlides && currentSong.teluguSlides.length > 0 && (
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-inner">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Telugu Slides</span>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only" checked={showTeluguTranslations} onChange={(e) => setShowTeluguTranslations(e.target.checked)} />
                                    <div className={\`block w-10 h-6 rounded-full transition-colors duration-300 \${showTeluguTranslations ? 'bg-indigo-500' : 'bg-slate-300'}\`}></div>
                                    <div className={\`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm \${showTeluguTranslations ? 'translate-x-4' : ''}\`}></div>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
            )}

            {/* Main Preview */}`;
content = content.replace(oldRenderStart, newRenderStart);

// 3. Update SongPreviewControls invocation
const oldInvocation = `<SongPreviewControls
                            currentSong={currentSong}
                            slides={slides}`;
const newInvocation = `<SongPreviewControls
                            currentSong={currentSong}
                            slides={slides}
                            showTeluguTranslations={showTeluguTranslations}
                            setShowTeluguTranslations={setShowTeluguTranslations}`;
content = content.replace(oldInvocation, newInvocation);

// 5. Update default parseSlideLabel to Verse for hymns (done by replacing the parseSlideLabel definition)
const oldParseFuncStr = `const parseSlideLabel = (text, index) => {
    let label = \`Slide \${index + 1}\`;`;
const newParseFuncStr = `const parseSlideLabel = (text, index) => {
    let label = \`Verse \${index + 1}\`;`;
content = content.replace(oldParseFuncStr, newParseFuncStr);

fs.writeFileSync(appPath, content, 'utf8');
console.log("Patched Preview Controls successfully with \\n normalization!");
