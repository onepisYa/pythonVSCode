import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { IPythonSettings, PythonSettings } from '../common/configSettings';
import { IProcessServiceFactory } from '../common/process/processServiceFactory';
import { captureTelemetry } from '../telemetry';
import { WORKSPACE_SYMBOLS_BUILD } from '../telemetry/constants';

export class Generator implements vscode.Disposable {
    private optionsFile: string;
    private disposables: vscode.Disposable[];
    private pythonSettings: IPythonSettings;
    public get tagFilePath(): string {
        return this.pythonSettings.workspaceSymbols.tagFilePath;
    }
    public get enabled(): boolean {
        return this.pythonSettings.workspaceSymbols.enabled;
    }
    constructor(public readonly workspaceFolder: vscode.Uri, private output: vscode.OutputChannel,
        private processServiceFactory: IProcessServiceFactory) {
        this.disposables = [];
        this.optionsFile = path.join(__dirname, '..', '..', '..', 'resources', 'ctagOptions');
        this.pythonSettings = PythonSettings.getInstance(workspaceFolder);
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    public async generateWorkspaceTags(): Promise<void> {
        if (!this.pythonSettings.workspaceSymbols.enabled) {
            return;
        }
        return await this.generateTags({ directory: this.workspaceFolder.fsPath });
    }
    private buildCmdArgs(): string[] {
        const optionsFile = this.optionsFile.indexOf(' ') > 0 ? `"${this.optionsFile}"` : this.optionsFile;
        const exclusions = this.pythonSettings.workspaceSymbols.exclusionPatterns;
        const excludes = exclusions.length === 0 ? [] : exclusions.map(pattern => `--exclude=${pattern}`);

        return [`--options=${optionsFile}`, '--languages=Python'].concat(excludes);
    }
    @captureTelemetry(WORKSPACE_SYMBOLS_BUILD)
    private generateTags(source: { directory?: string, file?: string }): Promise<void> {
        const tagFile = path.normalize(this.pythonSettings.workspaceSymbols.tagFilePath);
        const cmd = this.pythonSettings.workspaceSymbols.ctagsPath;
        const args = this.buildCmdArgs();

        let outputFile = tagFile;
        if (source.file && source.file.length > 0) {
            source.directory = path.dirname(source.file);
        }

        if (path.dirname(outputFile) === source.directory) {
            outputFile = path.basename(outputFile);
        }
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        outputFile = outputFile.indexOf(' ') > 0 ? `"${outputFile}"` : outputFile;
        args.push(`-o ${outputFile}`, '.');
        this.output.appendLine(`${'-'.repeat(10)}Generating Tags${'-'.repeat(10)}`);
        this.output.appendLine(`${cmd} ${args.join(' ')}`);
        const promise = new Promise<void>((resolve, reject) => {
            const resource = source.directory ? Uri.file(source.directory) : undefined;
            const processService = this.processServiceFactory.create(resource);
            const result = processService.execObservable(cmd, args, { cwd: source.directory });
            let errorMsg = '';
            result.out.subscribe(output => {
                if (output.source === 'stderr') {
                    errorMsg += output.out;
                }
                this.output.append(output.out);
            },
                reject,
                () => {
                    if (errorMsg.length > 0) {
                        reject(new Error(errorMsg));
                    } else {
                        resolve();
                    }
                });
        });

        vscode.window.setStatusBarMessage('Generating Tags', promise);

        return promise;
    }
}
