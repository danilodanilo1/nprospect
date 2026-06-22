import {
  leadsIngestionSchema,
  scraperResultSchema,
  leadCreateSchema,
  leadUpdateSchema,
  prospectingSearchSchema,
} from "./schemas";

export {
  leadsIngestionSchema,
  scraperResultSchema,
  leadCreateSchema,
  leadUpdateSchema,
  prospectingSearchSchema,
};

export type LeadsIngestionInput = ReturnType<typeof leadsIngestionSchema.parse>;
export type ScraperResultInput = ReturnType<typeof scraperResultSchema.parse>;
export type LeadCreateInput = ReturnType<typeof leadCreateSchema.parse>;
export type LeadUpdateInput = ReturnType<typeof leadUpdateSchema.parse>;
export type ProspectingSearchInput = ReturnType<
  typeof prospectingSearchSchema.parse
>;
