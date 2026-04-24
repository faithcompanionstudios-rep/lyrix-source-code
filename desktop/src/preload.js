const { contextBridge, ipcRenderer } = require('electron');

function exposeListener(channel) {
    return (callback) => {
        const handler = (event, ...args) => callback(event, ...args);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    };
}

contextBridge.exposeInMainWorld('electron', {
    onStatus: exposeListener('status-update'),
    onSongsUpdate: exposeListener('songs-updated'),
    onCategoriesUpdate: exposeListener('categories-updated'),
    onProjectorStateChanged: exposeListener('projector-state-changed'),
    onProjectorKeyPress: exposeListener('projector-key-press'),
    onRemoteCommand: exposeListener('remote-command'),
    onScheduleUpdate: exposeListener('schedule-updated'),
    onProjectorSyncSlide: exposeListener('current-slide'),
    onProjectorSyncBlank: exposeListener('blank-screen'),
    onProjectorSyncSettings: exposeListener('settings-update'),
    onUpdateStatus: exposeListener('update-status'),
    onUpdateProgress: exposeListener('update-progress'),
    onAppRunningAlert: exposeListener('app-running-alert'),
    onDbStatus: exposeListener('db-status-updated'),
    onConfirmAppClose: exposeListener('confirm-app-close'),
    onBibleSetupProgress: exposeListener('bible:setup-progress'),
    onBibleVerseUpdate: exposeListener('bible-verse-update'),
    onSystemVolumeChanged: exposeListener('media:system-volume-changed'),
    onMediaCommand: exposeListener('media-command'),
    onMediaPlaybackUpdate: exposeListener('media:playback-update'),
    sendPlaybackUpdate: (payload) => ipcRenderer.send('media:playback-update', payload),
    sendAction: (action, data) => ipcRenderer.send('action', { action, data }),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    deleteSong: (id) => ipcRenderer.invoke('delete-song', id),
    appControl: (command) => ipcRenderer.invoke('app-control', command),
    setTitlebarTheme: (theme) => ipcRenderer.invoke('set-titlebar-theme', theme),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
});
