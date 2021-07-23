'use strict';

import vscode = require('vscode');
import { getImportablePackages } from './gopPackages';
import { promptForMissingTool } from './gopInstallTools';
import { documentSymbols, GoOutlineImportsOptions } from './goOutline';
import { parseFilePrelude } from './util';

export function getTextEditForAddImport(inputText: string, arg: string): vscode.TextEdit[] {
	// Import name wasn't provided
	if (arg === undefined) {
		return null;
	}

	const { imports, pkg } = parseFilePrelude(inputText);
	if (imports.some((block) => block.pkgs.some((pkgpath) => pkgpath === arg))) {
		return [];
	}

	const multis = imports.filter((x) => x.kind === 'multi');
	const minusCgo = imports.filter((x) => x.kind !== 'pseudo');

	if (multis.length > 0) {
		// There is a multiple import declaration, add to the last one
		const lastImportSection = multis[multis.length - 1];
		if (lastImportSection.end === -1) {
			// For some reason there was an empty import section like `import ()`
			return [vscode.TextEdit.insert(new vscode.Position(lastImportSection.start + 1, 0), `import "${arg}"\n`)];
		}
		// Add import at the start of the block so that goimports/goreturns can order them correctly
		return [vscode.TextEdit.insert(new vscode.Position(lastImportSection.start + 1, 0), '\t"' + arg + '"\n')];
	} else if (minusCgo.length > 0) {
		// There are some number of single line imports, which can just be collapsed into a block import.
		const edits = [];

		edits.push(vscode.TextEdit.insert(new vscode.Position(minusCgo[0].start - 1, 0), 'import (\n\t"' + arg + '"\n'));
		minusCgo.forEach((element) => {
			const currentLine = vscode.window.activeTextEditor.document.lineAt(element.start - 1).text;
			const updatedLine = currentLine.replace(/^\s*import\s*/, '\t');
			edits.push(
				vscode.TextEdit.replace(
					new vscode.Range(element.start - 1, 0, element.start - 1, currentLine.length),
					updatedLine
				)
			);
		});
		edits.push(vscode.TextEdit.insert(new vscode.Position(minusCgo[minusCgo.length - 1].end - 1, 0), ')\n'));

		return edits;
	} else if (pkg && pkg.start >= 0) {
		// There are no import declarations, but there is a package declaration
		return [vscode.TextEdit.insert(new vscode.Position(0, 0), '\nimport (\n\t"' + arg + '"\n)\n')];
	} else {
		// There are no imports and no package declaration - give up
		return [];
	}
}

const missingToolMsg = 'Missing tool: ';

export async function listPackages(excludeImportedPkgs: boolean = false): Promise<string[]> {
	const importedPkgs =
		excludeImportedPkgs && vscode.window.activeTextEditor
			? await getImports(vscode.window.activeTextEditor.document)
			: [];
	const pkgMap = await getImportablePackages(vscode.window.activeTextEditor.document.fileName, true);
	const stdLibs: string[] = [];
	const nonStdLibs: string[] = [];
	pkgMap.forEach((value, key) => {
		if (importedPkgs.some((imported) => imported === key)) {
			return;
		}
		if (value.isStd) {
			stdLibs.push(key);
		} else {
			nonStdLibs.push(key);
		}
	});
	return [...stdLibs.sort(), ...nonStdLibs.sort()];
}

/**
 * Returns the imported packages in the given file
 *
 * @param document TextDocument whose imports need to be returned
 * @returns Array of imported package paths wrapped in a promise
 */
async function getImports(document: vscode.TextDocument): Promise<string[]> {
	const options = {
		fileName: document.fileName,
		importsOption: GoOutlineImportsOptions.Only,
		document
	};

	const symbols = await documentSymbols(options, null);
	if (!symbols || !symbols.length) {
		return [];
	}
	// import names will be of the form "math", so strip the quotes in the beginning and the end
	const imports = symbols[0].children
		.filter((x: any) => x.kind === vscode.SymbolKind.Namespace)
		.map((x: any) => x.name.substr(1, x.name.length - 2));
	return imports;
}

async function askUserForImport(): Promise<string | undefined> {
	try {
		const packages = await listPackages(true);
		return vscode.window.showQuickPick(packages);
	} catch (err) {
		if (typeof err === 'string' && err.startsWith(missingToolMsg)) {
			promptForMissingTool(err.substr(missingToolMsg.length));
		}
	}
}

export function addImport(arg: { importPath: string; from: string }) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found to add imports.');
		return;
	}
	const p = arg && arg.importPath ? Promise.resolve(arg.importPath) : askUserForImport();
	p.then((imp) => {
		if (!imp) {
			return;
		}
		const edits = getTextEditForAddImport(vscode.window.activeTextEditor.document.getText(), imp);
		if (edits && edits.length > 0) {
			const edit = new vscode.WorkspaceEdit();
			edit.set(editor.document.uri, edits);
			vscode.workspace.applyEdit(edit);
		}
	});
}