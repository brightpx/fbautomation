import { chromium } from 'playwright';
import logger from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join(__dirname, '../storageState.json');

/**
 * Login using existing Chrome profile (bypass reCAPTCHA)
 */
export const performChromeProfileLogin = async () => {
  logger.info('='.repeat(50));
  logger.info('CHROME PROFILE LOGIN MODE');
  logger.info('='.repeat(50));
  logger.info('');
  logger.info('This method uses your existing Chrome profile');
  logger.info('where you are already logged into Facebook.');
  logger.info('');

  // Detect Chrome profile path
  const defaultProfilePaths = [
    path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data'),
    path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  ];

  let chromeProfilePath = null;
  for (const profilePath of defaultProfilePaths) {
    if (fs.existsSync(profilePath)) {
      chromeProfilePath = profilePath;
      break;
    }
  }

  if (!chromeProfilePath) {
    logger.error('✗ Chrome profile not found');
    logger.info('');
    logger.info('Please install Google Chrome or specify custom path');
    return false;
  }

  logger.info(`Chrome Profile: ${chromeProfilePath}`);
  logger.info('');
  logger.info('📌 BEFORE RUNNING THIS:');
  logger.info('   1. Close ALL Chrome windows completely');
  logger.info('   2. Make sure Chrome is not running in background');
  logger.info('   3. Press ENTER to continue...');
  logger.info('');

  // Wait for user confirmation
  await waitForEnter();

  let context = null;
  try {
    logger.info('LAUNCHING CHROME WITH YOUR PROFILE...');
    
    // Create temporary profile directory to avoid conflicts
    const tempProfileDir = path.join(__dirname, '../.chrome-temp-profile');
    if (!fs.existsSync(tempProfileDir)) {
      fs.mkdirSync(tempProfileDir, { recursive: true });
    }
    
    // Launch persistent context with temporary profile
    // This avoids conflicts with running Chrome instances
    context = await chromium.launchPersistentContext(tempProfileDir, {
      headless: false,
      channel: 'chrome', // Use installed Chrome
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check'
      ],
      viewport: { width: 1920, height: 1080 },
      timeout: 60000 // Reduce timeout to 60 seconds
    });

    logger.info('✓ CHROME LAUNCHED WITH YOUR PROFILE');
    logger.info('');

    // Get first page or create new one
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    // Navigate to Facebook
    logger.info('NAVIGATING TO FACEBOOK...');
    await page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Check if we need to login
    logger.info('');
    logger.info('📋 INSTRUCTIONS:');
    logger.info('   1. If Chrome shows login page → Login to Facebook');
    logger.info('   2. If already logged in → Wait for News Feed');
    logger.info('   3. After seeing News Feed → Come back here');
    logger.info('');
    logger.info('🔔 IMPORTANT: Click on this terminal window first!');
    logger.info('   Then press ENTER to save session...');
    logger.info('');
    
    // Always wait for user confirmation
    await waitForEnter();
    
    // Verify user is logged in before saving
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('facebook.com') && 
                       !currentUrl.includes('login') && 
                       !currentUrl.includes('checkpoint');
    
    if (!isLoggedIn) {
      logger.error('✗ Still not logged in!');
      logger.error(`  Current URL: ${currentUrl}`);
      return false;
    }
    
    logger.info('✓ Saving session...');
    await page.waitForTimeout(2000);
    
    // Save storage state
    await context.storageState({ path: STORAGE_STATE_PATH });
    
    logger.info(`✓ SESSION SAVED: ${STORAGE_STATE_PATH}`);
    logger.info('✓ LOGIN COMPLETE!');
    logger.info('');
    logger.info('💡 You can now run: node src/app.js run');
    
    return true;

  } catch (error) {
    logger.error(`CHROME PROFILE LOGIN ERROR: ${error.message}`);
    return false;
  } finally {
    if (context) {
      await context.close();
    }
  }
};

/**
 * Wait for user to press Enter
 */
const waitForEnter = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Press ENTER to continue... ', () => {
      rl.close();
      resolve();
    });
  });
};

export default {
  performChromeProfileLogin
};
