const COMMIT_AND_PR_INSTRUCTION =
    "When you are done with code changes, create a git commit yourself. If the current branch does not already have a pull request, create one. The pull request description must only include a summary of the code changes.";

export function appendCommitInstruction(prompt: string) {
    return `${prompt}\n\n${COMMIT_AND_PR_INSTRUCTION}`;
}
