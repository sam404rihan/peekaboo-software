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

  // Strip bg-slate-50, bg-gray-50, bg-background, bg-white from the outermost flex wrapper 
  // We can just forcefully replace it:
  content = content.replace(/className="flex (w-full |flex-1 |h-full |flex-col |overflow-hidden |md:ml-1 )*bg-(slate|gray)-50"/g, (match) => {
    return match.replace(/bg-(slate|gray)-50/, 'bg-transparent');
  });
  
  // also catch general full-width flex containers that have bg-
  content = content.replace(/className="flex w-full h-full bg-[a-z0-9-]+"/g, 'className="flex w-full h-full bg-transparent"');
  content = content.replace(/className="flex h-full w-full bg-[a-z0-9-]+"/g, 'className="flex w-full h-full bg-transparent"');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Cleanup bg complete!");
