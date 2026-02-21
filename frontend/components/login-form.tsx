"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/contexts/AuthContext";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
  const router = useRouter();
  const { login, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (!ok) {
      setError("Invalid username or password");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup className="space-y-4">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-gray-400">
            Log in to continue your workspace
          </p>
        </div>

        {/* Username */}
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            placeholder="john_doe"
            required
            className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>

        {/* Password */}
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <button
              type="button"
              className="ml-auto text-sm text-purple-400 hover:text-purple-300 transition underline-offset-4 hover:underline"
              onClick={() => alert("Password reset coming soon")}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {/* Error */}
        {error && (
          <div className="text-center text-red-400 bg-red-500/10 border border-red-500/20 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Login Button */}
        <Button
          type="submit"
          className="w-full py-2.5 bg-gradient-to-r from-[#6D4BFF] to-[#46A8FF] hover:opacity-90 transition rounded-lg shadow-[0_0_18px_rgba(110,73,255,0.35)]"
        >
          Login
        </Button>

        <FieldSeparator />

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm">
          New here?{" "}
          <span
            onClick={() => router.push("/signup")}
            className="text-purple-400 hover:text-purple-300 cursor-pointer transition underline-offset-4 hover:underline"
          >
            Create an account
          </span>
        </p>

      </FieldGroup>
    </form>
  );
}
