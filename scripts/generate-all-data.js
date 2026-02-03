#!/usr/bin/env node
/**
 * Comprehensive Data Generator for Keystone Security Distribution
 * Generates all CSV data files: products, customers, orders, order_lines
 * Plus summary.json with aggregated metrics.
 *
 * Business rules sourced from CLAUDE.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR (for reproducibility)
// ============================================================================
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
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seededRandom() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================================
// CSV HELPERS
// ============================================================================
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCSV(filename, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCSV(row[h])).join(','));
  }
  const outPath = path.join(DATA_DIR, filename);
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  Wrote ${rows.length} rows to ${filename}`);
  return outPath;
}

// ============================================================================
// CONSTANTS FROM CLAUDE.md
// ============================================================================
const MONTHLY_SEASONALITY = {
  1: 0.78, 2: 0.72, 3: 0.92, 4: 1.08, 5: 1.15, 6: 1.22,
  7: 1.18, 8: 1.16, 9: 1.10, 10: 1.05, 11: 0.98, 12: 0.88
};

const DAY_OF_WEEK = {
  1: 1.35,  // Monday
  2: 1.25,  // Tuesday
  3: 1.10,  // Wednesday
  4: 1.00,  // Thursday
  5: 0.85,  // Friday
  6: 0.30,  // Saturday
  0: 0.15   // Sunday
};

const WEEK_OF_MONTH = [1.08, 1.12, 1.05, 0.88]; // weeks 1-4

const CUSTOMER_PRODUCT_AFFINITIES = {
  LSH: { 'Residential Locks': 0.30, 'Commercial Hardware': 0.20, 'Access Control': 0.10, 'Automotive': 0.20, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.15 },
  INT: { 'Residential Locks': 0.05, 'Commercial Hardware': 0.30, 'Access Control': 0.50, 'Automotive': 0.02, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.08 },
  PMG: { 'Residential Locks': 0.45, 'Commercial Hardware': 0.30, 'Access Control': 0.15, 'Automotive': 0.00, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.05 },
  RET: { 'Residential Locks': 0.50, 'Commercial Hardware': 0.15, 'Access Control': 0.05, 'Automotive': 0.05, 'Safes & Security': 0.10, 'Key Machines & Supplies': 0.15 }
};

// ============================================================================
// PART 1: PRODUCT GENERATION (200+ SKUs)
// ============================================================================

const PRODUCT_CATEGORIES = [
  // RESIDENTIAL LOCKS (RES)
  { l1: 'Residential Locks', l1_code: 'RES', l2: 'Deadbolts', l2_code: 'RES-DBL', marginMin: 0.28, marginMax: 0.32, priceMin: 25, priceMax: 120, manufacturers: ['Schlage','Kwikset','Yale','Weiser','Falcon'], products: ['Single Cylinder Deadbolt - Satin Nickel','Single Cylinder Deadbolt - Aged Bronze','Single Cylinder Deadbolt - Matte Black','Single Cylinder Deadbolt - Polished Brass','Double Cylinder Deadbolt - Satin Nickel','Double Cylinder Deadbolt - Aged Bronze','Double Cylinder Deadbolt - Polished Chrome','Single Cylinder Deadbolt - Bright Chrome','Jimmy-Proof Deadlock - Silver','High Security Deadbolt - Satin Chrome','Grade 1 Deadbolt - Brass','Grade 2 Deadbolt - Satin Nickel'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Residential Locks', l1_code: 'RES', l2: 'Entry Knobs', l2_code: 'RES-KNB', marginMin: 0.28, marginMax: 0.32, priceMin: 15, priceMax: 85, manufacturers: ['Schlage','Kwikset','Yale','Weiser'], products: ['Entry Knob Georgian - Satin Nickel','Entry Knob Georgian - Aged Bronze','Entry Knob Plymouth - Bright Brass','Entry Knob Plymouth - Satin Chrome','Entry Knob Tylo - Satin Nickel','Entry Knob Tylo - Polished Brass','Privacy Knob - Satin Nickel','Privacy Knob - Aged Bronze','Passage Knob - Satin Nickel','Passage Knob - Polished Brass'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Residential Locks', l1_code: 'RES', l2: 'Handlesets', l2_code: 'RES-HND', marginMin: 0.28, marginMax: 0.32, priceMin: 75, priceMax: 350, manufacturers: ['Schlage','Kwikset','Yale','Weiser'], products: ['Handleset Camelot - Satin Nickel','Handleset Camelot - Aged Bronze','Handleset Addison - Bright Chrome','Handleset Addison - Matte Black','Handleset Century - Satin Nickel','Handleset Plymouth - Polished Brass','Handleset Georgian - Satin Nickel','Handleset Brookshire - Aged Bronze','Handleset Arlington - Matte Black','Front Entry Handleset - Satin Chrome'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Residential Locks', l1_code: 'RES', l2: 'Smart Locks', l2_code: 'RES-SMT', marginMin: 0.28, marginMax: 0.32, priceMin: 120, priceMax: 350, manufacturers: ['Schlage','Kwikset','Yale','Alarm Lock'], products: ['Smart Deadbolt Encode Plus - Satin Nickel','Smart Deadbolt Encode Plus - Matte Black','Smart Lock Connect - Aged Bronze','Smart Lock Connect - Satin Chrome','Wi-Fi Smart Lock - Satin Nickel','Wi-Fi Smart Lock - Polished Brass','Bluetooth Smart Lock - Matte Black','Smart Lever with Touchscreen - Satin Nickel','Smart Deadbolt with Camera - Matte Black','Z-Wave Smart Lock - Satin Nickel'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Residential Locks', l1_code: 'RES', l2: 'Keypad Locks', l2_code: 'RES-KPD', marginMin: 0.28, marginMax: 0.32, priceMin: 80, priceMax: 250, manufacturers: ['Schlage','Kwikset','Yale','Alarm Lock'], products: ['Keypad Deadbolt BE365 - Satin Chrome','Keypad Deadbolt BE365 - Aged Bronze','Keypad Lever FE595 - Satin Nickel','Keypad Lever FE595 - Matte Black','Touch Keypad Deadbolt - Satin Nickel','Touch Keypad Deadbolt - Polished Brass','Electronic Keypad Lock - Bright Chrome','Keypad Entry Knob - Satin Nickel'], uom: 'EA', minOrderQty: 1 },
  // COMMERCIAL HARDWARE (COM)
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Cylindrical Locks', l2_code: 'COM-CYL', marginMin: 0.35, marginMax: 0.40, priceMin: 45, priceMax: 350, manufacturers: ['Schlage','Corbin Russwin','Yale','Sargent','Falcon','Best'], products: ['Cylindrical Lock ND60PD - 626','Cylindrical Lock ND80PD - 626','Cylindrical Lock ND50PD - 613','Cylindrical Lock ND70PD - 626','Cylindrical Lock ND25D - 626','Heavy Duty Cylindrical Lock - 630','Grade 1 Cylindrical Lockset - Classroom','Grade 1 Cylindrical Lockset - Storeroom','Grade 1 Cylindrical Lockset - Office','Grade 2 Cylindrical Lock - Entry'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Mortise Locks', l2_code: 'COM-MOR', marginMin: 0.35, marginMax: 0.40, priceMin: 150, priceMax: 800, manufacturers: ['Schlage','Corbin Russwin','Yale','Sargent','Marks USA'], products: ['Mortise Lock L9050 - Classroom','Mortise Lock L9060 - Apartment','Mortise Lock L9080 - Storeroom','Mortise Lock L9070 - Classroom','Mortise Lock L9040 - Privacy','Mortise Lock L9092 - Electrified','Mortise Lockset - Office Function','Mortise Lockset - Entry Function','Heavy Duty Mortise Lock - Institutional','Grade 1 Mortise Body - 626'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Exit Devices', l2_code: 'COM-EXT', marginMin: 0.35, marginMax: 0.40, priceMin: 200, priceMax: 1500, manufacturers: ['Von Duprin','Sargent','Corbin Russwin','Falcon'], products: ['Exit Device 98EO - Rim 36"','Exit Device 98EO - Rim 48"','Exit Device 99EO - SVR 36"','Exit Device 99EO - SVR 48"','Concealed Vertical Rod Device - 36"','Surface Vertical Rod Device - 48"','Rim Exit Device Grade 1 - 36"','Rim Exit Device Grade 1 - 48"','Fire Rated Exit Device - 36"','Motorized Latch Retraction Device','Delayed Egress Exit Device','Exit Alarm Device - 36"'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Door Closers', l2_code: 'COM-CLS', marginMin: 0.35, marginMax: 0.40, priceMin: 35, priceMax: 450, manufacturers: ['LCN','Norton','Yale','Sargent','Falcon'], products: ['Door Closer 4040XP - Aluminum','Door Closer 4040XP - Dark Bronze','Door Closer 4011 - Regular Arm','Door Closer 4041 - Hold Open Arm','Door Closer 1600 Series - Aluminum','Door Closer 1600 Series - Bronze','Concealed Door Closer - Aluminum','Surface Door Closer - Hold Open','ADA Compliant Door Closer','Heavy Duty Door Closer - Institutional'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Hinges', l2_code: 'COM-HNG', marginMin: 0.35, marginMax: 0.40, priceMin: 25, priceMax: 120, manufacturers: ['Hager','McKinney','Ives','Stanley'], products: ['Full Mortise Hinge 4.5" x 4.5" - 26D','Full Mortise Hinge 4.5" x 4.5" - US10B','Full Mortise Hinge 4" x 4" - 26D','Full Mortise Hinge 5" x 4.5" - 26D','Spring Hinge 4.5" x 4.5" - 26D','Continuous Hinge 83" - Clear','Pivot Hinge Set - Aluminum','Ball Bearing Hinge 4.5" - 630','Heavy Weight Hinge 5" x 5" - 26D','Electric Hinge 4-Wire - 26D'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Commercial Hardware', l1_code: 'COM', l2: 'Thresholds', l2_code: 'COM-THR', marginMin: 0.35, marginMax: 0.40, priceMin: 25, priceMax: 180, manufacturers: ['Pemko','National Guard','Reese','Zero International'], products: ['Saddle Threshold 36" - Aluminum','Saddle Threshold 48" - Aluminum','ADA Ramp Threshold 36" - Bronze','ADA Ramp Threshold 48" - Aluminum','Thermal Break Threshold 36"','Adjustable Threshold 36"','Bumper Seal Threshold 36"','Heavy Duty Mill Threshold 48"'], uom: 'EA', minOrderQty: 1 },
  // ACCESS CONTROL (ACC)
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Card Readers', l2_code: 'ACC-RDR', marginMin: 0.35, marginMax: 0.50, priceMin: 80, priceMax: 450, manufacturers: ['HID Global','Allegion','dormakaba','NAPCO'], products: ['Proximity Reader iCLASS SE - Black','Proximity Reader iCLASS SE - Gray','Multi-Class Reader SE - Black','Proximity Reader R10 - Black','Proximity Reader R40 - Long Range','Mobile-Ready Reader - Bluetooth','Biometric Reader with Card - Black','Mullion Mount Reader - Black','Weatherproof Card Reader - Gray','Smart Card Reader - Contactless'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Controllers', l2_code: 'ACC-CTL', marginMin: 0.35, marginMax: 0.50, priceMin: 200, priceMax: 1500, manufacturers: ['HID Global','Allegion','NAPCO','dormakaba'], products: ['Access Controller 2-Door - IP','Access Controller 4-Door - IP','Access Controller 8-Door - IP','Single Door Controller - PoE','Elevator Controller - 16 Floor','Network Access Panel - 2 Reader','Access Control Board - 4 Reader','Wireless Lock Controller','Edge Controller - Single Door','Cloud-Based Controller Module'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Credentials', l2_code: 'ACC-CRD', marginMin: 0.35, marginMax: 0.50, priceMin: 50, priceMax: 300, manufacturers: ['HID Global','Allegion','dormakaba'], products: ['Proximity Cards iCLASS - 100 Pack','Proximity Cards HID 1326 - 100 Pack','Smart Cards SEOS - 50 Pack','Key Fobs iCLASS - 50 Pack','Key Fobs Prox - 100 Pack','Wristband Credentials - 25 Pack','Mobile Credential License - 100 Pack','Clamshell Cards 125kHz - 100 Pack'], uom: 'PK', minOrderQty: 1 },
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Electric Strikes', l2_code: 'ACC-STR', marginMin: 0.35, marginMax: 0.50, priceMin: 50, priceMax: 350, manufacturers: ['HES','Von Duprin','Securitron','Folger Adam'], products: ['Electric Strike 1006 - 12/24VDC','Electric Strike 1006 - Fail Secure','Electric Strike 1006 - Fail Safe','Electric Strike 9600 - 12/24VDC','Heavy Duty Electric Strike - Mortise','Fire Rated Electric Strike','Electric Strike for Rim Device','Compact Electric Strike - 12VDC','Surface Mount Electric Strike','Electric Release - Cylindrical Lock'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Maglocks', l2_code: 'ACC-MAG', marginMin: 0.35, marginMax: 0.50, priceMin: 75, priceMax: 400, manufacturers: ['Securitron','Dortronics','DynaLock','Alarm Lock'], products: ['Maglock 600 lb - Single Door','Maglock 1200 lb - Single Door','Maglock 600 lb - Double Door','Maglock 1200 lb - Double Door','Shear Lock 2000 lb','Mini Maglock 300 lb - Surface','Gate Maglock - 1200 lb Outdoor','Maglock with LED Status'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Access Control', l1_code: 'ACC', l2: 'Keypad Locks', l2_code: 'ACC-KPD', marginMin: 0.35, marginMax: 0.50, priceMin: 150, priceMax: 800, manufacturers: ['Alarm Lock','Kaba','Schlage','dormakaba'], products: ['Trilogy T2 DL2700 - 26D','Trilogy T2 DL2700 - US10B','Trilogy T3 DL6100 - 26D','Networked Keypad Lock - Wireless','Standalone Keypad Lock - Battery','Heavy Duty Keypad Lever - 626','Keypad Lock with Audit Trail','Pushbutton Lock - Mechanical'], uom: 'EA', minOrderQty: 1 },
  // AUTOMOTIVE (AUT)
  { l1: 'Automotive', l1_code: 'AUT', l2: 'Transponder Keys', l2_code: 'AUT-TRN', marginMin: 0.40, marginMax: 0.45, priceMin: 5, priceMax: 45, manufacturers: ['Ilco','JMA USA','Keyline','Strattec'], products: ['Transponder Key Toyota - TOY44D-PT','Transponder Key Honda - HD111-PT','Transponder Key Ford - H92-PT','Transponder Key Chevy - B111-PT','Transponder Key Nissan - NI04-PT','Transponder Key Chrysler - Y159-PT','Transponder Key BMW - BM3-PT','Transponder Key Mercedes - HU64-PT','Transponder Key Hyundai - HY18-PT','Transponder Key Kia - KK10-PT','High Security Key VW - HU66-PT','Transponder Key Subaru - SUB44-PT','Transponder Key Lexus - TOY48-PT','Transponder Key Jeep - Y160-PT'], uom: 'EA', minOrderQty: 5 },
  { l1: 'Automotive', l1_code: 'AUT', l2: 'Programming Tools', l2_code: 'AUT-PRG', marginMin: 0.40, marginMax: 0.45, priceMin: 350, priceMax: 2500, manufacturers: ['Autel','Xtool','Advanced Diagnostics','Silca'], products: ['Key Programmer IM608 Pro','Key Programmer IM508 Pro','Smart Pro Key Programmer','Key Programming Device RW4 Plus','EEPROM Programming Tool','Universal Key Programmer','OBD Key Programmer - Basic','Key Machine with Programmer Combo'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Automotive', l1_code: 'AUT', l2: 'Lockout Tools', l2_code: 'AUT-LOT', marginMin: 0.40, marginMax: 0.45, priceMin: 15, priceMax: 250, manufacturers: ['Lishi','SouthOrd','Pro-Lok','Access Tools'], products: ['Slim Jim Set - Universal','Long Reach Tool Kit','Air Wedge - Large','Air Wedge - Small','Jiffy Jak Lockout Kit','Quick Entry Tool Set','Under Door Tool','Car Opening Tool Set - 12 Piece'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Automotive', l1_code: 'AUT', l2: 'Remotes & Fobs', l2_code: 'AUT-RMT', marginMin: 0.40, marginMax: 0.45, priceMin: 15, priceMax: 120, manufacturers: ['Ilco','JMA USA','Keyline','Strattec'], products: ['Remote Head Key Toyota - 4 Button','Remote Head Key Honda - 3 Button','Remote Head Key Ford - 4 Button','Smart Key Prox Nissan - 4 Button','Smart Key Prox Toyota - 4 Button','Keyless Remote Chevy - 4 Button','Flip Key Remote VW - 4 Button','Smart Key Prox Honda - 4 Button','Remote Fob Chrysler - 4 Button','Smart Key Prox Hyundai - 4 Button'], uom: 'EA', minOrderQty: 1 },
  // SAFES & SECURITY (SAF)
  { l1: 'Safes & Security', l1_code: 'SAF', l2: 'Residential Safes', l2_code: 'SAF-RES', marginMin: 0.38, marginMax: 0.42, priceMin: 150, priceMax: 900, manufacturers: ['Liberty Safe','AMSEC','Gardall','Hollon'], products: ['Home Safe HD-100 - Digital','Home Safe HD-200 - Digital','Fire Safe F-1212 - 30 Min','Fire Safe F-2014 - 60 Min','Wall Safe WS-1014 - Biometric','Floor Safe B-1500 - Dial','Jewelry Safe JS-200 - Digital','Personal Safe PS-100 - Biometric'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Safes & Security', l1_code: 'SAF', l2: 'Commercial Safes', l2_code: 'SAF-COM', marginMin: 0.38, marginMax: 0.42, priceMin: 500, priceMax: 3500, manufacturers: ['AMSEC','Gardall','Hollon','Liberty Safe'], products: ['Commercial Safe BF3416 - Fire Rated','Commercial Safe BF5024 - TL15','Burglar Safe TL-15 - Class B','Burglar Safe TL-30 - Class C','High Security Safe - GSA Rated','Office Safe OS-200 - Digital','Commercial Wall Safe CWS-2014','Record Safe RS-2418 - 2 Hour'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Safes & Security', l1_code: 'SAF', l2: 'Gun Safes', l2_code: 'SAF-GUN', marginMin: 0.38, marginMax: 0.42, priceMin: 300, priceMax: 3000, manufacturers: ['Liberty Safe','AMSEC','Fort Knox','Browning'], products: ['Gun Safe Centurion 12','Gun Safe Centurion 24','Gun Safe Colonial 23','Gun Safe Fatboy Jr 48','Gun Safe USA 36','Handgun Vault - Biometric','Under Bed Gun Safe','Quick Access Gun Safe'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Safes & Security', l1_code: 'SAF', l2: 'Deposit Safes', l2_code: 'SAF-DEP', marginMin: 0.38, marginMax: 0.42, priceMin: 300, priceMax: 2500, manufacturers: ['AMSEC','Gardall','Hollon','FireKing'], products: ['Depository Safe DSR-2014 - Front Load','Depository Safe DSR-2814 - Front Load','Depository Safe DSR-3614 - Rear Load','Drop Safe B-Rated - Dual Key','Rotary Deposit Safe - Digital','Through-Wall Depository - Digital'], uom: 'EA', minOrderQty: 1 },
  // KEY MACHINES & SUPPLIES (KEY)
  { l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Key Machines', l2_code: 'KEY-MCH', marginMin: 0.20, marginMax: 0.25, priceMin: 300, priceMax: 10000, manufacturers: ['Ilco','Silca','Framon','HPC'], products: ['Key Machine Speed 044 - Manual','Key Machine Speed 046 - Semi-Auto','Key Machine Futura Pro - Laser','Key Machine Ninja Laser','High Security Key Machine','Code Cutting Machine - Electronic','Flat Steel Key Machine','Tubular Key Machine'], uom: 'EA', minOrderQty: 1 },
  { l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Key Blanks', l2_code: 'KEY-BLK', marginMin: 0.50, marginMax: 0.55, priceMin: 5, priceMax: 25, manufacturers: ['Ilco','JMA USA','Keyline','Silca'], products: ['Key Blank SC1 - Schlage 5-Pin (50pk)','Key Blank KW1 - Kwikset 5-Pin (50pk)','Key Blank Y1 - Yale 5-Pin (50pk)','Key Blank WR5 - Weiser 5-Pin (50pk)','Key Blank SC4 - Schlage 6-Pin (50pk)','Key Blank KW10 - Kwikset 6-Pin (50pk)','Key Blank CO87 - Corbin (50pk)','Key Blank RU45 - Russwin (50pk)','Key Blank BE2 - Best (50pk)','Key Blank S22 - Sargent (50pk)','High Security Blank Primus (10pk)','High Security Blank Medeco (10pk)','Key Blank AR1 - Arrow (50pk)','Key Blank FA2 - Falcon (50pk)','Key Blank YH49 - Yale Hotel (50pk)'], uom: 'PK', minOrderQty: 1 },
  { l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Pinning Kits', l2_code: 'KEY-PIN', marginMin: 0.50, marginMax: 0.55, priceMin: 25, priceMax: 200, manufacturers: ['LAB','A-1 Security','Schlage','Kwikset'], products: ['Universal Pinning Kit .003 - LAB','Schlage Pinning Kit - Bottom Pins','Kwikset Pinning Kit - Bottom Pins','Corbin Russwin Repin Kit','Master Keying Pin Kit - Universal','IC Core Repin Kit','Top Pin Assortment Kit','Spring Assortment Kit'], uom: 'KIT', minOrderQty: 1 },
  { l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Lubricants', l2_code: 'KEY-LUB', marginMin: 0.50, marginMax: 0.55, priceMin: 5, priceMax: 30, manufacturers: ['Houdini','Tri-Flow','CRC','WD-40 Specialist'], products: ['Lock Lubricant Spray - 3oz','Graphite Lubricant - 1.5oz','Teflon Lubricant Spray - 4oz','Penetrating Oil - 8oz','Lock De-Icer Spray - 3oz','Silicone Spray - 4oz'], uom: 'EA', minOrderQty: 6 },
  { l1: 'Key Machines & Supplies', l1_code: 'KEY', l2: 'Tools', l2_code: 'KEY-TLS', marginMin: 0.50, marginMax: 0.55, priceMin: 10, priceMax: 400, manufacturers: ['HPC','SouthOrd','Peterson','A-1 Security'], products: ['Pick Set - 14 Piece Slimline','Pick Set - 22 Piece Professional','Plug Follower Set - 7 Piece','Cylinder Cap Remover Set','Pin Tweezer Kit','Shim Set - Assorted','Mortise Cylinder Tool Kit','IC Core Removal Tool','Key Gauge - Schlage/Kwikset','Door Viewer Installation Kit'], uom: 'EA', minOrderQty: 1 },
];

function generateProducts() {
  console.log('\n=== Generating products.csv ===');
  const products = [];
  let productId = 1;

  for (const cat of PRODUCT_CATEGORIES) {
    for (let i = 0; i < cat.products.length; i++) {
      const sku = `${cat.l2_code}-${String(i + 1).padStart(3, '0')}`;
      const manufacturer = pick(cat.manufacturers);
      const price = parseFloat(randBetween(cat.priceMin, cat.priceMax).toFixed(2));
      const targetMargin = randBetween(cat.marginMin, cat.marginMax);
      const cost = parseFloat((price * (1 - targetMargin)).toFixed(2));
      const msrpMultiplier = randBetween(1.30, 1.60);
      const msrp = parseFloat((price * msrpMultiplier).toFixed(2));
      const status = seededRandom() < 0.95 ? 'ACTIVE' : 'DISCONTINUED';

      products.push({
        product_id: productId++,
        sku,
        name: cat.products[i],
        manufacturer,
        category_l1: cat.l1,
        category_l2: cat.l2,
        cost: cost.toFixed(2),
        price: price.toFixed(2),
        msrp: msrp.toFixed(2),
        uom: cat.uom,
        min_order_qty: cat.minOrderQty,
        status
      });
    }
  }

  writeCSV('products.csv', [
    'product_id','sku','name','manufacturer','category_l1','category_l2',
    'cost','price','msrp','uom','min_order_qty','status'
  ], products);

  // Validate
  const l1Counts = {};
  const categoryMargins = {};
  for (const p of products) {
    l1Counts[p.category_l1] = (l1Counts[p.category_l1] || 0) + 1;
    const margin = (parseFloat(p.price) - parseFloat(p.cost)) / parseFloat(p.price);
    if (!categoryMargins[p.category_l1]) categoryMargins[p.category_l1] = [];
    categoryMargins[p.category_l1].push(margin);
  }
  console.log(`  Total products: ${products.length}`);
  console.log('  Products by L1 category:');
  for (const [cat, count] of Object.entries(l1Counts)) {
    const avg = categoryMargins[cat].reduce((a, b) => a + b, 0) / categoryMargins[cat].length;
    console.log(`    ${cat}: ${count} products, avg margin ${(avg * 100).toFixed(1)}%`);
  }

  return products;
}

// ============================================================================
// PART 2: CUSTOMER GENERATION (150 accounts)
// ============================================================================

const STATE_GEO = {
  PA: {
    weight: 0.35,
    cities: [
      { name: 'Philadelphia', weight: 0.45, zips: ['19101','19102','19103','19104','19106','19107','19111','19114','19115','19116','19118','19119','19120','19121','19122','19123','19124','19125','19126','19127','19128','19129','19130','19131','19132','19133','19134','19135','19136','19137','19138','19139','19140','19141','19142','19143','19144','19145','19146','19147','19148','19149','19150','19151','19152','19153','19154'] },
      { name: 'Pittsburgh', weight: 0.20, zips: ['15201','15203','15204','15205','15206','15207','15208','15210','15211','15212','15213','15214','15215','15216','15217','15218','15219','15220','15221','15222','15224','15226','15227','15228','15232','15233','15234','15235','15236','15237','15238'] },
      { name: 'Allentown', weight: 0.10, zips: ['18101','18102','18103','18104','18109'] },
      { name: 'Reading', weight: 0.08, zips: ['19601','19602','19604','19605','19606','19607','19608','19609','19610','19611'] },
      { name: 'Lancaster', weight: 0.07, zips: ['17601','17602','17603'] },
      { name: 'King of Prussia', weight: 0.05, zips: ['19406'] },
      { name: 'Harrisburg', weight: 0.05, zips: ['17101','17102','17103','17104','17109','17110','17111','17112'] },
    ]
  },
  NJ: {
    weight: 0.28,
    cities: [
      { name: 'Newark', weight: 0.20, zips: ['07101','07102','07103','07104','07105','07106','07107','07108','07112','07114'] },
      { name: 'Jersey City', weight: 0.18, zips: ['07302','07304','07305','07306','07307','07310','07311'] },
      { name: 'Trenton', weight: 0.12, zips: ['08608','08609','08610','08611','08618','08619','08620'] },
      { name: 'Camden', weight: 0.10, zips: ['08101','08102','08103','08104','08105'] },
      { name: 'Cherry Hill', weight: 0.15, zips: ['08002','08003','08034'] },
      { name: 'Edison', weight: 0.12, zips: ['08817','08818','08820','08837'] },
      { name: 'Paterson', weight: 0.13, zips: ['07501','07502','07503','07504','07505','07509','07510','07513','07514'] },
    ]
  },
  MD: {
    weight: 0.17,
    cities: [
      { name: 'Baltimore', weight: 0.50, zips: ['21201','21202','21205','21206','21207','21208','21209','21210','21211','21212','21213','21214','21215','21216','21217','21218','21223','21224','21225','21226','21227','21228','21229','21230','21231','21234','21236','21237'] },
      { name: 'Silver Spring', weight: 0.15, zips: ['20901','20902','20903','20904','20906','20910'] },
      { name: 'Rockville', weight: 0.12, zips: ['20850','20851','20852'] },
      { name: 'Columbia', weight: 0.13, zips: ['21044','21045','21046'] },
      { name: 'Bethesda', weight: 0.10, zips: ['20814','20816','20817'] },
    ]
  },
  VA: {
    weight: 0.12,
    cities: [
      { name: 'Arlington', weight: 0.20, zips: ['22201','22202','22203','22204','22205','22206','22207','22209'] },
      { name: 'Alexandria', weight: 0.20, zips: ['22301','22302','22304','22305','22311','22312','22314'] },
      { name: 'Richmond', weight: 0.25, zips: ['23219','23220','23221','23222','23223','23224','23225','23226','23227','23228','23229','23230','23231','23234','23235'] },
      { name: 'Norfolk', weight: 0.15, zips: ['23501','23502','23503','23504','23505','23507','23508','23509','23510','23511','23513'] },
      { name: 'Virginia Beach', weight: 0.20, zips: ['23451','23452','23453','23454','23455','23456','23457','23459','23460','23461','23462','23464'] },
    ]
  },
  DE: {
    weight: 0.05,
    cities: [
      { name: 'Wilmington', weight: 0.65, zips: ['19801','19802','19803','19804','19805','19806','19807','19808','19809','19810'] },
      { name: 'Dover', weight: 0.20, zips: ['19901','19904'] },
      { name: 'Newark', weight: 0.15, zips: ['19711','19713','19716'] },
    ]
  },
  DC: {
    weight: 0.03,
    cities: [
      { name: 'Washington', weight: 1.0, zips: ['20001','20002','20003','20004','20005','20006','20007','20008','20009','20010','20011','20012','20015','20016','20017','20018','20019','20020','20024','20032','20036','20037'] },
    ]
  }
};

const CUSTOMER_TYPE_CONFIG = {
  LSH: {
    count: 68,  // 45% of 150 ~= 68
    namePatterns: [
      '{city} Locksmith', '{city} Lock & Key', '{last} Lock Service', '{last} Locksmith',
      'All-Pro Locksmith {city}', '{city} Safe & Lock', 'Quick Key Locksmith',
      '{last} Security & Lock', 'AAA Locksmith {city}', 'Master Key Locksmith',
      '{city} Lock Shop', 'Elite Locksmith Services', 'Premier Lock & Safe',
      '{last} Lock & Safe', 'Affordable Locksmith {city}', 'Express Lock Service',
      'Metro Locksmith {city}', 'A-1 Locksmith {city}'
    ],
    creditMin: 5000, creditMax: 50000,
    paymentTerms: ['NET30', 'NET30', 'NET30', 'NET15', 'COD'],
    orderFreqMin: 8, orderFreqMax: 15
  },
  INT: {
    count: 45,  // 30% of 150 = 45
    namePatterns: [
      '{city} Security Systems', '{last} Integration Group', '{city} Access Solutions',
      '{last} Security Technologies', 'Integrated Security {city}', 'SecureTech Solutions',
      '{last} & Associates Security', 'ProGuard Systems {city}', 'Total Security Integration',
      'Sentinel Security Systems', '{city} Security Integrators', 'Advanced Access Systems',
      'Shield Security Group', '{last} Security Corp', 'Guardian Integration Services'
    ],
    creditMin: 25000, creditMax: 200000,
    paymentTerms: ['NET30', 'NET30', 'NET45', 'NET45', 'NET15'],
    orderFreqMin: 5, orderFreqMax: 15
  },
  PMG: {
    count: 22,  // 15% of 150 ~= 22
    namePatterns: [
      '{city} Property Management', '{last} Property Group', 'Metro Properties {city}',
      '{last} Real Estate Management', '{city} Residential Management', 'Premier Property Services',
      'Keystone Property Management', '{last} Management Corp', 'Summit Property Group',
      'Horizon Property Services', '{city} Commercial Properties'
    ],
    creditMin: 10000, creditMax: 75000,
    paymentTerms: ['NET30', 'NET30', 'NET45', 'NET15'],
    orderFreqMin: 2, orderFreqMax: 6
  },
  RET: {
    count: 15,  // 10% of 150 = 15
    namePatterns: [
      '{city} Hardware', '{last} Hardware & Supply', 'True Value {city}',
      '{city} Home Center', 'Ace Hardware {city}', '{last} Building Supply',
      'Do It Best {city}', '{city} Home & Garden', 'Pro Hardware {city}',
      '{last} Supply Company'
    ],
    creditMin: 10000, creditMax: 100000,
    paymentTerms: ['NET30', 'NET30', 'NET15', 'NET45'],
    orderFreqMin: 2, orderFreqMax: 6
  }
};

const LAST_NAMES = [
  'Anderson','Baker','Campbell','Davis','Edwards','Franklin','Garcia','Harris',
  'Johnson','Kelly','Lewis','Mitchell','Nelson','Owens','Parker','Quinn',
  'Roberts','Smith','Taylor','Underwood','Vargas','Williams','Young','Zhang',
  'Brennan','Collins','Donovan','Evans','Fleming','Grant','Hayes','Irwin',
  'Jenkins','Kemp','Lopez','Morgan','Nash','O\'Brien','Patel','Reed',
  'Sullivan','Thompson','Walsh','York','Martinez','Rivera','Chen','Kim',
  'Nguyen','Brown','Wilson','Moore','Jackson','Martin','Lee','Clark',
  'Robinson','Hall','Allen','Scott','King','Wright','Green','Adams',
  'Hill','Campbell','Turner','Phillips','Stewart','Sanchez','Morris','Rogers',
  'Cooper','Peterson','Bailey','Howard','Ward','Cox','Diaz','Richardson'
];

const FIRST_NAMES = [
  'James','Michael','Robert','David','John','William','Richard','Thomas',
  'Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven',
  'Jennifer','Linda','Patricia','Barbara','Elizabeth','Susan','Jessica',
  'Sarah','Karen','Nancy','Lisa','Betty','Margaret','Sandra','Ashley',
  'Angela','Maria','Melissa','Stephanie','Nicole','Amanda','Catherine'
];

const STREET_NAMES = [
  'Main St','Market St','Oak Ave','Elm St','Broad St','Pine St','Cedar Ln',
  'Walnut St','Chestnut St','Spring Garden St','Lancaster Ave','Baltimore Pike',
  'Ridge Rd','Valley Forge Rd','King St','Queen St','Church St','High St',
  'State Rd','Commerce Dr','Industrial Blvd','Washington Ave','Lincoln Hwy',
  'Liberty St','Union Ave','Railroad Ave','Park Ave','Mill Rd','Creek Rd',
  'Bridge St','Front St','Water St','Vine St','Arch St','Race St','Cherry St'
];

function generateCustomers() {
  console.log('\n=== Generating customers.csv ===');
  const customers = [];
  let customerId = 1;

  const states = Object.keys(STATE_GEO);
  const stateWeights = states.map(s => STATE_GEO[s].weight);

  const usedNames = new Set();

  for (const [type, config] of Object.entries(CUSTOMER_TYPE_CONFIG)) {
    for (let i = 0; i < config.count; i++) {
      // Pick state/city based on geographic weights
      const state = weightedPick(states, stateWeights);
      const geo = STATE_GEO[state];
      const cityNames = geo.cities.map(c => c.name);
      const cityWeights = geo.cities.map(c => c.weight);
      const cityObj = geo.cities[cityNames.indexOf(weightedPick(cityNames, cityWeights))];
      const city = cityObj.name;
      const zip = pick(cityObj.zips);

      // Generate unique company name
      let companyName;
      let attempts = 0;
      do {
        const pattern = pick(config.namePatterns);
        const lastName = pick(LAST_NAMES);
        companyName = pattern.replace('{city}', city).replace('{last}', lastName);
        attempts++;
        if (attempts > 50) {
          companyName = companyName + ' ' + customerId;
        }
      } while (usedNames.has(companyName) && attempts <= 50);
      usedNames.add(companyName);

      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const contactName = `${firstName} ${lastName}`;
      const emailDomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}.com`;
      const phone = `(${randInt(200,999)}) ${randInt(200,999)}-${String(randInt(0,9999)).padStart(4,'0')}`;
      const address = `${randInt(100, 9999)} ${pick(STREET_NAMES)}`;
      const paymentTerms = pick(config.paymentTerms);
      const creditLimit = Math.round(randBetween(config.creditMin, config.creditMax) / 1000) * 1000;

      // created_date between 2015-01-01 and 2022-12-31
      const createdYear = randInt(2015, 2022);
      const createdMonth = randInt(1, 12);
      const createdDay = randInt(1, 28);
      const createdDate = `${createdYear}-${String(createdMonth).padStart(2,'0')}-${String(createdDay).padStart(2,'0')}`;

      customers.push({
        customer_id: customerId,
        account_number: `KSD-${String(customerId).padStart(5, '0')}`,
        company_name: companyName,
        customer_type: type,
        contact_name: contactName,
        email,
        phone,
        address,
        city,
        state,
        zip,
        payment_terms: paymentTerms,
        credit_limit: creditLimit,
        status: seededRandom() < 0.95 ? 'ACTIVE' : 'INACTIVE',
        created_date: createdDate
      });
      customerId++;
    }
  }

  // Post-process: ensure all states have minimum representation per CLAUDE.md weights
  const targetStateCounts = { PA: 53, NJ: 42, MD: 26, VA: 18, DE: 7, DC: 4 };
  const currentStateCounts = {};
  for (const c of customers) {
    currentStateCounts[c.state] = (currentStateCounts[c.state] || 0) + 1;
  }
  // Find states with 0 or under-target counts, reassign from over-represented states
  for (const [targetState, targetCount] of Object.entries(targetStateCounts)) {
    const currentCount = currentStateCounts[targetState] || 0;
    if (currentCount < Math.max(2, Math.ceil(targetCount * 0.8))) {
      // Need to add customers to this state
      const needed = targetCount - currentCount;
      // Find most over-represented state
      for (let n = 0; n < needed; n++) {
        let maxOver = 0, maxState = null;
        for (const [s, tc] of Object.entries(targetStateCounts)) {
          const over = (currentStateCounts[s] || 0) - tc;
          if (over > maxOver) { maxOver = over; maxState = s; }
        }
        if (!maxState) break;
        // Find a customer in maxState and reassign to targetState
        const idx = customers.findIndex(c => c.state === maxState);
        if (idx === -1) break;
        const geo = STATE_GEO[targetState];
        const cityObj = geo.cities[0]; // Pick primary city
        customers[idx].state = targetState;
        customers[idx].city = cityObj.name;
        customers[idx].zip = pick(cityObj.zips);
        currentStateCounts[maxState]--;
        currentStateCounts[targetState] = (currentStateCounts[targetState] || 0) + 1;
      }
    }
  }

  writeCSV('customers.csv', [
    'customer_id','account_number','company_name','customer_type','contact_name',
    'email','phone','address','city','state','zip','payment_terms','credit_limit',
    'status','created_date'
  ], customers);

  // Validate distribution
  const typeCounts = {};
  const stateCounts = {};
  for (const c of customers) {
    typeCounts[c.customer_type] = (typeCounts[c.customer_type] || 0) + 1;
    stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
  }
  console.log(`  Total customers: ${customers.length}`);
  console.log('  By type:');
  for (const [t, c] of Object.entries(typeCounts)) {
    console.log(`    ${t}: ${c} (${(c/customers.length*100).toFixed(1)}%)`);
  }
  console.log('  By state:');
  for (const [s, c] of Object.entries(stateCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s}: ${c} (${(c/customers.length*100).toFixed(1)}%)`);
  }

  return customers;
}

// ============================================================================
// PART 3: ORDER GENERATION (7,904 total orders)
// ============================================================================

function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getWeekOfMonth(day) {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

function generateOrders(customers, products) {
  console.log('\n=== Generating orders.csv and order_lines.csv ===');

  // Separate active customers
  const activeCustomers = customers.filter(c => c.status === 'ACTIVE');

  // Build customer groups by type
  const customersByType = { LSH: [], INT: [], PMG: [], RET: [] };
  for (const c of activeCustomers) {
    customersByType[c.customer_type].push(c);
  }

  // Build product groups by L1 category (active only)
  const productsByL1 = {};
  for (const p of products) {
    if (p.status === 'DISCONTINUED') continue;
    if (!productsByL1[p.category_l1]) productsByL1[p.category_l1] = [];
    productsByL1[p.category_l1].push(p);
  }

  const orders = [];
  const orderLines = [];
  let orderId = 1;
  let lineId = 1;
  let orderSeqByMonth = {};

  // Target: Year 1 = 3800, Year 2 = 4104, Year 3 = 4432 (8% growth each)
  // Monthly baseline = annual / sum(monthly_multipliers)
  const sumMultipliers = Object.values(MONTHLY_SEASONALITY).reduce((a, b) => a + b, 0);
  const y1MonthlyBase = 3800 / sumMultipliers;
  const y2MonthlyBase = 4104 / sumMultipliers;
  const y3MonthlyBase = 4432 / sumMultipliers;

  // Order value ranges by customer type
  const ORDER_VALUE_RANGES = {
    LSH: { min: 150, max: 800 },
    INT: { min: 1500, max: 8000 },
    PMG: { min: 200, max: 600 },
    RET: { min: 300, max: 800 }
  };

  // Customer type weights for order frequency
  const TYPE_ORDER_FREQ = {
    LSH: { weight: 0.45, freqMin: 8, freqMax: 15 },
    INT: { weight: 0.30, freqMin: 5, freqMax: 15 },
    PMG: { weight: 0.15, freqMin: 2, freqMax: 6 },
    RET: { weight: 0.10, freqMin: 2, freqMax: 6 }
  };

  // Generate month by month
  for (let year = 2023; year <= 2025; year++) {
    const monthlyBase = year === 2023 ? y1MonthlyBase : year === 2024 ? y2MonthlyBase : y3MonthlyBase;

    for (let month = 1; month <= 12; month++) {
      const seasonality = MONTHLY_SEASONALITY[month];
      const targetOrders = Math.round(monthlyBase * seasonality);
      const monthKey = `${year}${String(month).padStart(2,'0')}`;
      orderSeqByMonth[monthKey] = orderSeqByMonth[monthKey] || 0;

      const daysInMonth = getDaysInMonth(year, month);

      // Generate orders for this month
      for (let i = 0; i < targetOrders; i++) {
        // Pick a day based on day-of-week weights
        let day, dow, attempts2 = 0;
        do {
          day = randInt(1, daysInMonth);
          const testDate = new Date(year, month - 1, day);
          dow = testDate.getDay();
          const weekMult = WEEK_OF_MONTH[getWeekOfMonth(day)];
          const dowMult = DAY_OF_WEEK[dow];
          // Accept with probability proportional to weights
          if (seededRandom() < (dowMult * weekMult) / (1.35 * 1.12)) break;
          attempts2++;
        } while (attempts2 < 50);

        const orderDate = new Date(year, month - 1, day);

        // Pick customer type, then customer
        const types = Object.keys(TYPE_ORDER_FREQ);
        const typeWeights = types.map(t => TYPE_ORDER_FREQ[t].weight);
        const custType = weightedPick(types, typeWeights);
        const customer = pick(customersByType[custType]);
        if (!customer) continue;

        // Ship date: 0-3 business days after order date
        const shipDays = randInt(0, 3);
        const shipDate = shipDays === 0 ? new Date(orderDate) : addBusinessDays(orderDate, shipDays);

        // Generate order lines
        // Lines per order: negative binomial approximation, mean 4.5, min 1, max 25
        let numLines = 1 + Math.floor(Math.abs(randBetween(0, 1) + randBetween(0, 1) + randBetween(0, 1)) * 2.5);
        numLines = Math.max(1, Math.min(25, numLines));
        // Small boost for some orders to push toward 4.5 mean
        if (seededRandom() < 0.15) numLines = Math.min(25, numLines + randInt(1, 3));

        const affinities = CUSTOMER_PRODUCT_AFFINITIES[custType];
        const affKeys = Object.keys(affinities);
        const affWeights = Object.values(affinities);

        let subtotal = 0;
        let totalCost = 0;
        const thisOrderLines = [];

        for (let ln = 0; ln < numLines; ln++) {
          // Pick category based on affinity
          let category = weightedPick(affKeys, affWeights);
          // If zero weight resulted in pick, try again
          if (!productsByL1[category] || productsByL1[category].length === 0) {
            // Fall back to any category with products
            category = pick(Object.keys(productsByL1));
          }

          const product = pick(productsByL1[category]);
          const pPrice = parseFloat(product.price);
          const pCost = parseFloat(product.cost);

          // Quantity varies by category - tuned for target avg order values
          let qty;
          if (category === 'Key Machines & Supplies' && product.category_l2 === 'Key Blanks') {
            qty = randInt(2, 10);
          } else if (category === 'Key Machines & Supplies' && product.category_l2 === 'Lubricants') {
            qty = randInt(3, 12);
          } else if (category === 'Automotive' && product.category_l2 === 'Transponder Keys') {
            qty = randInt(5, 25);
          } else if (category === 'Access Control' && product.category_l2 === 'Credentials') {
            qty = randInt(1, 5);
          } else if (pPrice > 500) {
            qty = randInt(1, 2);
          } else if (pPrice > 100) {
            qty = randInt(1, 6);
          } else {
            qty = randInt(1, 10);
          }

          // Volume discount: ±5% from standard price
          const discount = randBetween(0.95, 1.00);
          const unitPrice = parseFloat((pPrice * discount).toFixed(2));
          const lineTotal = parseFloat((qty * unitPrice).toFixed(2));
          const lineCost = parseFloat((qty * pCost).toFixed(2));

          subtotal += lineTotal;
          totalCost += lineCost;

          thisOrderLines.push({
            line_id: lineId++,
            order_id: orderId,
            line_number: ln + 1,
            product_id: product.product_id,
            quantity: qty,
            unit_price: unitPrice.toFixed(2),
            unit_cost: pCost.toFixed(2),
            line_total: lineTotal.toFixed(2),
            line_cost: lineCost.toFixed(2)
          });
        }

        subtotal = parseFloat(subtotal.toFixed(2));
        totalCost = parseFloat(totalCost.toFixed(2));

        // Tax: state-based rates
        const taxRates = { PA: 0.06, NJ: 0.06625, MD: 0.06, VA: 0.053, DE: 0, DC: 0.06 };
        const taxRate = taxRates[customer.state] || 0.06;
        const tax = parseFloat((subtotal * taxRate).toFixed(2));

        // Freight: based on order size
        let freight;
        if (subtotal < 500) {
          freight = parseFloat(randBetween(12, 35).toFixed(2));
        } else if (subtotal < 2000) {
          freight = parseFloat(randBetween(25, 65).toFixed(2));
        } else if (subtotal < 5000) {
          freight = parseFloat(randBetween(45, 120).toFixed(2));
        } else {
          freight = parseFloat(randBetween(75, 200).toFixed(2));
        }

        const total = parseFloat((subtotal + tax + freight).toFixed(2));
        const margin = parseFloat(((subtotal - totalCost) / subtotal).toFixed(4));

        // Order status
        let status;
        const orderAge = (new Date(2025, 0, 1) - orderDate) / (1000 * 60 * 60 * 24);
        if (seededRandom() < 0.02) {
          status = 'CANCELLED';
        } else if (orderAge < 14) {
          status = seededRandom() < 0.5 ? 'PENDING' : 'SHIPPED';
        } else if (orderAge < 30) {
          status = seededRandom() < 0.3 ? 'SHIPPED' : 'DELIVERED';
        } else {
          status = 'DELIVERED';
        }

        // Payment status
        let paymentStatus;
        if (status === 'CANCELLED') {
          paymentStatus = 'UNPAID';
        } else if (orderAge > 60) {
          const r = seededRandom();
          if (r < 0.85) paymentStatus = 'PAID';
          else if (r < 0.93) paymentStatus = 'PAID';
          else if (r < 0.97) paymentStatus = 'OVERDUE';
          else paymentStatus = 'PARTIAL';
        } else if (orderAge > 30) {
          const r = seededRandom();
          if (r < 0.70) paymentStatus = 'PAID';
          else if (r < 0.85) paymentStatus = 'UNPAID';
          else if (r < 0.95) paymentStatus = 'PARTIAL';
          else paymentStatus = 'OVERDUE';
        } else {
          const r = seededRandom();
          if (r < 0.30) paymentStatus = 'PAID';
          else if (r < 0.80) paymentStatus = 'UNPAID';
          else paymentStatus = 'PARTIAL';
        }

        // PO Number
        const poNumber = `PO-${customer.account_number.replace('KSD-','')}-${String(randInt(1000, 9999))}`;

        orderSeqByMonth[monthKey]++;
        const orderNumber = `ORD-${monthKey}-${String(orderSeqByMonth[monthKey]).padStart(5, '0')}`;

        orders.push({
          order_id: orderId,
          order_number: orderNumber,
          customer_id: customer.customer_id,
          order_date: formatDate(orderDate),
          ship_date: formatDate(shipDate),
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          freight: freight.toFixed(2),
          total: total.toFixed(2),
          total_cost: totalCost.toFixed(2),
          margin: margin,
          status,
          payment_status: paymentStatus,
          po_number: poNumber
        });

        orderLines.push(...thisOrderLines);
        orderId++;
      }
    }
  }

  // Write orders
  writeCSV('orders.csv', [
    'order_id','order_number','customer_id','order_date','ship_date',
    'subtotal','tax','freight','total','total_cost','margin',
    'status','payment_status','po_number'
  ], orders);

  // Write order lines
  writeCSV('order_lines.csv', [
    'line_id','order_id','line_number','product_id','quantity',
    'unit_price','unit_cost','line_total','line_cost'
  ], orderLines);

  // Validate
  const y1Orders = orders.filter(o => o.order_date.startsWith('2023'));
  const y2Orders = orders.filter(o => o.order_date.startsWith('2024'));
  const y1Revenue = y1Orders.reduce((s, o) => s + parseFloat(o.total), 0);
  const y2Revenue = y2Orders.reduce((s, o) => s + parseFloat(o.total), 0);
  const avgLinesPerOrder = orderLines.length / orders.length;

  console.log(`  Total orders: ${orders.length}`);
  console.log(`    Year 1 (2023): ${y1Orders.length} orders, $${(y1Revenue/1e6).toFixed(2)}M revenue`);
  console.log(`    Year 2 (2024): ${y2Orders.length} orders, $${(y2Revenue/1e6).toFixed(2)}M revenue`);
  console.log(`    YoY growth: ${((y2Revenue/y1Revenue - 1) * 100).toFixed(1)}%`);
  console.log(`  Total order lines: ${orderLines.length}`);
  console.log(`  Avg lines per order: ${avgLinesPerOrder.toFixed(2)}`);

  // Monthly breakdown
  console.log('\n  Monthly order counts:');
  const monthlyCounts = {};
  for (const o of orders) {
    const ym = o.order_date.substring(0, 7);
    monthlyCounts[ym] = (monthlyCounts[ym] || 0) + 1;
  }
  for (const [ym, count] of Object.entries(monthlyCounts).sort()) {
    console.log(`    ${ym}: ${count} orders`);
  }

  return { orders, orderLines };
}

// ============================================================================
// PART 4: SUMMARY.JSON
// ============================================================================

function generateSummary(products, customers, orders, orderLines) {
  console.log('\n=== Generating summary.json ===');

  // Revenue by month
  const revenueByMonth = {};
  for (const o of orders) {
    const ym = o.order_date.substring(0, 7);
    if (!revenueByMonth[ym]) revenueByMonth[ym] = { month: ym, revenue: 0, orders: 0, cost: 0 };
    revenueByMonth[ym].revenue += parseFloat(o.total);
    revenueByMonth[ym].cost += parseFloat(o.total_cost);
    revenueByMonth[ym].orders += 1;
  }
  const monthlyRevenue = Object.values(revenueByMonth).sort((a, b) => a.month.localeCompare(b.month));
  monthlyRevenue.forEach(m => {
    m.revenue = parseFloat(m.revenue.toFixed(2));
    m.cost = parseFloat(m.cost.toFixed(2));
    m.margin = parseFloat(((m.revenue - m.cost) / m.revenue).toFixed(4));
  });

  // Revenue by category
  const productMap = {};
  for (const p of products) {
    productMap[p.product_id] = p;
  }
  const revenueByCategory = {};
  for (const ol of orderLines) {
    const product = productMap[ol.product_id];
    if (!product) continue;
    const cat = product.category_l1;
    if (!revenueByCategory[cat]) revenueByCategory[cat] = { category: cat, revenue: 0, cost: 0, units: 0 };
    revenueByCategory[cat].revenue += parseFloat(ol.line_total);
    revenueByCategory[cat].cost += parseFloat(ol.line_cost);
    revenueByCategory[cat].units += ol.quantity;
  }
  const categoryRevenue = Object.values(revenueByCategory).sort((a, b) => b.revenue - a.revenue);
  categoryRevenue.forEach(c => {
    c.revenue = parseFloat(c.revenue.toFixed(2));
    c.cost = parseFloat(c.cost.toFixed(2));
    c.margin = parseFloat(((c.revenue - c.cost) / c.revenue).toFixed(4));
  });

  // Customer count by type
  const customersByType = {};
  for (const c of customers) {
    customersByType[c.customer_type] = (customersByType[c.customer_type] || 0) + 1;
  }

  // Top 10 products by revenue
  const productRevenue = {};
  for (const ol of orderLines) {
    if (!productRevenue[ol.product_id]) productRevenue[ol.product_id] = { product_id: ol.product_id, revenue: 0, units: 0, orders: 0 };
    productRevenue[ol.product_id].revenue += parseFloat(ol.line_total);
    productRevenue[ol.product_id].units += ol.quantity;
    productRevenue[ol.product_id].orders += 1;
  }
  const top10Products = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(pr => {
      const p = productMap[pr.product_id];
      return {
        product_id: pr.product_id,
        sku: p ? p.sku : 'N/A',
        name: p ? p.name : 'N/A',
        category: p ? p.category_l1 : 'N/A',
        revenue: parseFloat(pr.revenue.toFixed(2)),
        units_sold: pr.units,
        order_count: pr.orders
      };
    });

  // Overall metrics
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total), 0);
  const totalCost = orders.reduce((s, o) => s + parseFloat(o.total_cost), 0);
  const y1Rev = orders.filter(o => o.order_date.startsWith('2023')).reduce((s, o) => s + parseFloat(o.total), 0);
  const y2Rev = orders.filter(o => o.order_date.startsWith('2024')).reduce((s, o) => s + parseFloat(o.total), 0);
  const y3Rev = orders.filter(o => o.order_date.startsWith('2025')).reduce((s, o) => s + parseFloat(o.total), 0);

  // Customer revenue ranking
  const customerRevenue = {};
  for (const o of orders) {
    if (!customerRevenue[o.customer_id]) customerRevenue[o.customer_id] = { customer_id: o.customer_id, revenue: 0, orders: 0 };
    customerRevenue[o.customer_id].revenue += parseFloat(o.total);
    customerRevenue[o.customer_id].orders += 1;
  }
  const top10Customers = Object.values(customerRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(cr => {
      const c = customers.find(cu => cu.customer_id === cr.customer_id);
      return {
        customer_id: cr.customer_id,
        company_name: c ? c.company_name : 'N/A',
        customer_type: c ? c.customer_type : 'N/A',
        revenue: parseFloat(cr.revenue.toFixed(2)),
        order_count: cr.orders
      };
    });

  // Margin by category
  const marginByCategory = categoryRevenue.map(c => ({
    category: c.category,
    avg_margin: c.margin,
    revenue: c.revenue,
    cost: c.cost
  }));

  // State distribution
  const stateDistribution = {};
  for (const c of customers) {
    stateDistribution[c.state] = (stateDistribution[c.state] || 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    company: 'Keystone Security Distribution',
    data_period: { start: '2023-01-01', end: '2025-12-31' },
    record_counts: {
      products: products.length,
      customers: customers.length,
      orders: orders.length,
      order_lines: orderLines.length
    },
    overall_metrics: {
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_cost: parseFloat(totalCost.toFixed(2)),
      overall_margin: parseFloat(((totalRevenue - totalCost) / totalRevenue).toFixed(4)),
      year1_revenue: parseFloat(y1Rev.toFixed(2)),
      year2_revenue: parseFloat(y2Rev.toFixed(2)),
      year3_revenue: parseFloat(y3Rev.toFixed(2)),
      yoy_growth: parseFloat(((y3Rev / y2Rev - 1) * 100).toFixed(1)),
      avg_order_value: parseFloat((totalRevenue / orders.length).toFixed(2)),
      avg_lines_per_order: parseFloat((orderLines.length / orders.length).toFixed(2))
    },
    revenue_by_month: monthlyRevenue,
    revenue_by_category: categoryRevenue,
    margin_by_category: marginByCategory,
    customers_by_type: customersByType,
    customers_by_state: stateDistribution,
    top_10_products: top10Products,
    top_10_customers: top10Customers
  };

  const outPath = path.join(DATA_DIR, 'summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`  Wrote summary.json`);
  console.log(`  Total revenue: $${(totalRevenue / 1e6).toFixed(2)}M`);
  console.log(`  Overall margin: ${((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1)}%`);
  console.log(`  Y3 revenue: $${(y3Rev / 1e6).toFixed(2)}M`);
  console.log(`  YoY growth (Y2→Y3): ${((y3Rev / y2Rev - 1) * 100).toFixed(1)}%`);

  return summary;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('====================================================');
console.log('Keystone Security Distribution - Data Generator');
console.log('====================================================');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const products = generateProducts();
const customers = generateCustomers();
const { orders, orderLines } = generateOrders(customers, products);
const summary = generateSummary(products, customers, orders, orderLines);

console.log('\n====================================================');
console.log('DATA GENERATION COMPLETE');
console.log('====================================================');
console.log(`Products:    ${products.length}`);
console.log(`Customers:   ${customers.length}`);
console.log(`Orders:      ${orders.length}`);
console.log(`Order Lines: ${orderLines.length}`);
console.log('====================================================');
