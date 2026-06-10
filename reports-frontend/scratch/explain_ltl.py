import json

with open('/Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/lib/real-data.json', 'r') as f:
    data = json.load(f)['loads']

# Find Jetro Cash and Carry & Paradigm Commodities
target_customers = ["Jetro Cash and Carry", "Paradigm Commodities"]

for cust_name in target_customers:
    print(f"\n=== Analyzing: {cust_name} ===")
    
    tl_count = 0
    ltl_total_share = 0.0
    ltl_loads_details = []
    
    # We loop over all loads in the database
    for load in data:
        trip_type = load.get('trip_type') # 'TL' or 'LTL'
        customers_on_load = load.get('customers', [])
        
        # Check if the target customer is in this load
        matching_custs = [c for c in customers_on_load if c['name'] == cust_name]
        if not matching_custs:
            continue
            
        # The number of drops (stops) on this load
        total_drops_on_load = len(customers_on_load)
        if total_drops_on_load == 0:
            total_drops_on_load = 1
            
        drop_share = 1.0 / total_drops_on_load
        
        if trip_type == 'TL':
            tl_count += 1
        elif trip_type == 'LTL':
            ltl_total_share += drop_share
            # Log some examples or summaries
            ltl_loads_details.append({
                'load_id': load.get('id'),
                'total_drops': total_drops_on_load,
                'share': drop_share,
                'all_customers': [c['name'] for c in customers_on_load]
            })
            
    print(f"TL (Single) loads count: {tl_count}")
    print(f"LTL (Multi-Stop) fractional share sum: {ltl_total_share:.4f}")
    print(f"LTL (Multi-Stop) rounded for frontend: {round(ltl_total_share)}")
    print(f"Total LTL loads that the customer participated in: {len(ltl_loads_details)}")
    
    # Print a summary of drops sizes for LTL loads
    shares_count = {}
    for item in ltl_loads_details:
        shares_count[item['total_drops']] = shares_count.get(item['total_drops'], 0) + 1
        
    print("Distribution of LTL loads by total stops/drops on load:")
    for stops, count in sorted(shares_count.items()):
        share_val = 1.0 / stops
        print(f"  - Loads with {stops} stops: {count} times (each contributes {share_val:.4f} share, total {count * share_val:.4f} loads)")
