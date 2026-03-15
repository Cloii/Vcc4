import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { useAuth } from "./context/AuthContext";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import Landing from "./pages/Landing";
import MapPage from "./pages/Map";
import Tours from "./pages/Tours";
import TourDetail from "./pages/TourDetail";
import Directory from "./pages/Directory";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminPaths from "./pages/admin/Paths";
import AdminBuildings from "./pages/admin/Buildings";
import AdminResources from "./pages/admin/Resources";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSecurity from "./pages/admin/Security";
import AdminUsers from "./pages/admin/Users";

// Protected route wrapper for admin
const AdminGuard: React.FC = () => {
  const { user, role, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-4 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-blue-200">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" state={{ from: "/admin" }} replace />;
  if (role !== "admin" && role !== "staff") return <Navigate to="/" replace />;
  return <Outlet />;
};

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PublicLayout,
    children: [
      { index: true, Component: Landing },
      { path: "map", Component: MapPage },
      { path: "tours", Component: Tours },
      { path: "tours/:buildingId", Component: TourDetail },
      { path: "directory", Component: Directory },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/admin",
    Component: AdminGuard,
    children: [
      {
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "paths", Component: AdminPaths },
          { path: "buildings", Component: AdminBuildings },
          { path: "resources", Component: AdminResources },
          { path: "analytics", Component: AdminAnalytics },
          { path: "security", Component: AdminSecurity },
          { path: "users", Component: AdminUsers },
        ],
      },
    ],
  },
]);
