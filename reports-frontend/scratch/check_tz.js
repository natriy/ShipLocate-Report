const fs = require('fs');
const path = require('path');

const csvPath = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_loads_202604232346.csv';

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else cur += char;
    }
    result.push(cur.trim());
    return result;
}

try {
    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n');
    lines.slice(1).forEach((line, idx) => {
        if (!line.trim()) return;
        const parts = parseCSVLine(line);
        if (parts.length >= 4) {
            const id = parts[0];
            const uid = parts[1];
            const ts = parseInt(parts[3]);
            if (isNaN(ts)) return;

            const dateUTC = new Date(ts);
            const dateEDT = new Date(ts - 4 * 60 * 60 * 1000);

            if (dateUTC.getUTCDate() !== dateEDT.getUTCDate()) {
                console.log(`Load: ${uid}, UTC: ${dateUTC.toISOString()}, EDT Date: ${dateEDT.toISOString().split('T')[0]}`);
            }
        }
    });
} catch (e) {
    console.error(e.message);
}
