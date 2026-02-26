const fs = require('fs');
const path = 'C:/Users/Jonathan/.openclaw/workspace/Alpha/app/index.html';
let html = fs.readFileSync(path, 'utf8');

const css = `
/* Lightbox Styles */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  backdrop-filter: blur(10px);
}
.lightbox.open {
  opacity: 1;
  pointer-events: auto;
}
.lightbox-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  z-index: 10000;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
}
.lightbox-btn {
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}
.lightbox-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }
.lightbox-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
.lightbox-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.3s ease;
}
.lightbox-media.fill {
  object-fit: cover;
  width: 100%;
  height: 100%;
}
`;

if (!html.includes('.lightbox')) {
  html = html.replace('</style>', css + '\n    </style>');
}

const modalHtml = `
    <div id="lightbox" class="lightbox">
      <div class="lightbox-header">
        <button id="lbZoomOutBtn" class="lightbox-btn" title="Zoom Out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button id="lbZoomInBtn" class="lightbox-btn" title="Zoom In">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button id="lbFillBtn" class="lightbox-btn" title="Toggle Fill Screen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>
        <button id="lbCloseBtn" class="lightbox-btn" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="lightbox-content" id="lbContent"></div>
    </div>
`;

if (!html.includes('id="lightbox"')) {
  html = html.replace('</body>', modalHtml + '\n  </body>');
}

const js = `
      let lbZoom = 1;
      function getMediaUrl(asset) {
        return asset.url || asset.previewUrl || ('/api/library/assets/' + asset.id + '/derivative');
      }
      function openLightbox(asset) {
        lbZoom = 1;
        const url = getMediaUrl(asset);
        $('lbContent').innerHTML = asset.type === 'video' 
          ? \`<video src="\${url}" controls autoplay class="lightbox-media" id="lbMedia"></video>\`
          : \`<img src="\${url}" class="lightbox-media" id="lbMedia" />\`;
        $('lightbox').classList.add('open');
        updateLbZoom();
      }
      function closeLightbox() {
        $('lightbox').classList.remove('open');
        $('lbContent').innerHTML = '';
      }
      function updateLbZoom() {
        const media = $('lbMedia');
        if (media) {
          media.style.transform = \`scale(\${lbZoom})\`;
        }
      }
      
      // Setup listeners via DOMContentLoaded to ensure elements exist
      document.addEventListener("DOMContentLoaded", () => {
        const attachLb = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
        attachLb('lbCloseBtn', closeLightbox);
        attachLb('lbFillBtn', () => { const m = $('lbMedia'); if (m) m.classList.toggle('fill'); });
        attachLb('lbZoomInBtn', () => { lbZoom = Math.min(lbZoom + 0.5, 5); updateLbZoom(); });
        attachLb('lbZoomOutBtn', () => { lbZoom = Math.max(lbZoom - 0.5, 0.5); updateLbZoom(); });
      });

      // Handle Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $('lightbox')?.classList.contains('open')) {
          closeLightbox();
        }
      });
`;

if (!html.includes('openLightbox')) {
  html = html.replace('const state = {', js + '\n      const state = {');
}

// Modify mediaCard
html = html.replace(/<div class="thumb">\$\{media\}<\/div>/g, `<div class="thumb" style="cursor:pointer;" onclick='openLightbox(' + JSON.stringify(asset) + ')'>\${media}</div>`);

// Also fix image preview source resolution in mediaCard / libraryMediaCard if they are missing
// Find `<img src="${asset.previewUrl}"` and replace with `src="${getMediaUrl(asset)}"`
html = html.replace(/src="\$\{asset\.previewUrl\}"/g, `src="\${getMediaUrl(asset)}"`);

fs.writeFileSync(path, html);
console.log('Patch complete.');
