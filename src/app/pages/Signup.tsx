import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, UserPlus, Key } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { UBLogo } from "../components/layout/UBLogo";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student", adminCode: "" });
  const [showPass, setShowPass] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      });
      if (error) throw error;

      // If staff/admin selected, call serverless role assignment (codes stored as env vars on Vercel).
      if (form.role === "admin" || form.role === "staff") {
        // Ensure we have a session access token (signUp may return null session depending on email confirmation settings).
        let accessToken = data.session?.access_token;
        if (!accessToken) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (signInErr || !signInData.session?.access_token) {
            throw new Error(
              "Your account was created, but admin/staff role can only be applied after you can sign in (email confirmation may be enabled). Confirm your email, then sign in and try again."
            );
          }
          accessToken = signInData.session.access_token;
        }
        const res = await fetch("/api/set-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ role: form.role, code: form.adminCode }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Failed to apply role");
        }
      }

      await signIn(form.email, form.password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div key={i} className="absolute w-1 h-1 bg-yellow-400 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [-20, 20, -20], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-blue-800 px-8 py-7 text-center">
          <div className="flex justify-center mb-3">
            <UBLogo size="sm" showText={false} variant="light" />
          </div>
          <h1 className="text-2xl font-black text-white">Create Account</h1>
          <p className="text-blue-200 text-sm mt-1">Join the Virtual Campus Companion Tour</p>
        </div>

        <div className="px-8 py-7">
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-5 text-sm"
            >
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Full Name</label>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" name="name" value={form.name} onChange={handleChange} required
                  placeholder="Hezekiah Anne Felisilda"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" name="email" value={form.email} onChange={handleChange} required
                  placeholder="name@universityofbohol.edu.ph"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Role</label>
              <select name="role" value={form.role} onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
              >
                <option value="student">Student</option>
                <option value="staff">Staff / Faculty</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {/* Admin/Staff Code */}
            {(form.role === "admin" || form.role === "staff") && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  {form.role === "admin" ? "Admin" : "Staff"} Access Code
                </label>
                <div className="relative">
                  <Key size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showAdminCode ? "text" : "password"} name="adminCode" value={form.adminCode} onChange={handleChange}
                    placeholder={form.role === "admin" ? "UB-ADMIN-2024" : "UB-STAFF-2024"}
                    className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
                  />
                  <button type="button" onClick={() => setShowAdminCode(!showAdminCode)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showAdminCode ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPass ? "text" : "password"} name="password" value={form.password} onChange={handleChange} required
                  placeholder="Min. 6 characters"
                  className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPass ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required
                  placeholder="Repeat password"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-gray-50"
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={18} /> Create Account</>}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-700 font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
