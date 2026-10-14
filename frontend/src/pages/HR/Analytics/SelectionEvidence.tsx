import type { TalentEmployee } from '../../../api/talent';

export default function SelectionEvidence({ people, individual, performanceOptional = false }: { people: TalentEmployee[]; individual: boolean; performanceOptional?: boolean }) {
  if (!people.length) return <p className="mt-3 text-xs text-slate-500">{individual ? 'Select an employee to view their assessment evidence.' : 'Select people to view assessment evidence.'}</p>;
  if (people.length === 1) {
    const person = people[0];
    if (person.role === 'ASSESSOR') return <p className="mt-3 text-xs text-teal-700 dark:text-teal-400">Assessor review activity</p>;
    return <div className="mt-3 space-y-2 text-xs">
      <p className={person.competency !== null ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}>{person.competency !== null ? `Completed ${person.source === 'CONSENSUS' ? 'consensus' : 'assessor'} competency review available` : 'No completed competency review in this period'}</p>
      {(!performanceOptional || person.performance !== null) && <p className={person.performance !== null ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}>{person.performance !== null ? 'Completed assessor performance appraisal available' : 'No completed assessor performance appraisal in this period'}</p>}
      {person.competency !== null && person.performance !== null && !person.aligned && <p className="text-slate-500">The competency review and performance appraisal are more than 90 days apart.</p>}
      {(person.competency !== null || person.performance !== null) && !person.fresh && <p className="text-slate-500">Some assessment evidence is over a year old.</p>}
    </div>;
  }
  const competencyCount = people.filter(person => person.competency !== null).length;
  const performanceCount = people.filter(person => person.performance !== null).length;
  return <div className="mt-3 space-y-2 text-xs text-slate-500"><p>{competencyCount} with completed competency reviews</p><p>{performanceCount} with completed assessor performance appraisals</p></div>;
}
