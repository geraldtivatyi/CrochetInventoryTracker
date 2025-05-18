import { Link, useLocation } from "wouter";

export default function Header() {
  const [location] = useLocation();
  
  const navItems = [
    { path: "/", label: "Dashboard", icon: "ri-dashboard-line" },
    { path: "/inventory", label: "Inventory", icon: "ri-archive-line" },
    { path: "/projects", label: "Projects", icon: "ri-scissors-line" },
    { path: "/calculator", label: "Calculator", icon: "ri-calculator-line" },
  ];
  
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center mb-4 sm:mb-0">
          <i className="ri-thread-line text-primary-500 text-3xl mr-2"></i>
          <h1 className="font-poppins font-bold text-2xl text-neutral-900">CrochetTrack</h1>
        </div>
        <nav className="flex space-x-4">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
            >
              <a className={`hover:text-primary-600 font-medium transition-colors flex items-center ${
                location === item.path ? "text-primary-600" : "text-neutral-700"
              }`}>
                <i className={`${item.icon} mr-1`}></i> {item.label}
              </a>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
