const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, 'vocabulary.db');
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    word TEXT NOT NULL,
                    source TEXT NOT NULL,
                    definitions TEXT,
                    raw_html TEXT,
                    search_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(word, source)
                );
                
                CREATE INDEX IF NOT EXISTS idx_word ON words(word);
                CREATE INDEX IF NOT EXISTS idx_source ON words(source);
                CREATE INDEX IF NOT EXISTS idx_word_source ON words(word, source);
            `;

            this.db.exec(createTableSQL, (err) => {
                if (err) {
                    console.error('Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    async getWord(word, source = null) {
        return new Promise((resolve, reject) => {
            let query, params;
            
            if (source) {
                query = 'SELECT * FROM words WHERE word = ? AND source = ?';
                params = [word, source];
            } else {
                query = 'SELECT * FROM words WHERE word = ?';
                params = [word];
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async saveWord(word, source, definitions, rawHtml, searchUrl) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO words (word, source, definitions, raw_html, search_url, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(query, [word, source, JSON.stringify(definitions), rawHtml, searchUrl], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async searchWords(searchTerm) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT word, source, definitions, created_at, updated_at 
                FROM words 
                WHERE word LIKE ? 
                ORDER BY word, source
            `;
            
            this.db.all(query, [`%${searchTerm}%`], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse definitions JSON for each row
                    const results = rows.map(row => ({
                        ...row,
                        definitions: JSON.parse(row.definitions || '[]')
                    }));
                    resolve(results);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;