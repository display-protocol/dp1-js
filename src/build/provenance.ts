import { assertHex64, assertUri, resolve } from './helpers.js';
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

function validateContract(contract: Contract): Contract {
  const out: Contract = {
    ...(contract.chain === undefined ? {} : { chain: contract.chain }),
    ...(contract.standard === undefined ? {} : { standard: contract.standard }),
    ...(contract.address === undefined ? {} : { address: contract.address }),
    ...(contract.seriesId === undefined ? {} : { seriesId: contract.seriesId }),
    ...(contract.tokenId === undefined ? {} : { tokenId: contract.tokenId }),
    ...(contract.uri === undefined ? {} : { uri: contract.uri }),
    ...(contract.metaHash === undefined ? {} : { metaHash: contract.metaHash }),
  };

  if (out.chain !== undefined) assertChain(out.chain, 'contract.chain');
  if (out.standard !== undefined) assertStandard(out.standard, 'contract.standard');
  if (out.seriesId !== undefined) {
    if (!Number.isInteger(out.seriesId) || out.seriesId < 0)
      throw new Error('dp1: contract.seriesId must be an integer >= 0');
  }
  if (out.uri !== undefined) assertUri(out.uri, 'contract.uri');
  if (out.metaHash !== undefined) out.metaHash = assertHex64(out.metaHash, 'contract.metaHash');
  return structuredClone(out);
}

function validateDependency(dep: Dependency): Dependency {
  const out: Dependency = {
    ...(dep.chain === undefined ? {} : { chain: dep.chain }),
    ...(dep.standard === undefined ? {} : { standard: dep.standard }),
    ...(dep.uri === undefined ? {} : { uri: dep.uri }),
  };
  if (out.chain !== undefined) assertChain(out.chain, 'dependency.chain');
  if (out.standard !== undefined) assertStandard(out.standard, 'dependency.standard');
  if (out.uri !== undefined) assertUri(out.uri, 'dependency.uri');
  return structuredClone(out);
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
    return validateContract(this.contract);
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
    return validateDependency(this.dep);
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
    const type = String(this.prov.type ?? '') as ProvenanceType;
    if (!['onChain', 'seriesRegistry', 'offChainURI'].includes(type)) {
      throw new Error('dp1: provenance.type must be onChain|seriesRegistry|offChainURI');
    }
    const out: ProvenanceBlock = {
      type,
      ...(this.prov.contract === undefined ? {} : { contract: validateContract(this.prov.contract) }),
      ...(this.prov.dependencies === undefined
        ? {}
        : { dependencies: this.prov.dependencies.map(validateDependency) }),
    };
    if ((out.type === 'onChain' || out.type === 'seriesRegistry') && !out.contract) {
      throw new Error('dp1: provenance.contract is required for onChain and seriesRegistry');
    }
    return structuredClone(out);
  }
}
