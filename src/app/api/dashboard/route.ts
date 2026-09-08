import { NextResponse } from "next/server";
import { adminGatewayResponse, adminRpc } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const result = await adminRpc<unknown>("dashboard");
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
