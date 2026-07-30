import { resolve } from './helpers.js';
import type {
  Chain,
  Contract,
  Dependency,
  ProvenanceBlock,
  ProvenanceType,
  TokenStandard,
} from './types.js';
import {
  Contract as ValidateContract,
  Dependency as ValidateDependency,
  ProvenanceBlock as ValidateProvenanceBlock,
} from '../validate/index.js';

export class ContractBuilder {
  private contract: Contract = {};

  chain(value: Chain) {
    this.contract.chain = value;
    return this;
  }

  standard(value: TokenStandard) {
    this.contract.standard = value;
    return this;
  }

  address(value: string) {
    this.contract.address = value;
    return this;
  }

  seriesId(value: number) {
    this.contract.seriesId = value;
    return this;
  }

  tokenId(value: string) {
    this.contract.tokenId = value;
    return this;
  }

  uri(value: string) {
    this.contract.uri = value;
    return this;
  }

  metaHashSha256Hex(value: string) {
    this.contract.metaHash = value;
    return this;
  }

  build(): Contract {
    const out: Contract = structuredClone(this.contract);
    ValidateContract(out);
    return out;
  }
}

export class DependencyBuilder {
  private dep: Dependency = {};
  chain(value: Chain) {
    this.dep.chain = value;
    return this;
  }
  standard(value: TokenStandard) {
    this.dep.standard = value;
    return this;
  }
  uri(value: string) {
    this.dep.uri = value;
    return this;
  }
  build(): Dependency {
    const out: Dependency = structuredClone(this.dep);
    ValidateDependency(out);
    return out;
  }
}

export class ProvenanceBuilder {
  private prov: Partial<ProvenanceBlock> = {};

  type(value: ProvenanceType) {
    this.prov.type = value;
    return this;
  }

  contract(value: Contract | ContractBuilder) {
    this.prov.contract = resolve(value);
    return this;
  }

  addDependency(value: Dependency | DependencyBuilder) {
    if (!this.prov.dependencies) this.prov.dependencies = [];
    this.prov.dependencies.push(resolve(value));
    return this;
  }

  dependencies(values: Array<Dependency | DependencyBuilder>) {
    this.prov.dependencies = values.map(v => resolve(v));
    return this;
  }

  build(): ProvenanceBlock {
    const out: ProvenanceBlock = {
      type: String(this.prov.type ?? '') as ProvenanceType,
      ...(this.prov.contract === undefined ? {} : { contract: this.prov.contract }),
      ...(this.prov.dependencies === undefined ? {} : { dependencies: this.prov.dependencies }),
    };
    ValidateProvenanceBlock(out);
    return structuredClone(out);
  }
}
