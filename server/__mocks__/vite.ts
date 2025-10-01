export const log = {
  info: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  debug: (..._args: unknown[]) => {},
};

export const setupVite = async () => ({
  app: { use: () => {} },
});

export const serveStatic = () => {};
