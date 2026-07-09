import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { accessControl, admin, supervisor, staff } from "./role-permission";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: "mysql"
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        username(),
        adminPlugin({
            ac: accessControl,
            roles: {
                admin,
                supervisor,
                staff,
            },
        }),
    ],
});