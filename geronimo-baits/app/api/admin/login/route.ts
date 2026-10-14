import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
} from "@/lib/adminAuth";

// POST: log in with { password }. DELETE: log out.
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: "ADMIN_PASSWORD is not set in .env.local" },
      { status: 500 }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    password = "";
  }

  if (!checkPassword(password)) {
    // Small delay slows down anyone guessing passwords.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json(
      { success: false, error: "Wrong password" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
