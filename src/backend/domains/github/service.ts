import { fetchGithubRepos } from "./repository";

export function createGithubService() {
    return {
        async listRepos() {
            return fetchGithubRepos();
        },
    };
}
