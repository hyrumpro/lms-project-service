import { handleMobile } from "@/server/api/mobile";

type Params = Promise<{ slug: string[] }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  return handleMobile(request, slug);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  return handleMobile(request, slug);
}
