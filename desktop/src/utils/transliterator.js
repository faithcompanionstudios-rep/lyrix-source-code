/**
 * Offline Transliterator for all Indic Languages
 * Enables fuzzy searching for native languages using English keywords.
 */

const Sanscript = require('sanscript');
const { transliterate: universalTransliterate } = require('transliteration');

// Maps Unicode block starts to Sanscript scheme names
const INDIC_BLOCKS = [
    { start: 0x0900, end: 0x097F, scheme: 'devanagari' },
    { start: 0x0980, end: 0x09FF, scheme: 'bengali' },
    { start: 0x0A00, end: 0x0A7F, scheme: 'gurmukhi' },
    { start: 0x0A80, end: 0x0AFF, scheme: 'gujarati' },
    { start: 0x0B00, end: 0x0B7F, scheme: 'oriya' },
    { start: 0x0B80, end: 0x0BFF, scheme: 'tamil' },
    { start: 0x0C00, end: 0x0C7F, scheme: 'telugu' },
    { start: 0x0C80, end: 0x0CFF, scheme: 'kannada' },
    { start: 0x0D00, end: 0x0D7F, scheme: 'malayalam' }
];

/**
 * Detects the dominant Indic script in a given text.
 * @param {string} text
 * @returns {string|null} - The Sanscript scheme name, or null if no Indic script found
 */
function detectIndicScheme(text) {
    const counts = {};
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        // Quick bounds check
        if (code >= 0x0900 && code <= 0x0D7F) {
            for (const block of INDIC_BLOCKS) {
                if (code >= block.start && code <= block.end) {
                    counts[block.scheme] = (counts[block.scheme] || 0) + 1;
                    break;
                }
            }
        }
    }
    
    // Find the scheme with the most characters
    let maxScheme = null;
    let maxCount = 0;
    for (const [scheme, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            maxScheme = scheme;
        }
    }
    
    return maxScheme;
}

/**
 * Transliterates text from any supported Indic script to Romanized English (itrans).
 * @param {string} text - The native language text
 * @returns {string} - The Romanized text
 */
function transliterate(text) {
    if (!text) return '';
    
    let processedText = text;
    const scheme = detectIndicScheme(text);
    
    if (scheme) {
        try {
            // 'itrans' uses capital letters for long vowels/retroflex consonants, 
            // we lowercase it because our search logic is case-insensitive anyway.
            processedText = Sanscript.t(text, scheme, 'itrans');
        } catch (e) {
            console.error('Sanscript Transliteration failed:', e);
        }
    }
    
    // Apply universal fallback for any remaining non-ASCII characters (Cyrillic, Arabic, CJK, Greek, etc.)
    try {
        processedText = universalTransliterate(processedText);
    } catch (e) {
        console.error('Universal Transliteration failed:', e);
    }

    return processedText.toLowerCase();
}

module.exports = {
    transliterate,
    detectIndicScheme
};

const axios = require('axios');

const SCHEME_TO_GOOGLE_LANG = {
    'telugu': 'te',
    'devanagari': 'hi',
    'tamil': 'ta',
    'malayalam': 'ml',
    'kannada': 'kn',
    'bengali': 'bn',
    'gujarati': 'gu',
    'gurmukhi': 'pa',
    'oriya': 'or'
};

async function transliterateToNative(text, targetScheme) {
    if (!text || !targetScheme) return text;
    
    const langCode = SCHEME_TO_GOOGLE_LANG[targetScheme];
    
    // 1. Try Online API (Google Input Tools) for smart predictive typing
    if (langCode) {
        try {
            const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${langCode}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
            const response = await axios.get(url, { timeout: 800 });
            
            if (response.data && response.data[0] === 'SUCCESS' && response.data[1] && response.data[1][0] && response.data[1][0][1]) {
                const candidates = response.data[1][0][1];
                if (candidates.length > 0) {
                    return candidates[0]; // Return the best predictive match
                }
            }
        } catch (e) {
            // Silently swallow network/timeout errors and fallback to offline mode
        }
    }
    
    // 2. Fallback to Offline Engine (Sanscript strict phonetic)
    try {
        return Sanscript.t(text, 'itrans', targetScheme);
    } catch (e) {
        console.error('Reverse Transliteration failed:', e);
        return text;
    }
}

module.exports.transliterateToNative = transliterateToNative;
