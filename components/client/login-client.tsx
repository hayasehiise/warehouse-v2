"use client";

import { Button } from "../ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "../ui/input";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

const loginSchema = z.object({
  username: z.string().min(1, "Username Harus Diisi"),
  password: z.string(),
});

type LoginType = z.infer<typeof loginSchema>;

export default function LoginClient() {
  const router = useRouter();
  const searchParam = useSearchParams();
  const callbackUrl = searchParam.get("callbackUrl") ?? "/";

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<LoginType> = async (data) => {
    // console.log(data);
    const { error } = await authClient.signIn.username({
      username: data.username,
      password: data.password,
    });

    if (error) {
      form.setError("username", {
        message: "Username atau Password salah",
      });
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };
  return (
    <>
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="flex flex-col items-center gap-6 w-sm">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Login to your account</CardTitle>
              <CardDescription>
                Enter your email below to login to your account
              </CardDescription>
              <CardAction>
                <Button variant="link">Sign Up</Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <form id="loginForm" onSubmit={form.handleSubmit(onSubmit)}>
                <FieldSet>
                  <FieldGroup>
                    <Controller
                      name="username"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Username</FieldLabel>
                          <Input {...field} />
                          <FieldError>
                            {form.formState.errors.username?.message}
                          </FieldError>
                        </Field>
                      )}
                    />
                    <Controller
                      name="password"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Password</FieldLabel>
                          <Input type="password" {...field} />
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </FieldSet>
              </form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button type="submit" form="loginForm" className="w-full">
                Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
