/* =================================================================
   Dapur Parto — Login (email + password) & sidik jari (Android app)
   - Web (GitHub Pages): login email + password saja.
   - App Android (Capacitor): setelah login pertama bisa aktifkan sidik jari.
     Email+password disimpan di Android Keystore, terkunci biometrik
     (tidak bisa dibaca tanpa scan sidik jari yang valid).
   Butuh: `sb` (Supabase client) & `startApp()` dari index.html.
================================================================= */
(function(){
  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = n => IS_NATIVE ? ((window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || window.Capacitor.registerPlugin(n)) : null;
  const Bio = plugin('NativeBiometric');
  const AppP = plugin('App');
  const BIO_SERVER = 'dapurparto.app';
  const BIO_FLAG = 'dp_bio_enabled';
  const LOCK_AFTER_MS = 5 * 60 * 1000; // kunci ulang kalau app di-background > 5 menit

  const ls = {
    get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} },
  };

  let started = false;
  let bioAvailable = false;

  /* ---------- UI ---------- */
  const css = `
  #authScreen{position:fixed;inset:0;z-index:2000;background:var(--ground,#F4F5F1);display:flex;align-items:center;justify-content:center;
    padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));overflow:auto;}
  #authScreen.hidden{display:none;}
  .auth-card{width:100%;max-width:360px;text-align:center;}
  .auth-card img{width:84px;height:84px;margin-bottom:12px;}
  .auth-card h1{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:28px;line-height:1.1;margin:0;color:#3E4722;}
  .auth-card .auth-sub{margin:2px 0 26px;color:var(--muted,#5A6055);font-size:13px;}
  .auth-card form{text-align:left;}
    .auth-card input{margin-bottom:14px;}
    .auth-btn{width:100%;height:48px;border-radius:var(--radius-control,6px);border:none;font:inherit;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
  .auth-btn.primary{background:var(--primary,#171A14);color:#fff;}
  .auth-btn.primary:disabled{opacity:.6;}
  .auth-btn.outline{background:var(--surface,#fff);color:var(--text,#171A14);border:1px solid var(--control,#CFD4C9);margin-top:10px;}
  .auth-fp{width:64px;height:64px;margin:4px auto 12px;border-radius:50%;background:var(--active,#ECEEE8);display:flex;align-items:center;justify-content:center;}
  .auth-fp svg{width:32px;height:32px;stroke:var(--text,#171A14);fill:none;stroke-width:1.5;stroke-linecap:round;}
  .auth-err{color:var(--red,#B4453A);font-size:13px;min-height:18px;margin:-4px 0 10px;}
  .auth-link{background:none;border:none;color:var(--muted,#5A6055);font:inherit;font-size:13px;margin-top:16px;text-decoration:underline;cursor:pointer;}
  .acct-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border,#DDE1DA);}
  .acct-row:first-of-type{border-top:none;}
  .acct-row .muted{color:var(--muted,#5A6055);font-size:12px;}
  .switch{position:relative;width:44px;height:26px;flex:none;}
  .switch input{opacity:0;width:0;height:0;}
  .switch span{position:absolute;inset:0;background:#cfd4cc;border-radius:26px;transition:.2s;}
  .switch span:before{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;}
  .switch input:checked + span{background:var(--primary,#3D6B3A);}
  .switch input:checked + span:before{transform:translateX(18px);}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const screen = document.createElement('div');
  screen.id = 'authScreen';
  screen.innerHTML = `
    <div class="auth-card">
      <img src="icon-192.png" alt="">
      <h1>Dapur Parto</h1>
      <p class="auth-sub">Masuk untuk melanjutkan</p>

      <div id="authLock" class="hidden">
        <div class="auth-fp"><svg viewBox="0 0 24 24"><path d="M7.5 4.8A8.5 8.5 0 0 1 20.5 12v1.5"/><path d="M3.5 12a8.5 8.5 0 0 1 2-5.5"/><path d="M6.5 16.5V12a5.5 5.5 0 0 1 11 0v2"/><path d="M9.5 19.5V12a2.5 2.5 0 0 1 5 0v4.5c0 1.5.5 3 1.5 4"/><path d="M12 12v5.5c0 1.5.5 2.5 1 3.5"/><path d="M3.5 15.5v1"/></svg></div>
        <p style="margin:0 0 18px;color:var(--muted,#5A6055);">Buka dengan sidik jari</p>
        <button class="auth-btn primary" id="authUnlockBtn" type="button">Scan sidik jari</button>
        <button class="auth-link" id="authUsePassword" type="button">Masuk pakai email & password</button>
      </div>

      <form id="authForm" class="hidden" autocomplete="on">
        <label for="authEmail">Email</label>
        <input id="authEmail" type="email" inputmode="email" autocomplete="username" required>
        <label for="authPass">Password</label>
        <input id="authPass" type="password" autocomplete="current-password" required>
        <div class="auth-err" id="authErr"></div>
        <button class="auth-btn primary" id="authSubmit" type="submit">Masuk</button>
        <button class="auth-btn outline hidden" id="authFpBtn" type="button"><svg style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;" viewBox="0 0 24 24"><path d="M7.5 4.8A8.5 8.5 0 0 1 20.5 12v1.5"/><path d="M3.5 12a8.5 8.5 0 0 1 2-5.5"/><path d="M6.5 16.5V12a5.5 5.5 0 0 1 11 0v2"/><path d="M9.5 19.5V12a2.5 2.5 0 0 1 5 0v4.5c0 1.5.5 3 1.5 4"/><path d="M12 12v5.5c0 1.5.5 2.5 1 3.5"/><path d="M3.5 15.5v1"/></svg>Masuk dengan sidik jari</button>
      </form>
    </div>`;
  document.body.appendChild(screen);
  const $ = id => document.getElementById(id);

  function showScreen(mode){ // 'login' | 'lock' | null
    if(!mode){ screen.classList.add('hidden'); return; }
    if(window.hideSplash) window.hideSplash();
    screen.classList.remove('hidden');
    $('authLock').classList.toggle('hidden', mode!=='lock');
    $('authForm').classList.toggle('hidden', mode!=='login');
    if(mode==='login'){
      $('authFpBtn').classList.toggle('hidden', !bioEnabled());
      $('authErr').textContent = '';
    }
  }

  /* ---------- biometrik ---------- */
  const bioEnabled = () => IS_NATIVE && bioAvailable && ls.get(BIO_FLAG)==='1';

  async function checkBio(){
    if(!Bio) return false;
    try{ const r = await Bio.isAvailable(); return !!r.isAvailable; }catch(e){ return false; }
  }
  async function verify(){
    try{
      await Bio.verifyIdentity({ title:'Dapur Parto', subtitle:'Scan sidik jari untuk masuk', negativeButtonText:'Batal', maxAttempts:5 });
      return true;
    }catch(e){ return false; }
  }
  async function enableBio(email, password){
    try{
      await Bio.setCredentials({ username:email, password, server:BIO_SERVER,
        accessControl:2 /* BIOMETRY_ANY */, title:'Aktifkan sidik jari', negativeButtonText:'Batal' });
      ls.set(BIO_FLAG,'1');
      return true;
    }catch(e){ return false; }
  }
  async function disableBio(){
    ls.del(BIO_FLAG);
    try{ await Bio.deleteCredentials({ server:BIO_SERVER }); }catch(e){}
  }
  async function bioSignIn(){
    let cred;
    try{
      cred = await Bio.getSecureCredentials({ server:BIO_SERVER, title:'Dapur Parto', subtitle:'Scan sidik jari untuk masuk', negativeButtonText:'Batal' });
    }catch(e){ return; } // dibatalkan / gagal scan
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email:cred.username, password:cred.password });
    setBusy(false);
    if(error){
      await disableBio();
      showScreen('login');
      $('authEmail').value = cred.username;
      $('authErr').textContent = 'Password sudah berubah. Masuk lagi pakai password baru.';
      return;
    }
    enter();
  }

  /* ---------- alur ---------- */
  function setBusy(b){ $('authSubmit').disabled = b; $('authSubmit').textContent = b ? 'Memproses…' : 'Masuk'; }

  function friendlyError(err){
    const m = (err && err.message || '').toLowerCase();
    if(m.includes('invalid login')) return 'Email atau password salah.';
    if(m.includes('email not confirmed')) return 'Email belum dikonfirmasi.';
    if(m.includes('fetch') || m.includes('network')) return 'Tidak ada koneksi internet.';
    return err && err.message || 'Gagal masuk.';
  }

  function askYesNo(msg, yes, no){
    return new Promise(resolve=>{
      const o = document.createElement('div');
      o.style.cssText='position:fixed;inset:0;background:rgba(20,24,18,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:20px;';
      o.innerHTML = `<div style="background:#fff;border-radius:16px;padding:22px;max-width:320px;width:100%;text-align:center;font-family:'Inter',sans-serif;">
        <div class="auth-fp"><svg viewBox="0 0 24 24"><path d="M7.5 4.8A8.5 8.5 0 0 1 20.5 12v1.5"/><path d="M3.5 12a8.5 8.5 0 0 1 2-5.5"/><path d="M6.5 16.5V12a5.5 5.5 0 0 1 11 0v2"/><path d="M9.5 19.5V12a2.5 2.5 0 0 1 5 0v4.5c0 1.5.5 3 1.5 4"/><path d="M12 12v5.5c0 1.5.5 2.5 1 3.5"/><path d="M3.5 15.5v1"/></svg></div>
        <p style="margin:0 0 18px;font-size:14px;color:#20241F;line-height:1.5;">${msg}</p>
        <button class="auth-btn primary" data-v="1" type="button">${yes}</button>
        <button class="auth-link" data-v="0" type="button">${no}</button></div>`;
      o.addEventListener('click', e=>{ const v=e.target.getAttribute('data-v'); if(v!==null){ o.remove(); resolve(v==='1'); } });
      document.body.appendChild(o);
    });
  }

  $('authForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const email = $('authEmail').value.trim(), password = $('authPass').value;
    $('authErr').textContent = '';
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if(error){ $('authErr').textContent = friendlyError(error); return; }
    $('authPass').value = '';
    if(IS_NATIVE && bioAvailable && ls.get(BIO_FLAG)!=='1'){
      const ok = await askYesNo('Aktifkan masuk dengan sidik jari? Lain kali tidak perlu ketik password.', 'Aktifkan', 'Nanti saja');
      if(ok) await enableBio(email, password);
    }
    enter();
  });
  $('authFpBtn').addEventListener('click', bioSignIn);
  $('authUnlockBtn').addEventListener('click', unlock);
  $('authUsePassword').addEventListener('click', async ()=>{ await sb.auth.signOut({ scope:'local' }); showScreen('login'); });

  async function unlock(){ if(await verify()) enter(); }

  function enter(){
    showScreen(null);
    renderAccountPanel();
    if(!started){ started = true; window.startApp(); }
  }

  async function boot(){
    bioAvailable = await checkBio();
    const { data:{ session } } = await sb.auth.getSession();
    if(session){
      if(bioEnabled()){ showScreen('lock'); unlock(); }
      else enter();
    }else{
      showScreen('login');
      if(bioEnabled()) bioSignIn();
    }
  }

  // sesi dicabut / kadaluarsa di server → kembali ke login
  sb.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT' && started){ location.reload(); }
  });

  // kunci ulang saat kembali dari background
  if(AppP){
    let hiddenAt = 0;
    AppP.addListener('appStateChange', ({ isActive })=>{
      if(!isActive){ hiddenAt = Date.now(); return; }
      if(started && bioEnabled() && hiddenAt && Date.now()-hiddenAt > LOCK_AFTER_MS){
        showScreen('lock'); unlock();
      }
    });
  }

  /* ---------- panel Akun di tab Product/Settings ---------- */
  async function renderAccountPanel(){
    let panel = $('accountPanel');
    if(!panel){
      const host = document.getElementById('btnSaveShopInfo')?.closest('.panel');
      if(!host) return;
      panel = document.createElement('div');
      panel.className = 'panel settings-section';
      panel.id = 'accountPanel';
      host.after(panel);
    }
    const { data:{ user } } = await sb.auth.getUser();
    panel.innerHTML = `
      <h2>Akun</h2>
      <div class="acct-row"><div><div>${user ? user.email : '-'}</div><div class="muted">Sedang masuk</div></div></div>
      ${IS_NATIVE && bioAvailable ? `
      <div class="acct-row"><div><div>Masuk dengan sidik jari</div><div class="muted">Kunci otomatis setelah 5 menit di background</div></div>
        <label class="switch"><input type="checkbox" id="acctBio" ${bioEnabled()?'checked':''}><span></span></label></div>` : ''}
      <div class="acct-row"><div></div><button class="btn btn-secondary btn-sm" id="acctLogout" type="button">Keluar</button></div>`;
    $('acctLogout').addEventListener('click', async ()=>{ await sb.auth.signOut(); location.reload(); });
    const t = $('acctBio');
    if(t) t.addEventListener('change', async ()=>{
      if(t.checked){
        t.checked = false;
        const pw = await promptPassword(user.email);
        if(pw && await enableBio(user.email, pw)) t.checked = true;
      }else{
        await disableBio();
      }
    });
  }

  // konfirmasi password sebelum menyimpan ke Keystore (supaya yang tersimpan pasti benar)
  function promptPassword(email){
    return new Promise(resolve=>{
      const o = document.createElement('div');
      o.style.cssText='position:fixed;inset:0;background:rgba(20,24,18,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:20px;';
      o.innerHTML = `<form class="auth-card" style="background:#fff;border-radius:12px;padding:22px;text-align:left;">
        <p style="margin:0 0 14px;font-size:14px;">Masukkan password untuk mengaktifkan sidik jari.</p>
        <input type="password" id="ppPass" autocomplete="current-password" required>
        <div class="auth-err" id="ppErr"></div>
        <button class="auth-btn primary" type="submit">Lanjut</button>
        <button class="auth-link" type="button" id="ppCancel" style="display:block;margin:12px auto 0;">Batal</button></form>`;
      document.body.appendChild(o);
      o.querySelector('#ppCancel').onclick = ()=>{ o.remove(); resolve(null); };
      o.querySelector('form').onsubmit = async e=>{
        e.preventDefault();
        const pw = o.querySelector('#ppPass').value;
        const { error } = await sb.auth.signInWithPassword({ email, password:pw });
        if(error){ o.querySelector('#ppErr').textContent = friendlyError(error); return; }
        o.remove(); resolve(pw);
      };
      setTimeout(()=>o.querySelector('#ppPass').focus(), 50);
    });
  }

  boot();
})();
