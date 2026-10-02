import { CheckCircleIcon, StarIcon, ShieldCheckIcon, BoltIcon } from "@heroicons/react/24/solid";

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      desc: "For individuals and small teams",
      features: [
        "Up to 10 employees",
        "Basic HR features",
        "Email support",
        "1GB storage"
      ],
      icon: <StarIcon className="h-8 w-8 text-yellow-400" />
    },
    {
      name: "Business",
      price: "$29",
      desc: "Growing organizations",
      features: [
        "Up to 100 employees",
        "Advanced analytics",
        "Priority support",
        "API access",
        "10GB storage"
      ],
      icon: <ShieldCheckIcon className="h-8 w-8 text-blue-500" />,
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      desc: "Large corporations",
      features: [
        "Unlimited employees",
        "Dedicated account manager",
        "24/7 support",
        "On-premise options",
        "Custom integrations"
      ],
      icon: <BoltIcon className="h-8 w-8 text-purple-500" />
    }
  ];

  return (
    <div className="bg-slate-50 py-12 dark:bg-gray-950 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`relative overflow-hidden rounded-3xl border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.popular 
                  ? "border-indigo-300 bg-gradient-to-b from-white to-indigo-50 ring-2 ring-indigo-500/70 dark:border-indigo-800 dark:from-gray-900 dark:to-indigo-950/40 md:-translate-y-2" 
                  : "border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              {plan.popular && (
                <div className="absolute right-5 top-5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-[10px] font-bold tracking-wider text-white shadow-sm">
                  MOST POPULAR
                </div>
              )}
              <div className="p-6 pt-8 sm:p-8">
                <div className="mb-7 flex items-center">
                  <div className="mr-4 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950">{plan.icon}</div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{plan.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-gray-300">{plan.desc}</p>
                  </div>
                </div>
                <div className="mb-7 border-b border-slate-100 pb-6 dark:border-gray-800">
                  <p className="mb-2 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{plan.price}</p>
                  {plan.price !== "Custom" && <p className="text-gray-500 dark:text-gray-400">per month</p>}
                </div>
                <ul className="mb-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start group">
                      <CheckCircleIcon className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500 transition-transform group-hover:scale-110" />
                      <span className="text-slate-600 transition-colors group-hover:text-slate-900 dark:text-gray-300 dark:group-hover:text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full rounded-xl px-6 py-3.5 font-semibold transition ${
                    plan.popular
                      ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                      : "border border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  }`}
                >
                  Get Started
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:mt-16 sm:p-10">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            HR Management FAQs
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <FAQItem 
              question="How does employee onboarding work in your system?" 
              answer="Our platform provides automated onboarding workflows with document signing, task assignments, and training tracking to streamline new hire processes." 
            />
            <FAQItem 
              question="Can we customize performance review templates?" 
              answer="Yes, all plans include customizable review templates with advanced options available in Business and Enterprise tiers." 
            />
            <FAQItem 
              question="Is payroll integration included?" 
              answer="Payroll integration is available in our Business and Enterprise plans with support for 50+ payroll providers." 
            />
            <FAQItem 
              question="How secure is our employee data?" 
              answer="We use enterprise-grade encryption, SOC 2 compliance, and regular security audits to protect all HR data." 
            />
            <FAQItem 
              question="Can managers access team analytics?" 
              answer="Yes, role-based dashboards give managers real-time insights into their team's metrics and KPIs." 
            />
            <FAQItem 
              question="Do you offer implementation support?" 
              answer="All plans include onboarding assistance, with dedicated implementation managers for Enterprise customers." 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition hover:border-indigo-100 hover:bg-indigo-50/50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800">
      <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">{question}</h3>
      <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">{answer}</p>
    </div>
  );
}
