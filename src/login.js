import readline from 'readline';
import { launchBrowser, getPage, closeBrowser, saveStorageState } from './browser.js';
import logger from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join(__dirname, '../storageState.json');

/**
 * Interactive login process
 */
export const performLogin = async () => {
  logger.info('='.repeat(50));
  logger.info('FACEBOOK LOGIN MODE');
  logger.info('='.repeat(50));

  let browser = null;
  try {
    // Launch browser in non-headless mode
    const browserData = await launchBrowser(false, null);
    browser = browserData.browser;

    const page = await getPage();

    // Navigate to Facebook
    logger.info('NAVIGATING TO FACEBOOK...');
    await page.goto('https://www.facebook.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });

    logger.info('');
    logger.info('📌 INSTRUCTIONS:');
    logger.info('   1. Login to your Facebook account');
    logger.info('   2. Complete 2FA if prompted');
    logger.info('   3. Wait until you see your News Feed');
    logger.info('   4. Press ENTER in this terminal when ready');
    logger.info('');

    // Wait for user to press Enter
    await waitForEnter();

    // Check if login was successful
    const currentUrl = page.url();
    if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
      logger.info('✓ LOGIN DETECTED');
      
      // Save storage state
      await saveStorageState(STORAGE_STATE_PATH);
      logger.info(`✓ SESSION SAVED: ${STORAGE_STATE_PATH}`);
      logger.info('✓ LOGIN COMPLETE');
      
      return true;
    } else {
      logger.error('✗ LOGIN FAILED - Still on login page');
      return false;
    }

  } catch (error) {
    logger.error(`LOGIN ERROR: ${error.message}`);
    return false;
  } finally {
    if (browser) {
      await closeBrowser();
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

    rl.question('Press ENTER when login is complete... ', () => {
      rl.close();
      resolve();
    });
  });
};

export default {
  performLogin
};
