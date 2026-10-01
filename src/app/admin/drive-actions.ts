'use server';

/**
 * @fileOverview Server Actions for Google Drive Archival Storage.
 * Handles OAuth authentication, folder hierarchy management, and RFC-compliant binary transmission.
 */

const TARGET_GOOGLE_DRIVE_FOLDER_ID = "1DyArF92Rg2FX5i7aVPgmt0_rc4Zu3wDN";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

  // Guard against missing .env variables
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Server environment credentials missing. Use client OAuth token or configure .env variables.');
  }

  // Use URLSearchParams for application/x-www-form-urlencoded as per Google OAuth 2.0 spec
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Google Token Refresh Error Response:', data);
    throw new Error(data.error_description || data.error || 'Bad Request');
  }

  return data.access_token;
}

export async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const query = `name = '${safeName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchResp.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const createData = await createResp.json();
  if (!createResp.ok) {
    console.warn('Folder creation warning:', createData);
    throw new Error(createData.error?.message || 'Folder creation failed');
  }
  return createData.id;
}

export async function uploadToGoogleDrive(formData: FormData, explicitToken?: string) {
  try {
    const file = formData.get('file') as File;
    const language = (formData.get('language') as string) || "English";
    const category = (formData.get('category') as string) || "General";
    const passedToken = (formData.get('accessToken') as string) || explicitToken;
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || TARGET_GOOGLE_DRIVE_FOLDER_ID;

    if (!file) {
      throw new Error("No file provided for upload.");
    }

    let token = passedToken?.trim();
    if (!token) {
      try {
        token = await getAccessToken();
      } catch (err: any) {
        console.warn("Server credentials check:", err.message);
      }
    }

    if (!token) {
      throw new Error("Google Drive access token missing. Please connect your Google account (intheolib@gmail.com) in the Admin Panel to save manuscripts directly into your Drive.");
    }

    // 1. Hierarchy: Root -> Subject (Category) -> Language -> PDF
    let targetParentId = rootFolderId;
    try {
      // Step A: Find or create the Subject (Category) folder inside the Root folder
      const subjectFolderId = await findOrCreateFolder(token, category, rootFolderId);
      // Step B: Find or create the Language folder inside the Subject folder
      const languageFolderId = await findOrCreateFolder(token, language, subjectFolderId);
      targetParentId = languageFolderId || subjectFolderId || rootFolderId;
    } catch (folderError) {
      console.warn("Could not create nested folder structure, uploading directly to target root folder:", folderError);
      targetParentId = rootFolderId;
    }

    // 2. Prepare File Metadata
    const metadata = {
      name: file.name,
      mimeType: 'application/pdf',
      parents: [targetParentId],
    };

    // 3. Construct RFC-Compliant Multipart Body (metadata + file buffer)
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const boundary = '-------314159265358979323846';
    const delimiter = `--${boundary}`;
    const closeDelimiter = `--${boundary}--`;

    // Strict multipart/related construction with CRLF endings as required by Drive API
    const multipartBody = Buffer.concat([
      Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`\r\n${delimiter}\r\nContent-Type: application/pdf\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n${closeDelimiter}`),
    ]);

    // 4. Post to Drive API with uploadType=multipart
    const uploadResp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const uploadData = await uploadResp.json();

    if (!uploadResp.ok) {
      console.error('Google Drive Upload Error:', uploadData);
      throw new Error(`Drive Upload Error (${uploadResp.status}): ${uploadData.error?.message || 'Bad Request'}`);
    }

    const fileId = uploadData.id;

    // 5. Set Public Permissions (Anyone with link can view)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permError) {
      console.warn("Could not set public permission on Drive file:", permError);
    }

    return { 
      success: true, 
      url: `https://drive.google.com/uc?id=${fileId}&export=download`,
      fileId,
      folderId: targetParentId,
      name: file.name
    };

  } catch (error: any) {
    console.error("Drive Archival Error:", error);
    return { success: false, error: error.message };
  }
}
