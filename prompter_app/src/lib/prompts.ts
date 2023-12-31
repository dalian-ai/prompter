import fs from 'fs';
import util from 'util';

import { convert } from 'html-to-text';
import nunjucks from 'nunjucks';
nunjucks.configure({autoescape: false, trimBlocks: true});
nunjucks.installJinjaCompat();

export const promptSchemaVersion: number = 3; /* 3: records are prompt chains */
                                              /* 2: plain text promptText */
                                              /* 1: HTML promptText with Jinja2 template */

function assert(value: unknown) {
  if (! value) {
    throw Error("Assertion Error (todo: find out how assertions work in typescript...");
  }
}

/*
 * Interfaces
 */

export interface PromptPrediction {
  datetime: Date,
  renderedPrompt: string,
  predictionRaw: string,
  model: string
}

export interface Prompt {
  version: number;
  prompt_text: string;
  parameters_dict: Record<string, string>;
  title: string;
  predictions?: PromptPrediction[] | null;
}

export interface PromptChain {
  version: number;
  title: string;
  prompts: Prompt[];
}


/*
 * Input/Output
 */

function chainBasePath(promptId: string) {
  return `./data/${promptId[0]}/${promptId}`
}

function chainDataPath(promptId: string) {
  return chainBasePath(promptId) + '/prompt.json'
}

function chainEditKeyPath(promptId: string) {
  return chainBasePath(promptId) + '/editKey'
}

export function saveChain(chainId: string, chain: PromptChain, editKey: string) {
  // export function save({promptId: string, prompt: Prompt}) {
  console.debug(`Saving chain "${chainId}": ` + util.inspect(chain, {showHidden: false, depth: null, colors: true}));

  const basePath: string = chainBasePath(chainId);
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    fs.writeFileSync(
      chainEditKeyPath(chainId),
      editKey,
      'utf8'
    );
  } else if (! isValidEditKey(chainId, editKey)) {
    throw new PermissionDeniedError(`Incorrect editKey for prompt record at: ${basePath}`)
  }

  fs.writeFileSync(
    chainDataPath(chainId),
    JSON.stringify(chain),
    'utf8'
  );
}

function isValidEditKey(chainId: string, editKey: string): boolean {
  let expected: string = fs.readFileSync(chainEditKeyPath(chainId)).toString();
  return expected == editKey;
}

export function loadChain(chainId: string): PromptChain {
  let rawdata: Buffer;

  try {
    rawdata = fs.readFileSync(chainDataPath(chainId));
  } catch (error: any) {
    const nodeError: NodeJS.ErrnoException = error;
    if (nodeError.code == "ENOENT") {
      throw new ChainNotFoundError("Chain not found");
    } 
    throw error;
  }

  let chainOrPrompt: PromptChain | Prompt = JSON.parse(rawdata.toString());

  // Upgrade if legacy record
  let chain = upgradeChainOrPrompt(chainOrPrompt)

  return chain;
}

export function renderPrompt(promptText: string, paramDict: Record<string, string>): string {
  let result = promptText;
  result = nunjucks.renderString(promptText, paramDict);
  return result.trim();
}

export class ChainNotFoundError extends Error {};
export class PermissionDeniedError extends Error {};



/*
 * Record Compatibility
 */

function upgradeChainOrPrompt(chainOrPrompt: PromptChain | Prompt): PromptChain {
  if (chainOrPrompt.version <= 2) {
    return upgradePrompt(chainOrPrompt as Prompt)
  }

  return upgradeChain(chainOrPrompt as PromptChain);
}

function upgradePrompt(prompt: Prompt): PromptChain {
  assert(prompt.version <= 2); // From v3 records have PromptChain type

  if (prompt.version == 1) {
    prompt.prompt_text = convert(prompt.prompt_text);
    prompt.version = 2;
  }

  let result = {
    version: promptSchemaVersion,
    title: prompt.title,
    prompts: [prompt]
  }

  return upgradeChain(result);
}

function upgradeChain(chain: PromptChain): PromptChain {
  return chain;
}


/*
 * Util
 */

const paramParseRegex = /\{\{\s*(\w+)\s*(?:\||\}\})/gi // Jinja variables


export function parameterNameList(prompt: Prompt) : Array<string> {
  let paramList: string[] = [];

  let matchedParams = prompt.prompt_text.matchAll(paramParseRegex);
  if (matchedParams) {
    let newParamList = [];
    for (let param of matchedParams) {
      let paramName = param[1];
      // if (paramDict[paramName] == undefined) { paramDict[paramName] = ""; }
      newParamList.push(paramName);
    }
    paramList = Array.from(new Set(newParamList));
  }

  return paramList;
}

export function parameterDict(prompt: Prompt) : Record<string, string> {
  let result: Record<string, string> = {};

  const paramList = parameterNameList(prompt);
  paramList.forEach((paramName) => {
    result[paramName] = prompt.parameters_dict[paramName] ?? '';
  });

  return result;
}

export function piledParameterDict(prompt: Prompt) : Record<string, string> {
  let result: Record<string, string> = prompt.parameters_dict;

  const paramList = parameterNameList(prompt);
  paramList.forEach((paramName) => {
    result[paramName] = prompt.parameters_dict[paramName] ?? '';
  });

  return result;
}