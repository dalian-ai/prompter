import { isEqual } from '../util';
import { faBook, faPlug, faRobot, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { DocumentIndexStep } from './documentIndex';
import type { RestStep } from './rest';
import type { PromptStep } from './prompts';

export const promptSchemaVersion: number = 5; /* 5: prompts -> steps */
                                              /* 4: camelCase; add predictionService, predictionSettings */
                                              /* 3: records are prompt chains */
                                              /* 2: plain text promptText */
                                              /* 1: HTML promptText with Jinja2 template */

/*
 * Interfaces
 */

export enum StepType {
  prompt = "prompt",
  documentIndex = "documentIndex",
  rest = "rest"
}

export interface PromptChain {
  version: number;
  title: string;
  steps: Step[];
  parametersDict: Record<string, string>;
}

export interface Step {
  title: string;
  stepType: StepType,
  resultKey: string;
  results?: StepResult[] | null;
  minimized: boolean;
}

export interface StepResult {
  datetime: Date,
  resultRaw: string,
  resultJson: object | null
}

interface StepTypeData {
  label: string,
  icon: IconDefinition
}

export const STEP_TYPE_DATA: Record<StepType, StepTypeData> = {
  [StepType.prompt]: {
      label: "Prompt",
      icon: faRobot,
  },
  [StepType.rest]: {
      label: "API Call",
      icon: faPlug,
  },
  [StepType.documentIndex]: {
      label: "Document Index",
      icon: faBook,
  }
};

/*
 * Util
 */

const paramParseRegex = /\{\{\s*(\w+)\s*(?:\||\}\})/gi // Jinja variables

export function isValidChain(promptChain: PromptChain) : boolean {
  for (let step of promptChain.steps) {
    if (! isValidParamName(step.resultKey)) return false;
  }
  return true;
}

export function isValidParamName(s: string) : boolean {
  return (s.match(/^\w+$/gi) && s.search("__") == -1 && true) || false;
}

/**
 * Matches and return parameter names in a prompt template
 * @param prompt A Prompt step in a Chain
 * @returns The list of parameter names that are matched in the prompt template message
 */
export function stepParameterNameList(step: Step) : Array<string> {
  let result: string[] = [];

  let fieldsToMatch: string[] = [];
  if (step.stepType == StepType.prompt) {
    fieldsToMatch = [(step as PromptStep).promptText]
  } else if (step.stepType == StepType.rest) {
    const restStep = (step as RestStep);
    fieldsToMatch = [
      restStep.url,
    ];
    if (restStep.body) fieldsToMatch.push(restStep.body);
    restStep.headers.forEach((h) => {fieldsToMatch.push(h.value)});
  } else if (step.stepType == StepType.documentIndex) {
    const docIndexStep = (step as DocumentIndexStep);
    docIndexStep.queries.forEach((q) => {fieldsToMatch.push(q.text)});
  } else {
    throw Error("Unsupported step type");
  }

  let newParamList: string[] = [];
  fieldsToMatch.forEach((s: string) => {
    let matchedParams = s.matchAll(paramParseRegex);
    if (matchedParams) {
      for (let param of matchedParams) {
        let paramName = param[1];
        // if (paramDict[paramName] == undefined) { paramDict[paramName] = ""; }
        newParamList.push(paramName);
      }
    }
  });
  
  result = Array.from(new Set(newParamList));

  return result;
}

/**
 * Extracts the list of parameters from the prompt chain. This is the list of Jinja
 * variables that are matched in the chain prompts. Those which name is a prompt's
 * result key are excluded by default.
 * NOTE: prompt order is not taken into account yet
 * @param promptChain Any prompt chain
 * @param includeResultKeys Also include parameter names which name is a result key in the chain
 * @returns The list of parameters that should be used to solve the template
 */
export function parameterNameList(promptChain: PromptChain, includeResultKeys = false) : Array<string> {
  let result: string[] = [];
  const resultKeys: Set<string> = new Set(promptChain.steps.map(step => {return step.resultKey}));
  promptChain.steps.forEach(step => {
    stepParameterNameList(step).forEach(paramName => {
      if (includeResultKeys || ! resultKeys.has(paramName)) result.push(paramName);
    })
  });
  if (includeResultKeys) result = [...result, ...resultKeys];
  return [...new Set(result)];
}

export function parameterDict(promptChain: PromptChain) : Record<string, string> {
  let result: Record<string, string> = {};

  promptChain.steps.forEach(step => {
    const paramList = stepParameterNameList(step);
    paramList.forEach((paramName) => {
      result[paramName] = promptChain.parametersDict[paramName] ?? '';
    });
  });

  return result;
}

export function piledParameterDict(promptChain: PromptChain) : Record<string, string> {
  let result: Record<string, string> = promptChain.parametersDict;

  promptChain.steps.forEach(step => {
    const paramList = stepParameterNameList(step);
    paramList.forEach((paramName) => {
      result[paramName] = promptChain.parametersDict[paramName] ?? '';
    });
  });
  
  return result;
}

/*
 * Comparison
 */

export function areChainsEquivalent(aChain: PromptChain, anotherChain: PromptChain): boolean {
  // console.log(aChain, anotherChain);
  if (aChain.title != anotherChain.title) return false;
  if (aChain.steps.length != anotherChain.steps.length) return false;
  if (! isEqual(parameterDict(aChain), parameterDict(anotherChain))) return false;

  for (let i = 0; i < aChain.steps.length; i++) {
    const aStep: Step = aChain.steps[i];
    const anotherStep: Step = anotherChain.steps[i];
    if (aStep.stepType != anotherStep.stepType) return false;
    if (aStep.title != anotherStep.title) return false;
    if (aStep.resultKey != anotherStep.resultKey) return false;
    if (aStep.minimized != anotherStep.minimized) return false;
    if (! isEqual(aStep.results, anotherStep.results)) return false;


    if (aStep.stepType == StepType.prompt) {
      if (! arePromptsEquivalent(aStep as PromptStep, anotherStep as PromptStep)) return false;
    } else if (aStep.stepType == StepType.rest) {
      if (! areRestStepsEquivalent(aStep as RestStep, anotherStep as RestStep)) return false;
    } else if (aStep.stepType == StepType.documentIndex) {
      if (! areDocumentIndexStepsEquivalent(aStep as DocumentIndexStep, anotherStep as DocumentIndexStep)) return false;
    } else {
      throw Error("Unsupported step type");
    }
  }
  
  return true;
}

function arePromptsEquivalent(aPrompt: PromptStep, anotherPrompt: PromptStep) : boolean {
  if (aPrompt.promptText != anotherPrompt.promptText) return false;
  if (aPrompt.predictionService != anotherPrompt.predictionService) return false;
  if (! isEqual(aPrompt.predictionSettings, anotherPrompt.predictionSettings)) return false;
  return true;
}

function areRestStepsEquivalent(aRestStep: RestStep, anotherRestStep: RestStep) : boolean {
  if (aRestStep.method != anotherRestStep.method) return false;
  if (aRestStep.url != anotherRestStep.url) return false;
  if (! isEqual(aRestStep.headers, anotherRestStep.headers)) return false;
  if (aRestStep.body != anotherRestStep.body) return false;
  if (aRestStep.proxied != anotherRestStep.proxied) return false;
  return true;
}

function areDocumentIndexStepsEquivalent(aDocIndexStep: DocumentIndexStep, anotherDocIndexStep: DocumentIndexStep) {
  if (! isEqual(aDocIndexStep.documents, anotherDocIndexStep.documents)) return false;
  if (! isEqual(aDocIndexStep.embeddingService, anotherDocIndexStep.embeddingService)) return false;
  if (! isEqual(aDocIndexStep.embeddingSettings, anotherDocIndexStep.embeddingSettings)) return false;
  if (! isEqual(aDocIndexStep.queries, anotherDocIndexStep.queries)) return false;
  return true;
}
