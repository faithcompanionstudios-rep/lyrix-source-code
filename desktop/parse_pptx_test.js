const fs = require('fs');
const JSZip = require('jszip');
const cheerio = require('cheerio');

async function parsePptx(filePath) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    
    // Find all slide XML files
    const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    
    // Sort slides numerically
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)[1]);
        const numB = parseInt(b.match(/slide(\d+)/)[1]);
        return numA - numB;
    });

    const slidesText = [];

    for (const slideFile of slideFiles) {
        const xml = await zip.file(slideFile).async("string");
        const $ = cheerio.load(xml, { xmlMode: true });
        
        let slideText = '';
        // In PPTX, text is stored in <a:t> elements
        $('a\\:t').each((i, el) => {
            slideText += $(el).text() + '\n';
        });
        
        const cleanText = slideText.trim().replace(/\n+/g, '\n');
        if (cleanText) slidesText.push(cleanText);
    }

    return slidesText;
}

parsePptx(process.argv[2]).then(console.log).catch(console.error);
