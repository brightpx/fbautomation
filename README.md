# Facebook Auto Reply Bot

Production-ready Facebook Group Auto Reply Bot ที่ใช้ Node.js, Playwright และ SQLite สำหรับตอบคอมเมนต์อัตโนมัติใน Facebook Group

## ✨ Features

- ✅ Monitor Facebook Post ภายใน Group (Public & Private)
- ✅ Login ครั้งเดียว แล้วเก็บ Session ใช้งานต่อได้
- ✅ ทำงานแบบ Headless
- ✅ ตรวจจับคอมเมนต์ใหม่แบบ Real-time (Latency ต่ำ)
- ✅ ตรวจจับเจ้าของโพสต์อัตโนมัติ
- ✅ ตอบกลับเฉพาะคอมเมนต์จากเจ้าของโพสต์
- ✅ รองรับ Command-based Reply
- ✅ ป้องกันการตอบซ้ำ (Duplicate Protection)
- ✅ บันทึก Log และ Database
- ✅ ลบ Reply ที่ระบบเคยส่ง
- ✅ แสดงสถิติและสถานะของ Bot
- ✅ รองรับการทำงานบน VPS Linux 24/7

## 📋 Requirements

- Node.js >= 18.0.0
- npm หรือ yarn
- Facebook Account

## 🚀 Installation

### 1. Clone และติดตั้ง Dependencies

```bash
cd fbautomation
npm install
```

### 2. ติดตั้ง Playwright Browsers

```bash
npx playwright install chromium
```

### 3. สร้างไฟล์ Environment Variables (Optional)

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ตามต้องการ (ไม่จำเป็นต้องใส่ Email/Password)

### 4. แก้ไขไฟล์ Config

แก้ไข `config.json`:

```json
{
  "postUrl": "https://facebook.com/groups/YOUR_GROUP_ID/posts/YOUR_POST_ID",
  "scanIntervalMs": 800,
  "replyDelayMs": 0,
  "headless": true,
  "commands": {
    "#price": "ราคา 590 บาท",
    "#stock": "สินค้ายังพร้อมส่ง",
    "#contact": "ติดต่อ Inbox ได้เลยครับ"
  },
  "defaultReply": "ขอบคุณครับ"
}
```

**สำคัญ:** เปลี่ยน `postUrl` เป็น URL ของโพสต์ที่ต้องการ Monitor

## 📖 Usage

### Login to Facebook

ครั้งแรกต้อง Login เพื่อบันทึก Session:

#### วิธีที่ 1: Chrome Profile Login (Default - แนะนำ)

```bash
node src/app.js login
```

**ขั้นตอน:**
1. ปิด Chrome ทั้งหมดให้หมดก่อน
2. รันคำสั่งด้านบน
3. กด Enter
4. Chrome จะเปิดพร้อม Facebook ที่ Login อยู่แล้ว
5. Session ถูกบันทึกทันที (ไม่มี CAPTCHA!)

**ข้อดี:**
- ✅ ไม่มี CAPTCHA เลย!
- ✅ Login เร็วและง่าย
- ✅ ใช้ Chrome Profile ที่มีอยู่แล้ว

#### วิธีที่ 2: Playwright Login (สำรอง)

```bash
node src/app.js login --standard
```

**ขั้นตอน:**
1. Browser จะเปิดขึ้นมา
2. Login เข้า Facebook
3. ทำ reCAPTCHA ถ้ามี
4. ทำ 2FA ถ้ามี
5. รอจนเห็น News Feed
6. กด Enter ใน Terminal

Session จะถูกบันทึกใน `storageState.json`

### Start Bot

เริ่มต้น Monitor และตอบคอมเมนต์อัตโนมัติ:

```bash
node src/app.js run
```

Bot จะ:
1. โหลด Session ที่บันทึกไว้
2. เข้าไปที่โพสต์ที่กำหนดใน config
3. ตรวจจับเจ้าของโพสต์
4. เริ่ม Monitor คอมเมนต์
5. ตอบกลับคอมเมนต์จากเจ้าของโพสต์ทันที

### Check Status

ดูสถิติและสถานะของ Bot:

```bash
node src/app.js status
```

แสดง:
- ชื่อเจ้าของโพสต์
- จำนวน Reply ทั้งหมด
- Reply ล่าสุด
- Uptime
- สถานะ Session

### Delete Reply

ลบ Reply ล่าสุด:

```bash
node src/app.js delete-last
```

ลบ Reply ตาม ID:

```bash
node src/app.js delete <replyId>
```

### Stop Bot

กด `Ctrl+C` ใน Terminal ที่รัน Bot

## 🎯 Command System

Bot รองรับการตอบคอมเมนต์ตาม Command ที่กำหนดใน config:

**ตัวอย่างการใช้งาน:**

เจ้าของโพสต์คอมเมนต์:
```
#price
```

Bot จะตอบ:
```
ราคา 590 บาท
```

เจ้าของโพสต์คอมเมนต์:
```
#stock
```

Bot จะตอบ:
```
สินค้ายังพร้อมส่ง
```

หากคอมเมนต์ไม่มี Command ใดๆ Bot จะตอบด้วย `defaultReply`

## 🗄️ Database Schema

ระบบใช้ SQLite เก็บข้อมูลใน `data/bot.db`

### Table: processed_comments
เก็บคอมเมนต์ที่ประมวลผลแล้ว (ป้องกันตอบซ้ำ)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary Key |
| comment_id | TEXT | Facebook Comment ID (Unique) |
| comment_text | TEXT | ข้อความคอมเมนต์ |
| comment_author | TEXT | ชื่อผู้คอมเมนต์ |
| processed_at | DATETIME | เวลาที่ประมวลผล |

### Table: auto_replies
เก็บ Reply ที่ Bot ส่ง

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary Key |
| comment_id | TEXT | Comment ID ที่ตอบกลับ |
| reply_id | TEXT | Reply ID (Unique) |
| reply_text | TEXT | ข้อความที่ตอบ |
| command_used | TEXT | Command ที่ใช้ (ถ้ามี) |
| latency_ms | INTEGER | เวลาในการตอบ (มิลลิวินาที) |
| created_at | DATETIME | เวลาที่ส่ง Reply |

### Table: settings
เก็บการตั้งค่าและ Metadata

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Setting Key (Primary Key) |
| value | TEXT | Setting Value |
| updated_at | DATETIME | เวลาที่อัปเดต |

## 🏗️ Architecture

```
┌─────────────┐
│   app.js    │ ← CLI Entry Point
└──────┬──────┘
       │
       ├─→ login.js ─→ storageState.json (Session Storage)
       │
       ├─→ monitor.js (Main Monitoring Loop)
       │      │
       │      ├─→ ownerDetector.js (Detect Post Owner)
       │      ├─→ commentService.js (Extract Comments)
       │      ├─→ commandProcessor.js (Process Commands)
       │      └─→ replyService.js (Send Reply)
       │
       ├─→ deleteReply.js (Delete Reply)
       │
       └─→ database.js ← SQLite Database
```

## 🔧 Configuration Options

### config.json

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| postUrl | string | - | URL ของโพสต์ที่ต้องการ Monitor |
| scanIntervalMs | number | 800 | ระยะเวลาในการสแกนคอมเมนต์ (มิลลิวินาที) |
| replyDelayMs | number | 0 | ดีเลย์ก่อนตอบ (มิลลิวินาที) |
| headless | boolean | true | รัน Browser แบบ Headless |
| commands | object | {} | Command และ Reply |
| defaultReply | string | - | Reply เริ่มต้นเมื่อไม่มี Command |

## 📊 Workflow

1. **Login Phase**
   - เปิด Browser (Non-Headless)
   - User Login เอง
   - รอ User กด Enter
   - บันทึก Session เป็น `storageState.json`

2. **Monitoring Phase**
   - โหลด Session ที่บันทึกไว้
   - เปิด Browser (Headless)
   - เข้าไปที่โพสต์
   - ตรวจจับเจ้าของโพสต์
   - เริ่ม Monitor Loop

3. **Comment Detection**
   - สแกนคอมเมนต์ทุก 800ms (configurable)
   - ตรวจสอบว่าเป็นคอมเมนต์ใหม่
   - ตรวจสอบว่าเป็นคอมเมนต์จากเจ้าของโพสต์
   - เช็คว่าเคยตอบแล้วหรือยัง (Duplicate Protection)

4. **Reply Process**
   - ประมวลผล Command (ถ้ามี)
   - ส่ง Reply
   - บันทึกลง Database
   - แสดง Log

## 🚀 Deployment on VPS (Ubuntu)

### 1. เตรียม VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies for Playwright
sudo npx playwright install-deps chromium
```

### 2. Upload โปรเจกต์

```bash
# Clone หรือ Upload โปรเจกต์
git clone <your-repo-url> fbautomation
cd fbautomation

# Install dependencies
npm install
npx playwright install chromium
```

### 3. Login (ครั้งแรก)

ใช้ SSH Forward หรือ VNC เพื่อเปิด Browser:

```bash
# Option 1: X11 Forwarding
ssh -X user@your-vps
node src/app.js login

# Option 2: Copy storageState.json จาก Local
# Login บนเครื่อง Local แล้ว upload storageState.json ไปยัง VPS
```

### 4. Install PM2

```bash
npm install -g pm2
```

### 5. Start with PM2

```bash
# Start bot
pm2 start src/app.js --name fb-bot -- run

# Save PM2 configuration
pm2 save

# Auto-start on boot
pm2 startup
```

### 6. Monitor with PM2

```bash
# View logs
pm2 logs fb-bot

# Check status
pm2 status

# Restart
pm2 restart fb-bot

# Stop
pm2 stop fb-bot
```

## 🔍 Troubleshooting

### Session Expired

หาก Session หมดอายุ:
```bash
node src/app.js login
```

### Bot ไม่ตอบคอมเมนต์

1. เช็คว่า `postUrl` ถูกต้อง
2. เช็คว่าตรวจจับเจ้าของโพสต์ได้หรือไม่
3. ดู Log ว่ามีคอมเมนต์เข้ามาหรือไม่
4. เช็คว่า Command ถูกต้อง

### Facebook Layout Changed

Facebook อาจเปลี่ยน Layout บ่อย ทำให้ Selector ไม่ทำงาน:

1. เปิด Browser แบบ Non-Headless: แก้ `headless: false` ใน config
2. ดูว่า Bot หา Element ไหนไม่เจอ
3. แก้ไข Selector ใน `commentService.js` หรือ `ownerDetector.js`

### High CPU Usage

ลด `scanIntervalMs` ใน config (เพิ่มเวลารอระหว่างการสแกน):

```json
{
  "scanIntervalMs": 2000
}
```

### Rate Limit / Temporary Block

Facebook อาจบล็อกถ้าส่ง Request เยอะเกินไป:

1. เพิ่ม `replyDelayMs` ใน config
2. เพิ่ม `scanIntervalMs` ใน config
3. หยุด Bot สักพัก

## 📝 Log Format

```
[09:00:01] BOT STARTED
[09:00:15] ✓ POST OWNER DETECTED: สมชาย ใจดี
[09:00:16] ✓ BOT IS NOW RUNNING

[09:05:22] ──────────────────────────────────────────────────
[09:05:22] OWNER COMMENT
[09:05:22] Owner: สมชาย ใจดี
[09:05:22] CommentId: 123456789
[09:05:22] Text: #price
[09:05:22] Command: #price
[09:05:22] Reply: ราคา 590 บาท
[09:05:23] ✓ REPLY SENT
[09:05:23]   ReplyId: reply_1234567890_abc123
[09:05:23]   Latency: 362ms
```

## 🛡️ Security

- **ไม่เก็บ Password**: ระบบไม่เก็บ Email/Password ใน Config
- **Session Storage**: เก็บเฉพาะ Cookies และ Storage State
- **Database**: เก็บใน Local SQLite (ไม่ส่งข้อมูลออกนอกเครื่อง)

## ⚠️ Limitations

- ต้อง Login ใหม่เมื่อ Session หมดอายุ (โดยปกติ Facebook Session อยู่ได้หลายวัน)
- Facebook อาจเปลี่ยน Layout ทำให้ต้องปรับ Selector
- ควรใช้ Account ที่ไม่ใช่ Main Account เพื่อความปลอดภัย
- ไม่ควรส่ง Spam หรือใช้ในทางที่ผิด

## 📄 License

MIT

## 🤝 Contributing

Pull requests are welcome!

## 📧 Support

หากมีปัญหาการใช้งาน กรุณาเปิด Issue ใน Repository

---

**Happy Automating! 🚀**
