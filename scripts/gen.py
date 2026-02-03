#!/usr/bin/env python3
"""Generate all data files for Keystone Security Distribution demo."""
import os, json, math, csv, io

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# Seeded RNG
_seed = 42
def sr():
    global _seed
    _seed = (_seed * 16807) % 2147483647
    return (_seed - 1) / 2147483646
def rb(a, b): return a + sr() * (b - a)
def ri(a, b): return int(rb(a, b + 0.999))
def pk(arr): return arr[int(sr() * len(arr)) % len(arr)]
def wp(items, weights):
    t = sum(weights); r = sr() * t
    for i, w in enumerate(weights):
        r -= w
        if r <= 0: return items[i]
    return items[-1]

def esc(v):
    if v is None: return ''
    s = str(v)
    if ',' in s or '"' in s or '\n' in s:
        return '"' + s.replace('"', '""') + '"'
    return s

def write_csv(fname, headers, rows):
    lines = [','.join(headers)]
    for row in rows:
        lines.append(','.join(esc(row.get(h, '')) for h in headers))
    with open(os.path.join(DATA_DIR, fname), 'w', newline='') as f:
        f.write('\n'.join(lines) + '\n')
    print(f"  {fname}: {len(rows)} rows")

def fmt_date(y, m, d):
    return f"{y}-{m:02d}-{d:02d}"

def add_bdays(y, m, d, days):
    import datetime
    dt = datetime.date(y, m, d)
    added = 0
    while added < days:
        dt += datetime.timedelta(days=1)
        if dt.weekday() < 5: added += 1
    return dt

def days_in_month(y, m):
    import datetime
    if m == 12: return 31
    return (datetime.date(y, m+1, 1) - datetime.date(y, m, 1)).days

# ─── PRODUCTS ───
CATS = [
    {"l1":"Residential Locks","l2":"Deadbolts","c":"RES-DBL","mn":.28,"mx":.32,"pn":25,"px":120,"mf":["Schlage","Kwikset","Yale","Weiser","Falcon"],"ns":["Single Cylinder Deadbolt - Satin Nickel","Single Cylinder Deadbolt - Aged Bronze","Single Cylinder Deadbolt - Matte Black","Single Cylinder Deadbolt - Polished Brass","Double Cylinder Deadbolt - Satin Nickel","Double Cylinder Deadbolt - Aged Bronze","Double Cylinder Deadbolt - Polished Chrome","Single Cylinder Deadbolt - Bright Chrome","Jimmy-Proof Deadlock - Silver","High Security Deadbolt - Satin Chrome","Grade 1 Deadbolt - Brass","Grade 2 Deadbolt - Satin Nickel"],"u":"EA","q":1},
    {"l1":"Residential Locks","l2":"Entry Knobs","c":"RES-KNB","mn":.28,"mx":.32,"pn":15,"px":85,"mf":["Schlage","Kwikset","Yale","Weiser"],"ns":["Entry Knob Georgian - Satin Nickel","Entry Knob Georgian - Aged Bronze","Entry Knob Plymouth - Bright Brass","Entry Knob Plymouth - Satin Chrome","Entry Knob Tylo - Satin Nickel","Entry Knob Tylo - Polished Brass","Privacy Knob - Satin Nickel","Privacy Knob - Aged Bronze","Passage Knob - Satin Nickel","Passage Knob - Polished Brass"],"u":"EA","q":1},
    {"l1":"Residential Locks","l2":"Handlesets","c":"RES-HND","mn":.28,"mx":.32,"pn":75,"px":350,"mf":["Schlage","Kwikset","Yale","Weiser"],"ns":["Handleset Camelot - Satin Nickel","Handleset Camelot - Aged Bronze","Handleset Addison - Bright Chrome","Handleset Addison - Matte Black","Handleset Century - Satin Nickel","Handleset Plymouth - Polished Brass","Handleset Georgian - Satin Nickel","Handleset Brookshire - Aged Bronze","Handleset Arlington - Matte Black","Front Entry Handleset - Satin Chrome"],"u":"EA","q":1},
    {"l1":"Residential Locks","l2":"Smart Locks","c":"RES-SMT","mn":.28,"mx":.32,"pn":120,"px":350,"mf":["Schlage","Kwikset","Yale","Alarm Lock"],"ns":["Smart Deadbolt Encode Plus - Satin Nickel","Smart Deadbolt Encode Plus - Matte Black","Smart Lock Connect - Aged Bronze","Smart Lock Connect - Satin Chrome","Wi-Fi Smart Lock - Satin Nickel","Wi-Fi Smart Lock - Polished Brass","Bluetooth Smart Lock - Matte Black","Smart Lever with Touchscreen - Satin Nickel","Smart Deadbolt with Camera - Matte Black","Z-Wave Smart Lock - Satin Nickel"],"u":"EA","q":1},
    {"l1":"Residential Locks","l2":"Keypad Locks","c":"RES-KPD","mn":.28,"mx":.32,"pn":80,"px":250,"mf":["Schlage","Kwikset","Yale","Alarm Lock"],"ns":["Keypad Deadbolt BE365 - Satin Chrome","Keypad Deadbolt BE365 - Aged Bronze","Keypad Lever FE595 - Satin Nickel","Keypad Lever FE595 - Matte Black","Touch Keypad Deadbolt - Satin Nickel","Touch Keypad Deadbolt - Polished Brass","Electronic Keypad Lock - Bright Chrome","Keypad Entry Knob - Satin Nickel"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Cylindrical Locks","c":"COM-CYL","mn":.35,"mx":.40,"pn":45,"px":350,"mf":["Schlage","Corbin Russwin","Yale","Sargent","Falcon","Best"],"ns":["Cylindrical Lock ND60PD - 626","Cylindrical Lock ND80PD - 626","Cylindrical Lock ND50PD - 613","Cylindrical Lock ND70PD - 626","Cylindrical Lock ND25D - 626","Heavy Duty Cylindrical Lock - 630","Grade 1 Cylindrical Lockset - Classroom","Grade 1 Cylindrical Lockset - Storeroom","Grade 1 Cylindrical Lockset - Office","Grade 2 Cylindrical Lock - Entry"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Mortise Locks","c":"COM-MOR","mn":.35,"mx":.40,"pn":150,"px":800,"mf":["Schlage","Corbin Russwin","Yale","Sargent","Marks USA"],"ns":["Mortise Lock L9050 - Classroom","Mortise Lock L9060 - Apartment","Mortise Lock L9080 - Storeroom","Mortise Lock L9070 - Classroom","Mortise Lock L9040 - Privacy","Mortise Lock L9092 - Electrified","Mortise Lockset - Office Function","Mortise Lockset - Entry Function","Heavy Duty Mortise Lock - Institutional","Grade 1 Mortise Body - 626"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Exit Devices","c":"COM-EXT","mn":.35,"mx":.40,"pn":200,"px":1500,"mf":["Von Duprin","Sargent","Corbin Russwin","Falcon"],"ns":["Exit Device 98EO - Rim 36in","Exit Device 98EO - Rim 48in","Exit Device 99EO - SVR 36in","Exit Device 99EO - SVR 48in","Concealed Vertical Rod Device - 36in","Surface Vertical Rod Device - 48in","Rim Exit Device Grade 1 - 36in","Rim Exit Device Grade 1 - 48in","Fire Rated Exit Device - 36in","Motorized Latch Retraction Device","Delayed Egress Exit Device","Exit Alarm Device - 36in"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Door Closers","c":"COM-CLS","mn":.35,"mx":.40,"pn":35,"px":450,"mf":["LCN","Norton","Yale","Sargent","Falcon"],"ns":["Door Closer 4040XP - Aluminum","Door Closer 4040XP - Dark Bronze","Door Closer 4011 - Regular Arm","Door Closer 4041 - Hold Open Arm","Door Closer 1600 Series - Aluminum","Door Closer 1600 Series - Bronze","Concealed Door Closer - Aluminum","Surface Door Closer - Hold Open","ADA Compliant Door Closer","Heavy Duty Door Closer - Institutional"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Hinges","c":"COM-HNG","mn":.35,"mx":.40,"pn":25,"px":120,"mf":["Hager","McKinney","Ives","Stanley"],"ns":["Full Mortise Hinge 4.5x4.5 - 26D","Full Mortise Hinge 4.5x4.5 - US10B","Full Mortise Hinge 4x4 - 26D","Full Mortise Hinge 5x4.5 - 26D","Spring Hinge 4.5x4.5 - 26D","Continuous Hinge 83in - Clear","Pivot Hinge Set - Aluminum","Ball Bearing Hinge 4.5 - 630","Heavy Weight Hinge 5x5 - 26D","Electric Hinge 4-Wire - 26D"],"u":"EA","q":1},
    {"l1":"Commercial Hardware","l2":"Thresholds","c":"COM-THR","mn":.35,"mx":.40,"pn":25,"px":180,"mf":["Pemko","National Guard","Reese","Zero International"],"ns":["Saddle Threshold 36in - Aluminum","Saddle Threshold 48in - Aluminum","ADA Ramp Threshold 36in - Bronze","ADA Ramp Threshold 48in - Aluminum","Thermal Break Threshold 36in","Adjustable Threshold 36in","Bumper Seal Threshold 36in","Heavy Duty Mill Threshold 48in"],"u":"EA","q":1},
    {"l1":"Access Control","l2":"Card Readers","c":"ACC-RDR","mn":.35,"mx":.50,"pn":80,"px":450,"mf":["HID Global","Allegion","dormakaba","NAPCO"],"ns":["Proximity Reader iCLASS SE - Black","Proximity Reader iCLASS SE - Gray","Multi-Class Reader SE - Black","Proximity Reader R10 - Black","Proximity Reader R40 - Long Range","Mobile-Ready Reader - Bluetooth","Biometric Reader with Card - Black","Mullion Mount Reader - Black","Weatherproof Card Reader - Gray","Smart Card Reader - Contactless"],"u":"EA","q":1},
    {"l1":"Access Control","l2":"Controllers","c":"ACC-CTL","mn":.35,"mx":.50,"pn":200,"px":1500,"mf":["HID Global","Allegion","NAPCO","dormakaba"],"ns":["Access Controller 2-Door - IP","Access Controller 4-Door - IP","Access Controller 8-Door - IP","Single Door Controller - PoE","Elevator Controller - 16 Floor","Network Access Panel - 2 Reader","Access Control Board - 4 Reader","Wireless Lock Controller","Edge Controller - Single Door","Cloud-Based Controller Module"],"u":"EA","q":1},
    {"l1":"Access Control","l2":"Credentials","c":"ACC-CRD","mn":.35,"mx":.50,"pn":50,"px":300,"mf":["HID Global","Allegion","dormakaba"],"ns":["Proximity Cards iCLASS - 100 Pack","Proximity Cards HID 1326 - 100 Pack","Smart Cards SEOS - 50 Pack","Key Fobs iCLASS - 50 Pack","Key Fobs Prox - 100 Pack","Wristband Credentials - 25 Pack","Mobile Credential License - 100 Pack","Clamshell Cards 125kHz - 100 Pack"],"u":"PK","q":1},
    {"l1":"Access Control","l2":"Electric Strikes","c":"ACC-STR","mn":.35,"mx":.50,"pn":50,"px":350,"mf":["HES","Von Duprin","Securitron","Folger Adam"],"ns":["Electric Strike 1006 - 12/24VDC","Electric Strike 1006 - Fail Secure","Electric Strike 1006 - Fail Safe","Electric Strike 9600 - 12/24VDC","Heavy Duty Electric Strike - Mortise","Fire Rated Electric Strike","Electric Strike for Rim Device","Compact Electric Strike - 12VDC","Surface Mount Electric Strike","Electric Release - Cylindrical Lock"],"u":"EA","q":1},
    {"l1":"Access Control","l2":"Maglocks","c":"ACC-MAG","mn":.35,"mx":.50,"pn":75,"px":400,"mf":["Securitron","Dortronics","DynaLock","Alarm Lock"],"ns":["Maglock 600 lb - Single Door","Maglock 1200 lb - Single Door","Maglock 600 lb - Double Door","Maglock 1200 lb - Double Door","Shear Lock 2000 lb","Mini Maglock 300 lb - Surface","Gate Maglock - 1200 lb Outdoor","Maglock with LED Status"],"u":"EA","q":1},
    {"l1":"Access Control","l2":"Keypad Locks","c":"ACC-KPD","mn":.35,"mx":.50,"pn":150,"px":800,"mf":["Alarm Lock","Kaba","Schlage","dormakaba"],"ns":["Trilogy T2 DL2700 - 26D","Trilogy T2 DL2700 - US10B","Trilogy T3 DL6100 - 26D","Networked Keypad Lock - Wireless","Standalone Keypad Lock - Battery","Heavy Duty Keypad Lever - 626","Keypad Lock with Audit Trail","Pushbutton Lock - Mechanical"],"u":"EA","q":1},
    {"l1":"Automotive","l2":"Transponder Keys","c":"AUT-TRN","mn":.40,"mx":.45,"pn":5,"px":45,"mf":["Ilco","JMA USA","Keyline","Strattec"],"ns":["Transponder Key Toyota - TOY44D-PT","Transponder Key Honda - HD111-PT","Transponder Key Ford - H92-PT","Transponder Key Chevy - B111-PT","Transponder Key Nissan - NI04-PT","Transponder Key Chrysler - Y159-PT","Transponder Key BMW - BM3-PT","Transponder Key Mercedes - HU64-PT","Transponder Key Hyundai - HY18-PT","Transponder Key Kia - KK10-PT","High Security Key VW - HU66-PT","Transponder Key Subaru - SUB44-PT","Transponder Key Lexus - TOY48-PT","Transponder Key Jeep - Y160-PT"],"u":"EA","q":5},
    {"l1":"Automotive","l2":"Programming Tools","c":"AUT-PRG","mn":.40,"mx":.45,"pn":350,"px":2500,"mf":["Autel","Xtool","Advanced Diagnostics","Silca"],"ns":["Key Programmer IM608 Pro","Key Programmer IM508 Pro","Smart Pro Key Programmer","Key Programming Device RW4 Plus","EEPROM Programming Tool","Universal Key Programmer","OBD Key Programmer - Basic","Key Machine with Programmer Combo"],"u":"EA","q":1},
    {"l1":"Automotive","l2":"Lockout Tools","c":"AUT-LOT","mn":.40,"mx":.45,"pn":15,"px":250,"mf":["Lishi","SouthOrd","Pro-Lok","Access Tools"],"ns":["Slim Jim Set - Universal","Long Reach Tool Kit","Air Wedge - Large","Air Wedge - Small","Jiffy Jak Lockout Kit","Quick Entry Tool Set","Under Door Tool","Car Opening Tool Set - 12 Piece"],"u":"EA","q":1},
    {"l1":"Automotive","l2":"Remotes & Fobs","c":"AUT-RMT","mn":.40,"mx":.45,"pn":15,"px":120,"mf":["Ilco","JMA USA","Keyline","Strattec"],"ns":["Remote Head Key Toyota - 4 Button","Remote Head Key Honda - 3 Button","Remote Head Key Ford - 4 Button","Smart Key Prox Nissan - 4 Button","Smart Key Prox Toyota - 4 Button","Keyless Remote Chevy - 4 Button","Flip Key Remote VW - 4 Button","Smart Key Prox Honda - 4 Button","Remote Fob Chrysler - 4 Button","Smart Key Prox Hyundai - 4 Button"],"u":"EA","q":1},
    {"l1":"Safes & Security","l2":"Residential Safes","c":"SAF-RES","mn":.38,"mx":.42,"pn":150,"px":900,"mf":["Liberty Safe","AMSEC","Gardall","Hollon"],"ns":["Home Safe HD-100 - Digital","Home Safe HD-200 - Digital","Fire Safe F-1212 - 30 Min","Fire Safe F-2014 - 60 Min","Wall Safe WS-1014 - Biometric","Floor Safe B-1500 - Dial","Jewelry Safe JS-200 - Digital","Personal Safe PS-100 - Biometric"],"u":"EA","q":1},
    {"l1":"Safes & Security","l2":"Commercial Safes","c":"SAF-COM","mn":.38,"mx":.42,"pn":500,"px":3500,"mf":["AMSEC","Gardall","Hollon","Liberty Safe"],"ns":["Commercial Safe BF3416 - Fire Rated","Commercial Safe BF5024 - TL15","Burglar Safe TL-15 - Class B","Burglar Safe TL-30 - Class C","High Security Safe - GSA Rated","Office Safe OS-200 - Digital","Commercial Wall Safe CWS-2014","Record Safe RS-2418 - 2 Hour"],"u":"EA","q":1},
    {"l1":"Safes & Security","l2":"Gun Safes","c":"SAF-GUN","mn":.38,"mx":.42,"pn":300,"px":3000,"mf":["Liberty Safe","AMSEC","Fort Knox","Browning"],"ns":["Gun Safe Centurion 12","Gun Safe Centurion 24","Gun Safe Colonial 23","Gun Safe Fatboy Jr 48","Gun Safe USA 36","Handgun Vault - Biometric","Under Bed Gun Safe","Quick Access Gun Safe"],"u":"EA","q":1},
    {"l1":"Safes & Security","l2":"Deposit Safes","c":"SAF-DEP","mn":.38,"mx":.42,"pn":300,"px":2500,"mf":["AMSEC","Gardall","Hollon","FireKing"],"ns":["Depository Safe DSR-2014 - Front Load","Depository Safe DSR-2814 - Front Load","Depository Safe DSR-3614 - Rear Load","Drop Safe B-Rated - Dual Key","Rotary Deposit Safe - Digital","Through-Wall Depository - Digital"],"u":"EA","q":1},
    {"l1":"Key Machines & Supplies","l2":"Key Machines","c":"KEY-MCH","mn":.20,"mx":.25,"pn":300,"px":10000,"mf":["Ilco","Silca","Framon","HPC"],"ns":["Key Machine Speed 044 - Manual","Key Machine Speed 046 - Semi-Auto","Key Machine Futura Pro - Laser","Key Machine Ninja Laser","High Security Key Machine","Code Cutting Machine - Electronic","Flat Steel Key Machine","Tubular Key Machine"],"u":"EA","q":1},
    {"l1":"Key Machines & Supplies","l2":"Key Blanks","c":"KEY-BLK","mn":.50,"mx":.55,"pn":5,"px":25,"mf":["Ilco","JMA USA","Keyline","Silca"],"ns":["Key Blank SC1 - Schlage 5-Pin (50pk)","Key Blank KW1 - Kwikset 5-Pin (50pk)","Key Blank Y1 - Yale 5-Pin (50pk)","Key Blank WR5 - Weiser 5-Pin (50pk)","Key Blank SC4 - Schlage 6-Pin (50pk)","Key Blank KW10 - Kwikset 6-Pin (50pk)","Key Blank CO87 - Corbin (50pk)","Key Blank RU45 - Russwin (50pk)","Key Blank BE2 - Best (50pk)","Key Blank S22 - Sargent (50pk)","High Security Blank Primus (10pk)","High Security Blank Medeco (10pk)","Key Blank AR1 - Arrow (50pk)","Key Blank FA2 - Falcon (50pk)","Key Blank YH49 - Yale Hotel (50pk)"],"u":"PK","q":1},
    {"l1":"Key Machines & Supplies","l2":"Pinning Kits","c":"KEY-PIN","mn":.50,"mx":.55,"pn":25,"px":200,"mf":["LAB","A-1 Security","Schlage","Kwikset"],"ns":["Universal Pinning Kit .003 - LAB","Schlage Pinning Kit - Bottom Pins","Kwikset Pinning Kit - Bottom Pins","Corbin Russwin Repin Kit","Master Keying Pin Kit - Universal","IC Core Repin Kit","Top Pin Assortment Kit","Spring Assortment Kit"],"u":"KIT","q":1},
    {"l1":"Key Machines & Supplies","l2":"Lubricants","c":"KEY-LUB","mn":.50,"mx":.55,"pn":5,"px":30,"mf":["Houdini","Tri-Flow","CRC","WD-40 Specialist"],"ns":["Lock Lubricant Spray - 3oz","Graphite Lubricant - 1.5oz","Teflon Lubricant Spray - 4oz","Penetrating Oil - 8oz","Lock De-Icer Spray - 3oz","Silicone Spray - 4oz"],"u":"EA","q":6},
    {"l1":"Key Machines & Supplies","l2":"Tools","c":"KEY-TLS","mn":.50,"mx":.55,"pn":10,"px":400,"mf":["HPC","SouthOrd","Peterson","A-1 Security"],"ns":["Pick Set - 14 Piece Slimline","Pick Set - 22 Piece Professional","Plug Follower Set - 7 Piece","Cylinder Cap Remover Set","Pin Tweezer Kit","Shim Set - Assorted","Mortise Cylinder Tool Kit","IC Core Removal Tool","Key Gauge - Schlage/Kwikset","Door Viewer Installation Kit"],"u":"EA","q":1},
]

print("Generating products...")
products = []
pid = 1
for cat in CATS:
    for i, name in enumerate(cat["ns"]):
        price = round(rb(cat["pn"], cat["px"]), 2)
        margin = rb(cat["mn"], cat["mx"])
        cost = round(price * (1 - margin), 2)
        msrp = round(price * rb(1.3, 1.6), 2)
        status = "ACTIVE" if sr() < 0.95 else "DISCONTINUED"
        products.append({"product_id": pid, "sku": f"{cat['c']}-{i+1:03d}", "name": name,
            "manufacturer": pk(cat["mf"]), "category_l1": cat["l1"], "category_l2": cat["l2"],
            "cost": f"{cost:.2f}", "price": f"{price:.2f}", "msrp": f"{msrp:.2f}",
            "uom": cat["u"], "min_order_qty": cat["q"], "status": status})
        pid += 1
write_csv("products.csv", ["product_id","sku","name","manufacturer","category_l1","category_l2","cost","price","msrp","uom","min_order_qty","status"], products)

# ─── CUSTOMERS ───
print("Generating customers...")
SG = {
    "PA": {"w": .35, "cities": [{"n":"Philadelphia","w":.45,"z":["19101","19102","19103","19104","19106"]},{"n":"Pittsburgh","w":.20,"z":["15201","15206","15213","15219","15222"]},{"n":"Allentown","w":.10,"z":["18101","18102","18103"]},{"n":"Reading","w":.08,"z":["19601","19602","19604"]},{"n":"Lancaster","w":.07,"z":["17601","17602","17603"]},{"n":"King of Prussia","w":.05,"z":["19406"]},{"n":"Harrisburg","w":.05,"z":["17101","17102","17103"]}]},
    "NJ": {"w": .28, "cities": [{"n":"Newark","w":.20,"z":["07101","07102","07103"]},{"n":"Jersey City","w":.18,"z":["07302","07304","07306"]},{"n":"Trenton","w":.12,"z":["08608","08609","08610"]},{"n":"Camden","w":.10,"z":["08101","08102","08103"]},{"n":"Cherry Hill","w":.15,"z":["08002","08003","08034"]},{"n":"Edison","w":.12,"z":["08817","08818","08820"]},{"n":"Paterson","w":.13,"z":["07501","07502","07503"]}]},
    "MD": {"w": .17, "cities": [{"n":"Baltimore","w":.50,"z":["21201","21202","21205","21206","21207"]},{"n":"Silver Spring","w":.15,"z":["20901","20902","20903"]},{"n":"Rockville","w":.12,"z":["20850","20851","20852"]},{"n":"Columbia","w":.13,"z":["21044","21045","21046"]},{"n":"Bethesda","w":.10,"z":["20814","20816","20817"]}]},
    "VA": {"w": .12, "cities": [{"n":"Arlington","w":.20,"z":["22201","22202","22203"]},{"n":"Alexandria","w":.20,"z":["22301","22302","22304"]},{"n":"Richmond","w":.25,"z":["23219","23220","23221"]},{"n":"Norfolk","w":.15,"z":["23501","23502","23503"]},{"n":"Virginia Beach","w":.20,"z":["23451","23452","23453"]}]},
    "DE": {"w": .05, "cities": [{"n":"Wilmington","w":.65,"z":["19801","19802","19803"]},{"n":"Dover","w":.20,"z":["19901","19904"]},{"n":"Newark","w":.15,"z":["19711","19713"]}]},
    "DC": {"w": .03, "cities": [{"n":"Washington","w":1.0,"z":["20001","20002","20003","20004","20005","20006"]}]},
}
CT_CFG = {
    "LSH": {"cnt":68,"np":["{c} Locksmith","{c} Lock & Key","{l} Lock Service","{l} Locksmith","All-Pro Locksmith {c}","{c} Safe & Lock","Quick Key Locksmith","{l} Security & Lock","AAA Locksmith {c}","Master Key Locksmith","{c} Lock Shop","Elite Locksmith Services","Premier Lock & Safe","{l} Lock & Safe","Affordable Locksmith {c}","Express Lock Service","Metro Locksmith {c}","A-1 Locksmith {c}"],"crMin":5000,"crMax":50000,"pt":["NET30","NET30","NET30","NET15","COD"]},
    "INT": {"cnt":45,"np":["{c} Security Systems","{l} Integration Group","{c} Access Solutions","{l} Security Technologies","Integrated Security {c}","SecureTech Solutions","{l} & Associates Security","ProGuard Systems {c}","Total Security Integration","Sentinel Security Systems","{c} Security Integrators","Advanced Access Systems","Shield Security Group","{l} Security Corp","Guardian Integration Services"],"crMin":25000,"crMax":200000,"pt":["NET30","NET30","NET45","NET45","NET15"]},
    "PMG": {"cnt":22,"np":["{c} Property Management","{l} Property Group","Metro Properties {c}","{l} Real Estate Management","{c} Residential Management","Premier Property Services","Keystone Property Management","{l} Management Corp","Summit Property Group","Horizon Property Services","{c} Commercial Properties"],"crMin":10000,"crMax":75000,"pt":["NET30","NET30","NET45","NET15"]},
    "RET": {"cnt":15,"np":["{c} Hardware","{l} Hardware & Supply","True Value {c}","{c} Home Center","Ace Hardware {c}","{l} Building Supply","Do It Best {c}","{c} Home & Garden","Pro Hardware {c}","{l} Supply Company"],"crMin":10000,"crMax":100000,"pt":["NET30","NET30","NET15","NET45"]},
}
LN = ["Anderson","Baker","Campbell","Davis","Edwards","Franklin","Garcia","Harris","Johnson","Kelly","Lewis","Mitchell","Nelson","Owens","Parker","Quinn","Roberts","Smith","Taylor","Underwood","Vargas","Williams","Young","Zhang","Brennan","Collins","Donovan","Evans","Fleming","Grant","Hayes","Irwin","Jenkins","Kemp","Lopez","Morgan","Nash","Patel","Reed","Sullivan","Thompson","Walsh","York","Martinez","Rivera","Chen","Kim","Nguyen","Brown","Wilson","Moore","Jackson","Martin","Lee","Clark","Robinson","Hall","Allen","Scott","King","Wright","Green","Adams","Hill","Turner","Phillips","Stewart","Sanchez","Morris","Rogers","Cooper","Peterson","Bailey","Howard","Ward","Cox","Diaz","Richardson"]
FN = ["James","Michael","Robert","David","John","William","Richard","Thomas","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Jennifer","Linda","Patricia","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen","Nancy","Lisa","Betty","Margaret","Sandra","Ashley","Angela","Maria","Melissa","Stephanie","Nicole","Amanda","Catherine"]
STREETS = ["Main St","Market St","Oak Ave","Elm St","Broad St","Pine St","Cedar Ln","Walnut St","Chestnut St","Spring Garden St","Lancaster Ave","Baltimore Pike","Ridge Rd","Commerce Dr","Industrial Blvd","Washington Ave","Lincoln Hwy","Liberty St","Union Ave","Park Ave","Mill Rd","Bridge St","Front St","Water St","Vine St"]

st_keys = list(SG.keys())
st_weights = [SG[s]["w"] for s in st_keys]

customers = []
cid = 1
used_names = set()
for ctype, cfg in CT_CFG.items():
    for i in range(cfg["cnt"]):
        state = wp(st_keys, st_weights)
        geo = SG[state]
        city_names = [c["n"] for c in geo["cities"]]
        city_weights = [c["w"] for c in geo["cities"]]
        city_idx = city_names.index(wp(city_names, city_weights))
        city = geo["cities"][city_idx]["n"]
        zipcode = pk(geo["cities"][city_idx]["z"])

        cn = ""
        att = 0
        while True:
            pat = pk(cfg["np"])
            ln = pk(LN)
            cn = pat.replace("{c}", city).replace("{l}", ln)
            att += 1
            if cn not in used_names or att > 40:
                if att > 40: cn = f"{cn} {cid}"
                break
        used_names.add(cn)

        fn, lname = pk(FN), pk(LN)
        email_dom = ''.join(c for c in cn.lower() if c.isalnum())[:20]
        email = f"{fn.lower()}.{lname.lower()}@{email_dom}.com"
        phone = f"({ri(200,999)}) {ri(200,999)}-{ri(0,9999):04d}"
        addr = f"{ri(100,9999)} {pk(STREETS)}"
        pt = pk(cfg["pt"])
        cl = round(rb(cfg["crMin"], cfg["crMax"]) / 1000) * 1000
        cy, cm, cd = ri(2015,2022), ri(1,12), ri(1,28)
        cdate = f"{cy}-{cm:02d}-{cd:02d}"
        status = "ACTIVE" if sr() < 0.95 else "INACTIVE"

        customers.append({"customer_id": cid, "account_number": f"KSD-{cid:05d}",
            "company_name": cn, "customer_type": ctype, "contact_name": f"{fn} {lname}",
            "email": email, "phone": phone, "address": addr, "city": city, "state": state,
            "zip": zipcode, "payment_terms": pt, "credit_limit": cl, "status": status,
            "created_date": cdate})
        cid += 1

write_csv("customers.csv", ["customer_id","account_number","company_name","customer_type","contact_name","email","phone","address","city","state","zip","payment_terms","credit_limit","status","created_date"], customers)

# ─── ORDERS & ORDER LINES ───
print("Generating orders and order lines...")
import datetime

MS = {1:.78,2:.72,3:.92,4:1.08,5:1.15,6:1.22,7:1.18,8:1.16,9:1.10,10:1.05,11:.98,12:.88}
DW = {1:1.35,2:1.25,3:1.10,4:1.00,5:.85,6:.30,0:.15}
WM = [1.08, 1.12, 1.05, 0.88]
AFF = {
    "LSH":{"Residential Locks":.30,"Commercial Hardware":.20,"Access Control":.10,"Automotive":.20,"Safes & Security":.05,"Key Machines & Supplies":.15},
    "INT":{"Residential Locks":.05,"Commercial Hardware":.30,"Access Control":.50,"Automotive":.02,"Safes & Security":.05,"Key Machines & Supplies":.08},
    "PMG":{"Residential Locks":.45,"Commercial Hardware":.30,"Access Control":.15,"Automotive":0,"Safes & Security":.05,"Key Machines & Supplies":.05},
    "RET":{"Residential Locks":.50,"Commercial Hardware":.15,"Access Control":.05,"Automotive":.05,"Safes & Security":.10,"Key Machines & Supplies":.15},
}
TAX_R = {"PA":.06,"NJ":.06625,"MD":.06,"VA":.053,"DE":0,"DC":.06}

act_cust = [c for c in customers if c["status"] == "ACTIVE"]
cust_by_type = {"LSH":[],"INT":[],"PMG":[],"RET":[]}
for c in act_cust: cust_by_type[c["customer_type"]].append(c)

prod_by_l1 = {}
for p in products:
    if p["status"] == "DISCONTINUED": continue
    l1 = p["category_l1"]
    if l1 not in prod_by_l1: prod_by_l1[l1] = []
    prod_by_l1[l1].append(p)

sm = sum(MS.values())
y1_base = 3800 / sm
y2_base = 4104 / sm

orders = []
order_lines = []
oid = 1
lid = 1
o_seq = {}

for yr in [2023, 2024]:
    m_base = y1_base if yr == 2023 else y2_base
    for mo in range(1, 13):
        tgt = round(m_base * MS[mo])
        mk = f"{yr}{mo:02d}"
        if mk not in o_seq: o_seq[mk] = 0
        d_in_m = days_in_month(yr, mo)

        for i in range(tgt):
            day = ri(1, d_in_m)
            for att3 in range(20):
                day = ri(1, d_in_m)
                try:
                    td = datetime.date(yr, mo, day)
                except: continue
                dw = td.weekday()  # 0=Mon
                dow_key = (dw + 1) % 7  # Convert to 0=Sun format
                wk = 0 if day <= 7 else (1 if day <= 14 else (2 if day <= 21 else 3))
                if sr() < (DW.get(dow_key, 1.0) * WM[wk]) / (1.35 * 1.12):
                    break

            try:
                od = datetime.date(yr, mo, day)
            except:
                od = datetime.date(yr, mo, min(day, d_in_m))

            # Skip weekends
            while od.weekday() >= 5:
                od += datetime.timedelta(days=1)
            if od.month != mo:
                od -= datetime.timedelta(days=1)
                while od.weekday() >= 5:
                    od -= datetime.timedelta(days=1)

            # Pick customer
            t_types = ["LSH","INT","PMG","RET"]
            t_w = [.45,.30,.15,.10]
            ct = wp(t_types, t_w)
            if not cust_by_type[ct]: continue
            cust = pk(cust_by_type[ct])

            # Ship date
            ship_days = ri(0, 3)
            if ship_days == 0:
                sd = od
            else:
                sd = add_bdays(od.year, od.month, od.day, ship_days)

            # Number of lines
            nl = 1 + int(abs(rb(0,1) + rb(0,1) + rb(0,1)) * 3)
            nl = max(1, min(25, nl))
            if sr() < .3: nl = min(25, nl + ri(1, 3))
            if sr() < .15: nl = min(25, nl + ri(2, 5))

            aff = AFF[ct]
            a_keys = list(aff.keys())
            a_weights = list(aff.values())

            subtotal = 0.0
            total_cost = 0.0
            this_lines = []

            for ln in range(nl):
                cat = wp(a_keys, a_weights)
                if cat not in prod_by_l1 or not prod_by_l1[cat]:
                    cat = pk(list(prod_by_l1.keys()))
                prod = pk(prod_by_l1[cat])
                pp = float(prod["price"])
                pc = float(prod["cost"])

                if prod["category_l2"] == "Key Blanks": qty = ri(2, 20)
                elif prod["category_l2"] == "Lubricants": qty = ri(6, 24)
                elif prod["category_l2"] == "Transponder Keys": qty = ri(5, 50)
                elif prod["category_l2"] == "Credentials": qty = ri(1, 10)
                elif pp > 500: qty = ri(1, 3)
                elif pp > 100: qty = ri(1, 10)
                else: qty = ri(1, 20)

                up = round(pp * rb(0.95, 1.0), 2)
                lt = round(qty * up, 2)
                lc = round(qty * pc, 2)
                subtotal += lt
                total_cost += lc

                this_lines.append({"line_id": lid, "order_id": oid, "line_number": ln+1,
                    "product_id": prod["product_id"], "quantity": qty,
                    "unit_price": f"{up:.2f}", "unit_cost": f"{pc:.2f}",
                    "line_total": f"{lt:.2f}", "line_cost": f"{lc:.2f}"})
                lid += 1

            subtotal = round(subtotal, 2)
            total_cost = round(total_cost, 2)
            tax_rate = TAX_R.get(cust["state"], 0.06)
            tax = round(subtotal * tax_rate, 2)

            if subtotal < 500: freight = round(rb(12, 35), 2)
            elif subtotal < 2000: freight = round(rb(25, 65), 2)
            elif subtotal < 5000: freight = round(rb(45, 120), 2)
            else: freight = round(rb(75, 200), 2)

            total = round(subtotal + tax + freight, 2)
            margin = round((subtotal - total_cost) / subtotal, 4) if subtotal > 0 else 0

            o_age = (datetime.date(2025, 1, 1) - od).days
            rv = sr()
            if rv < 0.02: status = "CANCELLED"
            elif o_age < 14: status = "PENDING" if sr() < 0.5 else "SHIPPED"
            elif o_age < 30: status = "SHIPPED" if sr() < 0.3 else "DELIVERED"
            else: status = "DELIVERED"

            if status == "CANCELLED": pay_st = "UNPAID"
            elif o_age > 60:
                rv2 = sr()
                if rv2 < 0.90: pay_st = "PAID"
                elif rv2 < 0.97: pay_st = "OVERDUE"
                else: pay_st = "PARTIAL"
            elif o_age > 30:
                rv2 = sr()
                if rv2 < 0.70: pay_st = "PAID"
                elif rv2 < 0.85: pay_st = "UNPAID"
                elif rv2 < 0.95: pay_st = "PARTIAL"
                else: pay_st = "OVERDUE"
            else:
                rv2 = sr()
                if rv2 < 0.30: pay_st = "PAID"
                elif rv2 < 0.80: pay_st = "UNPAID"
                else: pay_st = "PARTIAL"

            po = f"PO-{cust['account_number'].replace('KSD-','')}-{ri(1000,9999)}"
            o_seq[mk] += 1
            on = f"ORD-{mk}-{o_seq[mk]:05d}"

            orders.append({"order_id": oid, "order_number": on,
                "customer_id": cust["customer_id"], "order_date": str(od),
                "ship_date": str(sd), "subtotal": f"{subtotal:.2f}", "tax": f"{tax:.2f}",
                "freight": f"{freight:.2f}", "total": f"{total:.2f}",
                "total_cost": f"{total_cost:.2f}", "margin": margin,
                "status": status, "payment_status": pay_st, "po_number": po})
            order_lines.extend(this_lines)
            oid += 1

        if mo % 3 == 0:
            print(f"  {yr}-{mo:02d}: {len(orders)} orders so far...")

write_csv("orders.csv", ["order_id","order_number","customer_id","order_date","ship_date","subtotal","tax","freight","total","total_cost","margin","status","payment_status","po_number"], orders)
write_csv("order_lines.csv", ["line_id","order_id","line_number","product_id","quantity","unit_price","unit_cost","line_total","line_cost"], order_lines)

# ─── SUMMARY ───
print("Generating summary...")
prod_map = {p["product_id"]: p for p in products}
rev_by_month = {}
for o in orders:
    ym = o["order_date"][:7]
    if ym not in rev_by_month: rev_by_month[ym] = {"month": ym, "revenue": 0, "orders": 0, "cost": 0}
    rev_by_month[ym]["revenue"] += float(o["total"])
    rev_by_month[ym]["cost"] += float(o["total_cost"])
    rev_by_month[ym]["orders"] += 1

m_rev = sorted(rev_by_month.values(), key=lambda x: x["month"])
for m in m_rev:
    m["revenue"] = round(m["revenue"], 2)
    m["cost"] = round(m["cost"], 2)
    m["margin"] = round((m["revenue"] - m["cost"]) / m["revenue"], 4) if m["revenue"] > 0 else 0

rev_by_cat = {}
for ol in order_lines:
    p = prod_map.get(ol["product_id"])
    if not p: continue
    cat = p["category_l1"]
    if cat not in rev_by_cat: rev_by_cat[cat] = {"category": cat, "revenue": 0, "cost": 0, "units": 0}
    rev_by_cat[cat]["revenue"] += float(ol["line_total"])
    rev_by_cat[cat]["cost"] += float(ol["line_cost"])
    rev_by_cat[cat]["units"] += ol["quantity"]

c_rev = sorted(rev_by_cat.values(), key=lambda x: -x["revenue"])
for c in c_rev:
    c["revenue"] = round(c["revenue"], 2)
    c["cost"] = round(c["cost"], 2)
    c["margin"] = round((c["revenue"] - c["cost"]) / c["revenue"], 4) if c["revenue"] > 0 else 0

cust_by_type_count = {}
for c in customers: cust_by_type_count[c["customer_type"]] = cust_by_type_count.get(c["customer_type"], 0) + 1

prod_rev = {}
for ol in order_lines:
    pid2 = ol["product_id"]
    if pid2 not in prod_rev: prod_rev[pid2] = {"pid": pid2, "rev": 0, "units": 0, "ords": 0}
    prod_rev[pid2]["rev"] += float(ol["line_total"])
    prod_rev[pid2]["units"] += ol["quantity"]
    prod_rev[pid2]["ords"] += 1

t10p = sorted(prod_rev.values(), key=lambda x: -x["rev"])[:10]
t10p_out = []
for pr in t10p:
    p = prod_map.get(pr["pid"], {})
    t10p_out.append({"product_id": pr["pid"], "sku": p.get("sku","N/A"), "name": p.get("name","N/A"),
        "category": p.get("category_l1","N/A"), "revenue": round(pr["rev"],2), "units_sold": pr["units"], "order_count": pr["ords"]})

total_rev = sum(float(o["total"]) for o in orders)
total_cost2 = sum(float(o["total_cost"]) for o in orders)
y1_rev = sum(float(o["total"]) for o in orders if o["order_date"].startswith("2023"))
y2_rev = sum(float(o["total"]) for o in orders if o["order_date"].startswith("2024"))

cust_rev_map = {}
for o in orders:
    cid2 = o["customer_id"]
    if cid2 not in cust_rev_map: cust_rev_map[cid2] = {"cid": cid2, "rev": 0, "ords": 0}
    cust_rev_map[cid2]["rev"] += float(o["total"])
    cust_rev_map[cid2]["ords"] += 1

cust_map = {c["customer_id"]: c for c in customers}
t10c = sorted(cust_rev_map.values(), key=lambda x: -x["rev"])[:10]
t10c_out = [{"customer_id": cr["cid"], "company_name": cust_map.get(cr["cid"],{}).get("company_name","N/A"),
    "customer_type": cust_map.get(cr["cid"],{}).get("customer_type","N/A"),
    "revenue": round(cr["rev"],2), "order_count": cr["ords"]} for cr in t10c]

st_dist = {}
for c in customers: st_dist[c["state"]] = st_dist.get(c["state"], 0) + 1

summary = {
    "generated_at": datetime.datetime.now().isoformat(),
    "company": "Keystone Security Distribution",
    "data_period": {"start": "2023-01-01", "end": "2024-12-31"},
    "record_counts": {"products": len(products), "customers": len(customers), "orders": len(orders), "order_lines": len(order_lines)},
    "overall_metrics": {
        "total_revenue": round(total_rev, 2), "total_cost": round(total_cost2, 2),
        "overall_margin": round((total_rev - total_cost2) / total_rev, 4) if total_rev > 0 else 0,
        "year1_revenue": round(y1_rev, 2), "year2_revenue": round(y2_rev, 2),
        "yoy_growth": round((y2_rev / y1_rev - 1) * 100, 1) if y1_rev > 0 else 0,
        "avg_order_value": round(total_rev / len(orders), 2) if orders else 0,
        "avg_lines_per_order": round(len(order_lines) / len(orders), 2) if orders else 0,
    },
    "revenue_by_month": m_rev,
    "revenue_by_category": c_rev,
    "margin_by_category": [{"category": c["category"], "avg_margin": c["margin"], "revenue": c["revenue"], "cost": c["cost"]} for c in c_rev],
    "customers_by_type": cust_by_type_count,
    "customers_by_state": st_dist,
    "top_10_products": t10p_out,
    "top_10_customers": t10c_out,
}
with open(os.path.join(DATA_DIR, "summary.json"), "w") as f:
    json.dump(summary, f, indent=2)
print("  summary.json written")

print(f"\nDONE!")
print(f"  Products: {len(products)}")
print(f"  Customers: {len(customers)}")
print(f"  Orders: {len(orders)}")
print(f"  Order Lines: {len(order_lines)}")
print(f"  Avg lines/order: {len(order_lines)/len(orders):.2f}")
print(f"  Y1 Revenue: ${y1_rev/1e6:.2f}M")
print(f"  Y2 Revenue: ${y2_rev/1e6:.2f}M")
print(f"  YoY Growth: {(y2_rev/y1_rev-1)*100:.1f}%")
