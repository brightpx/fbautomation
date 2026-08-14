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

    // Find the comment and its reply button
    const replyButton = await getCommentReplyButton(page, commentAuthor, commentText);
    
    if (!replyButton) {
      logger.error('✗ REPLY BUTTON NOT FOUND');
      return { success: false, replyId: null, latency: 0 };
    }

    // Click reply button
    await replyButton.asElement().click();
    await page.waitForTimeout(500);

    // Find the reply input field that appears after clicking Reply
    const replyInput = await page.locator('[contenteditable="true"][role="textbox"]').last();
    
    if (!await replyInput.isVisible({ timeout: 3000 })) {
      logger.error('✗ REPLY INPUT NOT FOUND');
      return { success: false, replyId: null, latency: 0 };
    }

    // Type the reply
    await replyInput.fill(replyText);
    await page.waitForTimeout(300);

    // Press Enter to submit
    await replyInput.press('Enter');
    await page.waitForTimeout(1000);

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
