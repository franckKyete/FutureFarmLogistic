import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Helper to resolve the client's origin from standard HTTP headers.
 * Looks for `origin`, then `referer` (extracting protocol + host).
 */
export function extractClientOrigin(req: Request): string | undefined {
  const originHeader = req.headers['origin'] || req.headers['referer'];

  if (!originHeader) {
    return undefined;
  }

  const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

/**
 * Extracts client origin (protocol + host) from request headers.
 *
 * @example
 * @Post('checkout')
 * checkout(@ClientOrigin() clientOrigin?: string) { ... }
 */
export const ClientOrigin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return extractClientOrigin(request);
  },
);
