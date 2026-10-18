export type StorageReport = {
  engine: "postgres" | "sqlite";
  persistent: boolean;
  message: string;
};

export function storageReport(env: NodeJS.ProcessEnv = process.env): StorageReport {
  const url = env.DATABASE_URL ?? "";
  if (/^(postgres(ql)?:\/\/|prisma\+postgres)/i.test(url)) {
    return {
      engine: "postgres",
      persistent: true,
      message: "PostgreSQL is connected. Panel data survives deploys.",
    };
  }
  const volume = env.RAILWAY_VOLUME_MOUNT_PATH;
  if (volume && url.includes(volume)) {
    return {
      engine: "sqlite",
      persistent: true,
      message: "SQLite is on a Railway volume. Panel data survives deploys.",
    };
  }
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID) {
    return {
      engine: "sqlite",
      persistent: false,
      message:
        "This Railway service is using temporary SQLite. Every new deploy wipes panels and other data. Attach a Postgres plugin and set DATABASE_URL on this web service. No existing database will be changed.",
    };
  }
  return {
    engine: "sqlite",
    persistent: true,
    message: "Local SQLite file is in use.",
  };
}
