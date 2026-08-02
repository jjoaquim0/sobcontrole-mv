import { describe, expect, it } from 'vitest';
import { createReportQueryKey } from './useReports';

describe('createReportQueryKey', () => {
  it('isola o cache por empresa, domínio e período', () => {
    const firstCompany = createReportQueryKey(
      'company-a',
      'sales',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z'
    );
    const secondCompany = createReportQueryKey(
      'company-b',
      'sales',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z'
    );

    expect(firstCompany).toEqual([
      'reports',
      'company-a',
      'sales',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
    ]);
    expect(secondCompany).not.toEqual(firstCompany);
  });
});
