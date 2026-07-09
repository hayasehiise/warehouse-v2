import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";
import { accessControl, admin, supervisor, staff } from "./role-permission";

export const authClient = createAuthClient({
    baseUrl: process.env.BETTER_AUTH_URL, // it's optional if same domain, but recommended for clarity
    plugins: [
        usernameClient(),
        adminClient({
            ac: accessControl,
            roles: {
                admin,
                supervisor,
                staff,
            },
        }),
    ]
});