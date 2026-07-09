import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";

export async function proxy(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    const { pathname } = request.nextUrl

    // not login
    if (!session) {
        if (pathname === "/login") return NextResponse.next()
        
        const loginUrl = new URL("/login", request.url);

        // save last path
        loginUrl.searchParams.set(
            "callbackUrl",
            pathname
        );

        return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/login") {
        const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/";
        return NextResponse.redirect(new URL(callbackUrl, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)'
};