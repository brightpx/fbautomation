import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from '../src/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/bot.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
const initDatabase = () => {
  try {
    // Table for tracking processed comments
    db.exec(`
      CREATE TABLE IF NOT EXISTS processed_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id TEXT UNIQUE NOT NULL,
        comment_text TEXT,
        comment_author TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table for storing auto replies
    db.exec(`
      CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id TEXT NOT NULL,
        reply_id TEXT UNIQUE,
        reply_text TEXT NOT NULL,
        command_used TEXT,
        latency_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comment_id) REFERENCES processed_comments(comment_id)
      )
    `);

    // Table for bot settings and metadata
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_comment_id ON processed_comments(comment_id);
      CREATE INDEX IF NOT EXISTS idx_reply_id ON auto_replies(reply_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON auto_replies(created_at DESC);
    `);

    logger.info('DATABASE INITIALIZED');
  } catch (error) {
    logger.error(`Database initialization failed: ${error.message}`);
    throw error;
  }
};

// Check if comment was already processed
const isCommentProcessed = (commentId) => {
  const stmt = db.prepare('SELECT 1 FROM processed_comments WHERE comment_id = ?');
  return stmt.get(commentId) !== undefined;
};

// Mark comment as processed
const markCommentProcessed = (commentId, commentText, commentAuthor) => {
  const stmt = db.prepare(`
    INSERT INTO processed_comments (comment_id, comment_text, comment_author)
    VALUES (?, ?, ?)
  `);
  try {
    stmt.run(commentId, commentText, commentAuthor);
    return true;
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return false; // Already processed
    }
    throw error;
  }
};

// Save auto reply record
const saveAutoReply = (commentId, replyId, replyText, commandUsed, latencyMs) => {
  const stmt = db.prepare(`
    INSERT INTO auto_replies (comment_id, reply_id, reply_text, command_used, latency_ms)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(commentId, replyId, replyText, commandUsed, latencyMs);
};

// Get last reply
const getLastReply = () => {
  const stmt = db.prepare(`
    SELECT * FROM auto_replies
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return stmt.get();
};

// Get reply by ID
const getReplyById = (replyId) => {
  const stmt = db.prepare('SELECT * FROM auto_replies WHERE reply_id = ?');
  return stmt.get(replyId);
};

// Delete reply record
const deleteReplyRecord = (replyId) => {
  const stmt = db.prepare('DELETE FROM auto_replies WHERE reply_id = ?');
  const result = stmt.run(replyId);
  return result.changes > 0;
};

// Get or set setting
const getSetting = (key) => {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const result = stmt.get(key);
  return result ? result.value : null;
};

const setSetting = (key, value) => {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value, value);
};

// Get statistics
const getStatistics = () => {
  const totalReplies = db.prepare('SELECT COUNT(*) as count FROM auto_replies').get().count;
  const lastReply = getLastReply();
  const ownerName = getSetting('owner_name');
  const botStartTime = getSetting('bot_start_time');
  
  return {
    totalReplies,
    lastReply,
    ownerName,
    botStartTime
  };
};

// Initialize on import
initDatabase();

export default {
  db,
  isCommentProcessed,
  markCommentProcessed,
  saveAutoReply,
  getLastReply,
  getReplyById,
  deleteReplyRecord,
  getSetting,
  setSetting,
  getStatistics
};
