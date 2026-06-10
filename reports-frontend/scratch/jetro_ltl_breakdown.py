import json

with open('/Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/lib/real-data.json', 'r') as f:
    data = json.load(f)['loads']

jetro_ltl_loads = []
for l in data:
    if l.get('trip_type') != 'LTL':
        continue
    
    # Count how many stops Jetro has on this specific LTL load
    jetro_stops = [c for c in l.get('customers', []) if c['name'] == 'Jetro Cash and Carry']
    if not jetro_stops:
        continue
        
    total_drops = len(l.get('customers', []))
    share_per_drop = 1.0 / total_drops
    jetro_share = len(jetro_stops) * share_per_drop
    
    jetro_ltl_loads.append({
        'load_id': l.get('id'),
        'total_drops': total_drops,
        'jetro_stops_count': len(jetro_stops),
        'jetro_share': jetro_share
    })

print(f"Total LTL loads containing Jetro: {len(jetro_ltl_loads)}")
print(f"Total Jetro LTL stops across these loads: {sum(x['jetro_stops_count'] for x in jetro_ltl_loads)}")
print(f"Total Jetro LTL pro-rata share (sum of shares): {sum(x['jetro_share'] for x in jetro_ltl_loads):.4f}")

# Group by the combination of (total_drops, jetro_stops_count)
groups = {}
for item in jetro_ltl_loads:
    key = (item['total_drops'], item['jetro_stops_count'])
    groups[key] = groups.get(key, 0) + 1

print("\nBreakdown of Jetro LTL loads:")
for (total_drops, jetro_stops_count), count in sorted(groups.items()):
    share_value = jetro_stops_count * (1.0 / total_drops)
    total_share_contrib = count * share_value
    print(f"  - {count} loads had a total of {total_drops} stops, out of which Jetro had {jetro_stops_count} stops:")
    print(f"    * Share per load for Jetro: {jetro_stops_count}/{total_drops} = {share_value:.4f}")
    print(f"    * Contribution to LTL total: {count} * {share_value:.4f} = {total_share_contrib:.4f} loads")
