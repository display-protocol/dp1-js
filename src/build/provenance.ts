import { assertUri } from './helpers.js';
import type {
  Chain,
  Contract,
  Dependency,
  ProvenanceBlock,
  ProvenanceType,
  TokenStandard,
} from './types.js';

function assertChain(value: unknown, fieldName: string): asserts value is Chain {
  const v = String(value ?? '');
  if (!['evm', 'tezos', 'bitmark', 'other'].includes(v))
    throw new Error(`dp1: ${fieldName} must be one of evm|tezos|bitmark|other`);
}

function assertStandard(value: unknown, fieldName: string): asserts value is TokenStandard {
  const v = String(value ?? '');
  if (!['erc721', 'erc1155', 'fa2', 'other'].includes(v))
    throw new Error(`dp1: ${fieldName} must be one of erc721|erc1155|fa2|other`);
}

function assertHex64(value: string, fieldName: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`dp1: ${fieldName} must be 64 hex chars`);
}

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
    const out: Contract = {
      ...(this.contract.chain === undefined ? {} : { chain: this.contract.chain }),
      ...(this.contract.standard === undefined ? {} : { standard: this.contract.standard }),
      ...(this.contract.address === undefined ? {} : { address: this.contract.address }),
      ...(this.contract.seriesId === undefined ? {} : { seriesId: this.contract.seriesId }),
      ...(this.contract.tokenId === undefined ? {} : { tokenId: this.contract.tokenId }),
      ...(this.contract.uri === undefined ? {} : { uri: this.contract.uri }),
      ...(this.contract.metaHash === undefined ? {} : { metaHash: this.contract.metaHash }),
    };

    if (out.chain !== undefined) assertChain(out.chain, 'contract.chain');
    if (out.standard !== undefined) assertStandard(out.standard, 'contract.standard');
    if (out.seriesId !== undefined) {
      if (!Number.isInteger(out.seriesId) || out.seriesId < 0)
        throw new Error('dp1: contract.seriesId must be an integer >= 0');
    }
    if (out.uri !== undefined) assertUri(out.uri, 'contract.uri');
    if (out.metaHash !== undefined) assertHex64(out.metaHash, 'contract.metaHash');
    return structuredClone(out);
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
    const out: Dependency = {
      ...(this.dep.chain === undefined ? {} : { chain: this.dep.chain }),
      ...(this.dep.standard === undefined ? {} : { standard: this.dep.standard }),
      ...(this.dep.uri === undefined ? {} : { uri: this.dep.uri }),
    };
    if (out.chain !== undefined) assertChain(out.chain, 'dependency.chain');
    if (out.standard !== undefined) assertStandard(out.standard, 'dependency.standard');
    if (out.uri !== undefined) assertUri(out.uri, 'dependency.uri');
    return structuredClone(out);
  }
}

export class ProvenanceBuilder {
  private prov: Partial<ProvenanceBlock> = {};

  type(value: ProvenanceType) {
    this.prov.type = value;
    return this;
  }

  contract(value: Contract | ContractBuilder) {
    this.prov.contract = typeof value === 'object' && 'build' in value ? value.build() : value;
    return this;
  }

  addDependency(value: Dependency | DependencyBuilder) {
    if (!this.prov.dependencies) this.prov.dependencies = [];
    this.prov.dependencies.push(typeof value === 'object' && 'build' in value ? value.build() : value);
    return this;
  }

  dependencies(values: Array<Dependency | DependencyBuilder>) {
    this.prov.dependencies = values.map(v => (typeof v === 'object' && 'build' in v ? v.build() : v));
    return this;
  }

  build(): ProvenanceBlock {
    const type = String(this.prov.type ?? '') as ProvenanceType;
    if (!['onChain', 'seriesRegistry', 'offChainURI'].includes(type)) {
      throw new Error('dp1: provenance.type must be onChain|seriesRegistry|offChainURI');
    }
    const out: ProvenanceBlock = {
      type,
      ...(this.prov.contract === undefined ? {} : { contract: this.prov.contract as Contract }),
      ...(this.prov.dependencies === undefined ? {} : { dependencies: this.prov.dependencies }),
    };
    if ((out.type === 'onChain' || out.type === 'seriesRegistry') && !out.contract) {
      throw new Error('dp1: provenance.contract is required for onChain and seriesRegistry');
    }
    if (out.contract) {
      if (out.contract.chain !== undefined) assertChain(out.contract.chain, 'contract.chain');
      if (out.contract.standard !== undefined)
        assertStandard(out.contract.standard, 'contract.standard');
      if (out.contract.seriesId !== undefined) {
        if (!Number.isInteger(out.contract.seriesId) || out.contract.seriesId < 0)
          throw new Error('dp1: contract.seriesId must be an integer >= 0');
      }
      if (out.contract.uri !== undefined) assertUri(out.contract.uri, 'contract.uri');
      if (out.contract.metaHash !== undefined) assertHex64(out.contract.metaHash, 'contract.metaHash');
    }
    return structuredClone(out);
  }
}

