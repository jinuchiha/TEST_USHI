// ── Pakistan-specific validation, formatting, scoring ───────────────────────

export const PAKISTAN_PROVINCES = [
  'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
  'Islamabad Capital Territory', 'Azad Kashmir', 'Gilgit-Baltistan',
] as const;

// Major Pakistani mobile prefixes after +92 (Jazz/Telenor/Zong/Ufone/SCOM)
export const PK_MOBILE_PREFIXES = [
  '300', '301', '302', '303', '304', '305', '306', '307', '308', '309', // Jazz
  '310', '311', '312', '313', '314', '315', '316', '317', '318', '319', // Zong
  '320', '321', '322', '323', '324', '325', '326', '327', '328', '329', // Warid (now Jazz)
  '330', '331', '332', '333', '334', '335', '336', '337', '338', '339', // Ufone
  '340', '341', '342', '343', '344', '345', '346', '347', '348', '349', // Telenor
  '355',                                                                  // SCOM (AJK/GB)
];

const OPERATOR_BY_PREFIX: Record<string, string> = {};
for (const p of ['300','301','302','303','304','305','306','307','308','309','320','321','322','323','324','325','326','327','328','329']) OPERATOR_BY_PREFIX[p] = 'Jazz';
for (const p of ['310','311','312','313','314','315','316','317','318','319']) OPERATOR_BY_PREFIX[p] = 'Zong';
for (const p of ['330','331','332','333','334','335','336','337','338','339']) OPERATOR_BY_PREFIX[p] = 'Ufone';
for (const p of ['340','341','342','343','344','345','346','347','348','349']) OPERATOR_BY_PREFIX[p] = 'Telenor';
OPERATOR_BY_PREFIX['355'] = 'SCOM';

// ── CNIC: 13 digits, format XXXXX-XXXXXXX-X ─────────────────────────────────
export function validateCNIC(cnic: string): { valid: boolean; formatted: string; reason?: string } {
  if (!cnic) return { valid: false, formatted: '', reason: 'Empty' };
  const digits = cnic.replace(/\D/g, '');
  if (digits.length !== 13) return { valid: false, formatted: digits, reason: `Need 13 digits, got ${digits.length}` };
  const formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  // First digit indicates province (1=KP, 2=FATA, 3=Punjab, 4=Sindh, 5=Balochistan, 6=ICT, 7=GB, 8=AJK)
  return { valid: true, formatted };
}

export function cnicProvince(cnic: string): string | null {
  const d = cnic.replace(/\D/g, '');
  if (d.length < 1) return null;
  const map: Record<string, string> = {
    '1': 'Khyber Pakhtunkhwa',
    '2': 'FATA (now KP)',
    '3': 'Punjab',
    '4': 'Sindh',
    '5': 'Balochistan',
    '6': 'Islamabad Capital Territory',
    '7': 'Gilgit-Baltistan',
    '8': 'Azad Kashmir',
  };
  return map[d[0]] || null;
}

// ── Phone: +92 3XX XXXXXXX ──────────────────────────────────────────────────
export function validatePakistanPhone(phone: string): { valid: boolean; formatted: string; operator?: string; reason?: string } {
  if (!phone) return { valid: false, formatted: '', reason: 'Empty' };
  let digits = phone.replace(/\D/g, '');
  // Drop leading 92, 0, or 0092
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) return { valid: false, formatted: digits, reason: `Mobile should be 10 digits after country code, got ${digits.length}` };
  if (!digits.startsWith('3')) return { valid: false, formatted: digits, reason: 'Pakistani mobile must start with 3' };

  const prefix = digits.slice(0, 3);
  if (!PK_MOBILE_PREFIXES.includes(prefix)) return { valid: false, formatted: digits, reason: `Unknown prefix ${prefix}` };

  const operator = OPERATOR_BY_PREFIX[prefix];
  return {
    valid: true,
    formatted: `+92 ${prefix} ${digits.slice(3)}`,
    operator,
  };
}

// ── Pakistani address structure ─────────────────────────────────────────────
export interface PakistanAddress {
  houseNo?: string;
  street?: string;
  sector?: string;       // Block / Sector / Phase
  area?: string;         // Town / Area
  city?: string;
  province?: string;
  raw?: string;
}

export function parseAddress(raw: string): PakistanAddress {
  if (!raw) return { raw: '' };
  // Heuristic parser — best effort. In real production, keep raw + structured.
  const out: PakistanAddress = { raw };
  const lower = raw.toLowerCase();
  for (const p of PAKISTAN_PROVINCES) if (lower.includes(p.toLowerCase())) out.province = p;
  // Common cities
  for (const c of ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot', 'Gujranwala', 'Bahawalpur', 'Sargodha', 'Sukkur']) {
    if (lower.includes(c.toLowerCase())) { out.city = c; break; }
  }
  return out;
}

// ── Contactability scoring ──────────────────────────────────────────────────
// 0-100, based on data completeness + recency of successful contact.

export interface ContactabilityInputs {
  hasCnic: boolean;
  cnicValid: boolean;
  pkPhonesCount: number;       // verified Pakistani mobile numbers
  hasAddress: boolean;
  addressVerified: boolean;
  hasFamilyContact: boolean;
  hasEmployer: boolean;
  hasSocialProfile: boolean;
  hasWhatsapp: boolean;
  daysSinceLastSuccessfulContact: number | null;
  failedAttempts: number;
}

export interface ContactabilityResult {
  score: number;
  band: 'reachable' | 'partial' | 'difficult' | 'untraceable';
  factors: { label: string; weight: number; ok: boolean }[];
}

export function scoreContactability(i: ContactabilityInputs): ContactabilityResult {
  const factors: { label: string; weight: number; ok: boolean }[] = [
    { label: 'Valid CNIC on file', weight: 15, ok: i.hasCnic && i.cnicValid },
    { label: '1+ verified Pakistani mobile', weight: 25, ok: i.pkPhonesCount >= 1 },
    { label: '2+ phones (backup)', weight: 8, ok: i.pkPhonesCount >= 2 },
    { label: 'Verified Pakistani address', weight: 12, ok: i.hasAddress && i.addressVerified },
    { label: 'Family/reference contact', weight: 12, ok: i.hasFamilyContact },
    { label: 'Current employer known', weight: 10, ok: i.hasEmployer },
    { label: 'WhatsApp active', weight: 8, ok: i.hasWhatsapp },
    { label: 'Social profile linked', weight: 5, ok: i.hasSocialProfile },
    { label: 'Recent successful contact (≤30d)', weight: 10, ok: i.daysSinceLastSuccessfulContact !== null && i.daysSinceLastSuccessfulContact <= 30 },
  ];
  let score = factors.reduce((s, f) => s + (f.ok ? f.weight : 0), 0);

  // Penalty for repeated failures
  if (i.failedAttempts >= 5) score -= Math.min(20, (i.failedAttempts - 4) * 3);

  score = Math.max(0, Math.min(100, score));

  let band: ContactabilityResult['band'];
  if (score >= 70) band = 'reachable';
  else if (score >= 45) band = 'partial';
  else if (score >= 20) band = 'difficult';
  else band = 'untraceable';

  return { score, band, factors };
}

// ── Pakistani data sources reference ────────────────────────────────────────
export const PK_DATA_SOURCES = [
  { code: 'NADRA', label: 'NADRA — National ID', description: 'CNIC verification, family tree, biometric. Restricted access — official channels only.' },
  { code: 'PTA', label: 'PTA — SIM ownership', description: 'Dial *668# from any Pakistani SIM to see SIMs registered on a CNIC.' },
  { code: 'eCIB', label: 'eCIB — Credit Bureau', description: 'State Bank credit info (banks only). Shows all loans, defaults across PK banks.' },
  { code: 'FBR', label: 'FBR — Active Taxpayer List', description: 'fbr.gov.pk public ATL search by CNIC/NTN.' },
  { code: 'SECP', label: 'SECP — Companies', description: 'Director search at secp.gov.pk — find if debtor owns/runs companies.' },
  { code: 'Land', label: 'Punjab Land Records (PLRA)', description: 'punjab-zameen.gov.pk — property ownership by name/CNIC.' },
  { code: 'ECP', label: 'Election Commission Voter List', description: 'CNIC → registered address (when polls active).' },
  { code: 'Excise', label: 'Excise & Taxation', description: 'Province-wise vehicle registration. Punjab: excise.punjab.gov.pk.' },
  { code: 'Truecaller', label: 'Truecaller / GetContact', description: 'Public caller-ID lookup — name on number.' },
  { code: 'WhatsApp', label: 'WhatsApp profile check', description: 'Save number → see profile pic, last seen, status.' },
  { code: 'LinkedIn', label: 'LinkedIn / Facebook', description: 'Open-source — find current employer, location.' },
];
