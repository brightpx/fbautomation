import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { performLogin } from './login.js';
import { startMonitoring, setupGracefulShutdown } from './monitor.js';
import { deleteReply, deleteLastReply } from './deleteReply.js';
import database from '../database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Load config
const configPath = path.join(__dirname, '../config.json');
let config = {};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  logger.error('✗ config.json not found');
  process.exit(1);
}

// Create CLI
const program = new Command();

program
  .name('facebook-auto-reply-bot')
  .description('Production-ready Facebook Group Auto Reply Bot')
  .version('1.0.0');

/**
 * Login command
 */
program
  .command('login')
  .description('Login to Facebook and save session')
  .action(async () => {
    try {
      const success = await performLogin();
      if (success) {
        logger.info('');
        logger.info('✓ You can now run: node src/app.js run');
        process.exit(0);
      } else {
        logger.error('✗ Login failed');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Run command - Start monitoring
 */
program
  .command('run')
  .description('Start monitoring and auto-reply bot')
  .action(async () => {
    try {
      setupGracefulShutdown();
      await startMonitoring(config);
    } catch (error) {
      logger.error(`Run error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Delete command - Delete specific reply
 */
program
  .command('delete <replyId>')
  .description('Delete a specific reply by ID')
  .action(async (replyId) => {
    try {
      const success = await deleteReply(replyId);
      process.exit(success ? 0 : 1);
    } catch (error) {
      logger.error(`Delete error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Delete-last command - Delete last reply
 */
program
  .command('delete-last')
  .description('Delete the last reply sent by the bot')
  .action(async () => {
    try {
      const success = await deleteLastReply();
      process.exit(success ? 0 : 1);
    } catch (error) {
      logger.error(`Delete-last error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Status command - Show bot statistics
 */
program
  .command('status')
  .description('Show bot status and statistics')
  .action(async () => {
    try {
      logger.info('='.repeat(50));
      logger.info('BOT STATUS');
      logger.info('='.repeat(50));

      const stats = database.getStatistics();

      // Owner name
      if (stats.ownerName) {
        logger.info(`Owner Name: ${stats.ownerName}`);
      } else {
        logger.info('Owner Name: Not detected yet');
      }

      // Total replies
      logger.info(`Total Replies: ${stats.totalReplies}`);

      // Last reply
      if (stats.lastReply) {
        logger.info(`Last Reply Time: ${stats.lastReply.created_at}`);
        logger.info(`Last Reply Text: ${stats.lastReply.reply_text}`);
        logger.info(`Last Reply ID: ${stats.lastReply.reply_id}`);
      } else {
        logger.info('Last Reply: None');
      }

      // Bot uptime
      if (stats.botStartTime) {
        const startTime = new Date(stats.botStartTime);
        const uptime = Date.now() - startTime.getTime();
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        logger.info(`Bot Start Time: ${stats.botStartTime}`);
        logger.info(`Uptime: ${hours}h ${minutes}m`);
      }

      // Session status
      const storageStatePath = path.join(__dirname, '../storageState.json');
      if (fs.existsSync(storageStatePath)) {
        logger.info('Session Status: ✓ Active');
      } else {
        logger.info('Session Status: ✗ Not logged in');
      }

      // Config
      logger.info('');
      logger.info('CONFIGURATION');
      logger.info(`Post URL: ${config.postUrl || 'Not configured'}`);
      logger.info(`Scan Interval: ${config.scanIntervalMs}ms`);
      logger.info(`Reply Delay: ${config.replyDelayMs}ms`);
      logger.info(`Headless Mode: ${config.headless}`);
      logger.info(`Commands: ${Object.keys(config.commands || {}).length}`);

      logger.info('='.repeat(50));
      process.exit(0);
    } catch (error) {
      logger.error(`Status error: ${error.message}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
