import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function Header() {
  const [location] = useLocation();
  const { logout } = useAuth();
  
  const navItems = [
    { path: "/", label: "Dashboard", icon: "ri-dashboard-line" },
    { path: "/inventory", label: "Inventory", icon: "ri-archive-line" },
    { path: "/projects", label: "Projects", icon: "ri-scissors-line" },
    { path: "/calculator", label: "Calculator", icon: "ri-calculator-line" },
    { path: "/shop", label: "Shop", icon: "ri-store-line" },
    // { path: "/about", label: "About", icon: "ri-information-line" },
    // { path: "contact", label: "Contact", icon: "ri-mail-line" },
    { path: "/settings", label: "Settings", icon: "ri-settings-3-line" },
    { path: "/profile", label: "Profile", icon: "ri-user-line" },
  ];
  
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center mb-4 sm:mb-0">
          <img src="/logo.png" alt="CrochetNook logo" className="mr-2 h-10 w-10 object-contain" />
          <h1 className="font-poppins font-bold text-2xl text-neutral-900">CrochetNook</h1>
        </div>
        <nav className="flex space-x-4">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`hover:text-primary-600 font-medium transition-colors flex items-center ${
                location === item.path ? "text-primary-600" : "text-neutral-700"
              }`}
            >
              <i className={`${item.icon} mr-1`}></i> {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => logout()}
            className="hover:text-primary-600 font-medium transition-colors flex items-center text-neutral-700"
          >
            <i className="ri-logout-box-line mr-1"></i> Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
