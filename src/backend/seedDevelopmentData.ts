import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./db/local/schema";
import { projects, repositories } from "./db/local/schema";

type Db = BunSQLiteDatabase<typeof schema>;

const DUMMY_REPOSITORY_URL = "https://github.com/TurtleStoffel/dummy-repository";
const DUMMY_REPOSITORY_NAME = "dummy-repository";
const DUMMY_PROJECT_NAMES = ["Dummy Project Alpha", "Dummy Project Beta", "Dummy Project Gamma"];

export async function seedDevelopmentDataIfEmpty(options: { db: Db; nodeEnv: string | undefined }) {
    if (options.nodeEnv !== "development") {
        console.info("[seed] skipping dummy data seed because NODE_ENV is not development", {
            nodeEnv: options.nodeEnv ?? null,
        });
        return;
    }

    const existingProjects = await options.db
        .select({ id: projects.id })
        .from(projects)
        .limit(1)
        .execute();
    if (existingProjects.length > 0) {
        console.info("[seed] skipping dummy data seed because projects already exist");
        return;
    }

    const repositoryRows = await options.db
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.url, DUMMY_REPOSITORY_URL))
        .limit(1)
        .execute();
    const repositoryId = repositoryRows[0]?.id ?? randomUUID();

    await options.db.transaction(async (tx) => {
        if (!repositoryRows[0]) {
            await tx
                .insert(repositories)
                .values({
                    id: repositoryId,
                    name: DUMMY_REPOSITORY_NAME,
                    url: DUMMY_REPOSITORY_URL,
                })
                .execute();
        }

        await tx
            .insert(projects)
            .values(
                DUMMY_PROJECT_NAMES.map((name) => ({
                    id: randomUUID(),
                    name,
                    repositoryId,
                })),
            )
            .execute();
    });

    console.info("[seed] inserted dummy development data", {
        repositoryUrl: DUMMY_REPOSITORY_URL,
        projectCount: DUMMY_PROJECT_NAMES.length,
    });
}
