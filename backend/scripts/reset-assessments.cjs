// One-off reset: explicit organization scope, recoverable backup, and no appraisal changes.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { prisma } = require('../dist/config/prisma');

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) throw new Error('Provide the organization ID to reset.');
  const result = await prisma.$transaction(async tx => {
    const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new Error('Organization not found.');
    const assessments = await tx.assessment.findMany({ where: { organizationId }, include: { ratings: true } });
    const backupDirectory = path.resolve(__dirname, '../backups');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupPath = path.join(backupDirectory, `assessments-${organizationId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ organizationId, savedAt: new Date().toISOString(), assessments }, null, 2), { flag: 'wx' });
    const assessmentIds = assessments.map(a => a.id);
    const ratings = await tx.assessmentRating.deleteMany({ where: { organizationId, assessmentId: { in: assessmentIds } } });
    const deleted = await tx.assessment.deleteMany({ where: { organizationId, id: { in: assessmentIds } } });
    const remaining = await tx.assessment.count({ where: { organizationId } });
    if (remaining !== 0) throw new Error('Assessment reset verification failed; transaction rolled back.');
    return { assessmentsDeleted: deleted.count, ratingsDeleted: ratings.count, remainingAssessments: remaining, backupPath };
  }, { isolationLevel: 'Serializable', timeout: 20000 });
  console.log(JSON.stringify(result));
}
main().catch(error => {
  // Do not expose connection credentials through database errors.
  console.error('Assessment reset failed:', error.code || error.name);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
