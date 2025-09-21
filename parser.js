const cheerio = require('cheerio');
const axios = require('axios');

class WordParser {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    /**
     * Parse DOOM dictionary data from HTML
     */
    parseDoomData(html, word) {
        const $ = cheerio.load(html);
        const definitions = [];

        try {
            // Find all entry elements that contain definitions
            $('root entry').each((index, element) => {
                const $entry = $(element);
                const entryText = $entry.text().trim();
                
                if (entryText && entryText.length > 0) {
                    // Clean up the text by removing extra whitespace and unwanted characters
                    const cleanContent = this.cleanText(entryText);
                    
                    // Be more permissive with DOOM entries - include most entries that have content
                    if (cleanContent.length > 10 && this.isRelevantDoomEntry(cleanContent, word)) {
                        // Parse the structured data from DOOM entry
                        const parsedEntry = this.parseDoomEntry(cleanContent);
                        
                        definitions.push({
                            type: 'doom_entry',
                            word: parsedEntry.word,
                            wordType: parsedEntry.wordType,
                            gender: parsedEntry.gender,
                            grammaticalInfo: parsedEntry.grammaticalInfo,
                            definitions: parsedEntry.definitions,
                            examples: parsedEntry.examples,
                            notes: parsedEntry.notes,
                            rawContent: cleanContent,
                            source: 'DOOM',
                            index: index
                        });
                    }
                }
            });

            // Debug: log what we found
            console.log(`DOOM parser found ${definitions.length} definitions for "${word}"`);
            if (definitions.length === 0) {
                // Let's try a more lenient approach - get all entries and filter later
                $('root entry').each((index, element) => {
                    const $entry = $(element);
                    const entryText = $entry.text().trim();
                    console.log(`DOOM entry ${index}: ${entryText.substring(0, 50)}...`);
                    
                    if (entryText && entryText.length > 5) {
                        const cleanContent = this.cleanText(entryText);
                        // Very lenient filter - just check if it contains any letters
                        if (/[a-zA-ZăâîșțĂÂÎȘȚ]/.test(cleanContent)) {
                            const parsedEntry = this.parseDoomEntry(cleanContent);
                            definitions.push({
                                type: 'doom_entry',
                                word: parsedEntry.word,
                                wordType: parsedEntry.wordType,
                                gender: parsedEntry.gender,
                                grammaticalInfo: parsedEntry.grammaticalInfo,
                                definitions: parsedEntry.definitions,
                                examples: parsedEntry.examples,
                                notes: parsedEntry.notes,
                                rawContent: cleanContent,
                                source: 'DOOM',
                                index: index
                            });
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error parsing DOOM data:', error);
        }

        // Remove duplicates and limit to most relevant entries
        const uniqueDefinitions = this.removeDuplicateStructured(definitions);
        const relevantDefinitions = uniqueDefinitions.slice(0, 7); // Limit to top 7 most relevant

        return {
            word,
            source: 'doom',
            definitions: relevantDefinitions,
            url: `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`,
            parsedAt: new Date().toISOString()
        };
    }

    /**
     * Parse DEXonline dictionary data from HTML
     */
    parseDexonlineData(html, word) {
        const $ = cheerio.load(html);
        const definitions = [];

        try {
            // Parse main definitions from DEXonline
            $('.defWrapper .def').each((index, element) => {
                const $def = $(element);
                const content = $def.text().trim();
                
                if (content && content.length > 20) {
                    // Clean up the text
                    const cleanContent = this.cleanText(content);
                    
                    // Get source information
                    const $wrapper = $def.closest('.defWrapper');
                    const $source = $wrapper.find('.defDetails .ref');
                    const source = $source.length > 0 ? $source.text().trim() : 'DEX';

                    // Only include if it's a proper definition and not duplicate
                    if (this.isRelevantDexDefinition(cleanContent, word)) {
                        // Parse the structured data from DEXonline entry
                        const parsedEntry = this.parseDexonlineEntry(cleanContent);
                        
                        definitions.push({
                            type: 'dexonline_definition',
                            word: parsedEntry.word,
                            wordType: parsedEntry.wordType,
                            gender: parsedEntry.gender,
                            grammaticalInfo: parsedEntry.grammaticalInfo,
                            definitions: parsedEntry.definitions,
                            examples: parsedEntry.examples,
                            etymology: parsedEntry.etymology,
                            notes: parsedEntry.notes,
                            rawContent: cleanContent,
                            source: this.cleanSourceName(source),
                            index: index
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error parsing DEXonline data:', error);
        }

        // Remove duplicates and limit to most relevant entries
        const uniqueDefinitions = this.removeDuplicateStructured(definitions);
        const relevantDefinitions = uniqueDefinitions.slice(0, 8); // Limit to top 8 most relevant

        return {
            word,
            source: 'dexonline',
            definitions: relevantDefinitions,
            url: `https://dexonline.ro/definitie/${encodeURIComponent(word)}`,
            parsedAt: new Date().toISOString()
        };
    }

    /**
     * Fetch and parse word from DOOM
     */
    async fetchDoomWord(word) {
        try {
            const url = `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
                },
                timeout: 10000
            });

            return this.parseDoomData(response.data, word);
        } catch (error) {
            console.error(`Error fetching DOOM data for "${word}":`, error.message);
            return {
                word,
                source: 'doom',
                definitions: [],
                error: error.message,
                url: `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`,
                parsedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Fetch and parse word from DEXonline
     */
    async fetchDexonlineWord(word) {
        try {
            const url = `https://dexonline.ro/definitie/${encodeURIComponent(word)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
                },
                timeout: 10000
            });

            return this.parseDexonlineData(response.data, word);
        } catch (error) {
            console.error(`Error fetching DEXonline data for "${word}":`, error.message);
            return {
                word,
                source: 'dexonline',
                definitions: [],
                error: error.message,
                url: `https://dexonline.ro/definitie/${encodeURIComponent(word)}`,
                parsedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Parse local HTML files (for testing)
     */
    parseLocalFiles(word) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const results = {};
            
            // Note: This function uses the existing HTML files for testing only
            // In a real scenario, we would fetch fresh data for each word
            console.log(`[LOCAL FILES] Parsing local files for word: "${word}"`);
            console.log('[LOCAL FILES] Note: Using cached HTML files (return-doom.html, return-dexonline.html, return-dex.html)');
            console.log('[LOCAL FILES] This is for testing only - actual API calls will fetch fresh data');
            
            // Parse DOOM file if it exists
            const doomPath = path.join(__dirname, 'return-doom.html');
            const dexonlinePath = path.join(__dirname, 'return-dexonline.html');
            const mdexPath = path.join(__dirname, 'return-dex.html');
            
            if (fs.existsSync(doomPath)) {
                const doomHtml = fs.readFileSync(doomPath, 'utf8');
                results.doom = this.parseDoomData(doomHtml, word);
            }
            
            if (fs.existsSync(dexonlinePath)) {
                const dexonlineHtml = fs.readFileSync(dexonlinePath, 'utf8');
                results.dexonline = this.parseDexonlineData(dexonlineHtml, word);
            }

            if (fs.existsSync(mdexPath)) {
                const mdexHtml = fs.readFileSync(mdexPath, 'utf8');
                results.mdex = this.parseMdexData(mdexHtml, word);
            }
            
            return results;
        } catch (error) {
            console.error('Error parsing local files:', error);
            return {};
        }
    }

    /**
     * Clean text by removing extra whitespace, HTML entities, and unwanted characters
     */
    cleanText(text) {
        return text
            .replace(/Copy to clipboard/gi, '')
            .replace(/Sursa:\s*[^)]+\)?/gi, '')
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[""'']/g, '"') // Normalize quotes
            .trim();
    }

    /**
     * Check if a DOOM entry is relevant to the searched word
     */
    isRelevantDoomEntry(content, word) {
        const lowerContent = content.toLowerCase();
        const lowerWord = word.toLowerCase();
        
        // Must contain the word or a close variant
        const wordVariations = [
            lowerWord,
            lowerWord + 'a', // feminine form
            lowerWord + 'e', // plural or other forms
            lowerWord + 'ă', // Romanian diacritics
            lowerWord.slice(0, -1), // without last letter
        ];
        
        const containsWord = wordVariations.some(variation => 
            lowerContent.includes(variation)
        );
        
        // Accept entries that contain grammar information or are longer than 10 chars
        const hasGrammarInfo = lowerContent.includes('s. f.') || 
                              lowerContent.includes('s. m.') || 
                              lowerContent.includes('vb.') ||
                              lowerContent.includes('art.') ||
                              lowerContent.includes('pl.');
        
        const isLongEnough = content.length > 10;
        
        // Be more permissive - include if it contains the word and has some substance
        return containsWord && (hasGrammarInfo || isLongEnough);
    }

    /**
     * Check if a DEXonline definition is relevant
     */
    isRelevantDexDefinition(content, word) {
        const lowerContent = content.toLowerCase();
        const lowerWord = word.toLowerCase();
        
        // Skip if it's incomplete or truncated
        if (content.length < 20 || content.includes('decoration:underline')) {
            return false;
        }
        
        // Skip if the entry is for a completely different word
        const entryWordMatch = content.match(/^([A-ZĂÂÎȘȚ]+)/);
        if (entryWordMatch) {
            const entryWord = entryWordMatch[1].toLowerCase();
            // If the entry word is completely different and doesn't contain our search word, skip it
            if (entryWord !== lowerWord && 
                !entryWord.includes(lowerWord) && 
                !lowerWord.includes(entryWord) &&
                entryWord.length > 2) {
                return false;
            }
        }
        
        // Handle Romanian diacritics and variations
        const wordVariations = [
            lowerWord,
            lowerWord + 'ă',
            lowerWord.replace('a', 'ă'),
            lowerWord.replace('i', 'î'),
            lowerWord.replace('s', 'ș'),
            lowerWord.replace('t', 'ț')
        ];
        
        // Must contain the word or a close variant
        const containsWord = wordVariations.some(variation => 
            lowerContent.includes(variation.toLowerCase())
        );
        
        // Must contain actual definition content
        const hasDefinition = lowerContent.includes('a ') && 
                             (lowerContent.includes('.') || lowerContent.includes(';'));
        
        // Be more selective - require word match and definition content
        return containsWord && (hasDefinition || lowerContent.includes('vb.') || lowerContent.includes('s. f.') || lowerContent.includes('s.n.'));
    }

    /**
     * Remove duplicate definitions based on content similarity
     */
    removeDuplicates(definitions) {
        const unique = [];
        const seen = new Set();
        
        for (const def of definitions) {
            // Create a simplified version for comparison
            const simplified = def.content
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 100); // First 100 chars for comparison
            
            if (!seen.has(simplified)) {
                seen.add(simplified);
                unique.push(def);
            }
        }
        
        return unique;
    }

    /**
     * Clean source name for better display
     */
    cleanSourceName(source) {
        return source
            .replace(/\s*\(\d{4}\)|\s*\(\d{4}-\d{4}\)/g, '') // Remove years
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse DOOM entry into structured data
     */
    /**
     * Parse DOOM entry into structured data
     */
    parseDoomEntry(content) {
        const result = {
            word: '',
            wordType: '',
            gender: '',
            grammaticalInfo: {},
            definitions: [],
            examples: [],
            etymology: '',
            notes: []
        };

        try {
            // Extract the main word (before any parentheses or grammar info)
            const wordMatch = content.match(/^([^\s\(]+)/);
            if (wordMatch) {
                result.word = wordMatch[1];
            }

            // Extract pronunciation/syllable separation from parentheses
            const pronMatch = content.match(/\(([^)]*desp[^)]*)\)/);
            if (pronMatch) {
                result.grammaticalInfo.pronunciation = pronMatch[1].replace('desp.', '').trim();
            }

            // Determine word type and extract grammatical information
            if (content.includes('vb.')) {
                result.wordType = 'verb';
                
                // Extract verb conjugation info
                const conjMatch = content.match(/ind\.\s*prez\.\s*([^;]+)/);
                if (conjMatch) {
                    result.grammaticalInfo.presentIndicative = conjMatch[1].trim();
                }
                
                const subjMatch = content.match(/conj\.\s*prez\.\s*([^.]+)/);
                if (subjMatch) {
                    result.grammaticalInfo.presentSubjunctive = subjMatch[1].trim();
                }

                // Create a basic definition for verbs (DOOM provides grammatical info, not semantic definitions)
                let verbDesc = `Verb: a ${result.word}`;
                if (result.grammaticalInfo.presentIndicative) {
                    verbDesc += ` (present: ${result.grammaticalInfo.presentIndicative})`;
                }
                if (result.grammaticalInfo.presentSubjunctive) {
                    verbDesc += ` (subjunctive: ${result.grammaticalInfo.presentSubjunctive})`;
                }
                result.definitions.push(verbDesc);
                
            } else if (content.includes('s. n.') || content.includes('sn.')) {
                result.wordType = 'substantiv';
                result.gender = 'neutru';
                
                // Extract plural form
                const plMatch = content.match(/pl\.\s*([^(,;]+)/);
                if (plMatch) {
                    result.grammaticalInfo.plural = plMatch[1].trim();
                }

                // Create definition for nouns (DOOM provides grammatical info, not semantic definitions)
                let definition = `Substantiv ${result.gender}`;
                if (result.grammaticalInfo.plural) {
                    definition += `, plural: ${result.grammaticalInfo.plural}`;
                }
                
                // Add any special notes about the word
                const specialNoteMatch = content.match(/\(([^)]*(?:dar|vezi|cf\.)[^)]*)\)/);
                if (specialNoteMatch) {
                    result.notes.push(specialNoteMatch[1].trim());
                }
                
                result.definitions.push(definition);
                result.definitions.push(definition);
                
            } else if (content.includes('s. f.')) {
                result.wordType = 'substantiv';
                result.gender = 'feminin';
                
                // Extract grammatical forms
                const artMatch = content.match(/art\.\s*([^,;]+)/);
                if (artMatch) {
                    result.grammaticalInfo.definiteForm = artMatch[1].trim();
                }
                
                const gdMatch = content.match(/g\.-d\.\s*art\.\s*([^;]+)/);
                if (gdMatch) {
                    result.grammaticalInfo.genitiveDative = gdMatch[1].trim();
                }
                
                const plMatch = content.match(/pl\.\s*([^(]+)/);
                if (plMatch) {
                    result.grammaticalInfo.plural = plMatch[1].trim();
                }

                // Create definition for feminine nouns
                let definition = `Substantiv ${result.gender}`;
                if (result.grammaticalInfo.plural) {
                    definition += `, plural: ${result.grammaticalInfo.plural}`;
                }
                result.definitions.push(definition);
                
            } else if (content.includes('s. m.')) {
                result.wordType = 'substantiv';
                result.gender = 'masculin';
                
                const plMatch = content.match(/pl\.\s*([^(]+)/);
                if (plMatch) {
                    result.grammaticalInfo.plural = plMatch[1].trim();
                }

                // Create definition for masculine nouns
                let definition = `Substantiv ${result.gender}`;
                if (result.grammaticalInfo.plural) {
                    definition += `, plural: ${result.grammaticalInfo.plural}`;
                }
                result.definitions.push(definition);
                
            } else if (content.includes('adj.')) {
                result.wordType = 'adjectiv';
                result.definitions.push('Adjectiv');
                
            } else if (content.includes('adv.')) {
                result.wordType = 'adverb';
                result.definitions.push('Adverb');
            }

            // Extract notes from parentheses (excluding pronunciation)
            const noteMatches = content.match(/\(([^)]+)\)/g);
            if (noteMatches) {
                result.notes = noteMatches
                    .map(note => note.slice(1, -1))
                    .filter(note => !note.includes('desp.') && !note.includes('a ~'));
            }

        } catch (error) {
            console.error('Error parsing DOOM entry:', error);
        }

        return result;
    }

    /**
     * Parse DEXonline entry into structured data
     */
    parseDexonlineEntry(content) {
        const result = {
            word: '',
            wordType: '',
            gender: '',
            grammaticalInfo: {},
            definitions: [],
            examples: [],
            etymology: '',
            notes: []
        };

        try {
            // Extract the main word (more precise extraction)
            let wordMatch = content.match(/^([A-ZĂÂÎȘȚ]+)/);
            if (!wordMatch) {
                // Try alternative patterns
                wordMatch = content.match(/([a-záâîșțăôêëïü]+)(?=\s+s[nm]?\.)/i);
            }
            if (!wordMatch) {
                // Use the word from the search if no clear word found
                wordMatch = [null, result.word || ''];
            }
            if (wordMatch && wordMatch[1]) {
                result.word = wordMatch[1].toUpperCase();
            }

            // Determine word type and gender from Romanian grammatical markers
            if (content.match(/\bs\.?\s*n\.?/i) || content.match(/\bsn\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'neutru';
            } else if (content.match(/\bs\.?\s*f\.?/i) || content.match(/\bsf\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'feminin';
            } else if (content.match(/\bs\.?\s*m\.?/i) || content.match(/\bsm\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'masculin';
            } else if (content.match(/\bvb\.?/i)) {
                result.wordType = 'verb';
                
                // Extract verb class
                const verbClassMatch = content.match(/vb\.?\s*([IVX]+)\.?/i);
                if (verbClassMatch) {
                    result.grammaticalInfo.conjugationClass = verbClassMatch[1];
                }
                
                // Extract transitivity
                const transMatch = content.match(/(tranz\.|tr\.|intranz\.|intr\.|reflect\.|refl\.)/i);
                if (transMatch) {
                    result.grammaticalInfo.transitivity = transMatch[1];
                }
            } else if (content.match(/\badj\.?/i)) {
                result.wordType = 'adjectiv';
            } else if (content.match(/\badv\.?/i)) {
                result.wordType = 'adverb';
            }

            // Extract plural forms (for nouns)
            const pluralMatch = content.match(/[Pp]l\.?\s*([a-záâîșțăôêëïü\-\s]+?)(?:\s*\/|\s*\[|\s*\.|$)/);
            if (pluralMatch) {
                result.grammaticalInfo.plural = pluralMatch[1].trim().replace(/[\/\[\]]/g, '');
            }

            // Extract pronunciation/syllable information (more precise patterns)
            const pronPatterns = [
                /[Pp]:\s*([a-záâîșțăôêëïü\-\s]+?)(?:\s*\/|\s*\]|\s*V:)/,
                /\/\s*([a-záâîșțăôêëïü\-\s]+?)\s*\//,
                /\[\s*([a-záâîșțăôêëïü\-\s]+?)\s*\]/
            ];
            
            for (const pattern of pronPatterns) {
                const pronMatch = content.match(pattern);
                if (pronMatch) {
                    const pron = pronMatch[1].trim();
                    // Only accept if it looks like a valid pronunciation (contains the word or syllables)
                    if (pron.length > 2 && pron.length < 20 && (pron.includes('-') || pron.toLowerCase().includes(result.word.toLowerCase().substring(0, 3)))) {
                        result.grammaticalInfo.pronunciation = pron;
                        break;
                    }
                }
            }

            // Extract numbered definitions
            const definitionRegex = /(\d+)\s*[.)]\s*([^.]*?(?:\.|!|\?|;))/g;
            let match;
            let hasNumberedDefs = false;
            
            while ((match = definitionRegex.exec(content)) !== null) {
                const defNumber = match[1];
                let definition = match[2].trim();
                
                // Try to get a more complete definition by looking for the full sentence
                const fullSentenceMatch = content.match(new RegExp(`${defNumber}\\s*[.)]\\s*([^.]*?(?:periodică|gazetă|jurnal|publicație|informații)[^.]*?\\.)`));
                if (fullSentenceMatch) {
                    definition = fullSentenceMatch[1].trim();
                }
                
                // Clean up the definition but preserve meaningful content
                definition = definition
                    .replace(/\b[A-Z]{2,}\.\s*/g, '') // Remove abbreviations like MINUL.
                    .replace(/\([^)]*(?:jurnal|înv|îrg|îvr|Spc|Pex)\.[^)]*\)/g, '') // Remove technical parentheses
                    .replace(/\s*Si:\s*[^.]*/, '') // Remove synonym sections
                    .replace(/\s+/g, ' ')
                    .replace(/^[^\w]*/, '') // Remove leading non-word chars
                    .trim();
                
                if (definition.length > 25 && !definition.match(/^[A-Z]{2,}/)) {
                    result.definitions.push(`${defNumber}. ${definition}`);
                    hasNumberedDefs = true;
                }
            }

            // If no numbered definitions, try to extract the main definition
            if (!hasNumberedDefs) {
                // Remove the word and grammatical markers to get the definition
                let mainDef = content
                    .replace(/^[A-ZĂÂÎȘȚ]+\s*/i, '') // Remove word
                    .replace(/\b(s\.?\s*[nfm]\.?|sn\.?|vb\.?\s*[IVX]*\.?)\s*/gi, '') // Remove grammatical markers
                    .replace(/\[[^\]]*\]/g, '') // Remove square brackets
                    .replace(/\/[^\/]*\//g, '') // Remove pronunciation slashes
                    .replace(/[Pp]l?\.?\s*[a-záâîșțăôêëïü\-\s]*?(?=\s|$)/, '') // Remove plural info
                    .trim();
                
                // Try to extract the first meaningful sentence or phrase
                const patterns = [
                    /^([^.;!?]*?(?:periodică|gazetă|jurnal|publicație)[^.;!?]*?[.;!?])/i,
                    /^([^.;!?]{30,}?[.;!?])/,
                    /^([^.;!?]{20,}?)(?:\s*Si:|$)/
                ];
                
                for (const pattern of patterns) {
                    const sentenceMatch = mainDef.match(pattern);
                    if (sentenceMatch) {
                        let definition = sentenceMatch[1]
                            .replace(/^\s*\([^)]*\)\s*/, '') // Remove leading parenthetical
                            .replace(/\([^)]*(?:jurnal|înv|îrg|îvr)\.[^)]*\)/g, '') // Remove technical parentheses
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        if (definition.length > 25) {
                            result.definitions.push(definition);
                            break;
                        }
                    }
                }
            }

            // Extract etymology (text after "E:" or an en-dash "– Din ...")
            const etymologyPatterns = [
                /\bE:\s*([^.;\]]+(?:\.[^;\]]+)*)/i, // E: fr. casser
                /\[\s*([^\]]*(?:fr\.|lat\.|germ\.|it\.|gr\.)[^\]]*)\s*\]/i, // [fr. ...]
                /–\s*(Din[^.;]+(?:\.[^.;]+)*)/i // – Din fr. casser.
            ];
            
            for (const pattern of etymologyPatterns) {
                const etymMatch = content.match(pattern);
                if (etymMatch) {
                    result.etymology = etymMatch[1].trim()
                        .replace(/\s+/g, ' ')
                        .replace(/\s*[,;]\s*$/, '')
                        .trim();
                    break;
                }
            }

            // Extract examples (better patterns for Romanian literary quotes)
            const examplePatterns = [
                // Quoted text
                /["""]([^"""]{20,})["""]/g,
                // Author citations with meaningful content
                /([A-Z][^.]{20,}?\b(?:MINUL|CAR|REBREANU|DRAGOMIR|COȘBUC|DUMITRIU)\b[^.]*\.)/g,
                // Sentences that contain the word and look like examples
                new RegExp(`([A-ZĂÂÎȘȚĂÔÊËÏÜ][^.]{15,}?\\b${result.word}\\w*\\b[^.]*\\.)`, 'gi')
            ];
            
            for (const pattern of examplePatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    let example = (match[1] || match[0]).trim();
                    
                    // Clean up the example
                    example = example
                        .replace(/^\d+\.\s*/, '') // Remove leading numbers
                        .replace(/\([^)]*\)/g, '') // Remove parenthetical notes
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    // Only include substantial, meaningful examples
                    if (example.length > 15 && 
                        example.length < 200 && 
                        !example.match(/^[A-Z]{2,}/) && // Not abbreviations
                        !result.examples.some(ex => ex.includes(example.substring(0, 20)))) { // Avoid duplicates
                        result.examples.push(example);
                        
                        // Limit to 3 good examples
                        if (result.examples.length >= 3) break;
                    }
                }
                if (result.examples.length >= 3) break;
            }

            // Extract notes (only keep short, meaningful register/usage flags; drop content fragments)
            const noteMatches = content.match(/\(([^)]+)\)/g);
            if (noteMatches) {
                const allowPrefix = /^(rar|fig\.|fam\.|arg\.|pop\.|înv\.|arhaic\.|neolog\.)/i;
                result.notes = noteMatches
                    .map(note => note.slice(1, -1).trim()) // Remove parentheses
                    .filter(note => {
                        const lower = note.toLowerCase();
                        // Exclude clear noise and long phrases lifted from definitions
                        if (lower.includes('fr.') || lower.includes('lat.') || lower.includes('germ.') || lower.includes('it.')) return false;
                        if (lower.includes('la tenis') || lower.includes('în raport cu') || lower.includes('față de')) return false;
                        if (lower.startsWith('si:') || lower.startsWith('e:') || lower.startsWith('at:') || lower.startsWith('pzi:')) return false;
                        if (/^[a-z]\.?\s*\d{3,4}$/.test(lower)) return false; // a. 1855
                        if (/^([0-9]{3,4}|pl\.|v:|pzi:)/.test(lower)) return false;
                        return allowPrefix.test(note) && note.length <= 20;
                    })
                    .slice(0, 2); // Keep at most two concise notes
            }

        } catch (error) {
            console.error('Error parsing DEXonline entry:', error);
        }

        return result;
    }

    /**
     * Remove duplicate and similar definitions across all sources
     */
    removeDuplicateStructured(definitions) {
        const unique = [];
        const seen = new Set();
        
        for (const def of definitions) {
            // Create a simplified version for comparison using main definition
            let mainDef = '';
            if (Array.isArray(def.definitions) && def.definitions.length > 0) {
                mainDef = def.definitions[0];
            } else {
                mainDef = def.rawContent || '';
            }
            
            // Normalize for comparison
            const simplified = mainDef
                .toLowerCase()
                .replace(/^\d+\.\s*/, '') // Remove leading numbers
                .replace(/[^\w\săâîșțăôêëïü]/g, ' ') // Keep only letters and Romanian diacritics
                .replace(/\b(folos|profit|beneficiu|avantaj|favoare|privilegiu|superioritate)\b/g, 'benefit') // Normalize synonyms
                .replace(/\b(în\s+raport\s+cu|față\s+de)\b/g, 'vs') // Normalize comparison phrases
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 60); // First 60 chars for comparison
            
            // Check for substantial similarity (at least 70% match for content over 20 chars)
            let isDuplicate = false;
            for (const seenDef of seen) {
                if (this.calculateSimilarity(simplified, seenDef) > 0.7 && simplified.length > 20) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                seen.add(simplified);
                unique.push(def);
            }
        }
        
        return unique;
    }

    /**
     * Calculate similarity between two strings (simple character-based)
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Parse m.dex.ro mobile dictionary data from HTML
     */
    parseMdexData(html, word) {
        const $ = cheerio.load(html);
        const definitions = [];

        try {
            // Parse definitions from m.dex.ro - they are in .mydef divs
            $('.mydef').each((index, element) => {
                const $def = $(element);
                const content = $def.text().trim();
                
                if (content && content.length > 30) {
                    let cleanContent = this.cleanText(content);
                    
                    if (cleanContent && this.isRelevantMdexDefinition(cleanContent, word)) {
                        // Parse structured data from m.dex.ro entry
                        const parsedEntry = this.parseMdexEntry(cleanContent);
                        
                        if (parsedEntry.definitions.length > 0 || cleanContent.length > 40) {
                            definitions.push({
                                word: parsedEntry.word || word,
                                wordType: parsedEntry.wordType,
                                gender: parsedEntry.gender,
                                grammaticalInfo: parsedEntry.grammaticalInfo,
                                definitions: parsedEntry.definitions,
                                examples: parsedEntry.examples,
                                etymology: parsedEntry.etymology,
                                notes: parsedEntry.notes,
                                rawContent: cleanContent,
                                source: 'm.dex.ro',
                                index: index
                            });
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error parsing m.dex.ro data:', error);
        }

        // Remove duplicates and limit to most relevant entries
        const uniqueDefinitions = this.removeDuplicateStructured(definitions);
        const relevantDefinitions = uniqueDefinitions.slice(0, 5); // Limit to top 5

        return {
            word,
            source: 'm.dex.ro',
            definitions: relevantDefinitions,
            url: `https://m.dex.ro/?word=${encodeURIComponent(word)}`,
            parsedAt: new Date().toISOString()
        };
    }

    /**
     * Parse m.dex.ro entry into structured data
     */
    parseMdexEntry(content) {
        const result = {
            word: '',
            wordType: '',
            gender: '',
            grammaticalInfo: {},
            definitions: [],
            examples: [],
            etymology: '',
            notes: []
        };

        try {
            // Extract the main word - look for complete word with diacritics
            const wordMatch = content.match(/^([A-ZĂÂÎȘȚÁÉÍÓÚ]+[A-ZÁÂÎȘȚĂÉÍÓÚ]*)/);
            if (wordMatch) {
                result.word = wordMatch[1];
            } else {
                // Fallback: try to extract from the beginning before comma or space
                const fallbackMatch = content.match(/^([^\s,]+)/);
                if (fallbackMatch) {
                    result.word = fallbackMatch[1].replace(/[^\w\u0080-\u024F]/g, '');
                }
            }

            // Determine word type and gender from Romanian grammatical markers
            if (content.match(/\bs\.?\s*n\.?/i) || content.match(/\bsn\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'neutru';
            } else if (content.match(/\bs\.?\s*f\.?/i) || content.match(/\bsf\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'feminin';
            } else if (content.match(/\bs\.?\s*m\.?/i) || content.match(/\bsm\.?/i)) {
                result.wordType = 'substantiv';
                result.gender = 'masculin';
            } else if (content.match(/\bvb\.?/i)) {
                result.wordType = 'verb';
            } else if (content.match(/\badj\.?/i)) {
                result.wordType = 'adjectiv';
            } else if (content.match(/\badv\.?/i)) {
                result.wordType = 'adverb';
            }

            // Extract plural forms
            const pluralMatch = content.match(/,\s*([a-záâîșțăôêëïü]+),/);
            if (pluralMatch) {
                result.grammaticalInfo.plural = pluralMatch[1];
            }

            // Extract numbered definitions - m.dex.ro uses bold numbers
            const definitionRegex = /(\d+)\.\s*([^.]*?(?:\.|!|\?|;))/g;
            let match;
            let hasNumberedDefs = false;
            
            while ((match = definitionRegex.exec(content)) !== null) {
                const defNumber = match[1];
                let definition = match[2].trim();
                
                // Get more complete definition if available
                const fullSentenceMatch = content.match(new RegExp(`${defNumber}\\.\\s*([^.]*?(?:folos|profit|beneficiu|avantaj|favoare|privilegiu)[^.]*?\\.)`));
                if (fullSentenceMatch) {
                    definition = fullSentenceMatch[1].trim();
                }
                
                // Clean up the definition
                definition = definition
                    .replace(/\s+/g, ' ')
                    .replace(/♦/g, '') // Remove special symbols
                    .replace(/◊/g, '')
                    .replace(/▫/g, '')
                    .trim();
                
                if (definition.length > 15) {
                    result.definitions.push(`${defNumber}. ${definition}`);
                    hasNumberedDefs = true;
                }
            }

            // If no numbered definitions, try to extract main definition
            if (!hasNumberedDefs) {
                // Look for definition after word type marker
                let mainDef = content
                    .replace(/^[A-ZĂÂÎȘȚ]+\s*/i, '') // Remove word
                    .replace(/\b(s\.?\s*[nfm]\.?|sn\.?|vb\.?\s*[IVX]*\.?)\s*/gi, '') // Remove grammatical markers
                    .replace(/\[[^\]]*\]/g, '') // Remove brackets
                    .trim();
                
                // Extract first substantial sentence
                const sentenceMatch = mainDef.match(/^([^.;!?]{20,}?[.;!?])/);
                if (sentenceMatch) {
                    let definition = sentenceMatch[1].trim();
                    if (definition.length > 20) {
                        result.definitions.push(definition);
                    }
                }
            }

            // Extract etymology (text after "–" or within specific patterns)
            const etymologyPatterns = [
                /–\s*(Din\s+[^.]+\.?[^.]*)/i,
                /–\s*(Fr\.?\s+[^.()]+)/i,
                /\[\s*([^[\]]*(?:fr\.|lat\.|germ\.|it\.)[^[\]]*)\s*\]/i,
                /<\s*(fr\.|lat\.|germ\.|it\.)\s*([^>]+)>/i,
                /\(\s*([^)]*(?:fr\.|lat\.|germ\.|it\.)[^)]*)\s*\)/i
            ];
            
            for (const pattern of etymologyPatterns) {
                const etymMatch = content.match(pattern);
                if (etymMatch) {
                    result.etymology = (etymMatch[1] || etymMatch[2]).trim()
                        .replace(/Copy to clipboard.*$/, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    break;
                }
            }

            // Extract examples (proper usage examples, not fragments or source citations)
            const exampleMatches = content.match(/\(([^)]{15,100}?)\)/g);
            if (exampleMatches) {
                result.examples = exampleMatches
                    .map(ex => ex.slice(1, -1)) // Remove parentheses
                    .filter(ex => {
                        const lowerEx = ex.toLowerCase();
                        return ex.length > 10 && 
                               ex.length < 100 &&
                               !lowerEx.includes('fr.') && 
                               !lowerEx.includes('lat.') &&
                               !lowerEx.includes('cf.') &&
                               !lowerEx.includes('sursa:') &&
                               !lowerEx.includes('copy to clipboard') &&
                               !lowerEx.includes('în raport cu') &&
                               !lowerEx.includes('față de altcineva') &&
                               !lowerEx.includes('var.') &&
                               !lowerEx.includes('înv.') &&
                               !lowerEx.includes('reg.') &&
                               !lowerEx.includes('pl.') &&
                               !lowerEx.match(/^[a-z]\.\s*\d{4}/) && // Remove date patterns like "a. 1855"
                               ex.includes(' ') && // Must contain spaces (actual sentences)
                               ex.match(/[a-zA-Z]{3,}/) // Must contain actual words
                    })
                    .slice(0, 3); // Limit to 3 examples
            }

        } catch (error) {
            console.error('Error parsing m.dex.ro entry:', error);
        }

        return result;
    }

    /**
     * Check if an m.dex.ro definition is relevant to the searched word
     */
    isRelevantMdexDefinition(content, word) {
        const lowerContent = content.toLowerCase();
        const lowerWord = word.toLowerCase();
        
        // Skip if it's too short
        if (content.length < 30) {
            return false;
        }
        
        // Handle Romanian diacritics and variations
        const wordVariations = [
            lowerWord,
            lowerWord + 'ă',
            lowerWord.replace('a', 'ă'),
            lowerWord.replace('i', 'î'),
            lowerWord.replace('s', 'ș'),
            lowerWord.replace('t', 'ț')
        ];
        
        // Must contain the word or a close variant
        const containsWord = wordVariations.some(variation => 
            lowerContent.includes(variation)
        );
        
        // Must have definition-like content
        const hasDefinitionContent = lowerContent.includes('1.') || 
                                   lowerContent.includes('s. n.') ||
                                   lowerContent.includes('s.n.') ||
                                   lowerContent.includes('vb.') ||
                                   lowerContent.includes('adj.');
        
        return containsWord && hasDefinitionContent;
    }

    /**
     * Fetch definition from m.dex.ro
     */
    async fetchMdexDefinition(word) {
        try {
            const url = `https://m.dex.ro/?word=${encodeURIComponent(word)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            
            return this.parseMdexData(response.data, word);
        } catch (error) {
            console.error(`Error fetching m.dex.ro definition for "${word}":`, error.message);
            return {
                word,
                source: 'm.dex.ro',
                definitions: [],
                url: `https://m.dex.ro/?word=${encodeURIComponent(word)}`,
                error: error.message,
                parsedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Fetch and parse word from m.dex.ro (mobile DEX)
     */
    async fetchMdexWord(word) {
        try {
            const url = `https://m.dex.ro/?word=${encodeURIComponent(word)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            
            return this.parseMdexData(response.data, word);
        } catch (error) {
            console.error(`Error fetching m.dex.ro data for "${word}":`, error.message);
            return {
                word,
                source: 'm.dex.ro',
                definitions: [],
                url: `https://m.dex.ro/?word=${encodeURIComponent(word)}`,
                error: error.message,
                parsedAt: new Date().toISOString()
            };
        }
    }
}

module.exports = WordParser;