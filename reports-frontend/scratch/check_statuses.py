import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('/Users/renat/Desktop/ShipLocate-Reports/.env')

db_host = os.getenv('DB_HOST')
db_port = os.getenv('DB_PORT')
db_name = os.getenv('DB_NAME')
db_user = os.getenv('DB_USER')
db_pass = os.getenv('DB_PASS')

conn = psycopg2.connect(
    host=db_host,
    port=db_port,
    database=db_name,
    user=db_user,
    password=db_pass
)
cursor = conn.cursor()

cursor.execute("""
    SELECT loadstatus, COUNT(*) 
    FROM tc_loads 
    WHERE organizationid = 2 
    GROUP BY loadstatus 
    ORDER BY loadstatus;
""")

rows = cursor.fetchall()
print("FMS Fresh Produce (organizationid = 2) loads by status:")
status_map = {
    0: "Draft / Open",
    1: "Booked / Assigned",
    2: "Cancelled", # or similar
    3: "Dispatched",
    4: "Active / In-Transit",
    5: "Completed / History",
    6: "Cancelled"
}
for status, count in rows:
    name = status_map.get(status, f"Unknown status ({status})")
    print(f"Status {status} ({name}): {count} loads")

cursor.close()
conn.close()
