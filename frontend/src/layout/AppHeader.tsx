import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { HorizontaLDots, CloseLineIcon } from "../icons";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import { useAuth } from "../context/AuthContext";

export default function AppHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, organization: org, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Close the mobile menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen &&
          menuRef.current &&
          buttonRef.current &&
          !menuRef.current.contains(event.target as Node) &&
          !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Add event listener when the menu is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up the event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close the mobile menu when the location changes
  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
  }, [location]);

  const handleSignOut = async () => {
    try {
      // Sign out via AuthContext (clears jwt and user state)
      await signOut();
      
      // Use navigate for a smoother transition to home page
      navigate('/', { replace: true });
    } catch (error) {
      // Even if there's an error, still try to navigate
      console.log('Sign out completed, redirecting to home page');
      navigate('/', { replace: true });
    }
  };

  return (
    <nav className="bg-white shadow-sm dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              {user ? (
                <span className="flex items-center text-xl font-bold text-gray-900 dark:text-white cursor-default">
                  {org?.logoUrl ? (
                    <img src={org.logoUrl} alt={org.name + ' logo'} className="mr-3 size-10 rounded-xl bg-white p-1.5 object-contain" />
                  ) : null}
                  {org?.name ? org.name : 'HRM Office'}
                </span>
              ) : (
                // When user is not authenticated, show as a link to home page
                <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
                  HRM Office
                </Link>
              )}
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {user ? (
                <>
                  <Link
                    to="/about"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-6"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/resources"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-6"
                  >
                    Resources
                  </Link>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Pricing
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/about"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-6"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/resources"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-6"
                  >
                    Resources
                  </Link>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Pricing
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="mr-4">
              <ThemeToggleButton />
            </div>
            {user ? (
              <>
                <Link
                  to="/book-demo"
                  className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 mr-4"
                >
                  Book a demo
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 mr-4"
                >
                  Login
                </Link>
                <Link
                  to="/auth/signup"
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mr-4"
                >
                  Sign up
                </Link>
                <Link
                  to="/book-demo"
                  className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Book a demo
                </Link>
              </>
            )}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
          <button
              ref={buttonRef}
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <CloseLineIcon className="block h-6 w-6" />
              ) : (
                <HorizontaLDots className="block h-6 w-6" />
              )}
                </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div ref={menuRef} className="sm:hidden">
          <div className="space-y-1 pb-3 pt-2">
            {user ? (
              <>
                <Link
                  to="/about"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  About Us
                </Link>
                <Link
                  to="/resources"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  Resources
                </Link>
                <Link
                  to="/pricing"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  Pricing
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/about"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  About Us
                </Link>
                <Link
                  to="/resources"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  Resources
                </Link>
                <Link
                  to="/pricing"
                  className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  Pricing
                </Link>
              </>
            )}
          </div>
          <div className="border-t border-gray-200 pb-3 pt-4 dark:border-gray-700">
            <div className="space-y-1">
              <div className="px-4 py-2">
            <ThemeToggleButton />
              </div>
              {user ? (
                <>
                  <Link
                    to="/book-demo"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Book a demo
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Login
                  </Link>
                  <Link
                    to="/auth/signup"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Sign up
                  </Link>
                  <Link
                    to="/book-demo"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    Book a demo
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
