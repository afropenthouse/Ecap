import React from 'react';
import PageMeta from '../../components/common/PageMeta';
import { BuildingOfficeIcon, UserGroupIcon, RocketLaunchIcon, HeartIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";

const AboutPage: React.FC = () => {
  return (
    <>
      <PageMeta
        title="About Us - HRM Office"
        description="Learn about HRM Office's commitment to empowering organizations with comprehensive employee competency assessment solutions."
      />
      
      <div className="bg-slate-50 py-12 dark:bg-gray-950 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="mb-14 rounded-[2rem] bg-[#101b37] px-6 py-14 text-center text-white shadow-xl shadow-indigo-950/10 sm:mb-16 sm:px-12 sm:py-16">
            <h1 className="mb-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Revolutionizing HR Management
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-7 text-slate-300 sm:text-xl">
              Empowering businesses and individuals with modern workforce solutions since 2023
            </p>
          </div>

          {/* Stats */}
          <div className="mb-14 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 sm:mb-16">
            <StatCard 
              icon={<UserGroupIcon className="h-10 w-10 text-blue-500" />} 
              value="10,000+" 
              label="Happy Users" 
            />
            <StatCard 
              icon={<BuildingOfficeIcon className="h-10 w-10 text-green-500" />} 
              value="500+" 
              label="Businesses" 
            />
            <StatCard 
              icon={<RocketLaunchIcon className="h-10 w-10 text-purple-500" />} 
              value="95%" 
              label="Adoption Rate" 
            />
            <StatCard 
              icon={<HeartIcon className="h-10 w-10 text-red-500" />} 
              value="24/7" 
              label="Support" 
            />
          </div>

          {/* Story Section */}
          <div className="mb-14 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 sm:mb-16 sm:p-10">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Our Story</h2>
            <p className="leading-7 text-slate-700 dark:text-gray-300">
            HRM Office is committed to empowering organizations with the tools they need to accurately evaluate, develop, and optimize their workforce. Our Employee Competency Assessment Application is designed to help companies identify individual and organizational skill gaps, recognize top performers, and support continuous employee growth through data-driven insights.
          </p>
          <p className="mt-4 leading-7 text-slate-700 dark:text-gray-300">
            We believe that people are a company's greatest asset—and understanding their strengths is the key to driving performance. ECAP provides a comprehensive, user-friendly solution for assessing employee competencies across different domains. With customizable assessment frameworks, detailed analytics, and real-time reporting, our system ensures that HR teams, managers, and employees stay aligned on performance goals and professional development.
          </p>
          <p className="mt-4 leading-7 text-slate-700 dark:text-gray-300">
            Whether you are considering to enhance productivity, plan training programs, or support career advancement, our Employee Competency Assessment Solution offers just what you need to make informed decisions.
          </p>
          </div>

          {/* Team Section */}
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-slate-50 pb-14 dark:bg-gray-950 sm:pb-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 className="mb-8 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Our Services</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Outsourcing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-cyan-300">Outsourcing</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We take care of your staff management so you can focus on your core business functions.
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            Our services cover:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mt-2 space-y-1">
            <li>Recruitment</li>
            <li>Staff records management</li>
            <li>Staff onboarding/Staff training</li>
            <li>Background verification</li>
            <li>Staff Payroll Management</li>
            <li>Performance management support</li>
            <li>Health insurance management</li>
            <li>Leave and exit management</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            All these services go with our outsourcing package. Talk to us today about managing your entire workforce for you and we will be dedicating few experienced HR Managers to handle that.
          </p>
        </div>

        {/* Recruitment */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-cyan-300">Recruitment</h3>
          <p className="text-gray-700 dark:text-gray-300">
            Looking to hire people for your business success? Let's take care of Staffing in your workplace.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            Engaging new staff and immersing them in your workplace is often time consuming and can be a legal minefield when it comes to making sure you are compliant with all legislation.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            We can assist you in getting new employees within record time, get them up and running as soon as possible, providing a quick return on investment.
          </p>
        </div>

        {/* Learning */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-cyan-300">Learning</h3>
          <p className="text-gray-700 dark:text-gray-300">
            Looking for a learning solution to help transform and deliver organisational learning that addresses your rapidly changing needs for superior business results?
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            While we're renowned for our recruitment support and HR services at HRMoffice, we've also developed a reputation for delivering first-rate learning and development services for the workplace.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            Our team runs regular training sessions and e-learning interventions for professional development, which are open to both our clients and the general business community. We also work with our clients to design, develop and deliver their own in-house training and development programs.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            These services are offered by Accredited Management Trainers and qualified HR Consultants, who gets to know your training needs and business operations and designs the training and development solution that will work best for your business and different cadres of your workforce.
          </p>
        </div>

        {/* HR Technology */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-cyan-300">HR Technology</h3>
          <p className="text-gray-700 dark:text-gray-300">
            Looking for a creative and bespoke technological solutions tailored to your organisation's proprietary needs?
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            The Employee Competency Assessment Application (ECAP) has so much value to offer in todays technological and data driven world. It will help to:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mt-2 space-y-1">
            <li>Identify skill gaps</li>
            <li>Improve talent management by assessing employee skills and behaviors</li>
            <li>Make informed decisions about hiring, promotions, and training</li>
            <li>Provide dynamic feedback for continuous improvement</li>
            <li>Offer real-time, detailed analytics and reports</li>
            <li>Enhance Learning & Development Programs</li>
            <li>Promote Fair & Transparent Evaluations</li>
            <li>Encourage employee ownership of development</li>
          </ul>
        </div>
      </div>
      </div></div>
    </>
  );
};

export default AboutPage;

// Reusable components
function StatCard({ icon, value, label }: { icon: ReactNode, value: string, label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">{icon}</div>
      <p className="mb-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{value}</p>
      <p className="text-sm text-slate-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
