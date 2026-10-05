import type { ILead } from "@/models/Lead";
import type { LeadDTO } from "@/types/lead";

export function mapLeadToDTO(lead: ILead): LeadDTO {
  return {
    _id: lead._id.toString(),
    name: lead.name,
    cnpj: lead.cnpj,
    contacts: lead.contacts ?? {},
    status: lead.status,
    score: lead.score,
    sources: lead.sources,
    placeId: lead.placeId,
    metadata: lead.metadata ?? {},
    notes: (lead.notes ?? []).map((note) => ({
      _id: note._id?.toString(),
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      createdBy: note.createdBy?.toString(),
    })),
    assignedTo: lead.assignedTo?.toString(),
    prospectingJobs: (lead.prospectingJobs ?? []).map((jobId) =>
      jobId.toString(),
    ),
    lastProspectingJobId: lead.lastProspectingJobId?.toString(),
    lastActivityAt: lead.lastActivityAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
