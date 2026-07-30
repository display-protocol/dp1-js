import { assertUri, resolve } from './helpers.js';
import type { DynamicQuery, DynamicQueryProfile, ResponseMapping } from './types.js';
import { validateDynamicQueryDraft } from './validate-draft.js';

export class ResponseMappingBuilder {
  private mapping: Partial<ResponseMapping> = {};

  itemsPath(value: string) {
    this.mapping.itemsPath = value;
    return this;
  }

  itemSchema(value: string) {
    this.mapping.itemSchema = value;
    return this;
  }

  itemMap(value: Record<string, string>) {
    this.mapping.itemMap = value;
    return this;
  }

  build(): ResponseMapping {
    const out: ResponseMapping = {
      itemsPath: String(this.mapping.itemsPath ?? ''),
      itemSchema: String(this.mapping.itemSchema ?? ''),
      ...(this.mapping.itemMap === undefined ? {} : { itemMap: this.mapping.itemMap }),
    };
    if (!out.itemsPath)
      throw new Error('dp1: responseMapping.itemsPath must be a non-empty string');
    if (!out.itemSchema)
      throw new Error('dp1: responseMapping.itemSchema must be a non-empty string');
    if (!/^dp1\/\d+\.\d+$/.test(out.itemSchema))
      throw new Error('dp1: responseMapping.itemSchema must look like dp1/1.1');
    return structuredClone(out);
  }
}

export class DynamicQueryBuilder {
  private query: Partial<DynamicQuery> = {};

  profile(value: DynamicQueryProfile) {
    this.query.profile = value;
    return this;
  }

  endpoint(value: string) {
    this.query.endpoint = value;
    return this;
  }

  method(value: 'GET' | 'POST') {
    this.query.method = value;
    return this;
  }

  header(key: string, value: string) {
    if (!this.query.headers) this.query.headers = {};
    this.query.headers[String(key)] = String(value);
    return this;
  }

  headers(value: Record<string, string>) {
    this.query.headers = value;
    return this;
  }

  queryTemplate(value: string) {
    this.query.query = value;
    return this;
  }

  responseMapping(value: ResponseMapping | ResponseMappingBuilder) {
    this.query.responseMapping = resolve(value);
    return this;
  }

  build(): DynamicQuery {
    const responseMapping = this.query.responseMapping
      ? resolve(this.query.responseMapping as ResponseMapping | ResponseMappingBuilder)
      : ({ itemsPath: '', itemSchema: '' } as ResponseMapping);

    const out: DynamicQuery = {
      profile: String(this.query.profile ?? '') as DynamicQueryProfile,
      endpoint: String(this.query.endpoint ?? ''),
      ...(this.query.method === undefined ? {} : { method: this.query.method }),
      ...(this.query.headers === undefined ? {} : { headers: this.query.headers }),
      ...(this.query.query === undefined ? {} : { query: String(this.query.query) }),
      responseMapping,
    };

    assertUri(out.endpoint, 'dynamicQuery.endpoint');
    validateDynamicQueryDraft(out);
    return structuredClone(out);
  }
}
