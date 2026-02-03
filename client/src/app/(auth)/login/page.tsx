"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@/lib/schema";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/providers/auth-context";
import { toast } from "sonner";

type SignInFormData = z.infer<typeof signInSchema>;

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const { login } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const handleOnSubmit = async (values: SignInFormData) => {
    if (isPending) return;
    try {
      setIsPending(true);
      await login(values.email, values.password);
      toast.success("Logged in successfully!", {
        description: "Welcome back to CMS Hub.",
      });
      form.reset();
      const next = searchParams.get("next") || "/dashboard";
      router.replace(next);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || "Login failed";
      toast.error(errorMessage, {
        description: "There was an issue logging in. Please try again.",
      });
      console.error("Error during sign-in:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Subtle radial glow background */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_55%)]" />

      {/* Brand header */}
      <div className="mb-6 text-center">
        {/* <div className="font-serif text-3xl md:text-4xl font-bold tracking-[0.25em] text-primary">
          IFFA
        </div> */}
        <Image src="/assets/IFFA_logo.png" alt="IFFA Logo" width={200} height={200} />
        <div className="h-px w-24 mx-auto my-3 bg-linear-to-r from-transparent via-primary to-transparent opacity-60" />
        <p className="text-xs uppercase tracking-widest text-accent-foreground">
          CMS Hub Sign In
        </p>
      </div>

      <Card className="relative max-w-md w-full shadow-xl border border-border bg-surface-dark">
        <CardHeader className="mb-2 text-center space-y-1">
          <CardTitle className="text-xl font-serif font-bold tracking-widest text-white">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-xs text-accent-foreground tracking-wider">
            Authorized personnel only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleOnSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                          {/* mail icon */}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="size-4"
                          >
                            <path d="M2 6.75A2.75 2.75 0 0 1 4.75 4h14.5A2.75 2.75 0 0 1 22 6.75v10.5A2.75 2.75 0 0 1 19.25 20H4.75A2.75 2.75 0 0 1 2 17.25V6.75Zm2.75-.25a.25.25 0 0 0-.25.25v.383l7.25 4.531 7.25-4.53V6.75a.25.25 0 0 0-.25-.25H4.75Zm14.5 3.367-6.773 4.235a.75.75 0 0 1-.804 0L4.9 9.867V17.25c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25V9.867Z" />
                          </svg>
                        </div>
                        <Input
                          type="email"
                          placeholder="name@iffa.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    {/* <div className="flex justify-between items-center">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-sm text-secondary hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    </div> */}
                    <FormControl>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                          {/* lock icon */}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="size-4"
                          >
                            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 4a1.5 1.5 0 0 1 .75 2.805V18a.75.75 0 0 1-1.5 0v-1.195A1.5 1.5 0 0 1 12 14Z" />
                          </svg>
                        </div>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-primary text-black hover:bg-[#d9a50b] font-bold shadow-[0_0_20px_rgba(242,185,13,0.1)] hover:shadow-[0_0_30px_rgba(242,185,13,0.3)] transition-all duration-300 uppercase tracking-widest text-xs"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <div className="flex items-center justify-center w-full">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-primary hover:underline font-medium"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
