const fs = require('fs');

const appPath = 'src/renderer/App.jsx';
let content = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Find the start and end of the security tab block
const startStr = "{adminTab === 'security' && (";
const endStr = "{adminTab === 'fonts' && (";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const oldSecurityTab = content.substring(startIndex, endIndex);

    const newSecurityTab = `{adminTab === 'security' && (
                                            <div className="space-y-8 animate-fade-in">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-8">
                                                    <div className="flex items-center justify-between mb-8">
                                                        <h3 className="text-xl font-bold text-slate-800 font-display flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                            </div>
                                                            Security Settings
                                                        </h3>
                                                        <button 
                                                            onClick={() => { setAdminUsernameInput(''); setAdminPasswordInput(''); setCustomAlert('Inputs reset.'); }}
                                                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                                                        >
                                                            Reset Form
                                                        </button>
                                                    </div>
                                                    <div className="space-y-6">
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
                                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Advanced Settings Username</label>
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
                                                            </div>
                                                        )}
                                                        <div className="pt-4">
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmInput = document.getElementById('confirmPassword');
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
                                                                        if(confirmInput) confirmInput.value = '';
                                                                    } else {
                                                                        setCustomAlert('Failed to update credentials.');
                                                                    }
                                                                }}
                                                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] uppercase tracking-widest"
                                                            >
                                                                Update Security Details
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden h-full">
                                                    <div className="absolute top-0 right-0 p-8 opacity-5">
                                                        <svg className="w-32 h-32 text-indigo-900" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" /></svg>
                                                    </div>

                                                    <h4 className="text-xl font-bold text-slate-800 mb-2">Protect Your Workspace</h4>
                                                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-8">
                                                        Keep your lyrics management safe. We recommend using a unique password and updating it regularly.
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-4 w-full">
                                                        <div className="bg-white shadow-sm rounded-2xl p-4 border border-slate-100">
                                                            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Status</div>
                                                            <div className="text-indigo-600 text-sm font-bold">{isPasswordProtected ? 'Encrypted' : 'Open'}</div>
                                                        </div>
                                                        <div className="bg-white shadow-sm rounded-2xl p-4 border border-slate-100">
                                                            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Access</div>
                                                            <div className="text-indigo-600 text-sm font-bold">{isPasswordProtected ? 'Restricted' : 'Unrestricted'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        \n                                        `;

    content = content.replace(oldSecurityTab, newSecurityTab);

    // Also fix the lock icon in the Advanced Settings login modal
    const oldLoginIcon = `<div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-inner">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>`;
    const newLoginIcon = `<div className="w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-inner">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    </div>`;
    content = content.replace(oldLoginIcon, newLoginIcon);

    fs.writeFileSync(appPath, content, 'utf8');
    console.log("Successfully replaced Security Tab by index!");
} else {
    console.log("Error: could not find start/end index.");
}
