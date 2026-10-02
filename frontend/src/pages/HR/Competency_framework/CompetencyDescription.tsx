export default function CompetencyDescription() {
  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900">
      <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">Competency Description Layout</h1>
      <p className="mb-6 text-gray-600 dark:text-gray-400">These are our building blocks of organizational excellence</p>
      <div className="space-y-8">
        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-white">Core Competencies</h2>
          <p className="mb-4 text-gray-600 dark:text-gray-300">Definition: Fundamental skills and knowledge that are essential for all employees across the organization.</p>
          <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Proficiency levels:</p>
          <ul className="list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-300">
            <li><span className="font-medium">Basic:</span> Demonstrates basic understanding and can perform tasks with guidance.</li>
            <li><span className="font-medium">Intermediate:</span> Can work independently and solve routine problems.</li>
            <li><span className="font-medium">Advanced:</span> Can handle complex situations and mentor others.</li>
            <li><span className="font-medium">Expert:</span> Recognized as a subject matter expert and can drive innovation.</li>
          </ul>
        </section>
        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-white">Functional Competencies</h2>
          <p className="mb-4 text-gray-600 dark:text-gray-300">Definition: Technical skills and knowledge specific to particular job functions or departments.</p>
          <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Proficiency levels:</p>
          <ul className="list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-300">
            <li><span className="font-medium">Basic:</span> Understands fundamental concepts and can perform basic tasks.</li>
            <li><span className="font-medium">Intermediate:</span> Can apply knowledge to solve common problems.</li>
            <li><span className="font-medium">Advanced:</span> Can handle complex technical challenges and optimize processes.</li>
            <li><span className="font-medium">Expert:</span> Can develop new methodologies and lead technical initiatives.</li>
          </ul>
        </section>
        <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-white">Behavioural Competencies</h2>
          <p className="mb-4 text-gray-600 dark:text-gray-300">Definition: Personal attributes and interpersonal skills that influence how individuals interact with others and handle work situations.</p>
          <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Proficiency levels:</p>
          <ul className="list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-300">
            <li><span className="font-medium">Basic:</span> Shows awareness of behavioral expectations and basic interpersonal skills.</li>
            <li><span className="font-medium">Intermediate:</span> Consistently demonstrates appropriate behavior and effective communication.</li>
            <li><span className="font-medium">Advanced:</span> Can manage complex interpersonal situations and influence team dynamics.</li>
            <li><span className="font-medium">Expert:</span> Can shape organizational culture and mentor others in behavioral excellence.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
