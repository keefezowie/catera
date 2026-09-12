import { assertSameOrigin } from "@/lib/request-origin";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { session } from "@/lib/auth";
import { demoEnabled } from "@catera/backend";

const folder = () => path.resolve(process.cwd(), "../../.data/v1-uploads");

function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentSession = await session(request);
    if (
      !currentSession.actor?.catererId ||
      currentSession.actor.role !== "owner"
    ) {
      return errorResponse("FORBIDDEN", "Owner access is required", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !file.size) {
      return errorResponse("INVALID_SIZE", "Image must be under 8 MB", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const type = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "jpg"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
    if (!type) {
      return errorResponse("INVALID_TYPE", "Use PNG, JPEG or WebP", 400);
    }

    const name = `${crypto.randomUUID()}.${type}`;
    let url: string;
    if (demoEnabled()) {
      await mkdir(folder(), { recursive: true });
      await writeFile(path.join(folder(), name), bytes);
      url = `/api/uploads?file=${name}`;
    } else {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (
        !base ||
        !key ||
        !currentSession.token ||
        base.includes("otmanljypltxkwjcebni")
      ) {
        throw new Error("NOT_CONFIGURED");
      }

      const client = createClient(base, key, {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${currentSession.token}` },
        },
      });
      const object = `${currentSession.actor.catererId}/${name}`;
      const { error } = await client.storage
        .from("catera-v1-food")
        .upload(object, bytes, {
          contentType: type === "jpg" ? "image/jpeg" : `image/${type}`,
          upsert: false,
        });
      if (error) {
        console.error("Food photo storage upload failed", {
          name: error.name,
          message: error.message,
          status: "status" in error ? error.status : undefined,
        });
        throw new Error("UPLOAD_FAILED");
      }
      url = client.storage.from("catera-v1-food").getPublicUrl(object)
        .data.publicUrl;
    }

    return Response.json(
      { data: { url } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return errorResponse("FORBIDDEN", "Request origin is not allowed", 403);
    }
    console.error("Food photo upload failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return errorResponse(
      "UPLOAD_UNAVAILABLE",
      "Upload unavailable. Check storage configuration.",
      503,
    );
  }
}

export async function GET(request: Request) {
  if (!demoEnabled()) return new Response("Not found", { status: 404 });
  const file = new URL(request.url).searchParams.get("file") || "";
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(folder(), file));
    return new Response(bytes, {
      headers: {
        "Content-Type": file.endsWith(".jpg")
          ? "image/jpeg"
          : file.endsWith(".png")
            ? "image/png"
            : "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public,max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
