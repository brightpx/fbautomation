import logger from './logger.js';

/**
 * Extract comments from the page
 */
export const extractComments = async (page) => {
  try {
    // STEP 1: Switch to "Most Recent" sorting (critical for chronological order)
    await switchToMostRecentSorting(page);
    
    // STEP 2: Click "View more comments" buttons to expand hidden comments
    await expandViewMoreComments(page);
    
    // STEP 3: Scroll to absolute bottom to trigger lazy loading of all comments
    await scrollToBottomCompletely(page);
    
    // STEP 4: Expand nested replies (optional, but good for completeness)
    await expandAllReplies(page);
    
    // STEP 5: Extract all top-level comments with timestamps
    const comments = await page.evaluate(() => {
      const commentElements = [];
      
      // Get all articles
      const articles = Array.from(document.querySelectorAll('div[role="article"]'));
      
      console.log(`[DEBUG] Total articles found: ${articles.length}`);
      
      // Filter for TOP-LEVEL comments only (not nested replies, not the main post)
      const topLevelComments = articles.filter(article => {
        // Skip if this article is nested inside another article (it's a reply)
        const hasParentArticle = article.parentElement?.closest('div[role="article"]');
        return !hasParentArticle;
      });
      
      console.log(`[DEBUG] Top-level articles (post + comments): ${topLevelComments.length}`);
      
      // Skip the first element (main post) and take only comments
      const commentsOnly = topLevelComments.slice(1);
      
      console.log(`[DEBUG] Comments only (excluding post): ${commentsOnly.length}`);
      
      // EXTRACT ALL COMMENTS (not just last 5) - we'll sort by timestamp later
      const allComments = commentsOnly;
      // EXTRACT ALL COMMENTS (not just last 5) - we'll sort by timestamp later
      const allComments = commentsOnly;
      
      console.log(`[DEBUG] Processing ${allComments.length} comments for extraction`);
      
      allComments.forEach((el, idx) => {
        const commentData = extractCommentData(el, idx);
        if (commentData) {
          commentElements.push(commentData);
        }
      });
      
      console.log(`[DEBUG] Successfully extracted ${commentElements.length} comments with data`);
      
      // Sort by timestamp (newest first) - Facebook timestamp is in data attribute or text
      commentElements.sort((a, b) => b.timestamp - a.timestamp);
      
      // NOW take only the latest 5 AFTER sorting
      const latest5 = commentElements.slice(0, 5);
      
      console.log(`[DEBUG] ===== FINAL 5 NEWEST COMMENTS =====`);
      latest5.forEach((c, idx) => {
        const timeAgo = c.timeAgoText || 'unknown time';
        console.log(`[DEBUG] ${idx + 1}. ${c.author} (${timeAgo}): ${c.text.substring(0, 40)}...`);
      });
      
      return latest5;

      function extractCommentData(element, index) {
        try {
          // Find author name - use multiple selectors for robustness
          let author = null;
          const authorSelectors = [
            'a[role="link"] span',
            'a[role="link"] strong',
            'h3 span',
            'h4 span',
            'a strong span',
            'span[dir="auto"] span',
            'div[dir="auto"] > span > span > strong',
            'a[aria-label] strong',
            'strong[class*="x"]'  // Facebook dynamic classes
          ];
          
          for (const selector of authorSelectors) {
            const authorElement = element.querySelector(selector);
            if (authorElement) {
              const authorText = authorElement.textContent.trim();
              // Filter out UI keywords
              if (authorText && 
                  authorText.length > 0 && 
                  !authorText.includes('Like') && 
                  !authorText.includes('Reply') &&
                  !authorText.includes('ถูกใจ') &&
                  !authorText.includes('ตอบกลับ') &&
                  !authorText.includes('Comment') &&
                  !authorText.includes('Share')) {
                author = authorText;
                break;
              }
            }
          }

          if (!author) {
            // Log for debugging
            console.log(`[DEBUG] Comment #${index}: No author found, skipping`);
            return null;
          }

          // Find comment text - improved extraction
          let text = '';
          const textSelectors = [
            'div[dir="auto"]',
            'span[dir="auto"]',
            'div[data-ad-comet-preview="message"]',
            'div[data-ad-preview="message"]'
          ];
          
          for (const selector of textSelectors) {
            const textElements = element.querySelectorAll(selector);
            for (const textEl of textElements) {
              const content = textEl.textContent.trim();
              // Must be actual comment text (not UI labels)
              if (content && 
                  content.length > 0 && 
                  !content.includes('Like') && 
                  !content.includes('Reply') &&
                  !content.includes('ถูกใจ') &&
                  !content.includes('ตอบกลับ') &&
                  content !== author &&  // Not just the author name
                  content.length > 2) {  // At least 3 characters
                text = content;
                break;
              }
            }
            if (text) break;
          }

          if (!text) {
            console.log(`[DEBUG] Comment #${index}: Author="${author}" but no text found, skipping`);
            return null;
          }

          // CRITICAL: Extract timestamp from Facebook's time element
          let timestamp = Date.now(); // Fallback to current time
          let timeAgoText = 'unknown';
          
          const timeSelectors = [
            'a[href*="comment_id"] abbr',
            'abbr[data-utime]',
            'span[data-utime]',
            'a abbr',
            'abbr'
          ];
          
          for (const selector of timeSelectors) {
            const timeEl = element.querySelector(selector);
            if (timeEl) {
              // Try data-utime attribute (Unix timestamp)
              const utime = timeEl.getAttribute('data-utime');
              if (utime) {
                timestamp = parseInt(utime) * 1000; // Convert to milliseconds
                timeAgoText = timeEl.textContent.trim();
                break;
              }
              // Fallback: use text content like "2m", "5h", "1d"
              const timeText = timeEl.textContent.trim();
              if (timeText) {
                timeAgoText = timeText;
                timestamp = parseRelativeTime(timeText);
                break;
              }
            }
          }
          
          console.log(`[DEBUG] Comment #${index}: Author="${author}" Time="${timeAgoText}" Text="${text.substring(0, 30)}..."`);

          // Generate comment ID from content hash
          const commentId = generateCommentId(author, text, element);

          // Find reply button
          const replyButton = element.querySelector('div[role="button"][aria-label*="Reply"], a[aria-label*="Reply"], div[role="button"][aria-label*="ตอบกลับ"]');

          // Check if comment has image - use multiple robust selectors
          const imageSelectors = [
            'img[src*="scontent"]',
            'img[src*="fbcdn"]',
            'a[href*="photo"]',
            'img[data-visualcompletion="media-vc-image"]',
            'div[data-visualcompletion="media-vc-image"]',
            'a[href*="/photo.php"]',
            'a[href*="/photos/"]',
            'img[class*="x"][src^="https://"]'  // Facebook uses dynamic classes starting with x
          ];
          
          let hasImage = false;
          for (const selector of imageSelectors) {
            if (element.querySelector(selector)) {
              hasImage = true;
              break;
            }
          }

          return {
            id: commentId,
            author,
            text,
            timestamp,  // Unix timestamp in milliseconds
            timeAgoText,  // Human-readable like "2m ago"
            element: element.outerHTML.substring(0, 200), // For debugging
            hasReplyButton: !!replyButton,
            hasImage: hasImage
          };
        } catch (e) {
          console.log(`[DEBUG] Comment #${index}: Extraction error: ${e.message}`);
          return null;
        }
      }
      
      // Parse relative time text like "2m", "5h", "1d" into Unix timestamp
      function parseRelativeTime(timeText) {
        const now = Date.now();
        const text = timeText.toLowerCase();
        
        // Match patterns: "2m", "5h", "1d", "2 hrs", "3 days", etc.
        const match = text.match(/(\d+)\s*(s|m|h|d|w|sec|min|hr|hour|day|week)/i);
        if (!match) return now; // If can't parse, assume current time
        
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        let milliseconds = 0;
        if (unit.startsWith('s')) milliseconds = value * 1000;
        else if (unit.startsWith('m')) milliseconds = value * 60 * 1000;
        else if (unit.startsWith('h')) milliseconds = value * 60 * 60 * 1000;
        else if (unit.startsWith('d')) milliseconds = value * 24 * 60 * 60 * 1000;
        else if (unit.startsWith('w')) milliseconds = value * 7 * 24 * 60 * 60 * 1000;
        
        return now - milliseconds;
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

    const filtered = comments.filter(c => c !== null);
    
    if (filtered.length === 0) {
      logger.warn('⚠️ No comments extracted - possible DOM structure change or page not loaded');
      return [];
    }
    
    logger.info(`📊 Extracted ${filtered.length} newest comments (out of all available, returning top 5)`);
    
    // Log the 5 latest comments for debugging
    if (filtered.length > 0) {
      logger.info('📋 🆕 NEWEST 5 COMMENTS (timestamp-sorted):');
      filtered.forEach((c, i) => {
        const preview = c.text.substring(0, 50);
        const imageIcon = c.hasImage ? '🖼️' : '📝';
        const timeInfo = c.timeAgoText || 'unknown time';
        logger.info(`   ${i+1}. ${imageIcon} [${timeInfo}] ${c.author}: ${preview}${c.text.length > 50 ? '...' : ''}`);
      });
    }
    
    return filtered;
  } catch (error) {
    logger.error(`Extract comments error: ${error.message}`);
    return [];
  }
};

/**
 * Switch to "Most Recent" comment sorting (critical for chronological order)
 */
async function switchToMostRecentSorting(page) {
  try {
    logger.info('🔄 Attempting to switch to "Most Recent" sorting...');
    
    const switched = await page.evaluate(() => {
      // Find sorting dropdown/button - Facebook uses various patterns
      const sortingSelectors = [
        'div[role="button"]:has-text("Most relevant")',
        'div[role="button"]:has-text("Top comments")',
        'span:has-text("Most relevant")',
        'span:has-text("Top comments")',
        '[aria-label*="sort"]',
        '[aria-label*="Sort"]'
      ];
      
      // Try to find and click the sorting button
      for (const selector of sortingSelectors) {
        try {
          const buttons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('most relevant') || 
                text.includes('top comment') || 
                text.includes('เกี่ยวข้องมากที่สุด') ||
                text.includes('ความคิดเห็นยอดนิยม')) {
              console.log('[DEBUG] Found sorting button, clicking...');
              btn.click();
              return { foundButton: true };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return { foundButton: false };
    });
    
    if (switched.foundButton) {
      // Wait for dropdown to appear
      await page.waitForTimeout(800);
      
      // Click "Most Recent" option
      const clicked = await page.evaluate(() => {
        const allClickable = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="option"], span[role="menuitem"]'));
        
        for (const item of allClickable) {
          const text = item.textContent.toLowerCase();
          if (text.includes('most recent') || 
              text.includes('newest') || 
              text.includes('ล่าสุด') ||
              text.includes('ใหม่ที่สุด')) {
            console.log('[DEBUG] Found "Most Recent" option, clicking...');
            item.click();
            return true;
          }
        }
        return false;
      });
      
      if (clicked) {
        logger.info('✅ Switched to "Most Recent" sorting');
        await page.waitForTimeout(1500); // Wait for re-sort
        return true;
      } else {
        logger.info('⚠️ Sorting button found but "Most Recent" option not found - page may already be sorted');
      }
    } else {
      logger.info('⚠️ Sorting button not found - page may already be sorted by Most Recent');
    }
    
    return false;
  } catch (error) {
    logger.warn(`⚠️ Could not switch sorting: ${error.message}`);
    return false;
  }
}

/**
 * Click "View more comments" buttons to expand hidden comments
 */
async function expandViewMoreComments(page) {
  try {
    logger.info('🔽 Expanding "View more comments" buttons...');
    
    const expandedCount = await page.evaluate(() => {
      const allClickable = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
      
      let clicked = 0;
      allClickable.forEach(btn => {
        try {
          const text = btn.textContent.toLowerCase();
          
          // Match patterns for "View more comments" or "View previous comments"
          if (text.includes('view more comment') ||
              text.includes('view previous comment') ||
              text.includes('view') && text.includes('comment') ||
              text.includes('ดูความคิดเห็น') ||
              text.includes('แสดงความคิดเห็น')) {
            console.log(`[DEBUG] Clicking: "${btn.textContent.trim()}"`);
            btn.click();
            clicked++;
          }
        } catch (e) {
          // Ignore
        }
      });
      
      return clicked;
    });
    
    if (expandedCount > 0) {
      logger.info(`✅ Clicked ${expandedCount} "View more" buttons`);
      await page.waitForTimeout(2000); // Wait for comments to load
    } else {
      logger.info('ℹ️ No "View more comments" buttons found');
    }
    
    return expandedCount;
  } catch (error) {
    logger.warn(`⚠️ Error expanding comments: ${error.message}`);
    return 0;
  }
}

/**
 * Scroll to absolute bottom to trigger lazy loading of ALL comments
 */
async function scrollToBottomCompletely(page) {
  try {
    logger.info('📜 Scrolling to bottom to load all comments...');
    
    const result = await page.evaluate(async () => {
      let lastHeight = 0;
      let currentHeight = document.body.scrollHeight;
      let iterations = 0;
      const maxIterations = 15; // Prevent infinite loop
      
      while (iterations < maxIterations) {
        // Scroll to absolute bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 800));
        
        lastHeight = currentHeight;
        currentHeight = document.body.scrollHeight;
        
        iterations++;
        
        console.log(`[DEBUG] Scroll iteration ${iterations}: height ${lastHeight} -> ${currentHeight}`);
        
        // Stop if no new content loaded
        if (currentHeight === lastHeight) {
          console.log('[DEBUG] Reached bottom (no height change)');
          break;
        }
      }
      
      return { iterations, finalHeight: currentHeight };
    });
    
    logger.info(`✅ Scrolled ${result.iterations} times to bottom (final height: ${result.finalHeight}px)`);
    await page.waitForTimeout(1000); // Final wait for any lazy-loaded content
    
    return result;
  } catch (error) {
    logger.warn(`⚠️ Scroll error: ${error.message}`);
    return { iterations: 0, finalHeight: 0 };
  }
}

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

/**
 * Expand all nested replies
 */
async function expandAllReplies(page) {
  try {
    const expandedCount = await page.evaluate(() => {
      // Find all buttons/links that might show replies
      const allClickable = Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"]'));
      
      let clicked = 0;
      allClickable.forEach(btn => {
        try {
          const text = btn.textContent.trim();
          const ariaLabel = btn.getAttribute('aria-label') || '';
          
          // Match patterns for "View replies" buttons
          if (
            text.includes('ดูคำตอบ') ||
            text.includes('คำตอบ') ||
            text.match(/^\d+\s*คำตอบ/i) ||
            text.match(/view.*repl/i) ||
            text.match(/^\d+\s*repl/i) ||
            ariaLabel.includes('repl') ||
            ariaLabel.includes('คำตอบ')
          ) {
            btn.click();
            clicked++;
          }
        } catch (e) {
          // Ignore click errors
        }
      });
      
      return clicked;
    });
    
    if (expandedCount > 0) {
      logger.info(`🔽 Expanded ${expandedCount} nested replies`);
      // Wait for replies to load
      await page.waitForTimeout(1500);
    } else {
      logger.info(`🔽 No nested replies found to expand`);
    }
  } catch (error) {
    logger.error(`Expand replies error: ${error.message}`);
  }
}

/**
 * Scroll down to load more comments
 */
async function scrollToLoadComments(page) {
  try {
    await page.evaluate(async () => {
      // Scroll to bottom of comments section
      const commentsSection = document.querySelector('div[role="main"]') || document.body;
      const initialHeight = commentsSection.scrollHeight;
      
      // Increased scroll iterations to reach deeper comments (11+ comments deep)
      for (let i = 0; i < 10; i++) {
        commentsSection.scrollTop = commentsSection.scrollHeight;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const finalHeight = commentsSection.scrollHeight;
      return { initialHeight, finalHeight };
    });
    
    logger.info(`📜 Scrolled deeper to load more comments (10 iterations)`);
  } catch (error) {
    logger.error(`Scroll error: ${error.message}`);
  }
}

export default {
  extractComments,
  getCommentReplyButton,
  setupCommentMonitor
};
