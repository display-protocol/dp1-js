import type { Entity } from './types.js';
import { validateEntityDraft } from './validate-draft.js';

export class EntityBuilder {
  private entity: Partial<Entity> = {};

  name(value: string) {
    this.entity.name = value;
    return this;
  }

  key(value: string) {
    this.entity.key = value;
    return this;
  }

  url(value: string) {
    this.entity.url = value;
    return this;
  }

  build(): Entity {
    const out: Entity = {
      name: String(this.entity.name ?? ''),
      key: String(this.entity.key ?? ''),
      ...(this.entity.url === undefined ? {} : { url: String(this.entity.url) }),
    };
    validateEntityDraft(out);
    return structuredClone(out);
  }
}
