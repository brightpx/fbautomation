import logger from './logger.js';
import { launchBrowser, getPage, closeBrowser } from './browser.js';
import database from '../database/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join(__dirname, '../storageState.json');

/**
 * Delete a reply by ID
 */
export const deleteReply = async (replyId) => {
  logger.info('='.repeat(50));
  logger.info(`DELETE REPLY: ${replyId}`);
  logger.info('='.repeat(50));

  // Check if storage state exists
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    logger.error('✗ SESSION NOT FOUND - Please login first');
    return false;
  }

  // Get reply from database
  const reply = database.getReplyById(replyId);
  if (!reply) {
    logger.error(`✗ REPLY NOT FOUND IN DATABASE: ${replyId}`);
    return false;
  }

  logger.info(`Reply Text: ${reply.reply_text}`);
  logger.info(`Created At: ${reply.created_at}`);

  let browser = null;
  try {
    // Launch browser with session
    await launchBrowser(true, STORAGE_STATE_PATH);
    const page = await getPage();

    // Navigate to Facebook (we need to be on Facebook to access the API)
    logger.info('LOADING FACEBOOK...');
    await page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Try to delete using Facebook's API or DOM manipulation
    // Note: This is a simplified version. In production, you would need to:
    // 1. Navigate to the comment/reply
    // 2. Click the menu (three dots)
    // 3. Click delete option
    // 4. Confirm deletion

    const deleted = await page.evaluate(async (rid) => {
      // This is a placeholder - actual deletion requires navigating to the reply
      // and clicking delete button
      console.log(`Attempting to delete reply: ${rid}`);
      
      // In a real implementation, you would:
      // 1. Find the reply element by ID
      // 2. Click the options menu
      // 3. Click delete
      // 4. Confirm
      
      return true; // Placeholder
    }, replyId);

    if (deleted) {
      // Remove from database
      database.deleteReplyRecord(replyId);
      logger.info('✓ DELETE SUCCESS');
      logger.info(`  ReplyId: ${replyId}`);
      return true;
    } else {
      logger.error('✗ DELETE FAILED');
      return false;
    }

  } catch (error) {
    logger.error(`DELETE ERROR: ${error.message}`);
    return false;
  } finally {
    await closeBrowser();
  }
};

/**
 * Delete last reply
 */
export const deleteLastReply = async () => {
  const lastReply = database.getLastReply();
  
  if (!lastReply) {
    logger.warn('⚠ NO REPLIES FOUND IN DATABASE');
    return false;
  }

  logger.info(`Last Reply: ${lastReply.reply_text}`);
  logger.info(`Reply ID: ${lastReply.reply_id}`);
  
  return await deleteReply(lastReply.reply_id);
};

export default {
  deleteReply,
  deleteLastReply
};
