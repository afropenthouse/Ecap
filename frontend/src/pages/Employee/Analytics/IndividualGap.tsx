import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { UserIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  getAssessments,
  getCompetencies,
  getMyJobAssignment,
  listAssessorAssignments,
} from "../../../api/services";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Types
interface Competency {
  id: string;
  name: string;
}

interface CompetencyRating {
  id: string;
  competency_id: string;
  rating: number;
  comments: string;
  assessor_comments?: string;
  assessor_rating?: number;
}

interface EmployeeAssessment {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  employee_full_name?: string;
  department_id: string;
  department_name: string;
  job_role_id?: string;
  job_role_name?: string;
  start_date: string;
  last_updated: string;
  status: string;
  progress: number;
  competency_ratings: CompetencyRating[];
  assessor_id?: string;
  assessor_name?: string;
  assessor_rating?: number;
  assessor_comments?: string;
  assessor_status?: string;
}

// Helper functions
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
};

function IndividualGap() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<EmployeeAssessment[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<EmployeeAssessment | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Load employee's assessments
  useEffect(() => {
    const loadAssessments = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch all necessary data
        const [allAssessments, comps, jobAssignment, assessorAssignments] = await Promise.all([
          getAssessments(),
          getCompetencies(),
          getMyJobAssignment(),
          listAssessorAssignments({ employeeId: user.id })
        ]);

        // Get self assessment and corresponding assessor assessment
        const selfAssessment = (allAssessments || []).find(
          a => a.type === 'SELF' && a.employeeId === user.id && a.status === 'COMPLETED'
        );

        const assessorAssessment = (allAssessments || []).find(
          a => a.type === 'ASSESSOR' && a.employeeId === user.id && a.status === 'REVIEWED'
        );

        if (selfAssessment && assessorAssessment) {
          // Combine ratings from both assessments
          const selfRatings = selfAssessment.ratings || [];
          const assessorRatings = assessorAssessment.ratings || [];

          const byComp: Record<string, any> = {};

          // Start with self-ratings
          selfRatings.forEach(r => {
            byComp[r.competencyId] = {
              id: r.id,
              competency_id: r.competencyId,
              rating: r.rating,
              comments: r.comment || '',
              assessor_comments: '',
              assessor_rating: 0,
            };
          });

          // Overlay with assessor ratings
          assessorRatings.forEach(r => {
            if (byComp[r.competencyId]) {
              byComp[r.competencyId].assessor_rating = r.rating;
              byComp[r.competencyId].assessor_comments = r.comment || '';
            } else {
              byComp[r.competencyId] = {
                id: r.id,
                competency_id: r.competencyId,
                rating: 0,
                comments: '',
                assessor_comments: r.comment || '',
                assessor_rating: r.rating,
              };
            }
          });

        const compRatings = Object.values(byComp).filter(rating => rating.rating > 0 && rating.assessor_rating > 0);
          const ratedCompetencies = compRatings.filter(r => r.assessor_rating > 0);
          const overallRating = ratedCompetencies.length > 0
            ? ratedCompetencies.reduce((sum, r) => sum + r.assessor_rating, 0) / ratedCompetencies.length
            : 0;

          const employeeAssessment: EmployeeAssessment = {
            id: assessorAssessment.id,
            employee_id: user.id,
            employee_name: user.email || '',
            employee_email: user.email,
            employee_full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            department_id: jobAssignment?.job?.department?.id || '',
            department_name: jobAssignment?.job?.department?.name || '',
            job_role_id: jobAssignment?.jobId || '',
            job_role_name: jobAssignment?.job?.title || '',
            start_date: selfAssessment.createdAt,
            last_updated: assessorAssessment.completedAt || assessorAssessment.createdAt,
            status: 'reviewed',
            progress: 100,
            competency_ratings: compRatings,
            assessor_id: assessorAssessment.assessorId || undefined,
            assessor_name: (() => {
              const assignedAssessor = assessorAssignments.find(assignment => assignment.assessorId === assessorAssessment.assessorId)?.assessor;
              return assignedAssessor
                ? `${assignedAssessor.firstName || ''} ${assignedAssessor.lastName || ''}`.trim() || assignedAssessor.email
                : '';
            })(),
            assessor_rating: overallRating,
            assessor_comments: '',
            assessor_status: 'reviewed',
          };

          if (compRatings.length > 0) {
            setAssessments([employeeAssessment]);
            setSelectedAssessment(employeeAssessment);
          } else {
            setAssessments([]);
            setSelectedAssessment(null);
          }
        } else {
          setAssessments([]);
          setSelectedAssessment(null);
        }

        setCompetencies(comps || []);

      } catch (err) {
        console.error('Error loading assessments:', err);
        setError('Failed to load assessment data. Please refresh the page or contact support.');
      } finally {
        setLoading(false);
      }
    };

    loadAssessments();
  }, [user]);

  // Calculate gap data for charts
  const getChartData = () => {
    if (!selectedAssessment) return null;

    const labels = selectedAssessment.competency_ratings.map(rating => {
      const competency = competencies.find(c => c.id === rating.competency_id);
      return competency ? competency.name : `Competency ${rating.competency_id}`;
    });

    const employeeRatings = selectedAssessment.competency_ratings.map(rating => rating.rating);
    const assessorRatings = selectedAssessment.competency_ratings.map(rating => rating.assessor_rating || 0);
    const gaps = employeeRatings.map((rating, index) => {
      const assessorRating = assessorRatings[index];
      return assessorRating - rating;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Self Rating',
          data: employeeRatings,
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          borderColor: 'rgba(53, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Assessor Rating',
          data: assessorRatings,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
        {
          label: 'Gap',
          data: gaps,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Get pie chart data
  const getPieChartData = () => {
    if (!selectedAssessment) return null;

    // Calculate average ratings
    const employeeRatings = selectedAssessment.competency_ratings.map(r => r.rating);
    const avgEmployeeRating = employeeRatings.reduce((sum, r) => sum + r, 0) / employeeRatings.length;

    const assessorRatings = selectedAssessment.competency_ratings.map(r => r.assessor_rating || 0).filter(r => r > 0);
    const avgAssessorRating = assessorRatings.length > 0
      ? assessorRatings.reduce((sum, r) => sum + r, 0) / assessorRatings.length
      : 0;

    // Calculate gap
    const gap = Math.abs(avgAssessorRating - avgEmployeeRating);

    // Calculate agreement percentage (inverse of gap)
    const maxPossibleGap = 4; // Maximum possible gap is 4 (between 1 and 5)
    const agreementPercentage = 100 - (gap / maxPossibleGap * 100);

    return {
      labels: ['Agreement', 'Gap'],
      datasets: [
        {
          data: [agreementPercentage, 100 - agreementPercentage],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  // Chart options with default values
  const [barOptions, setBarOptions] = useState({
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#000000',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Competency Gap Analysis',
        color: '#000000',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.raw;
            return `${label}: ${value}`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        cornerRadius: 6
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        title: {
          display: true,
          text: 'Rating (1-5)',
          color: '#000000',
          font: {
            weight: 'bold' as const
          }
        },
        ticks: {
          color: '#000000',
          font: {
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)'
        }
      },
      x: {
        ticks: {
          color: '#000000',
          font: {
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)'
        }
      }
    }
  });

  // Update chart options based on dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');

      setBarOptions(prevOptions => {
        const textColor = isDarkMode ? '#FFFFFF' : '#000000';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        return {
          ...prevOptions,
          plugins: {
            ...prevOptions.plugins,
            legend: {
              ...prevOptions.plugins.legend,
              labels: {
                ...prevOptions.plugins.legend.labels,
                color: textColor
              }
            },
            title: {
              ...prevOptions.plugins.title,
              color: textColor
            }
          },
          scales: {
            ...prevOptions.scales,
            y: {
              ...prevOptions.scales.y,
              title: {
                ...prevOptions.scales.y.title,
                color: textColor
              },
              ticks: {
                ...prevOptions.scales.y.ticks,
                color: textColor
              },
              grid: {
                color: gridColor
              }
            },
            x: {
              ...prevOptions.scales.x,
              ticks: {
                ...prevOptions.scales.x.ticks,
                color: textColor
              },
              grid: {
                color: gridColor
              }
            }
          }
        };
      });
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Pie chart options with default values
  const [pieOptions, setPieOptions] = useState({
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#000000',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Self-Assessment vs Assessor Agreement',
        color: '#000000',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw.toFixed(1);
            return `${label}: ${value}%`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        cornerRadius: 6
      }
    }
  });

  // Update pie chart options based on dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');

      setPieOptions(prevOptions => {
        const textColor = isDarkMode ? '#FFFFFF' : '#000000';

        return {
          ...prevOptions,
          plugins: {
            ...prevOptions.plugins,
            legend: {
              ...prevOptions.plugins.legend,
              labels: {
                ...prevOptions.plugins.legend.labels,
                color: textColor
              }
            },
            title: {
              ...prevOptions.plugins.title,
              color: textColor
            }
          }
        };
      });
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Calculate overall gap statistics
  const getGapStatistics = () => {
    if (!selectedAssessment) return null;

    const ratings = selectedAssessment.competency_ratings;

    // Calculate average self rating
    const selfRatings = ratings.map(r => r.rating);
    const avgSelfRating = selfRatings.reduce((sum, r) => sum + r, 0) / selfRatings.length;

    // Calculate average assessor rating
    const assessorRatings = ratings.map(r => r.assessor_rating || 0).filter(r => r > 0);
    const avgAssessorRating = assessorRatings.length > 0
      ? assessorRatings.reduce((sum, r) => sum + r, 0) / assessorRatings.length
      : 0;

    // Calculate average gap
    const avgGap = avgAssessorRating - avgSelfRating;

    // Find largest gap (positive or negative)
    const gaps = ratings.map(r => (r.assessor_rating || 0) - r.rating);
    const largestGap = Math.max(...gaps.map(g => Math.abs(g)));
    const largestGapCompetency = ratings[gaps.map(g => Math.abs(g)).indexOf(largestGap)];
    const competencyName = competencies.find(c => c.id === largestGapCompetency?.competency_id)?.name || '';

    return {
      avgSelfRating: avgSelfRating.toFixed(1),
      avgAssessorRating: avgAssessorRating.toFixed(1),
      avgGap: avgGap.toFixed(1),
      largestGap,
      largestGapCompetency: competencyName,
      isOverestimating: avgGap < 0
    };
  };

  const stats = getGapStatistics();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Individual Gap Analysis</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Compare your self-assessment ratings with your assessor's ratings to identify gaps
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                <UserIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No Assessments Available</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-lg">
                You don't have any reviewed assessments yet. Once your assessor reviews your assessment, you'll be able to see the gap analysis here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chart Type Toggle */}
            <div className="mb-6 flex justify-end">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      chartType === 'bar'
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Bar Chart
                  </button>
                  <button
                    onClick={() => setChartType('pie')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      chartType === 'pie'
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Pie Chart
                  </button>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md"
                  title="Refresh Data"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Assessment Info */}
            {selectedAssessment && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedAssessment.job_role_name || 'Assessment'}
                    </h2>
                    <div className="mt-1 flex items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 mr-2">Department:</span>
                      <span className="text-gray-900 dark:text-white">{selectedAssessment.department_name || 'N/A'}</span>
                    </div>
                    <div className="mt-1 flex items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 mr-2">Assessor:</span>
                      <span className="text-gray-900 dark:text-white">{selectedAssessment.assessor_name || 'Not assigned'}</span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Assessment Date</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedAssessment.last_updated)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gap Statistics */}
            {stats && (
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Average Ratings</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Self: <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.avgSelfRating}</span></p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Assessor: <span className="font-semibold text-pink-600 dark:text-pink-400">{stats.avgAssessorRating}</span></p>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parseFloat(stats.avgGap) > 0 ? '+' : ''}{stats.avgGap}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Largest Gap</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stats.largestGapCompetency}</p>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.largestGap.toFixed(1)}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Self-Perception</h3>
                  <div className="flex items-center">
                    <div className={`rounded-full p-2 mr-3 ${
                      parseFloat(stats.avgGap) > 0.5
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : parseFloat(stats.avgGap) < -0.5
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      <svg className={`h-5 w-5 ${
                        parseFloat(stats.avgGap) > 0.5
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : parseFloat(stats.avgGap) < -0.5
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-green-600 dark:text-green-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {parseFloat(stats.avgGap) > 0.5
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          : parseFloat(stats.avgGap) < -0.5
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        }
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {parseFloat(stats.avgGap) > 0.5
                          ? 'Underestimating yourself'
                          : parseFloat(stats.avgGap) < -0.5
                            ? 'Overestimating yourself'
                            : 'Accurate self-assessment'
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {parseFloat(stats.avgGap) > 0.5
                          ? 'Your assessor rates you higher than you rate yourself'
                          : parseFloat(stats.avgGap) < -0.5
                            ? 'You rate yourself higher than your assessor rates you'
                            : 'Your self-assessment closely matches your assessor\'s rating'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="h-80">
                {chartType === 'bar' ? (
                  <Bar data={getChartData() || {labels: [], datasets: []}} options={barOptions} />
                ) : (
                  <Pie data={getPieChartData() || {labels: [], datasets: []}} options={pieOptions} />
                )}
              </div>
            </div>

            {/* Detailed Competency Analysis */}
            {selectedAssessment && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Competency Analysis</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Competency</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Self Rating</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assessor Rating</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gap</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assessor Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedAssessment.competency_ratings.map(rating => {
                        const competency = competencies.find(c => c.id === rating.competency_id);
                        const gap = (rating.assessor_rating || 0) - rating.rating;

                        return (
                          <tr key={rating.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {competency ? competency.name : `Competency ${rating.competency_id}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                              {rating.rating}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                              {rating.assessor_rating || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                gap > 0
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : gap < 0
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {gap > 0 ? '+' : ''}{gap.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {rating.assessor_comments || 'No comments provided'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default IndividualGap;
