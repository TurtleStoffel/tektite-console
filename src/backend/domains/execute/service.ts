import { Result } from "typescript-result";
import * as repository from "./repository";

export type ExecuteServiceError = repository.ExecuteRepositoryError;

export function createExecuteService(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        async execute(input: { prompt: string; repositoryUrl: string }) {
            const preparedResult = await repository.prepare(clonesDir, input.repositoryUrl);
            if (!preparedResult.ok) {
                return Result.error(preparedResult.error);
            }

            const streamResult = repository.stream(
                clonesDir,
                input.prompt,
                preparedResult.value.worktreePath,
            );
            if (!streamResult.ok) {
                return Result.error(streamResult.error);
            }

            return Result.ok(streamResult.value);
        },
    };
}
