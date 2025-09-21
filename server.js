const express = require('express');
const cors = require('cors');
const Database = require('./database');
const WordParser = require('./parser');

class VocabularyAPI {
    constructor() {
        this.app = express();
        this.db = new Database();
        this.parser = new WordParser();
        this.port = process.env.PORT || 3000;
        
        // Bind helpers
        this.sanitizeDefinition = this.sanitizeDefinition.bind(this);
        this.sanitizeResultItem = this.sanitizeResultItem.bind(this);

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Get word definition with caching
        this.app.get('/api/word/:word', async (req, res) => {
            try {
                const word = req.params.word.toLowerCase().trim();
                const source = req.query.source; // 'doom', 'dexonline', 'mdex', or null for all
                const forceRefresh = req.query.refresh === 'true';

                if (!word) {
                    return res.status(400).json({ error: 'Word parameter is required' });
                }

                let results = [];

                if (!forceRefresh) {
                    // Try to get from cache first
                    const cachedResults = await this.db.getWord(word, source);
                    if (cachedResults.length > 0) {
                        // Return only sanitized, structured content; never include raw HTML
                        results = cachedResults.map(row => this.sanitizeResultItem({
                            id: row.id,
                            word: row.word,
                            source: row.source,
                            definitions: JSON.parse(row.definitions || '[]'),
                            url: row.search_url,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at,
                            cached: true
                        }));
                        
                        console.log(`Serving cached results for "${word}"`);
                        return res.json({
                            word,
                            results,
                            cached: true,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // If not cached or force refresh, fetch from external sources
                console.log(`Fetching fresh data for "${word}"`);
                const fetchPromises = [];

                if (!source || source === 'doom') {
                    fetchPromises.push(this.parser.fetchDoomWord(word));
                }
                
                if (!source || source === 'dexonline') {
                    fetchPromises.push(this.parser.fetchDexonlineWord(word));
                }

                if (!source || source === 'mdex') {
                    fetchPromises.push(this.parser.fetchMdexWord(word));
                }

                const fetchedResults = await Promise.all(fetchPromises);

                // Save to database and prepare response
                for (const result of fetchedResults) {
                    if (result.definitions.length > 0) {
                        await this.db.saveWord(
                            word,
                            result.source,
                            result.definitions,
                            JSON.stringify(result),
                            result.url
                        );
                    }
                    // Sanitize outgoing payload
                    results.push(this.sanitizeResultItem({
                        word: result.word,
                        source: result.source,
                        definitions: result.definitions,
                        url: result.url,
                        parsedAt: result.parsedAt,
                        error: result.error,
                        cached: false
                    }));
                }

                res.json({
                    word,
                    results,
                    cached: false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in /api/word/:word:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message 
                });
            }
        });

        // Search words in database
        this.app.get('/api/search/:term', async (req, res) => {
            try {
                const searchTerm = req.params.term.toLowerCase().trim();
                
                if (!searchTerm || searchTerm.length < 2) {
                    return res.status(400).json({ 
                        error: 'Search term must be at least 2 characters long' 
                    });
                }

                const results = await this.db.searchWords(searchTerm);
                
                res.json({
                    searchTerm,
                    count: results.length,
                    results,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in /api/search/:term:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message 
                });
            }
        });

        // Parse local test files
        this.app.get('/api/test/parse/:word', async (req, res) => {
            try {
                const word = req.params.word.toLowerCase().trim();
                const parsed = this.parser.parseLocalFiles(word);

                // Sanitize per-source results similar to /api/word
                const results = {};
                if (parsed.doom) results.doom = this.sanitizeResultItem(parsed.doom);
                if (parsed.dexonline) results.dexonline = this.sanitizeResultItem(parsed.dexonline);
                if (parsed.mdex) results.mdex = this.sanitizeResultItem(parsed.mdex);

                res.json({
                    word: this.normalizeHeadword(word),
                    results,
                    source: 'local_files',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in /api/test/parse/:word:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message 
                });
            }
        });

        // Get database statistics
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.getStats();
                res.json(stats);
            } catch (error) {
                console.error('Error in /api/stats:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: error.message 
                });
            }
        });

        // API documentation
        this.app.get('/api/docs', (req, res) => {
            res.json({
                title: 'Romanian Vocabulary API',
                version: '1.0.0',
                description: 'API for Romanian dictionary definitions with caching',
                endpoints: {
                    'GET /api/word/:word': {
                        description: 'Get word definition',
                        parameters: {
                            word: 'The word to look up',
                            source: 'Optional: "doom", "dexonline", or "mdex" to specify source',
                            refresh: 'Optional: "true" to force refresh from external sources'
                        },
                        example: '/api/word/casa?source=dexonline (or mdex or doom)'
                    },
                    'GET /api/search/:term': {
                        description: 'Search for words in the database',
                        parameters: {
                            term: 'Search term (minimum 2 characters)'
                        },
                        example: '/api/search/man'
                    },
                    'GET /api/test/parse/:word': {
                        description: 'Test parsing with local HTML files',
                        parameters: {
                            word: 'Word to test parsing for'
                        },
                        example: '/api/test/parse/casa'
                    },
                    'GET /api/stats': {
                        description: 'Get database statistics'
                    },
                    'GET /health': {
                        description: 'Health check endpoint'
                    }
                }
            });
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Romanian Vocabulary API',
                documentation: '/api/docs',
                health: '/health',
                version: '1.0.0'
            });
        });
    }

    // Strip HTML tags from a string
    stripTags(str) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/<[^>]*>/g, '');
    }

    // Normalize headword (remove trailing numerals/superscripts, lowercase)
    normalizeHeadword(word) {
        if (!word || typeof word !== 'string') return word;
        return this.stripTags(word)
            .replace(/\d+$/, '') // remove trailing index numbers (e.g., CASĂ1 -> CASĂ)
            .trim()
            .toLowerCase();
    }

    // Ensure each definition object has only clean, structured fields and no HTML
    sanitizeDefinition(def) {
        if (!def) return def;

        // If it's an old shape like { type, content, html, source, index }
        if (!def.definitions && typeof def.content === 'string') {
            const text = this.stripTags(def.content).replace(/\s+/g, ' ').trim();
            return {
                type: def.type || 'definition',
                word: this.normalizeHeadword(def.word || ''),
                wordType: def.wordType || '',
                gender: def.gender || '',
                grammaticalInfo: def.grammaticalInfo || {},
                definitions: text ? [text] : [],
                examples: def.examples || [],
                etymology: this.stripTags(def.etymology || ''),
                notes: Array.isArray(def.notes) ? def.notes : [],
                source: def.source,
                index: def.index
            };
        }

        // New shape: remove any raw or HTML fields if present
        const cleaned = {
            type: def.type || 'definition',
            word: this.normalizeHeadword(def.word || ''),
            wordType: def.wordType || '',
            gender: def.gender || '',
            grammaticalInfo: def.grammaticalInfo || {},
            definitions: Array.isArray(def.definitions) ? def.definitions.map(d => this.stripTags(String(d)).replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
            examples: Array.isArray(def.examples) ? def.examples.map(e => this.stripTags(String(e)).replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
            etymology: this.stripTags(def.etymology || '').replace(/\s+/g, ' ').trim(),
            notes: Array.isArray(def.notes) ? def.notes : [],
            source: def.source,
            index: def.index
        };

        return cleaned;
    }

    // Sanitize a result item (per-source) before returning via API
    sanitizeResultItem(item) {
        const out = {
            word: this.normalizeHeadword(item.word || ''),
            source: item.source,
            url: item.url,
            parsedAt: item.parsedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            error: item.error,
            cached: !!item.cached
        };

        const defs = Array.isArray(item.definitions) ? item.definitions : [];
        out.definitions = defs.map(this.sanitizeDefinition).filter(d => d && (d.definitions?.length || d.examples?.length));
        return out;
    }

    async getStats() {
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total_words FROM words',
                'SELECT source, COUNT(*) as count FROM words GROUP BY source',
                'SELECT DATE(created_at) as date, COUNT(*) as count FROM words GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7'
            ];

            const stats = {};
            let completed = 0;

            this.db.db.get(queries[0], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.totalWords = row.total_words;
                if (++completed === 3) resolve(stats);
            });

            this.db.db.all(queries[1], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.bySource = rows;
                if (++completed === 3) resolve(stats);
            });

            this.db.db.all(queries[2], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.recentActivity = rows;
                if (++completed === 3) resolve(stats);
            });
        });
    }

    async start() {
        try {
            await this.db.init();
            
            this.app.listen(this.port, () => {
                console.log(`🚀 Vocabulary API server running on port ${this.port}`);
                console.log(`📚 API Documentation: http://localhost:${this.port}/api/docs`);
                console.log(`🔍 Example: http://localhost:${this.port}/api/word/casa`);
                console.log(`📊 Statistics: http://localhost:${this.port}/api/stats`);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async stop() {
        this.db.close();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\\nReceived SIGINT, shutting down gracefully...');
    if (global.apiServer) {
        await global.apiServer.stop();
    }
    process.exit(0);
});

// Start the server if this file is run directly
if (require.main === module) {
    const apiServer = new VocabularyAPI();
    global.apiServer = apiServer;
    apiServer.start();
}

module.exports = VocabularyAPI;