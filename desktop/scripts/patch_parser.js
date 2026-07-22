const fs = require('fs');
const appPath = 'src/renderer/App.jsx';
let content = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update parseSlideLabel signature and logic
const oldParseFunc = `const parseSlideLabel = (text, index) => {
    let label = \`Verse \${index + 1}\`;`;
const newParseFunc = `const parseSlideLabel = (text, index, category) => {
    let label = (category && category.toLowerCase().includes('chorus')) ? (index === 0 ? 'Chorus' : \`Chorus \${index + 1}\`) : \`Verse \${index + 1}\`;`;
content = content.replace(oldParseFunc, newParseFunc);

// 2. Update calls to parseSlideLabel
content = content.replace(/parseSlideLabel\((.*?),\s*(.*?)\)/g, 'parseSlideLabel($1, $2, typeof currentSong !== "undefined" ? currentSong?.category : "")');

fs.writeFileSync(appPath, content, 'utf8');
console.log("Patched parser successfully!");
