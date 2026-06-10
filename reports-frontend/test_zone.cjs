const fs = require('fs');

const rawData = require('./mock-data.json');
let loads = rawData.loads_raw;

function getZone(locStr) {
  if (!locStr) return 'Unknown';
  locStr = locStr.toUpperCase();
  
  // Canada
  if (/\b(QC|QUEBEC|MONTREAL|SHERRINGTON)\b/.test(locStr)) return '🇨🇦 Quebec';
  if (/\b(ON|ONTARIO|TORONTO)\b/.test(locStr) && !/\bCA\b/.test(locStr)) return '🇨🇦 Ontario';
  if (/(, |\s)(NB|NS|PE|NL)$/.test(locStr) || /\b(NB|NS|PE|NL)\b/.test(locStr)) return '🇨🇦 Atlantic Canada';
  if (/(, |\s)(MB|SK)$/.test(locStr) || /\b(MB|SK)\b/.test(locStr)) return '🇨🇦 Prairies East';
  if (/(, |\s)(AB)$/.test(locStr) || /\bAB\b/.test(locStr)) return '🇨🇦 Alberta';
  if (/(, |\s)(BC)$/.test(locStr) || /\bBC\b/.test(locStr)) return '🇨🇦 British Columbia';
  if (/(, |\s)(YT|NT|NU)$/.test(locStr) || /\b(YT|NT|NU)\b/.test(locStr)) return '🇨🇦 North Territories';
  
  // New England
  if (/(, |\s)(ME|NH|VT|MA|RI|CT)$/.test(locStr) || /\b(ME|NH|VT|MA|RI|CT)\b/.test(locStr)) return '🇺🇸 New England';
  
  // NY
  if (/(, |\s)(NY)$/.test(locStr) || /\bNY\b/.test(locStr)) {
    if (/(BRONX|BROOKLYN|QUEENS|MANHATTAN|STATEN|LONG ISLAND|WESTCHESTER|YONKERS|MT VERNON|NEW ROCHELLE|GARDEN CITY|FARMINGDALE)/.test(locStr)) {
      return '🇺🇸 NYC / Long Island';
    }
    return '🇺🇸 Upstate NY';
  }
  
  // NJ
  if (/(, |\s)(NJ)$/.test(locStr) || /\bNJ\b/.test(locStr)) {
    if (/(TRENTON|CHERRY HILL|VINELAND|ATLANTIC CITY|MOUNT LAUREL|BURLINGTON|CAMDEN|GLOUCESTER|LOGAN TWP|SWEDESBORO|DEPTFORD)/.test(locStr)) {
      return '🇺🇸 Central / South Jersey';
    }
    return '🇺🇸 North Jersey';
  }
  
  // PA
  if (/(, |\s)(PA)$/.test(locStr) || /\bPA\b/.test(locStr)) {
    if (/(PITTSBURGH|ERIE|CRANBERRY|WASHINGTON|BUTLER|GREENSBURG|MONROEVILLE)/.test(locStr)) {
      return '🇺🇸 Western PA';
    }
    return '🇺🇸 Eastern PA';
  }
  
  // MD / DE / DC / Northern VA
  if (/(, |\s)(MD|DE|DC)$/.test(locStr) || /\b(MD|DE|DC)\b/.test(locStr)) {
    return '🇺🇸 MD / DE / DC / NoVA';
  }
  
  // VA
  if (/(, |\s)(VA)$/.test(locStr) || /\bVA\b/.test(locStr)) {
    if (/(ALEXANDRIA|ARLINGTON|FAIRFAX|FALLS CHURCH|LOUDOUN|PRINCE WILLIAM|MANASSAS|STERLING|ASHBURN)/.test(locStr)) {
      return '🇺🇸 MD / DE / DC / NoVA';
    }
    return '🇺🇸 Virginia';
  }
  
  // Carolinas
  if (/(, |\s)(NC|SC)$/.test(locStr) || /\b(NC|SC)\b/.test(locStr)) return '🇺🇸 Carolinas';
  
  // Georgia
  if (/(, |\s)(GA)$/.test(locStr) || /\bGA\b/.test(locStr)) return '🇺🇸 Georgia';
  
  // Florida
  if (/(, |\s)(FL)$/.test(locStr) || /\bFL\b/.test(locStr)) {
    if (/(MIAMI|FORT LAUDERDALE|WEST PALM|POMPANO|BOCA|HIALEAH|HOMESTEAD|BROWARD|MIAMI-DADE|PALM BEACH)/.test(locStr)) {
      return '🇺🇸 South Florida';
    }
    return '🇺🇸 Florida North / Central';
  }
  
  // TN / AL / MS
  if (/(, |\s)(TN|AL|MS)$/.test(locStr) || /\b(TN|AL|MS)\b/.test(locStr)) return '🇺🇸 TN / AL / MS';
  
  // Ohio Valley
  if (/(, |\s)(OH|IN|KY)$/.test(locStr) || /\b(OH|IN|KY)\b/.test(locStr)) return '🇺🇸 Ohio Valley';
  
  // Michigan
  if (/(, |\s)(MI)$/.test(locStr) || /\bMI\b/.test(locStr)) return '🇺🇸 Michigan';
  
  // Chicago / Illinois
  if (/(, |\s)(IL)$/.test(locStr) || /\bIL\b/.test(locStr)) return '🇺🇸 Chicago / Illinois';
  
  // Upper Midwest
  if (/(, |\s)(WI|MN)$/.test(locStr) || /\b(WI|MN)\b/.test(locStr)) return '🇺🇸 Upper Midwest';
  
  // Iowa / Missouri
  if (/(, |\s)(IA|MO)$/.test(locStr) || /\b(IA|MO)\b/.test(locStr)) return '🇺🇸 Iowa / Missouri';
  
  // Central Plains
  if (/(, |\s)(KS|NE|ND|SD|OK)$/.test(locStr) || /\b(KS|NE|ND|SD|OK)\b/.test(locStr)) return '🇺🇸 Central Plains';
  
  // Texas
  if (/(, |\s)(TX)$/.test(locStr) || /\bTX\b/.test(locStr)) return '🇺🇸 Texas';
  
  // Louisiana / Arkansas
  if (/(, |\s)(LA|AR)$/.test(locStr) || /\b(LA|AR)\b/.test(locStr)) return '🇺🇸 Louisiana / Arkansas';
  
  // Mountain / Southwest
  if (/(, |\s)(AZ|NM|CO|UT|NV|ID|MT|WY)$/.test(locStr) || /\b(AZ|NM|CO|UT|NV|ID|MT|WY)\b/.test(locStr)) return '🇺🇸 Mountain / Southwest';
  
  // California
  if (/(, |\s)(CA)$/.test(locStr) || /\bCA\b/.test(locStr)) {
    if (/(LOS ANGELES|SAN DIEGO|INLAND EMPIRE|RIVERSIDE|SAN BERNARDINO|ORANGE|IRVINE|ANAHEIM|ONTARIO|FONTANA|CORONA)/.test(locStr)) {
      return '🇺🇸 Southern California';
    }
    return '🇺🇸 Northern California';
  }
  
  // Pacific Northwest
  if (/(, |\s)(WA|OR)$/.test(locStr) || /\b(WA|OR)\b/.test(locStr)) return '🇺🇸 Pacific Northwest';
  
  // Alaska / Hawaii
  if (/(, |\s)(AK|HI)$/.test(locStr) || /\b(AK|HI)\b/.test(locStr)) return '🇺🇸 Alaska / Hawaii';
  
  return '🇺🇸 Other';
}

// 1. Update all loads
let unmappedCount = 0;
loads.forEach(load => {
  if (load.loc_names && load.loc_names.length > 0) {
    load.zones = load.loc_names.map(loc => getZone(loc));
    // The base_zone is typically the furthest / last drop, but for now we just use the last mapped zone or most frequent.
    // In LTL routing, furthest state dictates pricing, but since they are sequentially routed, the last drop is usually the base zone.
    load.base_zone = load.zones[load.zones.length - 1];
  }
});

// 2. Re-aggregate Monthly
const monthlyMap = {};
// 3. Re-aggregate DOW
const dowMap = { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0, Sunday:0 };
// 4. Re-aggregate Carriers
const carriersMap = {};
// 5. Re-aggregate Customers
const customersMap = {};
// 6. Re-aggregate Zones
const zonesMap = {};

// Optional: Base rates config to rebuild spend if spend is null, but we'll just reuse existing load.spend for now.
// If load.spend exists, we use it.

loads.forEach(l => {
  const isMulti = l.trip_type === 'Multi';
  const spend = l.spend || 0;
  
  // Monthly
  if (!monthlyMap[l.month]) {
    monthlyMap[l.month] = { month: l.month, loads: 0, spend: 0, single: 0, multi: 0, carriers: new Set() };
  }
  monthlyMap[l.month].loads++;
  monthlyMap[l.month].spend += spend;
  if (isMulti) monthlyMap[l.month].multi++; else monthlyMap[l.month].single++;
  monthlyMap[l.month].carriers.add(l.carrier);
  
  // DOW
  if (l.dow && dowMap[l.dow] !== undefined) dowMap[l.dow]++;
  
  // Carrier
  if (!carriersMap[l.carrier]) {
    carriersMap[l.carrier] = { name: l.carrier, loads: 0, spend: 0, single: 0, multi: 0, customers: new Set(), zones: {} };
  }
  carriersMap[l.carrier].loads++;
  carriersMap[l.carrier].spend += spend;
  if (isMulti) carriersMap[l.carrier].multi++; else carriersMap[l.carrier].single++;
  l.loc_names.forEach(loc => {
    let custName = loc;
    if (custName.indexOf('-') > -1) custName = custName.substring(0, custName.indexOf('-')).trim();
    if (custName.indexOf(',') > -1) custName = custName.substring(0, custName.indexOf(',')).trim();
    carriersMap[l.carrier].customers.add(custName);
  });
  const bZone = l.base_zone;
  carriersMap[l.carrier].zones[bZone] = (carriersMap[l.carrier].zones[bZone] || 0) + 1;
  
  // Zones
  if (!zonesMap[bZone]) {
    zonesMap[bZone] = { zone: bZone, loads: 0, spend: 0, single: 0, multi: 0, carriers: {} };
  }
  zonesMap[bZone].loads++;
  zonesMap[bZone].spend += spend;
  if (isMulti) zonesMap[bZone].multi++; else zonesMap[bZone].single++;
  zonesMap[bZone].carriers[l.carrier] = (zonesMap[bZone].carriers[l.carrier] || 0) + 1;
  
  // Customers
  const customerNamesSet = new Set();
  l.loc_names.forEach(loc => {
    let custName = loc;
    if (custName.indexOf('-') > -1) custName = custName.substring(0, custName.indexOf('-')).trim();
    if (custName.indexOf(',') > -1) custName = custName.substring(0, custName.indexOf(',')).trim();
    // Normalize a bit
    customerNamesSet.add(custName);
  });
  
  customerNamesSet.forEach(cName => {
    if (!customersMap[cName]) {
      customersMap[cName] = { name: cName, zone: bZone, loads: 0, spend: 0, single: 0, multi: 0, carriers: {} };
    }
    customersMap[cName].loads++;
    // Estimate spend per drop if multi, or just attribute full spend
    customersMap[cName].spend += (spend / customerNamesSet.size);
    if (isMulti) customersMap[cName].multi++; else customersMap[cName].single++;
    customersMap[cName].carriers[l.carrier] = (customersMap[cName].carriers[l.carrier] || 0) + 1;
  });
});

// Format the arrays
const monthly = Object.values(monthlyMap).map(m => ({
  ...m,
  carriers: m.carriers.size,
  spend: Math.round(m.spend)
})).sort((a,b) => a.month.localeCompare(b.month));

const carriers = Object.values(carriersMap).map(c => {
  const topZone = Object.entries(c.zones).sort((a,b) => b[1] - a[1])[0];
  return {
    ...c,
    customers: c.customers.size,
    rate: Math.round(90 + Math.random() * 10), // mock rate since we don't have status data for rate
    avg: Math.round(c.spend / c.loads),
    top_zone: topZone ? topZone[0] : null,
    spend: Math.round(c.spend)
  };
});

const customers = Object.values(customersMap).map(c => {
  const topCarrier = Object.entries(c.carriers).sort((a,b) => b[1] - a[1])[0];
  return {
    ...c,
    spend: Math.round(c.spend),
    top_carrier: topCarrier ? topCarrier[0] : null
  };
});

const zones = Object.values(zonesMap).map(z => {
  const topCarrier = Object.entries(z.carriers).sort((a,b) => b[1] - a[1])[0];
  return {
    ...z,
    spend: Math.round(z.spend),
    avg: Math.round(z.spend / z.loads),
    rate: Math.round(z.spend / z.loads) - (z.multi > 0 ? 100 : 0),
    top_carrier: topCarrier ? topCarrier[0] : null
  };
});

// Merge and save
const newData = {
  monthly,
  weekly: rawData.weekly,
  dow: dowMap,
  carriers,
  customers,
  zones,
  lanes: rawData.lanes,
  loads_raw: loads
};

fs.writeFileSync('./mock-data.json', JSON.stringify(newData, null, 2));
console.log('Successfully re-aggregated data with new zones!');

console.log(getZone('JERRY PORRICELLI - BRONX, NY'));