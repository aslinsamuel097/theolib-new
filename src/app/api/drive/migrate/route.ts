import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToGoogleDrive } from "@/lib/drive-storage-helper";

export const dynamic = 'force-dynamic';

async function getServerAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Server Google OAuth credentials missing. Pass accessToken from client session.');
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh server token');
  }

  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, pdfUrl, title, category, language, accessToken } = body;

    if (!pdfUrl) {
      return NextResponse.json({ success: false, error: "Missing pdfUrl parameter." }, { status: 400 });
    }

    let token = accessToken?.trim();
    if (!token) {
      try {
        token = await getServerAccessToken();
      } catch (err: any) {
        console.warn("Server credentials check in migration:", err.message);
      }
    }

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "Google Drive access token missing. Please connect Drive (intheolib@gmail.com) in Admin Panel."
      }, { status: 401 });
    }

    // 1. Download PDF stream from the current storage URL (Firebase Storage)
    const downloadRes = await fetch(pdfUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to fetch source PDF from storage: ${downloadRes.status} ${downloadRes.statusText}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Upload to Google Drive within Subject (Category) -> Language hierarchy
    const safeTitle = (title || bookId || "manuscript").trim();
    const result = await uploadBufferToGoogleDrive({
      buffer,
      fileName: safeTitle,
      category: category || "Theology",
      language: language || "English",
      token,
    });

    return NextResponse.json({
      success: true,
      bookId,
      title: safeTitle,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Migration error for PDF:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to migrate PDF to Google Drive"
    }, { status: 500 });
  }
}
