"use client"

import Header from "@/components/header";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import NotesLayout from "@/components/NotesLayout";

export default function Home() {
  const router = useRouter();
  const {user} = useAuth();
  useEffect(() => {
    if(user == null) router.push("/login") 
  }, [user, router])
  return (
    <div className="h-screen p-4 bg-black font-sans dark:bg-black">
      <Header/>
      <NotesLayout/>
    </div>
  );
}
