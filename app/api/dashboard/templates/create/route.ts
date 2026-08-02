import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-service";
import { createMetaTemplate } from "@/lib/meta-templates";

const TEMPLATE_LANGUAGE = "en_US";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const name: string | undefined = payload?.name;
  const templateBody: string | undefined = payload?.body;
  const category: string | undefined = payload?.category;

  if (!name || !templateBody || (category !== "marketing" && category !== "utility")) {
    return NextResponse.json(
      { error: "name, body, and category ('marketing' | 'utility') are required" },
      { status: 400 }
    );
  }

  const result = await createMetaTemplate({
    name,
    body: templateBody,
    category,
    language: TEMPLATE_LANGUAGE,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const service = createServiceClient();
  const { data: created, error: dbError } = await service
    .from("templates")
    .insert({
      name: result.metaName,
      meta_template_id: result.metaTemplateId,
      status: result.status,
      body: templateBody,
      category,
      language: TEMPLATE_LANGUAGE,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ template: created });
}
