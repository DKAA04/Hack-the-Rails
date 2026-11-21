import type {
  SearchIntent,
  SearchReceipt,
  SearchResult,
} from "@wayward/contracts";
import { unfinished } from "../errors";
export async function search(_intent: SearchIntent): Promise<SearchReceipt> {
  return unfinished("Supplier search");
}
export async function getSearch(_id: string): Promise<SearchResult> {
  return unfinished("Search persistence");
}
