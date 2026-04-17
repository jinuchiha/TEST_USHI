import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from './entities/case.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Loan } from '../loans/entities/loan.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Action } from '../actions/entities/action.entity';

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
}

// Known column name variations → our field names
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'case name', 'debtor name', 'customer name', 'borrower', 'full name', 'debtor'],
  accountNumber: ['account no', 'account number', 'acct no', 'acc no', 'account', 'loan no', 'ref no', 'reference'],
  originalAmount: ['original amount', 'loan amount', 'principal', 'original os', 'sanctioned amount', 'disbursed amount'],
  currentBalance: ['remaining os', 'outstanding', 'current balance', 'balance', 'os amount', 'o/s', 'outstanding balance'],
  product: ['product', 'product type', 'loan type', 'facility'],
  subProduct: ['sub-product', 'sub product', 'subproduct', 'category'],
  bank: ['bank', 'bank name', 'lender', 'institution', 'fi name'],
  bucket: ['bucket', 'bucketrecovery', 'bucket recovery', 'dpd bucket', 'aging'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile no', 'tel'],
  email: ['email', 'email address', 'e-mail'],
  eid: ['eid', 'emirates id', 'emirates id number'],
  cnic: ['cnic', 'id card', 'national id'],
  passport: ['passport', 'passport no', 'passport number'],
  currency: ['currency', 'ccy', 'curr'],
  statusCode: ['case status code', 'status code', 'status', 'case status'],
};

@Injectable()
export class CasesImportService {
  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Debtor) private debtorsRepo: Repository<Debtor>,
    @InjectRepository(Loan) private loansRepo: Repository<Loan>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
  ) {}

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

        // Check for duplicate account number
        const existingLoan = await this.loansRepo.findOne({
          where: { accountNumber },
        });
        if (existingLoan) {
          result.errors.push(`Row ${i + 1}: Account ${accountNumber} already exists`);
          result.skipped++;
          continue;
        }

        // Create debtor
        const debtor = await this.debtorsRepo.save(
          this.debtorsRepo.create({
            name,
            phones: row[mapping.phone] ? [row[mapping.phone]] : [],
            emails: row[mapping.email] ? [row[mapping.email]] : [],
            eid: row[mapping.eid] || null,
            cnic: row[mapping.cnic] || null,
            passport: row[mapping.passport] || null,
          }),
        );

        // Create loan
        const loan = await this.loansRepo.save(
          this.loansRepo.create({
            debtorId: debtor.id,
            accountNumber,
            originalAmount: parseFloat(row[mapping.originalAmount] || '0') || 0,
            currentBalance: parseFloat(row[mapping.currentBalance] || '0') || 0,
            product: row[mapping.product] || null,
            subProduct: row[mapping.subProduct] || null,
            bank: row[mapping.bank] || null,
            bucket: row[mapping.bucket] || null,
            currency: (row[mapping.currency] as any) || 'AED',
          }),
        );

        // Create case
        const newCase = await this.casesRepo.save(
          this.casesRepo.create({
            debtorId: debtor.id,
            loanId: loan.id,
            assignedOfficerId,
            crmStatus: 'CB',
            subStatus: '',
            contactStatus: 'Non Contact',
            workStatus: 'Non Work',
            statusCode: row[mapping.statusCode] || 'NEW',
          }),
        );

        // Create initial action
        await this.actionsRepo.save(
          this.actionsRepo.create({
            caseId: newCase.id,
            type: 'Case Created',
            officerId: userId,
            notes: 'Imported from CSV',
          }),
        );

        result.imported++;
      } catch (err: any) {
        result.errors.push(`Row ${i + 1}: ${err.message}`);
        result.skipped++;
      }
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
