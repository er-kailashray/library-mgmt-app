import { apiPost } from "@/services/api/client";
import { RegisterRequest } from "../types/auth.types";

/**
 * Executes the POST /api/register request.
 */
export async function registerApi(data: RegisterRequest) {
    return apiPost<any>("/api/register", data);
}
