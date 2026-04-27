import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from './entities/case.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Loan } from '../loans/entities/loan.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';

/**
 * Bulk Import Service with AI-powered field mapping
 *
 * Accepts CSV data, auto-detects column mapping, creates debtors + loans + cases.
 */

export interface CsvRow {
  [key: string]: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  mapping: Record<string, string>;
  byOfficer?: { officerId: string; officerName: string; count: number }[];
}

// Known column name variations → our field names (case-insensitive match)
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'case name', 'debtor name', 'customer name', 'borrower', 'full name', 'debtor'],
  accountNumber: ['account', 'account no', 'account number', 'acct no', 'acc no', 'loan no', 'ref no', 'reference'],
  originalAmount: ['original amount', 'loan amount', 'principal', 'original os', 'sanctioned amount', 'disbursed amount'],
  currentBalance: ['o/s', 'os', 'remaining os', 'outstanding', 'current balance', 'balance', 'os amount', 'outstanding balance'],
  product: ['product', 'product type', 'loan type', 'facility'],
  subProduct: ['sub product', 'sub-product', 'subproduct', 'category'],
  bank: ['bank', 'bank name', 'lender', 'institution', 'fi name'],
  bucket: ['bucket / recovery', 'bucket', 'bucketrecovery', 'bucket recovery', 'dpd bucket', 'aging'],
  phone: ['number', 'phone', 'mobile', 'contact number', 'phone number', 'mobile no', 'tel', 'cell'],
  email: ['email', 'email address', 'e-mail'],
  eid: ['eid', 'emirates id', 'emirates id number'],
  cnic: ['cnic', 'id card', 'national id'],
  passport: ['passport', 'passport no', 'passport number'],
  currency: ['currency', 'ccy', 'curr'],
  statusCode: ['status code', 'case status code', 'case status'],
  contactStatus: ['contact / non contact', 'contact status'],
  workStatus: ['work / non work', 'work status'],
  crmStatus: ['crm status', 'status'],
  subStatus: ['sub status', 'substatus'],
  tracingStatus: ['tracing status', 'tracing'],
  cyber: ['cyber', 'cyber flag', 'fraud'],
  cif: ['cif', 'customer cif'],
  ica: ['ica', 'ica no', 'ica number', 'ica code'],
  bankCoordinator: ['bank cord', 'bank coordinator', 'bank coord', 'cord', 'coordinator'],
  lpd: ['lpd', 'last payment date'],
  dob: ['dob', 'date of birth', 'birthday'],
  wod: ['wod', 'write off date', 'writeoff'],
  address: ['address', 'street', 'location'],
  date: ['date', 'creation date', 'case date', 'received date'],
  officer: ['officer', 'agent', 'assigned to', 'assigned officer', 'agent code', 'collector', 'rm', 'representative'],
};

// Extra bank-specific columns we'll preserve as JSONB metadata (not lost)
const BANK_META_HEADERS = ['bce', 'tle', 'next iws', 'ko', 'sd', 'uea', 'call status', 'nc'];

@Injectable()
export class CasesImportService {
  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Debtor) private debtorsRepo: Repository<Debtor>,
    @InjectRepository(Loan) private loansRepo: Repository<Loan>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  /** Build officer lookup map: code → user.id, name → user.id (case-insensitive) */
  private async buildOfficerMap(): Promise<Map<string, string>> {
    const officers = await this.usersRepo.find({
      where: [{ role: 'Officer' as any }, { role: 'Manager' as any }],
    });
    const map = new Map<string, string>();
    for (const o of officers) {
      if (o.agentCode) map.set(o.agentCode.toLowerCase().trim(), o.id);
      if (o.name) map.set(o.name.toLowerCase().trim(), o.id);
      if (o.email) map.set(o.email.toLowerCase().trim(), o.id);
      // First name only (e.g. "Aleena Khan" → also matches "aleena")
      const firstName = (o.name || '').split(' ')[0].toLowerCase().trim();
      if (firstName) map.set(firstName, o.id);
    }
    return map;
  }

  /**
   * Auto-detect column mapping from CSV headers
   */
  detectFieldMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      for (const alias of aliases) {
        const idx = normalizedHeaders.findIndex(h => h === alias || h.includes(alias));
        if (idx !== -1) {
          mapping[field] = headers[idx];
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Import cases from parsed CSV rows
   */
  async importCases(
    rows: CsvRow[],
    mapping: Record<string, string>,
    assignedOfficerId: string,
    userId: string,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      mapping,
    };

    // Pre-fetch existing accounts and CNICs for fast dedup
    const existingAccounts = new Set(
      (await this.loansRepo.find({ select: ['accountNumber', 'bank'] }))
        .map(l => `${(l.accountNumber || '').toLowerCase().trim()}|${(l.bank || '').toLowerCase().trim()}`)
    );
    const existingCnics = new Set(
      (await this.debtorsRepo.find({ select: ['cnic'] }))
        .map(d => (d.cnic || '').replace(/\D/g, ''))
        .filter(c => c.length >= 10)
    );

    // Officer lookup (by code, name, email, first name)
    const officerMap = await this.buildOfficerMap();
    const perOfficerCounts = new Map<string, number>();

    // Within-file dedup tracking
    const fileSeenKeys = new Set<string>();
    const fileSeenCnics = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row[mapping.name];
        const accountNumber = row[mapping.accountNumber];

        if (!name || !accountNumber) {
          result.errors.push(`Row ${i + 1}: Missing name or account number`);
          result.skipped++;
          continue;
        }

        const accBank = `${accountNumber.toLowerCase().trim()}|${(row[mapping.bank] || '').toLowerCase().trim()}`;
        const cnicClean = (row[mapping.cnic] || '').replace(/\D/g, '');

        // DB-level dedup: account+bank combo
        if (existingAccounts.has(accBank)) {
          result.errors.push(`Row ${i + 1}: ${name} — Account ${accountNumber} (${row[mapping.bank] || 'no bank'}) already in DB`);
          result.skipped++;
          continue;
        }
        // DB-level dedup: CNIC (looser — only if exists)
        if (cnicClean.length >= 10 && existingCnics.has(cnicClean)) {
          result.errors.push(`Row ${i + 1}: ${name} — CNIC ${cnicClean} already exists in DB (different account)`);
          result.skipped++;
          continue;
        }
        // Within-file dedup
        if (fileSeenKeys.has(accBank)) {
          result.errors.push(`Row ${i + 1}: ${name} — Account ${accountNumber} duplicated within file`);
          result.skipped++;
          continue;
        }
        if (cnicClean.length >= 10 && fileSeenCnics.has(cnicClean)) {
          result.errors.push(`Row ${i + 1}: ${name} — CNIC ${cnicClean} duplicated within file`);
          result.skipped++;
          continue;
        }
        fileSeenKeys.add(accBank);
        if (cnicClean.length >= 10) fileSeenCnics.add(cnicClean);

        // Parse helpers
        const phoneRaw = row[mapping.phone] || '';
        const phones = phoneRaw ? phoneRaw.split(/[,;]/).map(p => p.trim()).filter(Boolean) : [];
        const emailRaw = row[mapping.email] || '';
        const emails = emailRaw ? emailRaw.split(/[,;]/).map(p => p.trim()).filter(Boolean) : [];
        const cleanDate = (s: string): string | null => {
          if (!s) return null;
          // Common formats: dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd, mm/dd/yyyy
          const d = new Date(s.replace(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/, (m, a, b, c) => {
            const yr = c.length === 2 ? '20' + c : c;
            // assume dd-mm-yyyy if first is <=12
            if (parseInt(a) > 12) return `${yr}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
            return `${yr}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
          }));
          return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        };

        // Create debtor
        const debtor = await this.debtorsRepo.save(
          this.debtorsRepo.create({
            name,
            phones,
            emails,
            address: row[mapping.address] || null,
            eid: row[mapping.eid] || null,
            cnic: row[mapping.cnic] || null,
            passport: row[mapping.passport] || null,
            dob: cleanDate(row[mapping.dob]),
          }),
        );

        // Collect bank-specific extra columns into JSONB metadata
        const bankMeta: Record<string, string> = {};
        for (const csvCol of Object.keys(row)) {
          const lower = csvCol.toLowerCase().trim();
          if (BANK_META_HEADERS.some(h => lower === h || lower.includes(h))) {
            if (row[csvCol]) bankMeta[csvCol] = row[csvCol];
          }
        }

        // Create loan
        const loan = await this.loansRepo.save(
          this.loansRepo.create({
            debtorId: debtor.id,
            accountNumber,
            originalAmount: parseFloat((row[mapping.originalAmount] || '0').replace(/[,\s]/g, '')) || 0,
            currentBalance: parseFloat((row[mapping.currentBalance] || '0').replace(/[,\s]/g, '')) || 0,
            product: row[mapping.product] || null,
            subProduct: row[mapping.subProduct] || null,
            bank: row[mapping.bank] || null,
            bucket: row[mapping.bucket] || null,
            currency: (row[mapping.currency] as any) || 'AED',
            cif: row[mapping.cif] || null,
            ica: row[mapping.ica] || null,
            bankCoordinator: row[mapping.bankCoordinator] || null,
            bankMetadata: Object.keys(bankMeta).length > 0 ? bankMeta : null,
            lpd: cleanDate(row[mapping.lpd]),
            wod: cleanDate(row[mapping.wod]),
          }),
        );

        // CRM Status normalization
        const crmStatusRaw = (row[mapping.crmStatus] || 'CB').trim();
        const subStatusRaw = (row[mapping.subStatus] || '').trim();
        const contactRaw = (row[mapping.contactStatus] || '').trim().toLowerCase();
        const workRaw = (row[mapping.workStatus] || '').trim().toLowerCase();

        // Per-row officer assignment from CSV column (if present)
        let rowOfficerId = assignedOfficerId;
        if (mapping.officer && row[mapping.officer]) {
          const officerLookup = row[mapping.officer].toLowerCase().trim();
          const found = officerMap.get(officerLookup);
          if (found) {
            rowOfficerId = found;
          }
          // If not found, leave it as default (assignedOfficerId from dropdown)
        }
        // Track per-officer counts
        perOfficerCounts.set(rowOfficerId, (perOfficerCounts.get(rowOfficerId) || 0) + 1);

        // Create case
        const newCase = await this.casesRepo.save(
          this.casesRepo.create({
            debtorId: debtor.id,
            loanId: loan.id,
            assignedOfficerId: rowOfficerId,
            crmStatus: crmStatusRaw || 'CB',
            subStatus: subStatusRaw,
            contactStatus: contactRaw.includes('non') ? 'Non Contact' : 'Contact',
            workStatus: workRaw.includes('non') ? 'Non Work' : 'Work',
            statusCode: row[mapping.statusCode] || 'NEW',
            tracingStatus: row[mapping.tracingStatus] || null,
            cyber: (row[mapping.cyber] || '').toLowerCase().startsWith('y') ? 'Yes' : 'No',
            creationDate: cleanDate(row[mapping.date]) || new Date().toISOString().split('T')[0],
          }),
        );

        // Create initial action (assigned to the officer who got the case, if available)
        await this.actionsRepo.save(
          this.actionsRepo.create({
            caseId: newCase.id,
            type: 'Case Created',
            officerId: rowOfficerId !== 'unassigned' ? rowOfficerId : userId,
            notes: 'Imported from CSV',
          }),
        );

        result.imported++;
      } catch (err: any) {
        result.errors.push(`Row ${i + 1}: ${err.message}`);
        result.skipped++;
      }
    }

    // Build per-officer breakdown
    if (perOfficerCounts.size > 0) {
      const officerIds = Array.from(perOfficerCounts.keys()).filter(id => id !== 'unassigned');
      const officers = officerIds.length > 0
        ? await this.usersRepo.find({ where: officerIds.map(id => ({ id })) })
        : [];
      const officerNameMap = new Map(officers.map(o => [o.id, o.name]));
      result.byOfficer = Array.from(perOfficerCounts.entries()).map(([id, count]) => ({
        officerId: id,
        officerName: id === 'unassigned' ? 'Unassigned' : officerNameMap.get(id) || 'Unknown',
        count,
      })).sort((a, b) => b.count - a.count);
    }

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        caseId: null,
        details: `Bulk import: ${result.imported} cases imported, ${result.skipped} skipped`,
      }),
    );

    return result;
  }

  /**
   * Parse CSV string into rows
   */
  parseCsv(csvContent: string): { headers: string[]; rows: CsvRow[] } {
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new BadRequestException('CSV must have header + at least 1 row');

    const headers = this.parseCsvLine(lines[0]);
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: CsvRow = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}
