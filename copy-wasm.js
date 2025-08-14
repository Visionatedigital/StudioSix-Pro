const fs = require('fs');
const path = require('path');

// Copy web-ifc WASM files to public directory
const sourceDir = path.join(__dirname, 'node_modules', 'web-ifc');
const targetDir = path.join(__dirname, 'public', 'wasm');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
  'web-ifc.wasm',
  'web-ifc-mt.wasm',
  'web-ifc-mt.worker.js',
  'web-ifc-node.wasm'
];

filesToCopy.forEach(filename => {
  const sourcePath = path.join(sourceDir, filename);
  const targetPath = path.join(targetDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Copied ${filename} to public/wasm/`);
  } else {
    console.log(`⚠️ ${filename} not found in node_modules/web-ifc/`);
  }
});

console.log('🎉 WASM files setup complete!');