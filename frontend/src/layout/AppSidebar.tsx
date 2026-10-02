import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";

// icon library
import {
  BoxCubeIcon,
  ChevronDownIcon,
  HorizontaLDots,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean; subItems?: { name: string; path: string }[] }[];
};

const normalizePath = (path: string) => path.replace(/^\/(hr|assessor|employee)\//, '/');

// EmployeeNavItems
const employeeNavItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Page Description",
    path: "/page-description",
  },
  {
    icon: <UserCircleIcon />,
    name: "User & Role Management",
    subItems: [
      // { name: "User", path: "/user" },
      { name: "Employee Details", path: "/employee-details" },
      { name: "Employee Job Assignment", path: "/employee-job-assignment" },
      { name: "Employee Assessor Assign", path: "/employee-assessor-assign" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Competency Framework",
    subItems: [
      { name: "Competency Description", path: "/competency-description" },
      { name: "Competency Category", path: "/competency-category" },
      { name: "Competency", path: "/competency" },
      { name: "Competency Domain", path: "/competency-domain" },
      { name: "Competency Proficiency", path: "/proficiency-description" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Job Profiling",
    subItems: [
      { name: "Job", path: "/job" },
      { name: "Job Competency Profile", path: "/job-competency-profile" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Assessment Mgt",
    subItems: [
      { name: "Employee Assessment", path: "/employee-assessment" },
      // employee routes are namespaced under /employee in App.tsx
      { name: "Performance Appraisal", path: "/performance-appraisal" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Analytics",
    subItems: [
      { name: "Individual Gap", path: "/individual-gap" },
    ],
  },
];

// assessorNavItems
const assessorNavItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Page Description",
    path: "/page-description",
  },
  {
    icon: <UserCircleIcon />,
    name: "User & Role Management",
    subItems: [
      // { name: "User", path: "/user" },
      { name: "Employee Details", path: "/employee-details" },
      { name: "Employee Job Assignment", path: "/employee-job-assignment" },
      { name: "Employee Assessor Assign", path: "/employee-assessor-assign" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Competency Framework",
    subItems: [
      { name: "Competency Description", path: "/competency-description" },
      { name: "Competency Category", path: "/competency-category" },
      { name: "Competency", path: "/competency" },
      { name: "Competency Domain", path: "/competency-domain" },
      { name: "Competency Proficiency", path: "/proficiency-description" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Job Profiling",
    subItems: [
      { name: "Job", path: "/job" },
      { name: "Job Competency Profile", path: "/job-competency-profile" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Assessment Mgt",
    subItems: [
      { name: "Assessor Assessment", path: "/assessor-assessment" },
      { name: "Performance Appraisal", path: "/performance-appraisal" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Analytics",
    subItems: [
      { name: "Individual Gap", path: "/individual-gap" },
    ],
  },
];

// hrNavItems
const hrNavItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Page Description",
    path: "/page-description",
  },
  {
    icon: <Cog6ToothIcon />,
    name: "Organization",
    subItems: [
      { name: "Organization Settings", path: "/organization-settings" },
      { name: "Team Members", path: "/team-members" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "User & Role Management",
    subItems: [
      // { name: "User", path: "/user" },
      { name: "Employee Details", path: "/employee-details" },
      { name: "Assign Job Roles", path: "/employee-job-assignment" },
      { name: "Assign an Assessor", path: "/employee-assessor-assign" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Competency Framework",
    subItems: [
      { name: "Competency Description", path: "/competency-description" },
      { name: "Competency Category", path: "/competency-category" },
      { name: "Competency", path: "/competency" },
      { name: "Competency Domain", path: "/competency-domain" },
      { name: "Competency Proficiency", path: "/proficiency-description" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Job Profiling",
    subItems: [
      { name: "Job", path: "/job" },
      { name: "Job Competency Profile", path: "/job-competency-profile" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Assessment Mgt",
    subItems: [
      { name: "Assessor Assessment", path: "/assessor-assessment" },
      { name: "Consensus Assessment", path: "/consensus-assessment" },
      { name: "Performance Appraisal", path: "/performance-appraisal" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Analytics",
    subItems: [
      // { name: "Individual Gap", path: "/individual-gap" }, // Removed as HR doesn't need individual gap analysis
      { name: "Organization Gap", path: "/organization-gap" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = (path: string) => {
    if (!user) return false;

    return normalizePath(location.pathname) === normalizePath(path);
  };

  const getNavItems = () => {
    if (!user) return [];

    // Return the nav items based on the user's highest role
    if (user.roles.includes('hr')) {
      return hrNavItems;
    } else if (user.roles.includes('assessor')) {
      return assessorNavItems;
    } else {
      return employeeNavItems;
    }
  };

  const navItems = getNavItems();

  useEffect(() => {
    let submenuMatched = false;
    ["main"].forEach((menuType) => {
      const items = navItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          // Check if any subItem is active
          const hasActiveSubItem = nav.subItems.some(subItem => isActive(subItem.path));

          if (hasActiveSubItem) {
            setOpenSubmenu({
              type: menuType as "main",
              index,
            });
            submenuMatched = true;
          }
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, navItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-expanded"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-expanded"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text whitespace-nowrap overflow-hidden text-ellipsis">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-gray-700 dark:text-gray-300"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={normalizePath(nav.path)}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text whitespace-nowrap overflow-hidden text-ellipsis">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={normalizePath(subItem.path)}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        {/* Use a div instead of a Link when user is authenticated */}
        {user ? (
          <div className="cursor-default">
            {isExpanded || isHovered || isMobileOpen ? (
              <>
                <img
                  className="dark:hidden"
                  src="/images/logo/logo.svg"
                  alt="Logo"
                  width={150}
                  height={40}
                />
                <img
                  className="hidden dark:block"
                  src="/images/hrmdark.png"
                  alt="Logo"
                  width={150}
                  height={40}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-left">Employee Competency Assessments System</p>
              </>
            ) : (
              <img
                src="/images/logo/logo-icon.svg"
                alt="Logo"
                width={32}
                height={32}
              />
            )}
          </div>
        ) : (
          <Link to="/">
            {isExpanded || isHovered || isMobileOpen ? (
              <>
                <img
                  className="dark:hidden"
                  src="/images/logo/logo.svg"
                  alt="Logo"
                  width={150}
                  height={40}
                />
                <img
                  className="hidden dark:block"
                  src="/images/hrmdark.png"
                  alt="Logo"
                  width={150}
                  height={40}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-left">Employee Competency Assessments System</p>
              </>
            ) : (
              <img
                src="/images/logo/logo-icon.svg"
                alt="Logo"
                width={32}
                height={32}
              />
            )}
          </Link>
        )}
      </div>
      <div className="sidebar-nav-scrollbar -mr-5 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pr-2 duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
