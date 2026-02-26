const fs = require('fs');
const path = 'C:/Users/Jonathan/.openclaw/workspace/Alpha/app/index.html';
let html = fs.readFileSync(path, 'utf8');

// Change openLightbox signature
html = html.replace('function openLightbox(asset) {', 'function openLightbox(url, type) {');

// Fix getMediaUrl call inside openLightbox
html = html.replace('const url = getMediaUrl(asset);', '');
html = html.replace("asset.type === 'video'", "type === 'video'");

// Replace the broken onclick in mediaCard and libraryMediaCard
// The broken string is: onclick='openLightbox(' + JSON.stringify(asset) + ')'
// We need to replace it with: onclick="openLightbox('${getMediaUrl(asset)}', '${asset.type}')"

html = html.replace(/onclick='openLightbox\(' \+ JSON\.stringify\(asset\) \+ '\)'/g, "onclick=\"openLightbox('${getMediaUrl(asset)}', '${asset.type}')\"");

fs.writeFileSync(path, html);
console.log('Fixed onclick properly');
