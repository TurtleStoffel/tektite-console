declare module "madge" {
    type DependencyObject = Record<string, string[]>;

    type MadgeResult = {
        obj: () => DependencyObject;
    };

    type MadgeOptions = {
        fileExtensions?: string[];
        includeNpm?: boolean;
    };

    export default function madge(path: string, config?: MadgeOptions): Promise<MadgeResult>;
}
