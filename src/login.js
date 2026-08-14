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

    // Wait a bit for page to stabilize
    await page.waitForTimeout(3000);

    logger.info('');
    logger.info('📌 INSTRUCTIONS:');
    logger.info('   1. Login to your Facebook account');
    logger.info('   2. Complete reCAPTCHA if prompted (take your time)');
    logger.info('   3. Complete 2FA/OTP if prompted');
    logger.info('   4. Wait until you see your News Feed');
    logger.info('   5. Press ENTER in this terminal when ready');
    logger.info('');
    logger.info('💡 TIP: If you get reCAPTCHA, solve it slowly and carefully');
    logger.info('💡 TIP: Don\'t rush - Facebook detects automated behavior');
    logger.info('');

    // Wait for user to press Enter
    await waitForEnter();

    // Give user more time after pressing enter
    await page.waitForTimeout(2000);

    // Check if login was successful
    const currentUrl = page.url();
    
    // More flexible URL checking
    const isLoggedIn = currentUrl.includes('facebook.com') && 
                       !currentUrl.includes('login') && 
                       !currentUrl.includes('checkpoint') &&
                       !currentUrl.includes('recover');

    if (isLoggedIn) {
      logger.info('✓ LOGIN DETECTED');
      
      // Save storage state
      await saveStorageState(STORAGE_STATE_PATH);
      logger.info(`✓ SESSION SAVED: ${STORAGE_STATE_PATH}`);
      logger.info('✓ LOGIN COMPLETE');
      logger.info('');
      logger.info('💡 Your session will be reused for future runs');
      
      return true;
    } else {
      logger.error('✗ LOGIN FAILED - Still on login/checkpoint page');
      logger.error(`Current URL: ${currentUrl}`);
      logger.info('');
      logger.info('💡 Please try again and make sure you:');
      logger.info('   - Completed reCAPTCHA successfully');
      logger.info('   - Passed all security checks');
      logger.info('   - Can see your News Feed before pressing Enter');
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
