import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, Map, Building2, BookOpen, BarChart3, Shield,
  Users, LogOut, Menu, X, ChevronRight, Home, ClipboardList, Camera,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UBLogo } from "./UBLogo";
import { Watermark } from "../security/Watermark";
import { SecurityMonitor } from "../security/SecurityMonitor";

const sidebarLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/landing", label: "Landing Page", icon: Home },
  { to: "/admin/buildings", label: "Buildings", icon: Building2 },
  { to: "/admin/panoramas", label: "Panoramas (360°)", icon: Camera },
  { to: "/admin/resources", label: "Resources", icon: BookOpen },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/security", label: "Security Logs", icon: Shield },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList },
];

export const AdminLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-blue-700">
        <UBLogo size="sm" showText={true} variant="light" />
        <div className="mt-2 px-1">
          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">ADMIN PANEL</span>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 bg-blue-900 border-b border-blue-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-blue-900 font-bold text-sm flex-shrink-0">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name || user?.email}</p>
            <p className="text-blue-300 text-xs">Administrator</p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {sidebarLinks.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to} to={to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium group ${
                isActive(to, exact)
                  ? "bg-yellow-500 text-blue-900"
                  : "text-blue-200 hover:bg-blue-700 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {isActive(to, exact) && <ChevronRight size={14} />}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-blue-700 space-y-2">
        <Link to="/" className="flex items-center gap-2 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-700 rounded-lg transition-all text-sm">
          <Home size={16} /> Public Site
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:text-white hover:bg-red-700 rounded-lg transition-all text-sm">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex" style={{ userSelect: "none" }}>
      <SecurityMonitor />
      <Watermark />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-blue-800 text-white flex-col fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 bg-blue-800 text-white z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14 flex items-center px-4 gap-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-blue-900">
              {sidebarLinks.find(l => isActive(l.to, l.exact))?.label || "Admin"}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
