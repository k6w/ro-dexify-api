import { z } from 'zod';

export const ErrorCode = z.enum([
  'INVALID_INPUT',
  'WORD_NOT_FOUND',
  'PROVIDER_DISABLED',
  'PROVIDER_UPSTREAM_ERROR',
  'PROVIDER_TIMEOUT',
  'PROVIDER_BLOCKED_BY_ROBOTS',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const httpStatusForCode: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  WORD_NOT_FOUND: 404,
  PROVIDER_DISABLED: 503,
  PROVIDER_UPSTREAM_ERROR: 502,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_BLOCKED_BY_ROBOTS: 451,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const ProviderError = z.object({
  providerId: z.string(),
  code: ErrorCode,
  message: z.string(),
});
export type ProviderError = z.infer<typeof ProviderError>;

export const ApiErrorEnvelope = z.object({
  error: ApiError,
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelope>;

export class ApiException extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiException';
  }

  get httpStatus(): number {
    return httpStatusForCode[this.code];
  }
}
