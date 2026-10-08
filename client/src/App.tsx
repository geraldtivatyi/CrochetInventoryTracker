import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocation } from "wouter";

import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Projects from "@/pages/projects";
import Calculator from "@/pages/calculator";
import Shop from "@/pages/shop";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import Storefront from "@/pages/storefront";

// Create a layout component that includes the header and footer
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
};

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const isShopPath = location.startsWith("/store/");
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const { data: domainShop } = useQuery<{ shop: { slug: string } | null }>({
    queryKey: ["/api/storefront/domain"],
    enabled: location === "/" && !isLocalHost,
  });

  if (isLoading) return null;

  if (isShopPath) {
    const slug = decodeURIComponent(location.slice("/store/".length).split("/")[0]);
    return <Storefront slug={slug} />;
  }
  if (location === "/" && domainShop?.shop) return <Storefront customDomain />;

  if (!user) {
    if (location === "/forgot-password") return <ForgotPassword />;
    if (location === "/reset-password") return <ResetPassword />;
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/projects" component={Projects} />
        <Route path="/calculator" component={Calculator} />
        <Route path="/shop" component={Shop} />
        <Route path="/settings" component={Settings} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
