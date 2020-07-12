/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

'use strict';

import cp = require('child_process');
import fs = require('fs');
import moment = require('moment');
import path = require('path');
import semver = require('semver');
import util = require('util');
import { getBinPath, getGoPlusConfig,GoVersion} from './util';

export interface Tool {
	name: string;
	importPath: string;
	isImportant: boolean;
    description: string;
    
    // latestVersion and latestVersionTimestamp are hardcoded default values
	// for the last known version of the given tool. We also hardcode values
	// for the latest known pre-release of the tool for the Nightly extension.
	latestVersion?: semver.SemVer;
	latestVersionTimestamp?: moment.Moment;
	latestPrereleaseVersion?: semver.SemVer;
	latestPrereleaseVersionTimestamp?: moment.Moment;

	// minimumGoVersion and maximumGoVersion set the range for the versions of
	// Go with which this tool can be used.
	minimumGoVersion?: semver.SemVer;
	maximumGoVersion?: semver.SemVer;

	// close performs any shutdown tasks that a tool must execute before a new
	// version is installed. It returns a string containing an error message on
	// failure.
	close?: () => Promise<string>;
}

/**
 * Returns the import path for a given tool, at a given Go version.
 * @param tool 		Object of type `Tool` for the Go tool.
 * @param goVersion The current Go version.
 */
export function getImportPath(tool: Tool): string {
	return tool.importPath;
}

export function getImportPathWithVersion(tool: Tool, version: semver.SemVer): string {
	const importPath = getImportPath(tool);
	if (version) {
		return importPath + '@v' + version;
	}
	return importPath;
}

/**
 * Returns boolean denoting if the import path for the given tool ends with `/...`
 * and if the version of Go supports installing wildcard paths in module mode.
 * @param tool  	Object of type `Tool` for the Go tool.
 * @param goVersion The current Go version.
 */
export function disableModulesForWildcard(tool: Tool, goVersion: GoVersion): boolean {
	const importPath = getImportPath(tool);
	const isWildcard = importPath.endsWith('...');

	// Only Go >= 1.13 supports installing wildcards in module mode.
	return isWildcard && goVersion.lt('1.13');
}


export function containsTool(tools: Tool[], tool: Tool): boolean {
	return tools.indexOf(tool) > -1;
}

export function containsString(tools: Tool[], toolName: string): boolean {
	return tools.some((tool) => tool.name === toolName);
}

export function getTool(name: string): Tool {
	return allToolsInformation[name];
}

// hasModSuffix returns true if the given tool has a different, module-specific
// name to avoid conflicts.
export function hasModSuffix(tool: Tool): boolean {
	return tool.name.endsWith('-gomod');
}

export function isGocode(tool: Tool): boolean {
	return tool.name === 'gocode' || tool.name === 'gocode-gomod';
}

export function getConfiguredTools(): Tool[] {
	const tools: Tool[] = [];
	function maybeAddTool(name: string) {
		const tool = allToolsInformation[name];
		if (tool) {
			tools.push(tool);
		}
    }
    
    const goPlusConfig = getGoPlusConfig();


	// Add the format tool that was chosen by the user.
	maybeAddTool(goPlusConfig['formatTool']);
	return tools;
}

export const allToolsInformation: { [key: string]: Tool } = {
	'qfmt': {
		name: 'qfmt',
		importPath: 'github.com/qiniu/goplus/cmd/qfmt',
		isImportant: false,
		description: 'Formatter'
	}
};

/**
 * ToolAtVersion is a Tool at a specific version.
 * Lack of version implies the latest version.
 */
export interface ToolAtVersion extends Tool {
	version?: semver.SemVer;
}

export function getToolAtVersion(name: string, version?: semver.SemVer): ToolAtVersion {
	return { ...allToolsInformation[name], version };
}