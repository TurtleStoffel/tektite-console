import * as repository from "./repository";

export function createExecuteService(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        async execute(input: { prompt: string; repositoryUrl: string }) {
            const { worktreePath } = await repository.prepare(clonesDir, input.repositoryUrl);
            return repository.stream(clonesDir, input.prompt, worktreePath);
        },
    };
}
