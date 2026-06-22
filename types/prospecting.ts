export type ProspectingJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface ProspectingFilters {
  region?: string;
  radiusKm?: number;
  keywords?: string[];
  pncpObject?: string;
  sources?: ("GOOGLE_PLACES" | "PNCP_BID")[];
}

export interface ProspectingJobDTO {
  _id: string;
  status: ProspectingJobStatus;
  filters: ProspectingFilters;
  leadsFound: number;
  error?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
