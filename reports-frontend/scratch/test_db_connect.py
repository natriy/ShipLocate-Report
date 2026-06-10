import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load env variables from the root folder
load_dotenv(dotenv_path='/Users/renat/Desktop/ShipLocate-Reports/.env')

db_host = os.getenv('DB_HOST')
db_port = os.getenv('DB_PORT')
db_name = os.getenv('DB_NAME')
db_user = os.getenv('DB_USER')
db_pass = os.getenv('DB_PASS')

print(f"Connecting to {db_host}:{db_port}/{db_name} as {db_user}...")

try:
    conn = psycopg2.connect(
        host=db_host,
        port=db_port,
        database=db_name,
        user=db_user,
        password=db_pass,
        connect_timeout=5
    )
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Test table row counts
    tables = ['tc_loads', 'tc_carriers', 'tc_locations', 'tc_stops', 'tc_load_progress_events', 'tc_load_status_changes']
    for t in tables:
        cursor.execute(f"SELECT COUNT(*) as count FROM {t};")
        row = cursor.fetchone()
        print(f"Table '{t}': {row['count']} rows")
        
    cursor.close()
    conn.close()
    print("Connection test successful!")
except Exception as e:
    print("Connection failed:", str(e))
