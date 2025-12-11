"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

export interface User {
    _id: string;
    email: string;
    name: string;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    signup: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user if token exists
    const fetchUser = async () => {
        try {
            const res = await apiFetch("/auth/me", {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) throw new Error();

            const data = await res.json();
            setUser(data.user || data); // handles both formats
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    // LOGIN
    const login = async (email: string, password: string): Promise<boolean> => {
        const res = await apiFetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) return false;

        await fetchUser();
        router.push("/");
        return true;
    };

    // SIGNUP
    const signup = async (
        email: string,
        password: string,
        name: string
    ): Promise<boolean> => {
        const res = await apiFetch("/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) return false;

        await fetchUser();
        router.push("/");
        return true;
    };

    // LOGOUT
    const logout = async (): Promise<void> => {
        await apiFetch("/auth/logout", {
            method: "POST",
            credentials: "include",
        });

        setUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
