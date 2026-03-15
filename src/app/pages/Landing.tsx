import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Map, Camera, BookOpen, Shield, Route, Building2, ArrowRight, Star, Users, Clock } from "lucide-react";
import { UBLogo } from "../components/layout/UBLogo";

const HERO_IMAGE = "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600&q=80";
const CAMPUS_IMAGE = "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800&q=80";

const features = [
  { icon: Map, title: "Interactive Campus Map", desc: "Navigate the UB campus with our real-time interactive map powered by OpenStreetMap.", color: "bg-blue-100 text-blue-700", link: "/map" },
  { icon: Camera, title: "360° Virtual Tours", desc: "Explore buildings with immersive panoramic tours and interactive hotspots.", color: "bg-yellow-100 text-yellow-700", link: "/tours" },
  { icon: Route, title: "Smart Routing", desc: "Find the best walking path between buildings, with accessibility-friendly options.", color: "bg-red-100 text-red-700", link: "/map" },
  { icon: BookOpen, title: "Resource Directory", desc: "Search and find campus facilities, offices, and services instantly.", color: "bg-green-100 text-green-700", link: "/directory" },
  { icon: Shield, title: "Secure Access", desc: "Role-based access control with watermark protection and activity monitoring.", color: "bg-purple-100 text-purple-700", link: "/login" },
  { icon: Building2, title: "Building Information", desc: "Detailed info on every building including contacts, hours, and categories.", color: "bg-orange-100 text-orange-700", link: "/directory" },
];

const stats = [
  { label: "Campus Buildings", value: "10+", icon: Building2 },
  { label: "Virtual Tours", value: "10", icon: Camera },
  { label: "Campus Resources", value: "50+", icon: BookOpen },
  { label: "Active Students", value: "5000+", icon: Users },
];

const quickLinks = [
  { label: "Campus Map", to: "/map", icon: Map, color: "from-blue-600 to-blue-800" },
  { label: "Virtual Tours", to: "/tours", icon: Camera, color: "from-yellow-500 to-yellow-700" },
  { label: "Directory", to: "/directory", icon: BookOpen, color: "from-red-600 to-red-800" },
  { label: "Sign In", to: "/login", icon: Users, color: "from-gray-700 to-gray-900" },
];

export default function Landing() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})`, transform: `translateY(${scrollY * 0.4}px)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/80 to-blue-900/90" />

        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full opacity-60"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              animate={{ y: [-20, 20, -20], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center text-white px-4 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex justify-center mb-6">
              <UBLogo size="lg" showText={false} variant="light" />
            </div>
            <div className="inline-block bg-yellow-500 text-blue-900 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-4">
              University of Bohol
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-4 text-white leading-tight">
              Virtual Campus
              <span className="text-yellow-400"> Companion</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              Explore, navigate, and discover the University of Bohol campus through immersive 360° tours and interactive maps.
            </p>
          </motion.div>

          {/* Quick Links Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mb-10"
          >
            {quickLinks.map(({ label, to, icon: Icon, color }) => (
              <Link
                key={to} to={to}
                className={`flex flex-col items-center gap-2 bg-gradient-to-br ${color} text-white py-4 px-3 rounded-2xl font-semibold hover:scale-105 transition-transform shadow-lg`}
              >
                <Icon size={24} />
                <span className="text-sm">{label}</span>
              </Link>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}
            className="text-blue-300 text-sm animate-bounce"
          >
            Scroll to explore ↓
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-yellow-500 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ label, value, icon: Icon }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="text-center text-blue-900"
              >
                <Icon size={28} className="mx-auto mb-2" />
                <div className="text-3xl font-black">{value}</div>
                <div className="text-sm font-semibold opacity-80">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-3">Features</div>
            <h2 className="text-4xl font-black text-blue-900 mb-4">Everything You Need</h2>
            <p className="text-gray-500 max-w-xl mx-auto">A comprehensive digital campus guide designed for students, faculty, and visitors of the University of Bohol.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc, color, link }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Link to={link} className="block bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl transition-all hover:-translate-y-1 group">
                  <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2 text-lg">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  <div className="flex items-center gap-1 text-blue-600 text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ArrowRight size={14} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Campus Preview Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            >
              <div className="inline-block bg-red-100 text-red-700 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-4">360° Virtual Tours</div>
              <h2 className="text-4xl font-black text-blue-900 mb-4">Explore Campus Without Leaving Home</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Navigate through our immersive panoramic tours of all major buildings. Click hotspots to walk through corridors, visit labs, and discover hidden gems of the UB campus.
              </p>
              <div className="space-y-3 mb-8">
                {["Panoramic 360° photo & video tours", "Interactive navigation hotspots", "Building-by-building exploration", "Works on any device"].map(item => (
                  <div key={item} className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <Link to="/tours" className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold px-6 py-3 rounded-xl transition-all hover:scale-105">
                Start Exploring <ArrowRight size={18} />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img src={CAMPUS_IMAGE} alt="UB Campus" className="w-full h-80 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-3xl" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 bg-white/90 backdrop-blur rounded-xl p-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                    <Camera size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Main Administration Building</p>
                    <p className="text-gray-500 text-xs">Click to start tour →</p>
                  </div>
                  <div className="ml-auto flex">
                    {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-yellow-500 fill-yellow-500" />)}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-black mb-4">Ready to Explore UB Campus?</h2>
            <p className="text-blue-200 mb-8 text-lg">Sign up for free and unlock the full campus experience with your student or staff account.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/signup" className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-bold px-8 py-4 rounded-xl transition-all hover:scale-105 text-lg">
                Get Started Free
              </Link>
              <Link to="/map" className="border-2 border-white hover:bg-white hover:text-blue-900 text-white font-bold px-8 py-4 rounded-xl transition-all text-lg">
                View Campus Map
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
