/**
 * In-memory run store for demonstration
 * In production, use Redis, PostgreSQL, or similar persistent store
 */
export class RunStore {
  constructor() {
    this.runs = new Map();
  }

  create(run) {
    this.runs.set(run.id, { ...run });
    return run;
  }

  get(id) {
    return this.runs.get(id);
  }

  update(id, updates) {
    const existing = this.runs.get(id);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      this.runs.set(id, updated);
      return updated;
    }
    return null;
  }

  delete(id) {
    return this.runs.delete(id);
  }

  list(filter = {}) {
    const runs = Array.from(this.runs.values());
    
    if (filter.status) {
      return runs.filter(run => run.status === filter.status);
    }
    
    return runs;
  }

  cleanup(maxAge) {
    const cutoff = Date.now() - maxAge;
    const toDelete = [];
    
    for (const [id, run] of this.runs) {
      const runTime = new Date(run.createdAt).getTime();
      if (runTime < cutoff) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => {
      this.runs.delete(id);
    });
    
    return toDelete.length;
  }
}