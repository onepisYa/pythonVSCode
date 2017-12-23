import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { IWorkspaceSymbolSettings, PythonSettings } from '../../client/common/configSettings';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { SystemVariables } from '../../client/common/variables/systemVariables';
import { initialize, IS_MULTI_ROOT_TEST } from './../initialize';

const workspaceRoot = path.join(__dirname, '..', '..', '..', 'src', 'test');

// Defines a Mocha test suite to group tests of similar kind together
suite('Configuration Settings', () => {
    setup(initialize);

    test('Check Values', done => {
        const systemVariables: SystemVariables = new SystemVariables(workspaceRoot);
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const pythonSettings = PythonSettings.getInstance(vscode.Uri.file(workspaceRoot));
        Object.keys(pythonSettings).forEach(key => {
            let settingValue = pythonConfig.get(key, 'Not a config');
            if (settingValue === 'Not a config') {
                return;
            }
            if (settingValue) {
                settingValue = systemVariables.resolve(settingValue);
            }
            // tslint:disable-next-line:no-any
            const pythonSettingValue = (pythonSettings[key] as string);
            if (key.endsWith('Path') && IS_WINDOWS) {
                assert.equal(settingValue.toUpperCase(), pythonSettingValue.toUpperCase(), `Setting ${key} not the same`);
            } else if (key === 'workspaceSymbols' && IS_WINDOWS) {
                const workspaceSettings = (pythonSettingValue as {} as IWorkspaceSymbolSettings);
                const workspaceSttings = (settingValue as {} as IWorkspaceSymbolSettings);
                assert.equal(workspaceSettings.tagFilePath.toUpperCase(), workspaceSttings.tagFilePath.toUpperCase(), `Setting ${key} not the same`);

                const workspaceSettingsWithoutPath = { ...workspaceSettings };
                delete workspaceSettingsWithoutPath.tagFilePath;
                const pythonSettingValueWithoutPath = { ...(pythonSettingValue as {} as IWorkspaceSymbolSettings) };
                delete pythonSettingValueWithoutPath.tagFilePath;
                assert.deepEqual(workspaceSettingsWithoutPath, pythonSettingValueWithoutPath, `Setting ${key} not the same`);
            }
        });

        done();
    });
});
