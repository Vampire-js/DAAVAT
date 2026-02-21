"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "./ui/button";
import { useAuth } from "@/app/contexts/AuthContext";

export default function Header() {
    const {logout} = useAuth();
    return (    
        <div className="flex justify-end border-b border-b-stone-800 pb-4">
            <div className="flex items-center gap-2">
            <Button className="px-0 rounded-full border-2 border-stone-800">
                <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
            </Button>
            <Button className="bg-white text-black rounded-full hover:bg-gray-300" onClick={() => logout()}>Log Out</Button>
         
            </div>
        </div>)
}