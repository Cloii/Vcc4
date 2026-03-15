import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Map, Camera, BookOpen, LogIn, Menu, X, User, LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UBLogo } from "./UBLogo";
import { Watermark } from "../security/Watermark";
import { SecurityMonitor } from "../security/SecurityMonitor";

const navLinks = [
  { to: "/map", label: "Campus Map", icon: Map },
  { to: "/tours", label: "Virtual Tours", icon: Camera },
  { to: "/directory", label: "Directory", icon: BookOpen },
];

export const PublicLayout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ userSelect: "none" }}>
      <SecurityMonitor />
      <Watermark />

      {/* Navbar */}
      <nav className="bg-blue-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <UBLogo size="sm" showText={true} variant="light" />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  isActive(to)
                    ? "bg-yellow-500 text-blue-900"
                    : "text-blue-100 hover:bg-blue-700 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-lg transition-all"
                >
                  <div className="w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center text-blue-900 font-bold text-sm">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden md:block text-sm max-w-[120px] truncate">{user.name || user.email}</span>
                  <ChevronDown size={14} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-gray-800 text-sm truncate">{user.name || user.email}</p>
                        <p className="text-xs text-gray-500 capitalize">{role} • {user.email}</p>
                      </div>
                      {(role === "admin" || role === "staff") && (
                        <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                          <Settings size={15} /> Admin Dashboard
                        </Link>
                      )}
                      <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut size={15} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link to="/login" className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-semibold px-4 py-2 rounded-lg transition-all text-sm">
                <LogIn size={16} /> Sign In
              </Link>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg hover:bg-blue-700 transition-colors">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-blue-900 border-t border-blue-700 overflow-hidden"
            >
              <div className="px-4 py-3 flex flex-col gap-1">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to} to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
                      isActive(to) ? "bg-yellow-500 text-blue-900" : "text-blue-100 hover:bg-blue-700"
                    }`}
                  >
                    <Icon size={18} /> {label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-blue-900 text-blue-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">© 2024 University of Bohol — Virtual Campus Companion</p>
          <p className="text-xs mt-1 text-blue-400">Tagbilaran City, Bohol, Philippines</p>
        </div>
      </footer>
    </div>
  );
};
