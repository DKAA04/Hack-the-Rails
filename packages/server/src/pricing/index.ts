import type {
  RevalidationRequest,
  RevalidationResponse,
} from "@wayward/contracts";
import { unfinished } from "../errors";
export async function revalidate(
  _request: RevalidationRequest,
): Promise<RevalidationResponse> {
  return unfinished("Quote revalidation");
}
