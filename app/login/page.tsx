import { Suspense } from "react";
import LoginClient from "@/components/client/login-client";

export default function Login() {
    return (
        <Suspense>
            <LoginClient />
        </Suspense>
    )
}