"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter();
  const { signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    const ok = await signup(username, password, fullName);
    if (!ok) return setError("Signup failed — user may already exist.");

    router.push("/login");
  };

  return (
  <div className="relative">
   

    <Card
      {...props}
      className="border border-[#1b1d23] text-white shadow-[0_0_40px_rgba(120,93,255,0.08)] rounded-xl backdrop-blur-sm bg-transparent border-none shadow-none"
    >
      <CardHeader className="space-y-1">
        <CardTitle className="text-4xl font-semibold tracking-tight">
          Create Your Account
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSignup} className="space-y-2">
          <FieldGroup className="space-y-1">

            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="Name...."
                className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="username">Email</FieldLabel>
              <Input
                id="username"
                type="text"
                placeholder="user@test.com"
                className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <FieldDescription className="text-gray-500">
                This will be your login identifier.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Password</FieldLabel>
              <Input
                type="password"
                placeholder="••••••••"
                className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <FieldDescription className="text-gray-500">
                Minimum 6 characters.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Confirm Password</FieldLabel>
              <Input
                type="password"
                placeholder="••••••••"
                className="bg-[#16171d] border-[#2b2d34] text-white focus:border-purple-500 transition-colors"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full py-2.5 text-[15px] font-medium  hover:opacity-90 transition rounded-lg shadow-[0_0_18px_rgba(110,73,255,0.35)] bg-purple-500 hover:bg-purple-400"
            >
              Create Account
            </Button>

            <p className="text-center text-sm text-gray-400 pt-2">
              Already have an account?{" "}
              <span
                className="text-sky-400 hover:text-sky-300 cursor-pointer transition"
                onClick={() => router.push("/login")}
              >
                Sign in
              </span>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  </div>
);

}
