import logger from './logger.js';

/**
 * Detect post owner from the post page
 */
export const detectPostOwner = async (page) => {
  try {
    logger.info('DETECTING POST OWNER...');

    // Wait for page to load completely
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Wait for content to appear
    try {
      await page.waitForSelector('h2, h3, [role="main"]', { timeout: 5000 });
    } catch (e) {
      logger.warn('Timeout waiting for main content');
    }

    // Method 1: Get H2 that looks like a name (filter out UI text)
    let ownerName = await page.evaluate(() => {
      const h2Elements = document.querySelectorAll('h2');
      const uiKeywords = ['ประวัติการแชท', 'ความคิดเห็น', 'ยังไม่มี', 'เมนู', 'Menu', 'Facebook', 
                          'Share', 'แชร์', 'Comments', 'Notifications', 'ทางลัด', 'จดจำรหัสผ่าน'];
      
      for (const h2 of h2Elements) {
        const text = h2.textContent.trim();
        if (!text || text.length < 3 || text.length > 100) continue;
        
        // Special case: "โพสต์ของ [Name]"
        if (text.startsWith('โพสต์ของ ')) {
          return text.replace('โพสต์ของ ', '').trim();
        }
        
        // Check if it's a UI keyword
        const isUIText = uiKeywords.some(keyword => text.includes(keyword));
        if (isUIText) continue;
        
        // Plain name (2-50 chars, not all caps)
        if (text.length >= 2 && text.length <= 50) {
          const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
          if (capsRatio < 0.8) { // Not all caps
            return text;
          }
        }
      }
      return null;
    });

    if (ownerName) {
      logger.info(`✓ POST OWNER DETECTED: ${ownerName}`);
      logger.info(`   (using H2 index method)`);
      return ownerName.trim();
    }

    // Method 2: Try selectors
    const selectors = [
      'h2 span',
      'h2 strong span',
      'h2 strong > span > a',
      'div[role="main"] h2 strong',
      'h2 a[role="link"] strong span',
      'article h2 strong span'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          if (text && text.trim() && !text.includes('ประวัติการแชท') && !text.includes('ความคิดเห็น')) {
            ownerName = text.trim();
            logger.info(`✓ POST OWNER DETECTED: ${ownerName}`);
            logger.info(`   (using selector: ${selector})`);
            return ownerName;
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    // Log all elements for debugging
    logger.info('DEBUG: Checking page structure...');
    const debugInfo = await page.evaluate(() => {
      return {
        strongCount: document.querySelectorAll('strong').length,
        h2Count: document.querySelectorAll('h2').length,
        h3Count: document.querySelectorAll('h3').length,
        firstH2Text: document.querySelector('h2')?.textContent?.trim()?.substring(0, 100) || 'none',
        firstH3Text: document.querySelector('h3')?.textContent?.trim()?.substring(0, 100) || 'none',
        allH2Texts: Array.from(document.querySelectorAll('h2')).slice(0, 5).map(h => h.textContent.trim().substring(0, 50)),
        spans: Array.from(document.querySelectorAll('h2 span, h3 span')).slice(0, 10).map(s => s.textContent.trim().substring(0, 50))
      };
    });
    logger.info(`  Strong: ${debugInfo.strongCount}, H2: ${debugInfo.h2Count}, H3: ${debugInfo.h3Count}`);
    logger.info(`  First H2: ${debugInfo.firstH2Text}`);
    logger.info(`  First H3: ${debugInfo.firstH3Text}`);
    if (debugInfo.allH2Texts.length > 0) {
      debugInfo.allH2Texts.forEach((text, i) => logger.info(`  H2[${i}]: ${text}`));
    }
    if (debugInfo.spans.length > 0) {
      debugInfo.spans.forEach((text, i) => logger.info(`  Span[${i}]: ${text}`));
    }

    // Alternative method: extract from meta tags or page content
    const ownerFromMeta = await page.evaluate(() => {
      const metaAuthor = document.querySelector('meta[property="article:author"]');
      if (metaAuthor) {
        return metaAuthor.getAttribute('content');
      }

      // Try to find in h2 or h3 tags (most common for post authors)
      const headers = Array.from(document.querySelectorAll('h2, h3'));
      for (const header of headers.slice(0, 5)) {
        const strongText = header.querySelector('strong')?.textContent?.trim();
        if (strongText && strongText.length > 2 && strongText.length < 100) {
          // Check if it looks like a name (contains space or is short)
          if (strongText.includes(' ') || strongText.length < 30) {
            return strongText;
          }
        }
      }

      // Try to find any strong tag that looks like a name in the first section
      const strongs = Array.from(document.querySelectorAll('strong'));
      for (const strong of strongs.slice(0, 15)) {
        const text = strong.textContent.trim();
        // Name should be 2-50 chars, not contain common UI words
        if (text.length > 2 && text.length < 50 && 
            !text.includes('Comment') && 
            !text.includes('Share') &&
            !text.includes('Like') &&
            !text.toLowerCase().includes('photo') &&
            !text.toLowerCase().includes('video')) {
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
 * Normalize name for comparison (remove spaces and special chars)
 */
export const normalizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9ก-๙]/gi, '')
    .trim();
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
