const fs = require('fs');
const path = require('path');

const appPath = 'src/renderer/App.jsx';
let content = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Rename Button in Top Bar
content = content.replace(
    /Admin Login/g,
    'Advanced Settings'
);
content = content.replace(
    /Exit Admin/g,
    'Exit Advanced Settings'
);

// 2. Add isPasswordProtected state to Security Tab
const secStateOld = `const [adminUsernameInput, setAdminUsernameInput] = useState('');
    const [adminPasswordInput, setAdminPasswordInput] = useState('');
    const [confirmInput, setConfirmInput] = useState({ value: '', active: false });`;

const secStateNew = `const [adminUsernameInput, setAdminUsernameInput] = useState('');
    const [adminPasswordInput, setAdminPasswordInput] = useState('');
    const [confirmInput, setConfirmInput] = useState({ value: '', active: false });
    const [isPasswordProtected, setIsPasswordProtected] = useState(true);`;

content = content.replace(secStateOld, secStateNew);

// Fetch initial state for security tab
const oldSetupEffect = `useEffect(() => {
        if (activeTab === 'settings') {
            window.electron?.invoke('get-app-settings').then(s => {
                if (s) {
                    setSettingsForceOffline(!!s.forceOfflineMode);
                    setSettingsPlaystoreLink(s.playstoreLink || 'https://play.google.com/store/apps/details?id=com.faithcompanionstudios.lyrix');
                }
            });
        }
    }, [activeTab]);`;

const newSetupEffect = `useEffect(() => {
        if (activeTab === 'settings') {
            window.electron?.invoke('get-app-settings').then(s => {
                if (s) {
                    setSettingsForceOffline(!!s.forceOfflineMode);
                    setSettingsPlaystoreLink(s.playstoreLink || 'https://play.google.com/store/apps/details?id=com.faithcompanionstudios.lyrix');
                }
            });
            window.electron?.invoke('get-admin-credentials').then(creds => {
                if (creds) {
                    setAdminUsernameInput(creds.username || 'admin');
                    setIsPasswordProtected(creds.isPasswordProtected !== false);
                }
            });
        }
    }, [activeTab]);`;

content = content.replace(oldSetupEffect, newSetupEffect);

// 3. Security Tab UI Update
const oldSecurityTab = `{adminTab === 'security' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                        <div className="lg:col-span-3">
                                            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col h-full">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        </div>
                                                        <h3 className="font-display font-extrabold text-xl text-slate-800">
                                                            Admin Credentials
                                                        </h3>
                                                    </div>
                                                    <button
                                                        onClick={() => { setAdminUsernameInput(''); setAdminPasswordInput(''); setCustomAlert('Inputs reset.'); }}
                                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors"
                                                    >
                                                        Reset Form
                                                    </button>
                                                </div>

                                                <div className="space-y-5 flex-1">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Admin Username</label>
                                                        <input
                                                            type="text"
                                                            value={adminUsernameInput}
                                                            onChange={(e) => setAdminUsernameInput(e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all italic text-slate-600"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">New Password</label>
                                                            <input
                                                                type="password"
                                                                value={adminPasswordInput}
                                                                onChange={(e) => setAdminPasswordInput(e.target.value)}
                                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono tracking-widest"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Confirm Password</label>
                                                            <input
                                                                type="password"
                                                                value={confirmInput.value}
                                                                onChange={(e) => setConfirmInput({ value: e.target.value, active: true })}
                                                                className={\`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium outline-none transition-all font-mono tracking-widest \${confirmInput.active && confirmInput.value !== adminPasswordInput ? 'border-red-300 focus:ring-4 focus:ring-red-500/10 bg-red-50/30' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}\`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        if (window.electron) {
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
                                                                setConfirmInput({ value: '', active: false });
                                                            } else {
                                                                setCustomAlert('Failed to update credentials.');
                                                            }
                                                        }
                                                    }}
                                                    className="w-full mt-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
                                                >
                                                    UPDATE SECURITY DETAILS
                                                </button>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                                                <div className="relative z-10 w-full">
                                                    <svg className="w-20 h-20 text-slate-100 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/></svg>
                                                    <h4 className="font-display font-extrabold text-xl text-slate-800 mb-3">Protect Your Workspace</h4>
                                                    <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
                                                        Keep your lyrics management safe. We recommend using a unique password and updating it regularly.
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                                            <div className="text-sm font-bold text-indigo-600">Encrypted</div>
                                                        </div>
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Access</div>
                                                            <div className="text-sm font-bold text-indigo-600">Restricted</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}`;

const newSecurityTab = `{adminTab === 'security' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                        <div className="lg:col-span-3">
                                            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col h-full">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        </div>
                                                        <h3 className="font-display font-extrabold text-xl text-slate-800">
                                                            Security Settings
                                                        </h3>
                                                    </div>
                                                    <button
                                                        onClick={() => { setAdminUsernameInput(''); setAdminPasswordInput(''); setCustomAlert('Inputs reset.'); }}
                                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors"
                                                    >
                                                        Reset Form
                                                    </button>
                                                </div>

                                                <div className="space-y-6 flex-1">
                                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-sm">Require Password</h4>
                                                            <p className="text-xs text-slate-500 mt-1">Enable password protection for Advanced Settings</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setIsPasswordProtected(!isPasswordProtected)}
                                                            className={\`w-12 h-6 rounded-full transition-colors relative \${isPasswordProtected ? 'bg-indigo-500' : 'bg-slate-300'}\`}
                                                        >
                                                            <div className={\`w-4 h-4 rounded-full bg-white absolute top-1 transition-all \${isPasswordProtected ? 'left-7' : 'left-1'}\`}></div>
                                                        </button>
                                                    </div>

                                                    {isPasswordProtected && (
                                                        <div className="space-y-5 animate-fade-in">
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Admin Username</label>
                                                                <input
                                                                    type="text"
                                                                    value={adminUsernameInput}
                                                                    onChange={(e) => setAdminUsernameInput(e.target.value)}
                                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all italic text-slate-600"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                                <div>
                                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">New Password</label>
                                                                    <input
                                                                        type="password"
                                                                        value={adminPasswordInput}
                                                                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono tracking-widest"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Confirm Password</label>
                                                                    <input
                                                                        type="password"
                                                                        value={confirmInput.value}
                                                                        onChange={(e) => setConfirmInput({ value: e.target.value, active: true })}
                                                                        className={\`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium outline-none transition-all font-mono tracking-widest \${confirmInput.active && confirmInput.value !== adminPasswordInput ? 'border-red-300 focus:ring-4 focus:ring-red-500/10 bg-red-50/30' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}\`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        if (window.electron) {
                                                            if (isPasswordProtected) {
                                                                if (!adminUsernameInput || !adminPasswordInput) {
                                                                    setCustomAlert('Username and Password cannot be empty when protection is enabled.');
                                                                    return;
                                                                }
                                                                if (adminPasswordInput !== confirmInput.value) {
                                                                    setCustomAlert('Passwords do not match.');
                                                                    return;
                                                                }
                                                            }
                                                            const success = await window.electron.invoke('set-admin-credentials', adminUsernameInput || 'admin', adminPasswordInput || 'admin', isPasswordProtected);
                                                            if (success) {
                                                                setCustomAlert('Security details updated successfully!');
                                                                if (isPasswordProtected) {
                                                                    setIsAdminLoggedIn(false);
                                                                }
                                                                setAdminPasswordInput('');
                                                                setConfirmInput({ value: '', active: false });
                                                            } else {
                                                                setCustomAlert('Failed to update credentials.');
                                                            }
                                                        }
                                                    }}
                                                    className="w-full mt-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
                                                >
                                                    UPDATE SECURITY DETAILS
                                                </button>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                                                <div className="relative z-10 w-full">
                                                    <svg className="w-20 h-20 text-slate-100 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/></svg>
                                                    <h4 className="font-display font-extrabold text-xl text-slate-800 mb-3">Protect Your Workspace</h4>
                                                    <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
                                                        Keep your lyrics management safe. We recommend using a unique password and updating it regularly.
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                                            <div className="text-sm font-bold text-indigo-600">{isPasswordProtected ? 'Encrypted' : 'Open'}</div>
                                                        </div>
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Access</div>
                                                            <div className="text-sm font-bold text-indigo-600">{isPasswordProtected ? 'Restricted' : 'Unrestricted'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}`;

content = content.replace(oldSecurityTab, newSecurityTab);

// 4. Bypass logic for AdminVerifyPrompt
const adminVerifyBypassOld = `const [adminVerifyPrompt, setAdminVerifyPrompt] = useState(null);`;
const adminVerifyBypassNew = `const [adminVerifyPrompt, setAdminVerifyPromptState] = useState(null);

    const setAdminVerifyPrompt = async (promptData) => {
        if (!promptData) {
            setAdminVerifyPromptState(null);
            return;
        }
        
        if (window.electron) {
            const creds = await window.electron.invoke('get-admin-credentials');
            if (creds && creds.isPasswordProtected === false) {
                // Bypass prompt completely
                if (promptData.onVerify) {
                    promptData.onVerify();
                }
                return;
            }
        }
        setAdminVerifyPromptState(promptData);
    };`;
content = content.replace(adminVerifyBypassOld, adminVerifyBypassNew);

// Rename Admin Username in Admin Verify prompt to Advanced Settings Username
content = content.replace(/Admin Username/g, 'Advanced Settings Username');

// 5. Bypass logic for Admin Login Button (in top bar)
const loginBtnLogicOld = `onClick={() => {
                            if (isAdminLoggedIn) {
                                setIsAdminLoggedIn(false);
                                setAdminTab('categories');
                            } else {
                                setShowAdminLoginModal(true);
                            }
                        }}`;
const loginBtnLogicNew = `onClick={async () => {
                            if (isAdminLoggedIn) {
                                setIsAdminLoggedIn(false);
                                setAdminTab('categories');
                            } else {
                                if (window.electron) {
                                    const creds = await window.electron.invoke('get-admin-credentials');
                                    if (creds && creds.isPasswordProtected === false) {
                                        setIsAdminLoggedIn(true);
                                        return;
                                    }
                                }
                                setShowAdminLoginModal(true);
                            }
                        }}`;
content = content.replace(loginBtnLogicOld, loginBtnLogicNew);

// Ensure lock icon in top bar changes to gear if we renamed it. 
// Old button block:
const btnBlockOld = `<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        <span className="font-bold tracking-wide">Admin Login</span>`;

const btnBlockNew = `<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <span className="font-bold tracking-wide">Advanced Settings</span>`;
content = content.replace(btnBlockOld, btnBlockNew);


// Topbar exit icon block:
const btnExitBlockOld = `<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="font-bold tracking-wide">Exit Advanced Settings</span>`;

content = content.replace(btnExitBlockOld, `<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="font-bold tracking-wide">Exit Advanced Settings</span>`);

fs.writeFileSync(appPath, content, 'utf8');
console.log('Patched App.jsx!');
