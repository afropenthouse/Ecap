/** Match a review to the self-assessment cycle that existed when it was created. */
export function matchingSelf<T extends { employeeId: string; type: string; status: string; createdAt: string }>(records: T[], review: T): T | undefined {
  return records.filter(record => record.employeeId === review.employeeId && record.type === 'SELF' && record.status === 'COMPLETED' && Date.parse(record.createdAt) <= Date.parse(review.createdAt))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

/** Future job assignments do not describe someone's current role. */
export function currentAssignment<T extends { employeeId: string; startDate?: string | null; createdAt?: string }>(records: T[], employeeId: string, now = Date.now()): T | undefined {
  const effectiveDate = (record: T) => Date.parse(record.startDate || record.createdAt || '') || 0;
  return records.filter(record => record.employeeId === employeeId && effectiveDate(record) <= now)
    .sort((a, b) => effectiveDate(b) - effectiveDate(a))[0];
}

/** Average differences before aggregation, so opposing gaps cannot cancel out. */
export function agreementPercentage(pairs: Array<[number, number]>, scaleRange = 4): number {
  const valid = pairs.filter(pair => pair.every(Number.isFinite));
  if (!valid.length || scaleRange <= 0) return 0;
  const gap = valid.reduce((sum, [self, assessor]) => sum + Math.abs(assessor - self), 0) / valid.length;
  return Math.max(0, Math.min(100, 100 - gap / scaleRange * 100));
}
