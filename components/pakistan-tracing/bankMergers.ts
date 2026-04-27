// Gulf bank mergers — debtor took loan from original entity which may not exist now.
// Officer needs to know "the debt is from now-merged bank X, today operating as Y".

export interface BankMerger {
  original: string;
  successor: string;
  mergerDate: string;
  country: string;
  notes?: string;
}

export const BANK_MERGERS: BankMerger[] = [
  // Saudi Arabia
  { original: 'National Commercial Bank', successor: 'Saudi National Bank (SNB)', mergerDate: '2021-04-01', country: 'KSA', notes: 'NCB + Samba merged into SNB' },
  { original: 'NCB', successor: 'Saudi National Bank (SNB)', mergerDate: '2021-04-01', country: 'KSA' },
  { original: 'Samba Financial Group', successor: 'Saudi National Bank (SNB)', mergerDate: '2021-04-01', country: 'KSA' },
  { original: 'Samba', successor: 'Saudi National Bank (SNB)', mergerDate: '2021-04-01', country: 'KSA' },
  { original: 'SABB', successor: 'Saudi British Bank (SABB) post-Alawwal merger', mergerDate: '2019-06-16', country: 'KSA', notes: 'SABB + Alawwal merged' },
  { original: 'Alawwal Bank', successor: 'Saudi British Bank (SABB)', mergerDate: '2019-06-16', country: 'KSA' },
  { original: 'Saudi Hollandi Bank', successor: 'Alawwal Bank → SABB', mergerDate: '2016-05-01', country: 'KSA', notes: 'Renamed to Alawwal in 2016, then merged into SABB 2019' },

  // UAE
  { original: 'National Bank of Dubai (NBD)', successor: 'Emirates NBD (ENBD)', mergerDate: '2007-10-16', country: 'UAE', notes: 'NBD + Emirates Bank merged' },
  { original: 'Emirates Bank International', successor: 'Emirates NBD (ENBD)', mergerDate: '2007-10-16', country: 'UAE' },
  { original: 'NBKD', successor: 'Emirates NBD (ENBD)', mergerDate: '2007-10-16', country: 'UAE' },
  { original: 'First Gulf Bank (FGB)', successor: 'First Abu Dhabi Bank (FAB)', mergerDate: '2017-04-01', country: 'UAE', notes: 'FGB + NBAD merged into FAB' },
  { original: 'NBAD', successor: 'First Abu Dhabi Bank (FAB)', mergerDate: '2017-04-01', country: 'UAE' },
  { original: 'National Bank of Abu Dhabi', successor: 'First Abu Dhabi Bank (FAB)', mergerDate: '2017-04-01', country: 'UAE' },
  { original: 'Union National Bank (UNB)', successor: 'Abu Dhabi Commercial Bank (ADCB)', mergerDate: '2019-05-01', country: 'UAE', notes: 'UNB + Al Hilal merged into ADCB' },
  { original: 'Al Hilal Bank', successor: 'Abu Dhabi Commercial Bank (ADCB)', mergerDate: '2019-05-01', country: 'UAE' },
  { original: 'Noor Bank', successor: 'Dubai Islamic Bank (DIB)', mergerDate: '2020-01-01', country: 'UAE', notes: 'Noor Bank merged into DIB' },
  { original: 'Barclays UAE Retail', successor: 'Abu Dhabi Islamic Bank (ADIB)', mergerDate: '2014-04-01', country: 'UAE', notes: 'Barclays sold UAE retail book to ADIB' },

  // Kuwait
  { original: 'Bahrain Islamic Bank', successor: 'Al Salam Bank (Bahrain)', mergerDate: '2020-04-01', country: 'Bahrain' },
  { original: 'Ithmaar Bank Retail', successor: 'Al Salam Bank (Bahrain)', mergerDate: '2022-03-01', country: 'Bahrain' },

  // Generic acquisitions
  { original: 'HSBC Oman', successor: 'Sohar International Bank', mergerDate: '2022-06-01', country: 'Oman' },
];

export const findMerger = (bankName: string): BankMerger | null => {
  if (!bankName) return null;
  const q = bankName.trim().toLowerCase();
  return BANK_MERGERS.find(m =>
    m.original.toLowerCase() === q ||
    m.original.toLowerCase().includes(q) ||
    q.includes(m.original.toLowerCase()),
  ) || null;
};
