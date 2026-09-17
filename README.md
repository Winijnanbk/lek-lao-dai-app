# เลขเล่าได้

เว็บสถิติผลสลากจริง 4 โหมด ใช้ HTML/CSS/JavaScript บน GitHub Pages ไม่ต้องมี API key และไม่มีข้อมูลจำลองในหน้าแอป

## ข้อมูลจริง

- `update-data.cjs` POST ไปยัง `https://www.glo.or.th/api/checking/getLotteryResult` และเก็บเฉพาะผลที่สมบูรณ์ของสำนักงานสลากฯ 60 งวดล่าสุด
- การเริ่มชุดข้อมูลใช้ GitHub API ของ `vicha-w/thai-lotto-archive` เพื่อหาวันออกรางวัลเท่านั้น ไม่ใช้ตัวเลขจาก archive นี้ หากวันเลื่อนจะตรวจวันที่ใกล้เคียงกับ GLO
- `data/draws.json` เป็นผลจริงที่บันทึกไว้พร้อมวันที่ดึงข้อมูล หน้าเว็บอ่านไฟล์นี้จากเว็บไซต์เดียวกัน จึงไม่ติด CORS ของ GLO
- ไม่มีการเติมผลที่ขาดด้วยเลขจำลอง ถ้าดึงข้อมูลไม่ครบ workflow จะล้มเหลวและไม่ deploy ข้อมูลที่ไม่สมบูรณ์
- เบราว์เซอร์เก็บสำเนาผลจริงใน localStorage เพื่อใช้เมื่อโหลดข้อมูลครั้งถัดไปไม่ได้ โดยแสดงสถานะและวันที่ข้อมูลชัดเจน ถ้าไม่มีสำเนาจะปิดปุ่มวิเคราะห์
- ปุ่มอัปเดตผลหวยโหลดชุดข้อมูลที่เว็บไซต์เตรียมไว้ล่าสุด ไม่ได้สั่ง workflow หรือเรียก GLO ตรงจากเบราว์เซอร์

## เปิดใช้งาน GitHub Pages (ผู้ดูแลทำครั้งเดียว)

1. Push ไฟล์ทั้งหมด รวม `data/` และ `.github/workflows/pages.yml` ไป branch `main`
2. Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**
3. Actions → Update real lottery data and deploy Pages → Run workflow

Workflow ดึงข้อมูลจาก GLO ก่อน deploy ทุกครั้งที่ push และทุกวันเวลา 16:30 กับ 18:30 น. ประเทศไทย (เวลารันจริงอาจล่าช้าตามคิว GitHub) ต้องเปิดใช้งาน Actions และสิทธิ์ deploy environment `github-pages` ชุดข้อมูลที่อัปเดตจะอยู่ใน Pages artifact ไม่ได้ commit กลับเข้า repository

หากใช้ Deploy from a branch จะเปิดเว็บได้ด้วยข้อมูลจริงที่บันทึกไว้ แต่การอัปเดตอัตโนมัติต้องเปลี่ยน Source เป็น GitHub Actions ตามข้างต้น

## พัฒนาและทดสอบ

ต้องมี Node.js 22 ขึ้นไป

```sh
node update-data.cjs
node --test test-core.cjs
node test-browser.cjs
```

Browser tests ใช้ Chrome headless; Windows ใช้ตำแหน่งติดตั้งมาตรฐาน ส่วนระบบอื่นกำหนด `CHROME_PATH` ได้ ทดสอบการพิมพ์และ Enter จริงผ่าน Chrome DevTools Protocol ที่ความกว้าง 320, 390, 768, 1280 px พร้อมกรณี offline, timeout, ข้อมูลผิดรูปแบบ และไม่มีข้อมูล

เปิดเว็บผ่าน static HTTP server ระหว่างพัฒนา ไม่เปิด `index.html` ด้วย `file://` เพราะเบราว์เซอร์อาจบล็อกการอ่านไฟล์ข้อมูล

คะแนนเป็นคำอธิบายสถิติย้อนหลัง ไม่ใช่ความน่าจะเป็นถูกรางวัล และไม่ได้ตรวจครบทุกรางวัลของสลากหนึ่งใบ