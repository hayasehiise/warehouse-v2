import { auth } from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
    const data = {
        name: "Hery Setiawan",
        email: "admin@app.com",
        password: "adminapp",
        username: "adminapp",
        displayUsername: "Admin App",

        employee_code: "11111111 222222 3 444",
        employee_rank: "Test",
        employee_position: "Admin",
        employee_group: "X/"
    }
    
    const checkUser = await prisma.user.findUnique({
        where: {
            email: data.email
        }
    })

    if(checkUser) {
        return NextResponse.json({ message: "User already exists" }, {status: 409});
    }

    const signUpResult = await auth.api.signUpEmail({
        body: {
            email: data.email,
            password: data.password,
            username: data.username,
            name: data.name,
            displayUsername: data.displayUsername
        }
    });

    // check if sign up success
    if (!signUpResult.user) {
        return NextResponse.json({ message: "Failed to sign up" }, {status: 500});
    }

    // create profile
    const createProfile = await prisma.profile.create({
        data: {
            userId: signUpResult.user.id,
            employee_code: data.employee_code,
            employee_rank: data.employee_rank,
            employee_position: data.employee_position,
            employee_group: data.employee_group
        }
    });

    // return if create profile failed
    if(!createProfile) {
        return NextResponse.json({ message: "Failed to create profile" }, {status: 500});
    }

    // update role sign up user to admin
    const updateRole = await prisma.user.update({
        where: {
            id: signUpResult.user.id
        },
        data: {
            role: "admin",
        }
    });

    // return if update role failed
    if(!updateRole) {
        return NextResponse.json({ message: "Failed to update role" }, {status: 500});
    }

    return NextResponse.json({ message: "User created successfully" }, {status: 200});
}