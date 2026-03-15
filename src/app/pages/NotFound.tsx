import React from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Home, Map, Camera } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <div className="text-9xl font-black text-blue-100 mb-4">404</div>
        <h1 className="text-3xl font-black text-blue-900 mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist on the UB campus map.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-3 rounded-xl transition-all">
            <Home size={18} /> Go Home
          </Link>
          <Link to="/map" className="flex items-center gap-2 border-2 border-blue-700 text-blue-700 font-bold px-5 py-3 rounded-xl hover:bg-blue-50 transition-all">
            <Map size={18} /> Campus Map
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
