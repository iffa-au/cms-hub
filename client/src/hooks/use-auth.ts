import { postData } from "@/lib/fetch-util";
import type { SignUpFormData } from "@/app/(auth)/signup/page";
import { useMutation } from "@tanstack/react-query";

export const useSignUpMutation = () => {
  return useMutation({
    // Map frontend fields to backend API contract
    mutationFn: (data: SignUpFormData) =>
      postData("/auth/register", {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      }),
  });
};

export const useLogInMutation = () => {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      postData("/auth/login", data),
  });
};
