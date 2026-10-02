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
import { UserIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  getAssessments,
  listUsers,
  getCompetencies,
  getEmployeeJobAssignments,
  getDepartments,
  getJobs,
  type Assessment,
  type UserSummary
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
  const [searchTerm, setSearchTerm] = useState('');

  // Load assessor's assigned employee assessments
  useEffect(() => {
    const loadAssessments = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch all necessary data in parallel
        const [allAssessments, users, comps, jobAssigns, depts, jobsData] = await Promise.all([
          getAssessments(),
          listUsers(),
          getCompetencies(),
          getEmployeeJobAssignments(),
          getDepartments(),
          getJobs()
        ]);

        // Build lookup maps
        const userById: Record<string, UserSummary> = {};
        (users || []).forEach(u => {
          userById[u.id] = u;
        });

        const jobAssignmentByEmployee: Record<string, any> = {};
        (jobAssigns || []).forEach(ja => {
          jobAssignmentByEmployee[ja.employeeId] = ja;
        });

        const jobById: Record<string, any> = {};
        (jobsData || []).forEach(job => {
          jobById[job.id] = job;
        });

        const departmentById: Record<string, any> = {};
        (depts || []).forEach(dept => {
          departmentById[dept.id] = dept;
        });

        // Get self assessments
        const selfAssessments = (allAssessments || []).filter(a => a.type === 'SELF' && a.status === 'COMPLETED');
        const selfByEmployee: Record<string, Assessment> = {};
        selfAssessments.forEach(a => {
          if (!selfByEmployee[a.employeeId]) {
            selfByEmployee[a.employeeId] = a;
          }
        });

        // Get assessor assessments
        const assessorAssessments = (allAssessments || []).filter(
          a => a.type === 'ASSESSOR' && a.status === 'REVIEWED' && a.assessorId === user.id
        );

        // Process assessments into format needed for UI
        const processedResults: (EmployeeAssessment | null)[] = assessorAssessments.map(assessorAssessment => {
          const employee = userById[assessorAssessment.employeeId];
          const selfAssessment = selfByEmployee[assessorAssessment.employeeId];
          const jobAssignment = jobAssignmentByEmployee[assessorAssessment.employeeId];
          const job = jobAssignment ? jobById[jobAssignment.jobId] : null;
          const department = job ? departmentById[job.departmentId] : null;

          // Combine ratings from self and assessor assessments
          const selfRatings = selfAssessment?.ratings || [];
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
          if (compRatings.length === 0) return null;
          const ratedCompetencies = compRatings.filter(r => r.assessor_rating > 0);
          const overallRating = ratedCompetencies.length > 0
            ? ratedCompetencies.reduce((sum, r) => sum + r.assessor_rating, 0) / ratedCompetencies.length
            : 0;

          // Build employee full name
          const employeeFirstName = employee?.firstName || '';
          const employeeLastName = employee?.lastName || '';
          const employeeFullName = `${employeeFirstName} ${employeeLastName}`.trim();
          const displayName = employeeFullName || employee?.email || `Employee ${assessorAssessment.employeeId}`;

          return {
            id: assessorAssessment.id,
            employee_id: assessorAssessment.employeeId,
            employee_name: displayName,
            employee_email: employee?.email || '',
            employee_full_name: displayName,
            department_id: department?.id || '',
            department_name: department?.name || 'No Department',
            job_role_id: job?.id || '',
            job_role_name: job?.title || 'No Job Role',
            start_date: assessorAssessment.createdAt,
            last_updated: assessorAssessment.completedAt || assessorAssessment.startedAt || assessorAssessment.createdAt,
            status: assessorAssessment.status,
            progress: compRatings.length,
            competency_ratings: compRatings,
            assessor_id: assessorAssessment.assessorId || undefined,
            assessor_name: user.email,
            assessor_rating: overallRating,
            assessor_comments: '',
            assessor_status: 'reviewed',
          };
        });
        const processedData = processedResults.filter((assessment): assessment is EmployeeAssessment => assessment !== null);

        setAssessments(processedData);
        setCompetencies(comps || []);

        // Set the first assessment as selected by default
        if (processedData.length > 0) {
          setSelectedAssessment(processedData[0]);
        }

      } catch (err) {
        console.error('Error loading assessments:', err);
        setError('Failed to load assessment data. Please refresh the page or contact support.');
      } finally {
        setLoading(false);
      }
    };

    loadAssessments();
  }, [user]);

  // Filter assessments by search term
  const filteredAssessments = assessments.filter(assessment => {
    const searchString = searchTerm.toLowerCase();
    return (
      (assessment.employee_full_name || assessment.employee_name).toLowerCase().includes(searchString) ||
      (assessment.employee_email || '').toLowerCase().includes(searchString) ||
      (assessment.department_name || '').toLowerCase().includes(searchString) ||
      (assessment.job_role_name || '').toLowerCase().includes(searchString)
    );
  });

  useEffect(() => {
    if (filteredAssessments.length === 0) {
      if (selectedAssessment) setSelectedAssessment(null);
      return;
    }
    if (!selectedAssessment || !filteredAssessments.some(assessment => assessment.id === selectedAssessment.id)) {
      setSelectedAssessment(filteredAssessments[0]);
    }
  }, [filteredAssessments, selectedAssessment]);

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
          label: 'Employee Rating',
          data: employeeRatings,
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          borderColor: 'rgba(53, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Your Rating',
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
          color: '#000000', // Default to black
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Competency Gap Analysis',
        color: '#000000', // Default to black
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
          color: '#000000', // Default to black
          font: {
            weight: 'bold' as const
          }
        },
        ticks: {
          color: '#000000', // Default to black
          font: {
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)' // Neutral gray that works in both modes
        }
      },
      x: {
        ticks: {
          color: '#000000', // Default to black
          font: {
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(128, 128, 128, 0.2)' // Neutral gray that works in both modes
        }
      }
    }
  });

  // Update chart options based on dark mode
  useEffect(() => {
    // Function to check if dark mode is active
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');

      // Update chart options based on dark mode
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

    // Check dark mode on mount
    checkDarkMode();

    // Set up a mutation observer to detect theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Clean up observer on unmount
    return () => observer.disconnect();
  }, []);

  // Pie chart options with default values
  const [pieOptions, setPieOptions] = useState({
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#000000', // Default to black
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Self-Assessment vs Assessor Agreement',
        color: '#000000', // Default to black
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
    // Function to check if dark mode is active
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');

      // Update chart options based on dark mode
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

    // Check dark mode on mount
    checkDarkMode();

    // Set up a mutation observer to detect theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Clean up observer on unmount
    return () => observer.disconnect();
  }, []);

  // Calculate overall gap statistics
  const getGapStatistics = () => {
    if (!selectedAssessment) return null;

    const ratings = selectedAssessment.competency_ratings;

    // Calculate average employee rating
    const employeeRatings = ratings.map(r => r.rating);
    const avgEmployeeRating = employeeRatings.reduce((sum, r) => sum + r, 0) / employeeRatings.length;

    // Calculate average assessor rating
    const assessorRatings = ratings.map(r => r.assessor_rating || 0).filter(r => r > 0);
    const avgAssessorRating = assessorRatings.length > 0
      ? assessorRatings.reduce((sum, r) => sum + r, 0) / assessorRatings.length
      : 0;

    // Calculate average gap
    const avgGap = avgAssessorRating - avgEmployeeRating;

    // Find largest gap (positive or negative)
    const gaps = ratings.map(r => (r.assessor_rating || 0) - r.rating);
    const largestGap = Math.max(...gaps.map(g => Math.abs(g)));
    const largestGapCompetency = ratings[gaps.map(g => Math.abs(g)).indexOf(largestGap)];
    const competencyName = competencies.find(c => c.id === largestGapCompetency?.competency_id)?.name || '';

    return {
      avgEmployeeRating: avgEmployeeRating.toFixed(1),
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
            Analyze the gap between employee self-assessments and your ratings
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by employee name, email, department, or job role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 text-gray-400 -translate-y-1/2" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                <UserIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No Assessments Available</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-lg">
                {searchTerm
                  ? 'No assessments match your search criteria.'
                  : 'You haven\'t reviewed any employee assessments yet.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Employee Selector and Chart Type Toggle */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-auto">
                <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Employee
                </label>
                <select
                  id="employee-select"
                  value={selectedAssessment?.id}
                  onChange={(e) => {
                    const selected = assessments.find(a => a.id === e.target.value);
                    if (selected) setSelectedAssessment(selected);
                  }}
                  className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {filteredAssessments.map(assessment => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.employee_full_name || assessment.employee_name} - {assessment.department_name || 'No Department'}
                    </option>
                  ))}
                </select>
              </div>

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

            {/* Employee Info Card */}
            {selectedAssessment && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedAssessment.employee_full_name || selectedAssessment.employee_name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedAssessment.employee_email}
                    </p>
                    <div className="mt-1 flex items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 mr-2">Department:</span>
                      <span className="text-gray-900 dark:text-white">{selectedAssessment.department_name || 'N/A'}</span>
                    </div>
                    {selectedAssessment.job_role_name && (
                      <div className="mt-1 flex items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400 mr-2">Job Role:</span>
                        <span className="text-gray-900 dark:text-white">{selectedAssessment.job_role_name}</span>
                      </div>
                    )}
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
                      <p className="text-sm text-gray-600 dark:text-gray-400">Employee: <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.avgEmployeeRating}</span></p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Your Rating: <span className="font-semibold text-pink-600 dark:text-pink-400">{stats.avgAssessorRating}</span></p>
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
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Employee Self-Perception</h3>
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
                          ? 'Employee underestimates skills'
                          : parseFloat(stats.avgGap) < -0.5
                            ? 'Employee overestimates skills'
                            : 'Accurate self-assessment'
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {parseFloat(stats.avgGap) > 0.5
                          ? 'You rated them higher than they rated themselves'
                          : parseFloat(stats.avgGap) < -0.5
                            ? 'They rated themselves higher than you rated them'
                            : 'Their self-assessment closely matches your rating'
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
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee Rating</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Your Rating</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gap</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee Comments</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Your Comments</th>
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
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                              {rating.comments || 'No comments provided'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
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
