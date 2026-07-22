const fs = require('fs');
const db = require('./src/database/songs.json');
const c1 = db.find(s => s.id === 'C1');
console.log(JSON.stringify(c1, null, 2));
