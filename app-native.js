/* =================================================================
   Dapur Parto — jembatan ke fitur Android (Capacitor).
   Di browser biasa file ini tidak melakukan apa-apa.
================================================================= */
(function(){
  const C = window.Capacitor;
  if(!(C && C.isNativePlatform && C.isNativePlatform())) return;
  const P = n => (C.Plugins && C.Plugins[n]) || C.registerPlugin(n);
  const App = P('App'), Share = P('Share'), Filesystem = P('Filesystem'),
        SplashScreen = P('SplashScreen'), StatusBar = P('StatusBar');

  document.documentElement.classList.add('native');
  // Cetak (window.print) tidak didukung di WebView Android — sembunyikan tombolnya
  const printBtn = document.getElementById('btnDoPrint');
  if(printBtn) printBtn.classList.add('hidden');
  const toolbar = document.querySelector('.receipt-toolbar');
  if(toolbar) toolbar.style.gridTemplateColumns = '1fr';

  // Splash bawaan Android -> splash web (tampilan identik), lalu animasi masuk
  try{ SplashScreen.hide({ fadeOutDuration: 150 }); }catch(e){}
  try{ StatusBar.setStyle({ style: 'LIGHT' }); }catch(e){}

  // Tombol back Android: tutup lapisan teratas dulu, lalu ke Beranda, lalu minimize
  App.addListener('backButton', ()=>{
    if(window.__closeTopSheet){ window.__closeTopSheet(); return; }
    const pop = document.getElementById('dpDatePopover');
    if(pop && !pop.classList.contains('hidden')){ pop.classList.add('hidden'); return; }
    const receipt = document.getElementById('receiptOverlay');
    if(receipt && receipt.classList.contains('show')){ receipt.classList.remove('show'); return; }
    const active = document.querySelector('nav.tabs button.active');
    if(active && active.dataset.tab !== 'dashboard'){
      document.querySelector('nav.tabs [data-tab="dashboard"]').click(); return;
    }
    App.minimizeApp();
  });

  async function writeImage(dataUrl, name, directory){
    const base64 = dataUrl.split(',')[1];
    return Filesystem.writeFile({ path: name, data: base64, directory });
  }

  window.DPNative = {
    // Share sheet Android: WhatsApp, Instagram (Feed/Story/Direct), dll.
    async shareImage(dataUrl, name){
      const { uri } = await writeImage(dataUrl, name, 'CACHE');
      await Share.share({ title: 'Struk Dapur Parto', files: [uri], dialogTitle: 'Bagikan struk' });
    },
    // Simpan ke Galeri (album "Dapur Parto"); kalau gagal, ke Documents/Struk
    async saveImage(dataUrl, name){
      try{
        const Media = P('Media');
        const ALBUM = 'Dapur Parto';
        const find = async ()=> ((await Media.getAlbums()).albums||[]).find(a=>a.name===ALBUM);
        let album = await find();
        if(!album){ await Media.createAlbum({ name: ALBUM }); album = await find(); }
        await Media.savePhoto({ path: dataUrl, albumIdentifier: album && album.identifier, fileName: name.replace(/\.jpe?g$/i,'') });
        window.showToast && showToast('Struk tersimpan di Galeri › Dapur Parto');
        return;
      }catch(e){ /* lanjut ke Documents */ }
      const { uri } = await writeImage(dataUrl, 'Struk/'+name, 'DOCUMENTS').catch(async ()=>{
        await Filesystem.mkdir({ path: 'Struk', directory: 'DOCUMENTS', recursive: true }).catch(()=>{});
        return writeImage(dataUrl, 'Struk/'+name, 'DOCUMENTS');
      });
      window.showToast && showToast('Tersimpan: Documents/Struk/'+name);
      return uri;
    },
  };
})();
