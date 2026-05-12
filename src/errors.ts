export class CodedError extends Error {
  code: string;
  cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(`${code}: ${message}`);
    this.name = 'CodedError';
    this.code = code;
    this.cause = cause;
  }
}

export const ErrorCode = Object.freeze({
  PlaylistInvalid: 'playlistInvalid',
  PlaylistGroupInvalid: 'playlistGroupInvalid',
  RefManifestInvalid: 'refManifestInvalid',
  ChannelInvalid: 'channelInvalid',
  SigInvalid: 'sigInvalid',
  LicenseDenied: 'licenseDenied',
  ReproMismatch: 'reproMismatch',
  SourceUnreachable: 'sourceUnreachable',
});

export const ErrValidation = new Error('dp1: validation failed');
export const ErrSigInvalid = new Error('dp1: invalid signature');
export const ErrUnsupportedAlg = new Error('dp1: signature algorithm not implemented');
export const ErrNoSignatures = new Error('dp1: no signatures in document');

export function withCode(code: string, err?: unknown) {
  if (!err) return undefined;
  if (err instanceof CodedError) return err;
  const e = err instanceof Error ? err : new Error(String(err));
  return new CodedError(code, e.message ?? String(e), e);
}

export function codeFromValidation(code: string, err?: unknown) {
  if (!err) return undefined;
  if (err === ErrValidation || (err instanceof Error && err.cause === ErrValidation)) {
    return withCode(code, ErrValidation);
  }
  return err;
}

export function isValidationError(err: unknown) {
  return Boolean(
    err && (err === ErrValidation || (err instanceof Error && err.cause === ErrValidation))
  );
}
