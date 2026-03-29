const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
};

const base = 'c:/Users/sam/Desktop/peekaboo/app/(dashboard)';
const files = walk(base).filter(f => f.endsWith('.tsx') && !f.endsWith('layout.tsx'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove imports
  content = content.replace(/import\s+Sidebar\s+from.*?[\r\n]+/g, '');
  content = content.replace(/import\s*\{\s*Topbar\s*\}\s*from.*?[\r\n]+/g, '');
  
  // Remove Sidebar
  content = content.replace(/<Sidebar[\s]*\/>/g, '');
  
  // Remove Topbar
  content = content.replace(/<Topbar[\s]*\/>/g, '');
  
  // Remove <div className="flex h-[100%]"></div>
  content = content.replace(/<div\s+className="flex\s+h-\[100%\]">\s*<\/div>/g, '');
  
  // Downgrade h-screen to h-full and min-h-screen to h-full
  content = content.replace(/h-screen/g, 'h-full');
  content = content.replace(/min-h-screen/g, 'h-full');
  
  fs.writeFileSync(file, content, 'utf8');
});

console.log("Cleanup complete!");
