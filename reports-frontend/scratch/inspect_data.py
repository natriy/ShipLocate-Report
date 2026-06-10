import json

with open('/Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/lib/real-data.json', 'r') as f:
    data = json.load(f)

loads = data.get('loads', [])
tl_loads = [l for l in loads if l.get('trip_type') == 'TL']
ltl_loads = [l for l in loads if l.get('trip_type') == 'LTL']

print(f"TL loads count: {len(tl_loads)}")
if tl_loads:
    print("Sample TL load customers count:", len(tl_loads[0].get('customers', [])))
    print("Sample TL load customers:", json.dumps(tl_loads[0].get('customers'), indent=2))

print(f"LTL loads count: {len(ltl_loads)}")
print("Let's calculate stop stats:")
total_tl_stops = sum(len(l.get('customers', [])) for l in tl_loads)
total_ltl_stops = sum(len(l.get('customers', [])) for l in ltl_loads)
print(f"Total stops in TL loads: {total_tl_stops}")
print(f"Total stops in LTL loads: {total_ltl_stops}")
print(f"Total stops across all loads: {total_tl_stops + total_ltl_stops}")
