const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'..','public','data');
if(!fs.existsSync(D))fs.mkdirSync(D,{recursive:true});
let seed=42;
function sr(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
function rb(a,b){return a+sr()*(b-a)}
function ri(a,b){return Math.floor(rb(a,b+1))}
function pk(a){return a[Math.floor(sr()*a.length)]}
function wp(items,weights){let t=weights.reduce((a,b)=>a+b,0),r2=sr()*t;for(let i=0;i<items.length;i++){r2-=weights[i];if(r2<=0)return items[i]}return items[items.length-1]}
function esc(v){if(v==null)return'';const t=String(v);return(t.includes(',')||t.includes('"')||t.includes('\n'))?'"'+t.replace(/"/g,'""')+'"':t}
function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function addBD(date,days){const r=new Date(date);let a=0;while(a<days){r.setDate(r.getDate()+1);if(r.getDay()!==0&&r.getDay()!==6)a++}return r}
function dim(y,m){return new Date(y,m,0).getDate()}

// ── PRODUCTS ──
const CATS=[
{l1:'Residential Locks',l2:'Deadbolts',c:'RES-DBL',mn:.28,mx:.32,pn:25,px:120,mf:['Schlage','Kwikset','Yale','Weiser','Falcon'],ns:['Single Cylinder Deadbolt - Satin Nickel','Single Cylinder Deadbolt - Aged Bronze','Single Cylinder Deadbolt - Matte Black','Single Cylinder Deadbolt - Polished Brass','Double Cylinder Deadbolt - Satin Nickel','Double Cylinder Deadbolt - Aged Bronze','Double Cylinder Deadbolt - Polished Chrome','Single Cylinder Deadbolt - Bright Chrome','Jimmy-Proof Deadlock - Silver','High Security Deadbolt - Satin Chrome','Grade 1 Deadbolt - Brass','Grade 2 Deadbolt - Satin Nickel'],u:'EA',q:1},
{l1:'Residential Locks',l2:'Entry Knobs',c:'RES-KNB',mn:.28,mx:.32,pn:15,px:85,mf:['Schlage','Kwikset','Yale','Weiser'],ns:['Entry Knob Georgian - Satin Nickel','Entry Knob Georgian - Aged Bronze','Entry Knob Plymouth - Bright Brass','Entry Knob Plymouth - Satin Chrome','Entry Knob Tylo - Satin Nickel','Entry Knob Tylo - Polished Brass','Privacy Knob - Satin Nickel','Privacy Knob - Aged Bronze','Passage Knob - Satin Nickel','Passage Knob - Polished Brass'],u:'EA',q:1},
{l1:'Residential Locks',l2:'Handlesets',c:'RES-HND',mn:.28,mx:.32,pn:75,px:350,mf:['Schlage','Kwikset','Yale','Weiser'],ns:['Handleset Camelot - Satin Nickel','Handleset Camelot - Aged Bronze','Handleset Addison - Bright Chrome','Handleset Addison - Matte Black','Handleset Century - Satin Nickel','Handleset Plymouth - Polished Brass','Handleset Georgian - Satin Nickel','Handleset Brookshire - Aged Bronze','Handleset Arlington - Matte Black','Front Entry Handleset - Satin Chrome'],u:'EA',q:1},
{l1:'Residential Locks',l2:'Smart Locks',c:'RES-SMT',mn:.28,mx:.32,pn:120,px:350,mf:['Schlage','Kwikset','Yale','Alarm Lock'],ns:['Smart Deadbolt Encode Plus - Satin Nickel','Smart Deadbolt Encode Plus - Matte Black','Smart Lock Connect - Aged Bronze','Smart Lock Connect - Satin Chrome','Wi-Fi Smart Lock - Satin Nickel','Wi-Fi Smart Lock - Polished Brass','Bluetooth Smart Lock - Matte Black','Smart Lever with Touchscreen - Satin Nickel','Smart Deadbolt with Camera - Matte Black','Z-Wave Smart Lock - Satin Nickel'],u:'EA',q:1},
{l1:'Residential Locks',l2:'Keypad Locks',c:'RES-KPD',mn:.28,mx:.32,pn:80,px:250,mf:['Schlage','Kwikset','Yale','Alarm Lock'],ns:['Keypad Deadbolt BE365 - Satin Chrome','Keypad Deadbolt BE365 - Aged Bronze','Keypad Lever FE595 - Satin Nickel','Keypad Lever FE595 - Matte Black','Touch Keypad Deadbolt - Satin Nickel','Touch Keypad Deadbolt - Polished Brass','Electronic Keypad Lock - Bright Chrome','Keypad Entry Knob - Satin Nickel'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Cylindrical Locks',c:'COM-CYL',mn:.35,mx:.40,pn:45,px:350,mf:['Schlage','Corbin Russwin','Yale','Sargent','Falcon','Best'],ns:['Cylindrical Lock ND60PD - 626','Cylindrical Lock ND80PD - 626','Cylindrical Lock ND50PD - 613','Cylindrical Lock ND70PD - 626','Cylindrical Lock ND25D - 626','Heavy Duty Cylindrical Lock - 630','Grade 1 Cylindrical Lockset - Classroom','Grade 1 Cylindrical Lockset - Storeroom','Grade 1 Cylindrical Lockset - Office','Grade 2 Cylindrical Lock - Entry'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Mortise Locks',c:'COM-MOR',mn:.35,mx:.40,pn:150,px:800,mf:['Schlage','Corbin Russwin','Yale','Sargent','Marks USA'],ns:['Mortise Lock L9050 - Classroom','Mortise Lock L9060 - Apartment','Mortise Lock L9080 - Storeroom','Mortise Lock L9070 - Classroom','Mortise Lock L9040 - Privacy','Mortise Lock L9092 - Electrified','Mortise Lockset - Office Function','Mortise Lockset - Entry Function','Heavy Duty Mortise Lock - Institutional','Grade 1 Mortise Body - 626'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Exit Devices',c:'COM-EXT',mn:.35,mx:.40,pn:200,px:1500,mf:['Von Duprin','Sargent','Corbin Russwin','Falcon'],ns:['Exit Device 98EO - Rim 36"','Exit Device 98EO - Rim 48"','Exit Device 99EO - SVR 36"','Exit Device 99EO - SVR 48"','Concealed Vertical Rod Device - 36"','Surface Vertical Rod Device - 48"','Rim Exit Device Grade 1 - 36"','Rim Exit Device Grade 1 - 48"','Fire Rated Exit Device - 36"','Motorized Latch Retraction Device','Delayed Egress Exit Device','Exit Alarm Device - 36"'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Door Closers',c:'COM-CLS',mn:.35,mx:.40,pn:35,px:450,mf:['LCN','Norton','Yale','Sargent','Falcon'],ns:['Door Closer 4040XP - Aluminum','Door Closer 4040XP - Dark Bronze','Door Closer 4011 - Regular Arm','Door Closer 4041 - Hold Open Arm','Door Closer 1600 Series - Aluminum','Door Closer 1600 Series - Bronze','Concealed Door Closer - Aluminum','Surface Door Closer - Hold Open','ADA Compliant Door Closer','Heavy Duty Door Closer - Institutional'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Hinges',c:'COM-HNG',mn:.35,mx:.40,pn:25,px:120,mf:['Hager','McKinney','Ives','Stanley'],ns:['Full Mortise Hinge 4.5" x 4.5" - 26D','Full Mortise Hinge 4.5" x 4.5" - US10B','Full Mortise Hinge 4" x 4" - 26D','Full Mortise Hinge 5" x 4.5" - 26D','Spring Hinge 4.5" x 4.5" - 26D','Continuous Hinge 83" - Clear','Pivot Hinge Set - Aluminum','Ball Bearing Hinge 4.5" - 630','Heavy Weight Hinge 5" x 5" - 26D','Electric Hinge 4-Wire - 26D'],u:'EA',q:1},
{l1:'Commercial Hardware',l2:'Thresholds',c:'COM-THR',mn:.35,mx:.40,pn:25,px:180,mf:['Pemko','National Guard','Reese','Zero International'],ns:['Saddle Threshold 36" - Aluminum','Saddle Threshold 48" - Aluminum','ADA Ramp Threshold 36" - Bronze','ADA Ramp Threshold 48" - Aluminum','Thermal Break Threshold 36"','Adjustable Threshold 36"','Bumper Seal Threshold 36"','Heavy Duty Mill Threshold 48"'],u:'EA',q:1},
{l1:'Access Control',l2:'Card Readers',c:'ACC-RDR',mn:.35,mx:.50,pn:80,px:450,mf:['HID Global','Allegion','dormakaba','NAPCO'],ns:['Proximity Reader iCLASS SE - Black','Proximity Reader iCLASS SE - Gray','Multi-Class Reader SE - Black','Proximity Reader R10 - Black','Proximity Reader R40 - Long Range','Mobile-Ready Reader - Bluetooth','Biometric Reader with Card - Black','Mullion Mount Reader - Black','Weatherproof Card Reader - Gray','Smart Card Reader - Contactless'],u:'EA',q:1},
{l1:'Access Control',l2:'Controllers',c:'ACC-CTL',mn:.35,mx:.50,pn:200,px:1500,mf:['HID Global','Allegion','NAPCO','dormakaba'],ns:['Access Controller 2-Door - IP','Access Controller 4-Door - IP','Access Controller 8-Door - IP','Single Door Controller - PoE','Elevator Controller - 16 Floor','Network Access Panel - 2 Reader','Access Control Board - 4 Reader','Wireless Lock Controller','Edge Controller - Single Door','Cloud-Based Controller Module'],u:'EA',q:1},
{l1:'Access Control',l2:'Credentials',c:'ACC-CRD',mn:.35,mx:.50,pn:50,px:300,mf:['HID Global','Allegion','dormakaba'],ns:['Proximity Cards iCLASS - 100 Pack','Proximity Cards HID 1326 - 100 Pack','Smart Cards SEOS - 50 Pack','Key Fobs iCLASS - 50 Pack','Key Fobs Prox - 100 Pack','Wristband Credentials - 25 Pack','Mobile Credential License - 100 Pack','Clamshell Cards 125kHz - 100 Pack'],u:'PK',q:1},
{l1:'Access Control',l2:'Electric Strikes',c:'ACC-STR',mn:.35,mx:.50,pn:50,px:350,mf:['HES','Von Duprin','Securitron','Folger Adam'],ns:['Electric Strike 1006 - 12/24VDC','Electric Strike 1006 - Fail Secure','Electric Strike 1006 - Fail Safe','Electric Strike 9600 - 12/24VDC','Heavy Duty Electric Strike - Mortise','Fire Rated Electric Strike','Electric Strike for Rim Device','Compact Electric Strike - 12VDC','Surface Mount Electric Strike','Electric Release - Cylindrical Lock'],u:'EA',q:1},
{l1:'Access Control',l2:'Maglocks',c:'ACC-MAG',mn:.35,mx:.50,pn:75,px:400,mf:['Securitron','Dortronics','DynaLock','Alarm Lock'],ns:['Maglock 600 lb - Single Door','Maglock 1200 lb - Single Door','Maglock 600 lb - Double Door','Maglock 1200 lb - Double Door','Shear Lock 2000 lb','Mini Maglock 300 lb - Surface','Gate Maglock - 1200 lb Outdoor','Maglock with LED Status'],u:'EA',q:1},
{l1:'Access Control',l2:'Keypad Locks',c:'ACC-KPD',mn:.35,mx:.50,pn:150,px:800,mf:['Alarm Lock','Kaba','Schlage','dormakaba'],ns:['Trilogy T2 DL2700 - 26D','Trilogy T2 DL2700 - US10B','Trilogy T3 DL6100 - 26D','Networked Keypad Lock - Wireless','Standalone Keypad Lock - Battery','Heavy Duty Keypad Lever - 626','Keypad Lock with Audit Trail','Pushbutton Lock - Mechanical'],u:'EA',q:1},
{l1:'Automotive',l2:'Transponder Keys',c:'AUT-TRN',mn:.40,mx:.45,pn:5,px:45,mf:['Ilco','JMA USA','Keyline','Strattec'],ns:['Transponder Key Toyota - TOY44D-PT','Transponder Key Honda - HD111-PT','Transponder Key Ford - H92-PT','Transponder Key Chevy - B111-PT','Transponder Key Nissan - NI04-PT','Transponder Key Chrysler - Y159-PT','Transponder Key BMW - BM3-PT','Transponder Key Mercedes - HU64-PT','Transponder Key Hyundai - HY18-PT','Transponder Key Kia - KK10-PT','High Security Key VW - HU66-PT','Transponder Key Subaru - SUB44-PT','Transponder Key Lexus - TOY48-PT','Transponder Key Jeep - Y160-PT'],u:'EA',q:5},
{l1:'Automotive',l2:'Programming Tools',c:'AUT-PRG',mn:.40,mx:.45,pn:350,px:2500,mf:['Autel','Xtool','Advanced Diagnostics','Silca'],ns:['Key Programmer IM608 Pro','Key Programmer IM508 Pro','Smart Pro Key Programmer','Key Programming Device RW4 Plus','EEPROM Programming Tool','Universal Key Programmer','OBD Key Programmer - Basic','Key Machine with Programmer Combo'],u:'EA',q:1},
{l1:'Automotive',l2:'Lockout Tools',c:'AUT-LOT',mn:.40,mx:.45,pn:15,px:250,mf:['Lishi','SouthOrd','Pro-Lok','Access Tools'],ns:['Slim Jim Set - Universal','Long Reach Tool Kit','Air Wedge - Large','Air Wedge - Small','Jiffy Jak Lockout Kit','Quick Entry Tool Set','Under Door Tool','Car Opening Tool Set - 12 Piece'],u:'EA',q:1},
{l1:'Automotive',l2:'Remotes & Fobs',c:'AUT-RMT',mn:.40,mx:.45,pn:15,px:120,mf:['Ilco','JMA USA','Keyline','Strattec'],ns:['Remote Head Key Toyota - 4 Button','Remote Head Key Honda - 3 Button','Remote Head Key Ford - 4 Button','Smart Key Prox Nissan - 4 Button','Smart Key Prox Toyota - 4 Button','Keyless Remote Chevy - 4 Button','Flip Key Remote VW - 4 Button','Smart Key Prox Honda - 4 Button','Remote Fob Chrysler - 4 Button','Smart Key Prox Hyundai - 4 Button'],u:'EA',q:1},
{l1:'Safes & Security',l2:'Residential Safes',c:'SAF-RES',mn:.38,mx:.42,pn:150,px:900,mf:['Liberty Safe','AMSEC','Gardall','Hollon'],ns:['Home Safe HD-100 - Digital','Home Safe HD-200 - Digital','Fire Safe F-1212 - 30 Min','Fire Safe F-2014 - 60 Min','Wall Safe WS-1014 - Biometric','Floor Safe B-1500 - Dial','Jewelry Safe JS-200 - Digital','Personal Safe PS-100 - Biometric'],u:'EA',q:1},
{l1:'Safes & Security',l2:'Commercial Safes',c:'SAF-COM',mn:.38,mx:.42,pn:500,px:3500,mf:['AMSEC','Gardall','Hollon','Liberty Safe'],ns:['Commercial Safe BF3416 - Fire Rated','Commercial Safe BF5024 - TL15','Burglar Safe TL-15 - Class B','Burglar Safe TL-30 - Class C','High Security Safe - GSA Rated','Office Safe OS-200 - Digital','Commercial Wall Safe CWS-2014','Record Safe RS-2418 - 2 Hour'],u:'EA',q:1},
{l1:'Safes & Security',l2:'Gun Safes',c:'SAF-GUN',mn:.38,mx:.42,pn:300,px:3000,mf:['Liberty Safe','AMSEC','Fort Knox','Browning'],ns:['Gun Safe Centurion 12','Gun Safe Centurion 24','Gun Safe Colonial 23','Gun Safe Fatboy Jr 48','Gun Safe USA 36','Handgun Vault - Biometric','Under Bed Gun Safe','Quick Access Gun Safe'],u:'EA',q:1},
{l1:'Safes & Security',l2:'Deposit Safes',c:'SAF-DEP',mn:.38,mx:.42,pn:300,px:2500,mf:['AMSEC','Gardall','Hollon','FireKing'],ns:['Depository Safe DSR-2014 - Front Load','Depository Safe DSR-2814 - Front Load','Depository Safe DSR-3614 - Rear Load','Drop Safe B-Rated - Dual Key','Rotary Deposit Safe - Digital','Through-Wall Depository - Digital'],u:'EA',q:1},
{l1:'Key Machines & Supplies',l2:'Key Machines',c:'KEY-MCH',mn:.20,mx:.25,pn:300,px:10000,mf:['Ilco','Silca','Framon','HPC'],ns:['Key Machine Speed 044 - Manual','Key Machine Speed 046 - Semi-Auto','Key Machine Futura Pro - Laser','Key Machine Ninja Laser','High Security Key Machine','Code Cutting Machine - Electronic','Flat Steel Key Machine','Tubular Key Machine'],u:'EA',q:1},
{l1:'Key Machines & Supplies',l2:'Key Blanks',c:'KEY-BLK',mn:.50,mx:.55,pn:5,px:25,mf:['Ilco','JMA USA','Keyline','Silca'],ns:['Key Blank SC1 - Schlage 5-Pin (50pk)','Key Blank KW1 - Kwikset 5-Pin (50pk)','Key Blank Y1 - Yale 5-Pin (50pk)','Key Blank WR5 - Weiser 5-Pin (50pk)','Key Blank SC4 - Schlage 6-Pin (50pk)','Key Blank KW10 - Kwikset 6-Pin (50pk)','Key Blank CO87 - Corbin (50pk)','Key Blank RU45 - Russwin (50pk)','Key Blank BE2 - Best (50pk)','Key Blank S22 - Sargent (50pk)','High Security Blank Primus (10pk)','High Security Blank Medeco (10pk)','Key Blank AR1 - Arrow (50pk)','Key Blank FA2 - Falcon (50pk)','Key Blank YH49 - Yale Hotel (50pk)'],u:'PK',q:1},
{l1:'Key Machines & Supplies',l2:'Pinning Kits',c:'KEY-PIN',mn:.50,mx:.55,pn:25,px:200,mf:['LAB','A-1 Security','Schlage','Kwikset'],ns:['Universal Pinning Kit .003 - LAB','Schlage Pinning Kit - Bottom Pins','Kwikset Pinning Kit - Bottom Pins','Corbin Russwin Repin Kit','Master Keying Pin Kit - Universal','IC Core Repin Kit','Top Pin Assortment Kit','Spring Assortment Kit'],u:'KIT',q:1},
{l1:'Key Machines & Supplies',l2:'Lubricants',c:'KEY-LUB',mn:.50,mx:.55,pn:5,px:30,mf:['Houdini','Tri-Flow','CRC','WD-40 Specialist'],ns:['Lock Lubricant Spray - 3oz','Graphite Lubricant - 1.5oz','Teflon Lubricant Spray - 4oz','Penetrating Oil - 8oz','Lock De-Icer Spray - 3oz','Silicone Spray - 4oz'],u:'EA',q:6},
{l1:'Key Machines & Supplies',l2:'Tools',c:'KEY-TLS',mn:.50,mx:.55,pn:10,px:400,mf:['HPC','SouthOrd','Peterson','A-1 Security'],ns:['Pick Set - 14 Piece Slimline','Pick Set - 22 Piece Professional','Plug Follower Set - 7 Piece','Cylinder Cap Remover Set','Pin Tweezer Kit','Shim Set - Assorted','Mortise Cylinder Tool Kit','IC Core Removal Tool','Key Gauge - Schlage/Kwikset','Door Viewer Installation Kit'],u:'EA',q:1}
];

// Generate products
const products=[];let pid=1;
for(const cat of CATS){for(let i=0;i<cat.ns.length;i++){
const price=+(rb(cat.pn,cat.px).toFixed(2));
const margin=rb(cat.mn,cat.mx);
const cost=+(price*(1-margin)).toFixed(2);
const msrp=+(price*rb(1.3,1.6)).toFixed(2);
products.push({id:pid,sku:`${cat.c}-${String(i+1).padStart(3,'0')}`,name:cat.ns[i],mfr:pk(cat.mf),l1:cat.l1,l2:cat.l2,cost,price,msrp,uom:cat.u,moq:cat.q,status:sr()<0.95?'ACTIVE':'DISCONTINUED'});pid++}}
fs.writeFileSync(path.join(D,'products.csv'),'product_id,sku,name,manufacturer,category_l1,category_l2,cost,price,msrp,uom,min_order_qty,status\n'+products.map(p=>[p.id,p.sku,esc(p.name),esc(p.mfr),esc(p.l1),esc(p.l2),p.cost.toFixed(2),p.price.toFixed(2),p.msrp.toFixed(2),p.uom,p.moq,p.status].join(',')).join('\n')+'\n');
console.log('products.csv:',products.length,'rows');

// ── CUSTOMERS ──
const SG={PA:{w:.35,c:[{n:'Philadelphia',w:.45,z:['19101','19102','19103','19104','19106']},{n:'Pittsburgh',w:.20,z:['15201','15206','15213','15219','15222']},{n:'Allentown',w:.10,z:['18101','18102','18103']},{n:'Reading',w:.08,z:['19601','19602','19604']},{n:'Lancaster',w:.07,z:['17601','17602','17603']},{n:'King of Prussia',w:.05,z:['19406']},{n:'Harrisburg',w:.05,z:['17101','17102','17103']}]},NJ:{w:.28,c:[{n:'Newark',w:.20,z:['07101','07102','07103']},{n:'Jersey City',w:.18,z:['07302','07304','07306']},{n:'Trenton',w:.12,z:['08608','08609','08610']},{n:'Camden',w:.10,z:['08101','08102','08103']},{n:'Cherry Hill',w:.15,z:['08002','08003','08034']},{n:'Edison',w:.12,z:['08817','08818','08820']},{n:'Paterson',w:.13,z:['07501','07502','07503']}]},MD:{w:.17,c:[{n:'Baltimore',w:.50,z:['21201','21202','21205','21206','21207']},{n:'Silver Spring',w:.15,z:['20901','20902','20903']},{n:'Rockville',w:.12,z:['20850','20851','20852']},{n:'Columbia',w:.13,z:['21044','21045','21046']},{n:'Bethesda',w:.10,z:['20814','20816','20817']}]},VA:{w:.12,c:[{n:'Arlington',w:.20,z:['22201','22202','22203']},{n:'Alexandria',w:.20,z:['22301','22302','22304']},{n:'Richmond',w:.25,z:['23219','23220','23221']},{n:'Norfolk',w:.15,z:['23501','23502','23503']},{n:'Virginia Beach',w:.20,z:['23451','23452','23453']}]},DE:{w:.05,c:[{n:'Wilmington',w:.65,z:['19801','19802','19803']},{n:'Dover',w:.20,z:['19901','19904']},{n:'Newark',w:.15,z:['19711','19713']}]},DC:{w:.03,c:[{n:'Washington',w:1.0,z:['20001','20002','20003','20004','20005','20006']}]}};
const CT={LSH:{cnt:68,np:['{c} Locksmith','{c} Lock & Key','{l} Lock Service','{l} Locksmith','All-Pro Locksmith {c}','{c} Safe & Lock','Quick Key Locksmith','{l} Security & Lock','AAA Locksmith {c}','Master Key Locksmith','{c} Lock Shop','Elite Locksmith Services','Premier Lock & Safe','{l} Lock & Safe','Affordable Locksmith {c}','Express Lock Service','Metro Locksmith {c}','A-1 Locksmith {c}'],crMin:5000,crMax:50000,pt:['NET30','NET30','NET30','NET15','COD']},INT:{cnt:45,np:['{c} Security Systems','{l} Integration Group','{c} Access Solutions','{l} Security Technologies','Integrated Security {c}','SecureTech Solutions','{l} & Associates Security','ProGuard Systems {c}','Total Security Integration','Sentinel Security Systems','{c} Security Integrators','Advanced Access Systems','Shield Security Group','{l} Security Corp','Guardian Integration Services'],crMin:25000,crMax:200000,pt:['NET30','NET30','NET45','NET45','NET15']},PMG:{cnt:22,np:['{c} Property Management','{l} Property Group','Metro Properties {c}','{l} Real Estate Management','{c} Residential Management','Premier Property Services','Keystone Property Management','{l} Management Corp','Summit Property Group','Horizon Property Services','{c} Commercial Properties'],crMin:10000,crMax:75000,pt:['NET30','NET30','NET45','NET15']},RET:{cnt:15,np:['{c} Hardware','{l} Hardware & Supply','True Value {c}','{c} Home Center','Ace Hardware {c}','{l} Building Supply','Do It Best {c}','{c} Home & Garden','Pro Hardware {c}','{l} Supply Company'],crMin:10000,crMax:100000,pt:['NET30','NET30','NET15','NET45']}};
const LN=['Anderson','Baker','Campbell','Davis','Edwards','Franklin','Garcia','Harris','Johnson','Kelly','Lewis','Mitchell','Nelson','Owens','Parker','Quinn','Roberts','Smith','Taylor','Underwood','Vargas','Williams','Young','Zhang','Brennan','Collins','Donovan','Evans','Fleming','Grant','Hayes','Irwin','Jenkins','Kemp','Lopez','Morgan','Nash','Patel','Reed','Sullivan','Thompson','Walsh','York','Martinez','Rivera','Chen','Kim','Nguyen','Brown','Wilson','Moore','Jackson','Martin','Lee','Clark','Robinson','Hall','Allen','Scott','King','Wright','Green','Adams','Hill','Turner','Phillips','Stewart','Sanchez','Morris','Rogers','Cooper','Peterson','Bailey','Howard','Ward','Cox','Diaz','Richardson'];
const FN=['James','Michael','Robert','David','John','William','Richard','Thomas','Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Jennifer','Linda','Patricia','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen','Nancy','Lisa','Betty','Margaret','Sandra','Ashley','Angela','Maria','Melissa','Stephanie','Nicole','Amanda','Catherine'];
const ST=['Main St','Market St','Oak Ave','Elm St','Broad St','Pine St','Cedar Ln','Walnut St','Chestnut St','Spring Garden St','Lancaster Ave','Baltimore Pike','Ridge Rd','Commerce Dr','Industrial Blvd','Washington Ave','Lincoln Hwy','Liberty St','Union Ave','Park Ave','Mill Rd','Bridge St','Front St','Water St','Vine St'];
const states=Object.keys(SG),stW=states.map(s=>SG[s].w);
const customers=[];let cid=1;const usedN=new Set();
for(const[type,cfg] of Object.entries(CT)){for(let i=0;i<cfg.cnt;i++){
const st=wp(states,stW);const geo=SG[st];const cNs=geo.c.map(x=>x.n),cWs=geo.c.map(x=>x.w);
const ci=cNs.indexOf(wp(cNs,cWs));const city=geo.c[ci].n;const zip=pk(geo.c[ci].z);
let cn,att=0;do{cn=pk(cfg.np).replace('{c}',city).replace('{l}',pk(LN));att++;if(att>40)cn+=` ${cid}`}while(usedN.has(cn)&&att<=40);usedN.add(cn);
const fn=pk(FN),ln=pk(LN);
const em=`${fn.toLowerCase()}.${ln.toLowerCase()}@${cn.toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,20)}.com`;
const ph=`(${ri(200,999)}) ${ri(200,999)}-${String(ri(0,9999)).padStart(4,'0')}`;
const addr=`${ri(100,9999)} ${pk(ST)}`;
const pt=pk(cfg.pt);const cl=Math.round(rb(cfg.crMin,cfg.crMax)/1000)*1000;
const cy=ri(2015,2022),cm=ri(1,12),cd2=ri(1,28);
const cDate=`${cy}-${String(cm).padStart(2,'0')}-${String(cd2).padStart(2,'0')}`;
customers.push({id:cid,acct:`KSD-${String(cid).padStart(5,'0')}`,name:cn,type,contact:`${fn} ${ln}`,email:em,phone:ph,address:addr,city,state:st,zip,pt,cl,status:sr()<0.95?'ACTIVE':'INACTIVE',created:cDate});cid++}}
fs.writeFileSync(path.join(D,'customers.csv'),'customer_id,account_number,company_name,customer_type,contact_name,email,phone,address,city,state,zip,payment_terms,credit_limit,status,created_date\n'+customers.map(c=>[c.id,c.acct,esc(c.name),c.type,esc(c.contact),c.email,c.phone,esc(c.address),c.city,c.state,c.zip,c.pt,c.cl,c.status,c.created].join(',')).join('\n')+'\n');
console.log('customers.csv:',customers.length,'rows');

// ── ORDERS & ORDER LINES ──
const MS={1:.78,2:.72,3:.92,4:1.08,5:1.15,6:1.22,7:1.18,8:1.16,9:1.10,10:1.05,11:.98,12:.88};
const DW={1:1.35,2:1.25,3:1.10,4:1.00,5:.85,6:.30,0:.15};
const WM=[1.08,1.12,1.05,.88];
const AFF={LSH:{'Residential Locks':.30,'Commercial Hardware':.20,'Access Control':.10,Automotive:.20,'Safes & Security':.05,'Key Machines & Supplies':.15},INT:{'Residential Locks':.05,'Commercial Hardware':.30,'Access Control':.50,Automotive:.02,'Safes & Security':.05,'Key Machines & Supplies':.08},PMG:{'Residential Locks':.45,'Commercial Hardware':.30,'Access Control':.15,Automotive:0,'Safes & Security':.05,'Key Machines & Supplies':.05},RET:{'Residential Locks':.50,'Commercial Hardware':.15,'Access Control':.05,Automotive:.05,'Safes & Security':.10,'Key Machines & Supplies':.15}};
const actCust=customers.filter(c=>c.status==='ACTIVE');
const custByType={LSH:[],INT:[],PMG:[],RET:[]};actCust.forEach(c=>custByType[c.type].push(c));
const prodByL1={};products.filter(p=>p.status==='ACTIVE').forEach(p=>{if(!prodByL1[p.l1])prodByL1[p.l1]=[];prodByL1[p.l1].push(p)});
const smM=Object.values(MS).reduce((a,b)=>a+b,0);
const y1Base=3800/smM,y2Base=4104/smM;
const taxR={PA:.06,NJ:.06625,MD:.06,VA:.053,DE:0,DC:.06};
const orders=[],oLines=[];let oid=1,lid=1;const oSeq={};
for(let yr=2023;yr<=2024;yr++){const mBase=yr===2023?y1Base:y2Base;
for(let mo=1;mo<=12;mo++){const tgt=Math.round(mBase*MS[mo]);const mk=`${yr}${String(mo).padStart(2,'0')}`;oSeq[mk]=oSeq[mk]||0;const dIM=dim(yr,mo);
for(let i=0;i<tgt;i++){
let day=ri(1,dIM),att3=0;
do{day=ri(1,dIM);const td=new Date(yr,mo-1,day);const dw=td.getDay();const wk=day<=7?0:day<=14?1:day<=21?2:3;
if(sr()<(DW[dw]*WM[wk])/(1.35*1.12))break;att3++}while(att3<50);
const od=new Date(yr,mo-1,day);
const tTypes=['LSH','INT','PMG','RET'],tW=[.45,.30,.15,.10];
const ct=wp(tTypes,tW);const cust=pk(custByType[ct]);if(!cust)continue;
const sd2=ri(0,3)===0?new Date(od):addBD(od,ri(0,3));
let nL=1+Math.floor(Math.abs(rb(0,1)+rb(0,1)+rb(0,1))*3);nL=Math.max(1,Math.min(25,nL));
if(sr()<.3)nL=Math.min(25,nL+ri(1,3));if(sr()<.15)nL=Math.min(25,nL+ri(2,5));
const aff=AFF[ct];const aK=Object.keys(aff),aW=Object.values(aff);
let sub=0,tCost=0;const tOL=[];
for(let ln=0;ln<nL;ln++){
let cat=wp(aK,aW);if(!prodByL1[cat]||!prodByL1[cat].length)cat=pk(Object.keys(prodByL1));
const prod=pk(prodByL1[cat]);const pp=prod.price,pc=prod.cost;
let qty;if(prod.l2==='Key Blanks')qty=ri(2,20);else if(prod.l2==='Lubricants')qty=ri(6,24);else if(prod.l2==='Transponder Keys')qty=ri(5,50);else if(prod.l2==='Credentials')qty=ri(1,10);else if(pp>500)qty=ri(1,3);else if(pp>100)qty=ri(1,10);else qty=ri(1,20);
const up=+((pp*rb(.95,1.0)).toFixed(2));const lt=+(qty*up).toFixed(2);const lc=+(qty*pc).toFixed(2);
sub+=lt;tCost+=lc;
tOL.push({lid:lid++,oid,ln:ln+1,pid:prod.id,qty,up:up.toFixed(2),uc:pc.toFixed(2),lt:lt.toFixed(2),lc:lc.toFixed(2)})}
sub=+sub.toFixed(2);tCost=+tCost.toFixed(2);
const tx=+(sub*((taxR[cust.state])||.06)).toFixed(2);
let fr;if(sub<500)fr=+rb(12,35).toFixed(2);else if(sub<2000)fr=+rb(25,65).toFixed(2);else if(sub<5000)fr=+rb(45,120).toFixed(2);else fr=+rb(75,200).toFixed(2);
const tot=+(sub+tx+fr).toFixed(2);const mgn=+((sub-tCost)/sub).toFixed(4);
const oAge=(new Date(2025,0,1)-od)/(864e5);
let st2;if(sr()<.02)st2='CANCELLED';else if(oAge<14)st2=sr()<.5?'PENDING':'SHIPPED';else if(oAge<30)st2=sr()<.3?'SHIPPED':'DELIVERED';else st2='DELIVERED';
let ps;if(st2==='CANCELLED')ps='UNPAID';else if(oAge>60){const rv=sr();ps=rv<.90?'PAID':rv<.97?'OVERDUE':'PARTIAL'}else if(oAge>30){const rv=sr();ps=rv<.70?'PAID':rv<.85?'UNPAID':rv<.95?'PARTIAL':'OVERDUE'}else{const rv=sr();ps=rv<.30?'PAID':rv<.80?'UNPAID':'PARTIAL'}
const po=`PO-${cust.acct.replace('KSD-','')}-${ri(1000,9999)}`;
oSeq[mk]++;const on2=`ORD-${mk}-${String(oSeq[mk]).padStart(5,'0')}`;
orders.push({id:oid,on:on2,cid:cust.id,od:fmt(od),sd:fmt(sd2),sub:sub.toFixed(2),tx:tx.toFixed(2),fr:fr.toFixed(2),tot:tot.toFixed(2),tc:tCost.toFixed(2),mgn,st:st2,ps,po});
oLines.push(...tOL);oid++}}}
fs.writeFileSync(path.join(D,'orders.csv'),'order_id,order_number,customer_id,order_date,ship_date,subtotal,tax,freight,total,total_cost,margin,status,payment_status,po_number\n'+orders.map(o=>[o.id,o.on,o.cid,o.od,o.sd,o.sub,o.tx,o.fr,o.tot,o.tc,o.mgn,o.st,o.ps,o.po].join(',')).join('\n')+'\n');
console.log('orders.csv:',orders.length,'rows');
fs.writeFileSync(path.join(D,'order_lines.csv'),'line_id,order_id,line_number,product_id,quantity,unit_price,unit_cost,line_total,line_cost\n'+oLines.map(l=>[l.lid,l.oid,l.ln,l.pid,l.qty,l.up,l.uc,l.lt,l.lc].join(',')).join('\n')+'\n');
console.log('order_lines.csv:',oLines.length,'rows');

// ── SUMMARY ──
const rByM={};orders.forEach(o=>{const ym=o.od.substring(0,7);if(!rByM[ym])rByM[ym]={month:ym,revenue:0,orders:0,cost:0};rByM[ym].revenue+=+o.tot;rByM[ym].cost+=+o.tc;rByM[ym].orders++});
const mRev=Object.values(rByM).sort((a,b)=>a.month.localeCompare(b.month));mRev.forEach(m=>{m.revenue=+m.revenue.toFixed(2);m.cost=+m.cost.toFixed(2);m.margin=+((m.revenue-m.cost)/m.revenue).toFixed(4)});
const pMap={};products.forEach(p=>pMap[p.id]=p);
const rByC={};oLines.forEach(ol=>{const p=pMap[ol.pid];if(!p)return;const c=p.l1;if(!rByC[c])rByC[c]={category:c,revenue:0,cost:0,units:0};rByC[c].revenue+=+ol.lt;rByC[c].cost+=+ol.lc;rByC[c].units+=ol.qty});
const cRev=Object.values(rByC).sort((a,b)=>b.revenue-a.revenue);cRev.forEach(c=>{c.revenue=+c.revenue.toFixed(2);c.cost=+c.cost.toFixed(2);c.margin=+((c.revenue-c.cost)/c.revenue).toFixed(4)});
const cByT={};customers.forEach(c=>{cByT[c.type]=(cByT[c.type]||0)+1});
const pRev={};oLines.forEach(ol=>{if(!pRev[ol.pid])pRev[ol.pid]={pid:ol.pid,rev:0,units:0,ords:0};pRev[ol.pid].rev+=+ol.lt;pRev[ol.pid].units+=ol.qty;pRev[ol.pid].ords++});
const t10P=Object.values(pRev).sort((a,b)=>b.rev-a.rev).slice(0,10).map(pr=>{const p=pMap[pr.pid];return{product_id:pr.pid,sku:p?p.sku:'N/A',name:p?p.name:'N/A',category:p?p.l1:'N/A',revenue:+pr.rev.toFixed(2),units_sold:pr.units,order_count:pr.ords}});
const tRev=orders.reduce((s,o)=>s+(+o.tot),0);const tC=orders.reduce((s,o)=>s+(+o.tc),0);
const y1R=orders.filter(o=>o.od.startsWith('2023')).reduce((s,o)=>s+(+o.tot),0);
const y2R=orders.filter(o=>o.od.startsWith('2024')).reduce((s,o)=>s+(+o.tot),0);
const cRevMap={};orders.forEach(o=>{if(!cRevMap[o.cid])cRevMap[o.cid]={cid:o.cid,rev:0,ords:0};cRevMap[o.cid].rev+=+o.tot;cRevMap[o.cid].ords++});
const t10C=Object.values(cRevMap).sort((a,b)=>b.rev-a.rev).slice(0,10).map(cr=>{const c=customers.find(cu=>cu.id===cr.cid);return{customer_id:cr.cid,company_name:c?c.name:'N/A',customer_type:c?c.type:'N/A',revenue:+cr.rev.toFixed(2),order_count:cr.ords}});
const sByS={};customers.forEach(c=>{sByS[c.state]=(sByS[c.state]||0)+1});
const summary={generated_at:new Date().toISOString(),company:'Keystone Security Distribution',data_period:{start:'2023-01-01',end:'2024-12-31'},record_counts:{products:products.length,customers:customers.length,orders:orders.length,order_lines:oLines.length},overall_metrics:{total_revenue:+tRev.toFixed(2),total_cost:+tC.toFixed(2),overall_margin:+((tRev-tC)/tRev).toFixed(4),year1_revenue:+y1R.toFixed(2),year2_revenue:+y2R.toFixed(2),yoy_growth:+((y2R/y1R-1)*100).toFixed(1),avg_order_value:+(tRev/orders.length).toFixed(2),avg_lines_per_order:+(oLines.length/orders.length).toFixed(2)},revenue_by_month:mRev,revenue_by_category:cRev,margin_by_category:cRev.map(c=>({category:c.category,avg_margin:c.margin,revenue:c.revenue,cost:c.cost})),customers_by_type:cByT,customers_by_state:sByS,top_10_products:t10P,top_10_customers:t10C};
fs.writeFileSync(path.join(D,'summary.json'),JSON.stringify(summary,null,2));
console.log('summary.json written');
console.log('DONE. Revenue: $'+(tRev/1e6).toFixed(2)+'M, YoY: '+((y2R/y1R-1)*100).toFixed(1)+'%');
