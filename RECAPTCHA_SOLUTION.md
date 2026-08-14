# แก้ปัญหา reCAPTCHA ตอน Login Facebook

## ปัญหา
- Facebook ขึ้น reCAPTCHA ตอน Login ด้วย Playwright
- reCAPTCHA ให้ทำไม่จบสิ้น (Infinite CAPTCHA Loop)

## ⭐ วิธีแก้ที่ดีที่สุด: ใช้ Chrome Profile

### วิธีที่ 1: Chrome Profile Login (แนะนำ - ไม่มี CAPTCHA เลย!)

ใช้ Chrome ที่คุณ Login Facebook ไว้แล้ว:

```bash
node src/app.js login --chrome-profile
```

**ขั้นตอน:**
1. **ปิด Chrome ทั้งหมด** - ต้องปิดให้หมดก่อน
2. รันคำสั่งด้านบน
3. ระบบจะเปิด Chrome ที่มี Facebook Login อยู่แล้ว
4. **ไม่มี reCAPTCHA!** ✅
5. Session จะถูกบันทึกทันที

**ข้อดี:**
- ✅ ไม่มี reCAPTCHA เลย
- ✅ ใช้ Cookie ที่มีอยู่แล้ว
- ✅ Login เสร็จภายใน 5 วินาที
- ✅ Facebook ไม่สงสัยเพราะใช้ Browser จริง

### วิธีที่ 2: Login ใน Chrome ธรรมดาก่อน แล้วค่อยใช้ Bot

1. **เปิด Chrome ปกติ** (ไม่ใช่ Playwright)
2. **Login Facebook** ให้เรียบร้อย
3. **ใช้งาน Facebook** สักพัก (scroll feed, like, comment)
4. **ปิด Chrome**
5. รัน:
   ```bash
   node src/app.js login --chrome-profile
   ```

### วิธีที่ 3: Login Playwright แบบปกติ (ถ้า CAPTCHA ไม่เยอะ)
```bash
node src/app.js login
```

**ขั้นตอน:**
1. Browser จะเปิดขึ้นมาแบบช้าๆ (slowMo: 50ms)
2. Login ด้วยตัวเอง
3. **ถ้าเจอ reCAPTCHA - ทำให้เสร็จ (ใช้เวลาได้)**
4. ถ้าเจอ 2FA/OTP - ทำให้เสร็จ
5. รอจนเห็น News Feed
6. กด Enter ใน Terminal

### 2. ใช้ Chrome Profile ที่ Login แล้ว (ทางเลือก)

#### A. หา Chrome Profile Path
```powershell
# Default Chrome Profile Location
C:\Users\YOUR_USERNAME\AppData\Local\Google\Chrome\User Data
```

#### B. Login Facebook ใน Chrome ปกติ
1. เปิด Chrome ปกติของคุณ
2. Login Facebook ให้เรียบร้อย
3. ปิด Chrome ทั้งหมด

#### C. แก้ browser.js ให้ใช้ Profile

เพิ่มตัวเลือกนี้ใน `src/browser.js`:

```javascript
export const launchBrowserWithProfile = async (profilePath) => {
  browser = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });
  
  const pages = browser.pages();
  return { browser, context: browser, page: pages[0] };
};
```

### 3. Tips สำหรับหลีกเลี่ยง reCAPTCHA

#### ใช้ Account ที่มีประวัติดี
- Account ที่ใช้งานมานาน
- มี Friends, Posts, Activity
- ไม่เคยโดน Block/Ban

#### Login ในเวลาปกติ
- อย่า Login กลางดึก
- Login จาก IP เดิมที่เคยใช้

#### Human-like Behavior
- ระบบได้เพิ่ม `slowMo: 50` แล้ว
- Browser เคลื่อนไหวช้าลงเหมือนคนจริง

#### Warm-up Account
1. Login ด้วยตัวเอง 2-3 ครั้ง
2. ใช้งาน Facebook ปกติสักพัก
3. ค่อยใช้ Bot

### 4. ถ้ายังเจอ reCAPTCHA บ่อย

#### ใช้ 2Captcha/Anti-Captcha Service (ไม่แนะนำ)
ต้องติดตั้ง service เสริมและเสียเงิน

#### ใช้ Undetected Playwright
```bash
npm install playwright-extra playwright-stealth
```

แล้วแก้ import ใน browser.js:
```javascript
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());
```

### 5. Best Practice ที่แนะนำ ⭐

**ใช้วิธี Manual Login ที่ปรับปรุงแล้ว:**
1. Login ช้าๆ ด้วยตัวเอง
2. ทำ reCAPTCHA อย่างระมัดระวัง
3. กด Enter เมื่อเห็น News Feed แน่นอน
4. Session จะถูกบันทึกใช้งานต่อได้นาน

**Session จะอยู่ได้หลายวัน ไม่ต้อง Login บ่อย!**

## การอัปเดตที่ทำไปแล้ว

### ✅ login.js
- เพิ่ม instruction สำหรับ reCAPTCHA
- เพิ่มเวลารอหลังกด Enter
- เพิ่มการเช็ค checkpoint page
- แสดง URL ปัจจุบันถ้า login ไม่สำเร็จ

### ✅ browser.js (อัปเดตล่าสุด)
- เพิ่ม `slowMo: 50` เมื่อ non-headless
- เพิ่ม `--disable-infobars`
- ตั้ง window size เป็น 1920x1080
- **แก้ปัญหารูปภาพ reCAPTCHA ไม่แสดง:**
  - อนุญาตให้โหลดรูปภาพเมื่อ Login (non-headless)
  - อนุญาตทุก request ที่มี `recaptcha` หรือ `google.com/recaptcha`
  - บล็อกรูปภาพเฉพาะตอน Run Bot (headless mode)

## ทดสอบอีกครั้ง

```bash
node src/app.js login
```

ทำตาม instruction ใหม่ที่แสดงในหน้าจอ
