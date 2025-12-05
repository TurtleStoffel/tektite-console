export type GithubRepo = {
    name: string;
    description?: string;
    visibility?: string;
    url: string;
    owner?: {
        login?: string;
    };
};
