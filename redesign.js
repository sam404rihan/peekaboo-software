const fs = require('fs');
const glob = require('glob');

// Use hardcoded path since we know it
const files = [
  ...glob.sync('c:/Users/sam/Desktop/peekaboo/app/(dashboard)/**/*.tsx'),
  ...glob.sync('c:/Users/sam/Desktop/peekaboo/components/**/*.tsx')
];

let replacedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Generic Cards & Borders
  content = content.replace(/border border-gray-200/g, 'border-2 border-slate-200 rounded-2xl shadow-[4px_4px_0_0_#cbd5e1]');
  content = content.replace(/border border-gray-300/g, 'border-2 border-slate-200 rounded-xl shadow-sm');
  
  // Headers
  content = content.replace(/text-gray-900 font-serif/g, 'text-slate-800 font-extrabold tracking-tight');
  content = content.replace(/text-gray-900/g, 'text-slate-800');
  content = content.replace(/text-gray-700/g, 'text-slate-700 font-bold');
  content = content.replace(/text-gray-500/g, 'text-slate-500 font-medium');
  
  // Primary buttons (blue -> primary/orange)
  content = content.replace(/bg-blue-600 text-white hover:bg-blue-700/g, 'bg-primary text-white border-2 border-primary shadow-[4px_4px_0_0_#FB923C] hover:translate-y-px hover:shadow-none transition-all font-bold');
  content = content.replace(/bg-blue-600/g, 'bg-primary');
  content = content.replace(/text-blue-600/g, 'text-primary');
  content = content.replace(/text-blue-700/g, 'text-primary font-bold');
  
  // Rounded corners
  content = content.replace(/rounded-md/g, 'rounded-xl');
  content = content.replace(/rounded-lg/g, 'rounded-2xl');

  // Specific Date inputs
  content = content.replace(/bg-white border-gray-300/g, 'bg-white border-2 border-slate-200 rounded-xl shadow-inner focus:border-primary focus:ring-4 focus:ring-primary/20');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    replacedCount++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`\nRedesigned ${replacedCount} files successfully.`);
