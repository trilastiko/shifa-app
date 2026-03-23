import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `Kamu adalah seorang ulama dan ahli Al-Qur'an yang telah menghafal seluruh isinya dengan pemahaman mendalam. Dengan pengalaman lebih dari 50 tahun dalam ilmu tafsir, hadits, dan psikologi Islami, kamu memahami kondisi hati dan pikiran manusia secara empatik dan bijaksana.

TUGAS UTAMA:
Ketika seseorang menceritakan keluh kesah, kekhawatiran, masalah hidupnya, ATAU menanyakan tentang topik/tema tertentu dalam Al-Qur'an, kamu harus:

1. PAHAMI apa yang ia butuhkan — baik itu solusi atas masalah, atau dalil tentang topik tertentu
2. CARI ayat-ayat Al-Qur'an yang PALING RELEVAN (minimal 2, maksimal 4 ayat)
3. BERIKAN tafsir yang menyentuh hati dan kontekstual
4. HUBUNGKAN dengan kehidupan praktis mereka

PENTING: Pengguna bisa bertanya tentang:
- Masalah pribadi (sedih, takut, galau, dll)
- Topik umum dalam Islam (warisan, zakat, puasa, pernikahan, jual beli, dll)
- Dalil tentang hukum atau aturan tertentu
- Tema-tema kehidupan (sabar, syukur, taubat, rezeki, dll)
Kamu HARUS bisa menjawab SEMUA jenis pertanyaan di atas.

FORMAT JAWABAN (WAJIB dalam JSON murni, TANPA backtick, TANPA markdown, TANPA teks di luar JSON):
{
  "empathy": "Kalimat pembuka yang menunjukkan kamu memahami kebutuhan mereka (2-3 kalimat). Jika pertanyaan tentang topik umum, berikan pengantar yang informatif.",
  "verses": [
    {
      "surah": "Nama Surat dalam Bahasa Indonesia",
      "surah_arabic": "Nama Surat dalam bahasa Arab",
      "ayah_number": "Nomor ayat (angka saja)",
      "arabic_text": "Teks ayat dalam bahasa Arab (lengkap dan benar)",
      "transliteration": "Transliterasi latin lengkap dari ayat Arab di atas",
      "translation": "Terjemahan dalam Bahasa Indonesia",
      "tafsir": "Tafsir kontekstual 3-5 kalimat yang menghubungkan ayat dengan kebutuhan penanya"
    }
  ],
  "wisdom": "Hikmah dan nasihat penutup (2-3 kalimat)",
  "dua": "Doa singkat dalam bahasa Arab yang relevan",
  "dua_transliteration": "Transliterasi latin dari doa",
  "dua_translation": "Terjemahan doa dalam Bahasa Indonesia"
}

PEDOMAN:
- Bahasa lembut, penuh kasih sayang, menguatkan
- Ayat harus langsung relevan dengan topik/masalah
- Tafsir kontekstual, bukan generik
- Teks Arab AKURAT dan LENGKAP
- Transliterasi AKURAT
- HANYA output JSON murni. Tidak ada backtick, tidak ada markdown, tidak ada teks lain.`;

const ALL_SUGGESTIONS = [
  { emoji: "💭", text: "Hati saya sedang sedih dan gelisah tanpa sebab yang jelas" },
  { emoji: "🌊", text: "Saya takut dengan masa depan dan tidak tahu harus bagaimana" },
  { emoji: "🕊️", text: "Saya merasa doa saya tidak pernah dijawab Allah" },
  { emoji: "🪞", text: "Saya merasa tidak berharga dan kehilangan percaya diri" },
  { emoji: "⚡", text: "Saya dizalimi orang lain dan tidak tahu harus berbuat apa" },
  { emoji: "🌙", text: "Saya kehilangan orang yang sangat saya cintai" },
  { emoji: "🔥", text: "Saya sulit mengendalikan amarah dan emosi" },
  { emoji: "💰", text: "Bagaimana Al-Qur'an mengatur pembagian warisan?" },
  { emoji: "🤝", text: "Saya sedang konflik dengan keluarga dan ingin berdamai" },
  { emoji: "📿", text: "Saya merasa iman saya sedang lemah dan jauh dari Allah" },
  { emoji: "🏠", text: "Saya khawatir dengan rezeki dan nafkah keluarga" },
  { emoji: "💔", text: "Saya baru saja patah hati dan merasa hancur" },
  { emoji: "🌱", text: "Bagaimana cara bertaubat yang benar menurut Al-Qur'an?" },
  { emoji: "⏳", text: "Saya merasa hidup tidak adil — mengapa saya diuji terus?" },
  { emoji: "🧕", text: "Apa yang Al-Qur'an katakan tentang kesabaran?" },
  { emoji: "🌅", text: "Saya ingin memulai hidup baru dan meninggalkan masa lalu" },
  { emoji: "📖", text: "Apa dalil tentang kewajiban menuntut ilmu?" },
  { emoji: "🤲", text: "Saya merasa kesepian dan tidak punya siapa-siapa" },
  { emoji: "⚖️", text: "Bagaimana Islam mengajarkan tentang keadilan?" },
  { emoji: "🫂", text: "Orang tua saya sakit dan saya takut kehilangan mereka" },
  { emoji: "🌟", text: "Apa yang Al-Qur'an katakan tentang rasa syukur?" },
  { emoji: "😰", text: "Saya punya hutang yang menumpuk dan sangat stress" },
  { emoji: "🕌", text: "Bagaimana cara menjaga istiqomah dalam beribadah?" },
  { emoji: "💫", text: "Saya ingin lebih dekat dengan Al-Qur'an" },
];

function shuffleAndPick(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Use /api/chat proxy in production, direct API in artifact preview
const API_URL = typeof window !== "undefined" && window.location.hostname !== "localhost" && !window.location.hostname.includes("claude")
  ? "/api/chat"
  : "https://api.anthropic.com/v1/messages";

const TH = {
  dark: {
    bg: "#0b0b12", surface: "rgba(255,255,255,0.04)",
    input: "rgba(255,255,255,0.04)", inputBorder: "rgba(255,255,255,0.08)",
    card: "rgba(255,255,255,0.035)", cardHeader: "rgba(108,99,255,0.06)",
    arabic: "rgba(108,99,255,0.06)", arabicBorder: "rgba(108,99,255,0.1)",
    translit: "rgba(78,205,196,0.04)", translitBorder: "rgba(78,205,196,0.1)",
    tafsir: "rgba(255,255,255,0.02)", tafsirBorder: "rgba(255,255,255,0.04)",
    empathy: "rgba(108,99,255,0.06)", wisdom: "rgba(255,255,255,0.025)",
    dua: "rgba(108,99,255,0.04)", duaBorder: "rgba(108,99,255,0.1)",
    sug: "rgba(255,255,255,0.03)", sugHover: "rgba(108,99,255,0.1)",
    err: "rgba(255,82,82,0.06)", errBorder: "rgba(255,82,82,0.12)", errText: "#ff9090",
    text: "#f0f0f0", text2: "rgba(255,255,255,0.75)", text3: "rgba(255,255,255,0.5)",
    text4: "rgba(255,255,255,0.25)", text5: "rgba(255,255,255,0.1)",
    arabicText: "#fff", translitText: "#4ECDC4",
    border: "rgba(255,255,255,0.06)", accentBorder: "rgba(108,99,255,0.12)",
    leftBar: "rgba(108,99,255,0.5)",
    disabledBg: "rgba(255,255,255,0.04)", disabledText: "rgba(255,255,255,0.12)",
    orb1: "rgba(108,99,255,0.08)", orb2: "rgba(78,205,196,0.06)",
    titleColor: "#ffffff",
    toggle: "rgba(255,255,255,0.06)", toggleText: "rgba(255,255,255,0.6)",
    tagline: "rgba(108,99,255,0.35)",
  },
  light: {
    bg: "#f4f2ed", surface: "rgba(255,255,255,0.8)",
    input: "#ffffff", inputBorder: "rgba(0,0,0,0.1)",
    card: "rgba(255,255,255,0.85)", cardHeader: "rgba(108,99,255,0.04)",
    arabic: "rgba(108,99,255,0.04)", arabicBorder: "rgba(108,99,255,0.08)",
    translit: "rgba(78,205,196,0.05)", translitBorder: "rgba(78,205,196,0.1)",
    tafsir: "rgba(108,99,255,0.025)", tafsirBorder: "rgba(0,0,0,0.05)",
    empathy: "rgba(108,99,255,0.05)", wisdom: "rgba(108,99,255,0.025)",
    dua: "rgba(108,99,255,0.03)", duaBorder: "rgba(108,99,255,0.08)",
    sug: "rgba(255,255,255,0.8)", sugHover: "rgba(108,99,255,0.07)",
    err: "rgba(220,38,38,0.05)", errBorder: "rgba(220,38,38,0.12)", errText: "#dc2626",
    text: "#1a1a2e", text2: "#3a3a4e", text3: "#666", text4: "#aaa", text5: "#ddd",
    arabicText: "#1a1a2e", translitText: "#0d9488",
    border: "rgba(0,0,0,0.07)", accentBorder: "rgba(108,99,255,0.1)",
    leftBar: "rgba(108,99,255,0.45)",
    disabledBg: "rgba(0,0,0,0.03)", disabledText: "rgba(0,0,0,0.15)",
    orb1: "rgba(108,99,255,0.04)", orb2: "rgba(78,205,196,0.04)",
    titleColor: "#1a1a2e",
    toggle: "rgba(0,0,0,0.04)", toggleText: "#666",
    tagline: "rgba(108,99,255,0.4)",
  }
};

function VerseCard({ verse, index, c }) {
  return (
    <div style={{
      background: c.card, borderRadius: "18px", overflow: "hidden",
      border: `1px solid ${c.border}`, backdropFilter: "blur(8px)",
      animation: `cardIn 0.5s ease-out ${0.15 + index * 0.12}s both`,
      transition: "background 0.35s, border-color 0.35s",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", background: c.cardHeader,
        borderBottom: `1px solid ${c.border}`, transition: "background 0.35s, border-color 0.35s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "9px",
            background: "linear-gradient(135deg, #6C63FF, #4ECDC4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "13px", fontWeight: "700",
            boxShadow: "0 2px 8px rgba(108,99,255,0.25)",
          }}>{index + 1}</div>
          <span style={{ fontSize: "14.5px", fontWeight: "600", color: c.text, transition: "color 0.35s" }}>
            {verse.surah} : {verse.ayah_number}
          </span>
        </div>
        {verse.surah_arabic && (
          <span style={{ fontFamily: "'Amiri',serif", fontSize: "16px", color: c.text4, transition: "color 0.35s" }}>
            {verse.surah_arabic}
          </span>
        )}
      </div>

      <div style={{ padding: "18px 20px" }}>
        <div style={{
          fontFamily: "'Amiri','Traditional Arabic',serif",
          fontSize: "24px", lineHeight: "2.2", color: c.arabicText,
          textAlign: "right", direction: "rtl", padding: "18px 20px",
          borderRadius: "12px", background: c.arabic,
          border: `1px solid ${c.arabicBorder}`, marginBottom: "2px",
          transition: "background 0.35s, color 0.35s, border-color 0.35s",
        }}>{verse.arabic_text}</div>

        {verse.transliteration && (
          <div style={{
            fontSize: "13px", lineHeight: "1.8", color: c.translitText,
            fontStyle: "italic", padding: "10px 20px 12px",
            background: c.translit, borderRadius: "0 0 12px 12px",
            marginBottom: "14px", borderTop: `1px dashed ${c.translitBorder}`,
            transition: "background 0.35s, color 0.35s",
          }}>{verse.transliteration}</div>
        )}

        <div style={{
          fontSize: "14px", lineHeight: "1.8", color: c.text2,
          fontStyle: "italic", paddingLeft: "14px",
          borderLeft: `2px solid ${c.leftBar}`, marginBottom: "14px",
          transition: "color 0.35s",
        }}>"{verse.translation}"</div>

        <div style={{
          fontSize: "13.5px", lineHeight: "1.85", color: c.text3,
          padding: "14px 16px", background: c.tafsir,
          borderRadius: "10px", border: `1px solid ${c.tafsirBorder}`,
          transition: "background 0.35s, color 0.35s, border-color 0.35s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#4ECDC4)" }}/>
            <span style={{ color: "rgba(108,99,255,0.65)", fontWeight: "600", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "1.2px" }}>Tafsir Kontekstual</span>
          </div>
          <div>{verse.tafsir}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [suggestions, setSuggestions] = useState(() => shuffleAndPick(ALL_SUGGESTIONS, 6));
  const [mode, setMode] = useState(() => {
    try { return window.matchMedia?.("(prefers-color-scheme:light)").matches ? "light" : "dark"; }
    catch { return "dark"; }
  });
  const resultRef = useRef(null);
  const textareaRef = useRef(null);
  const c = TH[mode];

  const loadMsgs = ["Mendengarkan ceritamu...", "Menelusuri ayat-ayat yang relevan...", "Menyiapkan tafsir untukmu...", "Hampir siap..."];

  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-color-scheme:light)");
      const h = e => setMode(e.matches ? "light" : "dark");
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadingPhase(p => (p + 1) % loadMsgs.length), 2500);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    if (result && resultRef.current) setTimeout(() => resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [result]);

  const refreshSuggestions = useCallback(() => setSuggestions(shuffleAndPick(ALL_SUGGESTIONS, 6)), []);

  async function handleSubmit() {
    if (!input.trim() || loading) return;
    setLoading(true); setError(null); setResult(null); setLoadingPhase(0);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: input.trim() }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Terjadi kesalahan. Silakan coba lagi.");
      const text = (data.content || []).map(x => x.text || "").join("");
      if (!text.trim()) throw new Error("Tidak ada respons. Silakan coba lagi.");
      let parsed;
      try { parsed = JSON.parse(text.trim()); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Terjadi kesalahan format. Silakan coba lagi.");
        parsed = JSON.parse(m[0]);
      }
      if (!parsed.verses?.length) throw new Error("Tidak ditemukan ayat relevan. Coba ceritakan lebih detail.");
      setResult(parsed);
    } catch (err) { setError(err.message || "Terjadi kesalahan."); }
    finally { setLoading(false); }
  }

  const handleSuggestion = text => { setInput(text); setResult(null); setError(null); textareaRef.current?.focus(); };
  const handleReset = () => { setInput(""); setResult(null); setError(null); refreshSuggestions(); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // FIXED: GradText uses NO transition — this prevents the rectangle flash bug
  const GradText = ({ children, style: s }) => (
    <span style={{ background: "linear-gradient(135deg,#6C63FF,#4ECDC4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", ...s }}>{children}</span>
  );

  const Divider = ({ label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "28px 0" }}>
      <div style={{ height: "1px", flex: 1, background: `linear-gradient(to right,transparent,${c.accentBorder},transparent)` }}/>
      {label ? <GradText style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: "700" }}>{label}</GradText>
        : <div style={{ width: "32px", height: "2px", borderRadius: "1px", background: "linear-gradient(90deg,#6C63FF,#4ECDC4)", opacity: 0.3 }}/>}
      <div style={{ height: "1px", flex: 1, background: `linear-gradient(to right,transparent,${c.accentBorder},transparent)` }}/>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'DM Sans',sans-serif", position: "relative", overflow: "hidden", transition: "background 0.4s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes barSlide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(35px,-25px)}}
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
        textarea:focus{outline:none;border-color:rgba(108,99,255,0.45)!important;box-shadow:0 0 0 3px rgba(108,99,255,0.07)!important}
        textarea::placeholder{color:inherit;opacity:.3}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${c.bg};transition:background 0.4s}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px}
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position:"fixed",top:"-12%",right:"-6%",width:"400px",height:"400px",borderRadius:"50%",background:`radial-gradient(circle,${c.orb1} 0%,transparent 70%)`,animation:"drift1 20s ease-in-out infinite",pointerEvents:"none",filter:"blur(50px)" }}/>
      <div style={{ position:"fixed",bottom:"-18%",left:"-10%",width:"450px",height:"450px",borderRadius:"50%",background:`radial-gradient(circle,${c.orb2} 0%,transparent 70%)`,animation:"drift2 26s ease-in-out infinite",pointerEvents:"none",filter:"blur(60px)" }}/>

      {/* Theme toggle */}
      <button onClick={() => setMode(m => m === "dark" ? "light" : "dark")}
        style={{
          position:"fixed",top:"14px",right:"14px",zIndex:100,
          width:"38px",height:"38px",borderRadius:"11px",
          background:c.toggle,border:`1px solid ${c.border}`,
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          color:c.toggleText,fontSize:"16px",transition:"background 0.35s, border-color 0.35s",
          backdropFilter:"blur(8px)",
        }}>
        {mode === "dark" ? "☀️" : "🌙"}
      </button>

      {/* Header */}
      <header style={{ textAlign:"center",padding:"44px 24px 16px",position:"relative",zIndex:1,animation:"slideUp 0.6s ease-out" }}>
        {/* Healing drop logo */}
        <div style={{ marginBottom:"12px" }}>
          <svg width="44" height="44" viewBox="0 0 100 100" fill="none" style={{ display:"inline-block" }}>
            <defs><linearGradient id="hd" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6C63FF"/><stop offset="100%" stopColor="#4ECDC4"/></linearGradient></defs>
            <path d="M50 12 C50 12 22 48 22 64 C22 80 34 92 50 92 C66 92 78 80 78 64 C78 48 50 12 50 12Z" fill="url(#hd)"/>
            <ellipse cx="50" cy="60" rx="14" ry="16" fill="white" opacity="0.2"/>
            <circle cx="42" cy="52" r="4" fill="white" opacity="0.4"/>
          </svg>
        </div>

        {/* FIXED: Title uses plain color, NOT gradient — prevents rectangle flash on theme toggle */}
        <h1 style={{
          fontFamily:"'Syne',sans-serif",fontSize:"clamp(34px,6.5vw,46px)",fontWeight:"800",
          letterSpacing:"-2px",lineHeight:"1.1",margin:"0",
          color: c.titleColor,
          transition: "color 0.35s",
        }}>Shifā</h1>

        <p style={{
          fontFamily:"'Amiri',serif",fontSize:"15px",color:c.tagline,
          margin:"4px 0 14px",letterSpacing:"2px",lineHeight:"1.4",
          transition:"color 0.35s",
        }}>شِفَاء</p>

        <p style={{ fontSize:"14.5px",color:c.text3,maxWidth:"340px",margin:"0 auto",lineHeight:"1.65",transition:"color 0.35s" }}>
          Ceritakan apa yang kamu rasakan.{" "}
          {/* GradText intentionally has NO transition */}
          <GradText style={{ fontWeight:"600" }}>Al-Qur'an punya jawabannya.</GradText>
        </p>
      </header>

      <main style={{ maxWidth:"600px",margin:"0 auto",padding:"8px 20px 80px",position:"relative",zIndex:1 }}>
        {/* Input card */}
        <div style={{
          background:c.surface,borderRadius:"20px",padding:"22px",
          border:`1px solid ${c.border}`,marginBottom:"18px",
          animation:"slideUp 0.6s ease-out 0.1s both",
          backdropFilter:"blur(10px)",transition:"background 0.35s, border-color 0.35s",
        }}>
          <label style={{ fontSize:"11px",fontWeight:"600",color:c.text4,textTransform:"uppercase",letterSpacing:"1.5px",display:"block",marginBottom:"8px",transition:"color 0.35s" }}>
            Ceritakan masalahmu atau tanyakan topik Al-Qur'an
          </label>
          <textarea ref={textareaRef} value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))handleSubmit()}}
            placeholder="Contoh: Saya sedang merasa cemas... atau: Apa kata Al-Qur'an tentang warisan?"
            rows={3} disabled={loading}
            style={{
              width:"100%",padding:"14px 16px",fontSize:"14.5px",lineHeight:"1.7",
              fontFamily:"'DM Sans',sans-serif",border:`1.5px solid ${c.inputBorder}`,
              borderRadius:"12px",background:c.input,color:c.text,
              resize:"vertical",transition:"background 0.35s, color 0.35s, border-color 0.35s",minHeight:"84px",
            }}
          />
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"12px",flexWrap:"wrap",gap:"10px" }}>
            <span style={{ fontSize:"11px",color:c.text5,transition:"color 0.35s" }}>⌘+Enter</span>
            <button onClick={handleSubmit} disabled={!input.trim()||loading}
              style={{
                fontSize:"13.5px",fontWeight:"600",padding:"11px 26px",borderRadius:"11px",border:"none",
                background:!input.trim()||loading?c.disabledBg:"linear-gradient(135deg,#6C63FF,#4ECDC4)",
                color:!input.trim()||loading?c.disabledText:"#fff",
                cursor:!input.trim()||loading?"not-allowed":"pointer",
                transition:"opacity 0.3s, box-shadow 0.3s",
                display:"flex",alignItems:"center",gap:"7px",
                boxShadow:!input.trim()||loading?"none":"0 4px 20px rgba(108,99,255,0.28)",
              }}>
              {loading?(<><div style={{width:"13px",height:"13px",border:"2px solid rgba(255,255,255,0.2)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Mencari...</>):"Cari Jawaban →"}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {!result&&!loading&&(
          <div style={{ marginBottom:"24px",animation:"fadeIn 0.5s ease-out 0.25s both" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginBottom:"12px" }}>
              <span style={{ fontSize:"10.5px",color:c.text4,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:"500",transition:"color 0.35s" }}>Atau mulai dari sini</span>
              <button onClick={refreshSuggestions} style={{ background:"none",border:"none",color:"rgba(108,99,255,0.45)",cursor:"pointer",display:"flex",alignItems:"center",gap:"3px",padding:"2px 4px",borderRadius:"4px",transition:"color 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.color="rgba(108,99,255,0.85)"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(108,99,255,0.45)"}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13.5 2.5V6H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2.5 13.5V10H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12.5 6A5.5 5.5 0 0 0 4 3.5L2.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M3.5 10A5.5 5.5 0 0 0 12 12.5L13.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                <span style={{ fontSize:"10.5px" }}>Lainnya</span>
              </button>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"7px",justifyContent:"center" }}>
              {suggestions.map((s,i)=>(
                <button key={s.text} onClick={()=>handleSuggestion(s.text)} style={{
                  fontSize:"12.5px",padding:"9px 14px",borderRadius:"10px",
                  border:`1px solid ${c.border}`,background:c.sug,
                  color:c.text3,cursor:"pointer",transition:"all 0.2s",
                  fontFamily:"'DM Sans',sans-serif",animation:`fadeIn 0.3s ease-out ${i*0.04}s both`,
                  textAlign:"left",
                }}
                  onMouseEnter={e=>{e.target.style.background=c.sugHover;e.target.style.borderColor=c.accentBorder;e.target.style.color=c.text;e.target.style.transform="translateY(-1px)"}}
                  onMouseLeave={e=>{e.target.style.background=c.sug;e.target.style.borderColor=c.border;e.target.style.color=c.text3;e.target.style.transform="none"}}>
                  <span style={{marginRight:"5px"}}>{s.emoji}</span>{s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading&&(
          <div style={{ textAlign:"center",padding:"48px 24px",animation:"fadeIn 0.3s ease-out" }}>
            <div style={{ width:"200px",height:"3px",margin:"0 auto 24px",background:c.surface,borderRadius:"2px",overflow:"hidden" }}>
              <div style={{ width:"35%",height:"100%",background:"linear-gradient(90deg,transparent,#6C63FF,#4ECDC4,transparent)",borderRadius:"2px",animation:"barSlide 1.5s ease-in-out infinite" }}/>
            </div>
            <p style={{ fontSize:"14px",color:c.text3,animation:"pulse 2.2s ease-in-out infinite",transition:"color 0.35s" }}>{loadMsgs[loadingPhase]}</p>
          </div>
        )}

        {/* Error */}
        {error&&(
          <div style={{ background:c.err,border:`1px solid ${c.errBorder}`,borderRadius:"14px",padding:"16px 20px",textAlign:"center",fontSize:"13.5px",color:c.errText,animation:"fadeIn 0.3s",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px" }}>
            <span>{error}</span>
            <button onClick={handleSubmit} style={{ fontSize:"12.5px",fontWeight:"500",padding:"7px 18px",borderRadius:"8px",border:`1px solid ${c.errBorder}`,background:c.err,color:c.errText,cursor:"pointer" }}>Coba lagi</button>
          </div>
        )}

        {/* Results */}
        {result&&(
          <div ref={resultRef}>
            <div style={{ borderRadius:"16px",padding:"20px 22px",marginBottom:"16px",background:c.empathy,borderLeft:`3px solid ${c.leftBar}`,animation:"cardIn 0.5s ease-out",transition:"background 0.35s" }}>
              <p style={{ fontSize:"15px",lineHeight:"1.85",color:c.text2,fontStyle:"italic",transition:"color 0.35s" }}>{result.empathy}</p>
            </div>

            <Divider label="Ayat-Ayat Untukmu"/>

            <div style={{ display:"flex",flexDirection:"column",gap:"12px",marginBottom:"24px" }}>
              {result.verses?.map((v,i)=><VerseCard key={i} verse={v} index={i} c={c}/>)}
            </div>

            <Divider/>

            {result.wisdom&&(
              <div style={{ textAlign:"center",padding:"24px 22px",borderRadius:"16px",background:c.wisdom,border:`1px solid ${c.border}`,marginBottom:"12px",animation:`cardIn 0.5s ease-out ${0.15+(result.verses?.length||0)*0.12+0.2}s both`,transition:"background 0.35s, border-color 0.35s" }}>
                <GradText style={{ fontSize:"10.5px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"1.5px" }}>Hikmah</GradText>
                <p style={{ fontSize:"15px",lineHeight:"1.85",color:c.text3,margin:"12px auto 0",maxWidth:"440px",transition:"color 0.35s" }}>{result.wisdom}</p>
              </div>
            )}

            {result.dua&&(
              <div style={{ textAlign:"center",padding:"24px 22px",borderRadius:"16px",background:c.dua,border:`1px solid ${c.duaBorder}`,marginBottom:"28px",animation:`cardIn 0.5s ease-out ${0.15+(result.verses?.length||0)*0.12+0.35}s both`,transition:"background 0.35s, border-color 0.35s" }}>
                <GradText style={{ fontSize:"10.5px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"1.5px" }}>Doa Untukmu</GradText>
                <p style={{ fontFamily:"'Amiri',serif",fontSize:"22px",lineHeight:"2.2",color:c.arabicText,margin:"14px 0 4px",direction:"rtl",transition:"color 0.35s" }}>{result.dua}</p>
                {result.dua_transliteration&&<p style={{ fontSize:"13px",color:c.translitText,fontStyle:"italic",margin:"6px 0",opacity:0.8,transition:"color 0.35s" }}>{result.dua_transliteration}</p>}
                {result.dua_translation&&<p style={{ fontSize:"13px",color:c.text3,margin:"4px 0 0",transition:"color 0.35s" }}>{result.dua_translation}</p>}
              </div>
            )}

            <div style={{ textAlign:"center" }}>
              <button onClick={handleReset} style={{ fontSize:"13.5px",fontWeight:"500",padding:"12px 30px",borderRadius:"11px",border:`1px solid ${c.accentBorder}`,background:c.dua,color:c.text3,cursor:"pointer",transition:"background 0.25s, color 0.25s, border-color 0.25s" }}
                onMouseEnter={e=>{e.target.style.background=c.sugHover;e.target.style.color=c.text}}
                onMouseLeave={e=>{e.target.style.background=c.dua;e.target.style.color=c.text3}}>
                ✦ Ceritakan hal lain
              </button>
            </div>
          </div>
        )}

        <footer style={{ textAlign:"center",marginTop:"52px",padding:"20px 0",borderTop:`1px solid ${c.border}`,transition:"border-color 0.35s" }}>
          <p style={{ fontSize:"11.5px",color:c.text4,marginBottom:"3px",transition:"color 0.35s" }}>Shifā — Al-Qur'an sebagai penyembuh hati</p>
          <p style={{ fontSize:"10.5px",color:c.text5,transition:"color 0.35s" }}>Powered by AI · Selalu verifikasi dengan ulama terpercaya</p>
        </footer>
      </main>
    </div>
  );
}
