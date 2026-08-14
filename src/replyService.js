import logger from './logger.js';
import { getCommentReplyButton } from './commentService.js';

/**
 * Send reply to a comment
 */
export const sendReply = async (page, commentAuthor, commentText, replyText, replyDelayMs = 0) => {
  const startTime = Date.now();
  
  try {
    // Apply delay if specified
    if (replyDelayMs > 0) {
      await page.waitForTimeout(replyDelayMs);
    }

    // Listen to console messages from the browser
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DEBUG]')) {
        logger.info(text);
      }
    });

    // Count textboxes BEFORE clicking reply button
    const textboxCountBefore = await page.evaluate(() => {
      const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
      console.log(`[DEBUG] Textboxes BEFORE clicking reply: ${boxes.length}`);
      return boxes.length;
    });

    // Find and click the reply button (now clicks directly in browser context)
    const result = await getCommentReplyButton(page, commentAuthor, commentText);
    
    if (!result || !result.success) {
      logger.error('✗ REPLY BUTTON NOT FOUND OR CLICK FAILED');
      return { success: false, replyId: null, latency: 0 };
    }

    logger.info(`✓ REPLY BUTTON CLICKED (${result.method})`);
    
    // Wait for Facebook to show the NEW reply input
    await page.waitForTimeout(3000);

    // Count textboxes AFTER clicking reply button
    const textboxCountAfter = await page.evaluate(() => {
      const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
      console.log(`[DEBUG] Textboxes AFTER clicking reply: ${boxes.length}`);
      return boxes.length;
    });
    
    logger.info(`[DEBUG] Textboxes: before=${textboxCountBefore}, after=${textboxCountAfter}`);

    // NEW STRATEGY: Use Playwright API to type text (not evaluate())
    // Find textbox with aria-label containing "ตอบกลับ" using Playwright locator
    try {
      // Try to find reply textbox by aria-label
      const replyTextbox = page.locator('[contenteditable="true"][role="textbox"]').filter({ 
        has: page.locator('text=/ตอบกลับ|reply/i') 
      }).or(
        page.locator('[contenteditable="true"][role="textbox"][aria-label*="ตอบกลับ"]')
      ).or(
        page.locator('[contenteditable="true"][role="textbox"][aria-label*="Reply"]')
      ).first();
      
      // Check if it exists and is visible
      const isVisible = await replyTextbox.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (!isVisible) {
        logger.error('✗ REPLY TEXTBOX NOT VISIBLE');
        return { success: false, replyId: null, latency: 0 };
      }
      
      logger.info('[DEBUG] Found reply textbox with Playwright locator');
      
      // Click to focus
      await replyTextbox.click();
      logger.info('[DEBUG] Textbox clicked and focused');
      
      // Type the reply text using Playwright (this properly simulates real typing)
      await replyTextbox.fill(replyText);
      logger.info(`[DEBUG] Text filled using Playwright.fill(): "${replyText}"`);
      
      // Verify the text was filled
      const filledText = await replyTextbox.textContent();
      logger.info(`[DEBUG] Verification - textContent after fill: "${filledText}"`);
      
      logger.info('✓ REPLY TEXT FILLED (playwright-locator-fill)');
      
      // Submit using Enter key
      await replyTextbox.press('Enter');
      logger.info('[DEBUG] Enter key pressed using Playwright.press()');
      
    } catch (error) {
      logger.error(`✗ PLAYWRIGHT LOCATOR FAILED: ${error.message}`);
      return { success: false, replyId: null, latency: 0 };
    }
    
    await page.waitForTimeout(1000);
    
    // Check if reply actually appeared on the page
    const replyVerification = await page.evaluate(({ replyText }) => {
      const allText = document.body.innerText;
      const replyAppeared = allText.includes(replyText);
      console.log(`[DEBUG] Verification: Reply text "${replyText}" appears on page: ${replyAppeared}`);
      
      // Count comments after submission
      const commentElements = document.querySelectorAll('[role="article"]');
      console.log(`[DEBUG] Total article elements after submission: ${commentElements.length}`);
      
      return { replyAppeared, articleCount: commentElements.length };
    }, { replyText });
    
    logger.info(`[DEBUG] Reply verification: appeared=${replyVerification.replyAppeared}, articles=${replyVerification.articleCount}`);

    const latency = Date.now() - startTime;

    // Generate reply ID (in production, this should be extracted from DOM)
    const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`✓ REPLY SENT`);
    logger.info(`  ReplyId: ${replyId}`);
    logger.info(`  Latency: ${latency}ms`);

    return { 
      success: true, 
      replyId, 
      latency 
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error(`✗ REPLY FAILED: ${error.message}`);
    return { 
      success: false, 
      replyId: null, 
      latency 
    };
  }
};

/**
 * Send reply with retry logic
 */
export const sendReplyWithRetry = async (page, commentAuthor, commentText, replyText, replyDelayMs = 0, maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendReply(page, commentAuthor, commentText, replyText, replyDelayMs);
      
      if (result.success) {
        return result;
      }
      
      lastError = new Error('Reply failed');
      
      if (attempt < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.warn(`Retry attempt ${attempt}/${maxRetries} in ${backoffDelay}ms...`);
        await page.waitForTimeout(backoffDelay);
      }
      
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.warn(`Retry attempt ${attempt}/${maxRetries} after error: ${error.message}`);
        await page.waitForTimeout(backoffDelay);
      }
    }
  }
  
  logger.error(`✗ ALL RETRY ATTEMPTS FAILED: ${lastError.message}`);
  return { 
    success: false, 
    replyId: null, 
    latency: 0 
  };
};

export default {
  sendReply,
  sendReplyWithRetry
};
