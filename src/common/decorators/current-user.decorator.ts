import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext): JwtUser | string => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return data ? req.user[data] : req.user;
  },
);
