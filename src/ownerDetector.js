import logger from './logger.js';

/**
 * Detect post owner from the post page
 */
export const detectPostOwner = async (page) => {
  try {
    logger.info('DETECTING POST OWNER...');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Try multiple selectors to find post author
    const selectors = [
      // New Facebook layout
      'h2 a[role="link"] strong',
      'h3 a[role="link"] strong',
      'a[role="link"] > span > strong',
      'a[aria-label*="Profile"] strong',
      // Old layouts
      'h2 > span > span > a',
      'h3 > span > span > a',
      'strong > span > a',
      // Fallback
      '[data-ad-preview="message"] strong',
      'div[data-ad-comet-preview="message"] strong'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          const ownerName = await element.innerText();
          if (ownerName && ownerName.trim().length > 0) {
            logger.info(`✓ POST OWNER DETECTED: ${ownerName}`);
            return ownerName.trim();
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    // Alternative method: extract from meta tags or page content
    const ownerFromMeta = await page.evaluate(() => {
      const metaAuthor = document.querySelector('meta[property="article:author"]');
      if (metaAuthor) {
        return metaAuthor.getAttribute('content');
      }

      // Try to find any strong tag that looks like a name in the first section
      const strongs = Array.from(document.querySelectorAll('strong'));
      for (const strong of strongs.slice(0, 10)) {
        const text = strong.textContent.trim();
        if (text.length > 2 && text.length < 100 && !text.includes('Comment') && !text.includes('Share')) {
          return text;
        }
      }

      return null;
    });

    if (ownerFromMeta) {
      logger.info(`✓ POST OWNER DETECTED (fallback): ${ownerFromMeta}`);
      return ownerFromMeta;
    }

    logger.warn('⚠ Could not detect post owner - will check all comments');
    return null;

  } catch (error) {
    logger.error(`Owner detection error: ${error.message}`);
    return null;
  }
};

/**
 * Normalize name for comparison
 */
export const normalizeName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Check if comment author matches owner
 */
export const isCommentFromOwner = (commentAuthor, ownerName) => {
  if (!ownerName) return true; // If owner not detected, process all comments
  if (!commentAuthor) return false;

  const normalizedComment = normalizeName(commentAuthor);
  const normalizedOwner = normalizeName(ownerName);

  return normalizedComment === normalizedOwner || 
         normalizedComment.includes(normalizedOwner) ||
         normalizedOwner.includes(normalizedComment);
};

export default {
  detectPostOwner,
  normalizeName,
  isCommentFromOwner
};
