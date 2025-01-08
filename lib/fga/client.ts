import { WorkOS, WarrantOp } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export interface FGAWarrant {
  resourceType: string;
  resourceId: string;
  relation: string;
  subject: {
    resourceType: string;
    resourceId: string;
  };
}

class FGAClient {
  private client: WorkOS;

  constructor(workos: WorkOS) {
    this.client = workos;
  }

  async check(warrant: FGAWarrant): Promise<boolean> {
    try {
      const response = await this.client.fga.check({
        checks: [{
          resource: {
            resourceType: warrant.resourceType,
            resourceId: warrant.resourceId,
          },
          relation: warrant.relation,
          subject: {
            resourceType: warrant.subject.resourceType,
            resourceId: warrant.subject.resourceId,
          },
        }],
      });
      return response.isAuthorized();
    } catch (error) {
      console.error('FGA check error:', error);
      return false;
    }
  }

  async query(warrant: Omit<FGAWarrant, 'resourceId'>): Promise<string[]> {
    try {
      const response = await this.client.fga.listWarrants({
        resourceType: warrant.resourceType,
        subjectId: warrant.subject.resourceId,
        relation: warrant.relation,
      });
      return response.data.map(w => w.resourceId);
    } catch (error) {
      console.error('FGA query error:', error);
      return [];
    }
  }

  async write(warrants: { warrant: FGAWarrant; operation: 'create' | 'delete' }[]): Promise<void> {
    try {
      await this.client.fga.batchWriteWarrants(
        warrants.map(w => ({
          op: w.operation === 'create' ? WarrantOp.Create : WarrantOp.Delete,
          resource: {
            resourceType: w.warrant.resourceType,
            resourceId: w.warrant.resourceId,
          },
          relation: w.warrant.relation,
          subject: {
            resourceType: w.warrant.subject.resourceType,
            resourceId: w.warrant.subject.resourceId,
          },
        }))
      );
    } catch (error) {
      console.error('FGA write error:', error);
      throw error;
    }
  }
}

export const fgaClient = new FGAClient(workos); 