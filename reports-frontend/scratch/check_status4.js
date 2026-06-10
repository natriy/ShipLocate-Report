const fs = require('fs');
const statusCsv = '/Users/renat/Desktop/ShipLocate REPORTS Antigravity/database 2/database/tc_load_status_changes_202604232346.csv';

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
    const data = fs.readFileSync(statusCsv, 'utf8');
    const lines = data.split('\n');
    const dowCount = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Track first status 4 for each load
    const firstStatus4 = {};

    lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = parseCSVLine(line);
        if (parts.length >= 4) {
            const loadId = parts[1];
            const status = parts[2];
            const timeStr = parts[3]; // "2026-04-15 20:21:32.640"
            
            if (status === '4') {
                if (!firstStatus4[loadId] || timeStr < firstStatus4[loadId]) {
                    firstStatus4[loadId] = timeStr;
                }
            }
        }
    });

    Object.values(firstStatus4).forEach(timeStr => {
        // Assume timeStr is UTC. Adjust -4 for EDT.
        const d = new Date(timeStr.replace(' ', 'T') + 'Z');
        const localD = new Date(d.getTime() - 4 * 60 * 60 * 1000);
        const dow = dayNames[localD.getUTCDay()];
        dowCount[dow] = (dowCount[dow] || 0) + 1;
    });

    console.log(JSON.stringify(dowCount, null, 2));
} catch (e) {
    console.error(e.message);
}
