const fs = require('fs');
const path = require('path');
const dbPath = 'src/database/db.js';
let content = fs.readFileSync(dbPath, 'utf8').replace(/\r\n/g, '\n');

const oldMap = `    // 3. Overlay edits onto bundled songs
    const merged = filtered.map(s => customMap.has(s.id) ? customMap.get(s.id) : s);`;

const newMap = `    // 3. Overlay edits onto bundled songs
    const merged = filtered.map(s => {
        if (customMap.has(s.id)) {
            const custom = customMap.get(s.id);
            // Preserve new database fields that might not exist in old custom saves
            if (s.teluguSlides && !custom.teluguSlides) custom.teluguSlides = s.teluguSlides;
            if (s.youtubeUrl && !custom.youtubeUrl) custom.youtubeUrl = s.youtubeUrl;
            return custom;
        }
        return s;
    });`;

content = content.replace(oldMap, newMap);
fs.writeFileSync(dbPath, content, 'utf8');
console.log("db.js patched successfully.");
