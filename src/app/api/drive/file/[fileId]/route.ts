import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return new NextResponse("File ID is required", { status: 400 });
    }

    // Attempt to download file from Google Drive
    const driveUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const response = await fetch(driveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to proxy Google Drive file ${fileId}: status ${response.status}`);
      return new NextResponse(`Error fetching file: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="manuscript-${fileId}.pdf"`,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("Google Drive proxy route error:", error);
    return new NextResponse("Failed to stream manuscript from Google Drive", { status: 500 });
  }
}
