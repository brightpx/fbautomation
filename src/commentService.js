import logger from './logger.js';

/**
 * Extract comments from the page
 */
export const extractComments = async (page) => {
  try {
    const comments = await page.evaluate(() => {
      const commentElements = [];
      
      // Multiple selectors for different Facebook layouts
      const selectors = [
        'div[role="article"]',
        'div[aria-label*="comment"]',
        'div[data-visualcompletion="ignore-dynamic"]',
        'ul[role="list"] > li',
        'div.x1r8uery div.x1lliihq'
      ];

      const foundElements = new Set();

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Skip if already found
          if (foundElements.has(el)) return;
          
          // Try to extract comment data
          const commentData = extractCommentData(el);
          if (commentData) {
            foundElements.add(el);
            commentElements.push(commentData);
          }
        });
      }

      function extractCommentData(element) {
        try {
          // Find author name
          const authorElement = element.querySelector('a[role="link"] span, a strong, h3 span, h4 span');
          const author = authorElement ? authorElement.textContent.trim() : null;

          if (!author) return null;

          // Find comment text
          let text = '';
          const textElements = element.querySelectorAll('div[dir="auto"]');
          for (const textEl of textElements) {
            const content = textEl.textContent.trim();
            if (content && content.length > 0 && !content.includes('Like') && !content.includes('Reply')) {
              text = content;
              break;
            }
          }

          if (!text) return null;

          // Generate comment ID from content hash
          const commentId = generateCommentId(author, text, element);

          // Find reply button
          const replyButton = element.querySelector('div[role="button"][aria-label*="Reply"], a[aria-label*="Reply"]');

          return {
            id: commentId,
            author,
            text,
            element: element.outerHTML.substring(0, 200), // For debugging
            hasReplyButton: !!replyButton,
            timestamp: Date.now()
          };
        } catch (e) {
          return null;
        }
      }

      function generateCommentId(author, text, element) {
        // Use stable ID based on author + text content only (no timestamp)
        // This prevents treating the same comment as multiple "new" comments
        const str = `${author}:${text}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return `comment_${Math.abs(hash)}`;
      }

      return commentElements;
    });

    return comments.filter(c => c !== null);
  } catch (error) {
    logger.error(`Extract comments error: ${error.message}`);
    return [];
  }
};

/**
 * Get reply button for a specific comment
 */
export const getCommentReplyButton = async (page, commentAuthor, commentText) => {
  try {
    // Find and click reply button directly in browser context (better for hidden elements)
    const result = await page.evaluate(({ author, text }) => {
      const allElements = document.querySelectorAll('div[role="article"]');
      
      console.log(`[DEBUG] Searching for comment by "${author}" with text "${text}"`);
      console.log(`[DEBUG] Found ${allElements.length} article elements`);
      
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        const authorEl = element.querySelector('a[role="link"] span, a strong, h3 span, h4 span');
        const authorName = authorEl ? authorEl.textContent.trim() : '';
        
        if (authorName !== author) continue;

        // Check if text matches
        const textElements = element.querySelectorAll('div[dir="auto"]');
        for (const textEl of textElements) {
          if (textEl.textContent.trim() === text) {
            console.log(`[DEBUG] Found matching comment at index ${i}!`);
            console.log(`[DEBUG] Comment element HTML:`, element.outerHTML.substring(0, 300));
            
            // Try CSS selector-based search first
            const cssSelectors = [
              'div[role="button"][aria-label*="Reply"]',
              'div[role="button"][aria-label*="ตอบกลับ"]',
              'a[aria-label*="Reply"]',
              'a[aria-label*="ตอบกลับ"]'
            ];
            
            for (const selector of cssSelectors) {
              const replyBtn = element.querySelector(selector);
              if (replyBtn) {
                console.log(`[DEBUG] Found reply button with selector: ${selector}`);
                // Click directly in browser context
                replyBtn.click();
                return { success: true, method: selector };
              }
            }
            
            // Fallback: Search by text content
            const allButtons = element.querySelectorAll('div[role="button"], span[role="button"]');
            console.log(`[DEBUG] Searching ${allButtons.length} buttons by text content...`);
            
            for (const btn of allButtons) {
              const btnText = btn.textContent.trim().toLowerCase();
              if (btnText === 'reply' || btnText === 'ตอบกลับ' || btnText.includes('reply') || btnText.includes('ตอบกลับ')) {
                console.log(`[DEBUG] Found reply button by text: "${btnText}"`);
                btn.click();
                return { success: true, method: 'text-match' };
              }
            }
            
            // If still not found, log all buttons
            const allClickable = element.querySelectorAll('div[role="button"], a[role="link"], span[role="button"]');
            console.log(`[DEBUG] Could not find reply button. Found ${allClickable.length} clickable elements:`);
            allClickable.forEach((btn, i) => {
              const label = btn.getAttribute('aria-label') || btn.textContent.trim().substring(0, 50);
              console.log(`  [${i}] role="${btn.getAttribute('role')}" text="${label}"`);
            });
            
            return { success: false, error: 'button_not_found' };
          }
        }
      }
      
      console.log(`[DEBUG] Comment not found in DOM`);
      return { success: false, error: 'comment_not_found' };
    }, { author: commentAuthor, text: commentText });

    return result;
  } catch (error) {
    logger.error(`Get reply button error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Monitor comments using MutationObserver
 */
export const setupCommentMonitor = async (page, callback) => {
  await page.evaluate((callbackName) => {
    if (window.commentObserver) {
      window.commentObserver.disconnect();
    }

    window.commentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          window.postMessage({ type: 'NEW_COMMENT_DETECTED' }, '*');
          break;
        }
      }
    });

    // Observe the main content area
    const targetNode = document.body;
    if (targetNode) {
      window.commentObserver.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  });

  // Listen for mutation events
  page.on('console', msg => {
    if (msg.text().includes('NEW_COMMENT_DETECTED')) {
      callback();
    }
  });

  logger.info('✓ MUTATION OBSERVER ACTIVATED');
};

export default {
  extractComments,
  getCommentReplyButton,
  setupCommentMonitor
};
