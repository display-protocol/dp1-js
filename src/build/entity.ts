import { resolve } from './helpers.js';
import type { Builder } from './helpers.js';
import type { Biography, Entity, EntityRole, Link, Thumbnail } from './types.js';
import { Entity as ValidateEntity } from '../validate/index.js';

/**
 * Builds the shared DP-1 `Entity`: an artist, curator, partner, publisher, or note
 * author (dp1 registry 1.0.9 Entity consolidation). `ArtistBuilder` is this same class
 * under another name — `Artist` is an alias of `Entity` on the wire, so there is one
 * builder for both.
 */
export class EntityBuilder {
  private entity: Partial<Entity> = {};

  name(value: string) {
    this.entity.name = value;
    return this;
  }

  /** Verifiable identity in DID format. Optional and informational only. */
  key(value: string) {
    this.entity.key = value;
    return this;
  }

  /** Opaque, producer-scoped label. Not an identity. */
  id(value: string) {
    this.entity.id = value;
    return this;
  }

  /**
   * @deprecated Write `.addLink({ type: 'website', url })` instead. Still accepted on
   * the wire; a producer that emits both must keep this equal to that entry.
   */
  url(value: string) {
    this.entity.url = value;
    return this;
  }

  /** Disambiguates this entity's function when its position does not already say it. */
  role(value: EntityRole) {
    this.entity.role = value;
    return this;
  }

  /** Where the person or organization is based, as free text. */
  location(value: string) {
    this.entity.location = value;
    return this;
  }

  addresses(values: string[]) {
    this.entity.addresses = [...values];
    return this;
  }

  addAddress(value: string) {
    if (!this.entity.addresses) this.entity.addresses = [];
    this.entity.addresses.push(value);
    return this;
  }

  avatar(value: Thumbnail | Builder<Thumbnail>) {
    this.entity.avatar = resolve(value);
    return this;
  }

  biographies(values: Biography[]) {
    this.entity.biographies = values.map(v => ({ ...v }));
    return this;
  }

  addBiography(value: Biography) {
    if (!this.entity.biographies) this.entity.biographies = [];
    this.entity.biographies.push({ ...value });
    return this;
  }

  links(values: Link[]) {
    this.entity.links = values.map(v => ({ ...v }));
    return this;
  }

  addLink(value: Link) {
    if (!this.entity.links) this.entity.links = [];
    this.entity.links.push({ ...value });
    return this;
  }

  build(): Entity {
    // Spread only what was set, so an untouched optional field stays absent rather than
    // serialising as `undefined` (which JCS would drop but the validator would still see).
    const out: Entity = {
      name: String(this.entity.name ?? ''),
      ...(this.entity.key === undefined ? {} : { key: String(this.entity.key) }),
      ...(this.entity.id === undefined ? {} : { id: String(this.entity.id) }),
      ...(this.entity.url === undefined ? {} : { url: String(this.entity.url) }),
      ...(this.entity.role === undefined ? {} : { role: this.entity.role }),
      ...(this.entity.location === undefined ? {} : { location: this.entity.location }),
      ...(this.entity.addresses === undefined ? {} : { addresses: this.entity.addresses }),
      ...(this.entity.avatar === undefined ? {} : { avatar: this.entity.avatar }),
      ...(this.entity.biographies === undefined ? {} : { biographies: this.entity.biographies }),
      ...(this.entity.links === undefined ? {} : { links: this.entity.links }),
    };
    ValidateEntity(out);
    return structuredClone(out);
  }
}
