'use strict';

import vscode = require('vscode');
import { GoPlusCompletionItemProvider } from './gopSuggest';
import { GOP_MODE,SPX_MODE } from './gopMode';
import { GoPlusDocumentFormattingEditProvider } from './gopFormat';
import { GoHoverProvider } from './gopExtraInfo';
import { GoDefinitionProvider } from './goDeclaration';
import { addImport } from './gopImport';

export function activate(ctx: vscode.ExtensionContext): void {
    vscode.languages.registerCompletionItemProvider(GOP_MODE, new GoPlusCompletionItemProvider(ctx.globalState), '.', '"')
    vscode.languages.registerDocumentFormattingEditProvider(GOP_MODE, new GoPlusDocumentFormattingEditProvider())
    vscode.languages.registerHoverProvider(GOP_MODE, new GoHoverProvider());
    vscode.languages.registerDefinitionProvider(GOP_MODE, new GoDefinitionProvider());

    vscode.languages.registerCompletionItemProvider(SPX_MODE, new GoPlusCompletionItemProvider(ctx.globalState), '.', '"')
    vscode.languages.registerDocumentFormattingEditProvider(SPX_MODE, new GoPlusDocumentFormattingEditProvider())
    vscode.languages.registerHoverProvider(SPX_MODE, new GoHoverProvider());
    vscode.languages.registerDefinitionProvider(SPX_MODE, new GoDefinitionProvider());

    vscode.commands.registerCommand('goplus.import.add', (arg) => {
        return addImport(arg);
    })
}