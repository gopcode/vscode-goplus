/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import cp = require('child_process');
import path = require('path');
import vscode = require('vscode');
import { toolExecutionEnvironment } from './goEnv';
import { promptForMissingTool, promptForUpdatingTool } from './gopInstallTools';
import { envPath, fixDriveCasingInWindows, getCurrentGoRoot, getCurrentGoWorkspaceFromGOPATH } from './goPath';
import { getBinPath, getCurrentGoPath, getGoVersion } from './util';

type GopkgsDone = (res: Map<string, PackageInfo>) => void;
interface Cache {
	entry: Map<string, PackageInfo>;
	lastHit: number;
}

export interface PackageInfo {
	name: string;
	isStd: boolean;
}


let gopkgsNotified: boolean = false;
const allPkgsCache: Map<string, Cache> = new Map<string, Cache>();
const pkgRootDirs = new Map<string, string>();
let cacheTimeout: number = 5000;
const gopkgsSubscriptions: Map<string, GopkgsDone[]> = new Map<string, GopkgsDone[]>();
const gopkgsRunning: Set<string> = new Set<string>();


function gopkgs(workDir?: string): Promise<Map<string, PackageInfo>> {
	return new Promise<Map<string, PackageInfo>>((resolve, reject) => {
        const pkgs = new Map<string, PackageInfo>();
        var output = "errors;errors\nflag;flag\nfmt;fmt\nio;io\nnet;net\nos;os\nreflect;reflect\nstrconv;strconv\nstrings;strings\nsync;sync\n"
        output.split('\n').forEach((pkgDetail) => {
            const [pkgName, pkgPath] = pkgDetail.trim().split(';');
            pkgs.set(pkgPath, {
                name: pkgName,
                isStd: true
            });
        });
        return  resolve(pkgs);
	});
}
/**
 * Returns mapping of import path and package name for packages that can be imported
 * Possible to return empty if useCache options is used.
 * @param filePath. Used to determine the right relative path for vendor pkgs
 * @param useCache. Force to use cache
 * @returns Map<string, string> mapping between package import path and package name
 */
export function getImportablePackages(filePath: string, useCache: boolean = false): Promise<Map<string, PackageInfo>> {
	filePath = fixDriveCasingInWindows(filePath);
	const fileDirPath = path.dirname(filePath);

	let foundPkgRootDir = pkgRootDirs.get(fileDirPath);
	const workDir = foundPkgRootDir || fileDirPath;
	const cache = allPkgsCache.get(workDir);

	const getAllPackagesPromise: Promise<Map<string, PackageInfo>> =
		useCache && cache ? Promise.race([getAllPackages(workDir), cache.entry]) : getAllPackages(workDir);

	return Promise.all([getAllPackagesPromise]).then(([pkgs]) => {
		const pkgMap = new Map<string, PackageInfo>();
		if (!pkgs) {
			return pkgMap;
		}

		// const currentWorkspace = getCurrentGoWorkspaceFromGOPATH(getCurrentGoPath(), fileDirPath);
		pkgs.forEach((info, pkgPath) => {
			if (info.name === 'main') {
				return;
			}
            pkgMap.set(pkgPath, info);
		});
		return pkgMap;
	});
}

function getAllPackagesNoCache(workDir: string): Promise<Map<string, PackageInfo>> {
	return new Promise<Map<string, PackageInfo>>((resolve, reject) => {
		// Use subscription style to guard costly/long running invocation
		const callback = (pkgMap: Map<string, PackageInfo>) => {
			resolve(pkgMap);
		};

		let subs = gopkgsSubscriptions.get(workDir);
		if (!subs) {
			subs = [];
			gopkgsSubscriptions.set(workDir, subs);
		}
		subs.push(callback);

		// Ensure only single gokpgs running
		if (!gopkgsRunning.has(workDir)) {
			gopkgsRunning.add(workDir);

			gopkgs(workDir).then((pkgMap) => {
				gopkgsRunning.delete(workDir);
				gopkgsSubscriptions.delete(workDir);
				subs.forEach((cb) => cb(pkgMap));
			});
		}
	});
}

/**
 * Runs gopkgs
 * @argument workDir. The workspace directory of the project.
 * @returns Map<string, string> mapping between package import path and package name
 */
export async function getAllPackages(workDir: string): Promise<Map<string, PackageInfo>> {
	const cache = allPkgsCache.get(workDir);
	const useCache = cache && new Date().getTime() - cache.lastHit < cacheTimeout;
	if (useCache) {
		cache.lastHit = new Date().getTime();
		return Promise.resolve(cache.entry);
	}

	const pkgs = await getAllPackagesNoCache(workDir);
	if (!pkgs || pkgs.size === 0) {
		if (!gopkgsNotified) {
			vscode.window.showInformationMessage(
				'Could not find packages. Ensure `gopkgs -format {{.Name}};{{.ImportPath}}` runs successfully.'
			);
			gopkgsNotified = true;
		}
	}
	allPkgsCache.set(workDir, {
		entry: pkgs,
		lastHit: new Date().getTime()
	});
	return pkgs;
}