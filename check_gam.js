import Database from 'better-sqlite3';

const db = new Database('./data/bot.db');

// Find Gam's comments
const gamComments = db.prepare(`SELECT * FROM processed_comments WHERE comment_author LIKE '%Gam%' ORDER BY processed_at DESC`).all();

console.log(`Gam comments in database: ${gamComments.length}\n`);
gamComments.forEach(c => {
  console.log(`${c.processed_at} | ${c.comment_author}`);
  console.log(`  Text: ${c.comment_text.substring(0, 80)}`);
  console.log('');
});

db.close();
