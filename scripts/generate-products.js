// ===========================================================================
// Product Data Generator for Keystone Security Distribution
// Generates 200+ products across 6 L1 categories with realistic pricing
// ===========================================================================
const fs = require('fs');
const path = require('path');

// Seeded random for reproducibility
let seed = 42;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randBetween(min, max) {
  return min + seededRandom() * (max - min);
}
function randInt(min, max) {
  return Math.floor(randBetween(min, max + 1));
}
function pick(arr) {
  return arr[Math.floor(seededRandom() * arr.length)];
}

// Category definitions with subcategories, margin targets, price ranges
const CATEGORIES = [
  // ============ RESIDENTIAL LOCKS (RES) ============
  {
    l1: 'Residential Locks', l1_code: 'RES', l2: 'Deadbolts', l2_code: 'RES-DBL',
    marginMin: 0.28, marginMax: 0.32, priceMin: 25, priceMax: 120,
    manufacturers: ['Schlage', 'Kwikset', 'Yale', 'Weiser', 'Falcon'],
    products: [
      'Single Cylinder Deadbolt - Satin Nickel', 'Single Cylinder Deadbolt - Aged Bronze',
      'Single Cylinder Deadbolt - Matte Black', 'Single Cylinder Deadbolt - Polished Brass',
      'Double Cylinder Deadbolt - Satin Nickel', 'Double Cylinder Deadbolt - Aged Bronze',
      'Double Cylinder Deadbolt - Polished Chrome', 'Single Cylinder Deadbolt - Bright Chrome',
      'Jimmy-Proof Deadlock - Silver', 'High Security Deadbolt - Satin Chrome',
      'Grade 1 Deadbolt - Brass', 'Grade 2 Deadbolt - Satin Nickel',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Residential Locks', l1_code: 'RES', l2: 'Entry Knobs', l2_code: 'RES-KNB',
    marginMin: 0.28, marginMax: 0.32, priceMin: 15, priceMax: 85,
    manufacturers: ['Schlage', 'Kwikset', 'Yale', 'Weiser'],
    products: [
      'Entry Knob Georgian - Satin Nickel', 'Entry Knob Georgian - Aged Bronze',
      'Entry Knob Plymouth - Bright Brass', 'Entry Knob Plymouth - Satin Chrome',
      'Entry Knob Tylo - Satin Nickel', 'Entry Knob Tylo - Polished Brass',
      'Privacy Knob - Satin Nickel', 'Privacy Knob - Aged Bronze',
      'Passage Knob - Satin Nickel', 'Passage Knob - Polished Brass',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Residential Locks', l1_code: 'RES', l2: 'Handlesets', l2_code: 'RES-HND',
    marginMin: 0.28, marginMax: 0.32, priceMin: 75, priceMax: 350,
    manufacturers: ['Schlage', 'Kwikset', 'Yale', 'Weiser'],
    products: [
      'Handleset Camelot - Satin Nickel', 'Handleset Camelot - Aged Bronze',
      'Handleset Addison - Bright Chrome', 'Handleset Addison - Matte Black',
      'Handleset Century - Satin Nickel', 'Handleset Plymouth - Polished Brass',
      'Handleset Georgian - Satin Nickel', 'Handleset Brookshire - Aged Bronze',
      'Handleset Arlington - Matte Black', 'Front Entry Handleset - Satin Chrome',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Residential Locks', l1_code: 'RES', l2: 'Smart Locks', l2_code: 'RES-SMT',
    marginMin: 0.28, marginMax: 0.32, priceMin: 120, priceMax: 350,
    manufacturers: ['Schlage', 'Kwikset', 'Yale', 'Alarm Lock'],
    products: [
      'Smart Deadbolt Encode Plus - Satin Nickel', 'Smart Deadbolt Encode Plus - Matte Black',
      'Smart Lock Connect - Aged Bronze', 'Smart Lock Connect - Satin Chrome',
      'Wi-Fi Smart Lock - Satin Nickel', 'Wi-Fi Smart Lock - Polished Brass',
      'Bluetooth Smart Lock - Matte Black', 'Smart Lever with Touchscreen - Satin Nickel',
      'Smart Deadbolt with Camera - Matte Black', 'Z-Wave Smart Lock - Satin Nickel',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Residential Locks', l1_code: 'RES', l2: 'Keypad Locks', l2_code: 'RES-KPD',
    marginMin: 0.28, marginMax: 0.32, priceMin: 80, priceMax: 250,
    manufacturers: ['Schlage', 'Kwikset', 'Yale', 'Alarm Lock'],
    products: [
      'Keypad Deadbolt BE365 - Satin Chrome', 'Keypad Deadbolt BE365 - Aged Bronze',
      'Keypad Lever FE595 - Satin Nickel', 'Keypad Lever FE595 - Matte Black',
      'Touch Keypad Deadbolt - Satin Nickel', 'Touch Keypad Deadbolt - Polished Brass',
      'Electronic Keypad Lock - Bright Chrome', 'Keypad Entry Knob - Satin Nickel',
    ],
    uom: 'EA', minOrderQty: 1
  },
  // ============ COMMERCIAL HARDWARE (COM) ============
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Cylindrical Locks', l2_code: 'COM-CYL',
    marginMin: 0.35, marginMax: 0.40, priceMin: 45, priceMax: 350,
    manufacturers: ['Schlage', 'Corbin Russwin', 'Yale', 'Sargent', 'Falcon', 'Best'],
    products: [
      'Cylindrical Lock ND60PD - 626', 'Cylindrical Lock ND80PD - 626',
      'Cylindrical Lock ND50PD - 613', 'Cylindrical Lock ND70PD - 626',
      'Cylindrical Lock ND25D - 626', 'Heavy Duty Cylindrical Lock - 630',
      'Grade 1 Cylindrical Lockset - Classroom', 'Grade 1 Cylindrical Lockset - Storeroom',
      'Grade 1 Cylindrical Lockset - Office', 'Grade 2 Cylindrical Lock - Entry',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Mortise Locks', l2_code: 'COM-MOR',
    marginMin: 0.35, marginMax: 0.40, priceMin: 150, priceMax: 800,
    manufacturers: ['Schlage', 'Corbin Russwin', 'Yale', 'Sargent', 'Marks USA'],
    products: [
      'Mortise Lock L9050 - Classroom', 'Mortise Lock L9060 - Apartment',
      'Mortise Lock L9080 - Storeroom', 'Mortise Lock L9070 - Classroom',
      'Mortise Lock L9040 - Privacy', 'Mortise Lock L9092 - Electrified',
      'Mortise Lockset - Office Function', 'Mortise Lockset - Entry Function',
      'Heavy Duty Mortise Lock - Institutional', 'Grade 1 Mortise Body - 626',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Exit Devices', l2_code: 'COM-EXT',
    marginMin: 0.35, marginMax: 0.40, priceMin: 200, priceMax: 1500,
    manufacturers: ['Von Duprin', 'Sargent', 'Corbin Russwin', 'Falcon'],
    products: [
      'Exit Device 98EO - Rim 36"', 'Exit Device 98EO - Rim 48"',
      'Exit Device 99EO - SVR 36"', 'Exit Device 99EO - SVR 48"',
      'Concealed Vertical Rod Device - 36"', 'Surface Vertical Rod Device - 48"',
      'Rim Exit Device Grade 1 - 36"', 'Rim Exit Device Grade 1 - 48"',
      'Fire Rated Exit Device - 36"', 'Motorized Latch Retraction Device',
      'Delayed Egress Exit Device', 'Exit Alarm Device - 36"',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Door Closers', l2_code: 'COM-CLS',
    marginMin: 0.35, marginMax: 0.40, priceMin: 35, priceMax: 450,
    manufacturers: ['LCN', 'Norton', 'Yale', 'Sargent', 'Falcon'],
    products: [
      'Door Closer 4040XP - Aluminum', 'Door Closer 4040XP - Dark Bronze',
      'Door Closer 4011 - Regular Arm', 'Door Closer 4041 - Hold Open Arm',
      'Door Closer 1600 Series - Aluminum', 'Door Closer 1600 Series - Bronze',
      'Concealed Door Closer - Aluminum', 'Surface Door Closer - Hold Open',
      'ADA Compliant Door Closer', 'Heavy Duty Door Closer - Institutional',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Hinges', l2_code: 'COM-HNG',
    marginMin: 0.35, marginMax: 0.40, priceMin: 25, priceMax: 120,
    manufacturers: ['Hager', 'McKinney', 'Ives', 'Stanley'],
    products: [
      'Full Mortise Hinge 4.5" x 4.5" - 26D', 'Full Mortise Hinge 4.5" x 4.5" - US10B',
      'Full Mortise Hinge 4" x 4" - 26D', 'Full Mortise Hinge 5" x 4.5" - 26D',
      'Spring Hinge 4.5" x 4.5" - 26D', 'Continuous Hinge 83" - Clear',
      'Pivot Hinge Set - Aluminum', 'Ball Bearing Hinge 4.5" - 630',
      'Heavy Weight Hinge 5" x 5" - 26D', 'Electric Hinge 4-Wire - 26D',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Thresholds', l2_code: 'COM-THR',
    marginMin: 0.35, marginMax: 0.40, priceMin: 25, priceMax: 180,
    manufacturers: ['Pemko', 'National Guard', 'Reese', 'Zero International'],
    products: [
      'Saddle Threshold 36" - Aluminum', 'Saddle Threshold 48" - Aluminum',
      'ADA Ramp Threshold 36" - Bronze', 'ADA Ramp Threshold 48" - Aluminum',
      'Thermal Break Threshold 36"', 'Adjustable Threshold 36"',
      'Bumper Seal Threshold 36"', 'Heavy Duty Mill Threshold 48"',
    ],
    uom: 'EA', minOrderQty: 1
  },
  // ============ ACCESS CONTROL (ACC) ============
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Card Readers', l2_code: 'ACC-RDR',
    marginMin: 0.35, marginMax: 0.50, priceMin: 80, priceMax: 450,
    manufacturers: ['HID Global', 'Allegion', 'dormakaba', 'NAPCO'],
    products: [
      'Proximity Reader iCLASS SE - Black', 'Proximity Reader iCLASS SE - Gray',
      'Multi-Class Reader SE - Black', 'Proximity Reader R10 - Black',
      'Proximity Reader R40 - Long Range', 'Mobile-Ready Reader - Bluetooth',
      'Biometric Reader with Card - Black', 'Mullion Mount Reader - Black',
      'Weatherproof Card Reader - Gray', 'Smart Card Reader - Contactless',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Controllers', l2_code: 'ACC-CTL',
    marginMin: 0.35, marginMax: 0.50, priceMin: 200, priceMax: 1500,
    manufacturers: ['HID Global', 'Allegion', 'NAPCO', 'dormakaba'],
    products: [
      'Access Controller 2-Door - IP', 'Access Controller 4-Door - IP',
      'Access Controller 8-Door - IP', 'Single Door Controller - PoE',
      'Elevator Controller - 16 Floor', 'Network Access Panel - 2 Reader',
      'Access Control Board - 4 Reader', 'Wireless Lock Controller',
      'Edge Controller - Single Door', 'Cloud-Based Controller Module',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Credentials', l2_code: 'ACC-CRD',
    marginMin: 0.35, marginMax: 0.50, priceMin: 50, priceMax: 300,
    manufacturers: ['HID Global', 'Allegion', 'dormakaba'],
    products: [
      'Proximity Cards iCLASS - 100 Pack', 'Proximity Cards HID 1326 - 100 Pack',
      'Smart Cards SEOS - 50 Pack', 'Key Fobs iCLASS - 50 Pack',
      'Key Fobs Prox - 100 Pack', 'Wristband Credentials - 25 Pack',
      'Mobile Credential License - 100 Pack', 'Clamshell Cards 125kHz - 100 Pack',
    ],
    uom: 'PK', minOrderQty: 1
  },
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Electric Strikes', l2_code: 'ACC-STR',
    marginMin: 0.35, marginMax: 0.50, priceMin: 50, priceMax: 350,
    manufacturers: ['HES', 'Von Duprin', 'Securitron', 'Folger Adam'],
    products: [
      'Electric Strike 1006 - 12/24VDC', 'Electric Strike 1006 - Fail Secure',
      'Electric Strike 1006 - Fail Safe', 'Electric Strike 9600 - 12/24VDC',
      'Heavy Duty Electric Strike - Mortise', 'Fire Rated Electric Strike',
      'Electric Strike for Rim Device', 'Compact Electric Strike - 12VDC',
      'Surface Mount Electric Strike', 'Electric Release - Cylindrical Lock',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Maglocks', l2_code: 'ACC-MAG',
    marginMin: 0.35, marginMax: 0.50, priceMin: 75, priceMax: 400,
    manufacturers: ['Securitron', 'Dortronics', 'DynaLock', 'Alarm Lock'],
    products: [
      'Maglock 600 lb - Single Door', 'Maglock 1200 lb - Single Door',
      'Maglock 600 lb - Double Door', 'Maglock 1200 lb - Double Door',
      'Shear Lock 2000 lb', 'Mini Maglock 300 lb - Surface',
      'Gate Maglock - 1200 lb Outdoor', 'Maglock with LED Status',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Access Control', l1_code: 'ACC', l2: 'Keypad Locks', l2_code: 'ACC-KPD',
    marginMin: 0.35, marginMax: 0.50, priceMin: 150, priceMax: 800,
    manufacturers: ['Alarm Lock', 'Kaba', 'Schlage', 'dormakaba'],
    products: [
      'Trilogy T2 DL2700 - 26D', 'Trilogy T2 DL2700 - US10B',
      'Trilogy T3 DL6100 - 26D', 'Networked Keypad Lock - Wireless',
      'Standalone Keypad Lock - Battery', 'Heavy Duty Keypad Lever - 626',
      'Keypad Lock with Audit Trail', 'Pushbutton Lock - Mechanical',
    ],
    uom: 'EA', minOrderQty: 1
  },
  // ============ AUTOMOTIVE (AUT) ============
  {
    l1: 'Automotive', l1_code: 'AUT', l2: 'Transponder Keys', l2_code: 'AUT-TRN',
    marginMin: 0.40, marginMax: 0.45, priceMin: 5, priceMax: 45,
    manufacturers: ['Ilco', 'JMA USA', 'Keyline', 'Strattec'],
    products: [
      'Transponder Key Toyota - TOY44D-PT', 'Transponder Key Honda - HD111-PT',
      'Transponder Key Ford - H92-PT', 'Transponder Key Chevy - B111-PT',
      'Transponder Key Nissan - NI04-PT', 'Transponder Key Chrysler - Y159-PT',
      'Transponder Key BMW - BM3-PT', 'Transponder Key Mercedes - HU64-PT',
      'Transponder Key Hyundai - HY18-PT', 'Transponder Key Kia - KK10-PT',
      'High Security Key VW - HU66-PT', 'Transponder Key Subaru - SUB44-PT',
      'Transponder Key Lexus - TOY48-PT', 'Transponder Key Jeep - Y160-PT',
    ],
    uom: 'EA', minOrderQty: 5
  },
  {
    l1: 'Automotive', l1_code: 'AUT', l2: 'Programming Tools', l2_code: 'AUT-PRG',
    marginMin: 0.40, marginMax: 0.45, priceMin: 350, priceMax: 2500,
    manufacturers: ['Autel', 'Xtool', 'Advanced Diagnostics', 'Silca'],
    products: [
      'Key Programmer IM608 Pro', 'Key Programmer IM508 Pro',
      'Smart Pro Key Programmer', 'Key Programming Device RW4 Plus',
      'EEPROM Programming Tool', 'Universal Key Programmer',
      'OBD Key Programmer - Basic', 'Key Machine with Programmer Combo',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Automotive', l1_code: 'AUT', l2: 'Lockout Tools', l2_code: 'AUT-LOT',
    marginMin: 0.40, marginMax: 0.45, priceMin: 15, priceMax: 250,
    manufacturers: ['Lishi', 'SouthOrd', 'Pro-Lok', 'Access Tools'],
    products: [
      'Slim Jim Set - Universal', 'Long Reach Tool Kit', 'Air Wedge - Large',
      'Air Wedge - Small', 'Jiffy Jak Lockout Kit', 'Quick Entry Tool Set',
      'Under Door Tool', 'Car Opening Tool Set - 12 Piece',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Automotive', l1_code: 'AUT', l2: 'Remotes & Fobs', l2_code: 'AUT-RMT',
    marginMin: 0.40, marginMax: 0.45, priceMin: 15, priceMax: 120,
    manufacturers: ['Ilco', 'JMA USA', 'Keyline', 'Strattec'],
    products: [
      'Remote Head Key Toyota - 4 Button', 'Remote Head Key Honda - 3 Button',
      'Remote Head Key Ford - 4 Button', 'Smart Key Prox Nissan - 4 Button',
      'Smart Key Prox Toyota - 4 Button', 'Keyless Remote Chevy - 4 Button',
      'Flip Key Remote VW - 4 Button', 'Smart Key Prox Honda - 4 Button',
      'Remote Fob Chrysler - 4 Button', 'Smart Key Prox Hyundai - 4 Button',
    ],
    uom: 'EA', minOrderQty: 1
  },
  // ============ SAFES & SECURITY (SAF) ============
  {
    l1: 'Safes & Security', l1_code: 'SAF', l2: 'Residential Safes', l2_code: 'SAF-RES',
    marginMin: 0.38, marginMax: 0.42, priceMin: 150, priceMax: 900,
    manufacturers: ['Liberty Safe', 'AMSEC', 'Gardall', 'Hollon'],
    products: [
      'Home Safe HD-100 - Digital', 'Home Safe HD-200 - Digital',
      'Fire Safe F-1212 - 30 Min', 'Fire Safe F-2014 - 60 Min',
      'Wall Safe WS-1014 - Biometric', 'Floor Safe B-1500 - Dial',
      'Jewelry Safe JS-200 - Digital', 'Personal Safe PS-100 - Biometric',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Safes & Security', l1_code: 'SAF', l2: 'Commercial Safes', l2_code: 'SAF-COM',
    marginMin: 0.38, marginMax: 0.42, priceMin: 500, priceMax: 3500,
    manufacturers: ['AMSEC', 'Gardall', 'Hollon', 'Liberty Safe'],
    products: [
      'Commercial Safe BF3416 - Fire Rated', 'Commercial Safe BF5024 - TL15',
      'Burglar Safe TL-15 - Class B', 'Burglar Safe TL-30 - Class C',
      'High Security Safe - GSA Rated', 'Office Safe OS-200 - Digital',
      'Commercial Wall Safe CWS-2014', 'Record Safe RS-2418 - 2 Hour',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Safes & Security', l1_code: 'SAF', l2: 'Gun Safes', l2_code: 'SAF-GUN',
    marginMin: 0.38, marginMax: 0.42, priceMin: 300, priceMax: 3000,
    manufacturers: ['Liberty Safe', 'AMSEC', 'Fort Knox', 'Browning'],
    products: [
      'Gun Safe Centurion 12', 'Gun Safe Centurion 24',
      'Gun Safe Colonial 23', 'Gun Safe Fatboy Jr 48',
      'Gun Safe USA 36', 'Handgun Vault - Biometric',
      'Under Bed Gun Safe', 'Quick Access Gun Safe',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Safes & Security', l1_code: 'SAF', l2: 'Deposit Safes', l2_code: 'SAF-DEP',
    marginMin: 0.38, marginMax: 0.42, priceMin: 300, priceMax: 2500,
    manufacturers: ['AMSEC', 'Gardall', 'Hollon', 'FireKing'],
    products: [
      'Depository Safe DSR-2014 - Front Load', 'Depository Safe DSR-2814 - Front Load',
      'Depository Safe DSR-3614 - Rear Load', 'Drop Safe B-Rated - Dual Key',
      'Rotary Deposit Safe - Digital', 'Through-Wall Depository - Digital',
    ],
    uom: 'EA', minOrderQty: 1
  },
  // ============ KEY MACHINES & SUPPLIES (KEY) ============
  {
    l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Key Machines', l2_code: 'KEY-MCH',
    marginMin: 0.20, marginMax: 0.25, priceMin: 300, priceMax: 10000,
    manufacturers: ['Ilco', 'Silca', 'Framon', 'HPC'],
    products: [
      'Key Machine Speed 044 - Manual', 'Key Machine Speed 046 - Semi-Auto',
      'Key Machine Futura Pro - Laser', 'Key Machine Ninja Laser',
      'High Security Key Machine', 'Code Cutting Machine - Electronic',
      'Flat Steel Key Machine', 'Tubular Key Machine',
    ],
    uom: 'EA', minOrderQty: 1
  },
  {
    l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Key Blanks', l2_code: 'KEY-BLK',
    marginMin: 0.50, marginMax: 0.55, priceMin: 5, priceMax: 25,
    manufacturers: ['Ilco', 'JMA USA', 'Keyline', 'Silca'],
    products: [
      'Key Blank SC1 - Schlage 5-Pin (50pk)', 'Key Blank KW1 - Kwikset 5-Pin (50pk)',
      'Key Blank Y1 - Yale 5-Pin (50pk)', 'Key Blank WR5 - Weiser 5-Pin (50pk)',
      'Key Blank SC4 - Schlage 6-Pin (50pk)', 'Key Blank KW10 - Kwikset 6-Pin (50pk)',
      'Key Blank CO87 - Corbin (50pk)', 'Key Blank RU45 - Russwin (50pk)',
      'Key Blank BE2 - Best (50pk)', 'Key Blank S22 - Sargent (50pk)',
      'High Security Blank Primus (10pk)', 'High Security Blank Medeco (10pk)',
      'Key Blank AR1 - Arrow (50pk)', 'Key Blank FA2 - Falcon (50pk)',
      'Key Blank YH49 - Yale Hotel (50pk)',
    ],
    uom: 'PK', minOrderQty: 1
  },
  {
    l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Pinning Kits', l2_code: 'KEY-PIN',
    marginMin: 0.50, marginMax: 0.55, priceMin: 25, priceMax: 200,
    manufacturers: ['LAB', 'A-1 Security', 'Schlage', 'Kwikset'],
    products: [
      'Universal Pinning Kit .003 - LAB', 'Schlage Pinning Kit - Bottom Pins',
      'Kwikset Pinning Kit - Bottom Pins', 'Corbin Russwin Repin Kit',
      'Master Keying Pin Kit - Universal', 'IC Core Repin Kit',
      'Top Pin Assortment Kit', 'Spring Assortment Kit',
    ],
    uom: 'KIT', minOrderQty: 1
  },
  {
    l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Lubricants', l2_code: 'KEY-LUB',
    marginMin: 0.50, marginMax: 0.55, priceMin: 5, priceMax: 30,
    manufacturers: ['Houdini', 'Tri-Flow', 'CRC', 'WD-40 Specialist'],
    products: [
      'Lock Lubricant Spray - 3oz', 'Graphite Lubricant - 1.5oz',
      'Teflon Lubricant Spray - 4oz', 'Penetrating Oil - 8oz',
      'Lock De-Icer Spray - 3oz', 'Silicone Spray - 4oz',
    ],
    uom: 'EA', minOrderQty: 6
  },
  {
    l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Tools', l2_code: 'KEY-TLS',
    marginMin: 0.50, marginMax: 0.55, priceMin: 10, priceMax: 400,
    manufacturers: ['HPC', 'SouthOrd', 'Peterson', 'A-1 Security'],
    products: [
      'Pick Set - 14 Piece Slimline', 'Pick Set - 22 Piece Professional',
      'Plug Follower Set - 7 Piece', 'Cylinder Cap Remover Set',
      'Pin Tweezer Kit', 'Shim Set - Assorted',
      'Mortise Cylinder Tool Kit', 'IC Core Removal Tool',
      'Key Gauge - Schlage/Kwikset', 'Door Viewer Installation Kit',
    ],
    uom: 'EA', minOrderQty: 1
  },
];

function generateProducts() {
  const products = [];
  let productId = 1;

  for (const cat of CATEGORIES) {
    for (let i = 0; i < cat.products.length; i++) {
      const sku = `${cat.l2_code}-${String(i + 1).padStart(3, '0')}`;
      const manufacturer = pick(cat.manufacturers);

      // Generate price within range
      const price = parseFloat(randBetween(cat.priceMin, cat.priceMax).toFixed(2));

      // Generate cost based on margin target
      const targetMargin = randBetween(cat.marginMin, cat.marginMax);
      const cost = parseFloat((price * (1 - targetMargin)).toFixed(2));

      // MSRP is 30-60% above wholesale price
      const msrpMultiplier = randBetween(1.30, 1.60);
      const msrp = parseFloat((price * msrpMultiplier).toFixed(2));

      // Determine status - 95% active, 5% discontinued
      const status = seededRandom() < 0.95 ? 'ACTIVE' : 'DISCONTINUED';

      products.push({
        product_id: productId++,
        sku,
        name: cat.products[i],
        manufacturer,
        category_l1: cat.l1,
        category_l2: cat.l2,
        cost,
        price,
        msrp,
        uom: cat.uom,
        min_order_qty: cat.minOrderQty,
        status,
      });
    }
  }
  return products;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeProductsCSV(products) {
  const header = 'product_id,sku,name,manufacturer,category_l1,category_l2,cost,price,msrp,uom,min_order_qty,status';
  const lines = products.map(p =>
    [p.product_id, p.sku, escapeCSV(p.name), escapeCSV(p.manufacturer),
     escapeCSV(p.category_l1), escapeCSV(p.category_l2),
     p.cost.toFixed(2), p.price.toFixed(2), p.msrp.toFixed(2),
     p.uom, p.min_order_qty, p.status].join(',')
  );
  const csv = header + '\n' + lines.join('\n') + '\n';
  const outPath = path.join(__dirname, '..', 'public', 'data', 'products.csv');
  fs.writeFileSync(outPath, csv);
  return outPath;
}

function validate(products) {
  let errors = 0;
  const skus = new Set();
  const categoryMargins = {};

  for (const p of products) {
    // Check duplicates
    if (skus.has(p.sku)) { console.error(`Duplicate SKU: ${p.sku}`); errors++; }
    skus.add(p.sku);

    // Check price >= cost
    if (p.price < p.cost) { console.error(`Price < Cost for ${p.sku}`); errors++; }
    // Check msrp >= price
    if (p.msrp < p.price) { console.error(`MSRP < Price for ${p.sku}`); errors++; }

    // Track margins
    const margin = (p.price - p.cost) / p.price;
    if (margin < 0.15 || margin > 0.60) {
      console.error(`Margin out of bounds for ${p.sku}: ${(margin*100).toFixed(1)}%`);
      errors++;
    }

    if (!categoryMargins[p.category_l1]) categoryMargins[p.category_l1] = [];
    categoryMargins[p.category_l1].push(margin);
  }

  console.log(`\nTotal products: ${products.length}`);
  console.log(`Unique SKUs: ${skus.size}`);
  console.log(`Errors: ${errors}`);
  console.log('\nMargin Summary by Category:');
  for (const [cat, margins] of Object.entries(categoryMargins)) {
    const avg = margins.reduce((a, b) => a + b, 0) / margins.length;
    console.log(`  ${cat}: ${(avg*100).toFixed(1)}% avg (${margins.length} products)`);
  }

  // Count by L1
  console.log('\nProducts by L1 Category:');
  const l1Counts = {};
  for (const p of products) {
    l1Counts[p.category_l1] = (l1Counts[p.category_l1] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(l1Counts)) {
    console.log(`  ${cat}: ${count}`);
  }

  return errors === 0;
}

// Execute
const products = generateProducts();
const outFile = writeProductsCSV(products);
console.log(`Wrote ${products.length} products to ${outFile}`);
validate(products);
