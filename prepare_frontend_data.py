import json
import os
import re
from datetime import datetime, timedelta, date
from decimal import Decimal
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
base_path = os.path.join(SCRIPT_DIR, 'database-json')
output_path = os.path.join(SCRIPT_DIR, 'reports-frontend', 'src', 'lib', 'real-data.json')
ORG_ID = int(os.getenv('ORG_ID', 2))

US_STATES = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
}

CA_PROVINCES = {
    'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Ontario': 'ON', 'Prince Edward Island': 'PE',
    'Quebec': 'QC', 'Québec': 'QC', 'Saskatchewan': 'SK'
}

STATE_MAP = {**US_STATES, **CA_PROVINCES}

def normalize_address(address):
    if not address:
        return ''
    normalized = address
    for state_name, abbr in STATE_MAP.items():
        normalized = re.sub(r'\b' + re.escape(state_name) + r'\b', abbr, normalized, flags=re.IGNORECASE)
    return normalized

def parse_city_state(address):
    if not address:
        return "Unknown", "Unknown"
    
    addr = address.strip()
    parts = [p.strip() for p in addr.split(',')]
    
    if len(parts) >= 2:
        last_part = parts[-1]
        is_country = last_part.upper() in ['UNITED STATES', 'USA', 'CANADA', 'US']
        
        if is_country and len(parts) >= 3:
            state_zip = parts[-2]
            city = parts[-3]
        else:
            state_zip = parts[-1]
            city = parts[-2]
            
        state = "Unknown"
        for state_name, abbr in STATE_MAP.items():
            if re.search(r'\b' + re.escape(state_name) + r'\b', state_zip, re.IGNORECASE):
                state = abbr
                break
            if re.search(r'\b' + re.escape(abbr) + r'\b', state_zip, re.IGNORECASE):
                state = abbr
                break
        
        if state == "Unknown":
            for state_name, abbr in STATE_MAP.items():
                if re.search(r'\b' + re.escape(state_name) + r'\b', addr, re.IGNORECASE):
                    state = abbr
                    break
                if re.search(r'\b' + re.escape(abbr) + r'\b', addr, re.IGNORECASE):
                    state = abbr
                    break
                    
        return city, state
    
    return "Unknown", "Unknown"

def load_json(filename):
    with open(os.path.join(base_path, filename), 'r') as f:
        return json.load(f)

# Translated from JS getZone function
def get_zone_html(address, name):
    raw = (address or '') + ' ' + (name or '')
    t = raw.upper()
    t = t.replace('NEW YORK', 'NY').replace('NEW JERSEY', 'NJ')
    t = t.replace('PENNSYLVANIA', 'PA').replace('CALIFORNIA', 'CA')
    t = t.replace('FLORIDA', 'FL').replace('GEORGIA', 'GA')
    t = re.sub(r'UNITED STATES|\bUSA\b', '', t)
    t = t.replace('CANADA', '')
    t = t.replace(',', ' ')
    t = re.sub(r'\s+', ' ', t).strip()

    if any(x in t for x in ['BOSTON', 'PORTLAND ME', 'BURLINGTON VT', 'PROVIDENCE', 'HARTFORD', 'SPRINGFIELD MA', 'WORCESTER', 'LOWELL', 'CAMBRIDGE', 'NEW HAVEN', 'WATERBURY', 'BRIDGEPORT', 'STAMFORD', 'NEWBURGH CT', 'CHICOPEE', 'EVERETT', 'MILFORD', 'ANDOVER', 'NEEDHAM', 'NEW BEDFORD', 'TAUNTON', 'FALL RIVER', 'CRANSTON', 'WARWICK', 'JOHNSTON RI', 'BRANFORD', 'ORANGE CT', 'CHELSEA MA', 'AUBURN ME', 'AUGUSTA ME']) or re.search(r'\b(ME|NH|VT|MA|RI|CT)\b', t):
        return 'New England'
    if any(x in t for x in ['BRONX', 'BROOKLYN', 'QUEENS', 'MANHATTAN', 'STATEN ISLAND', 'JAMAICA NY', 'GARDEN CITY', 'FARMINGDALE', 'RIVERHEAD', 'BOHEMIA', 'SYOSSET', 'YAPHANK', 'BLAUVELT', 'BREWSTER', 'PORT CHESTER', 'MOUNT VERNON', 'MT VERNON', 'WESTCHESTER', 'TARRYTOWN', 'WHITE PLAINS', 'NEWBURGH NY', 'GOSHEN', 'NORTH BELLMORE', 'HAUPPAUGE', 'RONKONKOMA', 'HICKSVILLE', 'LONG ISLAND', 'JAMAICA', 'JFK']):
        return 'NYC / Long Island'
    if any(x in t for x in ['ALBANY', 'COLONIE', 'TROY', 'SCHENECTADY', 'BUFFALO', 'ROCHESTER', 'SYRACUSE', 'UTICA', 'BINGHAMTON', 'PLATTSBURGH', 'WATERTOWN', 'ITHACA', 'ELMIRA', 'JAMESTOWN', 'SARATOGA', 'KINGSTON NY', 'POUGHKEEPSIE', 'MARION NY', 'ALBANY NY']):
        return 'Upstate NY'
    if any(x in t for x in ['NEWARK NJ', 'ELIZABETH NJ', 'JERSEY CITY', 'PATERSON', 'HOBOKEN', 'BAYONNE', 'UNION CITY', 'NORTH BERGEN', 'ENGLEWOOD', 'HILLSIDE NJ', 'MAHWAH', 'CLIFTON', 'HACKENSACK', 'PARAMUS', 'EDGEWATER', 'RIDGEFIELD', 'LODI', 'GARFIELD', 'PASSAIC', 'FAIR LAWN', 'TEANECK', 'FORT LEE', 'SECAUCUS', 'KEARNY', 'HARRISON NJ', 'EAST ORANGE', 'IRVINGTON NJ', 'PLAINFIELD NJ', 'EDISON NJ', 'WUHL SHAFMAN', 'LOCKWOOD ST NEWARK']):
        return 'NJ North'
    if any(x in t for x in ['TRENTON', 'CHERRY HILL', 'VINELAND', 'ATLANTIC CITY', 'CAMDEN NJ', 'SWEDESBORO', 'EGG HARBOR', 'CEDARVILLE', 'TOMS RIVER', 'LAKEWOOD NJ', 'BRICK NJ', 'FREEHOLD', 'NEPTUNE NJ', 'ASBURY PARK', 'LONG BRANCH', 'PRINCETON', 'NEW BRUNSWICK', 'SOMERSET NJ', 'PISCATAWAY']):
        return 'NJ Central / South'
    if any(x in t for x in ['PHILADELPHIA', 'ALLENTOWN', 'SCRANTON', 'HARRISBURG', 'BETHLEHEM PA', 'WILKES-BARRE', 'READING PA', 'LANCASTER PA', 'YORK PA', 'EASTON PA', 'EDDYSTONE', 'MOUNT JOY', 'DENVER PA', 'SCHUYLKILL', 'NORRISTOWN', 'KING OF PRUSSIA', 'CHESTER PA', 'MARCUS HOOK', 'POTTSTOWN', 'BETHLEHEM']):
        return 'Eastern PA'
    if any(x in t for x in ['PITTSBURGH', 'ERIE PA', 'ALTOONA', 'JOHNSTOWN PA', 'EBENSBURG', 'GREENSBURG', 'NEW CASTLE PA', 'BUTLER PA', 'BEAVER PA', 'WASHINGTON PA']):
        return 'Western PA'
    if any(x in t for x in ['BALTIMORE', 'ROCKVILLE', 'SILVER SPRING', 'GAITHERSBURG', 'BETHESDA', 'LAUREL MD', 'JESSUP', 'LANHAM', 'WHITE MARSH', 'EASTON MD', 'NEW WINDSOR MD', 'ANNAPOLIS', 'FREDERICK MD', 'HAGERSTOWN', 'SALISBURY MD', 'OCEAN CITY MD', 'WILMINGTON DE', 'NEW CASTLE DE', 'DOVER DE', 'NEWARK DE', 'CHANTILLY', 'ALEXANDRIA VA', 'ARLINGTON VA', 'FALLS CHURCH', 'RESTON', 'HERNDON', 'MANASSAS', 'LOUDOUN', 'FAIRFAX']) or re.search(r'\b(MD|DE|DC)\b', t):
        return 'MD / DE / DC / Northern VA'
    if any(x in t for x in ['RICHMOND VA', 'NORFOLK', 'VIRGINIA BEACH', 'CHESAPEAKE VA', 'NEWPORT NEWS', 'HAMPTON VA', 'ROANOKE', 'CHARLOTTESVILLE', 'LYNCHBURG', 'DANVILLE VA', 'HARRISONBURG VA', 'FREDERICKSBURG']):
        return 'Virginia'
    if any(x in t for x in ['CHARLOTTE', 'RALEIGH', 'GREENSBORO', 'DURHAM', 'WINSTON-SALEM', 'FAYETTEVILLE NC', 'CARY NC', 'WILMINGTON NC', 'HIGH POINT', 'MORRISVILLE', 'COLUMBIA SC', 'CHARLESTON SC', 'GREENVILLE SC', 'SPARTANBURG', 'ROCK HILL', 'NORTH CHARLESTON', 'ENOREE', 'TAYLOR BOY']) or re.search(r'\b(NC|SC)\b', t):
        return 'Carolinas'
    if any(x in t for x in ['ATLANTA', 'SAVANNAH', 'AUGUSTA GA', 'COLUMBUS GA', 'MACON', 'ALBANY GA', 'ATHENS GA', 'ROSWELL GA', 'SANDY SPRINGS', 'WARNER ROBINS', 'VALDOSTA', 'REIDSVILLE', 'SPARKS GA', 'NORMAN PARK', 'COBBTOWN', 'BAKER FARMS']) or re.search(r'\bGA\b', t):
        return 'Georgia'
    if any(x in t for x in ['JACKSONVILLE', 'ORLANDO', 'TAMPA', 'TALLAHASSEE', 'GAINESVILLE', 'OCALA', 'PENSACOLA', 'DAYTONA BEACH', 'LAKELAND FL', 'CLEARWATER', 'ST PETERSBURG FL', 'SARASOTA', 'FORT MYERS', 'CAPE CORAL', 'PORT CHARLOTTE', 'KISSIMMEE', 'SANFORD FL', 'DELTONA']):
        return 'Florida North / Central'
    if any(x in t for x in ['MIAMI', 'FORT LAUDERDALE', 'WEST PALM BEACH', 'POMPANO BEACH', 'BOCA RATON', 'DELRAY BEACH', 'HOLLYWOOD FL', 'HIALEAH', 'CORAL SPRINGS', 'PEMBROKE PINES', 'MIAMI GARDENS', 'HOMESTEAD FL', 'MEDLEY', 'HIALEAH GARDENS', 'IMMOKALEE', 'DIRECT FRESH']):
        return 'South Florida'
    if any(x in t for x in ['NASHVILLE', 'MEMPHIS', 'KNOXVILLE', 'CHATTANOOGA', 'CLARKSVILLE TN', 'BIRMINGHAM', 'HUNTSVILLE AL', 'MOBILE AL', 'MONTGOMERY AL', 'HOMEWOOD AL', 'JACKSON MS', 'GULFPORT', 'HATTIESBURG']) or re.search(r'\b(TN|AL|MS)\b', t):
        return 'TN / AL / MS'
    if any(x in t for x in ['CLEVELAND', 'COLUMBUS OH', 'CINCINNATI', 'TOLEDO', 'AKRON', 'DAYTON', 'YOUNGSTOWN', 'CANTON OH', 'LORAIN', 'VALLEY VIEW OH', 'RAVENNA OH', 'INDIANAPOLIS', 'FORT WAYNE', 'EVANSVILLE', 'SOUTH BEND', 'LOUISVILLE', 'LEXINGTON KY']) or re.search(r'\b(OH|IN|KY)\b', t):
        return 'Ohio Valley'
    if any(x in t for x in ['DETROIT', 'GRAND RAPIDS', 'WARREN MI', 'STERLING HEIGHTS', 'FLINT', 'LANSING', 'ANN ARBOR', 'DEARBORN', 'LIVONIA', 'TROY MI', 'WESTLAND', 'HUDSONVILLE', 'MIEDEMA']) or re.search(r'\bMI\b', t):
        return 'Michigan'
    if any(x in t for x in ['CHICAGO', 'AURORA IL', 'ROCKFORD', 'JOLIET', 'NAPERVILLE', 'SPRINGFIELD IL', 'PEORIA', 'ELGIN', 'WAUKEGAN', 'CICERO IL']) or re.search(r'\bIL\b', t):
        return 'Chicago / Illinois'
    if any(x in t for x in ['MILWAUKEE', 'MADISON WI', 'GREEN BAY', 'KENOSHA', 'RACINE', 'MINNEAPOLIS', 'ST PAUL', 'ROCHESTER MN', 'DULUTH', 'BROOKLYN PARK MN']) or re.search(r'\b(WI|MN)\b', t):
        return 'Upper Midwest'
    if any(x in t for x in ['DES MOINES', 'CEDAR RAPIDS', 'DAVENPORT IA', 'SIOUX CITY', 'KANSAS CITY', 'ST LOUIS', 'SPRINGFIELD MO', 'INDEPENDENCE MO']) or re.search(r'\b(IA|MO)\b', t):
        return 'Iowa / Missouri'
    if any(x in t for x in ['WICHITA', 'TOPEKA', 'OVERLAND PARK', 'OMAHA', 'LINCOLN NE', 'FARGO', 'SIOUX FALLS', 'OKLAHOMA CITY', 'TULSA']) or re.search(r'\b(KS|NE|ND|SD|OK)\b', t):
        return 'Central Plains'
    if any(x in t for x in ['HOUSTON', 'SAN ANTONIO', 'DALLAS', 'AUSTIN', 'FORT WORTH', 'EL PASO', 'LUBBOCK', 'LAREDO', 'MCALLEN', 'PHARR TX', 'HARLINGEN', 'BROWNSVILLE', 'AMARILLO', 'ABILENE', 'WACO']) or re.search(r'\bTX\b', t):
        return 'Texas'
    if any(x in t for x in ['NEW ORLEANS', 'BATON ROUGE', 'SHREVEPORT', 'METAIRIE', 'LITTLE ROCK', 'FAYETTEVILLE AR', 'FORT SMITH']) or re.search(r'\b(LA|AR)\b', t):
        return 'Louisiana / Arkansas'
    if any(x in t for x in ['PHOENIX', 'TUCSON', 'NOGALES', 'ALBUQUERQUE', 'SANTA FE', 'DENVER', 'COLORADO SPRINGS', 'SALT LAKE CITY', 'LAS VEGAS NV', 'RENO', 'BOISE', 'BILLINGS', 'CHEYENNE', 'ONTARIO OR', 'IDAHO FALLS', 'EAGLE EYE', 'MATTAWA']) or re.search(r'\b(AZ|NM|CO|UT|NV|ID|MT|WY)\b', t):
        return 'Mountain / Southwest'
    if any(x in t for x in ['SAN FRANCISCO', 'OAKLAND', 'SAN JOSE', 'SACRAMENTO', 'FRESNO', 'STOCKTON', 'MODESTO', 'BAKERSFIELD', 'LAMONT CA', 'I & I FARMS']):
        return 'Northern California'
    if any(x in t for x in ['LOS ANGELES', 'SAN DIEGO', 'RIVERSIDE CA', 'SAN BERNARDINO', 'ANAHEIM', 'SANTA ANA', 'LONG BEACH', 'IRVINE CA', 'ONTARIO CA', 'FONTANA', 'MORENO VALLEY', 'GLENDALE CA']):
        return 'Southern California'
    if any(x in t for x in ['SEATTLE', 'PORTLAND OR', 'SPOKANE', 'TACOMA', 'BELLEVUE WA', 'VANCOUVER WA', 'EUGENE', 'SALEM OR', 'MATTAWA', 'EAGLE EYE WA']) or re.search(r'\b(WA|OR)\b', t):
        return 'Pacific Northwest'
    if any(x in t for x in ['ANCHORAGE', 'FAIRBANKS', 'JUNEAU', 'HONOLULU', 'HILO']) or re.search(r'\b(AK|HI)\b', t):
        return 'Alaska / Hawaii'
    if any(x in t for x in ['MONTREAL', 'LAVAL', 'QUÉBEC', 'SHERBROOKE', 'GATINEAU', 'SHERRINGTON', 'SAINT-ISIDORE', 'RAWDON', 'OKA', 'SAINT-ROCH', 'SAINT-RÉMI', 'LACHINE', 'SAINT-LAURENT QC', 'SAINT-BERNARD', 'CHAMPLAIN BORDER', 'VICTORIAVILLE', 'DRUMMONDVILLE']) or re.search(r'\bQC\b', t):
        return 'Quebec / Montreal'
    if any(x in t for x in ['TORONTO', 'MISSISSAUGA', 'BRAMPTON', 'HAMILTON ON', 'LONDON ON', 'MARKHAM', 'VAUGHAN', 'KITCHENER', 'WINDSOR ON', 'RICHMOND HILL', 'OAKVILLE', 'BURLINGTON ON', 'OSHAWA', 'BARRIE', 'ETOBICOKE', 'SCARBOROUGH', 'NORTH YORK', 'OTTAWA', 'KINGSTON ON', 'SUDBURY', 'THUNDER BAY', 'BRADFORD ON', 'MILTON ON', 'WOODBRIDGE', 'HILLSIDE GARDENS BRADFORD']) or re.search(r'\bON\b', t):
        return 'Ontario / Toronto'
    if any(x in t for x in ['KINKORA', 'ALBANY PE', 'CHARLOTTETOWN', 'MONCTON', 'FREDERICTON', 'SAINT JOHN NB', 'HALIFAX', 'DARTMOUTH', 'SYDNEY NS', 'ST JOHN\'S NL', 'MCCARDLES']) or re.search(r'\b(PE|NB|NS|NL)\b', t):
        return 'Atlantic Canada'
    if any(x in t for x in ['WINNIPEG', 'SASKATOON', 'REGINA', 'CALGARY', 'EDMONTON', 'RED DEER', 'LETHBRIDGE', 'PEAK OF THE MARKET']) or re.search(r'\b(MB|SK|AB)\b', t):
        return 'Prairie Canada'
    if any(x in t for x in ['VANCOUVER', 'SURREY', 'BURNABY', 'RICHMOND BC', 'KELOWNA', 'ABBOTSFORD', 'VICTORIA BC', 'KAMLOOPS']) or re.search(r'\bBC\b', t):
        return 'British Columbia'
    return 'Unknown'

# Original ZIP-based get_zone for React data structure compatibility
def get_zone_original(address):
    if not address: return None
    address = normalize_address(address)
    is_canada = ", Canada" in address or " QC " in address or " ON " in address
    match_us = re.search(r'([A-Z]{2})\s+(\d{5})', address)
    match_ca = re.search(r'([A-Z]{2})\s+([A-Z]\d[A-Z])', address)
    
    state = None
    prefix = 0
    fsa = None
    
    if match_us and not is_canada:
        state = match_us.group(1)
        prefix = int(match_us.group(2)[:3])
        if state in ['ME', 'NH', 'VT', 'MA', 'RI', 'CT']: return {"macro": "A", "macroName": "Northeast USA", "meso": "A1", "mesoName": "New England"}
        if state == 'NY':
            if 100 <= prefix <= 119: return {"macro": "A", "macroName": "Northeast USA", "meso": "A2", "mesoName": "New York City / LI"}
            return {"macro": "A", "macroName": "Northeast USA", "meso": "A3", "mesoName": "Upstate New York"}
        if state == 'NJ':
            if (70 <= prefix <= 79) or (88 <= prefix <= 89): return {"macro": "A", "macroName": "Northeast USA", "meso": "A4", "mesoName": "North Jersey"}
            return {"macro": "A", "macroName": "Northeast USA", "meso": "A7", "mesoName": "South Jersey"}
        if state == 'PA':
            if 170 <= prefix <= 196: return {"macro": "A", "macroName": "Northeast USA", "meso": "A5", "mesoName": "Eastern PA"}
            return {"macro": "A", "macroName": "Northeast USA", "meso": "A6", "mesoName": "Western PA"}
        if state in ['MD', 'DE', 'DC']: return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B1", "mesoName": "Capital Region"}
        if state == 'VA':
            if prefix == 201 or (220 <= prefix <= 223): return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B1", "mesoName": "Capital Region"}
            return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B2", "mesoName": "Virginia"}
        if state in ['NC', 'SC']: return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B3", "mesoName": "Carolinas"}
        if state == 'GA': return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B4", "mesoName": "Georgia"}
        if state == 'FL': return {"macro": "B", "macroName": "Mid-Atlantic & Southeast", "meso": "B5", "mesoName": "Florida"}
        if state in ['OH', 'IN', 'KY', 'WV']: return {"macro": "C", "macroName": "Midwest USA", "meso": "C1", "mesoName": "Ohio Valley"}
        if state == 'MI': return {"macro": "C", "macroName": "Midwest USA", "meso": "C2", "mesoName": "Michigan"}
        if state == 'IL': return {"macro": "C", "macroName": "Midwest USA", "meso": "C3", "mesoName": "Chicagoland"}
        if state in ['WI', 'MN']: return {"macro": "C", "macroName": "Midwest USA", "meso": "C4", "mesoName": "Upper Midwest"}
        if state in ['TN', 'AL', 'MS']: return {"macro": "D", "macroName": "South & Plains USA", "meso": "D1", "mesoName": "Deep South"}
        if state in ['AR', 'LA', 'OK']: return {"macro": "D", "macroName": "South & Plains USA", "meso": "D2", "mesoName": "South Central"}
        if state in ['IA', 'MO', 'KS', 'NE', 'ND', 'SD']: return {"macro": "D", "macroName": "South & Plains USA", "meso": "D3", "mesoName": "Heartland"}
        if state == 'TX': return {"macro": "D", "macroName": "South & Plains USA", "meso": "D4", "mesoName": "Texas"}
        if state in ['CO', 'UT', 'ID', 'MT', 'WY']: return {"macro": "E", "macroName": "Mountain & Southwest", "meso": "E1", "mesoName": "Mountain"}
        if state in ['AZ', 'NM', 'NV']: return {"macro": "E", "macroName": "Mountain & Southwest", "meso": "E2", "mesoName": "Southwest"}
        if state == 'CA':
            if 936 <= prefix <= 961: return {"macro": "F", "macroName": "West Coast USA", "meso": "F1", "mesoName": "Northern California"}
            return {"macro": "F", "macroName": "West Coast USA", "meso": "F2", "mesoName": "Southern California"}
        if state in ['WA', 'OR']: return {"macro": "F", "macroName": "West Coast USA", "meso": "F3", "mesoName": "Pacific Northwest"}
    elif match_ca or is_canada:
        if match_ca:
            state = match_ca.group(1)
            fsa = match_ca.group(2)[0].upper()
        else:
            if " QC " in address or ", Quebec" in address: state = "QC"
            elif " ON " in address or ", Ontario" in address: state = "ON"
            
        if state == 'QC' or fsa in ['G', 'H', 'J']: return {"macro": "G", "macroName": "Canada East", "meso": "G1", "mesoName": "Quebec"}
        if state == 'ON' or fsa in ['K', 'L', 'M', 'N', 'P']: return {"macro": "G", "macroName": "Canada East", "meso": "G2", "mesoName": "Ontario"}
        if state in ['NB', 'NS', 'PE', 'NL'] or fsa in ['A', 'B', 'C', 'E']: return {"macro": "G", "macroName": "Canada East", "meso": "G3", "mesoName": "Atlantic Canada"}
        if state in ['MB', 'SK', 'AB'] or fsa in ['R', 'S', 'T']: return {"macro": "H", "macroName": "Canada West", "meso": "H1", "mesoName": "Prairies"}
        if state == 'BC' or fsa == 'V': return {"macro": "H", "macroName": "Canada West", "meso": "H2", "mesoName": "British Columbia"}
        if state in ['YT', 'NT', 'NU'] or fsa in ['X', 'Y']: return {"macro": "H", "macroName": "Canada West", "meso": "H3", "mesoName": "Northern Canada"}

    state_match = re.search(r',\s+([A-Z]{2})\s+', address)
    if state_match:
        st = state_match.group(1)
        if st in ['ME', 'NH', 'VT', 'MA', 'RI', 'CT']: return {"macro": "A", "macroName": "Northeast USA", "meso": "A1", "mesoName": "New England"}
    return None

def get_week_range(dt):
    start = dt - timedelta(days=dt.weekday())
    end = start + timedelta(days=6)
    return f"{start.strftime('%Y-%m-%d')}/{end.strftime('%Y-%m-%d')}"

def serialize_db_value(val):
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, dict):
        return {k: serialize_db_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_db_value(x) for x in val]
    return val

def main():
    suffix = "202605192205"
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')
    db_name = os.getenv('DB_NAME')
    db_user = os.getenv('DB_USER')
    db_pass = os.getenv('DB_PASS')

    use_db = False
    if db_host and db_user and db_pass and db_pass != 'your_real_password_here':
        use_db = True

    loads_raw_list = []
    carriers = []
    locations = []
    stops = []
    pevents = []
    schanges = []

    if use_db:
        print(f"Connecting to live database {db_host}:{db_port}/{db_name} as {db_user}...")
        try:
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_pass,
                connect_timeout=10
            )
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            print("Fetching tc_loads...")
            cursor.execute("SELECT * FROM tc_loads;")
            loads_raw_list = serialize_db_value(cursor.fetchall())
            
            print("Fetching tc_carriers...")
            cursor.execute("SELECT * FROM tc_carriers;")
            carriers = serialize_db_value(cursor.fetchall())
            
            print("Fetching tc_locations...")
            cursor.execute("SELECT * FROM tc_locations;")
            locations = serialize_db_value(cursor.fetchall())
            
            print("Fetching tc_stops...")
            cursor.execute("SELECT * FROM tc_stops;")
            stops = serialize_db_value(cursor.fetchall())
            
            print("Fetching tc_load_progress_events...")
            cursor.execute("SELECT * FROM tc_load_progress_events;")
            pevents = serialize_db_value(cursor.fetchall())
            
            print("Fetching tc_load_status_changes...")
            cursor.execute("SELECT * FROM tc_load_status_changes;")
            schanges = serialize_db_value(cursor.fetchall())
            
            cursor.close()
            conn.close()
            print("Successfully loaded all data from database.")
        except Exception as e:
            print(f"Database connection failed: {e}")
            print("Falling back to local database JSON files...")
            use_db = False

    if not use_db:
        print(f"Loading database JSONs with suffix {suffix}...")
        loads_raw_list = load_json(f'tc_loads_{suffix}.json')['tc_loads']
        carriers = load_json(f'tc_carriers_{suffix}.json')['tc_carriers']
        locations = load_json(f'tc_locations_{suffix}.json')['tc_locations']
        stops = load_json(f'tc_stops_{suffix}.json')['tc_stops']
        pevents = load_json(f'tc_load_progress_events_{suffix}.json')['tc_load_progress_events']
        schanges = load_json(f'tc_load_status_changes_{suffix}.json')['tc_load_status_changes']

    print(f"Filtering loads for organizationid = {ORG_ID} (loadstatus = 5)...")
    loads_fms = [l for l in loads_raw_list if l.get('organizationid') == ORG_ID and l.get('loadstatus') == 5]

    carrier_map = {c['id']: c for c in carriers}
    location_map = {l['id']: l for l in locations}

    stops_by_load = {}
    for s in stops:
        lid = s['loadid']
        if lid not in stops_by_load:
            stops_by_load[lid] = []
        stops_by_load[lid].append(s)

    for lid in stops_by_load:
        stops_by_load[lid].sort(key=lambda x: x.get('stopindex', 0))

    events_by_load = {}
    for e in pevents:
        lid = e.get('loadid')
        if lid not in events_by_load:
            events_by_load[lid] = []
        events_by_load[lid].append(e)

    schanges_by_load = {}
    for sc in schanges:
        lid = sc.get('loadid')
        if lid not in schanges_by_load:
            schanges_by_load[lid] = []
        schanges_by_load[lid].append(sc)

    frontend_loads = [] # react loads format
    loads_raw = []      # HTML loads_raw format
    cust_raw = []       # HTML cust_raw format
    per_load = []       # HTML PERF.per_load format

    print("Processing loads and stops...")
    for l in loads_fms:
        lid = l['id']
        uniqueid = l.get('uniqueid')
        status = l.get('loadstatus', 0)
        phone = l.get('phone')

        # Spend rate check
        rate = 0.0
        attrs = l.get('attributes', '{}')
        if isinstance(attrs, str):
            try: attrs = json.loads(attrs)
            except: attrs = {}
        if 'rate' in attrs and attrs['rate']:
            try: rate = float(attrs['rate'])
            except: rate = 0.0

        # Carrier mapping
        c_obj = carrier_map.get(l.get('carrierid'))
        c_name = c_obj['name'] if c_obj else "Unknown"

        lstops = stops_by_load.get(lid, [])
        if not lstops:
            continue

        # Sort out stops based on database type: 0 = PICKUP, 1 or 2 = DROP/DELIVERY
        pickups_stops = [s for s in lstops if s.get('type') == 0]
        delivery_stops = [s for s in lstops if s.get('type') in (1, 2)]

        if not pickups_stops and lstops:
            # Fallback if no type 0 stops exist
            pickups_stops = [lstops[0]]
            delivery_stops = lstops[1:]

        origin_stop = pickups_stops[0] if pickups_stops else None

        if not origin_stop:
            continue

        picks_count = len(pickups_stops)
        drops_count = len(delivery_stops)

        # Report date from origin stop, applying 8-hour timezone shift
        o_date_str = origin_stop.get('date')
        if not o_date_str:
            continue

        try:
            dt = datetime.fromisoformat(o_date_str.replace('Z', '+00:00'))
            dt = dt - timedelta(hours=8)
        except:
            continue

        date_str = dt.strftime('%Y-%m-%d')
        month_str = dt.strftime('%Y-%m')
        dow_str = dt.strftime('%A')
        week_str = get_week_range(dt)

        delivery_count = len(delivery_stops)
        if delivery_count == 0:
            continue

        spend_per_stop = rate / delivery_count
        trip_type = "LTL" if delivery_count > 1 else "TL"

        # Map origin location
        orig_loc = location_map.get(origin_stop['locationid'])
        origin_name = orig_loc['name'] if orig_loc else "Unknown"
        origin_address = orig_loc['address'] if orig_loc else ""
        origin_zone = get_zone_html(origin_address, origin_name)
        is_sherrington = "Sherrington" in origin_name or "Sherrington" in origin_address

        # Process delivery stops
        loc_names = []
        zones = []
        react_customers = []

        for s in delivery_stops:
            loc = location_map.get(s['locationid'])
            if not loc:
                continue

            loc_name = loc['name']
            loc_address = loc['address'] or ""

            loc_names.append(loc_name)

            zone = get_zone_html(loc_address, loc_name)
            zones.append(zone)

            # React customer format
            zone_react = get_zone_original(loc_address)
            state_code = "Unknown"
            norm_addr = normalize_address(loc_address)
            match_st = re.search(r',\s+([A-Z]{2})\s+', norm_addr)
            if match_st:
                state_code = match_st.group(1)

            city_parsed, state_parsed = parse_city_state(loc_address)
            final_state = state_parsed if state_parsed != "Unknown" else state_code

            entered_at = s.get('enteredat')
            completed_at = s.get('completedat')
            exited_at = s.get('exitedat')
            planned_at = s.get('date')
            checkout_at = exited_at or completed_at
            dwell_mins = None
            if entered_at and checkout_at:
                try:
                    ent_dt = datetime.fromisoformat(entered_at.replace('Z', '+00:00'))
                    chk_dt = datetime.fromisoformat(checkout_at.replace('Z', '+00:00'))
                    start_dt = ent_dt
                    if planned_at:
                        planned_dt = datetime.fromisoformat(planned_at.replace('Z', '+00:00'))
                        start_dt = max(ent_dt, planned_dt)
                    diff = (chk_dt - start_dt).total_seconds() / 60.0
                    dwell_mins = max(0, int(diff))
                except:
                    pass

            c_data = {
                "name": loc_name,
                "address": loc_address,
                "spend_share": spend_per_stop,
                "state": final_state,
                "city": city_parsed,
                "zone": zone_react,
                "stop_date": s.get('date', o_date_str),
                "planned_at": s.get('date'),
                "completed_at": completed_at,
                "entered_at": entered_at,
                "exited_at": exited_at,
                "dwell_mins": dwell_mins
            }
            react_customers.append(c_data)

            # HTML report cust_raw format
            cust_raw.append({
                "loadid": lid,
                "loc_name": loc_name,
                "zone": zone,
                "carrier": c_name,
                "trip_type": trip_type,
                "spend_per_stop": spend_per_stop,
                "total_load_spend": rate,
                "stop_count": delivery_count,
                "date": date_str
            })

        base_zone = zones[0] if zones else "Unknown"

        # Process pickup stops → shippers list
        # Each pickup stop contributes 1.0 load (regardless of delivery count)
        react_shippers = []
        for s in pickups_stops:
            loc = location_map.get(s['locationid'])
            if not loc:
                continue

            sh_name = loc['name']
            sh_address = loc['address'] or ""
            sh_zone_react = get_zone_original(sh_address)

            norm_addr_sh = normalize_address(sh_address)
            match_st_sh = re.search(r',\s+([A-Z]{2})\s+', norm_addr_sh)
            state_code_sh = match_st_sh.group(1) if match_st_sh else "Unknown"
            city_parsed_sh, state_parsed_sh = parse_city_state(sh_address)
            final_state_sh = state_parsed_sh if state_parsed_sh != "Unknown" else state_code_sh

            entered_at = s.get('enteredat')
            completed_at = s.get('completedat')
            exited_at = s.get('exitedat')
            planned_at = s.get('date')
            checkout_at = exited_at or completed_at
            dwell_mins = None
            if entered_at and checkout_at:
                try:
                    ent_dt = datetime.fromisoformat(entered_at.replace('Z', '+00:00'))
                    chk_dt = datetime.fromisoformat(checkout_at.replace('Z', '+00:00'))
                    start_dt = ent_dt
                    if planned_at:
                        planned_dt = datetime.fromisoformat(planned_at.replace('Z', '+00:00'))
                        start_dt = max(ent_dt, planned_dt)
                    diff = (chk_dt - start_dt).total_seconds() / 60.0
                    dwell_mins = max(0, int(diff))
                except:
                    pass

            react_shippers.append({
                "name": sh_name,
                "address": sh_address,
                "state": final_state_sh,
                "city": city_parsed_sh,
                "zone": sh_zone_react,
                "stop_date": s.get('date', o_date_str),
                "planned_at": s.get('date'),
                "completed_at": completed_at,
                "entered_at": entered_at,
                "exited_at": exited_at,
                "dwell_mins": dwell_mins
            })

        # HTML report loads_raw format
        loads_raw.append({
            "id": lid,
            "date": date_str,
            "month": month_str,
            "week": week_str,
            "dow": dow_str,
            "carrier": c_name,
            "status": status,
            "trip_type": trip_type,
            "delivery_count": delivery_count,
            "spend": rate,
            "base_zone": base_zone,
            "zones": zones,
            "loc_names": loc_names,
            "origin_name": origin_name,
            "origin_zone": origin_zone,
            "is_sherrington": is_sherrington
        })

        # --- Driver Performance Tracking (PERF.per_load) ---
        levents = events_by_load.get(lid, [])
        lchanges = schanges_by_load.get(lid, [])

        event_types = {e.get('type') for e in levents}
        has_phone = bool(phone and phone.strip())
        has_sms = any(t.startswith('SMS_') for t in event_types)
        already_logged = 'DRIVER_ALREADY_LOGGED_IN' in event_types
        logged_in = already_logged or 'DRIVER_LOGGED_IN' in event_types
        accepted = already_logged or 'DRIVER_ACCEPTED' in event_types
        driver_delivered = 'DRIVER_DELIVERED' in event_types

        # Path mapping
        if already_logged:
            path = 'A_already_logged'
        elif logged_in:
            path = 'B_sms_logged'
        elif has_sms:
            path = 'C_sms_no_response'
        else:
            path = 'D_no_driver'

        # Close method & manual close tracking
        if status != 5:
            close_method = 'still_open'
            manual_close = False
        else:
            if driver_delivered:
                close_method = 'driver_self'
                manual_close = False
            else:
                # Driver forgot or never used app, so dispatcher closed it
                # Check status changes to see if it ever transitioned to active (status 4)
                reached_active = any(sc.get('status') == 4 for sc in lchanges)
                if has_phone and accepted:
                    close_method = 'office_manual'
                elif has_phone and not accepted:
                    close_method = 'office_auto'
                else:
                    # No phone, manually completed by office
                    close_method = 'office_manual'
                manual_close = True

        never_app = not has_phone and not logged_in and not accepted

        # Time offsets for SMS to Login/Accept
        sms_to_login_h = None
        sms_to_accept_h = None

        if has_sms:
            # Find first SMS sent event
            sms_sent_events = [e for e in levents if e.get('type') in ('SMS_DELIVERY_SENT', 'SMS_SEND_REQUESTED')]
            if sms_sent_events:
                sms_sent_events.sort(key=lambda x: x.get('createdat'))
                sms_time = datetime.fromisoformat(sms_sent_events[0]['createdat'].replace('Z', '+00:00'))

                # Login offset
                login_events = [e for e in levents if e.get('type') == 'DRIVER_LOGGED_IN']
                if login_events:
                    login_events.sort(key=lambda x: x.get('createdat'))
                    login_time = datetime.fromisoformat(login_events[0]['createdat'].replace('Z', '+00:00'))
                    diff = (login_time - sms_time).total_seconds() / 3600.0
                    if diff >= 0: sms_to_login_h = round(diff, 2)

                # Accept offset
                accept_events = [e for e in levents if e.get('type') == 'DRIVER_ACCEPTED']
                if accept_events:
                    accept_events.sort(key=lambda x: x.get('createdat'))
                    accept_time = datetime.fromisoformat(accept_events[0]['createdat'].replace('Z', '+00:00'))
                    diff = (accept_time - sms_time).total_seconds() / 3600.0
                    if diff >= 0: sms_to_accept_h = round(diff, 2)

        per_load.append({
            "loadid": lid,
            "month": month_str,
            "status": status,
            "path": path,
            "has_phone": has_phone,
            "has_sms": has_sms,
            "already_logged": already_logged,
            "logged_in": logged_in,
            "accepted": accepted,
            "driver_delivered": driver_delivered,
            "close_method": close_method,
            "manual_close": manual_close,
            "never_app": never_app,
            "sms_to_login_h": sms_to_login_h,
            "sms_to_accept_h": sms_to_accept_h
        })

        frontend_loads.append({
            "id": lid,
            "uniqueid": uniqueid,
            "date": date_str,
            "month": month_str,
            "dow": dow_str,
            "total_spend": rate,
            "carrier": c_name,
            "trip_type": trip_type,
            "picks_count": picks_count,
            "drops_count": drops_count,
            "customers": react_customers,
            "shippers": react_shippers,
            "compliance": {
                "path": path,
                "has_phone": has_phone,
                "has_sms": has_sms,
                "already_logged": already_logged,
                "logged_in": logged_in,
                "accepted": accepted,
                "driver_delivered": driver_delivered,
                "close_method": close_method,
                "manual_close": manual_close,
                "never_app": never_app,
                "sms_to_login_h": sms_to_login_h,
                "sms_to_accept_h": sms_to_accept_h
            }
        })

    # --- Aggregations for Standalone HTML Report RAW ---
    print("Aggregating metrics...")

    # Monthly Map
    monthly_map = {}
    for l in loads_raw:
        m = l['month']
        if m not in monthly_map:
            monthly_map[m] = {
                "month": m, "loads": 0, "spend": 0.0, "single": 0, "multi": 0, "carriers": set()
            }
        mm = monthly_map[m]
        mm["loads"] += 1
        mm["spend"] += l["spend"]
        if l["trip_type"] == "TL":
            mm["single"] += 1
        else:
            mm["multi"] += 1
        mm["carriers"].add(l["carrier"])

    monthly = []
    for m, mm in sorted(monthly_map.items()):
        mm["carriers"] = len(mm["carriers"])
        monthly.append(mm)

    # Weekly Map
    weekly_map = {}
    for l in loads_raw:
        w = l['week']
        if w not in weekly_map:
            weekly_map[w] = {
                "week": w, "loads": 0, "spend": 0.0, "single": 0, "multi": 0
            }
        wm = weekly_map[w]
        wm["loads"] += 1
        wm["spend"] += l["spend"]
        if l["trip_type"] == "TL":
            wm["single"] += 1
        else:
            wm["multi"] += 1

    weekly = [wm for w, wm in sorted(weekly_map.items())]

    # Day of Week Map
    dow_map = {"Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0, "Saturday": 0, "Sunday": 0}
    for l in loads_raw:
        d = l['dow']
        if d in dow_map:
            dow_map[d] += 1
        else:
            dow_map[d] = 1

    # Carrier Aggregation
    carrier_agg = {}
    for l in loads_raw:
        c = l['carrier']
        if c not in carrier_agg:
            carrier_agg[c] = {
                "name": c, "loads": 0, "single": 0, "multi": 0, "spend": 0.0, "customers": set(), "zones": {}
            }
        ca = carrier_agg[c]
        ca["loads"] += 1
        if l["trip_type"] == "TL": ca["single"] += 1
        else: ca["multi"] += 1
        ca["spend"] += l["spend"]
        for name in l["loc_names"]:
            ca["customers"].add(name)
        bz = l["base_zone"]
        ca["zones"][bz] = ca["zones"].get(bz, 0) + 1

    carriers_list = []
    for c_name, ca in carrier_agg.items():
        # Determine top zone
        top_zone = None
        if ca["zones"]:
            top_zone = sorted(ca["zones"].items(), key=lambda x: x[1], reverse=True)[0][0]
        
        # Deterministic dummy acceptance rate
        dummy_rate = 95 + (hash(c_name) % 5)

        carriers_list.append({
            "name": ca["name"],
            "loads": ca["loads"],
            "rate": dummy_rate,
            "single": ca["single"],
            "multi": ca["multi"],
            "spend": ca["spend"],
            "avg": round(ca["spend"] / ca["loads"]) if ca["loads"] > 0 else 0,
            "customers": len(ca["customers"]),
            "top_zone": top_zone
        })
    carriers_list.sort(key=lambda x: x["loads"], reverse=True)

    # Customer Aggregation
    customer_agg = {}
    for l in loads_raw:
        for loc_name, loc_zone in zip(l["loc_names"], l["zones"]):
            if loc_name not in customer_agg:
                customer_agg[loc_name] = {
                    "name": loc_name, "zone": loc_zone, "loads": 0, "single": 0, "multi": 0, "spend": 0.0, "carriers": {}
                }
            cua = customer_agg[loc_name]
            cua["loads"] += 1
            if l["trip_type"] == "TL": cua["single"] += 1
            else: cua["multi"] += 1
            # For customer's spend share: split evenly among all delivery locations
            cua["spend"] += l["spend"] / len(l["loc_names"])
            cua["carriers"][l["carrier"]] = cua["carriers"].get(l["carrier"], 0) + 1

    customers_list = []
    for c_name, cua in customer_agg.items():
        top_carrier = sorted(cua["carriers"].items(), key=lambda x: x[1], reverse=True)[0][0] if cua["carriers"] else "Unknown"
        customers_list.append({
            "name": cua["name"],
            "zone": cua["zone"],
            "loads": cua["loads"],
            "single": cua["single"],
            "multi": cua["multi"],
            "spend": round(cua["spend"], 2),
            "top_carrier": top_carrier,
            "all_carriers": cua["carriers"]
        })
    customers_list.sort(key=lambda x: x["loads"], reverse=True)

    # Zone Aggregation
    zone_agg = {}
    for l in loads_raw:
        z = l["base_zone"]
        if z not in zone_agg:
            zone_agg[z] = {
                "zone": z, "loads": 0, "single": 0, "multi": 0, "spend": 0.0, "carriers": {}
            }
        za = zone_agg[z]
        za["loads"] += 1
        if l["trip_type"] == "TL": za["single"] += 1
        else: za["multi"] += 1
        za["spend"] += l["spend"]
        za["carriers"][l["carrier"]] = za["carriers"].get(l["carrier"], 0) + 1

    zones_list = []
    for z_name, za in zone_agg.items():
        top_carrier = sorted(za["carriers"].items(), key=lambda x: x[1], reverse=True)[0][0] if za["carriers"] else "Unknown"
        zones_list.append({
            "zone": za["zone"],
            "rate": 0,
            "loads": za["loads"],
            "single": za["single"],
            "multi": za["multi"],
            "spend": za["spend"],
            "avg": round(za["spend"] / za["loads"]) if za["loads"] > 0 else 0,
            "top_carrier": top_carrier
        })
    zones_list.sort(key=lambda x: x["loads"], reverse=True)

    # Lanes (computed dynamically in JS in HTML dashboard, but compiled here for safety/real-data compatibility)
    lanes_list = []
    # Build list of unique (origin → destination zone) from loads
    lanes_agg = {}
    for l in loads_raw:
        orig = l["origin_name"]
        to_z = l["base_zone"]
        if to_z == 'Unknown' or not to_z: continue
        key = (orig, to_z)
        if key not in lanes_agg:
            lanes_agg[key] = {
                "from": orig, "fromZone": l["origin_zone"], "toZone": to_z,
                "loads": 0, "single": 0, "multi": 0, "spend": 0.0, "carriers": {}, "customers": set()
            }
        la = lanes_agg[key]
        la["loads"] += 1
        if l["trip_type"] == "TL": la["single"] += 1
        else: la["multi"] += 1
        la["spend"] += l["spend"]
        la["carriers"][l["carrier"]] = la["carriers"].get(l["carrier"], 0) + 1
        for name in l["loc_names"]:
            la["customers"].add(name)

    for (orig, to_z), la in lanes_agg.items():
        top_carrier = sorted(la["carriers"].items(), key=lambda x: x[1], reverse=True)[0][0] if la["carriers"] else "Unknown"
        lanes_list.append({
            "to_zone": la["toZone"],
            "loads": la["loads"],
            "single": la["single"],
            "multi": la["multi"],
            "spend": la["spend"],
            "avg": round(la["spend"] / la["loads"]) if la["loads"] > 0 else 0,
            "top_carrier": top_carrier,
            "carriers": la["carriers"],
            "customers": sorted(list(la["customers"]))[:6]
        })
    lanes_list.sort(key=lambda x: x["loads"], reverse=True)

    # --- Concentration Risk (CONC) ---
    total_loads = len(loads_raw)
    total_spend = sum(l["spend"] for l in loads_raw)

    conc_carriers = []
    for c in carriers_list[:10]:
        conc_carriers.append({
            "name": c["name"],
            "loads": c["loads"],
            "pct": round(c["loads"] / total_loads * 100, 1) if total_loads > 0 else 0,
            "spend": c["spend"],
            "spend_pct": round(c["spend"] / total_spend * 100, 1) if total_spend > 0 else 0
        })

    conc_customers = []
    for cust in customers_list[:10]:
        conc_customers.append({
            "name": cust["name"],
            "pct": round(cust["loads"] / total_loads * 100, 1) if total_loads > 0 else 0,
            "spend": cust["spend"],
            "spend_pct": round(cust["spend"] / total_spend * 100, 1) if total_spend > 0 else 0
        })

    conc_zones = []
    for z in zones_list[:10]:
        conc_zones.append({
            "zone": z["zone"],
            "pct": round(z["loads"] / total_loads * 100, 1) if total_loads > 0 else 0,
            "spend": z["spend"],
            "spend_pct": round(z["spend"] / total_spend * 100, 1) if total_spend > 0 else 0
        })

    # Insurance Status Calculations
    # Date baseline for checking expired: 2026-05-20
    today = datetime(2026, 5, 20).date()
    expired_carriers_list = []
    expiring_soon_carriers_list = []

    # Get carrier loads map
    carrier_loads_count = {c["name"]: c["loads"] for c in carriers_list}

    for c in carriers:
        if c.get('organizationid') != ORG_ID or c.get('deleted'):
            continue
        c_name = c['name']
        exp_str = c.get('insuranceexpiry')
        if exp_str:
            try:
                exp_date = datetime.strptime(exp_str[:10], '%Y-%m-%d').date()
                loads_count = carrier_loads_count.get(c_name, 0)
                if exp_date < today:
                    expired_carriers_list.append({
                        "carrier": c_name,
                        "expiry": exp_str[:10],
                        "loads": loads_count
                    })
                elif today <= exp_date < today + timedelta(days=90):
                    expiring_soon_carriers_list.append({
                        "carrier": c_name,
                        "expiry": exp_str[:10],
                        "loads": loads_count
                    })
            except Exception as e:
                pass

    expired_carriers_list.sort(key=lambda x: x["loads"], reverse=True)
    expiring_soon_carriers_list.sort(key=lambda x: x["loads"], reverse=True)

    CONC = {
        "carriers": {
            "top1_pct": conc_carriers[0]["pct"] if len(conc_carriers) >= 1 else 0,
            "top3_pct": sum(c["pct"] for c in conc_carriers[:3]) if len(conc_carriers) >= 3 else 0,
            "top5_pct": sum(c["pct"] for c in conc_carriers[:5]) if len(conc_carriers) >= 5 else 0,
            "top_list": conc_carriers
        },
        "customers": {
            "top1_pct": conc_customers[0]["pct"] if len(conc_customers) >= 1 else 0,
            "top3_pct": sum(c["pct"] for c in conc_customers[:3]) if len(conc_customers) >= 3 else 0,
            "top5_pct": sum(c["pct"] for c in conc_customers[:5]) if len(conc_customers) >= 5 else 0,
            "top10_pct": sum(c["pct"] for c in conc_customers[:10]) if len(conc_customers) >= 10 else 0,
            "top_list": conc_customers
        },
        "zones": {
            "top1_pct": conc_zones[0]["pct"] if len(conc_zones) >= 1 else 0,
            "top2_pct": sum(z["pct"] for z in conc_zones[:2]) if len(conc_zones) >= 2 else 0,
            "top_list": conc_zones
        },
        "insurance": {
            "expired": expired_carriers_list,
            "expiring_soon": expiring_soon_carriers_list,
            "total_expired": len(expired_carriers_list),
            "total_expiring": len(expiring_soon_carriers_list)
        },
        "totals": {
            "loads": total_loads,
            "spend": total_spend,
            "unique_carriers": len(carriers_list),
            "unique_customers": len(customers_list),
            "unique_zones": len(zones_list)
        }
    }

    # Customer Retention stats
    RETENTION = {}
    # For each customer location:
    # monthly counts, first_seen, last_seen, active months, status
    all_months = sorted(list(monthly_map.keys()))
    for cua in customers_list:
        c_name = cua["name"]
        # Find all loads for this customer
        cust_loads = [l for l in loads_raw if c_name in l["loc_names"]]
        if not cust_loads: continue
        cust_loads.sort(key=lambda x: x["date"])
        
        first_seen = cust_loads[0]["date"]
        last_seen = cust_loads[-1]["date"]
        
        last_date = datetime.strptime(last_seen, '%Y-%m-%d').date()
        days_since_last = (today - last_date).days
        
        monthly_counts = {m: 0 for m in all_months}
        for cl in cust_loads:
            m = cl["month"]
            if m in monthly_counts:
                monthly_counts[m] += 1
                
        active_months = [m for m, val in monthly_counts.items() if val > 0]
        active_count = len(active_months)
        total_cust_loads = len(cust_loads)
        
        # Classification status rules
        if days_since_last > 60:
            status_ret = "Inactive"
        elif days_since_last <= 14 and (today - datetime.strptime(first_seen, '%Y-%m-%d').date()).days <= 30:
            status_ret = "New"
        elif active_count >= 3 and total_cust_loads >= 4:
            status_ret = "Regular"
        elif active_count == 2 or (active_count == 3 and total_cust_loads < 4):
            status_ret = "Seasonal"
        else:
            status_ret = "Occasional"
            
        RETENTION[c_name] = {
            "first_seen": first_seen,
            "last_seen": last_seen,
            "days_since_last": days_since_last,
            "active_months": active_months,
            "active_count": active_count,
            "monthly_counts": monthly_counts,
            "status": status_ret
        }
    # --- Process Active Loads ---
    active_loads_fms = [l for l in loads_raw_list if l.get('organizationid') == ORG_ID and l.get('loadstatus') in [0, 1, 3, 4]]
    frontend_active_loads = []
    
    for l in active_loads_fms:
        lid = l['id']
        uniqueid = l.get('uniqueid')
        status = l.get('loadstatus', 0)
        
        carrierid = l.get('carrierid')
        c_name = "Unknown"
        if carrierid and carrierid in carrier_map:
            c_name = carrier_map[carrierid]['name']
            
        stops = stops_by_load.get(lid, [])
        pickups_stops = [s for s in stops if s.get('type') == 'pickup']
        delivery_stops = [s for s in stops if s.get('type') == 'delivery']
        
        picks_count = len(pickups_stops)
        drops_count = len(delivery_stops)
        
        react_customers = []
        for s in delivery_stops:
            loc = location_map.get(s['locationid'])
            if not loc:
                continue
            loc_address = loc['address'] or ""
            city_parsed, state_parsed = parse_city_state(loc_address)
            react_customers.append({
                "name": loc['name'],
                "state": state_parsed,
                "city": city_parsed,
                "planned_at": s.get('date'),
                "completed_at": s.get('completedat')
            })
            
        react_shippers = []
        for s in pickups_stops:
            loc = location_map.get(s['locationid'])
            if not loc:
                continue
            loc_address = loc['address'] or ""
            city_parsed, state_parsed = parse_city_state(loc_address)
            react_shippers.append({
                "name": loc['name'],
                "state": state_parsed,
                "city": city_parsed,
                "planned_at": s.get('date'),
                "completed_at": s.get('completedat')
            })
            
        frontend_active_loads.append({
            "id": lid,
            "uniqueid": uniqueid,
            "status": status,
            "carrier": c_name,
            "trip_type": "LTL" if drops_count > 1 else "TL",
            "picks_count": picks_count,
            "drops_count": drops_count,
            "customers": react_customers,
            "shippers": react_shippers
        })

    # --- Write Outputs ---
    
    # 1. Output real-data.json for React dashboard
    react_output = {
        "loads": frontend_loads,
        "active_loads": frontend_active_loads,
        "insurance": CONC["insurance"]
    }
    with open(output_path, 'w') as f:
        json.dump(react_output, f, indent=2)
    print(f"React frontend JSON saved to {output_path}")

    # Standalone HTML report generator removed (obsolete)

    print(f"Successfully processed {len(loads_raw)} valid loads.")

if __name__ == "__main__":
    main()
