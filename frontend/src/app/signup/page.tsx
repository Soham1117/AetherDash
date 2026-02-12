"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import bg from "@/../public/loginBg.png";
import Image from "next/image";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function generateOTP(): string {
  // Generate a random number between 100000 and 999999
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString(); // Convert the number to a string
}

export default function SigupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [error, setError] = useState("");
  const [isVerify, setIsVerify] = useState(false);
  const [otp, setOtp] = useState("");
  const [value, setValue] = useState("");
  const router = useRouter();
  const handleSignup = async (
    email: string,
    password: string,
    setError: (error: string) => void,
    username: string,
    fname: string,
    lname: string
  ) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
          username: username,
          first_name: fname,
          last_name: lname,
          password2: password,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Signup failed";
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          errorMessage =
            data.error || data.detail || JSON.stringify(data) || errorMessage;
        } else {
          const text = await response.text().catch(() => "");
          if (text) {
            errorMessage = text;
          }
        }
        console.error("Signup failed:", response.status, errorMessage);
        throw new Error(errorMessage);
      }
      alert("Sign Up successful");
      router.push("/login");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "An error occurred while logging in.");
    }
  };

  const verify = async () => {
    if (!email) return;
    if (!password) return;
    const otp = generateOTP();

    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: email,
          otp: otp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setOtp(otp);
        setIsVerify(true);
        alert("Email Sent Successfully");
      } else {
        console.error("Email error:", data);
        setError(data.error || data.details || "Failed to send email. Please check your email configuration.");
        alert(data.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error("Error sending email:", err);
      setError("Failed to send email. Please try again.");
      alert("Failed to send email. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    verify();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.toString() !== value.toString()) {
      setError("OTP is incorrect. Please try again.");
    } else {
      handleSignup(email, password, setError, username, fname, lname);
      setIsVerify(false);
    }
  };

  return (
    <div className="grid fixed top-0 w-full min-h-svh lg:grid-cols-2 z-50 bg-[#121212]">
      <div className="relative hidden bg-muted lg:block z-50">
        <Image
          src={bg}
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.6] dark:grayscale"
          layout="fill"
        />
      </div>
      {!isVerify ? (
        <div className="flex flex-col gap-4 p-6 md:p-10 z-50 bg-[#121212]">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="#" className="flex items-center gap-2 font-medium">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GalleryVerticalEnd className="size-4" />
              </div>
              AetherDash
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center z-50">
            <div className="w-full max-w-xs">
              <form
                onSubmit={handleSubmit}
                className={cn("flex flex-col gap-6")}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Create your account</h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Enter your email below to create your account
                  </p>
                </div>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="warfare1947"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fname">First Name</Label>
                    <Input
                      id="fname"
                      type="text"
                      placeholder="John"
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lname">Last Name</Label>
                    <Input
                      id="lname"
                      type="text"
                      placeholder="Doe"
                      value={lname}
                      onChange={(e) => setLname(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <Button type="submit" className="w-full">
                    Sign Up
                  </Button>
                </div>
                <div className="text-center text-sm">
                  Already have an account?{" "}
                  <a href="/login" className="underline underline-offset-4">
                    Login
                  </a>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-6 md:p-10 z-50 bg-[#121212]">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="#" className="flex items-center gap-2 font-medium">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GalleryVerticalEnd className="size-4" />
              </div>
              AetherDash
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center z-50">
            <div className="w-full max-w-xs">
              <form
                onSubmit={handleVerify}
                className={cn("flex flex-col gap-6")}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Verify your Email</h1>
                </div>
                <div className="grid gap-6">
                  <InputOTP
                    maxLength={6}
                    className="w-full"
                    value={value}
                    onChange={(value) => setValue(value)}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Enter your one-time password.</span>
                    <Button 
                      type="button" 
                      variant="link" 
                      size="sm" 
                      onClick={verify} 
                      className="text-white hover:text-white/80 px-0"
                    >
                      Resend Code
                    </Button>
                  </div>

                  <Button type="submit" className="w-full">
                    Verify
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
