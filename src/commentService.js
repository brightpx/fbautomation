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
        // Try to find actual Facebook comment ID
        const possibleId = element.getAttribute('data-commentid') || 
                          element.getAttribute('id') ||
                          element.querySelector('[data-commentid]')?.getAttribute('data-commentid');
        
        if (possibleId && possibleId.length > 5) {
          return possibleId;
        }

        // Generate hash-based ID
        const str = `${author}:${text}:${Date.now()}`;
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
    // Find the comment element by matching author and text
    const replyButton = await page.evaluateHandle(({ author, text }) => {
      const allElements = document.querySelectorAll('div[role="article"]');
      
      for (const element of allElements) {
        const authorEl = element.querySelector('a[role="link"] span, a strong, h3 span');
        const authorName = authorEl ? authorEl.textContent.trim() : '';
        
        if (authorName !== author) continue;

        // Check if text matches
        const textElements = element.querySelectorAll('div[dir="auto"]');
        for (const textEl of textElements) {
          if (textEl.textContent.trim() === text) {
            // Found the right comment, now find reply button
            const replyBtn = element.querySelector('div[role="button"][aria-label*="Reply"], a[aria-label*="Reply"]');
            return replyBtn;
          }
        }
      }
      
      return null;
    }, { author: commentAuthor, text: commentText });

    return replyButton;
  } catch (error) {
    logger.error(`Get reply button error: ${error.message}`);
    return null;
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
