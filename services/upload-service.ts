// services/upload-service.ts
import { STORAGE_BUCKET_ID, FILE_PREFIXES, APPWRITE_API_KEY_CONFIG } from "@/lib/appwrite";
import { ID } from "appwrite";
import * as FileSystem from 'expo-file-system';

export interface UploadResult {
  fileId: string;
  url: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const uploadService = {
  hasApiKey(): boolean {
    return !!APPWRITE_API_KEY_CONFIG;
  },

  // ============ APPWRITE STORAGE UPLOAD (via XHR) ============
  async uploadWithXHR(uri: string, fileName: string, mimeType: string, filePrefix: string): Promise<UploadResult> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🚀 Starting Appwrite Storage upload via XHR...');
        
        const fileId = `${filePrefix}${ID.unique()}`;
        const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
        const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

        if (!endpoint || !projectId || !this.hasApiKey()) {
          reject(new Error('Missing Appwrite configuration'));
          return;
        }

        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          reject(new Error('File does not exist'));
          return;
        }

        console.log('📁 File details:', { size: (fileInfo as any).size, fileName, mimeType });

        const xhr = new XMLHttpRequest();
        const url = `${endpoint}/storage/buckets/${STORAGE_BUCKET_ID}/files`;

        xhr.open('POST', url);
        xhr.setRequestHeader('X-Appwrite-Project', projectId);
        xhr.setRequestHeader('X-Appwrite-Key', APPWRITE_API_KEY_CONFIG!);

        xhr.onload = function() {
          if (this.status >= 200 && this.status < 300) {
            try {
              const result = JSON.parse(this.response);
              console.log('✅ XHR upload successful:', result);
              
              const fileUrl = `${endpoint}/storage/buckets/${STORAGE_BUCKET_ID}/files/${result.$id}/view?project=${projectId}`;
              
              resolve({
                fileId: result.$id,
                url: fileUrl,
              });
            } catch (parseError) {
              reject(new Error('Failed to parse server response'));
            }
          } else {
            reject(new Error(`Upload failed: ${this.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network request failed'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));

        xhr.timeout = 600000; // 10 minutes

        const formData = new FormData();
        formData.append('fileId', fileId);
        formData.append('file', {
          uri: uri,
          name: fileName,
          type: mimeType,
        } as any);

        xhr.send(formData);
      } catch (error) {
        reject(error);
      }
    });
  },

  // ============ ALTERNATIVE: FETCH WITH BLOB ============
  async uploadWithFetch(uri: string, fileName: string, mimeType: string, filePrefix: string): Promise<UploadResult> {
    try {
      console.log('🌐 Starting fetch upload...');
      
      const fileId = `${filePrefix}${ID.unique()}`;
      const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
      const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

      if (!endpoint || !projectId || !this.hasApiKey()) {
        throw new Error('Missing Appwrite configuration');
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(`data:${mimeType};base64,${base64Data}`);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('file', blob, fileName);

      const url = `${endpoint}/storage/buckets/${STORAGE_BUCKET_ID}/files`;

      const uploadResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Appwrite-Project': projectId,
          'X-Appwrite-Key': APPWRITE_API_KEY_CONFIG!,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} – ${errorText}`);
      }

      const result = await uploadResponse.json();
      const fileUrl = `${endpoint}/storage/buckets/${STORAGE_BUCKET_ID}/files/${result.$id}/view?project=${projectId}`;
      
      return { fileId: result.$id, url: fileUrl };
    } catch (error) {
      console.error('❌ Fetch upload failed:', error);
      throw error;
    }
  },

  // ============ MAIN UPLOAD METHOD ============
  async uploadFile(uri: string, fileName: string, mimeType: string, filePrefix: string): Promise<UploadResult> {
    // First try XHR (most reliable in React Native)
    try {
      return await this.uploadWithXHR(uri, fileName, mimeType, filePrefix);
    } catch (xhrError) {
      console.log('XHR failed, trying fetch...', getErrorMessage(xhrError));
      // For files < 10MB, try fetch as fallback
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        const size = (fileInfo as any).size;
        if (size && size < 10 * 1024 * 1024) {
          return await this.uploadWithFetch(uri, fileName, mimeType, filePrefix);
        }
      }
      throw xhrError;
    }
  },

  // ============ CONVENIENCE METHODS ============
  async uploadDriverDocument(uri: string, fileName?: string): Promise<UploadResult> {
    const finalFileName = fileName || `driver-${Date.now()}.jpg`;
    return this.uploadFile(uri, finalFileName, 'image/jpeg', FILE_PREFIXES.DRIVER_DOCS);
  },

  async uploadSchoolDocument(uri: string, fileName?: string): Promise<UploadResult> {
    const finalFileName = fileName || `school-${Date.now()}.jpg`;
    return this.uploadFile(uri, finalFileName, 'image/jpeg', FILE_PREFIXES.SCHOOL_DOCS);
  },
};