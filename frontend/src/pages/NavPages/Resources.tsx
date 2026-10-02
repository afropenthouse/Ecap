import React from 'react';
import PageMeta from '../../components/common/PageMeta';
import { 
  BookOpenIcon, 
  PlayCircleIcon, 
  DocumentTextIcon, 
  AcademicCapIcon,
  ChartBarIcon,
  // UserGroupIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const ResourceCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
}> = ({ icon, title, description, link }) => (
  <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
    <div className="mb-5 flex items-center">
      <div className="rounded-xl bg-indigo-50 p-3 transition group-hover:bg-indigo-100 dark:bg-indigo-950 dark:group-hover:bg-indigo-900">
        {icon}
      </div>
      <h3 className="ml-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
    </div>
    <p className="mb-5 text-sm leading-6 text-slate-600 dark:text-gray-300">{description}</p>
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center font-semibold text-indigo-700 transition hover:text-indigo-900 dark:text-cyan-300 dark:hover:text-cyan-200"
    >
      Learn More
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  </div>
);

export default function ResourcesPage() {
  const resources = [
    {
      title: "HR Fundamentals Guide",
      desc: "Master core HR processes from hiring to offboarding",
      icon: <BookOpenIcon className="h-8 w-8 text-indigo-600" />,
      category: "Essentials",
      action: "Read Guide",
      link: "https://gavsispanel.gelisim.edu.tr/Document/hocal/20180827153114515_42cde2f6-988f-4fe9-ae06-1fc8ad0efd42.pdf"
    },
    // {
    //   title: "Employee Onboarding Kit",
    //   desc: "Templates and checklists for seamless onboarding",
    //   icon: <UserGroupIcon className="h-8 w-8 text-blue-600" />,
    //   category: "Templates",
    //   action: "Get Templates"
    // },
    {
      title: "Professional in Human Resources (PHR)",
      desc: "Video series on Human Resources",
      icon: <ShieldCheckIcon className="h-8 w-8 text-emerald-600" />,
      category: "Training",
      action: "Watch Videos",
      link: "https://www.linkedin.com/learning/topics/professional-in-human-resources-phr"
    },
    {
      title: "Leadership and Management",
      desc: "Curriculum for building management skills",
      icon: <AcademicCapIcon className="h-8 w-8 text-amber-600" />,
      category: "Courses",
      action: "Start Course",
      link: "https://www.linkedin.com/learning/topics/leadership-and-management"
    },
    {
      title: "HR Data Analytics Guidebook",
      desc: "Turn HR data into actionable insights",
      icon: <ChartBarIcon className="h-8 w-8 text-purple-600" />,
      category: "Analytics",
      action: "Download",
      link: "https://tq.filegood.club/1586445898"
    },
    
    {
      title: "Step-by-Step Recruitment Guide",
      desc: "Create custom HR policies in minutes",
      icon: <DocumentTextIcon className="h-8 w-8 text-red-600" />,
      category: "Training",
      action: "Watch Videos",
      link: "https://www.youtube.com/watch?v=Qk38hHZyX6E"
    },
    {
      title: "Performance Management System",
      desc: "Step-by-step system walkthroughs",
      icon: <PlayCircleIcon className="h-8 w-8 text-sky-600" />,
      category: "How-To",
      action: "View Tutorials",
      link: "https://www.youtube.com/watch?v=JmpVaBA2m30&pp=ygUVaHIgUGxhdGZvcm0gVHV0b3JpYWxz"
    },
  ];

  const categories = [...new Set(resources.map(r => r.category))];

  return (
    <>
      <PageMeta
        title="Resources - HRM Office"
        description="Access valuable resources for HR professionals, including guides, webinars, and best practices for employee competency assessment."
      />

      {/* Hero Section */}
      <div className="relative isolate overflow-hidden bg-[#101b37] py-14 text-white sm:py-16">
        <div className="absolute -right-20 -top-28 -z-10 size-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="mb-5 text-4xl font-semibold tracking-tight sm:text-5xl">HR Resources</h1>
          <p className="max-w-3xl text-lg leading-7 text-slate-300 sm:text-xl">
            Access our comprehensive collection of resources designed to help you optimize your workforce management and competency assessment processes.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        {/* Introduction */}
        <div className="mb-10 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:mb-12 sm:p-8">
          <p className="leading-7 text-slate-600 dark:text-gray-300">
            At HRM Office, we believe in empowering HR professionals with the knowledge and tools they need to succeed. Our curated collection of resources includes guides, webinars, templates, and best practices to help you implement effective competency assessment programs and drive organizational success.
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-9 flex flex-wrap gap-2.5">
          <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            All Resources
          </button>
          {categories.map((category) => (
            <button 
              key={category} 
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
            >
              {category}
            </button>
          ))}
        </div>

        {/* Resource Grid */}
        <div className="mb-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:mb-14">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.title}
              icon={resource.icon}
              title={resource.title}
              description={resource.desc}
              link={resource.link || "#"}
            />
          ))}
        </div>

        {/* Knowledge Base CTA */}
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 sm:p-8">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-2/3 mb-6 md:mb-0 md:pr-8">
                <h2 className="mb-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Ready to Transform Your HR Processes?
              </h2>
              <p className="leading-7 text-slate-600 dark:text-gray-300">
                Get personalized guidance on implementing competency assessments and optimizing your workforce management strategy.
              </p>
            </div>
            <div className="md:w-1/3 flex justify-center md:justify-end">
              <a 
                href="/book-demo" 
                className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700 md:w-auto"
              >
                Schedule a Consultation
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
