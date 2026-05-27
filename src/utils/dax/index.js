/**
 * dax/index.js — Public API for the DAX subsystem.
 *
 * Usage:
 *   import { evaluateMeasure, validateFormula, listFunctions } from "@/utils/dax";
 *
 *   const { value, error } = evaluateMeasure(measure, {
 *     rows: filteredRows,
 *     fullRows: allRows,
 *     measures: allMeasures,
 *     dataTypes,
 *   });
 */

export { tokenize, DAXError, T as TOK } from "./tokenizer.js";
export { parse, extractReferences, walk } from "./parser.js";
export { evaluate, evaluateMeasure, validateFormula } from "./evaluator.js";
export { FUNCTIONS, listFunctions, extractColumnName } from "./functions.js";
