import { chromium } from 'playwright';
import logger from './logger.js';

let browser = null;
let context = null;

/**
 * Launch browser with optimized settings
 */
export const launchBrowser = async (headless = true, storageStatePath = null) => {
  try {
    logger.info(`LAUNCHING BROWSER (headless: ${headless})`);
    
    browser = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--window-size=1920,1080'
      ],
      // Slow down actions to appear more human-like during login
      slowMo: headless ? 0 : 50
    });

    const contextOptions = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'th-TH',
      timezoneId: 'Asia/Bangkok'
    };

    // Load storage state if exists
    if (storageStatePath) {
      contextOptions.storageState = storageStatePath;
    }

    context = await browser.newContext(contextOptions);

    // Optimize performance - block unnecessary resources
    // BUT allow images during login (for reCAPTCHA)
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      
      // Allow reCAPTCHA images
      if (url.includes('recaptcha') || url.includes('google.com/recaptcha')) {
        return route.continue();
      }
      
      // During login (non-headless), allow images for reCAPTCHA
      if (!headless && resourceType === 'image') {
        return route.continue();
      }
      
      // Block images, fonts, media ONLY in headless mode
      if (headless && ['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
        return route.abort();
      }
      
      // Block fonts and stylesheets in non-headless (but keep images)
      if (!headless && ['font', 'stylesheet'].includes(resourceType)) {
        return route.abort();
      }
      
      // Block tracking and ads
      if (url.includes('analytics') || 
          url.includes('tracking') || 
          url.includes('doubleclick') ||
          url.includes('googleadservices')) {
        return route.abort();
      }
      
      return route.continue();
    });

    logger.info('BROWSER LAUNCHED SUCCESSFULLY');
    return { browser, context };
  } catch (error) {
    logger.error(`Failed to launch browser: ${error.message}`);
    throw error;
  }
};

/**
 * Get or create page
 */
export const getPage = async () => {
  if (!context) {
    throw new Error('Browser context not initialized');
  }

  const pages = context.pages();
  if (pages.length > 0) {
    return pages[0];
  }

  return await context.newPage();
};

/**
 * Close browser
 */
export const closeBrowser = async () => {
  try {
    if (context) {
      await context.close();
      context = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
    logger.info('BROWSER CLOSED');
  } catch (error) {
    logger.error(`Failed to close browser: ${error.message}`);
  }
};

/**
 * Get browser and context instances
 */
export const getBrowser = () => browser;
export const getContext = () => context;

/**
 * Save storage state
 */
export const saveStorageState = async (path) => {
  if (!context) {
    throw new Error('Browser context not initialized');
  }
  await context.storageState({ path });
  logger.info(`STORAGE STATE SAVED: ${path}`);
};

export default {
  launchBrowser,
  getPage,
  closeBrowser,
  getBrowser,
  getContext,
  saveStorageState
};
