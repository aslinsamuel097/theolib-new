/**
 * @fileOverview Google Drive Storage Helper for server-side upload and folder management.
 */

export const TARGET_GOOGLE_DRIVE_FOLDER_ID = "1DyArF92Rg2FX5i7aVPgmt0_rc4Zu3wDN";

export async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const safeName = (name || "General").replace(/'/g, "\\'");
  const query = `name = '${safeName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  try {
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
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
        name: name || "General",
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
  } catch (err: any) {
    console.warn(`Error finding/creating folder "${name}" inside "${parentId}":`, err.message);
    throw err;
  }
}

export async function uploadBufferToGoogleDrive({
  buffer,
  fileName,
  category,
  language,
  token,
}: {
  buffer: Buffer;
  fileName: string;
  category: string;
  language: string;
  token: string;
}) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || TARGET_GOOGLE_DRIVE_FOLDER_ID;

  // 1. Hierarchy: Root -> Subject (Category) -> Language -> PDF
  let targetParentId = rootFolderId;
  try {
    const subjectFolderId = await findOrCreateFolder(token, category || "Theology", rootFolderId);
    const languageFolderId = await findOrCreateFolder(token, language || "English", subjectFolderId);
    targetParentId = languageFolderId || subjectFolderId || rootFolderId;
  } catch (folderError) {
    console.warn("Could not create nested folder structure, uploading directly to target root folder:", folderError);
    targetParentId = rootFolderId;
  }

  const cleanFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // 2. Prepare metadata
  const metadata = {
    name: cleanFileName,
    mimeType: 'application/pdf',
    parents: [targetParentId],
  };

  // 3. Construct RFC-Compliant Multipart Body
  const boundary = '-------314159265358979323846';
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`\r\n${delimiter}\r\nContent-Type: application/pdf\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n${closeDelimiter}`),
  ]);

  // 4. Post to Drive API
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

  // 5. Set Public Permissions (Anyone with link can read)
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
    name: cleanFileName,
  };
}
