import { GalleryVerticalEnd } from "lucide-react"

import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form";
import BookScene from "@/components/BookScene";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
       <div className="flex flex-col gap-4 p-6 md:p-10">
    
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <SignupForm />
          </div>
        </div>
      </div>
<div className="relative hidden lg:block login-gradient">
  <BookScene />
</div>

     
    
    </div>

 
  );
}
