const fs = require('fs');
const content = fs.readFileSync('src/lib/reaggregate.cjs', 'utf8');

// Extract getZone function
const startTag = 'function getZone(locStr) {';
const startIdx = content.indexOf(startTag);
const endIdx = content.indexOf('}', startIdx + startTag.length); // This might be wrong if there are nested braces
// Let's just include the whole file but wrap it
const script = content + "\nconsole.log(getZone('JERRY PORRICELLI - BRONX, NY'));";
fs.writeFileSync('test_zone.cjs', script);
