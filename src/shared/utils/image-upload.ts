import { File, UploadTask, UploadType } from "expo-file-system";

import { notifyIfSubscriptionExpired } from "@/services/api/subscription-guard";

function guessImageMimeType(uri: string): string {
    const filename = uri.split("/").pop() || "photo.jpg";
    const extension = (/\.(\w+)$/.exec(filename)?.[1] || "jpg").toLowerCase();
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
}

/**
 * Uploads a locally-picked image as multipart/form-data via expo-file-system's
 * native upload task - deliberately NOT fetch() + FormData. With the New
 * Architecture enabled (this app has newArchEnabled: true), React Native's
 * FormData bridge throws "Unsupported FormDataPart implementation" for the
 * {uri, name, type} file-part shape. The native upload task sidesteps that
 * bridge entirely.
 */
export async function uploadImage(
    url: string,
    uri: string,
    options: { fieldName: string; parameters?: Record<string, string>; headers?: Record<string, string> }
): Promise<{ status: number; body: string }> {
    const file = new File(uri);
    const task = new UploadTask(file, url, {
        httpMethod: "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: options.fieldName,
        mimeType: guessImageMimeType(uri),
        parameters: options.parameters,
        headers: options.headers,
    });

    const result = await task.uploadAsync();
    try {
        notifyIfSubscriptionExpired(result.status, result.body ? JSON.parse(result.body) : null);
    } catch {
        // Non-JSON body: not the read-only refusal; callers handle the error as before.
    }
    return { status: result.status, body: result.body };
}
