# Testing Plan for Comment Extraction Fix

## 🎯 Goal
Verify that the bot now extracts the **actual newest 5 comments** instead of the same 5 comments forever.

---

## ✅ Pre-Test Checklist

1. Backup current `commentService.js` (optional)
2. Ensure the updated `commentService.js` is in place
3. Have a Facebook post URL ready with 20+ comments
4. Open browser console to see debug logs

---

## 🧪 Test Cases

### Test 1: Basic Extraction
**Steps:**
1. Run the bot on a post with 20+ comments
2. Check logs for extraction flow

**Expected Output:**
```
🔄 Attempting to switch to "Most Recent" sorting...
✅ Switched to "Most Recent" sorting

🔽 Expanding "View more comments" buttons...
✅ Clicked X "View more" buttons (or ℹ️ No buttons found)

📜 Scrolling to bottom to load all comments...
[DEBUG] Scroll iteration 1: height X -> Y
[DEBUG] Reached bottom (no height change)
✅ Scrolled X times to bottom

[DEBUG] Total articles found: 30+
[DEBUG] Top-level articles: 25+
[DEBUG] Comments only: 24+
[DEBUG] Processing 24 comments for extraction

[DEBUG] ===== FINAL 5 NEWEST COMMENTS =====
[DEBUG] 1. [Name] (2m): [text]...
[DEBUG] 2. [Name] (5m): [text]...
[DEBUG] 3. [Name] (8m): [text]...
[DEBUG] 4. [Name] (12m): [text]...
[DEBUG] 5. [Name] (15m): [text]...

📊 Extracted 5 newest comments
📋 🆕 NEWEST 5 COMMENTS (timestamp-sorted):
   1. 📝 [2m] Gam: ...
   2. 📝 [5m] ซาริโอ้แท้: ...
```

**Success Criteria:**
✅ Sees 20+ total articles
✅ Extracts 15+ comments
✅ Returns exactly 5 comments
✅ Comments are sorted by time (newest first)
✅ Shows different names than before (Gam, ซาริโอ้แท้, etc.)

---

### Test 2: New Comment Detection
**Steps:**
1. Run the bot and note the 5 returned comments
2. Manually post a new comment on the Facebook post
3. Wait 30 seconds for next scan
4. Check if bot detects the new comment

**Expected Output:**
```
[First scan]
📋 🆕 NEWEST 5 COMMENTS:
   1. 📝 [2m] Gam: ...
   2. 📝 [5m] Person2: ...
   3. 📝 [8m] Person3: ...
   4. 📝 [12m] Person4: ...
   5. 📝 [15m] Person5: ...

[After posting new comment]
📋 🆕 NEWEST 5 COMMENTS:
   1. 📝 [0m] YourTestComment: ... ← NEW!
   2. 📝 [2m] Gam: ...
   3. 📝 [5m] Person2: ...
   4. 📝 [8m] Person3: ...
   5. 📝 [12m] Person4: ...
```

**Success Criteria:**
✅ New comment appears at position #1
✅ Old comments shift down
✅ Oldest comment (Person5) drops out of top 5
✅ Bot correctly identifies it as "new" (not already replied to)

---

### Test 3: "Most Recent" Sorting
**Steps:**
1. Manually switch post to "Top Comments" sorting
2. Run the bot
3. Check logs to see if bot switches to "Most Recent"

**Expected Output:**
```
🔄 Attempting to switch to "Most Recent" sorting...
[DEBUG] Found sorting button, clicking...
[DEBUG] Found "Most Recent" option, clicking...
✅ Switched to "Most Recent" sorting
```

**Success Criteria:**
✅ Bot detects "Top Comments" button
✅ Bot clicks it and selects "Most Recent"
✅ Comments are now in chronological order

---

### Test 4: Hidden Comments Expansion
**Steps:**
1. Find a post with "View X more comments" button
2. Run the bot
3. Check if bot clicks expansion buttons

**Expected Output:**
```
🔽 Expanding "View more comments" buttons...
[DEBUG] Clicking: "View 10 more comments"
[DEBUG] Clicking: "View previous comments"
✅ Clicked 2 "View more" buttons

[DEBUG] Comments only: 35 (increased from 15)
```

**Success Criteria:**
✅ Bot finds and clicks expansion buttons
✅ More comments appear in extraction
✅ Hidden comments now included in top 5 selection

---

### Test 5: Timestamp Sorting Validation
**Steps:**
1. Run the bot
2. Look at the 5 returned comments
3. Verify timestamps are in descending order

**Expected Output:**
```
[DEBUG] Comment #0: Time="2m"
[DEBUG] Comment #1: Time="5m"
[DEBUG] Comment #2: Time="8m"
[DEBUG] Comment #3: Time="12m"
[DEBUG] Comment #4: Time="15m"

📋 🆕 NEWEST 5 COMMENTS:
   1. [2m] ...
   2. [5m] ...
   3. [8m] ...
   4. [12m] ...
   5. [15m] ...
```

**Success Criteria:**
✅ Time values decrease: 2m → 5m → 8m → 12m → 15m
✅ Newest (smallest time) is first
✅ Oldest (largest time) is last

---

### Test 6: Scroll to Bottom
**Steps:**
1. Find a post with 30+ comments
2. Run the bot
3. Check scroll iterations in logs

**Expected Output:**
```
📜 Scrolling to bottom to load all comments...
[DEBUG] Scroll iteration 1: height 3000 -> 4500
[DEBUG] Scroll iteration 2: height 4500 -> 6000
[DEBUG] Scroll iteration 3: height 6000 -> 7200
[DEBUG] Scroll iteration 4: height 7200 -> 7200
[DEBUG] Reached bottom (no height change)
✅ Scrolled 4 times to bottom (final height: 7200px)

[DEBUG] Total articles found: 35
```

**Success Criteria:**
✅ Multiple scroll iterations (2-10)
✅ Height increases each iteration
✅ Stops when height no longer changes
✅ Extracts 20-30+ comments (more than before)

---

### Test 7: Compare Before/After
**Steps:**
1. Note the 5 comments bot was seeing before fix (e.g., หนูใหม่, Siluck, etc.)
2. Run the updated bot
3. Compare the returned comments

**Before (WRONG):**
```
1. หนูใหม่
2. Siluck
3. Nantana
4. Sofeeyah
5. Aum Ami
← Same 5 every scan
```

**After (CORRECT):**
```
1. Gam (2m ago)
2. ซาริโอ้แท้ (5m ago)
3. ไฉไล สยาม (8m ago)
4. แจกคนมียอด 18-24 (12m ago)
5. Nantana (15m ago)
← Actually newest 5
```

**Success Criteria:**
✅ Different names appear
✅ Comments have recent timestamps (minutes, not hours/days)
✅ Bot now sees "Gam" and other newer comments
✅ Comments change when new ones arrive

---

## 🐛 Troubleshooting

### Issue 1: Bot still sees same 5 comments
**Possible causes:**
- Sorting button not clicked
- Scroll didn't reach bottom
- Timestamps not extracted

**Debug steps:**
1. Check logs for "✅ Switched to 'Most Recent' sorting"
2. Check logs for scroll iterations (should be 3-10)
3. Check logs for timestamp values in comments
4. Manually verify Facebook is showing "Most Recent" (not "Top Comments")

---

### Issue 2: No comments extracted
**Possible causes:**
- DOM structure changed
- Selectors broken

**Debug steps:**
1. Check logs for "[DEBUG] Total articles found: X"
2. If X = 0, Facebook changed the DOM structure
3. Open browser console and run:
   ```javascript
   document.querySelectorAll('div[role="article"]').length
   ```
4. If returns 0, Facebook changed article selector

---

### Issue 3: Sorting button not found
**Expected log:**
```
⚠️ Sorting button not found - page may already be sorted by Most Recent
```

**This is OK if:**
- Facebook already shows "Most Recent" by default
- Bot still extracts newest comments correctly

**This is BAD if:**
- Facebook shows "Top Comments"
- Bot extracts old popular comments

---

### Issue 4: Timestamps all the same
**Possible causes:**
- Timestamp selector broken
- Facebook removed `data-utime` attribute

**Debug steps:**
1. Check logs for "Time=\"unknown\"" in comment extraction
2. Open browser console and run:
   ```javascript
   document.querySelector('abbr[data-utime]')
   ```
3. If returns null, Facebook changed timestamp structure
4. Fallback: use relative time text parsing (already implemented)

---

## 📊 Success Metrics

| Metric | Before | Target | Pass/Fail |
|--------|--------|--------|-----------|
| Comments extracted | 5 | 20-30+ | |
| Newest comment age | Hours/days | Minutes | |
| Variety in results | Same 5 forever | Different each scan | |
| New comment detection | No | Yes | |
| Scroll iterations | 1 | 3-10 | |
| Sorting switched | No | Yes | |

---

## 🎉 Expected Results Summary

After implementing this fix, the bot should:

1. ✅ Extract 20-30+ total comments (not just 5)
2. ✅ Return the actual newest 5 comments by timestamp
3. ✅ See different comments when new ones arrive
4. ✅ Detect "Gam", "ซาริโอ้แท้", and other recent commenters
5. ✅ Switch to "Most Recent" sorting automatically
6. ✅ Scroll to bottom to load all comments
7. ✅ Expand hidden comments behind "View more" buttons
8. ✅ Sort by real timestamps, not DOM order
9. ✅ Show timestamp info in logs (2m, 5m, 8m, etc.)
10. ✅ Update when newer comments arrive (not stuck on same 5)

---

## 🚀 Next Steps After Testing

1. If all tests pass → Deploy to production
2. If some tests fail → Check troubleshooting section
3. Monitor logs for 24 hours to ensure stability
4. Verify bot replies to newest comments correctly
5. Check that old comments don't get re-processed

---

## 📝 Test Log Template

Copy this template to record test results:

```
=== Test Date: [DATE] ===

Test 1: Basic Extraction
Status: [ ] Pass [ ] Fail
Notes: 

Test 2: New Comment Detection
Status: [ ] Pass [ ] Fail
Notes: 

Test 3: "Most Recent" Sorting
Status: [ ] Pass [ ] Fail
Notes: 

Test 4: Hidden Comments Expansion
Status: [ ] Pass [ ] Fail
Notes: 

Test 5: Timestamp Sorting Validation
Status: [ ] Pass [ ] Fail
Notes: 

Test 6: Scroll to Bottom
Status: [ ] Pass [ ] Fail
Notes: 

Test 7: Compare Before/After
Status: [ ] Pass [ ] Fail
Notes: 

Overall Result: [ ] All Pass [ ] Some Fail
Production Deploy: [ ] Yes [ ] No [ ] Pending
```
