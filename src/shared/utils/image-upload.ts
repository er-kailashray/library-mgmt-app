import { File, UploadTask, UploadType } from "expo-file-system";
import { Platform } from "react-native";

import { notifyIfSessionExpired } from "@/services/api/session-guard";
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
 *
 * On web (the PWA) there's no upload task, but the browser's own fetch + FormData works: the
 * picked image's uri is a blob:/data: URL that fetch can read back into a Blob.
 */
export async function uploadImage(
    url: string,
    uri: string,
    options: { fieldName: string; parameters?: Record<string, string>; headers?: Record<string, string> }
): Promise<{ status: number; body: string }> {
    const result = Platform.OS === "web" ? await uploadFromBrowser(url, uri, options) : await uploadNative(url, uri, options);
    notifyIfSessionExpired(result.status, Object.keys(options.headers ?? {}).some((key) => key.toLowerCase() === "authorization"));
    try {
        notifyIfSubscriptionExpired(result.status, result.body ? JSON.parse(result.body) : null);
    } catch {
        // Non-JSON body: not the read-only refusal; callers handle the error as before.
    }
    return { status: result.status, body: result.body };
}

type UploadOptions = Parameters<typeof uploadImage>[2];

async function uploadNative(url: string, uri: string, options: UploadOptions) {
    const task = new UploadTask(new File(uri), url, {
        httpMethod: "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: options.fieldName,
        mimeType: guessImageMimeType(uri),
        parameters: options.parameters,
        headers: options.headers,
    });
    const result = await task.uploadAsync();
    return { status: result.status, body: result.body };
}

async function uploadFromBrowser(url: string, uri: string, options: UploadOptions) {
    const blob = await (await fetch(uri)).blob();
    const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const form = new FormData();
    for (const [key, value] of Object.entries(options.parameters ?? {})) form.append(key, value);
    form.append(options.fieldName, blob, `photo.${extension}`);
    // No Content-Type header: the browser sets multipart/form-data with its boundary.
    const response = await fetch(url, { method: "POST", body: form, headers: options.headers });
    return { status: response.status, body: await response.text() };
}
