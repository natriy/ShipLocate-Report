const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const locationsCsvPath = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_locations_202604232346.csv';
const masterMappingPath = path.join(__dirname, 'zone_master_mapping.csv');

// --- TOOLS ---
function splitCsv(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"'; i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractZip(address) {
  if (!address) return null;
  
  // 1. Try to find 5 digits at the very end of the string (ignoring country name)
  const zipAtEnd = address.match(/(\d{5})(?:,?\s*(?:USA|United States))?\s*$/i);
  if (zipAtEnd) return zipAtEnd[1];

  // 2. Try to find State + 5 digits anywhere (e.g. "FL 33018", "Florida 33018")
  const zipWithState = address.match(/(?:\b[A-Z]{2}\b|[A-Z][a-z]+)\s+(\d{5})\b/);
  if (zipWithState) return zipWithState[1];

  // 3. Canada Postal Code
  const caZip = address.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
  if (caZip) return caZip[0].toUpperCase().replace(/\s/g, '');

  return null;
}

// --- LOAD MASTER MAP ---
const zoneMap = {};
const mappingLines = fs.readFileSync(masterMappingPath, 'utf8').split('\n').filter(line => line && !line.startsWith('#') && line.includes(','));
mappingLines.forEach(line => {
  const [prefix, zone] = line.split(',');
  if (prefix !== 'prefix') zoneMap[prefix] = zone;
});

// --- AUDIT LOGIC ---
const audit = {
  total: 0,
  mappedByZip: 0,
  mappedByFallback: 0,
  unmapped: 0,
  zones: {},
  problems: [],
  specifics: []
};

const targets = ["Prestige Produce", "Jetro", "Teddy Bear"];

try {
  const locs = fs.readFileSync(locationsCsvPath, 'utf8').split('\n');
  const headers = splitCsv(locs[0]);
  const nameIdx = headers.indexOf('name');
  const addrIdx = headers.indexOf('address');

  locs.slice(1).forEach(line => {
    if (!line.trim()) return;
    audit.total++;
    const parts = splitCsv(line);
    const name = parts[nameIdx] || 'UNKNOWN';
    const address = parts[addrIdx] || '';
    const addressUpper = address.toUpperCase();
    
    let zone = null;
    let method = 'NONE';
    
    // 1. ZIP Check
    const zip = extractZip(address);
    if (zip) {
      const zip3 = zip.match(/^\d{3}/)?.[0];
      const zip1 = zip.match(/^[A-Z]/)?.[0];
      const prefix = zip3 || zip1;
      
      if (prefix && zoneMap[prefix]) {
        zone = zoneMap[prefix];
        method = 'ZIP';
        audit.mappedByZip++;
      }
    }
    
    // 2. Fallback Check
    if (!zone) {
      if (/\b(QC|QUEBEC)\b/.test(addressUpper)) zone = '🇨🇦 Quebec';
      if (/\b(ON|ONTARIO|TORONTO|MISSISSAUGA)\b/.test(addressUpper)) zone = '🇨🇦 Ontario';
      if (/\b(NB|NS|PE|NL|PRINCE EDWARD ISLAND)\b/.test(addressUpper)) zone = '🇨🇦 Atlantic Canada';
      if (/\b(OH|OHIO)\b/.test(addressUpper)) zone = '🇺🇸 Ohio Valley (OH)';
      if (/\b(IL|IN|MO|ILLINOIS|INDIANA|MISSOURI|CHICAGO)\b/.test(addressUpper)) zone = '🇺🇸 Midwest (IL/IN/MO)';
      if (/\b(MN|MINNESOTA)\b/.test(addressUpper)) zone = '🇺🇸 Upper Midwest (MN)';
      if (/\b(MI|WI|MICHIGAN|WISCONSIN|DETROIT)\b/.test(addressUpper)) zone = '🇺🇸 Great Lakes (MI/WI)';
      if (/\b(FL|FLORIDA)\b/.test(addressUpper)) zone = '🇺🇸 Florida (grouped)';
      if (/\b(NY|NEW YORK)\b/.test(addressUpper)) zone = '🇺🇸 Upstate NY';
      
      if (zone) {
        method = 'FALLBACK';
        audit.mappedByFallback++;
      }
    }

    if (zone) {
      audit.zones[zone] = (audit.zones[zone] || 0) + 1;
    } else {
      audit.unmapped++;
      if (audit.problems.length < 10) {
        audit.problems.push({ name, address, zip });
      }
    }

    // Check Targets
    if (targets.some(t => name.includes(t))) {
      audit.specifics.push({ name, address, zip, zone, method });
    }
  });

  // --- REPORT ---
  console.log('\n=== SHIPLOCATE DATA MAPPING AUDIT ===');
  console.log(`Total Locations Scanned: ${audit.total}`);
  console.log(`Mapped by ZIP:           ${audit.mappedByZip} (${Math.round(audit.mappedByZip/audit.total*100)}%)`);
  console.log(`Mapped by Keywords:      ${audit.mappedByFallback} (${Math.round(audit.mappedByFallback/audit.total*100)}%)`);
  console.log(`Unmapped (Other):        ${audit.unmapped} (${Math.round(audit.unmapped/audit.total*100)}%)`);
  
  console.log('\n--- TARGET ANALYSIS ---');
  audit.specifics.forEach(s => {
    console.log(`\nName:    ${s.name}`);
    console.log(`Address: ${s.address}`);
    console.log(`ZIP:     ${s.zip || 'NOT FOUND'}`);
    console.log(`Zone:    ${s.zone || '🇺🇸 Other'}`);
    console.log(`Method:  ${s.method}`);
  });

  console.log('\n--- TOP UNMAPPED SAMPLES ---');
  audit.problems.forEach(p => {
    console.log(`- ${p.name}: ${p.address} (ZIP: ${p.zip || '?'})`);
  });

  console.log('\n--- ZONE DISTRIBUTION ---');
  Object.entries(audit.zones).sort((a,b) => b[1]-a[1]).forEach(([z, count]) => {
    console.log(`${z.padEnd(30)} : ${count}`);
  });

} catch (e) {
  console.error("Audit failed:", e.message);
}
