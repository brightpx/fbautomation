import logger from './logger.js';
import { launchBrowser, getPage, closeBrowser } from './browser.js';
import { detectPostOwner, isCommentFromOwner } from './ownerDetector.js';
import { extractComments } from './commentService.js';
import { processCommand } from './commandProcessor.js';
import { sendReplyWithRetry } from './replyService.js';
import database from '../database/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join(__dirname, '../storageState.json');

let isMonitoring = false;
let monitoringInterval = null;

/**
 * Start monitoring comments
 */
export const startMonitoring = async (config) => {
  logger.info('='.repeat(50));
  logger.info('BOT STARTED');
  logger.info('='.repeat(50));

  // Check if storage state exists
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    logger.error('✗ SESSION NOT FOUND');
    logger.error('  Please run: node src/app.js login');
    return false;
  }

  // Validate config
  if (!config.postUrl) {
    logger.error('✗ POST URL NOT CONFIGURED');
    logger.error('  Please set postUrl in config.json');
    return false;
  }

  logger.info(`Post URL: ${config.postUrl}`);
  logger.info(`Scan Interval: ${config.scanIntervalMs}ms`);
  logger.info(`Reply Delay: ${config.replyDelayMs}ms`);
  logger.info(`Headless: ${config.headless}`);
  logger.info('');

  // Save bot start time
  database.setSetting('bot_start_time', new Date().toISOString());

  try {
    // Launch browser with saved session
    await launchBrowser(config.headless, STORAGE_STATE_PATH);
    const page = await getPage();

    // Navigate to post
    logger.info('LOADING POST...');
    await page.goto(config.postUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Detect post owner
    const ownerName = await detectPostOwner(page);
    if (ownerName) {
      database.setSetting('owner_name', ownerName);
      logger.info(`✓ MONITORING COMMENTS FROM: ${ownerName}`);
    } else {
      logger.warn('⚠ OWNER NOT DETECTED - Monitoring all comments');
    }

    logger.info('');
    logger.info('✓ BOT IS NOW RUNNING');
    logger.info('  Waiting for new comments...');
    logger.info('');

    // Start monitoring loop
    isMonitoring = true;
    await monitorLoop(page, config, ownerName);

  } catch (error) {
    logger.error(`MONITORING ERROR: ${error.message}`);
    await stopMonitoring();
    return false;
  }
};

/**
 * Main monitoring loop
 */
const monitorLoop = async (page, config, ownerName) => {
  let lastCommentCount = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  while (isMonitoring) {
    try {
      // Check if page is still loaded
      if (page.isClosed()) {
        logger.error('✗ PAGE CLOSED - Restarting...');
        break;
      }

      // Extract all comments
      const comments = await extractComments(page);

      // Check for new comments
      if (comments.length > lastCommentCount) {
        const newComments = comments.slice(lastCommentCount);
        
        for (const comment of newComments) {
          await processComment(page, comment, config, ownerName);
        }
        
        lastCommentCount = comments.length;
      }

      // Reset error counter on success
      consecutiveErrors = 0;

      // Wait before next scan
      await page.waitForTimeout(config.scanIntervalMs);

    } catch (error) {
      consecutiveErrors++;
      logger.error(`MONITOR LOOP ERROR (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error.message}`);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error('✗ TOO MANY CONSECUTIVE ERRORS - Stopping bot');
        break;
      }

      // Exponential backoff
      const backoffDelay = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
      await page.waitForTimeout(backoffDelay);
    }
  }

  await stopMonitoring();
};

/**
 * Process a single comment
 */
const processComment = async (page, comment, config, ownerName) => {
  try {
    // Check if already processed
    if (database.isCommentProcessed(comment.id)) {
      return;
    }

    // Check if comment is from owner
    if (!isCommentFromOwner(comment.author, ownerName)) {
      // Mark as processed but don't reply
      database.markCommentProcessed(comment.id, comment.text, comment.author);
      return;
    }

    // Log owner comment
    logger.info('─'.repeat(50));
    logger.info('OWNER COMMENT');
    logger.info(`Owner: ${comment.author}`);
    logger.info(`CommentId: ${comment.id}`);
    logger.info(`Text: ${comment.text}`);

    // Mark as processed immediately to prevent duplicates
    database.markCommentProcessed(comment.id, comment.text, comment.author);

    // Process command
    const { reply, command } = processCommand(
      comment.text,
      config.commands,
      config.defaultReply
    );

    if (command) {
      logger.info(`Command: ${command}`);
    }

    logger.info(`Reply: ${reply}`);

    // Send reply
    const result = await sendReplyWithRetry(
      page,
      comment.author,
      comment.text,
      reply,
      config.replyDelayMs,
      3 // max retries
    );

    if (result.success) {
      // Save to database
      database.saveAutoReply(
        comment.id,
        result.replyId,
        reply,
        command,
        result.latency
      );

      logger.info('');
    } else {
      logger.error('✗ FAILED TO SEND REPLY');
      logger.info('');
    }

  } catch (error) {
    logger.error(`PROCESS COMMENT ERROR: ${error.message}`);
  }
};

/**
 * Stop monitoring
 */
export const stopMonitoring = async () => {
  if (!isMonitoring) return;

  isMonitoring = false;
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  await closeBrowser();
  logger.info('');
  logger.info('BOT STOPPED');
};

/**
 * Handle graceful shutdown
 */
export const setupGracefulShutdown = () => {
  const shutdown = async (signal) => {
    logger.info('');
    logger.info(`Received ${signal} - Shutting down gracefully...`);
    await stopMonitoring();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

export default {
  startMonitoring,
  stopMonitoring,
  setupGracefulShutdown
};
