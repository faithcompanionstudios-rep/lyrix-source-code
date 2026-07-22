const fs = require('fs');

const helpPath = 'public/help.html';
let content = fs.readFileSync(helpPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Rename nav links and headers
content = content.replace(/8. Admin & Maintenance/g, '8. Advanced Settings & Maintenance');
content = content.replace(/8. Admin & Database Maintenance/g, '8. Advanced Settings & Maintenance');

// 2. Replace Admin Login pill references
content = content.replace(/Admin Login/g, 'Advanced Settings');
content = content.replace(/Admin panel/g, 'Advanced Settings panel');

// 3. Add a section explaining the Security tab
const oldImportSection = `<li><strong>Bulk Import (XML, PPTX, JSON & More):</strong>`;
const newSecuritySection = `<li><strong>Security (Password Protection):</strong> By default, Advanced Settings is protected by a password. In the <span class="path-pill">Security</span> tab, you can disable this requirement altogether by toggling off <strong>"Require Password"</strong>. Once disabled, you can access Advanced Settings or execute critical actions instantly without entering a password.</li>
                            <li><strong>Bulk Import (XML, PPTX, JSON & More):</strong>`;

content = content.replace(oldImportSection, newSecuritySection);

fs.writeFileSync(helpPath, content, 'utf8');
console.log('Patched help.html!');
