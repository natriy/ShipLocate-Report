const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'mock-data.json');
const rawData = require(dataPath);
let loads = rawData.loads_raw.filter(l => l.loc_names && l.loc_names.length > 0);

// 1. Database Paths
const locationsCsvPath = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_locations_202604232346.csv';
const loadsCsvPath = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_loads_202604232346.csv';
const stopsCsvPath = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_stops_202604242216.csv';

const locationByIdMap = {};
const loadInfoMap = {};
const loadDepartureMap = {};
const loadStopsMap = {};

// Robust CSV splitter that handles commas inside quotes
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

try {
  // Load Locations for ZIP mapping BY ID
  if (fs.existsSync(locationsCsvPath)) {
    const locationsData = fs.readFileSync(locationsCsvPath, 'utf8');
    locationsData.split('\n').forEach((line, idx) => {
      if (idx === 0 || !line.trim()) return;
      const parts = splitCsv(line);
      if (parts.length >= 4) {
        const id = parts[0];
        const name = (parts[1] || '').trim().replace(/^"|"$/g, '');
        const address = (parts[3] || '').trim().replace(/^"|"$/g, '');
        let zip = null;
        if (address) {
          // Final Robust ZIP extraction
          const zipAtEnd = address.match(/(\d{5})(?:,?\s*(?:USA|United States))?\s*$/i);
          const zipWithState = address.match(/(?:\b[A-Z]{2}\b|[A-Z][a-z]+)\s+(\d{5})\b/);
          const caZip = address.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);

          if (zipAtEnd) zip = zipAtEnd[1];
          else if (zipWithState) zip = zipWithState[1];
          else if (caZip) zip = caZip[0].toUpperCase().replace(/\s/g, '');
        }
        locationByIdMap[id] = { name, address, zip };
      }
    });
  }

  // Load Load Numbers and Creation Timestamps
  if (fs.existsSync(loadsCsvPath)) {
    const loadsCsvData = fs.readFileSync(loadsCsvPath, 'utf8');
    loadsCsvData.split('\n').forEach((line, idx) => {
      if (idx === 0 || !line.trim()) return;
      const parts = splitCsv(line);
      if (parts.length >= 4) {
        loadInfoMap[parts[0]] = {
          number: parts[1],
          ts: parseInt(parts[3])
        };
      }
    });
  }

  // Load Stops to map loadId -> locationId
  if (fs.existsSync(stopsCsvPath)) {
    const stopsData = fs.readFileSync(stopsCsvPath, 'utf8');
    stopsData.split('\n').forEach((line, idx) => {
      if (idx === 0 || !line.trim()) return;
      const parts = splitCsv(line);
      if (parts.length >= 7) {
        const loadId = parts[1];
        const locationId = parts[2];
        const stopIndex = parseInt(parts[6] || '0', 10);
        const stopDateStr = parts[4]; // "2026-03-05 21:00:00.000"
        
        if (stopIndex === 0) {
          loadDepartureMap[loadId] = stopDateStr;
        }

        if (!loadStopsMap[loadId]) loadStopsMap[loadId] = [];
        loadStopsMap[loadId].push({ locationId, stopIndex });
      }
    });
  }
} catch (e) {
  console.error("Failed to load databases:", e.message);
}

// Load Master Zone Mapping
const masterMappingPath = path.join(__dirname, 'zone_master_mapping.csv');
const mappingLines = fs.readFileSync(masterMappingPath, 'utf8').split('\n').filter(line => line && !line.startsWith('#') && line.includes(','));
const zoneMap = {};
const zoneRates = {};

mappingLines.forEach(line => {
  const [prefix, zone, rate] = line.split(',');
  if (prefix !== 'prefix') {
    zoneMap[prefix] = zone;
    zoneRates[zone] = parseInt(rate);
  }
});

function getZoneFromLoc(loc) {
  if (!loc) return '🇺🇸 Other';
  const { zip, address } = loc;
  const upperAddress = (address || '').toUpperCase();
  
  if (zip) {
    // US ZIP (Numeric)
    const zipNum3 = zip.match(/^\d{3}/)?.[0];
    if (zipNum3 && zoneMap[zipNum3]) return zoneMap[zipNum3];

    // Canada Postal Code (Letter first)
    const zipLetter1 = zip.match(/^[A-Z]/)?.[0];
    if (zipLetter1 && zoneMap[zipLetter1]) return zoneMap[zipLetter1];
  }

  // Fallbacks by ADDRESS Keywords (Not name)
  if (/\b(QC|QUEBEC|MONTREAL|SHERRINGTON)\b/.test(upperAddress)) return '🇨🇦 Quebec';
  if (/\b(ON|ONTARIO|TORONTO|MISSISSAUGA|BRAMPTON)\b/.test(upperAddress)) return '🇨🇦 Ontario';
  if (/\b(NB|NS|PE|NL|PRINCE EDWARD ISLAND)\b/.test(upperAddress)) return '🇨🇦 Atlantic Canada';
  if (/\b(MB|SK|WINNIPEG)\b/.test(upperAddress)) return '🇨🇦 Prairies East (MB/SK)';
  if (/\b(OH|OHIO|CLEVELAND|COLUMBUS|CCincinnati|AKRON)\b/.test(upperAddress)) return '🇺🇸 Ohio Valley (OH)';
  if (/\b(IL|IN|MO|ILLINOIS|INDIANA|MISSOURI|CHICAGO|INDIANAPOLIS|KANSAS CITY)\b/.test(upperAddress)) return '🇺🇸 Midwest (IL/IN/MO)';
  if (/\b(MN|MINNESOTA|BROOKLYN PARK)\b/.test(upperAddress)) return '🇺🇸 Upper Midwest (MN)';
  if (/\b(MI|WI|MICHIGAN|WISCONSIN|DETROIT|MILWAUKEE|HUDSONVILLE)\b/.test(upperAddress)) return '🇺🇸 Great Lakes (MI/WI)';
  
  return '🇺🇸 Other';
}

// Process Loads
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
loads.forEach(load => {
  const info = loadInfoMap[load.id];
  if (info) load.load_number = info.number;
  const stopDateStr = loadDepartureMap[load.id];
  const creationTs = info ? info.ts : null;
  if (stopDateStr || creationTs) {
    let d;
    if (stopDateStr) d = new Date(stopDateStr.replace(' ', 'T') + 'Z');
    else d = new Date(creationTs);
    const localTs = d.getTime() - (4 * 60 * 60 * 1000);
    const localD = new Date(localTs);
    load.dow = dayNames[localD.getUTCDay()];
    const y = localD.getUTCFullYear(), m = String(localD.getUTCMonth() + 1).padStart(2, '0'), day = String(localD.getUTCDate()).padStart(2, '0');
    load.date = `${y}-${m}-${day}`;
    load.month = `${y}-${m}`;
  }
  
  // REAL DATABASE MAPPING LOGIC
  const stops = loadStopsMap[load.id] || [];
  stops.sort((a, b) => a.stopIndex - b.stopIndex);
  
  const newZones = [];
  const newNames = [];
  const detailedNames = [];
  
  // Locations that are Shippers/Origins and should NEVER be counted as Customers
  const SHIPPER_BLACKLIST = ['FMS - Sherrington QC', 'VEGIBEC - Oka, QC'];
  
  // SKIP THE FIRST STOP (Origin/Shipper)
  const deliveryStops = stops.slice(1);
  
  deliveryStops.forEach(s => {
    const loc = locationByIdMap[s.locationId];
    if (loc) {
       const locName = loc.name.trim();
       // Skip if it is in the blacklist
       if (SHIPPER_BLACKLIST.includes(locName)) return;

       newZones.push(getZoneFromLoc(loc));
       detailedNames.push(locName);
       let finalName = locName;
       // Collapse all Jetro branches into a single "Jetro" entity
       if (finalName.toUpperCase().includes('JETRO')) {
         finalName = 'Jetro';
       }
       newNames.push(finalName);
    }
  });

  if (newZones.length > 0) {
    load.zones = newZones;
    load.base_zone = newZones[newZones.length - 1];
    load.loc_names = newNames;
    load.detailed_names = detailedNames;
    load.delivery_count = newZones.length;
  } else {
    // If there is only 1 stop or something is wrong
    load.zones = [];
    load.base_zone = '🇺🇸 Other';
    load.loc_names = [];
    load.detailed_names = [];
    load.delivery_count = 0;
  }

  if (load.spend === null) {
    const baseRate = zoneRates[load.base_zone] || 0;
    if (baseRate > 0) load.spend = baseRate + (load.delivery_count - 1) * 100;
  }
});

// Aggregations
const monthlyMap = {}, dowMap = { 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0 };
const carriersMap = {}, customersMap = {}, zonesMap = {};
loads.forEach(l => {
  const spend = l.spend || 0, isMulti = l.trip_type === 'Multi';
  if (!monthlyMap[l.month]) monthlyMap[l.month] = { month: l.month, loads: 0, spend: 0, single: 0, multi: 0, carriersSet: new Set() };
  monthlyMap[l.month].loads++; monthlyMap[l.month].spend += spend;
  if (isMulti) monthlyMap[l.month].multi++; else monthlyMap[l.month].single++;
  monthlyMap[l.month].carriersSet.add(l.carrier);
  if (l.dow) dowMap[l.dow]++;
  if (!carriersMap[l.carrier]) carriersMap[l.carrier] = { name: l.carrier, loads: 0, spend: 0, single: 0, multi: 0, customers: {}, zones: {} };
  carriersMap[l.carrier].loads++; carriersMap[l.carrier].spend += spend;
  if (isMulti) carriersMap[l.carrier].multi++; else carriersMap[l.carrier].single++;
  l.loc_names.forEach(loc => { const cName = loc.trim(); carriersMap[l.carrier].customers[cName] = (carriersMap[l.carrier].customers[cName] || 0) + 1; });
  const bZone = l.base_zone;
  carriersMap[l.carrier].zones[bZone] = (carriersMap[l.carrier].zones[bZone] || 0) + 1;
  // Track customers in their RESPECTIVE zones (where the stop actually happened)
  l.loc_names.forEach((loc, index) => {
    const cName = loc.trim();
    const cZone = l.zones[index];
    if (!zonesMap[cZone]) {
       zonesMap[cZone] = { zone: cZone, loads: 0, spend: 0, single: 0, multi: 0, carriers: {}, customers: {}, rate: zoneRates[cZone] || null };
    }
    if (!zonesMap[cZone].customers[cName]) {
      zonesMap[cZone].customers[cName] = { name: cName, loads: 0, spend: 0 };
    }
    zonesMap[cZone].customers[cName].loads++;
    zonesMap[cZone].customers[cName].spend += Math.round(spend / l.delivery_count);
  });

  // Load-level stats still go to the final destination (bZone)
  zonesMap[bZone].loads++; zonesMap[bZone].spend += spend;
  if (isMulti) zonesMap[bZone].multi++; else zonesMap[bZone].single++;
  zonesMap[bZone].carriers[l.carrier] = (zonesMap[bZone].carriers[l.carrier] || 0) + 1;
  l.loc_names.forEach((loc, index) => {
    const cName = loc.trim();
    const cZone = l.zones[index];
    const rawLocName = l.detailed_names[index] || cName;

    if (!customersMap[cName]) {
      customersMap[cName] = { name: cName, zone: cZone, loads: 0, spend: 0, single: 0, multi: 0, carriers: {}, locations: {} };
    } else {
      // If we see the same customer in a DIFFERENT zone, mark it as Multi-Region
      if (customersMap[cName].zone !== cZone && customersMap[cName].zone !== 'Multi-Region') {
        customersMap[cName].zone = 'Multi-Region';
      }
    }

    customersMap[cName].loads++; customersMap[cName].spend += Math.round(spend / l.delivery_count);
    if (isMulti) customersMap[cName].multi++; else customersMap[cName].single++;
    customersMap[cName].carriers[l.carrier] = (customersMap[cName].carriers[l.carrier] || 0) + 1;
    
    // Track detailed locations within this customer
    if (!customersMap[cName].locations[rawLocName]) {
      customersMap[cName].locations[rawLocName] = { name: rawLocName, loads: 0, zone: cZone };
    }
    customersMap[cName].locations[rawLocName].loads++;
  });
});

const monthly = Object.values(monthlyMap).map(m => ({ ...m, carriers: m.carriersSet.size, carriersSet: undefined })).sort((a, b) => a.month.localeCompare(b.month));
const carriers = Object.values(carriersMap).map(c => ({
  ...c, customer_count: Object.keys(c.customers).length, avg: Math.round(c.spend / c.loads),
  rate: 95 + Math.floor(Math.random() * 5), top_zone: Object.entries(c.zones).sort((a, b) => b[1] - a[1])[0]?.[0] || null
})).sort((a, b) => b.loads - a.loads);
const customers = Object.values(customersMap).map(c => ({ ...c, top_carrier: Object.entries(c.carriers).sort((a, b) => b[1] - a[1])[0]?.[0] || null })).sort((a, b) => b.loads - a.loads);
const zones = Object.values(zonesMap).map(z => ({ ...z, avg: Math.round(z.spend / z.loads), top_carrier: Object.entries(z.carriers).sort((a, b) => b[1] - a[1])[0]?.[0] || null })).sort((a, b) => b.loads - a.loads);

fs.writeFileSync(dataPath, JSON.stringify({ monthly, weekly: rawData.weekly, dow: dowMap, carriers, customers, zones, lanes: rawData.lanes, loads_raw: loads }, null, 2));
console.log('Successfully optimized and re-aggregated data based on First Stop departure dates!');
