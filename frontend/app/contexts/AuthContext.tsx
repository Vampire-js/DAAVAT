"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

export interface User {
    id: string;
    username: string;
    name: string;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    signup: (username: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Wrapped in useCallback to prevent infinite effect loops
    const fetchUser = useCallback(async () => {
        try {
            const res = await apiFetch("/auth/me", {
                method: "GET",
                // credentials: "include" is handled within apiFetch helper, 
                // but kept here for explicit safety if apiFetch changes.
                credentials: "include", 
            });
            
            if (!res.ok) {
                if (res.status === 401) setUser(null);
                throw new Error("Unauthorized");
            }
            
            const data = await res.json();
            setUser(data);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load
        fetchUser();

        // FIX: Re-verify session when window is focused (laptop wakes up)
        const handleFocus = () => {
            console.log("App focused: Verifying session...");
            fetchUser();
        };

        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchUser]);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email: username, password }),
            });

            if (!res.ok) return false;

            await fetchUser();
            router.push("/");
            return true;
        } catch (error) {
            console.error("Login error:", error);
            return false;
        }
    };

    const signup = async (
        username: string,
        password: string,
        name: string
    ): Promise<boolean> => {
        try {
            const res = await apiFetch("/auth/signup", {
                method: "POST",
                body: JSON.stringify({ email: username, password, name }),
            });
            return res.ok;
        } catch (error) {
            console.error("Signup error:", error);
            return false;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            // Note: Updated to POST to match your backend auth.js logout route
            await apiFetch("/auth/logout", { 
                method: "POST" 
            });
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setUser(null);
            router.push("/login");
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}