# Shifā — Al-Qur'an sebagai penyembuh hati

Aplikasi web yang membantu orang menemukan ayat-ayat Al-Qur'an yang relevan dengan kondisi dan masalah hidup mereka.

## Deploy ke Vercel

### 1. Push ke GitHub

```bash
cd shifa-app
git init
git add .
git commit -m "Initial commit - Shifa app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shifa-app.git
git push -u origin main
```

### 2. Deploy di Vercel

1. Buka https://vercel.com/dashboard
2. Klik **"Add New Project"**
3. Import repo `shifa-app` dari GitHub
4. Framework: **Vite** (auto-detected)
5. **Environment Variables** — tambahkan:
   - `ANTHROPIC_API_KEY` = `sk-ant-...` (API key Claude kamu)
6. Klik **Deploy**

### 3. Custom Domain (shiva.sab.id)

Di Vercel project settings → Domains → tambahkan `shiva.sab.id`

Di Cloudflare DNS untuk `sab.id`:
- Type: **CNAME**
- Name: **shiva**
- Target: **cname.vercel-dns.com**
- Proxy: **DNS Only** (grey cloud — matikan proxy orange)

Tunggu beberapa menit, SSL otomatis dari Vercel.

## Local Development

```bash
npm install
npm run dev
```

## Tech Stack

- React 18 + Vite
- Claude API (Sonnet 4) via Vercel serverless function
- Deployed on Vercel Edge Network
