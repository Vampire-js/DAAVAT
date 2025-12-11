"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user != null) router.push("/");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await login(email, password);
    if (!ok) setError("Invalid email or password");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f10] text-white">
      <div className="bg-[#1a1a1c] p-8 rounded-2xl shadow-xl w-96 space-y-6 border border-[#2a2a2d]">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-gray-300">Email</label>
            <Input
              className="bg-[#2a2a2d] text-white border-[#3a3a3d] 
                         focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-300">Password</label>
            <Input
              type="password"
              className="bg-[#2a2a2d] text-white border-[#3a3a3d] 
                         focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 transition"
          >
            Login
          </Button>
        </form>

        <p className="text-sm text-center text-gray-400">
          Don't have an account?{" "}
          <span
            className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
            onClick={() => router.push("/signup")}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}
