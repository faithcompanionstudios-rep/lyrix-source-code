const { BrowserWindow } = require('electron');
const axios = require('axios');
const cheerio = require('cheerio');

async function searchLyrics(query) {
    console.log(`[Search] Searching using Browser: ${query}`);
    let searchWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
            offscreen: true,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    try {
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + ' lyrics')}`;
        console.log(`[Search] Loading: ${searchUrl}`);
        await searchWindow.loadURL(searchUrl);

        console.log("[Search] Page loaded, waiting for results...");

        const results = await searchWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
            setTimeout(() => {
                const items = [];
                document.querySelectorAll('article').forEach(el => {
                    const titleEl = el.querySelector('h2 a');
                    const linkEl = el.querySelector('h2 a');
                    const snippetEl = el.querySelector('div > div > div');
                    
                    if (titleEl && linkEl) {
                        items.push({
                            title: titleEl.innerText,
                            url: linkEl.href,
                            snippet: snippetEl ? snippetEl.innerText : ''
                        });
                    }
                });
                
                if (items.length === 0) {
                    document.querySelectorAll('#links .result__a').forEach(el => {
                        items.push({ title: el.innerText, url: el.href, snippet: '' });
                    });
                }
                resolve(items);
            }, 2000); 
        });
        `);

        console.log(`[Search] Found ${results.length} results.`);
        return results.slice(0, 15);

    } catch (e) {
        console.error("[Search] Browser Error:", e);
        return [];
    } finally {
        if (searchWindow && !searchWindow.isDestroyed()) {
            searchWindow.destroy();
        }
    }
}

async function fetchLyricsContent(url) {
    console.log(`[Fetch] Fast HTTP Fetching: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 8000
        });

        const $ = cheerio.load(response.data);

        // 1. Clean DOM of obvious non-lyric elements
        const removables = ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'img', 'svg', 'button', 'form', 'aside', '.ads', '[role="navigation"]', 'meta', 'link'];
        removables.forEach(tag => $(tag).remove());

        let container = null;

        // 2. Try Exact Known Selectors (Genius, AZLyrics, etc)
        const exactSelectors = [
            '[data-lyrics-container="true"]',
            '.lyrics',
            '.lyricbox',
            '.lyrics-body',
            '#lyric-body-text',
            '.ringtone' // Often precedes lyrics on some sites
        ];

        for (let selector of exactSelectors) {
            if ($(selector).length > 0) {
                container = $(selector);
                if (selector === '[data-lyrics-container="true"]') {
                    let combinedHTML = '';
                    container.each((i, el) => { combinedHTML += $(el).html() + '<br><br>'; });
                    container = $('<div>').html(combinedHTML);
                }
                break;
            }
        }

        // 3. Fallback: Smart Heuristic (<br> density)
        if (!container || container.text().trim().length < 50) {
            let bestElement = null;
            let maxScore = -1;

            $('div, p, article, section, td').each((i, el) => {
                const $el = $(el);
                // Count immediate <br> tags or <br> tags that are not deeply nested inside other major structural elements
                const brCount = $el.find('br').length;
                
                if (brCount > 3) {
                    // Calculate a score: we want high BR count but LOW character count of <a> links (to avoid menus)
                    const linkTextLength = $el.find('a').text().length;
                    const totalTextLength = $el.text().length || 1; // avoid division by zero
                    const linkRatio = linkTextLength / totalTextLength;
                    
                    // If it's mostly links, it's a menu, ignore it
                    if (linkRatio > 0.4) return;

                    // To avoid picking the massive outer wrapping <div>, we penalize elements that have child divs with high BR counts
                    let hasChildWithManyBrs = false;
                    $el.children('div, section, article').each((_, child) => {
                        if ($(child).find('br').length >= (brCount * 0.8)) {
                            hasChildWithManyBrs = true;
                        }
                    });

                    if (!hasChildWithManyBrs) {
                        // Score based on BR count and text density
                        const score = brCount * (1 - linkRatio);
                        if (score > maxScore) {
                            maxScore = score;
                            bestElement = $el;
                        }
                    }
                }
            });

            if (bestElement) {
                container = bestElement;
                // Strip out remaining links inside the lyrics container just in case
                container.find('a').each((i, el) => { $(el).replaceWith($(el).text()); });
            }
        }

        if (!container) {
            container = $('body'); // Absolute fallback
        }

        // 4. Extract Text while preserving newlines
        container.find('br').replaceWith('__BR__');
        container.find('p').append('__BR____BR__');
        container.find('div').append('__BR__');

        let text = container.text().replace(/__BR__/g, '\n');

        // Normalize Text
        return text
            .split('\n')
            .map(l => l.trim())
            .reduce((acc, line) => {
                const last = acc[acc.length - 1];
                if (!line || line.length === 0) {
                    if (acc.length > 0 && last !== '') acc.push('');
                } else {
                    acc.push(line);
                }
                return acc;
            }, [])
            .join('\n')
            .substring(0, 10000);

    } catch (e) {
        console.error("[Fetch] HTTP Error:", e.message);
        return "Failed to fetch content. Site might be blocking requests.";
    }
}

module.exports = {
    searchLyrics,
    fetchLyricsContent
};
