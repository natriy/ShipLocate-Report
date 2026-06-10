import json

with open('/Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/lib/real-data.json', 'r') as f:
    data = json.load(f)['loads']

custMap = {}
for l in data:
    for c in l.get('customers', []):
        cName = c['name']
        cSpend = c.get('spend_share', 0)
        cState = c.get('state', 'Unknown')
        
        if cName not in custMap:
            custMap[cName] = {
                'name': cName,
                'spend': 0,
                'loads': 0,
                'single': 0,
                'multi': 0,
                'tl_loads': 0.0,
                'ltl_loads': 0.0,
                'total_loads': 0.0,
                'total_drops': 0
            }
            
        total_drops_on_load = len(l.get('customers', [])) or 1
        drop_share = 1.0 / total_drops_on_load
        
        custMap[cName]['spend'] += cSpend
        custMap[cName]['loads'] += 1
        custMap[cName]['total_drops'] += 1
        
        if l.get('trip_type') == 'LTL':
            custMap[cName]['multi'] += 1
            custMap[cName]['ltl_loads'] += drop_share
        else:
            custMap[cName]['single'] += 1
            custMap[cName]['tl_loads'] += 1.0
            
        custMap[cName]['total_loads'] += drop_share

for name in ["Jetro Cash and Carry", "Paradigm Commodities", "FMS - Sherrington", "Baldor", "The Class Produce"]:
    if name in custMap:
        print(f"\nCustomer: {name}")
        c = custMap[name]
        print(f"  - single (TL loads count): {c['single']}")
        print(f"  - multi (LTL drops count): {c['multi']}")
        print(f"  - tl_loads (pro-rata TL): {c['tl_loads']:.4f} -> rounded: {round(c['tl_loads'])}")
        print(f"  - ltl_loads (pro-rata LTL): {c['ltl_loads']:.4f} -> rounded: {round(c['ltl_loads'])}")
        print(f"  - total_loads (pro-rata total): {c['total_loads']:.4f} -> rounded: {round(c['total_loads'])}")
        print(f"  - total_drops: {c['total_drops']}")
