import { demoRows } from "@/lib/portal-demo/demo-rows";
import { pictureFromFacility } from "./from-rows";
import type { FacilityPicture } from "./picture";

/**
 * Maple Street, as the sample portal already describes it. Counts come from
 * those rows. Anything the sample doesn't share stays null, so the digest
 * asks for it instead of inventing it. Every line is labelled sample.
 */
export function maplePicture(now = new Date()): FacilityPicture {
  return pictureFromFacility(demoRows(now), { occupancyRange: "80-85%" }, { sample: true, now });
}
