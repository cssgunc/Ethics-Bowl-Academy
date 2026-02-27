import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase/firebaseConfig';

const ALLOWED_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadStepImageResult {
  url: string;
  contentType: string;
}

/**
 * Uploads an image to Firebase Storage under the step-images path and returns
 * its download URL. Mirrors the PDF upload pattern in AdditionalResourcesEditorModal.
 *
 * Storage path:
 *   modules/{moduleId}/stepImages/{stepType}/{timestamp}_{sanitizedName}
 *   modules/{moduleId}/stepImages/{stepType}/{stepId}/{timestamp}_{sanitizedName}  (when stepId supplied)
 *
 * @param file      The image File from an <input> or a paste event.
 * @param moduleId  Firestore module document ID.
 * @param stepType  e.g. "flashcards" | "quizzes" | "freeResponses"
 * @param userId    UID of the uploading user (for metadata).
 * @param stepId    Optional step document ID for a more specific path.
 */
export async function uploadStepImage(
  file: File,
  moduleId: string,
  stepType: string,
  userId: string,
  stepId?: string,
): Promise<UploadStepImageResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `File type "${file.type}" is not allowed. Allowed types: ${[...ALLOWED_TYPES].join(', ')}`,
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error(`Image must be smaller than ${MAX_BYTES / (1024 * 1024)} MB`);
  }

  if (!storage) {
    throw new Error('Firebase Storage is not initialized');
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${timestamp}_${sanitizedName}`;

  const pathSegments = ['modules', moduleId, 'stepImages', stepType];
  if (stepId) pathSegments.push(stepId);
  pathSegments.push(filename);
  const storagePath = pathSegments.join('/');

  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);

  // Save metadata — same collection as PDF uploads; non-fatal if it fails.
  try {
    if (db && userId) {
      await addDoc(collection(db, 'uploadedFiles'), {
        filename: file.name,
        sanitizedName,
        storagePath,
        downloadURL: url,
        moduleId,
        ...(stepId ? { stepId } : {}),
        stepType,
        userId,
        size: file.size,
        type: file.type,
        uploadedAt: serverTimestamp(),
      });
    }
  } catch (metadataError) {
    console.error('[uploadStepImage] Could not save metadata:', metadataError);
  }

  return { url, contentType: file.type };
}

/**
 * Extracts the first image File from a React clipboard event.
 * Returns null when the clipboard carries no image data so callers can let
 * normal text paste proceed unmodified.
 */
export function getImageFromClipboard(
  e: React.ClipboardEvent,
): File | null {
  const { items } = e.clipboardData;
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}
