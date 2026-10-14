import { NextResponse } from "next/server";
import { fetchProducts } from "@/lib/products";

export async function GET() {
  try {
    return NextResponse.json(await fetchProducts());
  } catch (error) {
    console.error("PRODUCTS ERROR:", error);
    return NextResponse.json({ error: "Could not fetch Google Sheet" }, { status: 500 });
  }
}
