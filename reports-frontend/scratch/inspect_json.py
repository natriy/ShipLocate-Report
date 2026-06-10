import json

with open('/Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/lib/real-data.json', 'r') as f:
    data = json.load(f)

if isinstance(data, dict):
    print("Keys of JSON:", data.keys())
    # Check the first few items in the list if applicable
    for k in list(data.keys())[:3]:
        print(f"Type of data['{k}']:", type(data[k]))
        if isinstance(data[k], list) and len(data[k]) > 0:
            print(f"First item of data['{k}']:", data[k][0])
else:
    print("JSON is a list. Length:", len(data))
    if len(data) > 0:
        print("First item:", data[0])
