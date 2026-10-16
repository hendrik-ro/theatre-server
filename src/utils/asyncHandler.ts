import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not route async rejections into the error pipeline, so
// every route handler is wrapped with this: controllers stay free of
// try/catch -> next(err) boilerplate and thrown errors reach the
// errorHandler through next. Controllers never call next themselves, so
// it is optional for direct (req, res) invocation in tests.
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
